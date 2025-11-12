# تقرير إصلاح مشكلة حساب المبلغ المتبقي عند السداد

## المشكلة المُبلغ عنها
كان المستخدم يواجه مشكلة في عدم حساب المبلغ المتبقي بشكل صحيح عند الضغط على زر "تسديد" لإضافة مبلغ السداد للعميل.

## تحليل المشكلة

### 1. المشكلة الأساسية
تم اكتشاف أن مكون `PaymentModal` كان يعتمد على `remaining_amount` من البيانات المرسلة من قاعدة البيانات، لكن دالة `fetchCustomerDebts` في `PaymentModal` كانت تجلب الديون من جدول `debts` فقط ولا تحسب المبلغ المتبقي بناءً على السدادات السابقة.

### 2. المشكلة في edge function
كما تم اكتشاف أن edge function `process-payment` كانت تعتمد على `remaining_amount` المرسل من Frontend بدلاً من حسابه من قاعدة البيانات مباشرة.

## الحلول المُطبقة

### 1. إصلاح PaymentModal.tsx
**الملف:** `/src/components/PaymentModal.tsx`

**التغييرات المطبقة:**
- تم تحديث دالة `fetchCustomerDebts` لتجلب السدادات من جدول `payment_transactions`
- تم إضافة حساب المبلغ المسدد لكل دين بناءً على جميع السدادات السابقة
- تم حساب `remaining_amount` بشكل صحيح لكل دين: `debt.amount - (paidAmounts[debt.id] || 0)`

**الكود المضاف:**
```typescript
// جلب السدادات لجميع الديون لحساب المبلغ المتبقي
const { data: paymentsData, error: paymentsError } = await supabase
  .from('payment_transactions')
  .select('debts_paid, created_at')
  .eq('merchant_id', merchantId)
  .order('created_at', { ascending: false });

// حساب المبلغ المسدد لكل دين
const paidAmounts: Record<string, number> = {};
if (paymentsData) {
  paymentsData.forEach(transaction => {
    if (transaction.debts_paid && Array.isArray(transaction.debts_paid)) {
      transaction.debts_paid.forEach((debtPaid: any) => {
        const debtId = debtPaid.debt_id;
        const amountPaid = debtPaid.amount_paid || 0;
        paidAmounts[debtId] = (paidAmounts[debtId] || 0) + amountPaid;
      });
    }
  });
}

// إضافة المبلغ المتبقي لكل دين
const debtsWithRemaining = (data || []).map(debt => ({
  ...debt,
  paid_amount: paidAmounts[debt.id] || 0,
  remaining_amount: debt.amount - (paidAmounts[debt.id] || 0)
}));
```

### 2. إصلاح process-payment Edge Function
**الملف:** `/supabase/functions/process-payment/index.ts`

**التغييرات المطبقة:**
- تم تحديث Edge Function لتجلب جميع السدادات من قاعدة البيانات
- تم حساب المبلغ المسدد لكل دين من السدادات الفعلية في قاعدة البيانات
- تم تجنب الاعتماد على البيانات المرسلة من Frontend
- تم إضافة تخطي للديون المسددة بالكامل (remaining_amount <= 0.01)

**الكود المضاف:**
```typescript
// Get all payments to calculate remaining amounts correctly
const paymentsResponse = await fetch(
  `${supabaseUrl}/rest/v1/payment_transactions?merchant_id=eq.${merchantId}&order=created_at.desc`,
  {
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json'
    }
  }
);

const payments = await paymentsResponse.json();

// Calculate paid amounts for each debt
const paidAmounts: Record<string, number> = {};
if (payments) {
  payments.forEach((transaction: any) => {
    if (transaction.debts_paid && Array.isArray(transaction.debts_paid)) {
      transaction.debts_paid.forEach((debtPaid: any) => {
        const debtId = debtPaid.debt_id;
        const amountPaid = debtPaid.amount_paid || 0;
        paidAmounts[debtId] = (paidAmounts[debtId] || 0) + amountPaid;
      });
    }
  });
}

// Add remaining_amount to each debt
const debtsWithRemaining = debts.map((debt: any) => ({
  ...debt,
  paid_amount: paidAmounts[debt.id] || 0,
  remaining_amount: debt.amount - (paidAmounts[debt.id] || 0)
}));
```

## النتائج المتوقعة

### 1. تحسين دقة الحسابات
- حساب المبلغ المتبقي بشكل صحيح بناءً على جميع السدادات السابقة
- عرض المبالغ الصحيحة في قائمة الديون داخل نافذة السداد

### 2. تحسين تجربة المستخدم
- عرض المبالغ المتبقية الصحيحة في واجهة السداد
- تجنب الأخطاء في توزيع مبالغ السداد على الديون
- تحسين دقة العمليات المحاسبية

### 3. استقرار النظام
- عدم الاعتماد على البيانات المرسلة من Frontend
- حساب المبالغ المتبقية من مصدر واحد موثوق (قاعدة البيانات)
- تجنب تضارب البيانات بين Frontend و Backend

## التطبيق على جميع الواجهات
تم تطبيق الإصلاح على:
1. **القائمة الرئيسية للديون** - AllDebtsPage.tsx
2. **نافذة تفاصيل العميل** - CustomerDetailsModal.tsx  
3. **نافذة السداد** - PaymentModal.tsx
4. **معالجة الدفع** - process-payment Edge Function

## رابط التطبيق المحدث
**الرابط:** https://9guz5u10sl4j.space.minimax.io

## تاريخ الإصلاح
**التاريخ:** 2025-11-04  
**الحالة:** مكتمل ✅  
**المطور:** MiniMax Agent

---
*تم إصلاح المشكلة بنجاح وتطبيق الحل على جميع أجزاء النظام ذات الصلة.*
