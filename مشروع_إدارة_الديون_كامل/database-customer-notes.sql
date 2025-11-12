-- إضافة جدول الملاحظات للعملاء
-- تاريخ: 2025-11-01

-- جدول customer_notes
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20) NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهرس للأداء
CREATE INDEX IF NOT EXISTS idx_notes_merchant ON customer_notes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_notes_customer ON customer_notes(customer_phone);

-- Row Level Security
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

-- سياسات RLS: التاجر يمكنه إدارة ملاحظاته فقط
CREATE POLICY "Merchants can view their notes"
  ON customer_notes FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can insert their notes"
  ON customer_notes FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can update their notes"
  ON customer_notes FOR UPDATE
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can delete their notes"
  ON customer_notes FOR DELETE
  USING (merchant_id = auth.uid());

-- Trigger لتحديث updated_at
CREATE TRIGGER update_customer_notes_updated_at
  BEFORE UPDATE ON customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
