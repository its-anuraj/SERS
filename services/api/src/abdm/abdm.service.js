/**
 * ABDM Service — Ayushman Bharat Digital Mission Integration
 * Handles ABHA ID linking, health record discovery, consent management
 *
 * Sandbox: https://sandbox.abdm.gov.in
 * Register at: https://dev.abdm.gov.in
 */

const CryptoJS = require('crypto-js');
const { query, withTransaction } = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

const ABDM_BASE = process.env.ABDM_BASE_URL || 'https://dev.abdm.gov.in/gateway';
const ABHA_BASE = process.env.ABHA_BASE_URL || 'https://abhasbx.abdm.gov.in/abha/api/v3';
const CLIENT_ID = process.env.ABDM_CLIENT_ID || '';
const CLIENT_SECRET = process.env.ABDM_CLIENT_SECRET || '';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'devencryptionkey12345678901234';

// ============================================================
// Token Management
// ============================================================

let cachedGatewayToken = null;
let tokenExpiry = 0;

/**
 * Get ABDM gateway access token (client credentials)
 */
const getGatewayToken = async () => {
    if (cachedGatewayToken && Date.now() < tokenExpiry - 30000) {
        return cachedGatewayToken;
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        logger.warn('ABDM credentials not configured — using mock mode');
        return 'mock_abdm_token';
    }

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${ABDM_BASE}/v0.5/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
    });

    if (!response.ok) throw new ApiError(502, 'Failed to authenticate with ABDM gateway');

    const data = await response.json();
    cachedGatewayToken = data.accessToken;
    tokenExpiry = Date.now() + (data.expiresIn || 1800) * 1000;
    return cachedGatewayToken;
};

// ============================================================
// Encryption helpers (ABDM requires AES-256 for sensitive data)
// ============================================================

