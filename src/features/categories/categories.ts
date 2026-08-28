import { createClient } from '@/lib/supabase/client';
import type { CategoryInsert, CategoryRow, CategoryUpdate } from '@/types/database';

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

export async function createCategory(category: Omit<CategoryInsert, 'user_id'>): Promise<CategoryRow> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('User must be authenticated to create a category');
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      ...category,
      user_id: authData.user.id,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function updateCategory(id: string, updates: CategoryUpdate): Promise<CategoryRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}
