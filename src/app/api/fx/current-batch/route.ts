import { NextResponse } from 'next/server';
import { defaultFxProvider } from '@/lib/exchange-rate';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { targetCurrency, sourceCurrencies } = body;

  if (!targetCurrency || !Array.isArray(sourceCurrencies)) {
    return NextResponse.json({ error: 'targetCurrency and sourceCurrencies array are required' }, { status: 400 });
  }

  const CURRENCY_PATTERN = /^[A-Z]{3,5}$/;
  if (!CURRENCY_PATTERN.test(targetCurrency)) {
    return NextResponse.json({ error: 'Invalid targetCurrency format' }, { status: 400 });
  }

  // Deduplicate and limit
  const uniqueSources = Array.from(new Set(sourceCurrencies)).filter(c => typeof c === 'string' && CURRENCY_PATTERN.test(c));
  if (uniqueSources.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 distinct source currencies allowed' }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      uniqueSources.map(async (source) => {
        const quote = await defaultFxProvider.getCurrentRate(source, targetCurrency);
        return { source, quote };
      })
    );
    
    // Return complete success only if all required non-identity rates are available
    // Promise.all will reject if any fails, so we only reach here if all succeed.
    
    const ratesMap = Object.fromEntries(results.map(r => [r.source, r.quote]));
    
    return NextResponse.json({ targetCurrency, rates: ratesMap });
  } catch (err: any) {
    console.error('FX Batch Provider Error:', err);
    return NextResponse.json({ error: 'One or more required rates could not be resolved', details: err.message }, { status: 502 });
  }
}
