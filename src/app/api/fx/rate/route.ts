import { NextResponse } from 'next/server';
import { defaultFxProvider } from '@/lib/exchange-rate';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const date = searchParams.get('date');

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from or to currency' }, { status: 400 });
  }

  // Validate currency codes
  const CURRENCY_PATTERN = /^[A-Z]{3,5}$/;
  if (!CURRENCY_PATTERN.test(from) || !CURRENCY_PATTERN.test(to)) {
    return NextResponse.json({ error: 'Invalid currency code format' }, { status: 400 });
  }

  try {
    let quote;
    if (date) {
      // Validate date
      const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
      if (!DATE_PATTERN.test(date)) {
        return NextResponse.json({ error: 'Invalid date format, expected YYYY-MM-DD' }, { status: 400 });
      }
      quote = await defaultFxProvider.getHistoricalRate(from, to, date);
    } else {
      quote = await defaultFxProvider.getCurrentRate(from, to);
    }

    return NextResponse.json(quote);
  } catch (err: any) {
    console.error('FX Provider Error:', err);
    // Return 502 Bad Gateway for provider failures
    return NextResponse.json({ error: 'Provider unavailable', details: err.message }, { status: 502 });
  }
}