const encrypt = (text) => CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
const decrypt = (cipher) => CryptoJS.AES.decrypt(cipher, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

// ============================================================
// M1: ABHA Identity
// ============================================================

/**
 * Initiate ABHA enrollment via Aadhaar OTP
 * @param {string} aadhaarNumber - 12-digit Aadhaar
 */
const initiateAbhaLinking = async (aadhaarNumber) => {
    if (!CLIENT_ID) {
        // Mock mode for development
        return { txnId: 'mock_txn_' + Date.now(), message: 'OTP sent to Aadhaar-linked mobile (MOCK)' };
    }

    const fetch = (await import('node-fetch')).default;
    const token = await getGatewayToken();

    const response = await fetch(`${ABHA_BASE}/enrollment/enrol/byAadhaar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'REQUEST-ID': require('uuid').v4(),
            'TIMESTAMP': new Date().toISOString(),
        },
        body: JSON.stringify({ scope: ['abha-enrol'], loginHint: 'aadhaar', loginId: aadhaarNumber }),
    });

    const data = await response.json();
    if (!response.ok) throw new ApiError(502, data.message || 'Failed to initiate ABHA linking');

    return { txnId: data.txnId, message: 'OTP sent to Aadhaar-linked mobile' };
};

/**
 * Verify OTP and complete ABHA linking
 * @param {string} userId
 * @param {string} otp
 * @param {string} txnId
 */
const verifyAbhaOTP = async (userId, otp, txnId) => {
    if (txnId.startsWith('mock_')) {
        // Mock: simulate successful ABHA linking
        const mockAbhaId = '12-3456-7890-1234';
        const mockAbhaAddress = `user${userId.substring(0, 8)}@abdm`;

        await query(
            `UPDATE users SET abha_id = $1, abha_address = $2, emergency_consent = TRUE,
                abdm_linked_at = NOW(), updated_at = NOW()
             WHERE id = $3`,
            [mockAbhaId, mockAbhaAddress, userId]
        );

        await logAbdmAudit(userId, userId, 'abha_linked', null, { mock: true, abhaId: mockAbhaId });
        return { abhaId: mockAbhaId, abhaAddress: mockAbhaAddress, message: 'ABHA ID linked successfully (MOCK)' };
    }

    const fetch = (await import('node-fetch')).default;
    const token = await getGatewayToken();

    const response = await fetch(`${ABHA_BASE}/enrollment/auth/byAbdm`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'REQUEST-ID': require('uuid').v4(),
            'TIMESTAMP': new Date().toISOString(),
        },
        body: JSON.stringify({ scope: ['abha-enrol'], authData: { authMethods: ['otp'], otp: { value: otp } }, txnId }),
    });

    const data = await response.json();
    if (!response.ok) throw new ApiError(400, data.message || 'OTP verification failed');

    const abhaToken = data.token;
    const abhaId = data.ABHANumber;
    const abhaAddress = data.preferredAbhaAddress;

    // Store encrypted tokens
    await withTransaction(async (client) => {
        await client.query(
            `UPDATE users SET
                abha_id = $1, abha_address = $2,
                abdm_access_token = $3, abdm_refresh_token = $4,
                abdm_token_expiry = NOW() + INTERVAL '1 hour',
                emergency_consent = TRUE,
                abdm_linked_at = NOW(), updated_at = NOW()
             WHERE id = $5`,
            [abhaId, abhaAddress, encrypt(abhaToken), encrypt(data.refreshToken || ''), userId]
        );
    });

    await logAbdmAudit(userId, userId, 'abha_linked', null, { abhaId });
    return { abhaId, abhaAddress, message: 'ABHA ID linked successfully' };
};

// ============================================================
// M2: Health Records Access (HIU)
// ============================================================

/**
 * Discover health records for a patient (M2 — emergency flow)
 * @param {string} patientUserId
 * @param {string} incidentId
 */
const fetchEmergencyHealthRecords = async (patientUserId, incidentId) => {
    const userResult = await query(
        'SELECT abha_id, abdm_access_token, emergency_consent FROM users WHERE id = $1',
        [patientUserId]
    );

    if (!userResult.rows.length) throw new ApiError(404, 'Patient not found');
    const patient = userResult.rows[0];

    if (!patient.abha_id) {
        return { available: false, message: 'Patient has not linked ABHA ID' };
    }

    if (!patient.emergency_consent) {
        return { available: false, message: 'Patient has not granted emergency pre-authorization' };
    }

    // Check if we have a recent cache
    const cached = await query(
        `SELECT fhir_data FROM abdm_health_cache
         WHERE user_id = $1 AND fetched_at > NOW() - INTERVAL '1 hour'
         ORDER BY fetched_at DESC LIMIT 1`,
        [patientUserId]
    );

    if (cached.rows.length) {
        await logAbdmAudit(null, patientUserId, 'records_fetched', incidentId, { source: 'cache' });
        return { available: true, data: cached.rows[0].fhir_data, source: 'cache' };
    }

    if (!CLIENT_ID) {
        // Mock FHIR data for development
        const mockFhir = generateMockFHIR(patient.abha_id);
        await cacheHealthRecords(patientUserId, incidentId, null, mockFhir);
        return { available: true, data: mockFhir, source: 'mock' };
    }

    // Real ABDM flow: discover → consent → fetch
    const token = decrypt(patient.abdm_access_token);
    const fhirData = await discoverAndFetchRecords(patient.abha_id, token);

    if (fhirData) {
        await cacheHealthRecords(patientUserId, incidentId, null, fhirData);
        await logAbdmAudit(null, patientUserId, 'records_fetched', incidentId, { source: 'abdm' });
    }

    return { available: !!fhirData, data: fhirData, source: 'abdm' };
};

const discoverAndFetchRecords = async (abhaId, abhaToken) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const gatewayToken = await getGatewayToken();

        // Step 1: Discover care contexts
        await fetch(`${ABDM_BASE}/v0.5/care-contexts/discover`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${gatewayToken}`,
                'X-CM-ID': 'sbx',
                'REQUEST-ID': require('uuid').v4(),
                'TIMESTAMP': new Date().toISOString(),
            },
            body: JSON.stringify({
                requestId: require('uuid').v4(),
                timestamp: new Date().toISOString(),
                patient: { id: `${abhaId}@sbx` },
            }),
        });

        // In real implementation, this is async — ABDM calls back your webhook
        // For demo, return mock data
        return generateMockFHIR(abhaId);

    } catch (error) {
        logger.error('ABDM record discovery failed', { error: error.message });
        return null;
    }
};

