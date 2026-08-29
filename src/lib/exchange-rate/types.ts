export interface ExchangeRateQuote {
  sourceCurrency: string;
  targetCurrency: string;
  rate: string;
  requestedDate: string | null;
  effectiveDate: string;
  provider: string;
  fetchedAt: string;
}

export interface ExchangeRateProvider {
  getCurrentRate(sourceCurrency: string, targetCurrency: string): Promise<ExchangeRateQuote>;
  getHistoricalRate(sourceCurrency: string, targetCurrency: string, requestedDate: string): Promise<ExchangeRateQuote>;
}
