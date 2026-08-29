import { NextResponse } from 'next/server';
import { defaultFxProvider, convertExactAmount } from '@/lib/exchange-rate';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toExactDecimal } from '@/lib/money';

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

  const { targetCurrency, transactionIds } = body;

  if (!targetCurrency || !Array.isArray(transactionIds)) {
    return NextResponse.json({ error: 'targetCurrency and transactionIds array are required' }, { status: 400 });
  }

  if (transactionIds.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 transaction IDs per request' }, { status: 400 });
  }

  const CURRENCY_PATTERN = /^[A-Z]{3,5}$/;
  if (!CURRENCY_PATTERN.test(targetCurrency)) {
    return NextResponse.json({ error: 'Invalid targetCurrency format' }, { status: 400 });
  }

  if (transactionIds.length === 0) {
    return NextResponse.json({ snapshots: [] });
  }

  try {
    // Read only that user's transactions via exact-text view
    const { data: transactions, error: txError } = await supabase
      .from('transaction_details')
      .select('id, amount, currency_code, occurred_on')
      .in('id', transactionIds);

    if (txError) throw txError;

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ snapshots: [] });
    }

    const adminSupabase = createAdminClient();
    const snapshots = [];
    const missingSnapshots: any[] = [];

    // Group transactions by identity vs foreign
    for (const tx of transactions) {
      if (tx.currency_code === targetCurrency) {
        snapshots.push({
          transaction_id: tx.id,
          source_currency_code: tx.currency_code,
          target_currency_code: targetCurrency,
          source_amount: tx.amount,
          rate: '1.000000000000',
          converted_amount: tx.amount,
          requested_date: tx.occurred_on,
          effective_date: tx.occurred_on,
          provider: 'IDENTITY'
        });
      } else {
        missingSnapshots.push(tx);
      }
    }

    if (missingSnapshots.length > 0) {
      // Look for immutable snapshot matching the CURRENT transaction version fields
      const { data: existingSnapshots, error: snapError } = await adminSupabase
        .from('transaction_fx_snapshot_details')
        .select('*')
        .eq('user_id', user.id)
        .eq('target_currency_code', targetCurrency)
        .in('transaction_id', missingSnapshots.map(t => t.id));

      if (snapError) throw snapError;

      const txToFetch = [];

      for (const tx of missingSnapshots) {
        const exactTxAmount = toExactDecimal(tx.amount);
        
        const match = (existingSnapshots as any[])?.find(s => 
          s.transaction_id === tx.id &&
          s.source_currency_code === tx.currency_code &&
          s.target_currency_code === targetCurrency &&
          s.source_amount === exactTxAmount &&
          s.requested_date === tx.occurred_on
        );

        if (match) {
          snapshots.push({
            transaction_id: match.transaction_id,
            source_currency_code: match.source_currency_code,
            target_currency_code: match.target_currency_code,
            source_amount: match.source_amount,
            rate: match.rate,
            converted_amount: match.converted_amount,
            requested_date: match.requested_date,
            effective_date: match.effective_date,
            provider: match.provider
          });
        } else {
          txToFetch.push(tx);
        }
      }

      if (txToFetch.length > 0) {
        const uniqueRequests = new Map();
        for (const tx of txToFetch) {
          const key = `${tx.currency_code}_${tx.occurred_on}`;
          if (!uniqueRequests.has(key)) {
            uniqueRequests.set(key, { source: tx.currency_code, date: tx.occurred_on, txs: [] });
          }
          uniqueRequests.get(key).txs.push(tx);
        }

        const fetchPromises = Array.from(uniqueRequests.values()).map(async (req) => {
          const quote = await defaultFxProvider.getHistoricalRate(req.source, targetCurrency, req.date);
          return { req, quote };
        });

        const fetchedRates = await Promise.all(fetchPromises);
        const newSnapshots = [];

        for (const { req, quote } of fetchedRates) {
          for (const tx of req.txs) {
            const exactTxAmount = toExactDecimal(tx.amount);
            const convertedAmount = convertExactAmount(exactTxAmount, quote.rate);
            
            newSnapshots.push({
              user_id: user.id,
              transaction_id: tx.id,
              source_currency_code: tx.currency_code,
              target_currency_code: targetCurrency,
              source_amount: exactTxAmount,
              rate: quote.rate,
              converted_amount: convertedAmount,
              requested_date: tx.occurred_on,
              effective_date: quote.effectiveDate,
              provider: quote.provider
            });
          }
        }

        if (newSnapshots.length > 0) {
          const { error: insertError } = await adminSupabase
            .from('transaction_fx_snapshots')
            .insert(newSnapshots);

          if (insertError && insertError.code !== '23505') {
            throw insertError;
          }

          // Re-read inserted/raced snapshots from exact view
          const { data: finalSnapshots, error: readError } = await adminSupabase
            .from('transaction_fx_snapshot_details')
            .select('*')
            .eq('user_id', user.id)
            .eq('target_currency_code', targetCurrency)
            .in('transaction_id', newSnapshots.map(n => n.transaction_id));

          if (readError) throw readError;

          if (finalSnapshots) {
            for (const n of newSnapshots) {
              const s = (finalSnapshots as any[]).find(s => 
                s.transaction_id === n.transaction_id &&
                s.source_currency_code === n.source_currency_code &&
                s.target_currency_code === n.target_currency_code &&
                s.source_amount === n.source_amount &&
                s.requested_date === n.requested_date
              );
              if (s) {
                snapshots.push({
                  transaction_id: s.transaction_id,
                  source_currency_code: s.source_currency_code,
                  target_currency_code: s.target_currency_code,
                  source_amount: s.source_amount,
                  rate: s.rate,
                  converted_amount: s.converted_amount,
                  requested_date: s.requested_date,
                  effective_date: s.effective_date,
                  provider: s.provider
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ snapshots });

  } catch (err: any) {
    console.error('Snapshot API Error:', err);
    return NextResponse.json({ error: 'Failed to process historical snapshots' }, { status: 502 });
  }
}
