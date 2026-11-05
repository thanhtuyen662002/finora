import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const manifest = read('src/app/manifest.ts');
const sw = read('public/sw.js');
const layout = read('src/app/layout.tsx');
const register = read('src/components/layout/ServiceWorkerRegister.tsx');
const nextConfig = read('next.config.ts');

const iconFiles = [
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/maskable-192.png',
  'public/icons/maskable-512.png',
  'public/icons/apple-touch-icon.png',
  'public/icons/favicon-32.png',
];

const checks = [
  ['all PWA icons exist', iconFiles.every((file) => fs.existsSync(file))],
  ['offline page exists', fs.existsSync('public/offline.html')],
  ['manifest is standalone', manifest.includes('display: "standalone"')],
  ['manifest has 192 and 512 any icons', manifest.includes('/icons/icon-192.png') && manifest.includes('/icons/icon-512.png')],
  ['manifest has maskable icon', manifest.includes('purpose: "maskable"')],
  ['manifest starts on dashboard', manifest.includes('start_url: "/dashboard"')],
  ['worker ignores non-GET requests', sw.includes("request.method !== 'GET'")],
  ['worker ignores cross-origin requests (Supabase)', sw.includes('url.origin !== self.location.origin')],
  ['navigations are network-first with offline fallback', sw.includes("request.mode === 'navigate'") && sw.includes('networkWithOfflineFallback')],
  ['worker never caches HTML navigations', !/navigate[\s\S]{0,200}cache\.put/.test(sw)],
  ['only static assets are cache-first', sw.includes("'/_next/static/'") && sw.includes('isCacheableAsset')],
  ['old finora caches are removed on activate', sw.includes("key.startsWith('finora-')") && sw.includes('caches.delete')],
  ['layout mounts the registrar', layout.includes('<ServiceWorkerRegister />')],
  ['layout sets apple touch icon', layout.includes('/icons/apple-touch-icon.png')],
  ['registration is production-only', register.includes('process.env.NODE_ENV !== "production"')],
  ['registration bypasses HTTP cache for sw.js', register.includes('updateViaCache: "none"')],
  ['sw.js is served with no-cache headers', nextConfig.includes('source: "/sw.js"') && nextConfig.includes('no-cache, no-store, must-revalidate')],
];

let failures = 0;
for (const [label, pass] of checks) {
  if (pass) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

console.log(`PWA_SOURCE_VERIFIER: ${checks.length - failures}/${checks.length}`);
if (failures > 0) process.exit(1);
