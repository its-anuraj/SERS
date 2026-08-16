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
    const jwtSecret = process.env.JWT_SECRET || 'sers_super_secure_emergency_jwt_secret_key_2026';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'sers_super_secure_emergency_refresh_secret_key_2026';

    const accessToken = jwt.sign(
        { userId, role, hospitalId },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    const refreshToken = jwt.sign(
        { userId, role, hospitalId, type: 'refresh' },
        jwtRefreshSecret,
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
            bloodGroup,
            govtIdType = null,
            govtIdNumber = null,
            vehicleNumber = null,
            badgeId = null,
            vehicleRegNumber = null,
            drivingLicense = null,
            abhaId = null,
            abhaAddress = null,
        } = req.body;

        // Check if phone already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE phone = $1 AND deleted_at IS NULL',
            [phone]
        );
        if (existingUser.rows.length > 0) {
            throw new ApiError(409, 'Phone number already registered. Please sign in with your password or OTP.');
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

            // Insert user with government verification and vehicle fields
            const userResult = await client.query(
                `INSERT INTO users (
                    name, phone, email, password_hash, role, hospital_id,
                    staff_title, department, specialization,
                    preferred_language, govt_id_type, govt_id_number,
                    vehicle_number, badge_id, vehicle_reg_number, driving_license,
                    abha_id, abha_address,
                    is_active, is_verified
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, TRUE, TRUE)
                 RETURNING id, name, phone, email, role, hospital_id, staff_title, department, specialization,
                           govt_id_type, govt_id_number, vehicle_number, badge_id, vehicle_reg_number, driving_license,
                           abha_id, abha_address, preferred_language, created_at`,
                [
                    name.trim(), phone.trim(), email ? email.trim() : null, passwordHash,
                    role, effectiveHospitalId,
                    staffTitle ? staffTitle.trim() : null,
                    department ? department.trim() : null,
                    specialization ? specialization.trim() : null,
                    preferredLanguage,
                    govtIdType ? govtIdType.trim() : null,
                    govtIdNumber ? govtIdNumber.trim() : null,
                    vehicleNumber ? vehicleNumber.trim() : null,
                    badgeId ? badgeId.trim() : null,
                    vehicleRegNumber ? vehicleRegNumber.trim() : null,
                    drivingLicense ? drivingLicense.trim() : null,
                    abhaId ? abhaId.trim() : null,
                    abhaAddress ? abhaAddress.trim() : null,
                ]
            );
            const newUser = userResult.rows[0];

            // Create medical profile
            await client.query(
                `INSERT INTO medical_profiles (user_id, blood_group, abha_id, abha_address) VALUES ($1, $2, $3, $4)`,
                [newUser.id, bloodGroup || null, abhaId || null, abhaAddress || null]
            ).catch(() => {});

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

        const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'sers_super_secure_emergency_refresh_secret_key_2026';
        const decoded = jwt.verify(refreshToken, jwtRefreshSecret);
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
        if (token) {
            const decoded = jwt.decode(token);
            if (decoded && decoded.exp) {
                const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
                if (expiresIn > 0) {
                    await blacklistToken(token, expiresIn);
                }
            }
        }

        logger.info('User logged out', { userId: req.user ? req.user.id : null });
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/auth/fcm-token
 */
const updateFcmToken = async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) throw new ApiError(400, 'FCM token required');

        await query('UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2', [token, req.user.id]);
        res.json({ success: true, message: 'FCM token updated successfully' });
    } catch (error) {
        next(error);
    }
};

const otpService = require('../services/otp.service');

/**
 * POST /api/auth/send-otp
 * Body: { identifier: string, requireStaffRole?: boolean }
 */
const sendOTP = async (req, res, next) => {
    try {
        const { identifier, requireStaffRole = false } = req.body;
        if (!identifier || !identifier.trim()) {
            throw new ApiError(400, 'Mobile number or Email address is required');
        }

        const cleanId = identifier.trim();
        const isEmail = cleanId.includes('@');

        // Verify that user exists in registered database
        const userCheck = await query(
            'SELECT id, name, phone, email, role, is_active FROM users WHERE (phone = $1 OR LOWER(email) = LOWER($1)) AND deleted_at IS NULL',
            [cleanId]
        );

        if (userCheck.rows.length === 0) {
            throw new ApiError(404, 'Authentication Declined: This mobile number or email is not registered with SERS. Please register as an authentic Citizen or Ambulance Responder first.');
        }

        const user = userCheck.rows[0];
        if (!user.is_active) {
            throw new ApiError(403, 'Account is deactivated or pending verification. Please contact support.');
        }

        if (requireStaffRole && user.role === 'citizen') {
            throw new ApiError(403, 'Access Restricted: This web portal is for authorized hospital doctors, medical staff, and emergency coordinators. Please use the SERS mobile app.');
        }

        // Generate and store OTP
        const otp = await otpService.generateAndStoreOTP(cleanId);

        let dispatchResult;
        if (isEmail) {
            dispatchResult = await otpService.sendEmailOTP(cleanId, otp);
        } else {
            dispatchResult = await otpService.sendSmsOTP(cleanId, otp);
            // If user account has a registered email, also dispatch live email OTP
            if (user.email && user.email.includes('@') && !user.email.endsWith('@users.sers.in')) {
                otpService.sendEmailOTP(user.email, otp).catch(e => logger.warn('Email fallback copy notice:', e.message));
            }
        }

        if (!dispatchResult.sent) {
            throw new ApiError(500, dispatchResult.message || 'Failed to dispatch verification code');
        }

        res.json({
            success: true,
            message: dispatchResult.message || `Verification code sent to ${cleanId}`,
            data: {
                identifier: cleanId,
                type: isEmail ? 'email' : 'phone',
                previewOtp: otp,
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/verify-otp
 * Body: { identifier: string, otp: string, requireStaffRole?: boolean }
 */
const verifyOTP = async (req, res, next) => {
    try {
        const { identifier, otp, requireStaffRole = false } = req.body;
        if (!identifier || !otp) {
            throw new ApiError(400, 'Identifier and OTP are required');
        }

        const isValid = await otpService.verifyOTP(identifier, otp);
        if (!isValid) {
            throw new ApiError(401, 'Invalid or expired OTP verification code');
        }

        const cleanId = identifier.trim();

        // Fetch verified user from database
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

        if (userResult.rows.length === 0) {
            throw new ApiError(404, 'User account not found. Please register first.');
        }

        const user = userResult.rows[0];
        if (!user.is_active) {
            throw new ApiError(403, 'Account is deactivated. Please contact support.');
        }

        if (requireStaffRole && user.role === 'citizen') {
            throw new ApiError(403, 'Access Restricted: Only verified hospital staff and administrative personnel can access the Hospital Command Center.');
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
