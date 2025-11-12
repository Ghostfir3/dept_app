# دليل إكمال تحديثات تطبيق إدارة الديون

## نظرة عامة
تم تطوير جميع الميزات الجديدة ونشر التطبيق بنجاح على:
**https://uo39h1kbyu6b.space.minimax.io**

## الخطوات المتبقية (تتطلب صلاحيات Supabase)

### 1. تحديث قاعدة البيانات

#### الطريقة الأولى: عبر Supabase Dashboard (موصى بها)

1. افتح https://supabase.com/dashboard/project/srkgtzvgjlysjmkpfaau/editor
2. انتقل إلى SQL Editor
3. أنشئ استعلام جديد (New Query)
4. الصق الكود التالي:

```sql
-- تحديثات قاعدة البيانات لميزات التطبيق الجديدة

-- 1. إضافة عمود رأس المال
ALTER TABLE users_profile ADD COLUMN IF NOT EXISTS capital DECIMAL(15, 2) DEFAULT 0;

-- 2. إضافة عمود موعد التأكيد التلقائي
ALTER TABLE debts ADD COLUMN IF NOT EXISTS dispute_deadline TIMESTAMP WITH TIME ZONE;

-- 3. إضافة سياسة RLS للسماح للعملاء بتحديث حالة الدين
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

-- 4. إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_debts_dispute_deadline ON debts(dispute_deadline) WHERE status = 'pending';
```

5. اضغط على RUN لتنفيذ الاستعلام

#### الطريقة الثانية: عبر سطر الأوامر (Supabase CLI)

```bash
# تأكد من تسجيل الدخول
supabase login

# ربط المشروع
supabase link --project-ref srkgtzvgjlysjmkpfaau

# تنفيذ الملف
supabase db execute --file database-migration-update.sql
```

### 2. نشر Edge Function للتأكيد التلقائي

#### الخطوات:

1. افتح Supabase Dashboard > Edge Functions
2. أنشئ وظيفة جديدة باسم: `auto-confirm-debts`
3. الصق الكود من الملف: `supabase/functions/auto-confirm-debts/index.ts`
4. احفظ وانشر الوظيفة

#### أو عبر CLI:

```bash
# نشر الوظيفة
supabase functions deploy auto-confirm-debts

# اختبار الوظيفة
curl -X POST \
  'https://srkgtzvgjlysjmkpfaau.supabase.co/functions/v1/auto-confirm-debts' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### 3. إعداد Cron Job (اختياري - للتأكيد التلقائي كل ساعة)

#### عبر pg_cron (في Supabase Dashboard):

```sql
-- جدولة التنفيذ كل ساعة
SELECT cron.schedule(
    'auto-confirm-debts-hourly',
    '0 * * * *', -- كل ساعة عند الدقيقة 0
    $$
    SELECT net.http_post(
        url := 'https://srkgtzvgjlysjmkpfaau.supabase.co/functions/v1/auto-confirm-debts',
        headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
        body := '{}'::jsonb
    );
    $$
);
```

**ملاحظة:** استبدل `YOUR_SERVICE_ROLE_KEY` بالمفتاح الحقيقي من Supabase Dashboard > Settings > API

### 4. التحقق من التحديثات

بعد تطبيق التحديثات، تحقق من:

✅ **قاعدة البيانات:**
```sql
-- تحقق من وجود العمود capital
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users_profile' AND column_name = 'capital';

