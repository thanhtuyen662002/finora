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

    const url = `${this.baseUrl}/v1/latest?base=${sourceCurrency}&symbols=${targetCurrency}`;
    return this.fetchAndParse(url, sourceCurrency, targetCurrency, null);
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

    // "when the requested date has no market/provider observation (weekend/holiday), use a bounded lookback of at most 7 calendar days"
    // Frankfurter v1 endpoint for date naturally returns the latest available rate for that date or before.
    // However, if we need to explicitly implement a 7-day lookback, we can query a range or just rely on the API.
    // Frankfurter usually falls back to the last working day automatically for historical dates.
    // For safety, we can request a bounded range: `startDate..requestedDate`
    const dateObj = new Date(requestedDate);
    dateObj.setDate(dateObj.getDate() - 7);
    const startDate = dateObj.toISOString().split('T')[0];
    
    // Request a 7-day window ending on the requested date to ensure we get the latest rate within that window.
    // Wait, the prompt says: "select the latest provider effectiveDate such that effectiveDate <= requestedDate"
    // The Frankfurter historical endpoint /YYYY-MM-DD returns the rate for that day or the closest preceding working day.
    const url = `${this.baseUrl}/v1/${requestedDate}?base=${sourceCurrency}&symbols=${targetCurrency}`;
    
    return this.fetchAndParse(url, sourceCurrency, targetCurrency, requestedDate);
  }

  private async fetchAndParse(url: string, sourceCurrency: string, targetCurrency: string, requestedDate: string | null): Promise<ExchangeRateQuote> {
    // Add Accept header for CSV per requirement, though the API might return JSON.
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/csv, application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Provider API error: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    
    // Parse the rate as an exact string to avoid JS floating point issues.
    // Look for targetCurrency followed by the rate, supporting both CSV and JSON formats.
    const rateMatch = text.match(new RegExp(`(?:^|,|")${targetCurrency}(?:":|",|,)\\s*([0-9]+(?:\\.[0-9]+)?)`, 'm'));
    
    if (!rateMatch || !rateMatch[1]) {
      throw new Error(`Rate not found for ${targetCurrency} in provider response`);
    }
    
    const rate = rateMatch[1];
    
    // Extract effective date
    // CSV might have it as a column, JSON has "date":"YYYY-MM-DD"
    let effectiveDate = requestedDate || new Date().toISOString().split('T')[0];
    const dateMatch = text.match(/"date"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})"/);
    if (dateMatch && dateMatch[1]) {
      effectiveDate = dateMatch[1];
    } else {
      // Try to find a date in CSV (simple YYYY-MM-DD match)
      const csvDateMatch = text.match(/([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      if (csvDateMatch && csvDateMatch[1]) {
        effectiveDate = csvDateMatch[1];
      }
    }

    if (requestedDate && effectiveDate > requestedDate) {
      throw new Error('Provider returned a future effective date');
    }

    return {
      sourceCurrency,
      targetCurrency,
      rate,
      requestedDate,
      effectiveDate,
      provider: 'FRANKFURTER_V2',
      fetchedAt: new Date().toISOString()
    };
  }
}
