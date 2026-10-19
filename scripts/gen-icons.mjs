// Generate FiberKar app icons from SVG using sharp
import sharp from 'sharp'
import { mkdirSync } from 'fs'

// Main icon: rounded square, emerald gradient, fiber-optic strands + light pulse
const mainSvg = (size) => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#047857"/>
      <stop offset="0.55" stop-color="#059669"/>
      <stop offset="1" stop-color="#065f46"/>
    </linearGradient>
    <linearGradient id="strand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#d1fae5" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fbbf24" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="#f59e0b" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="${Math.round(224 * (size / 1024))}" fill="url(#bg)"/>
  <g transform="translate(512,512)">
    <path d="M -330 40 C -180 40 -120 -190 40 -190" fill="none" stroke="#064e3b" stroke-width="64" stroke-linecap="round"/>
    <path d="M -330 40 C -180 40 -120 -190 40 -190" fill="none" stroke="url(#strand)" stroke-width="40" stroke-linecap="round"/>
    <path d="M -330 130 C -140 130 -80 -80 60 -80" fill="none" stroke="#064e3b" stroke-width="64" stroke-linecap="round"/>
    <path d="M -330 130 C -140 130 -80 -80 60 -80" fill="none" stroke="url(#strand)" stroke-width="40" stroke-linecap="round" opacity="0.8"/>
    <path d="M -330 -50 C -210 -50 -150 -290 -20 -290" fill="none" stroke="#064e3b" stroke-width="64" stroke-linecap="round"/>
    <path d="M -330 -50 C -210 -50 -150 -290 -20 -290" fill="none" stroke="url(#strand)" stroke-width="40" stroke-linecap="round" opacity="0.65"/>
    <circle cx="96" cy="-132" r="150" fill="url(#glow)"/>
    <circle cx="96" cy="-132" r="34" fill="#fbbf24"/>
    <circle cx="96" cy="-132" r="16" fill="#fffbeb"/>
    <g stroke="#fef3c7" stroke-width="18" stroke-linecap="round" opacity="0.9">
      <path d="M 150 -260 L 196 -352"/>
      <path d="M 232 -196 L 330 -248"/>
      <path d="M 244 -96 L 348 -84"/>
    </g>
  </g>
</svg>`
}

// Maskable: same art but with generous safe-zone padding on full-bleed background
const maskableSvg = (size) => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#047857"/>
      <stop offset="0.55" stop-color="#059669"/>
      <stop offset="1" stop-color="#065f46"/>
    </linearGradient>
    <linearGradient id="strand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#d1fae5" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fbbf24" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="#f59e0b" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" fill="url(#bg)"/>
  <g transform="translate(512,512) scale(0.72)">
    <path d="M -330 40 C -180 40 -120 -190 40 -190" fill="none" stroke="#064e3b" stroke-width="64" stroke-linecap="round"/>
    <path d="M -330 40 C -180 40 -120 -190 40 -190" fill="none" stroke="url(#strand)" stroke-width="40" stroke-linecap="round"/>
    <path d="M -330 130 C -140 130 -80 -80 60 -80" fill="none" stroke="#064e3b" stroke-width="64" stroke-linecap="round"/>
    <path d="M -330 130 C -140 130 -80 -80 60 -80" fill="none" stroke="url(#strand)" stroke-width="40" stroke-linecap="round" opacity="0.8"/>
    <path d="M -330 -50 C -210 -50 -150 -290 -20 -290" fill="none" stroke="#064e3b" stroke-width="64" stroke-linecap="round"/>
    <path d="M -330 -50 C -210 -50 -150 -290 -20 -290" fill="none" stroke="url(#strand)" stroke-width="40" stroke-linecap="round" opacity="0.65"/>
    <circle cx="96" cy="-132" r="150" fill="url(#glow)"/>
    <circle cx="96" cy="-132" r="34" fill="#fbbf24"/>
    <circle cx="96" cy="-132" r="16" fill="#fffbeb"/>
    <g stroke="#fef3c7" stroke-width="18" stroke-linecap="round" opacity="0.9">
      <path d="M 150 -260 L 196 -352"/>
      <path d="M 232 -196 L 330 -248"/>
      <path d="M 244 -96 L 348 -84"/>
    </g>
  </g>
</svg>`
}

async function run() {
  mkdirSync('public/icons', { recursive: true })
  const jobs = [
    ['public/icons/icon-512.png', mainSvg(512)],
    ['public/icons/icon-192.png', mainSvg(192)],
    ['public/icons/maskable-512.png', maskableSvg(512)],
    ['public/icons/apple-touch-icon.png', mainSvg(180)],
  ]
  for (const [out, svg] of jobs) {
    await sharp(Buffer.from(svg)).png().toFile(out)
    console.log('wrote', out)
  }
  await sharp(Buffer.from(mainSvg(48))).resize(32, 32).png().toFile('public/icons/favicon-32.png')
  console.log('wrote public/icons/favicon-32.png')
}
run().catch((e) => { console.error(e); process.exit(1) })
