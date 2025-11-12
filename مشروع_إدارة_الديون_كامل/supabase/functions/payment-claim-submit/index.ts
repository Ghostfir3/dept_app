Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token and get user
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
        const customerId = userData.id;

        // Get user profile
        const profileResponse = await fetch(
            `${supabaseUrl}/rest/v1/users_profile?id=eq.${customerId}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!profileResponse.ok) {
            throw new Error('Failed to fetch user profile');
        }

        const profiles = await profileResponse.json();
        if (profiles.length === 0) {
            throw new Error('User profile not found');
        }

        const customerProfile = profiles[0];

        // Get request data
        const requestData = await req.json();
        const { debt_id } = requestData;

        if (!debt_id) {
            throw new Error('Debt ID is required');
        }

        // Get debt details
        const debtResponse = await fetch(
            `${supabaseUrl}/rest/v1/debts?id=eq.${debt_id}&customer_phone=eq.${customerProfile.phone_number}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!debtResponse.ok) {
            throw new Error('Failed to fetch debt');
        }

        const debts = await debtResponse.json();
        if (debts.length === 0) {
            throw new Error('Debt not found');
        }

        const debt = debts[0];

        // Create notification for merchant
        const notificationResponse = await fetch(
            `${supabaseUrl}/rest/v1/notifications`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    user_id: debt.merchant_id,
                    type: 'payment_claim',
                    title: 'مطالبة بتسجيل سداد',
                    message: `العميل ${customerProfile.full_name} يطالب بتسجيل سداد للدين (${debt.amount} ريال)`,
                    metadata: {
                        debt_id: debt.id,
                        debt_amount: debt.amount,
                        customer_phone: customerProfile.phone_number,
                        customer_name: customerProfile.full_name
                    },
                    is_read: false
                })
            }
        );

        if (!notificationResponse.ok) {
            throw new Error('Failed to create notification');
        }

        return new Response(JSON.stringify({
            data: {
                success: true,
                message: 'تم إرسال المطالبة للتاجر بنجاح'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Payment claim submit error:', error);

        const errorResponse = {
            error: {
                code: 'PAYMENT_CLAIM_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
