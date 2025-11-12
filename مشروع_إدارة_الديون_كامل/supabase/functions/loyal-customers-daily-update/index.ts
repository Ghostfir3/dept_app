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

        const results = {
            auto_add: null,
            badges_update: null,
            expiry_check: null,
            timestamp: new Date().toISOString()
        };

        // Step 1: Run auto-add function
        try {
            const autoAddResponse = await fetch(
                `${supabaseUrl}/functions/v1/loyal-customers-auto-add`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (autoAddResponse.ok) {
                results.auto_add = await autoAddResponse.json();
            } else {
                results.auto_add = { error: 'Failed to execute auto-add' };
            }
        } catch (error) {
            results.auto_add = { error: error.message };
        }

        // Step 2: Run badges update function
        try {
            const badgesResponse = await fetch(
                `${supabaseUrl}/functions/v1/loyal-customers-badges-update`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (badgesResponse.ok) {
                results.badges_update = await badgesResponse.json();
            } else {
                results.badges_update = { error: 'Failed to execute badges update' };
            }
        } catch (error) {
            results.badges_update = { error: error.message };
        }

        // Step 3: Run expiry check function
        try {
            const expiryResponse = await fetch(
                `${supabaseUrl}/functions/v1/discount-offers-expiry-check`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (expiryResponse.ok) {
                results.expiry_check = await expiryResponse.json();
            } else {
                results.expiry_check = { error: 'Failed to execute expiry check' };
            }
        } catch (error) {
            results.expiry_check = { error: error.message };
        }

        return new Response(JSON.stringify({
            data: {
                message: 'تم تشغيل التحديثات اليومية بنجاح',
                results: results
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Daily update error:', error);

        const errorResponse = {
            error: {
                code: 'DAILY_UPDATE_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
