-- ============================================================
-- SERS — Seed Data (Demo / Development)
-- Bengaluru-based demo data
-- ============================================================

-- ============================================================
-- HOSPITALS (5 real Bengaluru hospitals, fictionalized for demo)
-- ============================================================

INSERT INTO hospitals (
    id, name, type, address, city, state, pincode,
    latitude, longitude,
    phone, emergency_phone, email,
    specialties, has_icu, has_trauma_center, has_blood_bank,
    icu_beds_total, icu_beds_available, er_beds_total, er_beds_available,
    general_beds_total, general_beds_available,
    blood_inventory, is_abdm_registered, is_on_sers_network, is_active
) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'Apollo Hospitals Bannerghatta',
    'multi-specialty',
    '154/11, Bannerghatta Road, Bengaluru, Karnataka 560076',
    'Bengaluru', 'Karnataka', '560076',
    12.8814, 77.5977,
    '+918040206789', '+918040206700', 'emergency@apollobengaluru.com',
    ARRAY['cardiology', 'neurology', 'trauma', 'orthopedics', 'oncology'],
    TRUE, TRUE, TRUE,
    50, 12, 30, 8, 500, 120,
    '{"A+":15,"A-":5,"B+":20,"B-":3,"O+":25,"O-":8,"AB+":6,"AB-":2}',
    TRUE, TRUE, TRUE
),
(
    'a0000000-0000-0000-0000-000000000002',
    'Manipal Hospital Old Airport Road',
    'multi-specialty',
    '98, HAL Airport Road, Bengaluru, Karnataka 560017',
    'Bengaluru', 'Karnataka', '560017',
    12.9567, 77.6484,
    '+918025023456', '+918025023400', 'emergency@manipalhospital.org',
    ARRAY['cardiac', 'neuro', 'orthopedics', 'trauma', 'pediatrics'],
    TRUE, TRUE, TRUE,
    40, 8, 25, 6, 400, 95,
    '{"A+":10,"A-":3,"B+":18,"B-":2,"O+":22,"O-":5,"AB+":4,"AB-":1}',
    TRUE, TRUE, TRUE
),
(
    'a0000000-0000-0000-0000-000000000003',
    'Fortis Hospital Cunningham Road',
    'multi-specialty',
    '14, Cunningham Road, Bengaluru, Karnataka 560052',
    'Bengaluru', 'Karnataka', '560052',
    12.9890, 77.5978,
    '+918066214444', '+918066214400', 'emergency@fortiscunningham.com',
    ARRAY['cardiac', 'orthopedics', 'spine', 'general surgery'],
    TRUE, FALSE, TRUE,
    35, 15, 20, 10, 300, 80,
    '{"A+":12,"A-":4,"B+":15,"B-":2,"O+":18,"O-":6,"AB+":5,"AB-":2}',
    FALSE, TRUE, TRUE
),
(
    'a0000000-0000-0000-0000-000000000004',
    'NIMHANS (Government — Trauma)',
    'government',
    'Hosur Road, Lakkasandra, Bengaluru, Karnataka 560029',
    'Bengaluru', 'Karnataka', '560029',
    12.9396, 77.5966,
    '+918046110007', '+918046110000', 'emergency@nimhans.ac.in',
    ARRAY['neurology', 'psychiatry', 'neurosurgery', 'trauma'],
    TRUE, TRUE, TRUE,
    80, 30, 40, 15, 800, 200,
    '{"A+":20,"A-":8,"B+":25,"B-":5,"O+":30,"O-":10,"AB+":8,"AB-":3}',
    TRUE, TRUE, TRUE
),
(
    'a0000000-0000-0000-0000-000000000005',
    'Victoria Government Hospital',
    'government',
    'Ft. Victoria, Bengaluru, Karnataka 560002',
    'Bengaluru', 'Karnataka', '560002',
    12.9763, 77.5826,
    '+918022866761', '+918022866700', 'emergency@victoriahosp.gov.in',
    ARRAY['general medicine', 'surgery', 'obstetrics', 'pediatrics'],
    TRUE, TRUE, TRUE,
    120, 45, 60, 20, 1200, 350,
    '{"A+":30,"A-":10,"B+":35,"B-":8,"O+":40,"O-":12,"AB+":10,"AB-":4}',
    FALSE, TRUE, TRUE
);

-- ============================================================
-- USERS (Test accounts for each role)
-- ============================================================

-- Password for all test accounts: Test@1234
-- Hash: bcrypt of "Test@1234" with 12 rounds
-- Pre-computed hash for demo purposes
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
);

END $$;

-- ============================================================
-- MEDICAL PROFILES
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
);

-- ============================================================
-- AMBULANCES (10 ambulances across hospitals)
-- ============================================================

