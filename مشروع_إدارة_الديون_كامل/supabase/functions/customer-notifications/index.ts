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
            case 'GET': {
                // جلب الإشعارات
                const { searchParams } = new URL(req.url);
                const filterType = searchParams.get('type');
                const filterStatus = searchParams.get('status');
                const filterPriority = searchParams.get('priority');
                const limit = searchParams.get('limit') || '50';
                const offset = searchParams.get('offset') || '0';

                let query = `${supabaseUrl}/rest/v1/notifications?customer_id=eq.${userId}&order=created_at.desc&limit=${limit}&offset=${offset}`;
                
                if (filterType && filterType !== 'all') {
                    query += `&type=eq.${filterType}`;
                }
                if (filterStatus && filterStatus !== 'all') {
                    query += `&status=eq.${filterStatus}`;
                }
                if (filterPriority && filterPriority !== 'all') {
                    query += `&priority=eq.${filterPriority}`;
                }

                const notificationsResponse = await fetch(query, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                });

                if (!notificationsResponse.ok) {
                    throw new Error('Failed to fetch notifications');
                }

                const notifications = await notificationsResponse.json();

                // حساب الإحصائيات
                const statsResponse = await fetch(`${supabaseUrl}/rest/v1/notifications?customer_id=eq.${userId}&select=status,type,priority`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                });

                const allNotifications = await statsResponse.json();
                const stats = {
                    total: allNotifications.length,
                    unread: allNotifications.filter(n => n.status === 'unread').length,
                    read: allNotifications.filter(n => n.status === 'read').length,
                    urgent: allNotifications.filter(n => n.priority === 'urgent').length,
                    high: allNotifications.filter(n => n.priority === 'high').length,
                    normal: allNotifications.filter(n => n.priority === 'normal').length,
                    reminder: allNotifications.filter(n => n.type === 'reminder').length,
                    payment_confirmed: allNotifications.filter(n => n.type === 'payment_confirmed').length,
                    objection: allNotifications.filter(n => n.type === 'objection').length,
                    objection_response: allNotifications.filter(n => n.type === 'objection_response').length,
                    new_debt: allNotifications.filter(n => n.type === 'new_debt').length
                };

                return new Response(JSON.stringify({
                    data: {
                        notifications,
                        stats
                    }
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            case 'PUT':
                // تحديث حالة الإشعار
                const updateData = await req.json();
                const { notification_id, status } = updateData;

                if (!notification_id || !status) {
                    throw new Error('Notification ID and status are required');
                }

                const updateResponse = await fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${notification_id}&customer_id=eq.${userId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        status,
                        updated_at: new Date().toISOString()
                    })
                });

                if (!updateResponse.ok) {
                    throw new Error('Failed to update notification');
                }

                const updatedNotification = await updateResponse.json();

                return new Response(JSON.stringify({
                    data: updatedNotification[0]
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            case 'DELETE':
                // حذف إشعار
                const deleteData = await req.json();
                const { notification_id: deleteId } = deleteData;

                if (!deleteId) {
                    throw new Error('Notification ID is required');
                }

                const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${deleteId}&customer_id=eq.${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                });

                if (!deleteResponse.ok) {
                    throw new Error('Failed to delete notification');
                }

                return new Response(JSON.stringify({
                    data: { success: true }
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            case 'POST':
                // تعليم جميع الإشعارات كمقروءة
                const postData = await req.json();
                const { action } = postData;

                if (action === 'mark_all_read') {
                    const markAllResponse = await fetch(`${supabaseUrl}/rest/v1/notifications?customer_id=eq.${userId}&status=eq.unread`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            status: 'read',
                            updated_at: new Date().toISOString()
                        })
                    });

                    if (!markAllResponse.ok) {
                        throw new Error('Failed to mark all notifications as read');
                    }

                    return new Response(JSON.stringify({
                        data: { success: true }
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                throw new Error('Invalid action');

            default:
                throw new Error('Method not allowed');
        }

    } catch (error) {
        console.error('Notifications API error:', error);

        const errorResponse = {
            error: {
                code: 'NOTIFICATIONS_API_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});