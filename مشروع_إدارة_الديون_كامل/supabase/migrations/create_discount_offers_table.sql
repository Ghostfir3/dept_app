-- Create discount_offers table
CREATE TABLE IF NOT EXISTS discount_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES auth.users(id) NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  
  -- Offer details
  original_amount NUMERIC NOT NULL CHECK (original_amount > 0),
  discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  discounted_amount NUMERIC NOT NULL CHECK (discounted_amount >= 0),
  savings_amount NUMERIC NOT NULL CHECK (savings_amount >= 0),
  
  -- Validity and message
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  custom_message TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  
  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Notes
  merchant_notes TEXT,
  customer_rejection_reason TEXT
);

-- Create indexes for performance
CREATE INDEX idx_discount_offers_merchant ON discount_offers(merchant_id);
CREATE INDEX idx_discount_offers_customer ON discount_offers(customer_phone);
CREATE INDEX idx_discount_offers_status ON discount_offers(status);
CREATE INDEX idx_discount_offers_valid ON discount_offers(valid_until);
CREATE INDEX idx_discount_offers_created ON discount_offers(created_at);

-- Enable RLS
ALTER TABLE discount_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for merchants
CREATE POLICY "Merchants can view their discount offers"
  ON discount_offers FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can create discount offers"
  ON discount_offers FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can update their discount offers"
  ON discount_offers FOR UPDATE
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can delete their discount offers"
  ON discount_offers FOR DELETE
  USING (merchant_id = auth.uid());

-- RLS Policies for customers (they can view and respond to their offers)
CREATE POLICY "Customers can view their discount offers"
  ON discount_offers FOR SELECT
  USING (
    customer_phone IN (
      SELECT phone_number FROM users_profile WHERE id = auth.uid()
    )
  );

CREATE POLICY "Customers can update their discount offers"
  ON discount_offers FOR UPDATE
  USING (
    customer_phone IN (
      SELECT phone_number FROM users_profile WHERE id = auth.uid()
    )
  );

-- Service role bypass policy
CREATE POLICY "Service role can manage all discount offers"
  ON discount_offers FOR ALL
  USING (auth.role() = 'service_role');