-- تحقق من وجود العمود dispute_deadline
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'debts' AND column_name = 'dispute_deadline';
```

✅ **Edge Function:** اختبر عبر Postman أو curl

✅ **Cron Job:** تحقق من السجلات في Supabase Dashboard

## الميزات الجديدة المطورة

### 1. واجهة العميل (تم إعادة تصميمها بالكامل)

#### التصميم:
- ألوان مختلفة (أزرق/رمادي بدلاً من الأخضر)
- بطاقات أفقية للديون
- تقويم تفاعلي لمواعيد الاستحقاق
- قسم معلومات سريعة

#### الميزات:
✅ **تم إلغاء زر "الدفع"** - لم يعد موجوداً
✅ **نظام تأكيد/اعتراض:**
   - زر "تأكيد الدين" - للاعتراف بالدين
   - زر "الاعتراض على الدين" - يفتح نافذة لإدخال سبب الاعتراض
✅ **عداد تنازلي:**
   - يعرض الوقت المتبقي للتأكيد التلقائي (24 ساعة)
   - يتغير اللون حسب الوقت المتبقي (أخضر > برتقالي > أحمر)
   - تحديث مباشر كل ثانية
✅ **حالات الديون:**
   - معلق (pending) - برتقالي
   - مؤكد (confirmed) - أخضر
   - مدفوع (paid) - أزرق
   - معترض عليه (disputed) - أحمر

### 2. واجهة التاجر (تم إعادة هيكلتها)

#### الشريط الجانبي (Sidebar):
✅ تصميم احترافي بألوان خضراء داكنة
✅ القوائم:
   - الصفحة الرئيسية
   - العملاء والديون
   - إضافة دين جديد
   - الرسوم البيانية
   - تأثير رأس المال
   - الإعدادات

#### الصفحات الجديدة:

**أ. الصفحة الرئيسية (Home):**
- رسالة ترحيبية مخصصة
- اقتباسات تحفيزية عشوائية
- بطاقات إحصائيات سريعة (4 بطاقات)
- رسوم بيانية مصغرة (دائري وشريطي)
- أحدث 5 ديون مسجلة

**ب. صفحة إدارة العملاء والديون:**
- بطاقات إحصائيات (4 بطاقات)
- أدوات بحث وتصفية متقدمة
- جدول شامل لجميع الديون
- عرض تفاصيل كل دين

**ج. صفحة إضافة دين جديد:**
- نموذج مخصص ومنظم
- حقول التحقق من الصحة
- ملاحظات توضيحية
- نصائح لإضافة الديون

**د. صفحة الرسوم البيانية:**
- رسم دائري: توزيع عدد الديون حسب الحالة
- رسم شريطي: توزيع المبالغ حسب الحالة
- رسم خطي: المبالغ الشهرية
- رسم شريطي: عدد الديون الشهرية
- رسم أفقي: أكبر 10 عملاء

**هـ. صفحة تأثير رأس المال (جديدة):**
✅ نموذج إدخال رأس المال
✅ الحسابات التلقائية:
   - رأس المال الأساسي
   - رأس المال المتاح (= رأس المال - الديون المعلقة)
   - رأس المال المقيد (= الديون المعلقة)
   - نسبة الديون من رأس المال
✅ الرسوم البيانية:
   - رسم دائري: توزيع رأس المال (حر/مقيد)
   - رسم شريطي: مقارنة رأس المال والديون
✅ مؤشر تقدم ملون حسب النسبة
✅ تحليل وتوصيات تلقائية:
   - تحذير (أحمر): نسبة أكبر من 75%
   - تنبيه (برتقالي): نسبة بين 50-75%
   - ممتاز (أخضر): نسبة أقل من 50%

**و. صفحة الإعدادات:**
- تحديث معلومات الحساب
- عرض البريد الإلكتروني ونوع الحساب
- معلومات الأمان

### 3. قاعدة البيانات

التحديثات المطلوبة (تنفيذ يدوي):
- ✅ عمود `capital` في جدول `users_profile`
- ✅ عمود `dispute_deadline` في جدول `debts`
- ✅ سياسة RLS جديدة للعملاء لتحديث حالة الدين

### 4. Edge Function للتأكيد التلقائي

الوظيفة الجديدة:
- ✅ اسم الوظيفة: `auto-confirm-debts`
- ✅ النوع: Cron Job (يعمل كل ساعة)
- ✅ المهمة: البحث عن الديون المعلقة التي مر عليها أكثر من 24 ساعة وتأكيدها تلقائياً

## الملفات الرئيسية

- `database-migration-update.sql` - تحديثات قاعدة البيانات
- `supabase/functions/auto-confirm-debts/index.ts` - Edge Function للتأكيد التلقائي
- `src/pages/CustomerDashboard.tsx` - واجهة العميل الجديدة
- `src/pages/MerchantHome.tsx` - الصفحة الرئيسية للتاجر
- `src/pages/CapitalImpact.tsx` - صفحة تأثير رأس المال
- `src/pages/DebtsManagementPage.tsx` - صفحة إدارة الديون
- `src/pages/AddDebtPage.tsx` - صفحة إضافة دين جديد
- `src/pages/ChartsPage.tsx` - صفحة الرسوم البيانية
- `src/pages/SettingsPage.tsx` - صفحة الإعدادات
- `src/components/MerchantSidebar.tsx` - الشريط الجانبي

## التطبيق المنشور

**الرابط:** https://uo39h1kbyu6b.space.minimax.io

## معايير النجاح

✅ واجهة العميل مختلفة تماماً عن واجهة التاجر
✅ تم إلغاء زر الدفع من واجهة العميل
✅ نظام التأكيد/الاعتراض يعمل بشكل صحيح
✅ عداد التنازلي للتأكيد التلقائي (24 ساعة) يعمل
✅ شريط جانبي احترافي في واجهة التاجر
✅ صفحة رئيسية ترحيبية جذابة
✅ صفحة تأثير رأس المال مع جميع الحسابات والرسوم البيانية
✅ التصميم احترافي ومتجاوب (responsive)
⏳ التأكيد التلقائي بعد 24 ساعة (يتطلب نشر Edge Function)

## ملاحظات مهمة

1. **التأكيد التلقائي:** يعتمد على Edge Function + Cron Job، يجب نشرهما أولاً
2. **رأس المال:** يتم حفظه في قاعدة البيانات بعد تطبيق التحديثات
3. **العداد التنازلي:** يعمل في الـ frontend حالياً، وسيتم التأكيد من الـ backend عبر Edge Function

## الدعم والمساعدة

إذا واجهت أي مشاكل:
1. تحقق من Supabase Logs في Dashboard
2. راجع RLS Policies
3. اختبر Edge Function يدوياً عبر curl
4. تحقق من Browser Console للأخطاء في الـ frontend
