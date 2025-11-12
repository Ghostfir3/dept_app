-- Create loyal_customers table
CREATE TABLE IF NOT EXISTS loyal_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES auth.users(id) NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  addition_type TEXT NOT NULL CHECK (addition_type IN ('auto', 'manual')),
  addition_reason TEXT,
  
  -- Transaction statistics
  weekly_transactions INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  last_transaction_date TIMESTAMP WITH TIME ZONE,
  
  -- Badges
  badge_type TEXT DEFAULT 'none' CHECK (badge_type IN ('gold', 'silver', 'platinum', 'none')),
  average_payment_days NUMERIC,
  fastest_payment_days INTEGER,
  payment_reliability_score NUMERIC DEFAULT 0,
  
  -- General data
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(merchant_id, customer_phone)
);

-- Create indexes for performance
CREATE INDEX idx_loyal_customers_merchant ON loyal_customers(merchant_id);
CREATE INDEX idx_loyal_customers_badge ON loyal_customers(badge_type);
CREATE INDEX idx_loyal_customers_weekly ON loyal_customers(weekly_transactions);
CREATE INDEX idx_loyal_customers_status ON loyal_customers(status);
CREATE INDEX idx_loyal_customers_phone ON loyal_customers(customer_phone);

-- Enable RLS
ALTER TABLE loyal_customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for merchants
CREATE POLICY "Merchants can view their loyal customers"
  ON loyal_customers FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can insert their loyal customers"
  ON loyal_customers FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can update their loyal customers"
  ON loyal_customers FOR UPDATE
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can delete their loyal customers"
  ON loyal_customers FOR DELETE
  USING (merchant_id = auth.uid());

-- Service role bypass policy
CREATE POLICY "Service role can manage all loyal customers"
  ON loyal_customers FOR ALL
  USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_loyal_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER loyal_customers_updated_at
  BEFORE UPDATE ON loyal_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_loyal_customers_updated_at();
