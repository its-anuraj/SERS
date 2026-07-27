-- ============================================================
-- SERS — PostgreSQL + PostGIS Schema
-- Smart Emergency Response System
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'citizen',
    'responder',
    'hospital_staff',
    'admin',
    'coordinator'
);

CREATE TYPE incident_type AS ENUM (
    'accident',
    'medical',
    'fire',
    'cardiac',
    'drowning',
    'fall',
    'assault',
    'other'
);

CREATE TYPE incident_status AS ENUM (
    'reported',
    'assigned',
    'en_route',
    'arrived',
    'transporting',
    'resolved',
    'cancelled',
    'false_alarm'
);

CREATE TYPE incident_severity AS ENUM (
    'minor',
    'moderate',
    'critical',
    'unknown'
);

CREATE TYPE ambulance_status AS ENUM (
    'available',
    'en_route',
    'on_scene',
    'transporting',
    'at_hospital',
    'maintenance',
    'offline'
);

CREATE TYPE ambulance_type AS ENUM (
    'als',
    'bls',
    'patient_transport',
    'mobile_icu',
    'bike'
);

CREATE TYPE consent_status AS ENUM (
    'requested',
    'granted',
    'denied',
    'expired',
    'revoked'
);

CREATE TYPE consent_purpose AS ENUM (
    'emergency',
    'care_management',
    'research',
    'self_requested'
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                 VARCHAR(150) NOT NULL,
    phone                VARCHAR(20) UNIQUE NOT NULL,
    email                VARCHAR(255) UNIQUE,
    password_hash        TEXT NOT NULL,
    role                 user_role NOT NULL DEFAULT 'citizen',
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified          BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified_at    TIMESTAMP,
    profile_picture_url  TEXT,
    preferred_language   VARCHAR(10) DEFAULT 'en',

    -- ABDM / ABHA fields
    abha_id              VARCHAR(20) UNIQUE,          -- 14-digit ABHA number
    abha_address         VARCHAR(100),                -- user@abdm format
    abdm_access_token    TEXT,                        -- AES-256 encrypted
    abdm_refresh_token   TEXT,                        -- AES-256 encrypted
    abdm_token_expiry    TIMESTAMP,
    emergency_consent    BOOLEAN DEFAULT FALSE,       -- Pre-authorized emergency access
    abdm_linked_at       TIMESTAMP,

    -- Metadata
    fcm_token            TEXT,                        -- Firebase push notification token
    last_known_lat       DOUBLE PRECISION,
    last_known_lng       DOUBLE PRECISION,
    last_location_update TIMESTAMP,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMP                   -- Soft delete
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_abha_id ON users(abha_id) WHERE abha_id IS NOT NULL;
CREATE INDEX idx_users_location ON users USING GIST (
    ST_SetSRID(ST_MakePoint(last_known_lng, last_known_lat), 4326)
) WHERE last_known_lat IS NOT NULL;

-- ============================================================
-- MEDICAL PROFILES
-- ============================================================

CREATE TABLE medical_profiles (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    blood_group          VARCHAR(5),                  -- A+, B-, O+, AB+, etc.
    allergies            TEXT[] DEFAULT '{}',
    medications          TEXT[] DEFAULT '{}',
    conditions           TEXT[] DEFAULT '{}',         -- Diabetes, Hypertension, etc.
    disabilities         TEXT[] DEFAULT '{}',

    -- Emergency contacts (stored as JSONB for flexibility)
    emergency_contacts   JSONB DEFAULT '[]',
    -- Format: [{"name": "Wife", "phone": "+91...", "relation": "spouse"}]

    -- ABDM-sourced data
    abdm_synced          BOOLEAN DEFAULT FALSE,
    abdm_last_sync       TIMESTAMP,
    fhir_patient_id      VARCHAR(100),
    linked_facilities    JSONB DEFAULT '[]',

    -- Organ donation
    is_organ_donor       BOOLEAN DEFAULT FALSE,

    -- Notes for emergency responders
    responder_notes      TEXT,

    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_medical_profiles_user ON medical_profiles(user_id);

-- ============================================================
-- HOSPITALS
-- ============================================================

CREATE TABLE hospitals (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                 VARCHAR(255) NOT NULL,
    type                 VARCHAR(50) DEFAULT 'general',  -- general, trauma, cardiac, etc.
    address              TEXT NOT NULL,
    city                 VARCHAR(100),
    state                VARCHAR(100),
    pincode              VARCHAR(10),

    -- Geolocation
    latitude             DOUBLE PRECISION NOT NULL,
    longitude            DOUBLE PRECISION NOT NULL,
    location             GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (
                             ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                         ) STORED,

    phone                VARCHAR(20),
    emergency_phone      VARCHAR(20),
    email                VARCHAR(255),
    website              VARCHAR(255),

    -- Capabilities
    specialties          TEXT[] DEFAULT '{}',
    has_icu              BOOLEAN DEFAULT FALSE,
    has_trauma_center    BOOLEAN DEFAULT FALSE,
    has_blood_bank       BOOLEAN DEFAULT FALSE,
    has_burn_unit        BOOLEAN DEFAULT FALSE,
    has_nicu             BOOLEAN DEFAULT FALSE,

    -- Real-time capacity (updated frequently)
    icu_beds_total       INTEGER DEFAULT 0,
    icu_beds_available   INTEGER DEFAULT 0,
    er_beds_total        INTEGER DEFAULT 0,
    er_beds_available    INTEGER DEFAULT 0,
    general_beds_total   INTEGER DEFAULT 0,
    general_beds_available INTEGER DEFAULT 0,
    capacity_updated_at  TIMESTAMP,

    -- Blood bank inventory
    blood_inventory      JSONB DEFAULT '{"A+":0,"A-":0,"B+":0,"B-":0,"O+":0,"O-":0,"AB+":0,"AB-":0}',

    -- ABDM
    is_abdm_registered   BOOLEAN DEFAULT FALSE,
    abdm_hip_id          VARCHAR(100),

    -- Network status
    is_on_sers_network   BOOLEAN DEFAULT FALSE,
    is_active            BOOLEAN DEFAULT TRUE,

    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hospitals_location ON hospitals USING GIST(location);
CREATE INDEX idx_hospitals_city ON hospitals(city);
CREATE INDEX idx_hospitals_active ON hospitals(is_active, is_on_sers_network);

-- ============================================================
-- AMBULANCES
-- ============================================================

CREATE TABLE ambulances (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_number  VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type         ambulance_type NOT NULL DEFAULT 'bls',

    -- Assignment
    hospital_id          UUID REFERENCES hospitals(id),
    driver_id            UUID REFERENCES users(id),
    paramedic_id         UUID REFERENCES users(id),

    -- Live location (updated every 5-10s during active duty)
    current_lat          DOUBLE PRECISION,
    current_lng          DOUBLE PRECISION,
    current_location     GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (
                             ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)
                         ) STORED,
    location_updated_at  TIMESTAMP,
    heading              DOUBLE PRECISION,           -- degrees, 0=North
    speed_kmh            DOUBLE PRECISION,

    -- Status
    status               ambulance_status DEFAULT 'available',

    -- Vehicle details
    make_model           VARCHAR(100),
    year                 INTEGER,
    fuel_level_pct       INTEGER,                    -- 0-100
    equipment_list       TEXT[] DEFAULT '{}',

    -- Maintenance
    last_maintenance_at  TIMESTAMP,
    next_maintenance_at  TIMESTAMP,

    is_active            BOOLEAN DEFAULT TRUE,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ambulances_location ON ambulances USING GIST(current_location)
    WHERE current_lat IS NOT NULL;
CREATE INDEX idx_ambulances_status ON ambulances(status);
CREATE INDEX idx_ambulances_hospital ON ambulances(hospital_id);

-- ============================================================
-- INCIDENTS (Core table)
-- ============================================================

CREATE TABLE incidents (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_number      VARCHAR(20) UNIQUE NOT NULL,  -- SERS-2024-0001 format

    -- Type & Classification
    type                 incident_type NOT NULL DEFAULT 'other',
    severity             incident_severity DEFAULT 'unknown',
    status               incident_status NOT NULL DEFAULT 'reported',

    -- Location
    latitude             DOUBLE PRECISION NOT NULL,
    longitude            DOUBLE PRECISION NOT NULL,
    location             GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (
                             ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                         ) STORED,
    address              TEXT,
    landmark             VARCHAR(255),

    -- Reporter
    reporter_id          UUID REFERENCES users(id),
    is_anonymous         BOOLEAN DEFAULT FALSE,

    -- Assignment
    assigned_ambulance_id UUID REFERENCES ambulances(id),
    assigned_responder_id UUID REFERENCES users(id),
    assigned_hospital_id  UUID REFERENCES hospitals(id),

    -- AI Detection
    ai_crash_detected    BOOLEAN DEFAULT FALSE,
    ai_severity_score    DECIMAL(4,2),               -- 0.00 - 10.00
    ai_confidence        DECIMAL(5,4),               -- 0.0000 - 1.0000

    -- ETA tracking
    responder_eta_mins   INTEGER,
    responder_arrived_at TIMESTAMP,
    patient_delivered_at TIMESTAMP,

    -- Media
    scene_photo_urls     TEXT[] DEFAULT '{}',
    audio_recording_url  TEXT,

    -- Description
    description          TEXT,
    responder_notes      TEXT,
    resolution_notes     TEXT,

    -- Timestamps
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at          TIMESTAMP
);

-- Sequence for incident_number
CREATE SEQUENCE incident_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_incident_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.incident_number := 'SERS-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                           LPAD(nextval('incident_number_seq')::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_incident_number
    BEFORE INSERT ON incidents
    FOR EACH ROW
    WHEN (NEW.incident_number IS NULL OR NEW.incident_number = '')
    EXECUTE FUNCTION generate_incident_number();

CREATE INDEX idx_incidents_location ON incidents USING GIST(location);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_reporter ON incidents(reporter_id);
CREATE INDEX idx_incidents_responder ON incidents(assigned_responder_id);
CREATE INDEX idx_incidents_hospital ON incidents(assigned_hospital_id);
CREATE INDEX idx_incidents_created ON incidents(created_at DESC);

-- ============================================================
-- INCIDENT EVENTS (Audit trail)
-- ============================================================

CREATE TABLE incident_events (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id          UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    event_type           VARCHAR(50) NOT NULL,
    -- Event types: 'created', 'assigned', 'en_route', 'arrived', 'status_change',
    --              'note_added', 'hospital_changed', 'photo_added', etc.
    actor_id             UUID REFERENCES users(id),
    actor_role           user_role,
    description          TEXT,
    metadata             JSONB DEFAULT '{}',
    timestamp            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incident_events_incident ON incident_events(incident_id, timestamp DESC);

-- ============================================================
-- RESPONDER LOCATION HISTORY (for replay + analytics)
-- ============================================================

CREATE TABLE responder_locations (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES users(id),
    incident_id          UUID REFERENCES incidents(id),
    latitude             DOUBLE PRECISION NOT NULL,
    longitude            DOUBLE PRECISION NOT NULL,
    location             GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (
                             ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                         ) STORED,
    speed_kmh            DOUBLE PRECISION,
    recorded_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_responder_locations_user ON responder_locations(user_id, recorded_at DESC);
CREATE INDEX idx_responder_locations_incident ON responder_locations(incident_id);

-- ============================================================
-- HOTSPOT PREDICTIONS
-- ============================================================

CREATE TABLE hotspot_predictions (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitude             DOUBLE PRECISION NOT NULL,
    longitude            DOUBLE PRECISION NOT NULL,
    location             GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (
                             ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                         ) STORED,
    radius_meters        INTEGER DEFAULT 500,
    risk_score           DECIMAL(5,4) NOT NULL,      -- 0.0000 - 1.0000
    risk_label           VARCHAR(20),                -- low, medium, high, critical
    predicted_for_date   DATE NOT NULL,
    predicted_for_hour   INTEGER,                    -- 0-23, NULL = all day
    features_used        JSONB DEFAULT '{}',
    model_version        VARCHAR(20),
    generated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hotspots_location ON hotspot_predictions USING GIST(location);
CREATE INDEX idx_hotspots_date ON hotspot_predictions(predicted_for_date);

-- ============================================================
-- ABDM CONSENTS
-- ============================================================

CREATE TABLE abdm_consents (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_request_id   VARCHAR(100) UNIQUE,        -- ABDM generated ID
    artefact_id          VARCHAR(100),               -- Consent artefact ID
    purpose              consent_purpose NOT NULL DEFAULT 'emergency',
    status               consent_status NOT NULL DEFAULT 'requested',
    hip_id               VARCHAR(100),               -- Source hospital/provider
    hiu_id               VARCHAR(100),               -- SERS HIU ID
    requested_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    granted_at           TIMESTAMP,
    expires_at           TIMESTAMP,
    data_erased_at       TIMESTAMP                   -- GDPR/privacy compliance
);

CREATE INDEX idx_abdm_consents_user ON abdm_consents(user_id);
CREATE INDEX idx_abdm_consents_status ON abdm_consents(status);

-- ============================================================
-- ABDM HEALTH CACHE (temporary — auto-purge after 48h)
-- ============================================================

CREATE TABLE abdm_health_cache (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    incident_id          UUID REFERENCES incidents(id),
    consent_id           UUID REFERENCES abdm_consents(id),
    fhir_data            JSONB NOT NULL,             -- Fetched FHIR records
    fetched_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    auto_delete_at       TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '48 hours')
);

CREATE INDEX idx_health_cache_user ON abdm_health_cache(user_id);
CREATE INDEX idx_health_cache_incident ON abdm_health_cache(incident_id);
CREATE INDEX idx_health_cache_auto_delete ON abdm_health_cache(auto_delete_at);

-- ============================================================
-- ABDM AUDIT LOG (every access must be logged)
-- ============================================================

CREATE TABLE abdm_audit_log (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id             UUID REFERENCES users(id),
    patient_id           UUID REFERENCES users(id),
    action               VARCHAR(50) NOT NULL,
    -- Actions: 'abha_linked', 'records_fetched', 'consent_requested',
    --          'consent_granted', 'data_purged', 'token_refreshed'
    incident_id          UUID REFERENCES incidents(id),
    ip_address           INET,
    user_agent           TEXT,
    details              JSONB DEFAULT '{}',
    timestamp            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_abdm_audit_patient ON abdm_audit_log(patient_id, timestamp DESC);
CREATE INDEX idx_abdm_audit_actor ON abdm_audit_log(actor_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                VARCHAR(255) NOT NULL,
    body                 TEXT NOT NULL,
    type                 VARCHAR(50) NOT NULL,
    -- Types: 'sos_alert', 'incident_update', 'ambulance_assigned',
    --        'hospital_assigned', 'family_alert', 'area_alert'
    reference_id         UUID,                       -- incident_id or other
    is_read              BOOLEAN DEFAULT FALSE,
    sent_via_fcm         BOOLEAN DEFAULT FALSE,
    sent_via_sms         BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- SYSTEM HEALTH / TELEMETRY
-- ============================================================

CREATE TABLE system_metrics (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name          VARCHAR(100) NOT NULL,
    metric_value         DECIMAL(15,4),
    labels               JSONB DEFAULT '{}',
    recorded_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metrics_name_time ON system_metrics(metric_name, recorded_at DESC);

-- ============================================================
-- TRIGGERS — updated_at auto-update
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER medical_profiles_updated_at BEFORE UPDATE ON medical_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER hospitals_updated_at BEFORE UPDATE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ambulances_updated_at BEFORE UPDATE ON ambulances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VIEWS — commonly needed queries
-- ============================================================

-- Active incidents with responder + hospital info
CREATE VIEW v_active_incidents AS
SELECT
    i.*,
    u.name AS reporter_name,
    u.phone AS reporter_phone,
    r.name AS responder_name,
    h.name AS hospital_name,
    h.emergency_phone AS hospital_emergency_phone,
    a.registration_number AS ambulance_reg,
    a.current_lat AS ambulance_lat,
    a.current_lng AS ambulance_lng
FROM incidents i
LEFT JOIN users u ON i.reporter_id = u.id
LEFT JOIN users r ON i.assigned_responder_id = r.id
LEFT JOIN hospitals h ON i.assigned_hospital_id = h.id
LEFT JOIN ambulances a ON i.assigned_ambulance_id = a.id
WHERE i.status NOT IN ('resolved', 'cancelled', 'false_alarm');

-- Available ambulances with distance calculation helper
CREATE VIEW v_available_ambulances AS
SELECT
    a.*,
    u.name AS driver_name,
    u.phone AS driver_phone,
    h.name AS hospital_name
FROM ambulances a
LEFT JOIN users u ON a.driver_id = u.id
LEFT JOIN hospitals h ON a.hospital_id = h.id
WHERE a.status = 'available' AND a.is_active = TRUE;

-- Hospital summary with capacity
CREATE VIEW v_hospital_summary AS
SELECT
    h.id,
    h.name,
    h.latitude,
    h.longitude,
    h.emergency_phone,
    h.icu_beds_available,
    h.er_beds_available,
    h.is_abdm_registered,
    h.specialties,
    (SELECT COUNT(*) FROM ambulances am WHERE am.hospital_id = h.id AND am.status = 'available') AS available_ambulances
FROM hospitals h
WHERE h.is_active = TRUE;
