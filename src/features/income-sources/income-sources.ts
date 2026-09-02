import { createClient } from '@/lib/supabase/client';
import type { IncomeSourceRow, IncomeSourceStreamRow } from '@/types/database';
import {
  isValidIncomeSourceType,
  validateIncomeSourceName,
  validateIncomeSourceStreamName,
} from './domain';
import type {
  IncomeSourceInsertInput,
  IncomeSourceStreamInsertInput,
  IncomeSourceStreamUpdateInput,
  IncomeSourceUpdateInput,
  IncomeSourceWithStreams,
} from './types';

/**
 * Fetch all income sources for the authenticated user.
 */
export async function getIncomeSources(options?: {
  includeArchived?: boolean;
}): Promise<IncomeSourceRow[]> {
  const supabase = createClient();
  let query = supabase.from('income_sources').select('*');

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query
    .order('is_archived', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch income sources: ${error.message}`);
  }
  return data || [];
}

/**
 * Fetch a single income source by ID.
 */
export async function getIncomeSource(id: string): Promise<IncomeSourceRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('income_sources')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch income source: ${error.message}`);
  }
  return data;
}

/**
 * Create a new income source.
 * Database derives user_id from auth.uid().
 */
export async function createIncomeSource(
  input: IncomeSourceInsertInput
): Promise<IncomeSourceRow> {
  const nameValidation = validateIncomeSourceName(input.name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error);
  }

  if (!isValidIncomeSourceType(input.type)) {
    throw new Error(`Invalid income source type: ${input.type}`);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('income_sources')
    .insert({
      name: input.name.trim(),
      type: input.type,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create income source: ${error.message}`);
  }
  return data;
}

/**
 * Update an existing income source.
 */
export async function updateIncomeSource(
  id: string,
  updates: IncomeSourceUpdateInput
): Promise<IncomeSourceRow> {
  const payload: { name?: string; type?: IncomeSourceInsertInput['type']; is_archived?: boolean } = {};

  if (updates.name !== undefined) {
    const nameValidation = validateIncomeSourceName(updates.name);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }
    payload.name = updates.name.trim();
  }

  if (updates.type !== undefined) {
    if (!isValidIncomeSourceType(updates.type)) {
      throw new Error(`Invalid income source type: ${updates.type}`);
    }
    payload.type = updates.type;
  }

  if (updates.is_archived !== undefined) {
    payload.is_archived = updates.is_archived;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('income_sources')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update income source: ${error.message}`);
  }
  return data;
}

/**
 * Archive an income source.
 */
export async function archiveIncomeSource(id: string): Promise<IncomeSourceRow> {
  return updateIncomeSource(id, { is_archived: true });
}

/**
 * Unarchive an income source.
 */
export async function unarchiveIncomeSource(id: string): Promise<IncomeSourceRow> {
  return updateIncomeSource(id, { is_archived: false });
}

/**
 * Fetch all streams for an income source or all streams of user.
 */
export async function getIncomeSourceStreams(
  sourceId?: string,
  options?: { includeArchived?: boolean }
): Promise<IncomeSourceStreamRow[]> {
  const supabase = createClient();
  let query = supabase.from('income_source_streams').select('*');

  if (sourceId) {
    query = query.eq('income_source_id', sourceId);
  }

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query
    .order('is_archived', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch income source streams: ${error.message}`);
  }
  return data || [];
}

/**
 * Fetch income sources with their active streams nested.
 */
export async function getIncomeSourcesWithStreams(options?: {
  includeArchived?: boolean;
}): Promise<IncomeSourceWithStreams[]> {
  const [sources, streams] = await Promise.all([
    getIncomeSources(options),
    getIncomeSourceStreams(undefined, options),
  ]);

  const streamsBySource = new Map<string, IncomeSourceStreamRow[]>();
  for (const stream of streams) {
    const list = streamsBySource.get(stream.income_source_id) || [];
    list.push(stream);
    streamsBySource.set(stream.income_source_id, list);
  }

  return sources.map((source) => {
    const sourceStreams = streamsBySource.get(source.id) || [];
    return {
      ...source,
      streams: sourceStreams,
      streamCount: sourceStreams.length,
    };
  });
}

/**
 * Create a new income source stream.
 * Database derives user_id from auth.uid().
 */
export async function createIncomeSourceStream(
  input: IncomeSourceStreamInsertInput
): Promise<IncomeSourceStreamRow> {
  if (!input.income_source_id || input.income_source_id.trim().length === 0) {
    throw new Error('Parent income source ID is required');
  }

  const nameValidation = validateIncomeSourceStreamName(input.name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('income_source_streams')
    .insert({
      income_source_id: input.income_source_id,
      name: input.name.trim(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create income source stream: ${error.message}`);
  }
  return data;
}

/**
 * Update an existing income source stream.
 * Note: income_source_id is immutable after creation.
 */
export async function updateIncomeSourceStream(
  id: string,
  updates: IncomeSourceStreamUpdateInput
): Promise<IncomeSourceStreamRow> {
  const payload: { name?: string; is_archived?: boolean } = {};

  if (updates.name !== undefined) {
    const nameValidation = validateIncomeSourceStreamName(updates.name);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }
    payload.name = updates.name.trim();
  }

  if (updates.is_archived !== undefined) {
    payload.is_archived = updates.is_archived;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('income_source_streams')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update income source stream: ${error.message}`);
  }
  return data;
}

/**
 * Archive an income source stream.
 */
export async function archiveIncomeSourceStream(id: string): Promise<IncomeSourceStreamRow> {
  return updateIncomeSourceStream(id, { is_archived: true });
}

/**
 * Unarchive an income source stream.
 */
export async function unarchiveIncomeSourceStream(id: string): Promise<IncomeSourceStreamRow> {
  return updateIncomeSourceStream(id, { is_archived: false });
}
