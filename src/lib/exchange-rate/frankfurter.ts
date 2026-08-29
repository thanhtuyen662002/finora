import { toExactRate } from './fx-math';
import { ExchangeRateProvider, ExchangeRateQuote } from './types';

export class FrankfurterProvider implements ExchangeRateProvider {
  private readonly baseUrl = 'https://api.frankfurter.dev';

  async getCurrentRate(sourceCurrency: string, targetCurrency: string): Promise<ExchangeRateQuote> {
    if (sourceCurrency === targetCurrency) {
      return {
        sourceCurrency,
        targetCurrency,
        rate: '1.000000000000',
        requestedDate: null,
        effectiveDate: new Date().toISOString().split('T')[0],
        provider: 'FRANKFURTER_V2',
        fetchedAt: new Date().toISOString()
      };
    }
    const url = `${this.baseUrl}/v2/rates.csv?base=${sourceCurrency}&quotes=${targetCurrency}`;
    return this.fetchAndParse(url, sourceCurrency, targetCurrency, null, null);
  }

  async getHistoricalRate(sourceCurrency: string, targetCurrency: string, requestedDate: string): Promise<ExchangeRateQuote> {
    if (sourceCurrency === targetCurrency) {
      return {
        sourceCurrency,
        targetCurrency,
        rate: '1.000000000000',
        requestedDate,
        effectiveDate: requestedDate,
        provider: 'FRANKFURTER_V2',
        fetchedAt: new Date().toISOString()
      };
    }

    const reqDate = new Date(requestedDate);
    if (isNaN(reqDate.getTime())) {
      throw new Error(`Invalid requestedDate: ${requestedDate}`);
    }
    
    // Future date check
    const today = new Date().toISOString().split('T')[0];
    if (requestedDate > today) {
      throw new Error('Future effective date rejected');
    }

    const startDateObj = new Date(reqDate);
    startDateObj.setDate(startDateObj.getDate() - 7);
    const startDate = startDateObj.toISOString().split('T')[0];

    const url = `${this.baseUrl}/v2/rates.csv?base=${sourceCurrency}&quotes=${targetCurrency}&from=${startDate}&to=${requestedDate}`;
    return this.fetchAndParse(url, sourceCurrency, targetCurrency, requestedDate, startDate);
  }

  private async fetchAndParse(url: string, sourceCurrency: string, targetCurrency: string, requestedDate: string | null, startDate: string | null = null): Promise<ExchangeRateQuote> {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/csv'
      }
    });

    if (!response.ok) {
      throw new Error(`Provider API error: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.trim().split('\n');
    
    // Format is assumed to be date,base,quote,rate or similar.
    // Let's parse header
    if (lines.length < 2) {
      throw new Error('Provider returned no data');
    }
    
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const dateIdx = headers.indexOf('date');
    const baseIdx = headers.indexOf('base');
    const quoteIdx = headers.indexOf('quote');
    const rateIdx = headers.indexOf('rate');

    if (dateIdx === -1 || baseIdx === -1 || quoteIdx === -1 || rateIdx === -1) {
      throw new Error('Malformed CSV headers from provider');
    }

    let latestValidRow: { date: string, rate: string } | null = null;

    // Search from end (latest first) to start
    for (let i = lines.length - 1; i >= 1; i--) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length < Math.max(dateIdx, baseIdx, quoteIdx, rateIdx) + 1) continue;

      const rDate = parts[dateIdx];
      const rBase = parts[baseIdx];
      const rQuote = parts[quoteIdx];
      const rRate = parts[rateIdx];

      if (rBase !== sourceCurrency || rQuote !== targetCurrency) continue;
      
      // If requestedDate provided, must be <= requestedDate
      if (requestedDate && rDate > requestedDate) continue;
      
      if (!latestValidRow || rDate > latestValidRow.date) {
        latestValidRow = { date: rDate, rate: rRate };
      }
    }

    if (!latestValidRow) {
      throw new Error('Rate not found in provider response window');
    }

    if (startDate && latestValidRow.date < startDate) {
      throw new Error('Rate not found in provider response window');
    }
    
    if (requestedDate && latestValidRow.date > requestedDate) {
      throw new Error('Provider returned a future effective date');
    }

    return {
      sourceCurrency,
      targetCurrency,
      rate: toExactRate(latestValidRow.rate),
      requestedDate,
      effectiveDate: latestValidRow.date,
      provider: 'FRANKFURTER_V2',
      fetchedAt: new Date().toISOString()
    };
  }
}
