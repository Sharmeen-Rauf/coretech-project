const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate high quality SVG logo badge
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="ctGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="45%" stop-color="#0284C7" />
      <stop offset="100%" stop-color="#00B4D8" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <circle cx="256" cy="256" r="240" fill="url(#ctGrad)" stroke="#FFFFFF" stroke-width="16" filter="url(#shadow)" />
  <text x="256" y="270" font-family="'Inter', 'Arial Black', sans-serif" font-size="210" font-weight="900" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle" letter-spacing="-6">CT</text>
  <text x="256" y="385" font-family="'Inter', 'Arial', sans-serif" font-size="44" font-weight="800" fill="#E0F7FA" text-anchor="middle" letter-spacing="6">SOLAR</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent);
fs.writeFileSync(path.join(publicDir, 'logo.svg'), svgContent);

console.log('Favicon SVG generated successfully in public/ directory!');
