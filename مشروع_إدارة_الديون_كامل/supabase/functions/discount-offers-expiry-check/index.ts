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

        const now = new Date().toISOString();

        // Find all pending offers that have expired
        const expiredOffersResponse = await fetch(
            `${supabaseUrl}/rest/v1/discount_offers?status=eq.pending&valid_until=lt.${now}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!expiredOffersResponse.ok) {
            throw new Error('Failed to fetch expired offers');
        }

        const expiredOffers = await expiredOffersResponse.json();

        // Update all expired offers
        const results = [];

        for (const offer of expiredOffers) {
            const updateResponse = await fetch(
                `${supabaseUrl}/rest/v1/discount_offers?id=eq.${offer.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'expired',
                        expired_at: now
                    })
                }
            );

            if (updateResponse.ok) {
                results.push({
                    offer_id: offer.id,
                    customer_name: offer.customer_name,
                    merchant_id: offer.merchant_id,
                    expired_at: now
                });
            }
        }

        return new Response(JSON.stringify({
            data: {
                checked_at: now,
                expired_offers: results.length,
                results: results,
                message: `تم تحديث ${results.length} عرض منتهي الصلاحية`
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Expiry check error:', error);

        const errorResponse = {
            error: {
                code: 'EXPIRY_CHECK_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
