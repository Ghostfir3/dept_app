-- نظام إدارة الديون الاحترافي - قاعدة البيانات

-- إضافة enum للأنواع
CREATE TYPE user_type AS ENUM ('merchant', 'customer');
CREATE TYPE debt_status AS ENUM ('pending', 'disputed', 'confirmed', 'paid');
CREATE TYPE dispute_status AS ENUM ('pending', 'resolved', 'dismissed');

-- جدول ملفات المستخدمين
CREATE TABLE IF NOT EXISTS users_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    user_type user_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الديون
CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    due_date DATE,
    status debt_status DEFAULT 'pending',
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول المدفوعات
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(100),
    transaction_reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الاعتراضات
CREATE TABLE IF NOT EXISTS debt_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    disputed_by_customer BOOLEAN DEFAULT true,
    status dispute_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes للأداء
CREATE INDEX idx_debts_merchant ON debts(merchant_id);
CREATE INDEX idx_debts_customer_phone ON debts(customer_phone);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_debts_due_date ON debts(due_date);
CREATE INDEX idx_payments_debt ON payments(debt_id);
CREATE INDEX idx_disputes_debt ON debt_disputes(debt_id);
CREATE INDEX idx_disputes_status ON debt_disputes(status);

-- Enable Row Level Security
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_disputes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users_profile
CREATE POLICY "Users can view their own profile"
    ON users_profile FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON users_profile FOR UPDATE
    USING (auth.uid() = id);

-- RLS Policies for debts
CREATE POLICY "Merchants can view their debts"
    ON debts FOR SELECT
    USING (
        merchant_id = auth.uid() OR
        customer_phone IN (
            SELECT phone_number FROM users_profile WHERE id = auth.uid()
        )
    );

CREATE POLICY "Merchants can create debts"
    ON debts FOR INSERT
    WITH CHECK (
        merchant_id = auth.uid() AND
        EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND user_type = 'merchant')
    );

CREATE POLICY "Merchants can update their debts"
    ON debts FOR UPDATE
    USING (merchant_id = auth.uid());

-- RLS Policies for payments
CREATE POLICY "View payments for related debts"
    ON payments FOR SELECT
    USING (
        debt_id IN (
            SELECT id FROM debts WHERE
            merchant_id = auth.uid() OR
            customer_phone IN (SELECT phone_number FROM users_profile WHERE id = auth.uid())
        )
    );

CREATE POLICY "Create payments for related debts"
    ON payments FOR INSERT
    WITH CHECK (
        debt_id IN (
            SELECT id FROM debts WHERE
            merchant_id = auth.uid() OR
            customer_phone IN (SELECT phone_number FROM users_profile WHERE id = auth.uid())
        )
    );

-- RLS Policies for debt_disputes
CREATE POLICY "View disputes for related debts"
    ON debt_disputes FOR SELECT
    USING (
        debt_id IN (
            SELECT id FROM debts WHERE
            merchant_id = auth.uid() OR
            customer_phone IN (SELECT phone_number FROM users_profile WHERE id = auth.uid())
        )
    );

CREATE POLICY "Customers can create disputes"
    ON debt_disputes FOR INSERT
    WITH CHECK (
        debt_id IN (
            SELECT id FROM debts WHERE
            customer_phone IN (SELECT phone_number FROM users_profile WHERE id = auth.uid())
        )
    );

-- Function لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_users_profile_updated_at
    BEFORE UPDATE ON users_profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_debts_updated_at
    BEFORE UPDATE ON debts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();