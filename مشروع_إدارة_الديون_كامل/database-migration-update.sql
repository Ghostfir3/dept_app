-- تحديثات قاعدة البيانات لميزات التطبيق الجديدة
-- تاريخ: 2025-11-01

-- 1. إضافة عمود رأس المال لجدول users_profile
ALTER TABLE users_profile ADD COLUMN IF NOT EXISTS capital DECIMAL(15, 2) DEFAULT 0;

-- 2. إضافة عمود موعد التأكيد التلقائي لجدول debts
ALTER TABLE debts ADD COLUMN IF NOT EXISTS dispute_deadline TIMESTAMP WITH TIME ZONE;

-- 3. إضافة سياسة RLS للسماح للعملاء بتحديث حالة الدين (تأكيد أو اعتراض)
DROP POLICY IF EXISTS "Customers can update debt status" ON debts;
CREATE POLICY "Customers can update debt status"
ON debts FOR UPDATE
USING (
    customer_phone IN (
        SELECT phone_number FROM users_profile WHERE id = auth.uid()
    )
)
WITH CHECK (
    customer_phone IN (
        SELECT phone_number FROM users_profile WHERE id = auth.uid()
    )
);

-- 4. تحديث السياسة الحالية للتاجر للسماح بتحديث debts
-- السياسة الموجودة تسمح بالتحديث، لا حاجة لتغييرها

-- 5. إضافة فهرس لتحسين الأداء عند البحث عن الديون حسب dispute_deadline
CREATE INDEX IF NOT EXISTS idx_debts_dispute_deadline ON debts(dispute_deadline) WHERE status = 'pending';

-- ملاحظات:
-- - عمود capital سيستخدم لحفظ رأس المال الأساسي للتاجر
-- - عمود dispute_deadline سيحدد الموعد النهائي للتأكيد التلقائي (24 ساعة من إنشاء الدين)
-- - السياسة الجديدة تسمح للعملاء بتحديث حالة الدين الخاص بهم فقط
