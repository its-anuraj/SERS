/**
 * Auth Controller — Register, Login, Refresh, Logout
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, withTransaction } = require('../config/database');
const { blacklistToken } = require('../config/redis');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Generate JWT token pair
 */
const generateTokens = (userId, role, hospitalId = null) => {
    const accessToken = jwt.sign(
        { userId, role, hospitalId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    const refreshToken = jwt.sign(
        { userId, role, hospitalId, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
    return { accessToken, refreshToken };
};

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
    try {
        const {
            name, phone, email, password,
            role = 'citizen',
            hospitalId = null,
            hospitalName = null,
            hospitalAddress = null,
            hospitalCity = 'Bengaluru',
            hospitalPhone = null,
            icuBedsTotal = 15,
            icuBedsAvailable = 8,
            erBedsTotal = 25,
            erBedsAvailable = 12,
            staffTitle = null,
            department = null,
            specialization = null,
            preferredLanguage = 'en',
            bloodGroup
        } = req.body;

        // Check if phone already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE phone = $1 AND deleted_at IS NULL',
            [phone]
        );
        if (existingUser.rows.length > 0) {
            throw new ApiError(409, 'Phone number already registered');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Create user + hospital + medical profile in transaction
        const { user, tokens } = await withTransaction(async (client) => {
            let effectiveHospitalId = hospitalId;
            let effectiveHospitalName = hospitalName;

            // If hospitalName is provided and user is hospital staff/admin, create or link hospital
            if (hospitalName && !effectiveHospitalId && (role === 'hospital_staff' || role === 'hospital_admin')) {
                // Check if hospital with same name exists
                const existingHosp = await client.query(
                    'SELECT id, name FROM hospitals WHERE LOWER(name) = LOWER($1)',
                    [hospitalName.trim()]
                );
                if (existingHosp.rows.length > 0) {
                    effectiveHospitalId = existingHosp.rows[0].id;
                    effectiveHospitalName = existingHosp.rows[0].name;
                } else {
                    const hospRes = await client.query(
                        `INSERT INTO hospitals (
                            name, address, city, state, latitude, longitude,
                            phone, emergency_phone, email,
                            icu_beds_total, icu_beds_available, er_beds_total, er_beds_available,
                            is_on_sers_network, is_active
                         ) VALUES ($1, $2, $3, 'Karnataka', 12.9716, 77.5946, $4, $4, $5, $6, $7, $8, $9, TRUE, TRUE)
                         RETURNING id, name, city, address, icu_beds_available, icu_beds_total, er_beds_available, er_beds_total`,
                        [
                            hospitalName.trim(),
                            hospitalAddress ? hospitalAddress.trim() : 'Emergency Medical Center',
                            hospitalCity ? hospitalCity.trim() : 'Bengaluru',
                            hospitalPhone ? hospitalPhone.trim() : phone.trim(),
                            email ? email.trim() : `emergency@${hospitalName.toLowerCase().replace(/[^a-z0-9]/g, '')}.sers.in`,
                            parseInt(icuBedsTotal) || 15,
                            parseInt(icuBedsAvailable) || 8,
                            parseInt(erBedsTotal) || 25,
                            parseInt(erBedsAvailable) || 12,
                        ]
                    );
                    effectiveHospitalId = hospRes.rows[0].id;
                    effectiveHospitalName = hospRes.rows[0].name;
                }
            }

            // Insert user
            const userResult = await client.query(
                `INSERT INTO users (
                    name, phone, email, password_hash, role, hospital_id,
                    staff_title, department, specialization,
                    preferred_language, is_active, is_verified
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, TRUE)
                 RETURNING id, name, phone, email, role, hospital_id, staff_title, department, specialization, preferred_language, created_at`,
                [
                    name.trim(), phone.trim(), email ? email.trim() : null, passwordHash,
                    role, effectiveHospitalId,
                    staffTitle ? staffTitle.trim() : null,
                    department ? department.trim() : null,
                    specialization ? specialization.trim() : null,
                    preferredLanguage
                ]
            );
            const newUser = userResult.rows[0];

            // Create medical profile
            await client.query(
                `INSERT INTO medical_profiles (user_id, blood_group) VALUES ($1, $2)`,
                [newUser.id, bloodGroup || null]
            );

            // If doctor or hospital nurse, automatically record their initial duty shift check-in
            if (role === 'hospital_staff' && department) {
                await client.query(
                    `INSERT INTO duty_attendance 
                        (user_id, hospital_id, staff_type, name, phone, department, specialization, shift, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Morning (08:00 - 16:00)', 'on_duty')`,
                    [
                        newUser.id, effectiveHospitalId, 'doctor', newUser.name,
                        newUser.phone, department, specialization || staffTitle
                    ]
                ).catch(() => {});
            }

            const tokens = generateTokens(newUser.id, newUser.role, newUser.hospital_id);
            return {
                user: {
                    ...newUser,
                    hospitalName: effectiveHospitalName,
                },
                tokens
            };
        });

        logger.info('New user registered', { userId: user.id, role: user.role, phone: user.phone, hospitalId: user.hospital_id });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    role: user.role,
                    hospitalId: user.hospital_id,
                    hospitalName: user.hospitalName,
                    staffTitle: user.staff_title,
                    department: user.department,
                    specialization: user.specialization,
                    preferredLanguage: user.preferred_language,
                },
                tokens,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
    try {
        const { phone, email, identifier, password } = req.body;
        const lookup = identifier || phone || email;

        if (!lookup) {
            throw new ApiError(400, 'Phone number or email is required');
        }

        // Find user by phone OR email with joined hospital info (case-insensitive email)
        let result;
        try {
            result = await query(
                `SELECT u.id, u.name, u.phone, u.email, u.role, u.hospital_id, u.staff_title, u.department, u.specialization,
                        u.password_hash, u.is_active, u.preferred_language, u.fcm_token,
                        h.name AS hospital_name, h.city AS hospital_city, h.address AS hospital_address,
                        h.icu_beds_total, h.icu_beds_available, h.er_beds_total, h.er_beds_available
                 FROM users u
                 LEFT JOIN hospitals h ON u.hospital_id = h.id
                 WHERE (u.phone = $1 OR LOWER(u.email) = LOWER($1)) AND u.deleted_at IS NULL`,
                [lookup]
            );
        } catch (dbErr) {
            // Fallback for legacy database schema
            result = await query(
                `SELECT u.id, u.name, u.phone, u.email, u.role,
                        u.password_hash, u.is_active, u.preferred_language, u.fcm_token
                 FROM users u
                 WHERE (u.phone = $1 OR LOWER(u.email) = LOWER($1)) AND u.deleted_at IS NULL`,
                [lookup]
            );
        }

        const normalizedPass = (password || '').trim().toLowerCase();
        const isMasterDemoPassword = ['test@1234', 'test1234'].includes(normalizedPass);
        const isDemoIdentifier = [
            'admin@sers.in', 'drmeera@demo.sers.in', 'drrajesh@demo.sers.in', 'arjun@demo.sers.in', 'ravi@demo.sers.in', 'priya@demo.sers.in', 'suresh@demo.sers.in', 'coord@sers.in',
            '+919876500001', '+919876500002', '+919876500003', '+919876500004', '+919876500005', '+919876500006', '+919876500007',
            '9876500001', '9876500002', '9876500003', '9876500004', '9876500005', '9876500006', '9876500007'
        ].includes(lookup.toLowerCase());

        let user;

        if (result.rows.length === 0) {
            // Auto-provision demo account if requested with default credentials
            if (isDemoIdentifier && isMasterDemoPassword) {
                const passHash = await bcrypt.hash('Test@1234', 10);
                const role = lookup.includes('admin') ? 'admin' : (lookup.includes('dr') || lookup.includes('meera')) ? 'hospital_staff' : lookup.includes('coord') ? 'coordinator' : lookup.includes('ravi') || lookup.includes('suresh') ? 'responder' : 'citizen';
                const name = lookup.includes('admin') ? 'Admin SERS' : lookup.includes('meera') ? 'Dr. Meera Nair' : lookup.includes('rajesh') ? 'Dr. Rajesh Rao' : lookup.includes('coord') ? 'Coordinator Bengaluru' : 'Arjun Kumar';
                const phone = lookup.startsWith('+91') ? lookup : (lookup.includes('admin') ? '+919876500006' : lookup.includes('meera') ? '+919876500005' : lookup.includes('coord') ? '+919876500007' : '+919876500001');

                const ins = await query(
                    `INSERT INTO users (name, phone, email, password_hash, role, is_active, is_verified)
                     VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
                     ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash
                     RETURNING id, name, phone, email, role, hospital_id, staff_title, department, specialization, is_active, preferred_language`,
                    [name, phone, lookup.toLowerCase(), passHash, role]
                );
                user = ins.rows[0];
            } else {
                throw new ApiError(401, 'Invalid email/phone or password');
            }
        } else {
            user = result.rows[0];
        }

        if (!user.is_active) {
            throw new ApiError(403, 'Account has been deactivated. Contact support.');
        }

        // Verify password
        let passwordMatch = false;
        if (user.password_hash) {
            passwordMatch = await bcrypt.compare(password, user.password_hash);
        }
        
        // Demo account master password fallback
        if (!passwordMatch && isDemoIdentifier && isMasterDemoPassword) {
            passwordMatch = true;
            // Update hash in DB so future comparisons match directly
            const defaultHash = await bcrypt.hash('Test@1234', 10);
            await query('UPDATE users SET password_hash = $1 WHERE id = $2', [defaultHash, user.id]).catch(() => {});
        }

        if (!passwordMatch) {
            throw new ApiError(401, 'Invalid email/phone or password');
        }

        const tokens = generateTokens(user.id, user.role, user.hospital_id);

        logger.info('User logged in', { userId: user.id, role: user.role, hospitalId: user.hospital_id });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    role: user.role,
                    hospitalId: user.hospital_id,
                    hospitalName: user.hospital_name,
                    hospitalCity: user.hospital_city,
                    hospitalAddress: user.hospital_address,
                    staffTitle: user.staff_title,
                    department: user.department,
                    specialization: user.specialization,
                    icuBedsAvailable: user.icu_beds_available,
                    icuBedsTotal: user.icu_beds_total,
                    erBedsAvailable: user.er_beds_available,
                    erBedsTotal: user.er_beds_total,
                    preferredLanguage: user.preferred_language,
                },
                tokens,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/refresh
 */
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) throw new ApiError(400, 'Refresh token required');

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        if (decoded.type !== 'refresh') throw new ApiError(401, 'Invalid refresh token');

        // Verify user still exists
        const result = await query(
            'SELECT id, role, is_active FROM users WHERE id = $1 AND deleted_at IS NULL',
            [decoded.userId]
        );
        if (result.rows.length === 0 || !result.rows[0].is_active) {
            throw new ApiError(401, 'User not found or deactivated');
        }

        const tokens = generateTokens(decoded.userId, decoded.role);

        res.json({ success: true, data: { tokens } });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return next(new ApiError(401, 'Invalid or expired refresh token'));
        }
        next(error);
    }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
    try {
        // Blacklist the current access token
        const token = req.token;
        const decoded = jwt.decode(token);
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
            await blacklistToken(token, expiresIn);
        }

        logger.info('User logged out', { userId: req.user.id });
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
};

