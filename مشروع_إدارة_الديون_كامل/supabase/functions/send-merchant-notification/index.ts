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
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        const requestData = await req.json();
        const { 
            merchant_id, 
            customer_phone, 
            customer_name, 
            action, 
            debt_id, 
            amount, 
            paid_amount, 
            remaining_amount,
            title,
            message,
            type
        } = requestData;

        if (!merchant_id || !action) {
            throw new Error('merchant_id and action are required');
        }

        // تحديد نوع الإشعار والعنوان والرسالة
        let notificationType = type;
        let notificationTitle = title;
        let notificationMessage = message;

        if (!notificationTitle || !notificationMessage) {
            if (action === 'confirm') {
                notificationType = 'debt_confirmed';
                notificationTitle = 'تأكيد الدين';
                notificationMessage = `تم تأكيد دين بمبلغ ${amount} ريال من العميل ${customer_name || customer_phone}`;
            } else if (action === 'payment') {
                const isFullPayment = remaining_amount === 0;
                notificationType = isFullPayment ? 'debt_paid' : 'debt_payment';
                notificationTitle = isFullPayment ? 'تسديد الدين بالكامل' : 'دفع جزئي للدين';
                notificationMessage = isFullPayment ? 
                    `تم تسديد الدين بالكامل بمبلغ ${amount} ريال من العميل ${customer_name || customer_phone}` :
                    `تم استلام دفعة بمبلغ ${paid_amount} ريال من العميل ${customer_name || customer_phone}. المبلغ المتبقي: ${remaining_amount} ريال`;
            } else {
                throw new Error('Invalid action type');
            }
        }

        // إنشاء الإشعار للتاجر
        const notificationData = {
            customer_id: merchant_id, // نستخدم customer_id لتخزين merchant_id مؤقتاً
            title: notificationTitle,
            message: notificationMessage,
            type: notificationType,
            status: 'unread',
            priority: 'high',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            merchant_id: merchant_id, // نخزن merchant_id هنا أيضاً
            data: {
                customer_phone,
                customer_name,
                debt_id,
                amount,
                paid_amount,
                remaining_amount,
                action
            },
            extra_data: {
                is_merchant_notification: true,
                original_customer: customer_phone
            }
        };

        // حفظ الإشعار في قاعدة البيانات
        const response = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(notificationData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create notification: ${errorText}`);
        }

        const newNotification = await response.json();

        return new Response(JSON.stringify({
            data: {
                notification: newNotification[0],
                message: 'تم إرسال الإشعار بنجاح'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Send merchant notification error:', error);

        const errorResponse = {
            error: {
                code: 'SEND_NOTIFICATION_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
