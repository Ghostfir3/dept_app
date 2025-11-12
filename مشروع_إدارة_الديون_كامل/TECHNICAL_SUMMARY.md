# 🔧 الملخص التقني - نظام إدارة الديون والاعتراضات

## 📌 نظرة عامة

**المشروع:** نظام إدارة الديون والاعتراضات المتقدم
**التاريخ:** 2025-11-02
**الإصدار:** 3.0
**الحالة:** منتج ✅

---

## 🏗️ البنية التقنية

### Frontend
- **Framework:** React 18.3.1 + TypeScript
- **Build Tool:** Vite 6.2.6
- **Router:** React Router DOM 6.30.0
- **Styling:** TailwindCSS 3.4.16
- **UI Components:** Radix UI
- **Icons:** Lucide React 0.364.0
- **State Management:** React Context API
- **Toast Notifications:** React Hot Toast 2.6.0

### Backend
- **BaaS:** Supabase
- **Database:** PostgreSQL (Supabase)
- **Functions:** Supabase Edge Functions (Deno)
- **Authentication:** Supabase Auth

### Deployment
- **Platform:** MiniMax Space
- **URL:** https://0cu0pq333fi3.space.minimax.io

---

## 📁 هيكل المشروع

```
debt-management-pro/
├── src/
│   ├── components/       # مكونات مشتركة
│   ├── contexts/         # React Contexts
│   │   └── AuthContext.tsx
│   ├── lib/              # مكتبات مساعدة
│   │   └── supabase.ts
│   ├── pages/            # صفحات التطبيق
│   │   ├── ObjectionsPage.tsx      # ✅ محدث
│   │   ├── MerchantDashboard.tsx   # ✅ محدث
│   │   └── ...
│   └── App.tsx
├── supabase/
│   └── functions/
│       ├── debt-update/            # ✅ جديد
│       ├── debt-quick-add/         # ✅ جديد
│       └── objections-management/
├── public/
├── dist/                 # Build output
├── test-progress.md      # تقدم الاختبار
├── FINAL_DELIVERY_REPORT.md  # التقرير النهائي
└── USER_GUIDE.md         # دليل المستخدم
```

---

## 🗄️ قاعدة البيانات

### جدول objections - التحديثات

```sql
-- Migration: add_objections_amount_adjustment
ALTER TABLE objections 
ADD COLUMN IF NOT EXISTS original_amount NUMERIC,
ADD COLUMN IF NOT EXISTS adjusted_amount NUMERIC,
ADD COLUMN IF NOT EXISTS amount_adjustment_reason TEXT;

COMMENT ON COLUMN objections.original_amount IS 'المبلغ الأصلي للدين قبل التعديل';
COMMENT ON COLUMN objections.adjusted_amount IS 'المبلغ المعدل بعد موافقة التاجر';
COMMENT ON COLUMN objections.amount_adjustment_reason IS 'سبب تعديل المبلغ';
```

### الجداول الرئيسية

1. **users_profile**
   - id (uuid, PK)
   - phone_number (varchar)
   - full_name (varchar)
   - user_type (enum: 'merchant', 'customer')

2. **debts**
   - id (uuid, PK)
   - merchant_id (uuid, FK)
   - customer_phone (varchar)
   - customer_name (varchar)
   - amount (numeric)
   - description (text)
   - due_date (date)
   - status (enum)
   - created_at (timestamp)
   - updated_at (timestamp) ✅

3. **objections**
   - id (uuid, PK)
   - debt_id (uuid, FK)
   - customer_id (uuid, FK)
   - title (varchar)
   - description (text)
   - status (varchar)
   - merchant_response (text)
   - response_date (timestamp)
   - original_amount (numeric) ✅ جديد
   - adjusted_amount (numeric) ✅ جديد
   - amount_adjustment_reason (text) ✅ جديد
   - created_at (timestamp)
   - updated_at (timestamp)

---

## 🔌 Edge Functions

### 1. debt-update

**الوظيفة:** تحديث معلومات الديون
**الرابط:** `/functions/v1/debt-update`
**الطريقة:** POST

