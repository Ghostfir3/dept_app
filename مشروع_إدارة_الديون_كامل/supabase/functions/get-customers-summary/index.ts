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

        // استخراج token من التفويض
        const token = authHeader.replace('Bearer ', '');
        
        // التحقق من صحة المستخدم
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

        // جلب جميع الديون مع السدادات
        const debtsResponse = await fetch(
            `${supabaseUrl}/rest/v1/debts?merchant_id=eq.${merchantId}&order=created_at.desc`,
            {
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!debtsResponse.ok) {
            throw new Error('فشل في جلب الديون');
        }

        const debts = await debtsResponse.json();

        // جلب معلومات التاجر
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

        let merchantProfile = null;
        if (merchantProfileResponse.ok) {
            const merchantProfiles = await merchantProfileResponse.json();
            merchantProfile = merchantProfiles && merchantProfiles.length > 0 ? merchantProfiles[0] : null;
        }

        // جلب السدادات
        const paymentsResponse = await fetch(
            `${supabaseUrl}/rest/v1/payment_transactions?merchant_id=eq.${merchantId}&order=created_at.desc`,
            {
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const payments = paymentsResponse.ok ? await paymentsResponse.json() : [];

        // حساب المبلغ المسدد لكل دين
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

        // تجميع الديون حسب العميل
        const customersMap: Record<string, any> = {};

        debts.forEach((debt: any) => {
            const customerKey = debt.customer_phone;
            
            if (!customersMap[customerKey]) {
                customersMap[customerKey] = {
                    customer_phone: debt.customer_phone,
                    customer_name: debt.customer_name,
                    debts: [],
                    total_original_amount: 0,
                    total_paid_amount: 0,
                    total_remaining_amount: 0,
                    status_counts: {
                        pending: 0,
                        confirmed: 0,
                        paid: 0,
                        disputed: 0
                    },
                    latest_debt_date: debt.created_at,
                    has_overdue: false
                };
            }

            const customer = customersMap[customerKey];
            const paidAmount = paidAmounts[debt.id] || 0;
            const remainingAmount = debt.amount - paidAmount;

            customer.debts.push({
                ...debt,
                paid_amount: paidAmount,
                remaining_amount: remainingAmount
            });

            customer.total_original_amount += debt.amount;
            customer.total_paid_amount += paidAmount;
            customer.total_remaining_amount += remainingAmount;
            customer.status_counts[debt.status as keyof typeof customer.status_counts]++;

            // تحديث أحدث تاريخ
            if (new Date(debt.created_at) > new Date(customer.latest_debt_date)) {
                customer.latest_debt_date = debt.created_at;
            }

            // فحص التأخير
            if (debt.due_date && 
                new Date(debt.due_date) < new Date() && 
                debt.status !== 'paid') {
                customer.has_overdue = true;
            }
        });

        // تحويل إلى مصفوفة وترتيب حسب أحدث دين
        const customers = Object.values(customersMap).sort((a, b) => 
            new Date(b.latest_debt_date).getTime() - new Date(a.latest_debt_date).getTime()
        );

        // حساب الإحصائيات العامة
        const stats = {
            total_customers: customers.length,
            total_original_amount: customers.reduce((sum: number, c: any) => sum + c.total_original_amount, 0),
            total_paid_amount: customers.reduce((sum: number, c: any) => sum + c.total_paid_amount, 0),
            total_remaining_amount: customers.reduce((sum: number, c: any) => sum + c.total_remaining_amount, 0),
            pending_amount: customers.reduce((sum: number, c: any) => {
                return sum + c.debts.filter((d: any) => d.status === 'pending')
                    .reduce((debtSum: number, d: any) => debtSum + d.remaining_amount, 0);
            }, 0),
            confirmed_amount: customers.reduce((sum: number, c: any) => {
                return sum + c.debts.filter((d: any) => d.status === 'confirmed')
                    .reduce((debtSum: number, d: any) => debtSum + d.remaining_amount, 0);
            }, 0),
            paid_amount: customers.reduce((sum: number, c: any) => {
                return sum + c.debts.filter((d: any) => d.status === 'paid')
                    .reduce((debtSum: number, d: any) => debtSum + d.amount, 0);
            }, 0),
            overdue_amount: customers.reduce((sum: number, c: any) => {
                return sum + c.debts.filter((d: any) => 
                    d.due_date && 
                    new Date(d.due_date) < new Date() && 
                    d.status !== 'paid'
                ).reduce((debtSum: number, d: any) => debtSum + d.remaining_amount, 0);
            }, 0),
            overdue_customers: customers.filter((c: any) => c.has_overdue).length
        };

        return new Response(JSON.stringify({ 
            data: {
                customers,
                stats,
                merchant_profile: merchantProfile ? {
                    id: merchantProfile.id,
                    full_name: merchantProfile.full_name,
                    phone_number: merchantProfile.phone_number,
                    business_name: merchantProfile.business_name
                } : null
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('خطأ في جلب بيانات العملاء المجمعة:', error);
        
        const errorResponse = {
            error: {
                code: 'GET_CUSTOMERS_ERROR',
                message: error.message || 'حدث خطأ غير متوقع'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});