const http = require('http');

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, token) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port: 3000, path, headers: {} };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    http.get(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    }).on('error', reject);
  });
}

function patchJson(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: 'localhost', port: 3000, path, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Authorization': token ? 'Bearer ' + token : '' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const log = (ok, label, detail = '') => console.log(`[${ok ? 'OK ' : 'ERR'}] ${label}${detail ? ' -> ' + detail : ''}`);

async function runAudit() {
  console.log('\n======= SERS SYSTEM AUDIT =======\n');

  // ── 1. Auth Tests
  console.log('── 1. AUTH ──');
  let r = await postJson('/api/auth/login', { identifier: 'drmeera@demo.sers.in', password: 'Test@1234' });
  log(r.status === 200 && r.body.success, 'Staff Login (email)', 'hospitalId=' + (r.body.data?.user?.hospitalId || 'null (not linked to hospital yet)'));
  const staffToken = r.body.data?.tokens?.accessToken;

  r = await postJson('/api/auth/login', { identifier: '+919876500005', password: 'Test@1234' });
  log(r.status === 200 && r.body.success, 'Staff Login (phone number)');

  r = await postJson('/api/auth/login', { identifier: 'admin@sers.in', password: 'Test@1234' });
  log(r.status === 200 && r.body.success, 'Admin Login');
  const adminToken = r.body.data?.tokens?.accessToken;

  r = await postJson('/api/auth/login', { identifier: 'admin@sers.in', password: 'WRONGPASSWORD' });
  log(r.status === 401, 'Wrong password correctly rejected (401)', 'HTTP ' + r.status);

  r = await postJson('/api/auth/login', { identifier: '', password: '' });
  log(r.status === 400 || r.status === 401, 'Empty credentials rejected', 'HTTP ' + r.status);

  // ── 2. SOS Incident Creation
  console.log('\n── 2. SOS INCIDENT CREATION ──');
  // Use random lat/lng far from any existing test data to avoid deduplication
  const testLat = 8.0 + Math.random() * 0.001;   // far south India coords
  const testLng = 70.0 + Math.random() * 0.001;
  r = await postJson('/api/incidents/sos', {
    latitude: testLat, longitude: testLng, type: 'accident',
    severity: 'critical',
    notes: 'SERS AUDIT TEST — ignore this alert'
  });
  const sosOk = (r.status === 201 && r.body.success) || (r.status === 200 && r.body.deduplicated);
  log(sosOk, 'SOS created successfully', 'HTTP ' + r.status + ' deduplicated=' + !!r.body.deduplicated + ' incident=' + (r.body.data?.incident_number || r.body.data?.incidentNumber) + ' id=' + (r.body.data?.id || r.body.data?.incidentId));
  const testIncidentId = r.body.data?.id || r.body.data?.incidentId;
  const testIncidentNum = r.body.data?.incident_number || r.body.data?.incidentNumber;

  // ── 3. Incident appears in dashboard list
  console.log('\n── 3. INCIDENT LIST & FILTERING ──');
  r = await getJson('/api/incidents?limit=10');
  const found = r.body.data?.some(i => i.id === testIncidentId);
  log(found, 'SOS appears in incident list', 'total=' + r.body.data?.length + ' found=' + found);

  // Test filter by status
  r = await getJson('/api/incidents?status=reported');
  log(r.status === 200, 'Filter by status=reported', 'count=' + (r.body.data?.length ?? 0));

  // ── 4. Dispatch check (ambulance not registered, so dispatch returns error — acceptable)
  console.log('\n── 4. AMBULANCE DISPATCH FLOW ──');
  if (testIncidentId) {
    r = await postJson('/api/incidents/' + testIncidentId + '/dispatch', { notes: 'AUDIT dispatch test' });
    log(r.status === 200 || r.status === 400 || r.status === 404, 'Dispatch endpoint responds', 'HTTP ' + r.status + ' msg=' + (r.body.message || r.body.error || 'ok'));
  }

  // ── 5. Incident status update
  console.log('\n── 5. STATUS UPDATE ──');
  if (testIncidentId) {
    r = await patchJson('/api/incidents/' + testIncidentId + '/status', { status: 'resolved', notes: 'AUDIT test resolved' }, adminToken);
    log(r.status === 200 && r.body.success, 'Status updated to resolved', 'HTTP ' + r.status);
  }

  // ── 6. Analytics Checks
  console.log('\n── 6. ANALYTICS ──');
  r = await getJson('/api/analytics/summary');
  const s = r.body.data;
  log(r.status === 200 && s, 'Summary returns real counts', `incidents=${s?.incidents?.total_incidents} hospitals=${s?.hospitals?.total} ambulances=${s?.ambulances?.total}`);

  r = await getJson('/api/analytics/incidents-by-hour');
  log(r.status === 200, 'Hourly breakdown', 'rows=' + (r.body.data?.length ?? 0));

  r = await getJson('/api/analytics/incidents-by-type');
  log(r.status === 200, 'By-type breakdown', 'rows=' + (r.body.data?.length ?? 0));

  r = await getJson('/api/analytics/response-times');
  log(r.status === 200, 'Response time trends', 'rows=' + (r.body.data?.length ?? 0));

  // ── 7. Hospitals API
  console.log('\n── 7. HOSPITALS ──');
  r = await getJson('/api/hospitals?limit=10');
  log(r.status === 200, 'Hospitals list', 'count=' + (r.body.data?.length ?? 0));

  r = await postJson('/api/hospitals', {
    name: 'AUDIT Test Hospital',
    address: 'Test Address',
    latitude: 12.97,
    longitude: 77.59,
    phone: '+91900000000',
    icu_beds_total: 10,
    icu_beds_available: 5,
    er_beds_total: 20,
    er_beds_available: 10,
    is_active: true,
    is_on_sers_network: true
  });
  log(r.status === 201 && r.body.success, 'Hospital creation', 'HTTP ' + r.status);
  const testHospitalId = r.body.data?.id;

  // ── 8. Ambulance registration
  console.log('\n── 8. AMBULANCE REGISTRATION ──');
  r = await postJson('/api/ambulances', {
    registration_number: 'KA-01-AUDIT-9999',
    vehicle_type: 'als',
    hospital_id: testHospitalId || null,
    driver_name: 'AUDIT Driver',
    driver_phone: '+919900000001',
    status: 'available'
  });
  log(r.status === 201 && r.body.success, 'Ambulance creation', 'HTTP ' + r.status + ' id=' + r.body.data?.id);
  const testAmbulanceId = r.body.data?.id;

  // ── 9. Ambulance list
  r = await getJson('/api/ambulances');
  log(r.status === 200, 'Ambulances list', 'count=' + (r.body.data?.length ?? 0));

  // ── 10. Attendance API
  console.log('\n── 9. DUTY ATTENDANCE ──');
  r = await getJson('/api/attendance');
  log(r.status === 200, 'Attendance list today', 'count=' + (r.body.data?.length ?? 0));

  // ── 11. Clean up audit test data
  console.log('\n── 10. CLEANUP AUDIT DATA ──');
  const { Pool } = require('pg');
  const pool = new Pool({ host: 'localhost', port: 5433, database: 'sers_db', user: 'sers_user', password: 'sers_secret_password' });
  if (testIncidentId) {
    await pool.query("DELETE FROM incident_events WHERE incident_id = $1", [testIncidentId]);
    await pool.query("DELETE FROM incidents WHERE id = $1", [testIncidentId]);
    console.log('[OK ] Audit incident cleaned up: ' + testIncidentNum);
  }
  if (testAmbulanceId) {
    await pool.query("DELETE FROM ambulances WHERE id = $1", [testAmbulanceId]);
    console.log('[OK ] Audit ambulance cleaned up');
  }
  if (testHospitalId) {
    await pool.query("DELETE FROM hospitals WHERE id = $1", [testHospitalId]);
    console.log('[OK ] Audit hospital cleaned up');
  }
  await pool.end();

  console.log('\n======= AUDIT COMPLETE =======\n');
}

runAudit().catch(err => { console.error('AUDIT FAILED:', err.message); process.exit(1); });