**Request Body:**
```typescript
{
  debt_id: string;        // معرف الدين (مطلوب)
  amount?: number;        // المبلغ الجديد
  due_date?: string;      // تاريخ الاستحقاق
  description?: string;   // الوصف
  update_reason?: string; // سبب التعديل
}
```

**Response:**
```typescript
{
  data: {
    debt: Debt;           // الدين المحدث
    message: string;      // رسالة النجاح
    update_reason: string;// سبب التعديل
  }
}
```

**الأمان:**
- التحقق من Authorization header
- التحقق من نوع المستخدم (merchant)
- التحقق من ملكية الدين

**الملف:** `/supabase/functions/debt-update/index.ts`

---

### 2. debt-quick-add

**الوظيفة:** إضافة سريعة للديون مع نسخ معلومات العميل
**الرابط:** `/functions/v1/debt-quick-add`
**الطريقة:** POST

**Request Body:**
```typescript
{
  reference_debt_id: string;  // معرف الدين المرجعي (مطلوب)
  amount: number;             // المبلغ (مطلوب)
  description?: string;       // الوصف
  due_date?: string;          // تاريخ الاستحقاق
}
```

**Response:**
```typescript
{
  data: {
    debt: Debt;           // الدين الجديد
    message: string;      // رسالة النجاح
    linked_to: string;    // معرف الدين المرجعي
  }
}
```

**الأمان:**
- التحقق من Authorization header
- التحقق من نوع المستخدم (merchant)
- التحقق من وجود الدين المرجعي

**الملف:** `/supabase/functions/debt-quick-add/index.ts`

---

### 3. objections-management (محدث)

**الوظيفة:** إدارة شاملة للاعتراضات
**الرابط:** `/functions/v1/objections-management`
**الطرق:** GET, PUT, POST, DELETE

**استخدام:**
- GET: جلب الاعتراضات مع فلترة وبحث
- PUT: تحديث الاعتراضات (إضافة رد + تعديل حالة + تعديل مبلغ)
- POST: إنشاء اعتراضات جديدة
- DELETE: حذف الاعتراضات

**الملف:** `/supabase/functions/objections-management/index.ts`

---

## 📝 التحديثات الرئيسية

### ObjectionsPage.tsx

**الإصلاحات:**
```typescript
// قبل (خطأ):
const { data, error } = await supabase.functions.invoke('objections-management', {
  method: 'GET',
  body: {},
});

// بعد (صحيح):
const params = new URLSearchParams({...});
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/objections-management?${params}`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    }
  }
);
```

**الميزات الجديدة:**
- حقول state لتعديل المبلغ:
  ```typescript
  const [adjustedAmount, setAdjustedAmount] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [enableAmountAdjustment, setEnableAmountAdjustment] = useState(false);
  ```

- دالة updateObjection محدثة لدعم تعديل المبلغ
- modal الرد محدث مع قسم تعديل المبلغ

---

### MerchantDashboard.tsx

**الميزات الجديدة:**

1. **State Management:**
```typescript
const [showEditModal, setShowEditModal] = useState(false);
const [showQuickAddModal, setShowQuickAddModal] = useState(false);
const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
const [editFormData, setEditFormData] = useState({...});
const [quickAddFormData, setQuickAddFormData] = useState({...});
```

2. **Functions:**
```typescript
function openEditModal(debt: Debt)
function openQuickAddModal(debt: Debt)
async function handleUpdateDebt(e: React.FormEvent)
async function handleQuickAddDebt(e: React.FormEvent)
```

3. **UI Updates:**
- عمود "الإجراءات" جديد في الجدول
- أزرار تعديل وإضافة سريعة
- modal التعديل
- modal الإضافة السريعة

---

### supabase.ts

**التحديث:**
```typescript
export const SUPABASE_URL = supabaseUrl;
```

**الاستخدام:**
```typescript
import { supabase, SUPABASE_URL } from '../lib/supabase';
```

---

## 🔐 الأمان

### Edge Functions

**Authentication Flow:**
```typescript
// 1. استخراج Token
const authHeader = req.headers.get('authorization');
const token = authHeader.replace('Bearer ', '');

