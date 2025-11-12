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

        // الحصول على بيانات المستخدم
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

        if (req.method === 'GET') {
            // جلب الإشعارات للمستخدم
            const { searchParams } = new URL(req.url);
            const limit = parseInt(searchParams.get('limit') || '20');
            const offset = parseInt(searchParams.get('offset') || '0');
            const status = searchParams.get('status') || 'all'; // all, unread, read
            const type = searchParams.get('type') || 'all'; // all, debt_confirmed, debt_paid, etc.

            // بناء الاستعلام حسب نوع المستخدم
            let notificationsQuery = `${supabaseUrl}/rest/v1/notifications?`;
            
            if (userProfile.user_type === 'merchant') {
                notificationsQuery += `merchant_id=eq.${userId}`;
            } else {
                notificationsQuery += `customer_id=eq.${userId}`;
            }

            // تطبيق فلاتر
            if (status === 'unread') {
                notificationsQuery += `&status=neq.read`;
            } else if (status === 'read') {
                notificationsQuery += `&status=eq.read`;
            }

            if (type !== 'all') {
                notificationsQuery += `&type=eq.${type}`;
            }

            // ترتيب أحدث الإشعارات أولاً
            notificationsQuery += `&order=created_at.desc&limit=${limit}&offset=${offset}`;

            const notificationsResponse = await fetch(notificationsQuery, {
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

            // حساب العدد الإجمالي
            let countQuery = notificationsQuery.replace(/&order=created_at\.desc&limit=\d+&offset=\d+/, '');
            countQuery += `&select=count`;

            const countResponse = await fetch(countQuery, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'count=exact'
                }
            });

            const totalCount = countResponse.headers.get('content-range')?.split('/')[1] || notifications.length;

            // الحصول على عدد الإشعارات غير المقروءة
            let unreadCount = 0;
            if (userProfile.user_type === 'merchant') {
                const unreadResponse = await fetch(`${supabaseUrl}/rest/v1/notifications?merchant_id=eq.${userId}&status=neq.read&select=count`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'count=exact'
                    }
                });
                unreadCount = parseInt(unreadResponse.headers.get('content-range')?.split('/')[1] || '0');
            } else {
                const unreadResponse = await fetch(`${supabaseUrl}/rest/v1/notifications?customer_id=eq.${userId}&status=neq.read&select=count`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'count=exact'
                    }
                });
                unreadCount = parseInt(unreadResponse.headers.get('content-range')?.split('/')[1] || '0');
            }

            return new Response(JSON.stringify({
                data: {
                    notifications,
                    pagination: {
                        total_count: parseInt(totalCount),
                        current_page: Math.floor(offset / limit) + 1,
                        total_pages: Math.ceil(parseInt(totalCount) / limit),
                        has_next: (parseInt(offset) + limit) < parseInt(totalCount),
                        has_previous: parseInt(offset) > 0
                    },
                    unread_count: unreadCount
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } else if (req.method === 'POST') {
            // إنشاء إشعار جديد
            const requestData = await req.json();
            const { type, message, title, debt_id, customer_id, merchant_id, priority, extra_data } = requestData;

            if (!type || !message || !title) {
                throw new Error('Missing required fields: type, title, message');
            }

            // تحديد المستلم بناءً على نوع المستخدم
            let recipientId = userId;
            let recipientType = userProfile.user_type;

            // إذا كان المستخدم تاجر ويريد إرسال إشعار للعميل
            if (userProfile.user_type === 'merchant' && customer_id) {
                recipientId = customer_id;
                recipientType = 'customer';
            }
            // إذا كان المستخدم عميل ويريد إرسال إشعار للتاجر
            else if (userProfile.user_type === 'customer' && merchant_id) {
                recipientId = merchant_id;
                recipientType = 'merchant';
            }

            // إنشاء الإشعار
            const notificationData = {
                type,
                title,
                message,
                priority: priority || 'normal',
                status: 'unread',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (debt_id) {
                notificationData.debt_id = debt_id;
            }

            if (recipientType === 'merchant') {
                notificationData.merchant_id = recipientId;
            } else {
                notificationData.customer_id = recipientId;
            }

            if (extra_data) {
                notificationData.extra_data = extra_data;
            }

            const createResponse = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(notificationData)
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Failed to create notification: ${errorText}`);
            }

            const newNotification = await createResponse.json();

            return new Response(JSON.stringify({
                data: {
                    notification: newNotification[0]
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } else if (req.method === 'PATCH') {
            // تحديث إشعار (مثل تعليمه كمقروء)
            const requestData = await req.json();
            const { notification_id, status } = requestData;

            if (!notification_id) {
                throw new Error('notification_id is required');
            }

            const updateData = {
                status: status || 'read',
                updated_at: new Date().toISOString()
            };

            let updateQuery = `${supabaseUrl}/rest/v1/notifications?id=eq.${notification_id}`;
            
            if (userProfile.user_type === 'merchant') {
                updateQuery += `&merchant_id=eq.${userId}`;
            } else {
                updateQuery += `&customer_id=eq.${userId}`;
            }

            const updateResponse = await fetch(updateQuery, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updateData)
            });

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                throw new Error(`Failed to update notification: ${errorText}`);
            }

            const updatedNotification = await updateResponse.json();

            return new Response(JSON.stringify({
                data: {
                    notification: updatedNotification[0]
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
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
