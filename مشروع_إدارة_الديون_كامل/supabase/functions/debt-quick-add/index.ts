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

        // التحقق من نوع المستخدم (يجب أن يكون تاجر)
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
        if (userProfile.user_type !== 'merchant') {
            throw new Error('Access denied. Only merchants can add debts.');
        }

        // قراءة بيانات الدين الجديد
        const debtData = await req.json();
        const { 
            reference_debt_id, // معرف الدين المرجعي (لجلب معلومات العميل)
            customer_phone, 
            customer_name, 
            amount, 
            due_date, 
            description 
        } = debtData;

        // التحقق من البيانات المطلوبة
        if (!amount || parseFloat(amount) <= 0) {
            throw new Error('Invalid amount. Amount must be greater than 0.');
        }

        let finalCustomerPhone = customer_phone;
        let finalCustomerName = customer_name;

        // إذا تم توفير معرف دين مرجعي، جلب معلومات العميل منه
        if (reference_debt_id) {
            const refDebtResponse = await fetch(
                `${supabaseUrl}/rest/v1/debts?id=eq.${reference_debt_id}&merchant_id=eq.${userId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const refDebtData = await refDebtResponse.json();
            if (refDebtData && refDebtData.length > 0) {
                finalCustomerPhone = refDebtData[0].customer_phone;
                finalCustomerName = refDebtData[0].customer_name;
            }
        }

        // التحقق من توفر بيانات العميل
        if (!finalCustomerPhone || !finalCustomerName) {
            throw new Error('Customer phone and name are required');
        }

        // إنشاء الدين الجديد
        const newDebtPayload = {
            merchant_id: userId,
            customer_phone: finalCustomerPhone,
            customer_name: finalCustomerName,
            amount: parseFloat(amount),
            description: description || 'دين جديد',
            due_date: due_date || null,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const createResponse = await fetch(`${supabaseUrl}/rest/v1/debts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(newDebtPayload)
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Failed to create debt: ${errorText}`);
        }

        const newDebt = await createResponse.json();

        return new Response(JSON.stringify({
            data: {
                debt: newDebt[0],
                message: 'تم إضافة الدين بنجاح',
                linked_to: reference_debt_id || null
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Debt Quick Add API error:', error);

        const errorResponse = {
            error: {
                code: 'DEBT_QUICK_ADD_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
