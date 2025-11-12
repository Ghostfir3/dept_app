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

        // جلب معلومات التاجر من users_profile
        const merchantProfileResponse = await fetch(
            `${supabaseUrl}/rest/v1/users_profile?id=eq.${merchantId}&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!merchantProfileResponse.ok) {
            throw new Error('فشل في جلب معلومات التاجر');
        }

        const merchantProfiles = await merchantProfileResponse.json();
        if (!merchantProfiles || merchantProfiles.length === 0) {
            throw new Error('معلومات التاجر غير موجودة');
        }

        const merchantProfile = merchantProfiles[0];

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

        let action = 'created';
        let debt;
        let notificationMessage = '';

        if (existingDebts && existingDebts.length > 0) {
            // وجد دين موجود - سيتم تحديث المبلغ
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

            debt = (await updateResponse.json())[0];
            action = 'updated';
            notificationMessage = `تم إضافة ${amount} ريال على دينك عند التاجر ${merchantProfile.full_name}`;
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

            debt = (await insertResponse.json())[0];
            notificationMessage = `تم إنشاء دين جديد بقيمة ${amount} ريال عند التاجر ${merchantProfile.full_name}`;
        }

        // إنشاء إشعار للعميل
        try {
            // البحث عن العميل في users_profile
            const customerProfileResponse = await fetch(
                `${supabaseUrl}/rest/v1/users_profile?phone_number=eq.${customer_phone}&user_type=eq.customer&select=*`,
                {
                    headers: {
                        'Authorization': `Bearer ${supabaseKey}`,
                        'apikey': supabaseKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const customerProfiles = await customerProfileResponse.json();
            
            if (customerProfiles && customerProfiles.length > 0) {
                const customerProfile = customerProfiles[0];
                
                // إنشاء إشعار جديد للعميل
                const notificationResponse = await fetch(
                    `${supabaseUrl}/rest/v1/notifications`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${supabaseKey}`,
                            'apikey': supabaseKey,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({
                            customer_id: customerProfile.id,
                            title: 'دين جديد',
                            message: notificationMessage,
                            type: 'new_debt',
                            priority: 'high',
                            status: 'unread',
                            data: {
                                debt_id: debt.id,
                                merchant_name: merchantProfile.full_name,
                                amount: amount,
                                merchant_id: merchantId
                            }
                        })
                    }
                );

                if (!notificationResponse.ok) {
                    console.error('فشل في إنشاء الإشعار للعميل');
                }
            }
        } catch (notificationError) {
            console.error('خطأ في إرسال الإشعار:', notificationError);
            // لا نوقف العملية بسبب فشل إرسال الإشعار
        }

        // استدعاء auto-notifications للحصول على إشعارات متقدمة
        try {
            console.log('Triggering auto-notifications for new debt...');
            
            const autoNotifResponse = await fetch(`${supabaseUrl}/functions/v1/auto-notifications`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'trigger_debt_notification',
                    debt_id: debt.id,
                    customer_id: customerProfiles?.[0]?.id || null,
                    customer_phone: customer_phone,
                    customer_name: customer_name,
                    merchant_id: merchantId,
                    amount: amount,
                    description: description || null
                })
            });

            if (autoNotifResponse.ok) {
                console.log('Auto-notifications triggered successfully');
            } else {
                const errorText = await autoNotifResponse.text();
                console.error('Failed to trigger auto-notifications:', errorText);
            }
        } catch (autoNotifError) {
            console.error('Error triggering auto-notifications:', autoNotifError);
            // لا نوقف العملية بسبب فشل الإشعارات التلقائية
        }

        return new Response(JSON.stringify({ 
            data: {
                success: true,
                action: action,
                debt: debt,
                message: `تم ${action === 'created' ? 'إنشاء' : 'تحديث'} الدين بنجاح`,
                notification_sent: true
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

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