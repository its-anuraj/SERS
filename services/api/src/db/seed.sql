-- ============================================================
-- SERS — Seed Data (Authentication Credentials & Roles Only)
-- All mock incidents, hospitals, ambulances & hotspots removed.
-- Real data is dynamically populated during live operations.
-- ============================================================

-- ============================================================
-- USERS (Test accounts for each role)
-- Password for all test accounts: Test@1234
-- Hash: bcrypt of "Test@1234" with 12 rounds
-- ============================================================

DO $$
DECLARE
    citizen_hash TEXT := '$2b$12$2YmMgcPQ7fGcP9CZrlgb3esLesOBbyHZeXDnePjIHpXu3393BD0Uy';
BEGIN

INSERT INTO users (id, name, phone, email, password_hash, role, is_active, is_verified, phone_verified_at, preferred_language)
VALUES
-- Citizen
(
    'b0000000-0000-0000-0000-000000000001',
    'Arjun Kumar',
    '+919876500001',
    'arjun@demo.sers.in',
    citizen_hash,
    'citizen',
    TRUE, TRUE, NOW(), 'en'
),
-- Citizen 2
(
    'b0000000-0000-0000-0000-000000000002',
    'Priya Sharma',
    '+919876500002',
    'priya@demo.sers.in',
    citizen_hash,
    'citizen',
    TRUE, TRUE, NOW(), 'hi'
),
-- Responder / Ambulance Driver
(
    'b0000000-0000-0000-0000-000000000003',
    'Ravi Paramedic',
    '+919876500003',
    'ravi@demo.sers.in',
    citizen_hash,
    'responder',
    TRUE, TRUE, NOW(), 'en'
),
-- Responder 2
(
    'b0000000-0000-0000-0000-000000000004',
    'Suresh Driver',
    '+919876500004',
    'suresh@demo.sers.in',
    citizen_hash,
    'responder',
    TRUE, TRUE, NOW(), 'kn'
),
-- Hospital Staff
(
    'b0000000-0000-0000-0000-000000000005',
    'Dr. Meera Nair',
    '+919876500005',
    'drmeera@demo.sers.in',
    citizen_hash,
    'hospital_staff',
    TRUE, TRUE, NOW(), 'en'
),
-- Admin
(
    'b0000000-0000-0000-0000-000000000006',
    'Admin SERS',
    '+919876500006',
    'admin@sers.in',
    citizen_hash,
    'admin',
    TRUE, TRUE, NOW(), 'en'
),
-- Coordinator
(
    'b0000000-0000-0000-0000-000000000007',
    'Coordinator Bengaluru',
    '+919876500007',
    'coord@sers.in',
    citizen_hash,
    'coordinator',
    TRUE, TRUE, NOW(), 'en'
)
ON CONFLICT (phone) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    is_verified = EXCLUDED.is_verified;

END $$;

-- ============================================================
-- MEDICAL PROFILES (Linked to test accounts)
-- ============================================================

INSERT INTO medical_profiles (user_id, blood_group, allergies, medications, conditions, emergency_contacts, is_organ_donor)
VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    'B+',
    ARRAY['Penicillin', 'Sulfa drugs'],
    ARRAY['Metformin 500mg', 'Amlodipine 5mg'],
    ARRAY['Type 2 Diabetes', 'Hypertension'],
    '[{"name": "Sunita Kumar", "phone": "+919876500099", "relation": "spouse"}, {"name": "Rajesh Kumar", "phone": "+919876500098", "relation": "brother"}]'::JSONB,
    FALSE
),
(
    'b0000000-0000-0000-0000-000000000002',
    'O+',
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    '[{"name": "Ramesh Sharma", "phone": "+919876500097", "relation": "father"}]'::JSONB,
    TRUE
)
ON CONFLICT (user_id) DO NOTHING;