// 2. التحقق من المستخدم
const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'apikey': serviceRoleKey
  }
});

// 3. جلب Profile
const profileResponse = await fetch(
  `${supabaseUrl}/rest/v1/users_profile?id=eq.${userId}`,
  {...}
);

// 4. التحقق من النوع
if (userProfile.user_type !== 'merchant') {
  throw new Error('Access denied');
}
```

### RLS Policies

قاعدة البيانات محمية بـ Row Level Security:
- merchants: الوصول للديون الخاصة بهم فقط
- customers: الوصول للديون والاعتراضات الخاصة بهم

---

## 🧪 الاختبار

### الاختبار اليدوي

**بيانات الاختبار:**
```
التاجر: phone@example.com / password123
العميل: customer@example.com / password123
```

**المسارات:**
1. تسجيل الدخول
2. لوحة التاجر - عرض الديون
3. تعديل دين
4. إضافة دين سريع
5. صفحة الاعتراضات
6. الرد مع تعديل المبلغ

**الملف:** `/test-progress.md`

---

## 📊 الأداء

### Build Stats

```
dist/index.html                              0.35 kB │ gzip:   0.25 kB
dist/assets/index-CqoSyte5.css              42.31 kB │ gzip:   7.00 kB
dist/assets/purify.es-B6FQ9oRL.js           22.57 kB │ gzip:   8.71 kB
dist/assets/index.es-BzIOhuYE.js           159.31 kB │ gzip:  53.23 kB
dist/assets/html2canvas.esm-CBrSDip1.js    202.30 kB │ gzip:  47.70 kB
dist/assets/index-E08qE1zS.js            2,184.59 kB │ gzip: 472.28 kB
```

**ملاحظة:** يمكن تحسين الأداء بـ code splitting و lazy loading

---

## 🚀 النشر

### الأوامر

```bash
# تثبيت التبعيات
npm install

# البناء
npm run build

# النشر
# يتم النشر تلقائياً عبر MiniMax Space
```

### البيئة

**متغيرات البيئة:**
- `SUPABASE_URL`: https://srkgtzvgjlysjmkpfaau.supabase.co
- `SUPABASE_ANON_KEY`: [في supabase.ts]
- `SUPABASE_SERVICE_ROLE_KEY`: [في Edge Functions]

---

## 🔄 التحديثات المستقبلية

### مقترحات التحسين

1. **Audit Log:**
   - تسجيل جميع التعديلات
   - تتبع من قام بالتعديل ومتى

2. **Notifications:**
   - إشعار العميل عند تعديل الدين
   - إشعار التاجر عند اعتراض جديد

3. **Analytics:**
   - إحصائيات التعديلات
   - تقارير الاعتراضات

4. **Performance:**
   - Code splitting
   - Lazy loading
   - Image optimization

5. **Testing:**
   - Unit tests
   - Integration tests
   - E2E tests

---

## 📚 الوثائق الإضافية

- **دليل المستخدم:** `USER_GUIDE.md`
- **تقرير التسليم:** `FINAL_DELIVERY_REPORT.md`
- **تقدم الاختبار:** `test-progress.md`

---

## 🐛 معالجة الأخطاء الشائعة

### 1. فشل تحميل الاعتراضات
**السبب:** مشكلة في استدعاء Edge Function
**الحل:** تم استخدام fetch API بدلاً من supabase.functions.invoke

### 2. خطأ في التحديث
**السبب:** session منتهية
**الحل:** التحقق من Session قبل الاستدعاء

### 3. بيانات غير محدثة
**السبب:** Cache
**الحل:** إعادة تحميل البيانات بعد التحديث

---

## 📞 الدعم الفني

**للمطورين:**
- راجع الكود في `/src`
- راجع Edge Functions في `/supabase/functions`
- راجع logs في Supabase Dashboard

**للاستفسارات:**
- تحقق من console logs
- استخدم Postman لاختبار Edge Functions
- راجع Supabase documentation

---

**تاريخ الوثيقة:** 2025-11-02
**الإصدار:** 3.0
**الحالة:** نهائي ✅
