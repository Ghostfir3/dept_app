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

        // Get all loyal customers
        const customersResponse = await fetch(
            `${supabaseUrl}/rest/v1/loyal_customers?status=eq.active`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!customersResponse.ok) {
            throw new Error('Failed to fetch loyal customers');
        }

        const customers = await customersResponse.json();
        const results = [];

        // Process each customer
        for (const customer of customers) {
            // Get all paid debts for this customer
            const debtsResponse = await fetch(
                `${supabaseUrl}/rest/v1/debts?merchant_id=eq.${customer.merchant_id}&customer_phone=eq.${customer.customer_phone}&status=eq.paid&select=created_at,paid_at`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!debtsResponse.ok) {
                console.error(`Failed to fetch debts for customer ${customer.customer_phone}`);
                continue;
            }

            const paidDebts = await debtsResponse.json();

            // Calculate payment days for each debt
            const paymentDays = [];
            let fastestPayment = null;

            for (const debt of paidDebts) {
                if (debt.paid_at && debt.created_at) {
                    const createdDate = new Date(debt.created_at);
                    const paidDate = new Date(debt.paid_at);
                    const daysDiff = Math.ceil((paidDate - createdDate) / (1000 * 60 * 60 * 24));
                    
                    if (daysDiff >= 0) {
                        paymentDays.push(daysDiff);
                        if (fastestPayment === null || daysDiff < fastestPayment) {
                            fastestPayment = daysDiff;
                        }
                    }
                }
            }

            // Calculate average payment days
            let averagePaymentDays = null;
            let badgeType = 'none';
            let reliabilityScore = 0;

            if (paymentDays.length > 0) {
                const sum = paymentDays.reduce((a, b) => a + b, 0);
                averagePaymentDays = sum / paymentDays.length;

                // Determine badge based on average payment days
                // Platinum: fastest (<=1 day), Gold: fast (<=5 days), Silver: normal (<=10 days)
                if (averagePaymentDays <= 1) {
                    badgeType = 'platinum';
                    reliabilityScore = 95 + Math.min(5, paymentDays.length);
                } else if (averagePaymentDays <= 5) {
                    badgeType = 'gold';
                    reliabilityScore = 75 + Math.min(15, paymentDays.length * 2);
                } else if (averagePaymentDays <= 10) {
                    badgeType = 'silver';
                    reliabilityScore = 60 + Math.min(10, paymentDays.length);
                } else {
                    badgeType = 'none';
                    reliabilityScore = Math.max(0, 50 - (averagePaymentDays - 10) * 2);
                }

                // Cap reliability score at 100
                reliabilityScore = Math.min(100, reliabilityScore);
            }

            // Update customer badge
            const updateResponse = await fetch(
                `${supabaseUrl}/rest/v1/loyal_customers?id=eq.${customer.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        badge_type: badgeType,
                        average_payment_days: averagePaymentDays,
                        fastest_payment_days: fastestPayment,
                        payment_reliability_score: reliabilityScore,
                        total_transactions: paidDebts.length
                    })
                }
            );

            if (updateResponse.ok) {
                results.push({
                    customer_phone: customer.customer_phone,
                    customer_name: customer.customer_name,
                    badge_type: badgeType,
                    average_payment_days: averagePaymentDays,
                    reliability_score: reliabilityScore,
                    paid_debts: paidDebts.length
                });
            }
        }

        return new Response(JSON.stringify({
            data: {
                processed_customers: customers.length,
                updated_customers: results.length,
                results: results,
                message: `تم تحديث شارات ${results.length} عميل بنجاح`
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Badges update error:', error);

        const errorResponse = {
            error: {
                code: 'BADGES_UPDATE_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
