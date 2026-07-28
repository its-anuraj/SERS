/**
 * Express App Configuration
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./config/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const incidentRoutes = require('./routes/incident.routes');
const hospitalRoutes = require('./routes/hospital.routes');
const ambulanceRoutes = require('./routes/ambulance.routes');
const abdmRoutes = require('./routes/abdm.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

// ============================================================
// Security & Middleware
// ============================================================

app.use(helmet({
    contentSecurityPolicy: false, // Configured separately for web portals
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
}));

// Global rate limiter
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// Stricter rate limiter for SOS (should NOT be rate-limited heavily in production)
const sosLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'SOS rate limit reached.' },
});

// ============================================================
// ============================================================
// Welcome / Root Control Center
app.get('/', (req, res) => {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SERS — Smart Emergency Response System Gateway</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #07090f;
      --card-bg: rgba(17, 24, 39, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --red: #ef4444;
      --green: #22c55e;
      --blue: #3b82f6;
      --purple: #8b5cf6;
      --text: #f1f5f9;
      --muted: #94a3b8;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      background-image: 
        radial-gradient(circle at 20% 20%, rgba(239, 68, 68, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.12) 0%, transparent 40%);
    }
    .container {
      max-width: 900px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 1rem;
      border-radius: 9999px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.25);
      color: var(--green);
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 10px var(--green);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 900;
      letter-spacing: -0.025em;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.subtitle {
      color: var(--muted);
      font-size: 1.05rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(16px);
      border-radius: 1.25rem;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      transition: all 0.25s ease;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }
    .card:hover {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
    }
    .card-icon {
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 0.35rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card-desc {
      color: var(--muted);
      font-size: 0.875rem;
      line-height: 1.45;
      margin-bottom: 1.25rem;
      flex-grow: 1;
    }
    .card-link {
      font-size: 0.85rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .card-red .card-link { color: var(--red); }
    .card-blue .card-link { color: var(--blue); }
    .card-purple .card-link { color: var(--purple); }
    .card-green .card-link { color: var(--green); }

    .api-sec {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1.25rem;
      padding: 1.5rem;
    }
    .api-sec-title {
      font-size: 0.9rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 1rem;
    }
    .endpoints {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .ep {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      padding: 0.4rem 0.75rem;
      border-radius: 0.5rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #cbd5e1;
      text-decoration: none;
      transition: background 0.2s ease;
    }
    .ep:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">
        <div class="dot"></div>
        <span>SERS Gateway Active · Node.js API + WebSockets</span>
      </div>
      <h1>Smart Emergency Response System</h1>
      <p class="subtitle">Unified AI-Powered Emergency Coordination Platform</p>
    </div>

    <div class="grid">
      <a href="http://localhost:3001" target="_blank" class="card card-red">
        <div class="card-icon">🚑</div>
        <div class="card-title">
          <span>Public Website</span>
          <span style="font-size: 0.75rem; background: rgba(239,68,68,0.15); color: var(--red); padding: 2px 8px; border-radius: 6px;">Port 3001</span>
        </div>
        <div class="card-desc">Citizen landing page, public hospital directory, and instant Web SOS emergency trigger.</div>
        <div class="card-link">Open Public Portal →</div>
      </a>

      <a href="http://localhost:3002" target="_blank" class="card card-blue">
        <div class="card-icon">⚡</div>
        <div class="card-title">
          <span>Command Center</span>
          <span style="font-size: 0.75rem; background: rgba(59,130,246,0.15); color: var(--blue); padding: 2px 8px; border-radius: 6px;">Port 3002</span>
        </div>
        <div class="card-desc">Admin dashboard, live ambulance fleet tracker, ICU bed manager, and Gemini AI Chat.</div>
        <div class="card-link">Open Admin Dashboard →</div>
      </a>

      <a href="http://localhost:3001/sos" target="_blank" class="card card-purple">
        <div class="card-icon">🆘</div>
        <div class="card-title">
          <span>Web Emergency SOS</span>
          <span style="font-size: 0.75rem; background: rgba(139,92,246,0.15); color: var(--purple); padding: 2px 8px; border-radius: 6px;">Browser</span>
        </div>
        <div class="card-desc">Browser-based GPS location detection and instant emergency dispatch form.</div>
        <div class="card-link">Trigger Web SOS →</div>
      </a>

      <a href="http://localhost:8001/docs" target="_blank" class="card card-green">
        <div class="card-icon">🤖</div>
        <div class="card-title">
          <span>Python ML Service</span>
          <span style="font-size: 0.75rem; background: rgba(34,197,94,0.15); color: var(--green); padding: 2px 8px; border-radius: 6px;">Port 8001</span>
        </div>
        <div class="card-desc">FastAPI Swagger documentation for Crash Detection, Hospital Matcher, and Hotspot AI.</div>
        <div class="card-link">Open Swagger Docs →</div>
      </a>
    </div>

    <div class="api-sec">
      <div class="api-sec-title">Available REST API Endpoints (Port 3000)</div>
      <div class="endpoints">
        <a href="/api/health" class="ep">GET /api/health</a>
        <a href="/api/incidents" class="ep">GET /api/incidents</a>
        <a href="/api/hospitals" class="ep">GET /api/hospitals</a>
        <a href="/api/ambulances" class="ep">GET /api/ambulances</a>
        <a href="/api/analytics/summary" class="ep">GET /api/analytics/summary</a>
        <a href="/api/analytics/hotspots" class="ep">GET /api/analytics/hotspots</a>
        <span class="ep">POST /api/incidents/web-sos</span>
        <span class="ep">POST /api/analytics/llm-query</span>
      </div>
    </div>

    <div class="footer">
      SERS (Smart Emergency Response System) · Academic Year 2025–26
    </div>
  </div>
</body>
</html>`);
    }

    res.json({
        service: 'SERS — Smart Emergency Response System API',
        status: 'online',
        version: '1.0.0',
        documentation: '/api/health',
        portals: {
            public_website: 'http://localhost:3001',
            admin_command_center: 'http://localhost:3002',
            ml_service: 'http://localhost:8001/docs',
        },
        endpoints: [
            '/api/health',
            '/api/auth',
            '/api/users',
            '/api/incidents',
            '/api/hospitals',
            '/api/ambulances',
            '/api/abdm',
            '/api/analytics',
            '/api/notifications',
        ],
    });
});

// Health Check (no auth required)
// ============================================================

app.get('/api/health', async (req, res) => {
    try {
        const { query } = require('./config/database');
        const { getRedis } = require('./config/redis');

        let dbStatus = 'healthy';
        try {
            await query('SELECT 1');
        } catch (e) {
            dbStatus = 'degraded';
        }

        let redisStatus = 'healthy';
        try {
            const redis = getRedis();
            if (redis) await redis.ping();
            else redisStatus = 'mock_active';
        } catch (e) {
            redisStatus = 'degraded';
        }

        res.json({
            status: dbStatus === 'healthy' ? 'ok' : 'degraded',
            service: 'SERS API',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            checks: {
                database: dbStatus,
                redis: redisStatus,
                websocket: 'active',
            },
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});


// ============================================================
// Routes
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/abdm', abdmRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// Apply stricter limit on SOS route
app.use('/api/incidents/sos', sosLimiter);

// ============================================================
// Error Handling
// ============================================================

app.use(notFound);
app.use(errorHandler);

module.exports = app;
