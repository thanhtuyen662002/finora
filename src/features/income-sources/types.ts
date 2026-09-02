import type { IncomeSourceRow, IncomeSourceStreamRow, IncomeSourceType } from '@/types/database';

export type { IncomeSourceRow, IncomeSourceStreamRow, IncomeSourceType };

export type IncomeSourceInsertInput = {
  name: string;
  type: IncomeSourceType;
};

export type IncomeSourceUpdateInput = {
  name?: string;
  type?: IncomeSourceType;
  is_archived?: boolean;
};

export type IncomeSourceStreamInsertInput = {
  income_source_id: string;
  name: string;
};

export type IncomeSourceStreamUpdateInput = {
  name?: string;
  is_archived?: boolean;
};

export type IncomeSourceWithStreams = IncomeSourceRow & {
  streams?: IncomeSourceStreamRow[];
  streamCount?: number;
};

export type IncomeAttributionStreamAggregate = {
  streamId: string | null;
  streamName: string | null;
  currencyCode: string;
  totalAmount: string;
  transactionCount: number;
};

export type IncomeAttributionSourceAggregate = {
  sourceId: string | null;
  sourceName: string | null;
  sourceType: IncomeSourceType | 'UNATTRIBUTED';
  currencyCode: string;
  totalAmount: string;
  transactionCount: number;
  streams: IncomeAttributionStreamAggregate[];
};

export type IncomeAttributionReport = {
  currencyCode: string;
  totalIncome: string;
  sources: IncomeAttributionSourceAggregate[];
};