INSERT INTO ambulances (
    id, registration_number, vehicle_type,
    hospital_id, driver_id, paramedic_id,
    current_lat, current_lng,
    status, make_model, year, fuel_level_pct, equipment_list, is_active
)
VALUES
(
    'c0000000-0000-0000-0000-000000000001',
    'KA01AB1234',
    'als',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000003',
    NULL,
    12.8814, 77.5977,
    'available', 'Force Traveller ALS', 2022, 85,
    ARRAY['Defibrillator', 'Oxygen', 'IV Kit', 'Stretcher', 'Cardiac Monitor'],
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000002',
    'KA01AB5678',
    'bls',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000004',
    NULL,
    12.9123, 77.5823,
    'available', 'Tata Winger BLS', 2021, 72,
    ARRAY['First Aid Kit', 'Oxygen', 'Stretcher', 'AED'],
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000003',
    'KA02CD9012',
    'als',
    'a0000000-0000-0000-0000-000000000002',
    NULL, NULL,
    12.9567, 77.6484,
    'available', 'Force Traveller ALS', 2023, 95,
    ARRAY['Defibrillator', 'Oxygen', 'IV Kit', 'Stretcher', 'Ventilator'],
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000004',
    'KA02CD3456',
    'bls',
    'a0000000-0000-0000-0000-000000000002',
    NULL, NULL,
    12.9700, 77.6200,
    'available', 'Tata Winger BLS', 2020, 60,
    ARRAY['First Aid Kit', 'Oxygen', 'Stretcher'],
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000005',
    'KA03EF7890',
    'mobile_icu',
    'a0000000-0000-0000-0000-000000000004',
    NULL, NULL,
    12.9396, 77.5966,
    'available', 'Mercedes Sprinter MICU', 2023, 90,
    ARRAY['ICU Equipment', 'Ventilator', 'Defibrillator', 'Blood Pressure Monitor', 'Infusion Pump'],
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000006',
    'KA03EF1234',
    'bls',
    'a0000000-0000-0000-0000-000000000004',
    NULL, NULL,
    12.9500, 77.5800,
    'available', 'Force Traveller BLS', 2022, 80,
    ARRAY['First Aid Kit', 'Oxygen', 'Stretcher', 'AED'],
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000007',
    'KA04GH5678',
    'als',
    'a0000000-0000-0000-0000-000000000005',
    NULL, NULL,
    12.9763, 77.5826,
    'available', 'Force Traveller ALS', 2021, 75,
    ARRAY['Defibrillator', 'Oxygen', 'IV Kit', 'Stretcher'],
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000008',
    'KA04GH9012',
    'bike',
    'a0000000-0000-0000-0000-000000000005',
    NULL, NULL,
    12.9800, 77.5750,
    'available', 'Hero Splendor First Responder', 2023, 95,
    ARRAY['First Aid Kit', 'AED', 'Oxygen Mask'],
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000009',
    'KA05IJ3456',
    'bls',
    'a0000000-0000-0000-0000-000000000003',
    NULL, NULL,
    12.9890, 77.5978,
    'available', 'Tata Winger BLS', 2022, 88,
    ARRAY['First Aid Kit', 'Oxygen', 'Stretcher', 'AED'],
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000010',
    'KA05IJ7890',
    'als',
    'a0000000-0000-0000-0000-000000000003',
    NULL, NULL,
    12.9750, 77.6050,
    'maintenance', 'Force Traveller ALS', 2020, 45,
    ARRAY['Defibrillator', 'Oxygen', 'IV Kit', 'Stretcher'],
    TRUE
);

-- ============================================================
-- SAMPLE INCIDENTS (for dashboard demo)
-- ============================================================