const otpService = require('../services/otp.service');

/**
 * POST /api/auth/send-otp
 * Body: { identifier: string } // email or phone
 */
const sendOTP = async (req, res, next) => {
    try {
        const { identifier } = req.body;
        if (!identifier || !identifier.trim()) {
            throw new ApiError(400, 'Mobile number or Email address is required');
        }

        const cleanId = identifier.trim();
        const isEmail = cleanId.includes('@');

        // Generate and store OTP
        const otp = await otpService.generateAndStoreOTP(cleanId);

        let dispatchResult;
        if (isEmail) {
            dispatchResult = await otpService.sendEmailOTP(cleanId, otp);
        } else {
            dispatchResult = await otpService.sendSmsOTP(cleanId, otp);
        }

        res.json({
            success: true,
            message: dispatchResult.message || `Verification code sent to ${cleanId}`,
            data: {
                identifier: cleanId,
                type: isEmail ? 'email' : 'phone',
                mode: dispatchResult.mode,
                previewOtp: dispatchResult.previewOtp // visible in simulated mode for instant testing
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/verify-otp
 * Body: { identifier: string, otp: string, role?: string, name?: string }
 */
const verifyOTP = async (req, res, next) => {
    try {
        const { identifier, otp, role = 'citizen', name = null } = req.body;
        if (!identifier || !otp) {
            throw new ApiError(400, 'Identifier and OTP are required');
        }

        const isValid = await otpService.verifyOTP(identifier, otp);
        if (!isValid) {
            throw new ApiError(401, 'Invalid or expired OTP verification code');
        }

        const cleanId = identifier.trim();
        const isEmail = cleanId.includes('@');

        // Find or auto-provision user
        let userResult;
        try {
            userResult = await query(
                `SELECT u.id, u.name, u.phone, u.email, u.role, u.hospital_id, u.staff_title, u.department, u.specialization,
                        u.is_active, u.preferred_language, u.fcm_token,
                        h.name AS hospital_name, h.city AS hospital_city
                 FROM users u
                 LEFT JOIN hospitals h ON u.hospital_id = h.id
                 WHERE (u.phone = $1 OR LOWER(u.email) = LOWER($1)) AND u.deleted_at IS NULL`,
                [cleanId]
            );
        } catch {
            userResult = await query(
                `SELECT u.id, u.name, u.phone, u.email, u.role,
                        u.is_active, u.preferred_language, u.fcm_token
                 FROM users u
                 WHERE (u.phone = $1 OR LOWER(u.email) = LOWER($1)) AND u.deleted_at IS NULL`,
                [cleanId]
            );
        }

        let user;
        if (userResult.rows.length === 0) {
            // Auto-provision new user via OTP login
            const passHash = await bcrypt.hash('Test@1234', 10);
            const userRole = role || (cleanId.includes('admin') ? 'admin' : (cleanId.includes('dr') || cleanId.includes('meera')) ? 'hospital_staff' : 'citizen');
            const userName = name || (cleanId.includes('admin') ? 'Admin SERS' : cleanId.includes('meera') ? 'Dr. Meera Nair' : cleanId.split('@')[0] || 'SERS Citizen');
            const userPhone = isEmail ? `+91${Math.floor(1000000000 + Math.random() * 9000000000)}` : cleanId;
            const userEmail = isEmail ? cleanId : `${cleanId.replace('+', '')}@users.sers.in`;

            const ins = await query(
                `INSERT INTO users (name, phone, email, password_hash, role, is_active, is_verified)
                 VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
                 RETURNING id, name, phone, email, role, hospital_id, staff_title, department, specialization, is_active, preferred_language`,
                [userName, userPhone, userEmail, passHash, userRole]
            );
            user = ins.rows[0];
        } else {
            user = userResult.rows[0];
        }

        if (!user.is_active) {
            throw new ApiError(403, 'Account has been deactivated');
        }

        const tokens = generateTokens(user.id, user.role, user.hospital_id);

        logger.info('User authenticated via OTP', { userId: user.id, role: user.role, identifier: cleanId });

        res.json({
            success: true,
            message: 'OTP verification successful',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    role: user.role,
                    hospitalId: user.hospital_id || null,
                    hospitalName: user.hospital_name || null,
                    hospitalCity: user.hospital_city || null,
                    staffTitle: user.staff_title || null,
                    department: user.department || null,
                    specialization: user.specialization || null,
                    preferredLanguage: user.preferred_language || 'en',
                },
                tokens,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { register, login, refresh, logout, updateFcmToken, sendOTP, verifyOTP };
