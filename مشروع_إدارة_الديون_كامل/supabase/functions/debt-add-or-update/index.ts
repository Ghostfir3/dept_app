Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        // التحقق من التفويض
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('غير مصرح - مطلوب تفويض');
        }

        // استخراج البيانات من الطلب
        const requestData = await req.json();
        const { 
            customer_phone, 
            customer_name, 
            amount, 
            description, 
            due_date 
        } = requestData;

        // التحقق من البيانات المطلوبة
        if (!customer_phone || !customer_name || !amount) {
            throw new Error('البيانات المطلوبة: رقم الهاتف، اسم العميل، والمبلغ');
        }

        // استخراج token من التفويض
        const token = authHeader.replace('Bearer ', '');
        
        // التحقق من صحة التوكن والصلاحيات
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        // التحقق من صحة المستخدم
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': supabaseKey
            }
        });
        
        if (!userResponse.ok) {
            throw new Error('غير مصرح - توكن غير صحيح');
        }
        
        const userData = await userResponse.json();
        const merchantId = userData.id;

        // البحث عن دين موجود لهذا العميل
        const existingDebtResponse = await fetch(
            `${supabaseUrl}/rest/v1/debts?merchant_id=eq.${merchantId}&customer_phone=eq.${customer_phone}&status=neq.paid&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const existingDebts = await existingDebtResponse.json();

        if (existingDebts && existingDebts.length > 0) {
            // وجد دين موجود - سيتم تحديث المبلغ
            // سنضيف المبلغ الجديد على الدين الموجود
            const existingDebt = existingDebts[0];
            const newAmount = existingDebt.amount + parseFloat(amount);
            
            // تحديث الدين الموجود
            const updateResponse = await fetch(
                `${supabaseUrl}/rest/v1/debts?id=eq.${existingDebt.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${supabaseKey}`,
                        'apikey': supabaseKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        amount: newAmount,
                        description: description || existingDebt.description,
                        due_date: due_date || existingDebt.due_date,
                        updated_at: new Date().toISOString()
                    })
                }
            );

            if (!updateResponse.ok) {
                const error = await updateResponse.text();
                throw new Error(`فشل في تحديث الدين: ${error}`);
            }

            const updatedDebt = await updateResponse.json();

            return new Response(JSON.stringify({ 
                data: {
                    success: true,
                    action: 'updated',
                    debt: updatedDebt[0],
                    message: `تم إضافة ${amount} ريال على دين العميل ${customer_name} بنجاح`
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } else {
            // لم يوجد دين - إنشاء دين جديد
            const insertResponse = await fetch(
                `${supabaseUrl}/rest/v1/debts`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${supabaseKey}`,
                        'apikey': supabaseKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        merchant_id: merchantId,
                        customer_phone: customer_phone,
                        customer_name: customer_name,
                        amount: parseFloat(amount),
                        description: description || null,
                        due_date: due_date || null,
                        status: 'pending',
                        dispute_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                    })
                }
            );

            if (!insertResponse.ok) {
                const error = await insertResponse.text();
                throw new Error(`فشل في إضافة الدين: ${error}`);
            }

            const newDebt = await insertResponse.json();

            return new Response(JSON.stringify({ 
                data: {
                    success: true,
                    action: 'created',
                    debt: newDebt[0],
                    message: `تم إنشاء دين جديد للعميل ${customer_name} بمبلغ ${amount} ريال بنجاح`
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        console.error('خطأ في معالجة إضافة/تحديث الدين:', error);
        
        const errorResponse = {
            error: {
                code: 'DEBT_OPERATION_ERROR',
                message: error.message || 'حدث خطأ غير متوقع'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});