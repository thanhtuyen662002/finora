import { FrankfurterProvider } from './frankfurter';
import { ExchangeRateProvider, ExchangeRateQuote } from './types';

export * from './types';
export * from './fx-math';
export * from './frankfurter';

// The default provider
export const defaultFxProvider: ExchangeRateProvider = new FrankfurterProvider();
