/**
 * Every page under src/app must be either explicitly public or listed in
 * protectedRoutes in src/lib/supabase/proxy.ts. Fails when a new top-level
 * page is added without deciding which it is.
 */
import fs from 'node:fs';

const PUBLIC_SEGMENTS = new Set([
  'login',
  'signup',
  'forgot-password',
  'reset-password',
  'auth',
  'api',
]);

const proxy = fs.readFileSync('src/lib/supabase/proxy.ts', 'utf8');
const listMatch = proxy.match(/const protectedRoutes = \[([\s\S]*?)\];/);
const protectedRoutes = new Set(
  listMatch ? [...listMatch[1].matchAll(/'(\/[^']+)'/g)].map((m) => m[1]) : []
);

const segments = fs
  .readdirSync('src/app', { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('(') && !entry.name.startsWith('_'))
  .map((entry) => entry.name);

let failures = 0;
if (!listMatch) {
  failures += 1;
  console.error('FAIL protectedRoutes list not found in proxy.ts');
}

for (const segment of segments) {
  if (PUBLIC_SEGMENTS.has(segment)) {
    console.log(`PASS /${segment} is public by design`);
  } else if (protectedRoutes.has(`/${segment}`)) {
    console.log(`PASS /${segment} is protected`);
  } else {
    failures += 1;
    console.error(`FAIL /${segment} is neither public nor in protectedRoutes`);
  }
}

console.log(`PROTECTED_ROUTES_VERIFIER: ${segments.length - failures}/${segments.length}`);
if (failures > 0) process.exit(1);
