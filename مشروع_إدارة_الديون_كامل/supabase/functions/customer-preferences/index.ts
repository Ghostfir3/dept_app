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

        // معالجة طرق HTTP المختلفة
        switch (req.method) {
            case 'GET':
                // جلب تفضيلات المستخدم
                const preferencesResponse = await fetch(`${supabaseUrl}/rest/v1/user_preferences?user_id=eq.${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                });

                if (!preferencesResponse.ok) {
                    throw new Error('Failed to fetch preferences');
                }

                const preferences = await preferencesResponse.json();

                // إذا لم توجد تفضيلات، أنشئ إعدادات افتراضية
                if (preferences.length === 0) {
                    const defaultPreferences = {
                        user_id: userId,
                        theme: 'light',
                        language: 'ar',
                        notifications_enabled: true,
                        email_notifications: true,
                        push_notifications: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    const createResponse = await fetch(`${supabaseUrl}/rest/v1/user_preferences`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(defaultPreferences)
                    });

                    if (!createResponse.ok) {
                        throw new Error('Failed to create default preferences');
                    }

                    const newPreferences = await createResponse.json();
                    
                    return new Response(JSON.stringify({
                        data: newPreferences[0]
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify({
                    data: preferences[0]
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            case 'PUT':
            case 'POST':
                // تحديث أو إنشاء تفضيلات المستخدم
                const updateData = await req.json();
                const {
                    theme,
                    language,
                    notifications_enabled,
                    email_notifications,
                    push_notifications
                } = updateData;

                // التحقق من وجود البيانات المطلوبة
                if (theme === undefined && language === undefined && 
                    notifications_enabled === undefined && email_notifications === undefined && 
                    push_notifications === undefined) {
                    throw new Error('At least one preference field is required');
                }

                // إعداد البيانات للتحديث
                const updatePayload = {
                    updated_at: new Date().toISOString()
                };

                if (theme !== undefined) updatePayload.theme = theme;
                if (language !== undefined) updatePayload.language = language;
                if (notifications_enabled !== undefined) updatePayload.notifications_enabled = notifications_enabled;
                if (email_notifications !== undefined) updatePayload.email_notifications = email_notifications;
                if (push_notifications !== undefined) updatePayload.push_notifications = push_notifications;

                // التحقق من وجود تفضيلات مسبقة
                const existingResponse = await fetch(`${supabaseUrl}/rest/v1/user_preferences?user_id=eq.${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                });

                const existingPreferences = await existingResponse.json();

                let result;

                if (existingPreferences.length > 0) {
                    // تحديث التفضيلات الموجودة
                    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/user_preferences?user_id=eq.${userId}`, {
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
                        throw new Error('Failed to update preferences');
                    }

                    result = await updateResponse.json();
                } else {
                    // إنشاء تفضيلات جديدة
                    const createPayload = {
                        user_id: userId,
                        theme: theme || 'light',
                        language: language || 'ar',
                        notifications_enabled: notifications_enabled !== undefined ? notifications_enabled : true,
                        email_notifications: email_notifications !== undefined ? email_notifications : true,
                        push_notifications: push_notifications !== undefined ? push_notifications : true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    const createResponse = await fetch(`${supabaseUrl}/rest/v1/user_preferences`, {
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
                        throw new Error('Failed to create preferences');
                    }

                    result = await createResponse.json();
                }

                return new Response(JSON.stringify({
                    data: result[0]
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            default:
                throw new Error('Method not allowed');
        }

    } catch (error) {
        console.error('Preferences API error:', error);

        const errorResponse = {
            error: {
                code: 'PREFERENCES_API_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});