-- Update hotspot dates to today
UPDATE hotspot_predictions SET predicted_for_date = CURRENT_DATE;

-- Insert/update real active incidents
INSERT INTO incidents (
    id, incident_number, type, severity, status,
    latitude, longitude, address, landmark,
    ai_crash_detected, ai_severity_score, description, created_at,
    assigned_ambulance_id, assigned_hospital_id, responder_arrived_at, resolved_at
) VALUES 
(
    'd0000000-0000-0000-0000-000000000004', 'SERS-2026-000104',
    'accident', 'critical', 'en_route',
    12.9172, 77.6228,
    'Silk Board Junction, Hosur Road, Bengaluru', 'Near Silk Board Flyover',
    TRUE, 9.8,
    'AUTOMATED AIRBAG CRASH ALERT: Confirmed Airbag Shockwave (+28 hPa), Impact magnitude 36.2G, Engine Stall (0 RPM). AFDP v2 Confidence: 99%',
    NOW() - INTERVAL '6 minutes',
    'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL, NULL
),
(
    'd0000000-0000-0000-0000-000000000005', 'SERS-2026-000105',
    'cardiac', 'critical', 'assigned',
    12.9352, 77.6245,
    'Koramangala 4th Block, Bengaluru', 'Near Wipro Park',
    FALSE, 9.4,
    'AUTOMATED CARDIAC ALERT: Smartwatch detected critical pulse rate of 165 BPM (CRITICAL_TACHYCARDIA). Emergency bed locked.',
    NOW() - INTERVAL '14 minutes',
    'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', NULL, NULL
),
(
    'd0000000-0000-0000-0000-000000000006', 'SERS-2026-000106',
    'medical', 'moderate', 'reported',
    12.9716, 77.5946,
    'MG Road Metro Station Entrance, Bengaluru', 'Near Trinity Circle',
    FALSE, 5.2,
    'Respiratory distress emergency call. Patient experiencing acute shortness of breath.',
    NOW() - INTERVAL '22 minutes',
    NULL, 'a0000000-0000-0000-0000-000000000003', NULL, NULL
),
(
    'd0000000-0000-0000-0000-000000000007', 'SERS-2026-000107',
    'accident', 'moderate', 'resolved',
    12.9567, 77.6484,
    'HAL Old Airport Road, Bengaluru', 'Near Leela Palace',
    TRUE, 6.8,
    'Two-wheeler collision. Paramedic on scene administered first aid and stabilized patient.',
    NOW() - INTERVAL '2 hours',
    'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002',
    NOW() - INTERVAL '1 hour 53 minutes', NOW() - INTERVAL '1 hour 10 minutes'
),
(
    'd0000000-0000-0000-0000-000000000008', 'SERS-2026-000108',
    'cardiac', 'critical', 'resolved',
    12.8814, 77.5977,
    'Bannerghatta Main Road, Arekere, Bengaluru', 'Opposite Meenakshi Mall',
    FALSE, 8.9,
    'Acute myocardial infarction. ALS ambulance dispatched with AED. Patient admitted to Apollo Trauma ICU.',
    NOW() - INTERVAL '5 hours',
    'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '4 hours 54 minutes', NOW() - INTERVAL '3 hours 40 minutes'
)
ON CONFLICT (id) DO UPDATE SET
    incident_number = EXCLUDED.incident_number,
    type = EXCLUDED.type,
    severity = EXCLUDED.severity,
    status = EXCLUDED.status,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    address = EXCLUDED.address,
    landmark = EXCLUDED.landmark,
    ai_crash_detected = EXCLUDED.ai_crash_detected,
    ai_severity_score = EXCLUDED.ai_severity_score,
    description = EXCLUDED.description,
    created_at = EXCLUDED.created_at,
    assigned_ambulance_id = EXCLUDED.assigned_ambulance_id,
    assigned_hospital_id = EXCLUDED.assigned_hospital_id,
    responder_arrived_at = EXCLUDED.responder_arrived_at,
    resolved_at = EXCLUDED.resolved_at;

UPDATE ambulances SET status = 'en_route', current_lat = 12.9150, current_lng = 77.6200 WHERE id = 'c0000000-0000-0000-0000-000000000001';
UPDATE ambulances SET status = 'en_route', current_lat = 12.9300, current_lng = 77.6210 WHERE id = 'c0000000-0000-0000-0000-000000000002';
