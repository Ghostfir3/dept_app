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

        // التحقق من التوثيق
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // التحقق من المستخدم
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        // الحصول على بيانات العميل
        const profileResponse = await fetch(`${supabaseUrl}/rest/v1/users_profile?id=eq.${userId}`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!profileResponse.ok) {
            throw new Error('Failed to fetch user profile');
        }

        const profiles = await profileResponse.json();
        if (profiles.length === 0) {
            throw new Error('User profile not found');
        }

        const userProfile = profiles[0];

        // جلب جميع ديون العميل
        const allDebtsResponse = await fetch(`${supabaseUrl}/rest/v1/debts?customer_phone=eq.${userProfile.phone_number}&select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!allDebtsResponse.ok) {
            throw new Error('Failed to fetch debts');
        }

        const allDebts = await allDebtsResponse.json();

        // حساب التواريخ
        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const currentYear = new Date(now.getFullYear(), 0, 1);
        const previousYear = new Date(now.getFullYear() - 1, 0, 1);

        // تصنيف الديون
        const totalDebts = allDebts.length;
        const totalAmount = allDebts.reduce((sum, debt) => sum + debt.amount, 0);

        // حسب الحالة
        const paidDebts = allDebts.filter(debt => debt.status === 'paid');
        const pendingDebts = allDebts.filter(debt => debt.status === 'pending');
        const confirmedDebts = allDebts.filter(debt => debt.status === 'confirmed');
        const disputedDebts = allDebts.filter(debt => debt.status === 'disputed');

        // الديون المتأخرة
        const overdueDebts = allDebts.filter(debt => 
            debt.due_date && 
            new Date(debt.due_date) < now && 
            debt.status !== 'paid'
        );

        // حساب المبالغ
        const paidAmount = paidDebts.reduce((sum, debt) => sum + debt.amount, 0);
        const pendingAmount = pendingDebts.reduce((sum, debt) => sum + debt.amount, 0);
        const confirmedAmount = confirmedDebts.reduce((sum, debt) => sum + debt.amount, 0);
        const overdueAmount = overdueDebts.reduce((sum, debt) => sum + debt.amount, 0);

        // معدل السداد
        const paymentRate = totalDebts > 0 ? (paidDebts.length / totalDebts) * 100 : 0;

        // أعلى وأقل دين
        const amounts = allDebts.map(debt => debt.amount);
        const highestDebt = allDebts.find(debt => debt.amount === Math.max(...amounts));
        const lowestDebt = allDebts.find(debt => debt.amount === Math.min(...amounts));

        // أقدم دين غير مدفوع
        const unpaidDebts = allDebts.filter(debt => debt.status !== 'paid');
        const oldestUnpaidDebt = unpaidDebts.length > 0 ? 
            unpaidDebts.reduce((oldest, debt) => 
                new Date(debt.created_at) < new Date(oldest.created_at) ? debt : oldest
            ) : null;

        // إحصائيات الشهر الحالي مقابل السابق
        const currentMonthDebts = allDebts.filter(debt => 
            new Date(debt.created_at) >= currentMonth
        );
        const previousMonthDebts = allDebts.filter(debt => 
            new Date(debt.created_at) >= previousMonth && 
            new Date(debt.created_at) < currentMonth
        );

        const currentMonthAmount = currentMonthDebts.reduce((sum, debt) => sum + debt.amount, 0);
        const previousMonthAmount = previousMonthDebts.reduce((sum, debt) => sum + debt.amount, 0);

        const monthlyGrowth = previousMonthAmount > 0 ? 
            ((currentMonthAmount - previousMonthAmount) / previousMonthAmount) * 100 : 0;

        // إحصائيات السنة الحالية مقابل السابقة
        const currentYearDebts = allDebts.filter(debt => 
            new Date(debt.created_at) >= currentYear
        );
        const previousYearDebts = allDebts.filter(debt => 
            new Date(debt.created_at) >= previousYear && 
            new Date(debt.created_at) < currentYear
        );

        const currentYearAmount = currentYearDebts.reduce((sum, debt) => sum + debt.amount, 0);
        const previousYearAmount = previousYearDebts.reduce((sum, debt) => sum + debt.amount, 0);

        const yearlyGrowth = previousYearAmount > 0 ? 
            ((currentYearAmount - previousYearAmount) / previousYearAmount) * 100 : 0;

        // توزيع الديون حسب التاجر
        const merchantStats = {};
        allDebts.forEach(debt => {
            if (!merchantStats[debt.merchant_name]) {
                merchantStats[debt.merchant_name] = {
                    count: 0,
                    total_amount: 0,
                    paid_count: 0,
                    paid_amount: 0
                };
            }
            merchantStats[debt.merchant_name].count++;
            merchantStats[debt.merchant_name].total_amount += debt.amount;
            
            if (debt.status === 'paid') {
                merchantStats[debt.merchant_name].paid_count++;
                merchantStats[debt.merchant_name].paid_amount += debt.amount;
            }
        });

        // توزيع الديون حسب الشهر (آخر 12 شهر)
        const monthlyDistribution = [];
        for (let i = 11; i >= 0; i--) {
            const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            
            const monthDebts = allDebts.filter(debt => {
                const debtDate = new Date(debt.created_at);
                return debtDate >= month && debtDate < nextMonth;
            });

            monthlyDistribution.push({
                month: month.toISOString().substr(0, 7), // YYYY-MM format
                month_name: month.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' }),
                count: monthDebts.length,
                total_amount: monthDebts.reduce((sum, debt) => sum + debt.amount, 0),
                paid_count: monthDebts.filter(debt => debt.status === 'paid').length,
                paid_amount: monthDebts.filter(debt => debt.status === 'paid').reduce((sum, debt) => sum + debt.amount, 0)
            });
        }

        // متوسط المبلغ والوقت
        const averageAmount = totalDebts > 0 ? totalAmount / totalDebts : 0;
        
        // حساب متوسط وقت السداد للديون المدفوعة
        const paidDebtsWithDueDate = paidDebts.filter(debt => debt.due_date);
        let averagePaymentTime = 0;
        if (paidDebtsWithDueDate.length > 0) {
            const totalPaymentDays = paidDebtsWithDueDate.reduce((sum, debt) => {
                const dueDate = new Date(debt.due_date);
                const paidDate = new Date(debt.updated_at || debt.created_at);
                const daysDiff = Math.max(0, Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
                return sum + daysDiff;
            }, 0);
            averagePaymentTime = totalPaymentDays / paidDebtsWithDueDate.length;
        }

        // تجميع النتائج النهائية
        const stats = {
            // الإحصائيات الأساسية
            overview: {
                total_debts: totalDebts,
                total_amount: totalAmount,
                average_amount: averageAmount,
                payment_rate: paymentRate
            },

            // توزيع حسب الحالة
            status_distribution: {
                paid: {
                    count: paidDebts.length,
                    amount: paidAmount,
                    percentage: totalDebts > 0 ? (paidDebts.length / totalDebts) * 100 : 0
                },
                pending: {
                    count: pendingDebts.length,
                    amount: pendingAmount,
                    percentage: totalDebts > 0 ? (pendingDebts.length / totalDebts) * 100 : 0
                },
                confirmed: {
                    count: confirmedDebts.length,
                    amount: confirmedAmount,
                    percentage: totalDebts > 0 ? (confirmedDebts.length / totalDebts) * 100 : 0
                },
                disputed: {
                    count: disputedDebts.length,
                    amount: disputedDebts.reduce((sum, debt) => sum + debt.amount, 0),
                    percentage: totalDebts > 0 ? (disputedDebts.length / totalDebts) * 100 : 0
                },
                overdue: {
                    count: overdueDebts.length,
                    amount: overdueAmount,
                    percentage: totalDebts > 0 ? (overdueDebts.length / totalDebts) * 100 : 0
                }
            },

            // المقارنات الزمنية
            time_comparison: {
                monthly: {
                    current_month: {
                        count: currentMonthDebts.length,
                        amount: currentMonthAmount
                    },
                    previous_month: {
                        count: previousMonthDebts.length,
                        amount: previousMonthAmount
                    },
                    growth_percentage: monthlyGrowth
                },
                yearly: {
                    current_year: {
                        count: currentYearDebts.length,
                        amount: currentYearAmount
                    },
                    previous_year: {
                        count: previousYearDebts.length,
                        amount: previousYearAmount
                    },
                    growth_percentage: yearlyGrowth
                }
            },

            // مؤشرات الأداء الرئيسية
            key_metrics: {
                highest_debt: highestDebt ? {
                    amount: highestDebt.amount,
                    merchant_name: highestDebt.merchant_name,
                    created_at: highestDebt.created_at
                } : null,
                lowest_debt: lowestDebt ? {
                    amount: lowestDebt.amount,
                    merchant_name: lowestDebt.merchant_name,
                    created_at: lowestDebt.created_at
                } : null,
                oldest_unpaid_debt: oldestUnpaidDebt ? {
                    amount: oldestUnpaidDebt.amount,
                    merchant_name: oldestUnpaidDebt.merchant_name,
                    created_at: oldestUnpaidDebt.created_at,
                    days_old: Math.floor((now.getTime() - new Date(oldestUnpaidDebt.created_at).getTime()) / (1000 * 60 * 60 * 24))
                } : null,
                average_payment_time: averagePaymentTime
            },

            // توزيع حسب التاجر
            merchant_distribution: Object.entries(merchantStats)
                .map(([name, stats]) => ({
                    merchant_name: name,
                    ...stats,
                    payment_rate: stats.count > 0 ? (stats.paid_count / stats.count) * 100 : 0
                }))
                .sort((a, b) => b.total_amount - a.total_amount),

            // التوزيع الشهري
            monthly_distribution: monthlyDistribution
        };

        return new Response(JSON.stringify({
            data: stats
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Debts Stats API error:', error);

        const errorResponse = {
            error: {
                code: 'DEBTS_STATS_API_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});