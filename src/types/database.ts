export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          base_currency: string;
          locale: string;
          timezone: string;
          theme: 'light' | 'dark' | 'system';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          base_currency?: string;
          locale?: string;
          timezone?: string;
          theme?: 'light' | 'dark' | 'system';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          base_currency?: string;
          locale?: string;
          timezone?: string;
          theme?: 'light' | 'dark' | 'system';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          currency_code: string;
          opening_balance: number;
          institution: string | null;
          color: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: string;
          currency_code: string;
          opening_balance?: number | string;
          institution?: string | null;
          color?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          currency_code?: string;
          opening_balance?: number | string;
          institution?: string | null;
          color?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          icon: string;
          color: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: string;
          icon: string;
          color: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          icon?: string;
          color?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string;
          type: 'INCOME' | 'EXPENSE';
          amount: number;
          currency_code: string;
          merchant: string;
          note: string | null;
          occurred_on: string;
          is_voided?: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          category_id: string;
          type: 'INCOME' | 'EXPENSE';
          amount: number | string;
          currency_code: string;
          merchant: string;
          note?: string | null;
          occurred_on?: string;
          
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          category_id?: string;
          type?: 'INCOME' | 'EXPENSE';
          amount?: number | string;
          currency_code?: string;
          merchant?: string;
          note?: string | null;
          occurred_on?: string;
          
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      account_balances: {
        Row: {
          account_id: string;
          user_id: string;
          current_balance: string;
          currency_code: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update'];

export type AccountRow = Database['public']['Tables']['accounts']['Row'];
export type AccountInsert = Omit<Database['public']['Tables']['accounts']['Insert'], 'id' | 'created_at' | 'updated_at'>;
export type AccountUpdate = Omit<Database['public']['Tables']['accounts']['Update'], 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export type CategoryRow = Database['public']['Tables']['categories']['Row'];
export type CategoryInsert = Omit<Database['public']['Tables']['categories']['Insert'], 'id' | 'created_at' | 'updated_at'>;
export type CategoryUpdate = Omit<Database['public']['Tables']['categories']['Update'], 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export type AccountType = 'CASH' | 'BANK' | 'EWALLET' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'OTHER';
export type CategoryType = 'INCOME' | 'EXPENSE';

export type TransactionRow = Database['public']['Tables']['transactions']['Row'];
export type TransactionInsert = Omit<Database['public']['Tables']['transactions']['Insert'], 'id' | 'created_at' | 'updated_at'>;
export type TransactionUpdate = Omit<Database['public']['Tables']['transactions']['Update'], 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type AccountBalanceRow = Database['public']['Views']['account_balances']['Row'];
