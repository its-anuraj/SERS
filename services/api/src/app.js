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
    const publicUrl = process.env.PUBLIC_WEB_URL || 'http://localhost:3001';
    const adminUrl = process.env.ADMIN_WEB_URL || 'http://localhost:3002';
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';

    if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SERS — Smart Emergency Response System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --border-hover: #cbd5e1;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --text-subtle: #94a3b8;
      
      --primary: #1e293b;
      --red-bg: #fef2f2;
      --red-text: #dc2626;
      --red-border: #fecaca;
      
      --blue-bg: #eff6ff;
      --blue-text: #2563eb;
      --blue-border: #bfdbfe;
      
      --amber-bg: #fffbeb;
      --amber-text: #d97706;
      --amber-border: #fde68a;
      
      --green-bg: #f0fdf4;
      --green-text: #16a34a;
      --green-border: #bbf7d0;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: var(--bg);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1.5rem;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 960px;
      width: 100%;
    }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 3rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 800;
      font-size: 1.25rem;
      color: var(--text-main);
      letter-spacing: -0.02em;
    }
    .brand-icon {
      width: 38px;
      height: 38px;
      background: #dc2626;
      color: #ffffff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      box-shadow: 0 4px 10px rgba(220, 38, 38, 0.2);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.9rem;
      border-radius: 9999px;
      background: var(--green-bg);
      border: 1px solid var(--green-border);
      color: var(--green-text);
      font-size: 0.85rem;
      font-weight: 600;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green-text);
    }
    .hero {
      text-align: center;
      margin-bottom: 3rem;
    }
    .hero-tag {
      display: inline-block;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--blue-text);
      background: var(--blue-bg);
      padding: 0.35rem 0.85rem;
      border-radius: 6px;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 2.35rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text-main);
      margin-bottom: 0.75rem;
      line-height: 1.2;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2.5rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.75rem;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: var(--border-hover);
      box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03);
    }
    .card-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .card-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
    }
    .port-pill {
      font-size: 0.725rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 0.25rem 0.65rem;
      border-radius: 6px;
      text-transform: uppercase;
    }
    
    .card-red .card-icon-box { background: var(--red-bg); color: var(--red-text); }
    .card-red .port-pill { background: var(--red-bg); color: var(--red-text); border: 1px solid var(--red-border); }
    
    .card-blue .card-icon-box { background: var(--blue-bg); color: var(--blue-text); }
    .card-blue .port-pill { background: var(--blue-bg); color: var(--blue-text); border: 1px solid var(--blue-border); }
    
    .card-amber .card-icon-box { background: var(--amber-bg); color: var(--amber-text); }
    .card-amber .port-pill { background: var(--amber-bg); color: var(--amber-text); border: 1px solid var(--amber-border); }
    
    .card-green .card-icon-box { background: var(--green-bg); color: var(--green-text); }
    .card-green .port-pill { background: var(--green-bg); color: var(--green-text); border: 1px solid var(--green-border); }

    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 0.4rem;
    }
    .card-desc {
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
      flex-grow: 1;
    }
    .card-btn {
      font-size: 0.875rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.65rem 1rem;
      border-radius: 8px;
      background: #f1f5f9;
      color: #334155;
      transition: all 0.15s ease;
    }
    .card:hover .card-btn {
      background: var(--primary);
      color: #ffffff;
    }

    .api-sec {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .api-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .api-sec-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .api-sec-subtitle {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .endpoints {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .ep {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.825rem;
      padding: 0.45rem 0.85rem;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid var(--border);
      color: #334155;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.15s ease;
    }
    .ep:hover {
      background: #ffffff;
      border-color: #cbd5e1;
      color: #0f172a;
      box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }
    .method-get { color: #2563eb; font-weight: 700; font-size: 0.75rem; }
    .method-post { color: #16a34a; font-weight: 700; font-size: 0.75rem; }

    .footer {
      margin-top: 3rem;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-subtle);
    }
  </style>
</head>
<body>
  <div class="container">
    
    <div class="top-bar">
      <div class="brand">
        <div class="brand-icon">🚨</div>
        <span>SERS Platform</span>
      </div>
      <div class="status-badge">
        <div class="status-dot"></div>
        <span>API Services Operational</span>
      </div>
    </div>

    <div class="hero">
      <span class="hero-tag">System Control Hub</span>
      <h1>Smart Emergency Response System</h1>
      <p class="subtitle">Unified platform for emergency coordination, live ambulance dispatch, hospital management, and AI assistance.</p>
    </div>

    <div class="grid">
      <a href="${publicUrl}" target="_blank" class="card card-red">
        <div class="card-header-row">
          <div class="card-icon-box">🚑</div>
          <span class="port-pill">CITIZEN PORTAL</span>
        </div>
        <div class="card-title">Public Website</div>
        <div class="card-desc">Citizen emergency landing portal, public hospital directory, and instant Web SOS request.</div>
        <div class="card-btn">Open Citizen Portal &rarr;</div>
      </a>

      <a href="${adminUrl}" target="_blank" class="card card-blue">
        <div class="card-header-row">
          <div class="card-icon-box">⚡</div>
          <span class="port-pill">ADMIN PORTAL</span>
        </div>
        <div class="card-title">Command Center</div>
        <div class="card-desc">Admin control dashboard, live GPS fleet tracking, hospital ICU bed manager, and Gemini AI assistant.</div>
        <div class="card-btn">Open Admin Dashboard &rarr;</div>
      </a>

      <a href="${publicUrl}/sos" target="_blank" class="card card-amber">
        <div class="card-header-row">
          <div class="card-icon-box">🆘</div>
          <span class="port-pill">EMERGENCY SOS</span>
        </div>
        <div class="card-title">Web Emergency SOS</div>
        <div class="card-desc">Browser-based GPS location detection and one-click emergency dispatch form.</div>
        <div class="card-btn">Launch Web SOS &rarr;</div>
      </a>

      <a href="${mlUrl}/docs" target="_blank" class="card card-green">
        <div class="card-header-row">
          <div class="card-icon-box">🤖</div>
          <span class="port-pill">AI ENGINE</span>
        </div>
        <div class="card-title">Python ML Service</div>
        <div class="card-desc">FastAPI Swagger documentation for AI Crash Detection, Hospital Matcher, and Hotspot Analytics.</div>
        <div class="card-btn">View API Docs &rarr;</div>
      </a>
    </div>

    <div class="api-sec">
      <div class="api-header">
        <div class="api-sec-title">Core Backend REST API Endpoints</div>
      </div>
      <div class="endpoints">
        <a href="/api/health" class="ep"><span class="method-get">GET</span> /api/health</a>
        <a href="/api/incidents" class="ep"><span class="method-get">GET</span> /api/incidents</a>
        <a href="/api/hospitals" class="ep"><span class="method-get">GET</span> /api/hospitals</a>
        <a href="/api/ambulances" class="ep"><span class="method-get">GET</span> /api/ambulances</a>
        <a href="/api/analytics/summary" class="ep"><span class="method-get">GET</span> /api/analytics/summary</a>
        <a href="/api/analytics/hotspots" class="ep"><span class="method-get">GET</span> /api/analytics/hotspots</a>
        <span class="ep"><span class="method-post">POST</span> /api/incidents/web-sos</span>
        <span class="ep"><span class="method-post">POST</span> /api/analytics/llm-query</span>
      </div>
    </div>

    <div class="footer">
      Smart Emergency Response System (SERS) &bull; Academic Year 2025–26
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
