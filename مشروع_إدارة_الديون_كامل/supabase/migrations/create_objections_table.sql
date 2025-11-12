CREATE TABLE IF NOT EXISTS objections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    merchant_response TEXT,
    response_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_objections_debt_id ON objections(debt_id);
CREATE INDEX IF NOT EXISTS idx_objections_status ON objections(status);
CREATE INDEX IF NOT EXISTS idx_objections_created_at ON objections(created_at);

-- Enable RLS
ALTER TABLE objections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for objections
CREATE POLICY "Merchants can view objections for their debts" ON objections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM debts 
            WHERE debts.id = objections.debt_id 
            AND debts.merchant_id = auth.uid()
        )
    );

CREATE POLICY "Merchants can update objections for their debts" ON objections
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM debts 
            WHERE debts.id = objections.debt_id 
            AND debts.merchant_id = auth.uid()
        )
    );

CREATE POLICY "Customers can create objections for their debts" ON objections
    FOR INSERT WITH CHECK (
        customer_id = auth.uid()
    );

-- Create RLS policy for service role to bypass RLS
CREATE POLICY "Service role can manage all objections" ON objections
    FOR ALL USING (auth.role() = 'service_role');