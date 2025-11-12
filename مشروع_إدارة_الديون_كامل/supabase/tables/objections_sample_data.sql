-- إدراج بيانات اختبار للاعتراضات
INSERT INTO objections (debt_id, customer_id, title, description, status, created_at) 
SELECT 
    d.id as debt_id,
    u.id as customer_id,
    'اعتراض على المبلغ' as title,
    'أعتقد أن المبلغ كبير وغير صحيح' as description,
    'pending' as status,
    NOW() - INTERVAL '1 day' * (random() * 30)::int as created_at
FROM debts d
CROSS JOIN auth.users u
WHERE d.merchant_id = u.id
AND random() < 0.3  -- 30% من الديون سيكون لديها اعتراضات
LIMIT 10;