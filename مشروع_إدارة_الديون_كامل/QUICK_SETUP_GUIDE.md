# دليل الإعداد السريع - إصدار محسّن

## 🎯 الهدف
إكمال إعداد التطبيق بنسبة 100% في أقل من 5 دقائق

---

## 📋 الخيار 1: الإعداد اليدوي (الموصى به)

### الخطوة الوحيدة: إنشاء جدول customer_notes

1. افتح: https://supabase.com/dashboard/project/srkgtzvgjlysjmkpfaau/sql
2. الصق هذا الكود:

```sql
-- إنشاء جدول ملاحظات العملاء
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_notes_merchant ON customer_notes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_notes_customer ON customer_notes(customer_phone);

-- RLS
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view their notes" ON customer_notes;
CREATE POLICY "Merchants can view their notes"
  ON customer_notes FOR SELECT
  USING (merchant_id = auth.uid());

DROP POLICY IF EXISTS "Merchants can insert their notes" ON customer_notes;
CREATE POLICY "Merchants can insert their notes"
  ON customer_notes FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS "Merchants can update their notes" ON customer_notes;
CREATE POLICY "Merchants can update their notes"
  ON customer_notes FOR UPDATE
  USING (merchant_id = auth.uid());

DROP POLICY IF EXISTS "Merchants can delete their notes" ON customer_notes;
CREATE POLICY "Merchants can delete their notes"
  ON customer_notes FOR DELETE
  USING (merchant_id = auth.uid());
```

3. اضغط **RUN** أو **F5**
4. ✅ تم! الآن جميع الميزات السبع تعمل

---

## 🚀 الخيار 2: الإعداد التلقائي (يتطلب Supabase CLI)

إذا كان لديك Supabase CLI مثبت:

```bash
# 1. تسجيل الدخول
supabase login

# 2. ربط المشروع
supabase link --project-ref srkgtzvgjlysjmkpfaau

# 3. تنفيذ SQL
supabase db push --db-url <your-database-url>

# 4. (اختياري) نشر Edge Function للتأكيد التلقائي
supabase functions deploy auto-confirm-debts
```

---

## ✅ التحقق من نجاح الإعداد

بعد تنفيذ SQL، تحقق من:

1. **Table Editor في Supabase:**
   - افتح: https://supabase.com/dashboard/project/srkgtzvgjlysjmkpfaau/editor
   - ابحث عن جدول `customer_notes`
   - تحقق من وجود 7 أعمدة

2. **في التطبيق:**
   - سجل الدخول كتاجر
   - انتقل إلى: `/merchant/notes`
   - انقر "إضافة ملاحظة جديدة"
   - إذا فتحت النافذة بدون أخطاء = ✅ نجح!

---

## 🎨 ما تم إنجازه

### الميزات العاملة الآن (6/7):
1. ✅ القائمة الجانبية 240px
2. ✅ صفحة التقارير + PDF Export
3. ✅ نظام التنبيهات الذكية
4. ✅ البحث المتقدم
5. ⏳ **صفحة الملاحظات** ← ستعمل بعد تنفيذ SQL
6. ✅ حاسبة الأرباح الصافية
7. ✅ الإحصائيات المتقدمة

---

## 🔄 (اختياري) التأكيد التلقائي للديون

لتفعيل تأكيد الديون تلقائياً بعد 24 ساعة:

```bash
supabase functions deploy auto-confirm-debts --project-ref srkgtzvgjlysjmkpfaau
```

**ملاحظة:** هذه الميزة اختيارية. الواجهة تعرض مؤقت العد التنازلي بشكل صحيح بدونها.

---

## 📞 الدعم

### المشاكل الشائعة:

**مشكلة:** "relation customer_notes does not exist"
**الحل:** نفّذ SQL في الخطوة 1 أعلاه

**مشكلة:** "permission denied for table customer_notes"
**الحل:** تأكد من تنفيذ سياسات RLS في SQL

**مشكلة:** لا تظهر البيانات
**الحل:** تحقق من auth.uid() في RLS Policies

---

## 🎯 الخلاصة

- **الوقت المطلوب:** 2-3 دقائق فقط
- **الخطوات:** خطوة واحدة (نسخ ولصق SQL)
- **النتيجة:** 100% من الميزات تعمل
- **التأثير:** صفحة ملاحظات العملاء تصبح جاهزة للاستخدام

✨ **بعد تنفيذ SQL، التطبيق جاهز للإنتاج بالكامل!**

🔗 **رابط التطبيق:** https://kj9j4acgmvzy.space.minimax.io
