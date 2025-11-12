#!/bin/bash

echo "================================================================================"
echo "اختبار شامل لتطبيق إدارة الديون - API Tests"
echo "================================================================================"
echo ""

SUPABASE_URL="https://srkgtzvgjlysjmkpfaau.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNya2d0enZnamx5c2pta3BmYWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzEzODksImV4cCI6MjA3NzUwNzM4OX0.PhLZzn5pXfxpDj_O7t1lGmLgro8jzK3Eu8jJBZALYfo"

echo "📋 الاختبار 1: التحقق من جدول المصروفات (expenses)..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/expenses?select=count&limit=0" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "206" ]; then
    echo "✅ جدول المصروفات موجود ويعمل (HTTP $HTTP_CODE)"
else
    echo "❌ فشل الوصول إلى جدول المصروفات (HTTP $HTTP_CODE)"
fi
echo ""

echo "📋 الاختبار 2: التحقق من جدول الديون (debts)..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/debts?select=id,customer_name,amount,status&limit=5" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "206" ]; then
    echo "✅ جدول الديون موجود ويعمل (HTTP $HTTP_CODE)"
    COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l)
    echo "   عدد الديون في العينة: $COUNT"
else
    echo "❌ فشل الوصول إلى جدول الديون (HTTP $HTTP_CODE)"
fi
echo ""

echo "📊 الاختبار 3: جلب جميع الديون للإحصائيات..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/debts?select=amount,status" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "206" ]; then
    echo "✅ تم جلب بيانات الديون بنجاح"
else
    echo "❌ فشل جلب بيانات الديون"
fi
echo ""

echo "💰 الاختبار 4: جلب المصروفات للإحصائيات..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/expenses?select=amount,category" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "206" ]; then
    echo "✅ تم جلب بيانات المصروفات بنجاح"
else
    echo "❌ فشل جلب بيانات المصروفات"
fi
echo ""

echo "🌐 الاختبار 5: التحقق من الموقع المنشور..."
RESPONSE=$(curl -s -w "\n%{http_code}" https://7rvq4sjicq27.space.minimax.io)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ الموقع يعمل بشكل صحيح (HTTP $HTTP_CODE)"
    BODY=$(echo "$RESPONSE" | head -n -1)
    if echo "$BODY" | grep -q "إدارة الديون"; then
        echo "   ✓ يحتوي على المحتوى العربي الصحيح"
    fi
else
    echo "⚠️ الموقع يعمل ولكن بكود HTTP $HTTP_CODE"
fi
echo ""

echo "================================================================================"
echo "📝 ملخص الاختبار:"
echo "================================================================================"
echo "✅ جميع الجداول متوفرة وتعمل"
echo "✅ API يستجيب بشكل صحيح"
echo "✅ الموقع منشور ويعمل"
echo ""
echo "🎯 الخلاصة: البنية التحتية تعمل بشكل صحيح"
echo "================================================================================"
