const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5433, database: 'sers_db', user: 'sers_user', password: 'sers_secret_password' });
pool.query("DELETE FROM incident_events WHERE incident_id IN (SELECT id FROM incidents WHERE description LIKE '%AUDIT%')")
  .then(() => pool.query("DELETE FROM incidents WHERE description LIKE '%AUDIT%'"))
  .then(r => { console.log('Cleaned test incidents:', r.rowCount); return pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
