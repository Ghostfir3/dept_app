-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  debts_paid JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_payment_transactions_merchant ON payment_transactions(merchant_id);
CREATE INDEX idx_payment_transactions_customer ON payment_transactions(customer_phone);
CREATE INDEX idx_payment_transactions_created ON payment_transactions(created_at);

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Merchants can view their payment transactions"
  ON payment_transactions FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can create payment transactions"
  ON payment_transactions FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Customers can view their payment transactions"
  ON payment_transactions FOR SELECT
  USING (
    customer_phone IN (
      SELECT phone_number FROM users_profile WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all payment transactions"
  ON payment_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- Add columns to debts table
ALTER TABLE debts ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC;

-- Update existing debts to set remaining_amount
UPDATE debts SET remaining_amount = amount - COALESCE(paid_amount, 0) WHERE remaining_amount IS NULL;
