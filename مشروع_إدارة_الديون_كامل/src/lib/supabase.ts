import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://srkgtzvgjlysjmkpfaau.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNya2d0enZnamx5c2pta3BmYWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzEzODksImV4cCI6MjA3NzUwNzM4OX0.PhLZzn5pXfxpDj_O7t1lGmLgro8jzK3Eu8jJBZALYfo';

export const supabase = createClient(supabaseUrl, supabaseKey);
export const SUPABASE_URL = supabaseUrl;

export type UserType = 'merchant' | 'customer';
export type DebtStatus = 'pending' | 'disputed' | 'confirmed' | 'paid';

export interface UserProfile {
  id: string;
  phone_number: string;
  full_name: string;
  user_type: UserType;
}

export interface Debt {
  id: string;
  merchant_id: string;
  customer_phone: string;
  customer_name: string;
  amount: number;
  description: string | null;
  due_date: string | null;
  status: DebtStatus;
  created_at: string;
  updated_at?: string;
  paid_amount?: number;
  remaining_amount?: number;
  paid_at?: string;
  // حقول مضافة للعميل
  merchant_name?: string;
  merchant_phone?: string;
  debt_amount?: number;
  display_status?: string;
  days_overdue?: number;
}

export interface Expense {
  id: string;
  merchant_id: string;
  amount: number;
  category: string;
  description: string | null;
  expense_date: string;
  created_at: string;
}

export type BadgeType = 'gold' | 'silver' | 'platinum' | 'none';
export type AdditionType = 'auto' | 'manual';
export type LoyalCustomerStatus = 'active' | 'inactive';

export interface LoyalCustomer {
  id: string;
  merchant_id: string;
  customer_phone: string;
  customer_name: string;
  addition_type: AdditionType;
  addition_reason: string | null;
  weekly_transactions: number;
  total_transactions: number;
  last_transaction_date: string | null;
  badge_type: BadgeType;
  average_payment_days: number | null;
  fastest_payment_days: number | null;
  payment_reliability_score: number;
  status: LoyalCustomerStatus;
  added_at: string;
  updated_at: string;
}

export type DiscountOfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface DiscountOffer {
  id: string;
  merchant_id: string;
  customer_phone: string;
  customer_name: string;
  original_amount: number;
  discount_percentage: number;
  discounted_amount: number;
  savings_amount: number;
  valid_until: string;
  custom_message: string | null;
  status: DiscountOfferStatus;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  expired_at: string | null;
  cancelled_at: string | null;
  merchant_notes: string | null;
  customer_rejection_reason: string | null;
}

export interface PaymentTransaction {
  id: string;
  merchant_id: string;
  customer_phone: string;
  customer_name: string;
  total_amount: number;
  payment_method: string;
  notes: string | null;
  debts_paid: any;
  created_at: string;
}
