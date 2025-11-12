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

        // قراءة معاملات الطلب
        let requestData = {};
        if (req.method === 'POST') {
            requestData = await req.json();
        } else if (req.method === 'GET') {
            const { searchParams } = new URL(req.url);
            requestData = Object.fromEntries(searchParams.entries());
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

        // معاملات الفلترة
        const status = requestData.status || 'all';
        const dateRange = requestData.date_range || 'all';
        const page = parseInt(requestData.page || '1');
        const limit = parseInt(requestData.limit || '20');
        const offset = (page - 1) * limit;

        // بناء استعلام الديون
        let debtsQuery = `${supabaseUrl}/rest/v1/debts?customer_phone=eq.${userProfile.phone_number}&select=*`;

        // تطبيق فلتر الحالة
        if (status !== 'all' && status !== 'overdue') {
            debtsQuery += `&status=eq.${status}`;
        }

        // تطبيق فلتر التاريخ
        if (dateRange !== 'all') {
            const now = new Date();
            let startDate;
            
            switch (dateRange) {
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
            }
            
            if (startDate) {
                debtsQuery += `&created_at=gte.${startDate.toISOString()}`;
            }
        }

        // تطبيق الترتيب والتصفح
        debtsQuery += `&order=created_at.desc&limit=${limit}&offset=${offset}`;

        console.log('Debts Query:', debtsQuery);

        // تنفيذ الاستعلام
        const debtsResponse = await fetch(debtsQuery, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!debtsResponse.ok) {
            const errorText = await debtsResponse.text();
            throw new Error(`Failed to fetch debts: ${errorText}`);
        }

        const debts = await debtsResponse.json();

        // الحصول على معلومات التجار بشكل منفصل
        const merchantIds = [...new Set(debts.map(d => d.merchant_id))];
        let merchantsData = {};

        if (merchantIds.length > 0) {
            const merchantsQuery = `${supabaseUrl}/rest/v1/users_profile?id=in.(${merchantIds.map(id => `"${id}"`).join(',')})&select=id,full_name,phone_number`;
            const merchantsResponse = await fetch(merchantsQuery, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            });

            if (merchantsResponse.ok) {
                const merchants = await merchantsResponse.json();
                merchantsData = merchants.reduce((acc, merchant) => {
                    acc[merchant.id] = merchant;
                    return acc;
                }, {});
            }
        }

        // معالجة البيانات - إضافة معلومات السداد واسم التاجر
        const processedDebts = debts.map(debt => {
            const isOverdue = debt.due_date && 
                             new Date(debt.due_date) < new Date() && 
                             debt.status !== 'paid';
            
            // الحصول على معلومات التاجر
            const merchant = merchantsData[debt.merchant_id];
            const merchantName = merchant ? merchant.full_name : 'تاجر غير معروف';
            const merchantPhone = merchant ? merchant.phone_number : null;

            // حساب المبلغ المتبقي والمدفوع
            const paidAmount = debt.paid_amount ? parseFloat(debt.paid_amount) : 0;
            const totalAmount = debt.amount || 0;
            const remainingAmount = debt.remaining_amount || (totalAmount - paidAmount);
            
            return {
                ...debt,
                // حقول أساسية للسداد
                debt_amount: totalAmount,
                paid_amount: paidAmount,
                remaining_amount: remainingAmount,
                // معلومات التاجر
                merchant_name: merchantName,
                merchant_phone: merchantPhone,
                // حالة الدين
                display_status: isOverdue ? 'overdue' : debt.status,
                days_overdue: isOverdue ? 
                    Math.floor((new Date().getTime() - new Date(debt.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0
            };
        });

        // حساب العدد الإجمالي (بدون pagination)
        let countQuery = `${supabaseUrl}/rest/v1/debts?customer_phone=eq.${userProfile.phone_number}&select=id`;
        if (status !== 'all' && status !== 'overdue') {
            countQuery += `&status=eq.${status}`;
        }
        if (dateRange !== 'all') {
            const now = new Date();
            let startDate;
            
            switch (dateRange) {
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
            }
            
            if (startDate) {
                countQuery += `&created_at=gte.${startDate.toISOString()}`;
            }
        }

        const countResponse = await fetch(countQuery, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'count=exact'
            }
        });

        const totalCount = countResponse.headers.get('content-range')?.split('/')[1] || processedDebts.length;

        // الحصول على قائمة التجار الفريدين
        const merchants = [...new Map(processedDebts.map(item => 
            [item.merchant_id, item.merchant_name]
        ))];

        return new Response(JSON.stringify({
            data: {
                debts: processedDebts,
                pagination: {
                    total_count: parseInt(totalCount),
                    current_page: page,
                    total_pages: Math.ceil(parseInt(totalCount) / limit),
                    has_next: page * limit < parseInt(totalCount),
                    has_previous: page > 1
                },
                filters: {
                    available_merchants: merchants.map(m => m[1]),
                    applied_filters: {
                        status,
                        date_range: dateRange,
                        sort_by: 'created_at',
                        sort_order: 'desc'
                    }
                }
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Debts History API error:', error);

        const errorResponse = {
            error: {
                code: 'DEBTS_HISTORY_API_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});