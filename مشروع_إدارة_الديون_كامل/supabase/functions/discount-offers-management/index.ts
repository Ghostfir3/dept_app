Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PATCH, DELETE',
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
        const userId = userData.id;

        // Get user profile
        const profileResponse = await fetch(
            `${supabaseUrl}/rest/v1/users_profile?id=eq.${userId}`,
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

        const userProfile = profiles[0];

        // Handle different HTTP methods
        if (req.method === 'GET') {
            // Get discount offers
            const url = new URL(req.url);
            const offerId = url.searchParams.get('id');
            const status = url.searchParams.get('status');

            let query = `${supabaseUrl}/rest/v1/discount_offers?`;

            if (userProfile.user_type === 'merchant') {
                query += `merchant_id=eq.${userId}`;
            } else {
                query += `customer_phone=eq.${userProfile.phone_number}`;
            }

            if (offerId) {
                query += `&id=eq.${offerId}`;
            }

            if (status) {
                query += `&status=eq.${status}`;
            }

            query += '&order=created_at.desc';

            const offersResponse = await fetch(query, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!offersResponse.ok) {
                throw new Error('Failed to fetch offers');
            }

            const offers = await offersResponse.json();

            return new Response(JSON.stringify({
                data: offers
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } else if (req.method === 'POST') {
            // Create new discount offer (merchant only)
            if (userProfile.user_type !== 'merchant') {
                throw new Error('Only merchants can create discount offers');
            }

            const offerData = await req.json();
            const {
                customer_phone,
                customer_name,
                original_amount,
                discount_percentage,
                valid_days,
                custom_message,
                merchant_notes
            } = offerData;

            // Validate required fields
            if (!customer_phone || !customer_name || !original_amount || !discount_percentage) {
                throw new Error('Missing required fields');
            }

            if (discount_percentage <= 0 || discount_percentage > 100) {
                throw new Error('Invalid discount percentage');
            }

            // Calculate discounted amount and savings
            const discountedAmount = original_amount * (1 - discount_percentage / 100);
            const savingsAmount = original_amount - discountedAmount;

            // Calculate valid until date
            const validUntil = new Date();
            validUntil.setDate(validUntil.getDate() + (valid_days || 3));

            // Create offer
            const insertResponse = await fetch(
                `${supabaseUrl}/rest/v1/discount_offers`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        merchant_id: userId,
                        customer_phone,
                        customer_name,
                        original_amount: parseFloat(original_amount),
                        discount_percentage: parseInt(discount_percentage),
                        discounted_amount: parseFloat(discountedAmount.toFixed(2)),
                        savings_amount: parseFloat(savingsAmount.toFixed(2)),
                        valid_until: validUntil.toISOString(),
                        custom_message: custom_message || null,
                        merchant_notes: merchant_notes || null,
                        status: 'pending'
                    })
                }
            );

            if (!insertResponse.ok) {
                const errorText = await insertResponse.text();
                throw new Error(`Failed to create offer: ${errorText}`);
            }

            const newOffer = await insertResponse.json();

            return new Response(JSON.stringify({
                data: {
                    offer: newOffer[0],
                    message: 'تم إنشاء عرض الخصم بنجاح'
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } else if (req.method === 'PATCH') {
            // Update offer status
            const url = new URL(req.url);
            const offerId = url.searchParams.get('id');

            if (!offerId) {
                throw new Error('Offer ID is required');
            }

            const updateData = await req.json();
            const { action, rejection_reason } = updateData;

            // Validate action
            if (!['accept', 'reject', 'cancel'].includes(action)) {
                throw new Error('Invalid action');
            }

            // Prepare update payload
            const updatePayload = {};

            if (action === 'accept') {
                if (userProfile.user_type !== 'customer') {
                    throw new Error('Only customers can accept offers');
                }
                updatePayload.status = 'accepted';
                updatePayload.accepted_at = new Date().toISOString();
            } else if (action === 'reject') {
                if (userProfile.user_type !== 'customer') {
                    throw new Error('Only customers can reject offers');
                }
                updatePayload.status = 'rejected';
                updatePayload.rejected_at = new Date().toISOString();
                if (rejection_reason) {
                    updatePayload.customer_rejection_reason = rejection_reason;
                }
            } else if (action === 'cancel') {
                if (userProfile.user_type !== 'merchant') {
                    throw new Error('Only merchants can cancel offers');
                }
                updatePayload.status = 'cancelled';
                updatePayload.cancelled_at = new Date().toISOString();
            }

            // Update offer
            const updateResponse = await fetch(
                `${supabaseUrl}/rest/v1/discount_offers?id=eq.${offerId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(updatePayload)
                }
            );

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                throw new Error(`Failed to update offer: ${errorText}`);
            }

            const updatedOffer = await updateResponse.json();

            return new Response(JSON.stringify({
                data: {
                    offer: updatedOffer[0],
                    message: `تم ${action === 'accept' ? 'قبول' : action === 'reject' ? 'رفض' : 'إلغاء'} العرض بنجاح`
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } else if (req.method === 'DELETE') {
            // Delete offer (merchant only)
            if (userProfile.user_type !== 'merchant') {
                throw new Error('Only merchants can delete offers');
            }

            const url = new URL(req.url);
            const offerId = url.searchParams.get('id');

            if (!offerId) {
                throw new Error('Offer ID is required');
            }

            const deleteResponse = await fetch(
                `${supabaseUrl}/rest/v1/discount_offers?id=eq.${offerId}&merchant_id=eq.${userId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!deleteResponse.ok) {
                throw new Error('Failed to delete offer');
            }

            return new Response(JSON.stringify({
                data: {
                    message: 'تم حذف العرض بنجاح'
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        console.error('Discount offers management error:', error);

        const errorResponse = {
            error: {
                code: 'DISCOUNT_OFFERS_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
