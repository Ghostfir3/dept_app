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
        console.log('🔍 Objections API - New Request');
        
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Missing environment configuration');
        }

        // Authentication check
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('Authorization required');
        }

        const token = authHeader.replace('Bearer ', '');
        
        // Verify user authentication
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid or expired token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        if (!userId) {
            throw new Error('Invalid user data');
        }

        // Check user profile
        const profileResponse = await fetch(`${supabaseUrl}/rest/v1/users_profile?id=eq.${userId}&select=user_type`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!profileResponse.ok) {
            throw new Error('Failed to fetch user profile');
        }

        const profileData = await profileResponse.json();
        if (!profileData || !profileData[0] || profileData[0].user_type !== 'merchant') {
            throw new Error('Access denied. Only merchants can manage objections.');
        }

        console.log('✅ Merchant authenticated:', userId);

        // Handle different HTTP methods
        switch (req.method) {
            case 'GET':
                return await handleGetRequest(req, supabaseUrl, serviceRoleKey, userId, corsHeaders);
            
            case 'PUT':
                return await handlePutRequest(req, supabaseUrl, serviceRoleKey, userId, corsHeaders);
            
            case 'POST':
                return await handlePostRequest(req, supabaseUrl, serviceRoleKey, userId, corsHeaders);
            
            case 'DELETE':
                return await handleDeleteRequest(req, supabaseUrl, serviceRoleKey, userId, corsHeaders);
            
            default:
                throw new Error('Method not allowed');
        }

    } catch (error) {
        console.error('💥 Objections API Error:', error.message);
        
        const errorResponse = {
            error: {
                code: 'OBJECTIONS_API_ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

async function handleGetRequest(req, supabaseUrl, serviceRoleKey, userId, corsHeaders) {
    console.log('📋 Processing GET request for objections...');
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    console.log('🔍 Query params:', { status, search, page, limit, offset });

    // Get objections for this merchant
    let objectionsUrl = `${supabaseUrl}/rest/v1/objections?select=*&offset=${offset}&limit=${limit}&order=created_at.desc`;
    
    // Filter by status if not 'all'
    if (status !== 'all') {
        objectionsUrl += `&status=eq.${status}`;
    }

    // Search filter will be applied after we have objections and can match against debt info
    const objectionsResponse = await fetch(objectionsUrl, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!objectionsResponse.ok) {
        throw new Error('Failed to fetch objections');
    }

    let objections = await objectionsResponse.json();
    
    // Filter by merchant (through debts)
    const debtIds = objections.map(o => o.debt_id);
    
    if (debtIds.length === 0) {
        return new Response(JSON.stringify({
            data: {
                objections: [],
                pagination: { total_count: 0, current_page: 1, total_pages: 0 },
                stats: { total: 0, pending: 0, resolved: 0, rejected: 0 }
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Get debts for these objections
    const debtsUrl = `${supabaseUrl}/rest/v1/debts?select=*&id=in.(${debtIds.join(',')})&merchant_id=eq.${userId}`;
    
    const debtsResponse = await fetch(debtsUrl, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    const debts = debtsResponse.ok ? await debtsResponse.json() : [];
    
    // Filter objections to only include those belonging to this merchant
    const allowedDebtIds = debts.map(d => d.id);
    objections = objections.filter(obj => allowedDebtIds.includes(obj.debt_id));
    
    // Apply search filter if provided
    if (search) {
        objections = objections.filter(obj => {
            const debt = debts.find(d => d.id === obj.debt_id);
            const searchableText = `${obj.title} ${obj.description} ${debt?.customer_name || ''} ${debt?.customer_phone || ''}`;
            return searchableText.toLowerCase().includes(search.toLowerCase());
        });
    }
    
    // Manual join with debt data
    const enrichedObjections = objections.map(obj => {
        const debt = debts.find(d => d.id === obj.debt_id);
        return {
            ...obj,
            debts: debt || null
        };
    });

    // Get total count for pagination
    const countUrl = `${supabaseUrl}/rest/v1/objections?select=id`;
    const allObjectionsResponse = await fetch(countUrl, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    let totalCount = 0;
    if (allObjectionsResponse.ok) {
        const allObjections = await allObjectionsResponse.json();
        // Filter count by merchant and search
        const allDebtIds = allObjections.map(o => o.debt_id);
        const allDebtsUrl = `${supabaseUrl}/rest/v1/debts?select=id&id=in.(${allDebtIds.join(',')})&merchant_id=eq.${userId}`;
        
        const allDebtsResponse = await fetch(allDebtsUrl, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (allDebtsResponse.ok) {
            const allDebts = await allDebtsResponse.json();
            const allowedAllDebtIds = allDebts.map(d => d.id);
            totalCount = allObjections.filter(obj => allowedAllDebtIds.includes(obj.debt_id)).length;
        }
    }

    // Calculate stats
    const stats = {
        total: enrichedObjections.length,
        pending: enrichedObjections.filter(o => o.status === 'pending').length,
        resolved: enrichedObjections.filter(o => o.status === 'resolved').length,
        rejected: enrichedObjections.filter(o => o.status === 'rejected').length
    };

    console.log('✅ Stats:', stats);

    const responseData = {
        data: {
            objections: enrichedObjections,
            pagination: {
                total_count: totalCount,
                current_page: page,
                total_pages: Math.ceil(totalCount / limit),
                has_next: page * limit < totalCount,
                has_previous: page > 1
            },
            stats
        }
    };

    return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

async function handlePutRequest(req, supabaseUrl, serviceRoleKey, userId, corsHeaders) {
    const updateData = await req.json();
    const { objection_id, merchant_response, status } = updateData;

    if (!objection_id) {
        throw new Error('Objection ID is required');
    }

    // Verify objection belongs to this merchant
    const objectionResponse = await fetch(`${supabaseUrl}/rest/v1/objections?id=eq.${objection_id}&select=debt_id`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!objectionResponse.ok) {
        throw new Error('Failed to fetch objection');
    }

    const objectionData = await objectionResponse.json();
    if (!objectionData || objectionData.length === 0) {
        throw new Error('Objection not found');
    }

    const debtId = objectionData[0].debt_id;
    
    // Verify debt belongs to merchant
    const debtResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${debtId}&merchant_id=eq.${userId}`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!debtResponse.ok) {
        throw new Error('Access denied');
    }

    const debtData = await debtResponse.json();
    if (!debtData || debtData.length === 0) {
        throw new Error('Access denied');
    }

    // Update objection
    const updatePayload = {
        updated_at: new Date().toISOString()
    };

    if (merchant_response !== undefined) {
        updatePayload.merchant_response = merchant_response;
        updatePayload.response_date = new Date().toISOString();
    }

    if (status !== undefined) {
        updatePayload.status = status;
    }

    const updateUrl = `${supabaseUrl}/rest/v1/objections?id=eq.${objection_id}`;
    
    const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(updatePayload)
    });

    if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update objection: ${errorText}`);
    }

    const updateResult = await updateResponse.json();

    return new Response(JSON.stringify({ data: updateResult[0] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

async function handlePostRequest(req, supabaseUrl, serviceRoleKey, userId, corsHeaders) {
    const createData = await req.json();
    const { debt_id, customer_id, title, description } = createData;

    if (!debt_id || !customer_id || !title || !description) {
        throw new Error('Missing required fields: debt_id, customer_id, title, description');
    }

    // Verify debt belongs to merchant
    const debtResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${debt_id}&merchant_id=eq.${userId}`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!debtResponse.ok) {
        throw new Error('Access denied');
    }

    const debtData = await debtResponse.json();
    if (!debtData || debtData.length === 0) {
        throw new Error('Debt not found or access denied');
    }

    // Create objection
    const createPayload = {
        debt_id,
        customer_id,
        title,
        description,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const createUrl = `${supabaseUrl}/rest/v1/objections`;
    
    const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(createPayload)
    });

    if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create objection: ${errorText}`);
    }

    const newObjection = await createResponse.json();

    return new Response(JSON.stringify({ data: newObjection[0] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

async function handleDeleteRequest(req, supabaseUrl, serviceRoleKey, userId, corsHeaders) {
    const deleteData = await req.json();
    const { objection_id } = deleteData;

    if (!objection_id) {
        throw new Error('Objection ID is required');
    }

    // Verify objection belongs to this merchant
    const objectionResponse = await fetch(`${supabaseUrl}/rest/v1/objections?id=eq.${objection_id}&select=debt_id`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!objectionResponse.ok) {
        throw new Error('Failed to fetch objection');
    }

    const objectionData = await objectionResponse.json();
    if (!objectionData || objectionData.length === 0) {
        throw new Error('Objection not found');
    }

    const debtId = objectionData[0].debt_id;
    
    // Verify debt belongs to merchant
    const debtResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${debtId}&merchant_id=eq.${userId}`, {
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!debtResponse.ok) {
        throw new Error('Access denied');
    }

    const debtData = await debtResponse.json();
    if (!debtData || debtData.length === 0) {
        throw new Error('Access denied');
    }

    // Delete objection
    const deleteUrl = `${supabaseUrl}/rest/v1/objections?id=eq.${objection_id}`;
    
    const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        }
    });

    if (!deleteResponse.ok) {
        throw new Error('Failed to delete objection');
    }

    return new Response(JSON.stringify({ data: { success: true } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}