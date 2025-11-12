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

        const now = new Date();

        // البحث عن الإشعارات المجدولة للارسال
        const schedulesResponse = await fetch(
            `${supabaseUrl}/rest/v1/notification_schedules?sent=eq.false&scheduled_for=lte.${now.toISOString()}&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const schedules = await schedulesResponse.json();

        if (schedules.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No scheduled notifications to process',
                processed: 0
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let processedCount = 0;
        let errorCount = 0;

        for (const schedule of schedules) {
            try {
                await processScheduledNotification(supabaseUrl, serviceRoleKey, schedule);
                processedCount++;
            } catch (error) {
                console.error(`Error processing schedule ${schedule.id}:`, error);
                errorCount++;
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Scheduled notifications processed',
            data: {
                total_schedules: schedules.length,
                processed: processedCount,
                errors: errorCount,
                timestamp: now.toISOString()
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Scheduled Notifications Error:', error);

        return new Response(JSON.stringify({
            error: {
                code: 'SCHEDULED_NOTIFICATIONS_ERROR',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// دالة معالجة إشعار مجدول
async function processScheduledNotification(supabaseUrl: string, serviceRoleKey: string, schedule: any) {
    // جلب بيانات الدين
    const debtResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${schedule.debt_id}&select=*`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    const debts = await debtResponse.json();
    if (debts.length === 0) {
        throw new Error('Debt not found for schedule');
    }

    const debt = debts[0];

    // جلب بيانات العملاء والتجار
    const merchantResponse = await fetch(`${supabaseUrl}/rest/v1/users_profile?id=eq.${schedule.recipient_merchant_id || debt.merchant_id}&select=*`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    const merchants = await merchantResponse.json();
    const merchant = merchants[0];

    const customerResponse = await fetch(`${supabaseUrl}/rest/v1/users_profile?id=eq.${schedule.recipient_customer_id || debt.customer_id}&select=*`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    const customers = await customerResponse.json();
    const customer = customers[0];

    // حساب أيام التأخر
    const dueDate = new Date(debt.due_date);
    const daysOverdue = Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let notification = null;

    if (schedule.notification_type === 'merchant_reminder') {
        // إشعار تذكير للتاجر
        const message = daysOverdue <= 10 
            ? `مر ${daysOverdue} يوم على موعد سداد دين ${debt.amount} ر.س من ${debt.customer_name}. العميل بداية جيدة ولا يزال لديه فرصته. نرجو تذكيره بلطف أو التواصل معه.`
            : daysOverdue <= 20
            ? `مر ${daysOverdue} يوم على موعد سداد دين ${debt.amount} ر.س من ${debt.customer_name}. العميل لم يستجب للتذكير الأول. نرجو الاتصال به أو النظر في اتخاذ إجراءات.`
            : `مر ${daysOverdue} يوم على موعد سداد دين ${debt.amount} ر.س من ${debt.customer_name}. العميل معسر ولديه معوقات في السداد. نرجو النظر في كتابة الديون كمشفوعة أو أخذ ضمانات في المستقبل.`;

        const title = daysOverdue <= 10 ? "⏰ تذكير ودود" : daysOverdue <= 20 ? "📋 متابعة" : "⚠️ تحذير";

        notification = {
            id: crypto.randomUUID(),
            customer_id: debt.customer_id,
            merchant_id: debt.merchant_id,
            title: title,
            message: message,
            type: "reminder",
            status: "unread",
            priority: "high",
            debt_id: schedule.debt_id,
            data: {
                debt_amount: debt.amount,
                days_overdue: daysOverdue,
                customer_name: debt.customer_name,
                milestone_days: schedule.milestone_days
            },
            is_automated: true,
            notification_category: "reminder",
            notification_style: daysOverdue <= 10 ? "friendly" : "professional",
            milestone_days: schedule.milestone_days,
            sent_at: new Date().toISOString()
        };

    } else if (schedule.notification_type === 'customer_delay') {
        // إشعار تأخر للعميل
        const message = daysOverdue <= 10 
            ? `مر ${daysOverdue} يوم على التأخر في سداد ${debt.amount} ر.س من ${merchant.full_name}. نقدر معرفتك بقدرتك الوجدانية ونعلم أنك إنسان مخلص، لكنكبدأت تفقد ثقتنا. تأكد من أن هذا الدين مهم عندنا ويسجل في ملفك الائتماني. نرجو منك السداد لتجديد الثقة.`
            : daysOverdue <= 20
            ? `تحذير مهم! مر ${daysOverdue} يوماً على التأخر في سداد ${debt.amount} ر.س من ${merchant.full_name}. للأسف، مدى التزامك ضعيف في آخر 20 يوماً وهذا يؤثر على سجلك الائتماني. بعد 10 أيام أخرى، ستبقى في برنامج المتعثرين مما يؤثر على تعاملاتك المستقبلية. نرجو إما السداد أو التواصل مع التاجر لمعادلة الدين.`
            : `مر ${daysOverdue} يوم على موعد سداد دين ${debt.amount} ر.س من ${merchant.full_name}. الدين مدرج الآن في قائمة الديون المتأخرة. هذا يؤثر على علاقتك بالتاجر. نرجو التفاعل.`;

        const title = daysOverdue <= 10 ? "⚠️ تذكير مهم" : daysOverdue <= 20 ? "🚨 تحذير خطير" : "🚨 دين متأخر";

        notification = {
            id: crypto.randomUUID(),
            customer_id: debt.customer_id,
            merchant_id: debt.merchant_id,
            title: title,
            message: message,
            type: "overdue",
            status: "unread",
            priority: "high",
            debt_id: schedule.debt_id,
            data: {
                debt_amount: debt.amount,
                days_overdue: daysOverdue,
                merchant_name: merchant.full_name,
                milestone_days: schedule.milestone_days
            },
            is_automated: true,
            notification_category: "delay",
            notification_style: daysOverdue <= 10 ? "emotional" : "urgent",
            milestone_days: schedule.milestone_days,
            sent_at: new Date().toISOString()
        };
    }

    if (notification) {
        // حفظ الإشعار
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
            throw new Error('Failed to insert notification');
        }

        // تحديث حالة الجدولة
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/notification_schedules?id=eq.${schedule.id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sent: true,
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update schedule');
        }
    }
}