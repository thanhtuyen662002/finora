import assert from 'node:assert';

function getSafeRedirectUrl(target, fallback = '/dashboard') {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const trimmed = target.trim();

  // Must start with a single slash and not double slash or backslash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Reject control characters or newlines
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return fallback;
  }

  // Reject backslashes anywhere in the path to prevent browser path normalization tricks
  if (trimmed.includes('\\')) {
    return fallback;
  }

  try {
    const dummyOrigin = 'http://localhost';
    const parsed = new URL(trimmed, dummyOrigin);

    if (parsed.origin !== dummyOrigin) {
      return fallback;
    }

    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!safePath.startsWith('/') || safePath.startsWith('//')) {
      return fallback;
    }

    return safePath;
  } catch {
    return fallback;
  }
}

console.log('=== FINORA PHASE 2 — REDIRECT SANITIZATION ASSERTIONS ===');

const testCases = [
  { input: null, expected: '/dashboard' },
  { input: undefined, expected: '/dashboard' },
  { input: '', expected: '/dashboard' },
  { input: '/dashboard', expected: '/dashboard' },
  { input: '/settings?tab=profile', expected: '/settings?tab=profile' },
  { input: '/onboarding', expected: '/onboarding' },
  { input: '/reset-password', expected: '/reset-password' },
  { input: 'https://evil.com', expected: '/dashboard' },
  { input: 'http://evil.com', expected: '/dashboard' },
  { input: '//evil.com', expected: '/dashboard' },
  { input: '/\\evil.com', expected: '/dashboard' },
  { input: '/settings\\evil.com', expected: '/dashboard' },
  { input: 'javascript:alert(1)', expected: '/dashboard' },
  { input: '/dashboard\r\nSet-Cookie: stolen=1', expected: '/dashboard' },
  { input: '/dashboard\0evil', expected: '/dashboard' },
  { input: '   /accounts   ', expected: '/accounts' },
];

let failed = false;
for (const tc of testCases) {
  const result = getSafeRedirectUrl(tc.input, '/dashboard');
  if (result !== tc.expected) {
    console.error(`❌ Case failed: input=${JSON.stringify(tc.input)}, got=${JSON.stringify(result)}, expected=${JSON.stringify(tc.expected)}`);
    failed = true;
  } else {
    console.log(`  ✔ Safe check: ${JSON.stringify(tc.input)} => ${JSON.stringify(result)}`);
  }
}

if (failed) {
  console.error('\n❌ REDIRECT SANITIZATION VERIFICATION FAILED.');
  process.exit(1);
}

console.log('\n✅ PASS: Redirect sanitization assertions succeeded.');
process.exit(0);
