import { FrankfurterProvider } from '../src/lib/exchange-rate/frankfurter.js';

let total = 0;
let passed = 0;

function assertEqual(name, actual, expected) {
  total++;
  if (actual === expected) {
    passed++;
    console.log(`✓ PASS: ${name}`);
  } else {
    console.error(`✗ FAIL: ${name} (Expected ${expected}, got ${actual})`);
  }
}

async function runTests() {
  // Mock fetch
  const originalFetch = global.fetch;
  
  global.fetch = async (url) => {
    if (url.includes('/v1/latest')) {
      if (url.includes('base=USD&symbols=VND')) {
        return {
          ok: true,
          text: async () => 'USD,VND,26316.25,2026-08-28'
        };
      }
      if (url.includes('base=EUR&symbols=JPY')) {
        return {
          ok: true,
          text: async () => '{"amount":1.0,"base":"EUR","date":"2026-08-28","rates":{"JPY":159.68}}'
        };
      }
      if (url.includes('base=XYZ')) {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found'
        };
      }
      if (url.includes('base=BAD')) {
        return {
          ok: true,
          text: async () => '{"amount":1.0,"base":"BAD","date":"2026-08-28","rates":{}}' // Missing pair
        };
      }
    }
    
    if (url.includes('/v1/2026-08-15')) {
      return {
        ok: true,
        text: async () => '{"amount":1.0,"base":"USD","date":"2026-08-14","rates":{"VND":26000.00}}'
      };
    }

    if (url.includes('/v1/2026-08-10')) {
      return {
        ok: true,
        text: async () => '{"amount":1.0,"base":"USD","date":"2026-08-11","rates":{"VND":26000.00}}' // Future date
      };
    }
    
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found'
    };
  };

  try {
    const provider = new FrankfurterProvider();
    
    // 1. CSV format test
    const q1 = await provider.getCurrentRate('USD', 'VND');
    assertEqual('CSV exact string parsing', q1.rate, '26316.25');
    assertEqual('CSV date parsing', q1.effectiveDate, '2026-08-28');
    
    // 2. JSON format test
    const q2 = await provider.getCurrentRate('EUR', 'JPY');
    assertEqual('JSON exact string parsing', q2.rate, '159.68');
    
    // 3. Identity conversion
    const q3 = await provider.getCurrentRate('VND', 'VND');
    assertEqual('Identity rate', q3.rate, '1.000000000000');
    
    // 4. Historical weekend lookback (returned 14th for 15th)
    const q4 = await provider.getHistoricalRate('USD', 'VND', '2026-08-15');
    assertEqual('Historical rate', q4.rate, '26000.00');
    assertEqual('Historical requested date', q4.requestedDate, '2026-08-15');
    assertEqual('Historical effective date', q4.effectiveDate, '2026-08-14');
    
    // 5. Future date rejection
    total++;
    try {
      await provider.getHistoricalRate('USD', 'VND', '2026-08-10');
      console.error('✗ FAIL: Future date rejection (Expected to throw)');
    } catch (err) {
      passed++;
      console.log('✓ PASS: Future date rejection');
    }
    
    // 6. Malformed / Missing pair rejected
    total++;
    try {
      await provider.getCurrentRate('BAD', 'VND');
      console.error('✗ FAIL: Missing pair rejected (Expected to throw)');
    } catch (err) {
      passed++;
      console.log('✓ PASS: Missing pair rejected');
    }

    // 7. Provider error (404)
    total++;
    try {
      await provider.getCurrentRate('XYZ', 'VND');
      console.error('✗ FAIL: Provider error (Expected to throw)');
    } catch (err) {
      passed++;
      console.log('✓ PASS: Provider error');
    }
    
  } finally {
    global.fetch = originalFetch;
  }
  
  console.log(`\\nResult: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests().catch(console.error);
