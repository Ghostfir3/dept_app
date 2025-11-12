Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Get all merchants
        const merchantsResponse = await fetch(
            `${supabaseUrl}/rest/v1/users_profile?user_type=eq.merchant`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!merchantsResponse.ok) {
            throw new Error('Failed to fetch merchants');
        }

        const merchants = await merchantsResponse.json();
        const results = [];

        // Process each merchant
        for (const merchant of merchants) {
            // Get weekly transactions (debts created in last 7 days)
            const debtsResponse = await fetch(
                `${supabaseUrl}/rest/v1/debts?merchant_id=eq.${merchant.id}&created_at=gte.${sevenDaysAgo.toISOString()}&select=customer_phone,customer_name,created_at`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!debtsResponse.ok) {
                console.error(`Failed to fetch debts for merchant ${merchant.id}`);
                continue;
            }

            const debts = await debtsResponse.json();

            // Group by customer phone
            const customerTransactions = {};
            for (const debt of debts) {
                if (!customerTransactions[debt.customer_phone]) {
                    customerTransactions[debt.customer_phone] = {
                        name: debt.customer_name,
                        count: 0
                    };
                }
                customerTransactions[debt.customer_phone].count++;
            }

            // Check each customer for eligibility (>= 4 transactions)
            for (const [phone, data] of Object.entries(customerTransactions)) {
                if (data.count >= 4) {
                    // Check if customer already exists in loyal_customers
                    const existingResponse = await fetch(
                        `${supabaseUrl}/rest/v1/loyal_customers?merchant_id=eq.${merchant.id}&customer_phone=eq.${phone}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    const existing = await existingResponse.json();

                    if (existing.length === 0) {
                        // Get total transactions count
                        const totalDebtsResponse = await fetch(
                            `${supabaseUrl}/rest/v1/debts?merchant_id=eq.${merchant.id}&customer_phone=eq.${phone}&select=created_at`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        const totalDebts = await totalDebtsResponse.json();

                        // Add new loyal customer
                        const insertResponse = await fetch(
                            `${supabaseUrl}/rest/v1/loyal_customers`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=representation'
                                },
                                body: JSON.stringify({
                                    merchant_id: merchant.id,
                                    customer_phone: phone,
                                    customer_name: data.name,
                                    addition_type: 'auto',
                                    addition_reason: `تمت الإضافة تلقائياً (${data.count} تعاملات في آخر 7 أيام)`,
                                    weekly_transactions: data.count,
                                    total_transactions: totalDebts.length,
                                    last_transaction_date: new Date().toISOString(),
                                    status: 'active'
                                })
                            }
                        );

                        if (insertResponse.ok) {
                            const newCustomer = await insertResponse.json();
                            results.push({
                                merchant_id: merchant.id,
                                customer_phone: phone,
                                customer_name: data.name,
                                weekly_transactions: data.count,
                                status: 'added'
                            });
                        }
                    } else {
                        // Update existing customer
                        const updateResponse = await fetch(
                            `${supabaseUrl}/rest/v1/loyal_customers?id=eq.${existing[0].id}`,
                            {
                                method: 'PATCH',
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    weekly_transactions: data.count,
                                    last_transaction_date: new Date().toISOString()
                                })
                            }
                        );

                        if (updateResponse.ok) {
                            results.push({
                                merchant_id: merchant.id,
                                customer_phone: phone,
                                customer_name: data.name,
                                weekly_transactions: data.count,
                                status: 'updated'
                            });
                        }
                    }
                }
            }
        }

        return new Response(JSON.stringify({
            data: {
                processed_merchants: merchants.length,
                processed_customers: results.length,
                results: results,
                message: `تمت معالجة ${results.length} عميل بنجاح`
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Auto-add loyal customers error:', error);

        const errorResponse = {
            error: {
                code: 'AUTO_ADD_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