INSERT INTO incidents (
    id, incident_number, type, severity, status,
    latitude, longitude, address, landmark,
    reporter_id, assigned_ambulance_id, assigned_responder_id, assigned_hospital_id,
    ai_crash_detected, ai_severity_score, description,
    created_at, resolved_at
)
VALUES
(
    'd0000000-0000-0000-0000-000000000001',
    'SERS-2024-000001',
    'accident', 'moderate', 'resolved',
    12.9716, 77.5946,
    'MG Road, Bengaluru', 'Near Trinity Metro Station',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    TRUE, 6.5,
    'Two-vehicle collision. One person injured.',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '30 minutes'
),
(
    'd0000000-0000-0000-0000-000000000002',
    'SERS-2024-000002',
    'cardiac', 'critical', 'resolved',
    12.9352, 77.6245,
    'Koramangala 5th Block, Bengaluru', 'Near Sony Signal',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000005',
    NULL,
    'a0000000-0000-0000-0000-000000000002',
    FALSE, 9.2,
    'Cardiac arrest reported. Patient unresponsive.',
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '2 hours'
),
(
    'd0000000-0000-0000-0000-000000000003',
    'SERS-2026-000003',
    'accident', 'minor', 'reported',
    12.9783, 77.6408,
    'Indiranagar 100ft Road, Bengaluru', 'Near Blossom Book Store',
    'b0000000-0000-0000-0000-000000000001',
    NULL, NULL, NULL,
    FALSE, 3.0,
    'Bike skid. Minor injuries.',
    NOW() - INTERVAL '10 minutes',
    NULL
),
(
    'd0000000-0000-0000-0000-000000000004',
    'SERS-2026-000004',
    'accident', 'critical', 'en_route',
    12.9172, 77.6228,
    'Silk Board Junction, Hosur Road, Bengaluru', 'Near Silk Board Flyover',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    TRUE, 9.8,
    'AUTOMATED AIRBAG CRASH ALERT: 100% Confirmed Real Crash. Airbag pressure pulse (+28 hPa), Impact magnitude 36.2G, Engine Stall (0 RPM). AFDP v2 Confidence: 99% · Smartwatch HR: 158 BPM (CRITICAL_TACHYCARDIA)',
    NOW() - INTERVAL '4 minutes',
    NULL
),
(
    'd0000000-0000-0000-0000-000000000005',
    'SERS-2026-000005',
    'cardiac', 'critical', 'assigned',
    12.9352, 77.6245,
    'Koramangala 4th Block, Bengaluru', 'Near Wipro Park',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000002',
    FALSE, 9.4,
    'AUTOMATED CARDIAC ALERT: Smartwatch detected critical pulse rate of 165 BPM (CRITICAL_TACHYCARDIA). Patient responsive.',
    NOW() - INTERVAL '2 minutes',
    NULL
);

-- ============================================================
-- INCIDENT EVENTS (timeline for demo incidents)
-- ============================================================

INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description, timestamp)
VALUES
(
    'd0000000-0000-0000-0000-000000000001',
    'created', 'b0000000-0000-0000-0000-000000000001', 'citizen',
    'Incident reported via SOS button (AI crash detected)',
    NOW() - INTERVAL '2 hours'
),
(
    'd0000000-0000-0000-0000-000000000001',
    'assigned', NULL, 'coordinator',
    'Ambulance KA01AB1234 assigned. Responder Ravi assigned.',
    NOW() - INTERVAL '1 hour 55 minutes'
),
(
    'd0000000-0000-0000-0000-000000000001',
    'en_route', 'b0000000-0000-0000-0000-000000000003', 'responder',
    'Ambulance en route to scene. ETA: 8 minutes.',
    NOW() - INTERVAL '1 hour 54 minutes'
),
(
    'd0000000-0000-0000-0000-000000000001',
    'arrived', 'b0000000-0000-0000-0000-000000000003', 'responder',
    'Arrived at scene. Assessing victim.',
    NOW() - INTERVAL '1 hour 46 minutes'
),
(
    'd0000000-0000-0000-0000-000000000001',
    'status_change', 'b0000000-0000-0000-0000-000000000003', 'responder',
    'Patient stabilized. Transporting to Apollo Hospitals.',
    NOW() - INTERVAL '1 hour 35 minutes'
),
(
    'd0000000-0000-0000-0000-000000000001',
    'status_change', 'b0000000-0000-0000-0000-000000000005', 'hospital_staff',
    'Patient received at ER. Handoff complete.',
    NOW() - INTERVAL '30 minutes'
);

-- ============================================================
-- HOTSPOT PREDICTIONS (sample for Bengaluru)
-- ============================================================

INSERT INTO hotspot_predictions (
    latitude, longitude, radius_meters, risk_score, risk_label,
    predicted_for_date, predicted_for_hour, model_version
)
VALUES
(12.9716, 77.5946, 500, 0.85, 'high', CURRENT_DATE, 8, 'v1.0'),
(12.9716, 77.5946, 500, 0.90, 'critical', CURRENT_DATE, 17, 'v1.0'),
(12.9567, 77.6484, 500, 0.72, 'high', CURRENT_DATE, 9, 'v1.0'),
(12.8814, 77.5977, 500, 0.65, 'medium', CURRENT_DATE, 10, 'v1.0'),
(12.9783, 77.6408, 400, 0.78, 'high', CURRENT_DATE, 18, 'v1.0'),
(12.9352, 77.6245, 400, 0.60, 'medium', CURRENT_DATE, 12, 'v1.0'),
(12.9011, 77.5889, 600, 0.45, 'medium', CURRENT_DATE + 1, NULL, 'v1.0'),
(12.9890, 77.5978, 300, 0.30, 'low', CURRENT_DATE + 1, NULL, 'v1.0');
