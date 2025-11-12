# دليل إعداد قاعدة البيانات - نظام إدارة الديون الاحترافي

## الخطوات المطلوبة

### 1. الدخول إلى Supabase Dashboard

انتقل إلى: https://srkgtzvgjlysjmkpfaau.supabase.co

### 2. تطبيق Schema قاعدة البيانات

1. افتح **SQL Editor** من القائمة الجانبية
2. انسخ والصق الكود التالي بالكامل
3. اضغط على **Run** أو **Execute**

```sql
-- نظام إدارة الديون الاحترافي - قاعدة البيانات

-- إضافة enum للأنواع
DO $$ BEGIN
    CREATE TYPE user_type AS ENUM ('merchant', 'customer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE debt_status AS ENUM ('pending', 'disputed', 'confirmed', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dispute_status AS ENUM ('pending', 'resolved', 'dismissed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_debts_merchant ON debts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_debts_customer_phone ON debts(customer_phone);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_debt ON payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_disputes_debt ON debt_disputes(debt_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON debt_disputes(status);

-- Enable Row Level Security
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_disputes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users_profile
DROP POLICY IF EXISTS "Users can view their own profile" ON users_profile;
CREATE POLICY "Users can view their own profile"
    ON users_profile FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON users_profile;
CREATE POLICY "Users can update their own profile"
    ON users_profile FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON users_profile;
CREATE POLICY "Users can insert their own profile"
    ON users_profile FOR INSERT
    WITH CHECK (auth.uid() = id);

-- RLS Policies for debts
DROP POLICY IF EXISTS "Merchants can view their debts" ON debts;
CREATE POLICY "Merchants can view their debts"
    ON debts FOR SELECT
    USING (
        merchant_id = auth.uid() OR
        customer_phone IN (
            SELECT phone_number FROM users_profile WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Merchants can create debts" ON debts;
CREATE POLICY "Merchants can create debts"
    ON debts FOR INSERT
    WITH CHECK (
        merchant_id = auth.uid() AND
        EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND user_type = 'merchant')
    );

DROP POLICY IF EXISTS "Merchants can update their debts" ON debts;
CREATE POLICY "Merchants can update their debts"
    ON debts FOR UPDATE
    USING (merchant_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update debt status" ON debts;
CREATE POLICY "Customers can update debt status"
    ON debts FOR UPDATE
    USING (customer_phone IN (SELECT phone_number FROM users_profile WHERE id = auth.uid()));

-- RLS Policies for payments
DROP POLICY IF EXISTS "View payments for related debts" ON payments;
CREATE POLICY "View payments for related debts"
    ON payments FOR SELECT
    USING (
        debt_id IN (
            SELECT id FROM debts WHERE
            merchant_id = auth.uid() OR
            customer_phone IN (SELECT phone_number FROM users_profile WHERE id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Create payments for related debts" ON payments;
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
DROP POLICY IF EXISTS "View disputes for related debts" ON debt_disputes;
CREATE POLICY "View disputes for related debts"
    ON debt_disputes FOR SELECT
    USING (
        debt_id IN (
            SELECT id FROM debts WHERE
            merchant_id = auth.uid() OR
            customer_phone IN (SELECT phone_number FROM users_profile WHERE id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Customers can create disputes" ON debt_disputes;
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
DROP TRIGGER IF EXISTS update_users_profile_updated_at ON users_profile;
CREATE TRIGGER update_users_profile_updated_at
    BEFORE UPDATE ON users_profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_debts_updated_at ON debts;
CREATE TRIGGER update_debts_updated_at
    BEFORE UPDATE ON debts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### 3. التحقق من نجاح التطبيق

بعد تنفيذ الكود، تأكد من:
- ✅ لا توجد أخطاء في SQL Editor
- ✅ ظهور الجداول الأربعة في قسم **Table Editor**:
  - `users_profile`
  - `debts`
  - `payments`
  - `debt_disputes`

### 4. تفعيل Email Authentication (اختياري)

إذا أردت استخدام تأكيد البريد الإلكتروني:

1. انتقل إلى **Authentication** > **Providers**
2. فعّل **Email**
3. قم بتعطيل "Confirm email" إذا كنت في بيئة تجريبية

## معلومات الاتصال المُستخدمة

- **Supabase URL**: https://srkgtzvgjlysjmkpfaau.supabase.co
- **Anon Key**: (موجود في الكود)

## اختبار التطبيق

بعد إعداد قاعدة البيانات:

1. افتح التطبيق: https://138sj3wxpn38.space.minimax.io
2. قم بإنشاء حساب جديد (تاجر أو عميل)
3. جرّب الميزات:
   - **التاجر**: إضافة ديون، عرض الإحصائيات، الرسوم البيانية
   - **العميل**: عرض الديون، التقويم، نظام الاعتراضات، الدفع

## الميزات المتاحة

### لوحة التاجر
- ✅ إضافة ديون جديدة
- ✅ عرض قائمة الديون
- ✅ إحصائيات شاملة (إجمالي، قيد الانتظار، مدفوع، عدد العملاء)
- ✅ رسم بياني دائري لتوزيع الديون حسب الحالة
- ✅ رسم بياني خطي للديون الشهرية
- ✅ تصميم Material Design احترافي

### لوحة العميل
- ✅ عرض جميع الديون
- ✅ تقويم تفاعلي لمواعيد الاستحقاق
- ✅ نظام اعتراضات كامل
- ✅ إمكانية دفع الديون
- ✅ تنبيهات للديون المتأخرة
- ✅ رسم بياني للديون المدفوعة والمستحقة
- ✅ إحصائيات تفصيلية

## ملاحظات مهمة

1. **نظام المصادقة**: يستخدم رقم الهاتف + كلمة مرور
2. **التحويل التلقائي**: رقم الهاتف يتحول إلى email داخلياً (`{phone}@debtapp.local`)
3. **Row Level Security**: جميع البيانات محمية بسياسات RLS
4. **RTL Support**: التطبيق يدعم اللغة العربية من اليمين إلى اليسار
5. **Responsive**: يعمل على جميع الأجهزة (Desktop, Tablet, Mobile)

## استكشاف الأخطاء

### مشكلة: لا يمكن إنشاء حساب
- تأكد من تطبيق Schema بشكل صحيح
- تحقق من RLS Policies في Supabase

### مشكلة: لا تظهر البيانات
- تأكد من إنشاء المستخدم بنجاح
- تحقق من جدول `users_profile` في Table Editor

### مشكلة: خطأ في الرسوم البيانية
- تأكد من وجود بيانات كافية في الجداول
- الرسوم البيانية تحتاج إلى بيانات لتعمل

## الدعم

للمساعدة أو الاستفسارات:
- راجع documentation على Supabase
- تحقق من Console logs في المتصفح
- راجع Supabase logs في Dashboard

---

**تم إنشاء التطبيق بواسطة**: MiniMax Agent  
**التاريخ**: 2025-11-01  
**النسخة**: 1.0.0