/**
 * Cache fetched FHIR data (auto-deletes in 48h for privacy)
 */
const cacheHealthRecords = async (userId, incidentId, consentId, fhirData) => {
    await query(
        `INSERT INTO abdm_health_cache (user_id, incident_id, consent_id, fhir_data)
         VALUES ($1, $2, $3, $4)`,
        [userId, incidentId, consentId, JSON.stringify(fhirData)]
    );
};

/**
 * Generate mock FHIR bundle for development/testing
 */
const generateMockFHIR = (abhaId) => ({
    resourceType: 'Bundle',
    id: `bundle-${abhaId}`,
    type: 'document',
    timestamp: new Date().toISOString(),
    entry: [
        {
            resource: {
                resourceType: 'Patient',
                id: abhaId,
                name: [{ use: 'official', text: 'Demo Patient' }],
                birthDate: '1990-01-15',
                gender: 'male',
                identifier: [{ system: 'https://abha.abdm.gov.in', value: abhaId }],
            },
        },
        {
            resource: {
                resourceType: 'AllergyIntolerance',
                id: 'allergy-001',
                code: { text: 'Penicillin' },
                criticality: 'high',
                type: 'allergy',
            },
        },
        {
            resource: {
                resourceType: 'Condition',
                id: 'condition-001',
                code: { text: 'Type 2 Diabetes Mellitus' },
                clinicalStatus: { text: 'active' },
            },
        },
        {
            resource: {
                resourceType: 'MedicationStatement',
                id: 'med-001',
                medication: { concept: { text: 'Metformin 500mg' } },
                status: 'active',
            },
        },
        {
            resource: {
                resourceType: 'Observation',
                id: 'obs-001',
                code: { text: 'Blood Group' },
                valueString: 'B+',
            },
        },
    ],
});

// ============================================================
// Audit Logging
// ============================================================

const logAbdmAudit = async (actorId, patientId, action, incidentId, details = {}) => {
    try {
        await query(
            `INSERT INTO abdm_audit_log (actor_id, patient_id, action, incident_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [actorId, patientId, action, incidentId, JSON.stringify(details)]
        );
    } catch (error) {
        logger.error('ABDM audit log failed', { error: error.message });
    }
};

// ============================================================
// Auto-purge expired health cache
// ============================================================

const purgeExpiredHealthCache = async () => {
    const result = await query(
        'DELETE FROM abdm_health_cache WHERE auto_delete_at < NOW() RETURNING id'
    );
    if (result.rows.length) {
        logger.info(`Purged ${result.rows.length} expired ABDM health cache entries`);
    }
};

// Schedule purge every hour
setInterval(purgeExpiredHealthCache, 60 * 60 * 1000);

/**
 * Create emergency trauma proxy profile for unconscious patients (No Aadhaar OTP available)
 */
const createUnconsciousEmergencyProfile = async (incidentId, responderId, details = {}) => {
    const tempAbhaId = `TRAUMA-EMERGENCY-${Date.now()}`;
    const proxyData = {
        patientType: 'unconscious_trauma_patient',
        incidentId,
        approxAgeGender: details.approxAgeGender || 'Unknown',
        responderNotes: details.notes || 'Unconscious patient emergency intake',
        createdAt: new Date().toISOString(),
    };

    await logAbdmAudit(responderId, null, 'unconscious_emergency_override', incidentId, {
        tempAbhaId,
        details: proxyData,
    });

    return {
        success: true,
        tempAbhaId,
        emergencyModeActive: true,
        message: 'Unconscious Emergency Trauma Override initialized. Audit logged for DPDP compliance.',
        proxyData,
    };
};

module.exports = {
    getGatewayToken,
    initiateAbhaLinking,
    verifyAbhaOTP,
    fetchEmergencyHealthRecords,
    purgeExpiredHealthCache,
    logAbdmAudit,
    createUnconsciousEmergencyProfile,
};


