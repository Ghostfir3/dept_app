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
        const { action, debt_id, notification_type, customer_id, merchant_id } = requestData;

        // استيراد قوالب الإشعارات
        const templates = {
            // Template functions will be available
        };

        switch (action) {
            case 'trigger_debt_notification':
                return await triggerDebtNotification(supabaseUrl, serviceRoleKey, requestData);
            
            case 'trigger_payment_notification':
                return await triggerPaymentNotification(supabaseUrl, serviceRoleKey, requestData);
            
            case 'schedule_delay_notifications':
                return await scheduleDelayNotifications(supabaseUrl, serviceRoleKey, debt_id);
            
            case 'process_payment_thanks':
                return await processPaymentThanks(supabaseUrl, serviceRoleKey, requestData);
            
            default:
                throw new Error(`Unknown action: ${action}`);
        }

    } catch (error) {
        console.error('Auto Notifications Error:', error);
        
        return new Response(JSON.stringify({
            error: {
                code: 'AUTO_NOTIFICATIONS_ERROR',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// دالة إضافة إشعار دين جديد
async function triggerDebtNotification(supabaseUrl: string, serviceRoleKey: string, data: any) {
    const { debt_id, customer_id, merchant_id } = data;

    // جلب بيانات الدين
    const debtResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${debt_id}&select=*`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!debtResponse.ok) {
        throw new Error('Failed to fetch debt data');
    }

    const debts = await debtResponse.json();
    if (debts.length === 0) {
        throw new Error('Debt not found');
    }

    const debt = debts[0];

    // جلب بيانات التاجر
    const merchantResponse = await fetch(`${supabaseUrl}/rest/v1/users_profile?id=eq.${merchant_id}&select=*`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    const merchants = await merchantResponse.json();
    const merchant = merchants[0];

    const notifications = [];

    // إشعار للعميل
    const customerNotification = {
        id: crypto.randomUUID(),
        customer_id: customer_id,
        merchant_id: merchant_id,
        title: "💰 دين جديد",
        message: `تم إضافة دين جديد من ${merchant.full_name} بمبلغ ${debt.amount} ر.س ${debt.description ? `لهذا السبب: ${debt.description}` : ''}`,
        type: "new_debt",
        status: "unread",
        priority: "high",
        debt_id: debt_id,
        data: {
            amount: debt.amount,
            description: debt.description,
            merchant_name: merchant.full_name,
            merchant_phone: merchant.phone_number
        },
        is_automated: true,
        notification_category: "debt",
        notification_style: "default",
        merchant_phone: merchant.phone_number
    };

    // إشعار للتاجر
    const merchantNotification = {
        id: crypto.randomUUID(),
        customer_id: customer_id,
        merchant_id: merchant_id,
        title: "📝 دين جديد",
        message: `تم إضافة دين جديد لمبلغ ${debt.amount} ر.س من العميل ${debt.customer_name}. ينتظر التأكيد.`,
        type: "new_debt",
        status: "unread",
        priority: "high",
        debt_id: debt_id,
        data: {
            amount: debt.amount,
            customer_name: debt.customer_name,
            customer_phone: debt.customer_phone,
            description: debt.description
        },
        is_automated: true,
        notification_category: "debt",
        notification_style: "default",
        merchant_phone: merchant.phone_number
    };

    // حفظ الإشعارات
    const notificationsToInsert = [customerNotification, merchantNotification];
    
    for (const notification of notificationsToInsert) {
        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notification)
        });

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            console.error('Failed to insert notification:', errorText);
            throw new Error(`Failed to insert notification: ${errorText}`);
        }
    }

    // جدولة إشعارات التأخير
    await scheduleDelayNotifications(supabaseUrl, serviceRoleKey, debt_id);

    return new Response(JSON.stringify({
        success: true,
        message: 'Debts notifications triggered successfully',
        data: {
            notifications_created: notificationsToInsert.length
        }
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// دالة إضافة إشعار سداد
async function triggerPaymentNotification(supabaseUrl: string, serviceRoleKey: string, data: any) {
    const { debt_id, payment_amount, payment_type, customer_phone, customer_name, merchant_id } = data;

    // جلب بيانات الدين
    const debtResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${debt_id}&select=*`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!debtResponse.ok) {
        throw new Error('Failed to fetch debt data');
    }

    const debts = await debtResponse.json();
    const debt = debts[0];

    if (!debt) {
        throw new Error('Debt not found');
    }

    // البحث عن customer_id بناءً على customer_phone
    let customer_id = null;
    const customerResponse = await fetch(`${supabaseUrl}/rest/v1/users_profile?phone_number=eq.${debt.customer_phone}&user_type=eq.customer&select=id`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (customerResponse.ok) {
        const customers = await customerResponse.json();
        if (customers && customers.length > 0) {
            customer_id = customers[0].id;
        }
    }

    // حساب المبلغ المسدد والمتبقي
    const paidAmount = parseFloat(payment_amount) + (debt.paid_amount ? parseFloat(debt.paid_amount) : 0);
    const totalDebtAmount = parseFloat(debt.amount);
    const remainingAmount = totalDebtAmount - paidAmount;
    const isFullPayment = remainingAmount <= 0;

    const notificationsToInsert = [];

    // إشعار للعميل (إذا وُجد customer_id)
    if (customer_id) {
        const customerNotification = {
            id: crypto.randomUUID(),
            customer_id: customer_id,
            merchant_id: debt.merchant_id,
            title: isFullPayment ? "🎉 تم السداد!" : "💳 سداد جزئي",
            message: isFullPayment 
                ? `تم دفع المبلغ كاملاً ${payment_amount} ر.س! 🙏 بارك الله فيك ونتطلع لبقية تعاملاتنا.`
                : `تم دفع مبلغ ${payment_amount} ر.س. المبلغ المتبقي: ${remainingAmount} ر.س. شكراً لتعاونك!`,
            type: "payment_confirmed",
            status: "unread",
            priority: "high",
            debt_id: debt_id,
            data: {
                payment_amount: payment_amount,
                remaining_amount: remainingAmount,
                is_full_payment: isFullPayment
            },
            is_automated: true,
            notification_category: "payment",
            notification_style: isFullPayment ? "emotional" : "friendly"
        };
        notificationsToInsert.push(customerNotification);
    }

    // إشعار للتاجر
    const merchantNotification = {
        id: crypto.randomUUID(),
        customer_id: customer_id, // يمكن أن يكون null
        merchant_id: debt.merchant_id,
        title: "💰 سداد مستلم",
        message: `تم استلام ${payment_amount} ر.س من ${debt.customer_name}. المبلغ المتبقي: ${remainingAmount} ر.س`,
        type: "payment_confirmed",
        status: "unread",
        priority: "high",
        debt_id: debt_id,
        data: {
            payment_amount: payment_amount,
            remaining_amount: remainingAmount,
            customer_name: debt.customer_name
        },
        is_automated: true,
        notification_category: "payment",
        notification_style: "professional"
    };
    notificationsToInsert.push(merchantNotification);
    
    for (const notification of notificationsToInsert) {
        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notification)
        });

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            console.error('Failed to insert payment notification:', errorText);
            throw new Error(`Failed to insert payment notification: ${errorText}`);
        }
    }

    // إذا كان السداد كاملاً، إرسال رسالة شكر
    if (isFullPayment && customer_id) {
        await processPaymentThanks(supabaseUrl, serviceRoleKey, { debt_id: debt_id, customer_id: customer_id, merchant_id: debt.merchant_id });
    }

    return new Response(JSON.stringify({
        success: true,
        message: 'Payment notifications sent successfully',
        data: {
            notifications_created: notificationsToInsert.length,
            is_full_payment: isFullPayment
        }
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// دالة جدولة إشعارات التأخير
async function scheduleDelayNotifications(supabaseUrl: string, serviceRoleKey: string, debtId: string) {
    // حذف الجدولة القديمة
    await fetch(`${supabaseUrl}/rest/v1/notification_schedules?debt_id=eq.${debtId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
        }
    });

    // جلب بيانات الدين
    const debtResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${debtId}&select=*`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    const debts = await debtResponse.json();
    const debt = debts[0];

    if (!debt.due_date) {
        return new Response(JSON.stringify({
            success: true,
            message: 'No due date set, delay notifications not scheduled'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const dueDate = new Date(debt.due_date);
    const schedules = [];

    // جدولة إشعارات التأخير (10, 20, 30 يوم)
    for (const milestone of [10, 20, 30]) {
        const scheduledDate = new Date(dueDate.getTime() + (milestone * 24 * 60 * 60 * 1000));
        
        // للتاجر
        schedules.push({
            id: crypto.randomUUID(),
            debt_id: debtId,
            notification_type: 'merchant_reminder',
            scheduled_for: scheduledDate.toISOString(),
            sent: false,
            milestone_days: milestone,
            recipient_merchant_id: debt.merchant_id
        });

        // للعميل
        schedules.push({
            id: crypto.randomUUID(),
            debt_id: debtId,
            notification_type: 'customer_delay',
            scheduled_for: scheduledDate.toISOString(),
            sent: false,
            milestone_days: milestone,
            recipient_customer_id: debt.customer_id
        });
    }

    // حفظ الجدولة
    for (const schedule of schedules) {
        await fetch(`${supabaseUrl}/rest/v1/notification_schedules`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(schedule)
        });
    }

    return new Response(JSON.stringify({
        success: true,
        message: 'Delay notifications scheduled successfully',
        data: {
            schedules_created: schedules.length
        }
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// دالة معالجة رسالة الشكر
async function processPaymentThanks(supabaseUrl: string, serviceRoleKey: string, data: any) {
    const { debt_id, customer_id, merchant_id } = data;

    // جلب بيانات الدين
    const debtResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${debt_id}&select=*`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!debtResponse.ok) {
        throw new Error('Failed to fetch debt data for thanks message');
    }

    const debts = await debtResponse.json();
    const debt = debts[0];

    if (!debt) {
        throw new Error('Debt not found for thanks message');
    }

    // جلب تاريخ سداد العميل
    const paymentHistoryResponse = await fetch(`${supabaseUrl}/rest/v1/debts?customer_id=eq.${customer_id}&status=eq.paid&select=id`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    const previousPayments = await paymentHistoryResponse.json();
    const isFirstPayment = previousPayments.length === 1;

    // إنشاء رسالة شكر مؤثرة
    const thanksMessage = isFirstPayment 
        ? `تم استلام المبلغ كاملاً ${debt.amount} ر.س! 🎉 نقدر جداً تقيك ووفائك. أنت من النوع الذي نثق به! بارك الله فيك وادخلك في كل خير.`
        : `تم استلام المبلغ كاملاً ${debt.amount} ر.س! 🤝 مرة أخرى تثبت أنك شخص مضمون ووفي. نقدر معاملتك ونثق بك دائماً. وفقك الله!`;

    const thanksNotification = {
        id: crypto.randomUUID(),
        customer_id: customer_id,
        merchant_id: merchant_id,
        title: "🙏 بارك الله فيك",
        message: thanksMessage,
        type: "payment_thanks",
        status: "unread",
        priority: "high",
        debt_id: debt_id,
        data: {
            amount: debt.amount,
            is_first_payment: isFirstPayment,
            customer_name: debt.customer_name
        },
        is_automated: true,
        notification_category: "thanks",
        notification_style: "emotional"
    };

    // حفظ إشعار الشكر
    const thanksResponse = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(thanksNotification)
    });

    if (!thanksResponse.ok) {
        const errorText = await thanksResponse.text();
        console.error('Failed to insert thanks notification:', errorText);
        throw new Error(`Failed to insert thanks notification: ${errorText}`);
    }

    return new Response(JSON.stringify({
        success: true,
        message: 'Payment thanks notification sent',
        data: {
            is_first_payment: isFirstPayment
        }
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}