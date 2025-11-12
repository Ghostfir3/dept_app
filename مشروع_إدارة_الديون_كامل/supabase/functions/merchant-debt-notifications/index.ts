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

        // التحقق من نوع المستخدم (يجب أن يكون تاجر)
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
        if (userProfile.user_type !== 'merchant') {
            throw new Error('Access denied. Only merchants can send notifications.');
        }

        // قراءة بيانات الإشعار
        const notificationData = await req.json();
        const { 
            title, 
            message, 
            type = 'info', 
            priority = 'normal',
            customer_data // بيانات إضافية للإشعار
        } = notificationData;

        // التحقق من البيانات المطلوبة
        if (!title || !message) {
            throw new Error('Title and message are required');
        }

        // إنشاء إشعار للتاجر
        const merchantNotificationResponse = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                customer_id: userId, // استخدام customer_id للتجار أيضاً
                title: title,
                message: message,
                type: type,
                priority: priority,
                status: 'unread',
                data: customer_data || {}
            })
        });

        if (!merchantNotificationResponse.ok) {
            const errorText = await merchantNotificationResponse.text();
            throw new Error(`Failed to create merchant notification: ${errorText}`);
        }

        const newNotification = await merchantNotificationResponse.json();

        // إذا تم توفير بيانات العميل، إرسال إشعار للعميل أيضاً
        if (customer_data && customer_data.customer_phone) {
            try {
                // البحث عن العميل في users_profile
                const customerProfileResponse = await fetch(
                    `${supabaseUrl}/rest/v1/users_profile?phone_number=eq.${customer_data.customer_phone}&user_type=eq.customer&select=*`,
                    {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const customerProfiles = await customerProfileResponse.json();
                
                if (customerProfiles && customerProfiles.length > 0) {
                    const customerProfile = customerProfiles[0];
                    
                    // إنشاء إشعار للعميل
                    const customerNotificationResponse = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({
                            customer_id: customerProfile.id,
                            title: title.replace('[التاجر]', '[عميل]'),
                            message: message,
                            type: type,
                            priority: priority,
                            status: 'unread',
                            data: customer_data
                        })
                    });

                    if (!customerNotificationResponse.ok) {
                        console.error('فشل في إنشاء الإشعار للعميل');
                    }
                }
            } catch (customerError) {
                console.error('خطأ في إرسال الإشعار للعميل:', customerError);
            }
        }

        return new Response(JSON.stringify({
            data: {
                notification: newNotification[0],
                message: 'تم إرسال الإشعار بنجاح',
                sent_to_merchant: true,
                sent_to_customer: customer_data && customer_data.customer_phone ? true : false
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Merchant Notifications API error:', error);

        const errorResponse = {
            error: {
                code: 'MERCHANT_NOTIFICATIONS_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});