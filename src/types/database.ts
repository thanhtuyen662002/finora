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
      transaction_fx_snapshots: {
        Row: {
          id: string;
          user_id: string;
          transaction_id: string;
          source_currency_code: string;
          target_currency_code: string;
          source_amount: string;
          rate: string;
          converted_amount: string;
          requested_date: string;
          effective_date: string;
          provider: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          transaction_id: string;
          source_currency_code: string;
          target_currency_code: string;
          source_amount: string;
          rate: string;
          converted_amount: string;
          requested_date: string;
          effective_date: string;
          provider: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transaction_id?: string;
          source_currency_code?: string;
          target_currency_code?: string;
          source_amount?: string;
          rate?: string;
          converted_amount?: string;
          requested_date?: string;
          effective_date?: string;
          provider?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_fx_snapshots_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          }
        ];
      };
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
          auto_fx_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          base_currency?: string;
          locale?: string;
          timezone?: string;
          theme?: 'light' | 'dark' | 'system';
          auto_fx_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          base_currency?: string;
          locale?: string;
          timezone?: string;
          theme?: 'light' | 'dark' | 'system';
          auto_fx_enabled?: boolean;
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
          amount: string;
          currency_code: string;
          merchant: string;
          note: string | null;
          occurred_on: string;
          is_voided: boolean;
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
          is_voided?: boolean;
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
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transfers: {
        Row: {
          id: string;
          user_id: string;
          from_account_id: string;
          to_account_id: string;
          amount: string;
          currency_code: string;
          note: string | null;
          occurred_on: string;
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          from_account_id: string;
          to_account_id: string;
          amount: string;
          currency_code: string;
          note?: string | null;
          occurred_on?: string;
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          from_account_id?: string;
          to_account_id?: string;
          amount?: string;
          currency_code?: string;
          note?: string | null;
          occurred_on?: string;
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          category_type: 'EXPENSE';
          limit_amount: string;
          currency_code: string;
          period_month: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          category_id: string;
          category_type?: 'EXPENSE';
          limit_amount: string;
          currency_code: string;
          period_month: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          category_type?: 'EXPENSE';
          limit_amount?: string;
          currency_code?: string;
          period_month?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: string;
          current_amount: string;
          monthly_contribution: string;
          currency_code: string;
          target_date: string | null;
          category: string;
          icon: string;
          color: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          target_amount: string;
          current_amount?: string;
          monthly_contribution?: string;
          currency_code: string;
          target_date?: string | null;
          category?: string;
          icon?: string;
          color?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          target_amount?: string;
          current_amount?: string;
          monthly_contribution?: string;
          currency_code?: string;
          target_date?: string | null;
          category?: string;
          icon?: string;
          color?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_items: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string;
          transaction_type: 'INCOME' | 'EXPENSE';
          name: string;
          amount: string;
          currency_code: string;
          frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
          anchor_date: string;
          end_date: string | null;
          note: string | null;
          is_paused: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          category_id: string;
          transaction_type: 'INCOME' | 'EXPENSE';
          name: string;
          amount: string;
          currency_code: string;
          frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
          anchor_date: string;
          end_date?: string | null;
          note?: string | null;
          is_paused?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          category_id?: string;
          transaction_type?: 'INCOME' | 'EXPENSE';
          name?: string;
          amount?: string;
          currency_code?: string;
          frequency?: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
          anchor_date?: string;
          end_date?: string | null;
          note?: string | null;
          is_paused?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      transaction_fx_snapshot_details: {
        Row: {
          id: string;
          user_id: string;
          transaction_id: string;
          source_currency_code: string;
          target_currency_code: string;
          source_amount: string;
          rate: string;
          converted_amount: string;
          requested_date: string;
          effective_date: string;
          provider: string;
          created_at: string;
        };
        Relationships: [];
      };
      account_balances: {
        Row: {
          account_id: string;
          user_id: string;
          current_balance: string;
          currency_code: string;
        };
        Relationships: [];
      };
      transaction_details: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string;
          type: 'INCOME' | 'EXPENSE';
          amount: string;
          currency_code: string;
          merchant: string;
          note: string | null;
          occurred_on: string;
          is_voided: boolean;
          created_at: string;
          updated_at: string;
          account_name: string;
          category_name: string;
          category_icon: string;
          category_color: string;
        };
        Relationships: [];
      };
      transfer_details: {
        Row: {
          id: string;
          user_id: string;
          from_account_id: string;
          to_account_id: string;
          amount: string;
          currency_code: string;
          note: string | null;
          occurred_on: string;
          is_voided: boolean;
          created_at: string;
          updated_at: string;
          from_account_name: string;
          from_account_type: string;
          from_account_color: string;
          to_account_name: string;
          to_account_type: string;
          to_account_color: string;
        };
        Relationships: [];
      };
      budget_progress: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          category_name: string;
          category_icon: string;
          category_color: string;
          limit_amount: string;
          spent_amount: string;
          currency_code: string;
          period_month: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
      goal_details: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: string;
          current_amount: string;
          monthly_contribution: string;
          currency_code: string;
          target_date: string | null;
          category: string;
          icon: string;
          color: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
      recurring_details: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          account_name: string;
          account_color: string;
          category_id: string;
          category_name: string;
          category_icon: string;
          category_color: string;
          transaction_type: 'INCOME' | 'EXPENSE';
          name: string;
          amount: string;
          currency_code: string;
          frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
          anchor_date: string;
          end_date: string | null;
          note: string | null;
          is_paused: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
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
export type TransactionDetailRow = Database['public']['Views']['transaction_details']['Row'];

export type TransferRow = Database['public']['Tables']['transfers']['Row'];
export type TransferInsert = Omit<Database['public']['Tables']['transfers']['Insert'], 'id' | 'created_at' | 'updated_at'>;
export type TransferUpdate = Omit<Database['public']['Tables']['transfers']['Update'], 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type TransferDetailRow = Database['public']['Views']['transfer_details']['Row'];

export type BudgetRow = Database['public']['Tables']['budgets']['Row'];
export type BudgetInsert = Omit<Database['public']['Tables']['budgets']['Insert'], 'id' | 'created_at' | 'updated_at'>;
export type BudgetUpdate = Omit<Database['public']['Tables']['budgets']['Update'], 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type BudgetProgressRow = Database['public']['Views']['budget_progress']['Row'];

export type GoalRow = Database['public']['Tables']['goals']['Row'];
export type GoalInsert = Omit<Database['public']['Tables']['goals']['Insert'], 'id' | 'created_at' | 'updated_at'>;
export type GoalUpdate = Omit<Database['public']['Tables']['goals']['Update'], 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type GoalDetailRow = Database['public']['Views']['goal_details']['Row'];
export type GoalDetailsRow = GoalDetailRow;

export type RecurringFrequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RecurringItemRow = Database['public']['Tables']['recurring_items']['Row'];
export type RecurringItemInsert = Omit<Database['public']['Tables']['recurring_items']['Insert'], 'id' | 'created_at' | 'updated_at'>;
export type RecurringItemUpdate = Omit<Database['public']['Tables']['recurring_items']['Update'], 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type RecurringDetailRow = Database['public']['Views']['recurring_details']['Row'];
export type RecurringDetailsRow = RecurringDetailRow;
