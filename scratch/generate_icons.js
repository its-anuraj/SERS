const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Master SERS Siren App Icon SVG (1024x1024)
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#1e0c1b"/>
      <stop offset="40%" stop-color="#0e1322"/>
      <stop offset="100%" stop-color="#060911"/>
    </radialGradient>

    <!-- Siren Radial Glow -->
    <radialGradient id="sirenRadialGlow" cx="50%" cy="42%" r="50%">
      <stop offset="0%" stop-color="#ff1e42" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#e11d48" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0"/>
    </radialGradient>

    <!-- Dome Red Gradient -->
    <linearGradient id="domeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff4d6d"/>
      <stop offset="35%" stop-color="#e11d48"/>
      <stop offset="70%" stop-color="#be123c"/>
      <stop offset="100%" stop-color="#881337"/>
    </linearGradient>

    <!-- Dome Highlight -->
    <linearGradient id="domeHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>

    <!-- Starburst Core Flare -->
    <radialGradient id="flareGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="25%" stop-color="#fff1f2"/>
      <stop offset="60%" stop-color="#ff8597"/>
      <stop offset="100%" stop-color="#ff1e42" stop-opacity="0"/>
    </radialGradient>

    <!-- Base Metallic Gradient -->
    <linearGradient id="baseMetal" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="25%" stop-color="#94a3b8"/>
      <stop offset="50%" stop-color="#cbd5e1"/>
      <stop offset="75%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>

    <linearGradient id="baseBottom" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>

    <!-- App Border Glow -->
    <linearGradient id="borderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3366" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="#64748b" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0.6"/>
    </linearGradient>
  </defs>

  <!-- App Icon Background Squircle with Border -->
  <rect x="12" y="12" width="1000" height="1000" rx="230" fill="url(#bgGlow)"/>
  <rect x="14" y="14" width="996" height="996" rx="228" stroke="url(#borderGlow)" stroke-width="8" fill="none"/>

  <!-- Siren Aura Pulse -->
  <circle cx="512" cy="430" r="380" fill="url(#sirenRadialGlow)"/>

  <!-- Light Pulse Beams (Subtle Rays) -->
  <g opacity="0.35">
    <line x1="512" y1="430" x2="180" y2="250" stroke="#ff4d6d" stroke-width="6" stroke-linecap="round"/>
    <line x1="512" y1="430" x2="844" y2="250" stroke="#ff4d6d" stroke-width="6" stroke-linecap="round"/>
    <line x1="512" y1="430" x2="140" y2="430" stroke="#ff4d6d" stroke-width="6" stroke-linecap="round"/>
    <line x1="512" y1="430" x2="884" y2="430" stroke="#ff4d6d" stroke-width="6" stroke-linecap="round"/>
    <line x1="512" y1="430" x2="512" y2="100" stroke="#ff4d6d" stroke-width="8" stroke-linecap="round"/>
  </g>

  <!-- 3D Siren Base / Pedestal Layer 1 (Bottom Rim) -->
  <path d="M 270 650 C 270 610, 754 610, 754 650 L 730 710 C 730 740, 294 740, 294 710 Z" fill="url(#baseBottom)"/>
  <ellipse cx="512" cy="710" rx="218" ry="32" fill="#0f172a"/>

  <!-- Pedestal Layer 2 (Metallic Ring) -->
  <path d="M 290 620 C 290 580, 734 580, 734 620 L 734 655 C 734 685, 290 685, 290 655 Z" fill="url(#baseMetal)"/>
  <ellipse cx="512" cy="620" rx="222" ry="34" fill="#e2e8f0"/>
  <ellipse cx="512" cy="620" rx="205" ry="28" fill="#1e293b"/>

  <!-- Siren Red Dome Body -->
  <!-- Shape curves up like real emergency beacon -->
  <path d="M 320 600 
           C 310 460, 370 230, 470 190
           C 495 180, 529 180, 554 190
           C 654 230, 714 460, 704 600
           C 640 635, 384 635, 320 600 Z" 
        fill="url(#domeGrad)" 
        filter="drop-shadow(0 15px 30px rgba(225,29,72,0.6))"/>

  <!-- Dome Vertical Optical Ribs / Fresnel Lens Effect -->
  <g opacity="0.3">
    <path d="M 380 580 C 370 470, 410 280, 470 210" stroke="#ffffff" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M 440 595 C 435 480, 460 270, 495 200" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 584 595 C 589 480, 564 270, 529 200" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 644 580 C 654 470, 614 280, 554 210" stroke="#ffffff" stroke-width="12" fill="none" stroke-linecap="round"/>
  </g>

  <!-- Dome Left Glossy Glass Reflection -->
  <path d="M 345 570 
           C 335 460, 390 260, 480 210
           C 490 205, 495 215, 485 225
           C 410 275, 365 460, 375 565
           C 376 575, 347 580, 345 570 Z" 
        fill="url(#domeHighlight)"/>

  <!-- Center Radiant Starburst Blast (The User's Siren Star Glow) -->
  <circle cx="512" cy="420" r="140" fill="url(#flareGrad)"/>

  <!-- 8-Pointed Star Flare Sharp Geometry -->
  <path d="M 512 280 
           L 535 385 L 640 340 L 565 420 L 670 445 L 565 470 L 640 550 L 535 505
           L 512 610 
           L 489 505 L 384 550 L 459 470 L 354 445 L 459 420 L 384 340 L 489 385 Z" 
        fill="#ffffff" 
        filter="drop-shadow(0 0 25px rgba(255,255,255,0.95))"/>

  <!-- Inner Diamond Intense Core Glow -->
  <polygon points="512,350 535,420 605,420 548,455 570,520 512,480 454,520 476,455 419,420 489,420" fill="#ffffff"/>
  <circle cx="512" cy="430" r="28" fill="#ffffff" filter="drop-shadow(0 0 15px #ffffff)"/>

  <!-- Bottom App Brand Typography Banner -->
  <g transform="translate(0, 810)">
    <!-- Pill Backdrop -->
    <rect x="330" y="0" width="364" height="74" rx="37" fill="#1e1022" stroke="#e11d48" stroke-width="3" stroke-opacity="0.6"/>
    <text x="512" y="50" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="8">
      SERS
    </text>
  </g>
</svg>
`;

// 2. Adaptive Foreground SVG (Safe Zone in 1024x1024 for Android adaptive icon)
const adaptiveForegroundSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Siren Radial Glow -->
    <radialGradient id="afSirenRadialGlow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#ff1e42" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#e11d48" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0"/>
    </radialGradient>

    <!-- Dome Red Gradient -->
    <linearGradient id="afDomeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff4d6d"/>
      <stop offset="35%" stop-color="#e11d48"/>
      <stop offset="70%" stop-color="#be123c"/>
      <stop offset="100%" stop-color="#881337"/>
    </linearGradient>

    <!-- Starburst Core Flare -->
    <radialGradient id="afFlareGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="25%" stop-color="#fff1f2"/>
      <stop offset="60%" stop-color="#ff8597"/>
      <stop offset="100%" stop-color="#ff1e42" stop-opacity="0"/>
    </radialGradient>

    <!-- Base Metallic Gradient -->
    <linearGradient id="afBaseMetal" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="25%" stop-color="#94a3b8"/>
      <stop offset="50%" stop-color="#cbd5e1"/>
      <stop offset="75%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>

    <linearGradient id="afBaseBottom" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>

  <!-- Scale slightly to fit inside Android Adaptive safe mask (center 66%) -->
  <g transform="translate(77, 77) scale(0.85)">
    <!-- Siren Aura Pulse -->
    <circle cx="512" cy="430" r="360" fill="url(#afSirenRadialGlow)"/>

    <!-- 3D Siren Base / Pedestal Layer 1 (Bottom Rim) -->
    <path d="M 270 650 C 270 610, 754 610, 754 650 L 730 710 C 730 740, 294 740, 294 710 Z" fill="url(#afBaseBottom)"/>
    <ellipse cx="512" cy="710" rx="218" ry="32" fill="#0f172a"/>

    <!-- Pedestal Layer 2 (Metallic Ring) -->
    <path d="M 290 620 C 290 580, 734 580, 734 620 L 734 655 C 734 685, 290 685, 290 655 Z" fill="url(#afBaseMetal)"/>
    <ellipse cx="512" cy="620" rx="222" ry="34" fill="#e2e8f0"/>
    <ellipse cx="512" cy="620" rx="205" ry="28" fill="#1e293b"/>

    <!-- Siren Red Dome Body -->
    <path d="M 320 600 
             C 310 460, 370 230, 470 190
             C 495 180, 529 180, 554 190
             C 654 230, 714 460, 704 600
             C 640 635, 384 635, 320 600 Z" 
          fill="url(#afDomeGrad)"/>

    <!-- Center Radiant Starburst Blast -->
    <circle cx="512" cy="420" r="140" fill="url(#afFlareGrad)"/>

    <!-- 8-Pointed Star Flare -->
    <path d="M 512 280 
             L 535 385 L 640 340 L 565 420 L 670 445 L 565 470 L 640 550 L 535 505
             L 512 610 
             L 489 505 L 384 550 L 459 470 L 354 445 L 459 420 L 384 340 L 489 385 Z" 
          fill="#ffffff" 
          filter="drop-shadow(0 0 25px rgba(255,255,255,0.95))"/>

    <circle cx="512" cy="430" r="28" fill="#ffffff"/>
  </g>
</svg>
`;

// 3. Splash Screen SVG (2048x2048)
const splashSvg = `
<svg width="2048" height="2048" viewBox="0 0 2048 2048" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="spBgGlow" cx="50%" cy="48%" r="65%">
      <stop offset="0%" stop-color="#240c1d"/>
      <stop offset="45%" stop-color="#0e1322"/>
      <stop offset="100%" stop-color="#05070d"/>
    </radialGradient>
    <radialGradient id="spFlareGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#fff1f2"/>
      <stop offset="65%" stop-color="#ff8597"/>
      <stop offset="100%" stop-color="#ff1e42" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="spDomeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff4d6d"/>
      <stop offset="35%" stop-color="#e11d48"/>
      <stop offset="70%" stop-color="#be123c"/>
      <stop offset="100%" stop-color="#881337"/>
    </linearGradient>
  </defs>

  <rect width="2048" height="2048" fill="url(#spBgGlow)"/>

  <!-- Centered Siren -->
  <g transform="translate(512, 460) scale(1.0)">
    <!-- Base -->
    <path d="M 270 650 C 270 610, 754 610, 754 650 L 730 710 C 730 740, 294 740, 294 710 Z" fill="#1e293b"/>
    <ellipse cx="512" cy="710" rx="218" ry="32" fill="#0f172a"/>
    <ellipse cx="512" cy="620" rx="222" ry="34" fill="#cbd5e1"/>
    <ellipse cx="512" cy="620" rx="205" ry="28" fill="#1e293b"/>

    <!-- Dome -->
    <path d="M 320 600 C 310 460, 370 230, 470 190 C 495 180, 529 180, 554 190 C 654 230, 714 460, 704 600 C 640 635, 384 635, 320 600 Z" fill="url(#spDomeGrad)"/>

    <!-- Star Glow -->
    <circle cx="512" cy="420" r="150" fill="url(#spFlareGrad)"/>
    <path d="M 512 280 L 535 385 L 640 340 L 565 420 L 670 445 L 565 470 L 640 550 L 535 505 L 512 610 L 489 505 L 384 550 L 459 470 L 354 445 L 459 420 L 384 340 L 489 385 Z" fill="#ffffff"/>
    <circle cx="512" cy="430" r="30" fill="#ffffff"/>
  </g>

  <!-- SERS Wordmark -->
  <text x="1024" y="1480" font-family="system-ui, -apple-system, sans-serif" font-size="110" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="16">
    SERS
  </text>
  <text x="1024" y="1560" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="6">
    SMART EMERGENCY RESPONSE SYSTEM
  </text>
</svg>
`;

async function generate() {
  const assetsDir = path.join(__dirname, '..', 'apps', 'mobile', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log('Rendering high-resolution 1024x1024 icon.png...');
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));

  console.log('Rendering Android adaptive-icon.png...');
  await sharp(Buffer.from(adaptiveForegroundSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));

  console.log('Rendering splash.png...');
  await sharp(Buffer.from(splashSvg))
    .resize(2048, 2048)
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));

  console.log('Rendering notification-icon.png...');
  await sharp(Buffer.from(adaptiveForegroundSvg))
    .resize(96, 96)
    .png()
    .toFile(path.join(assetsDir, 'notification-icon.png'));

  console.log('✅ ALL SERS APP ICONS AND SPLASH GENERATED SUCCESSFULLY!');
}

generate().catch(console.error);
