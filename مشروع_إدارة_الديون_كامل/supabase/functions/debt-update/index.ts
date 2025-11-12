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
            throw new Error('Access denied. Only merchants can update debts.');
        }

        // قراءة بيانات التحديث
        const updateData = await req.json();
        const { debt_id, amount, due_date, description, debt_type, update_reason, action, payment_amount } = updateData;

        if (!debt_id) {
            throw new Error('Debt ID is required');
        }

        // التحقق من أن الدين ينتمي للتاجر الحالي
        const checkResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${debt_id}&merchant_id=eq.${userId}&select=*,users_profile!customer_phone(id,full_name)`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        const checkData = await checkResponse.json();
        if (!checkData || checkData.length === 0) {
            throw new Error('Debt not found or access denied');
        }

        const debt = checkData[0];
        let notificationData = null;

        // إعداد البيانات للتحديث
        const updatePayload: any = {
            updated_at: new Date().toISOString()
        };

        if (action === 'confirm') {
            // تأكيد الدين
            updatePayload.status = 'confirmed';
            updatePayload.confirmed_at = new Date().toISOString();
            
            notificationData = {
                type: 'debt_confirmed',
                title: 'تأكيد الدين',
                message: `تم تأكيد دين بمبلغ ${debt.amount} ريال من العميل ${debt.customer_name || debt.customer_phone}`,
                priority: 'high',
                status: 'unread',
                merchant_id: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                extra_data: {
                    debt_id: debt_id,
                    customer_phone: debt.customer_phone,
                    customer_name: debt.customer_name,
                    amount: debt.amount
                }
            };

        } else if (action === 'payment') {
            // دفع جزئي أو كامل
            const currentPaid = parseFloat(debt.paid_amount || 0);
            const paymentAmount = parseFloat(payment_amount || 0);
            const totalAmount = parseFloat(debt.amount);
            const newPaidAmount = currentPaid + paymentAmount;
            const newRemainingAmount = Math.max(0, totalAmount - newPaidAmount);
            const newStatus = newRemainingAmount === 0 ? 'paid' : 'pending';

            updatePayload.paid_amount = newPaidAmount;
            updatePayload.remaining_amount = newRemainingAmount;
            updatePayload.status = newStatus;

            const isFullPayment = newRemainingAmount === 0;
            const title = isFullPayment ? 'تسديد الدين بالكامل' : 'دفع جزئي للدين';
            const message = isFullPayment ? 
                `تم تسديد الدين بالكامل بمبلغ ${totalAmount} ريال من العميل ${debt.customer_name || debt.customer_phone}` :
                `تم استلام دفعة بمبلغ ${paymentAmount} ريال من العميل ${debt.customer_name || debt.customer_phone}. المبلغ المتبقي: ${newRemainingAmount} ريال`;

            notificationData = {
                type: isFullPayment ? 'debt_paid' : 'debt_payment',
                title: title,
                message: message,
                priority: 'high',
                status: 'unread',
                merchant_id: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                extra_data: {
                    debt_id: debt_id,
                    customer_phone: debt.customer_phone,
                    customer_name: debt.customer_name,
                    payment_amount: paymentAmount,
                    total_amount: totalAmount,
                    paid_amount: newPaidAmount,
                    remaining_amount: newRemainingAmount,
                    is_full_payment: isFullPayment
                }
            };

        } else {
            // التحديث العادي (مبلغ، تاريخ، وصف)
            if (amount !== undefined && amount !== null) {
                updatePayload.amount = parseFloat(amount);
            }

            if (due_date !== undefined && due_date !== null) {
                updatePayload.due_date = due_date;
            }

            if (description !== undefined && description !== null) {
                updatePayload.description = description;
            }
        }

        // تحديث الدين
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/debts?id=eq.${debt_id}`, {
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
            throw new Error(`Failed to update debt: ${errorText}`);
        }

        const updatedDebt = await updateResponse.json();

        // إرسال الإشعار (إذا كان مطلوب)
        let notification = null;
        if (notificationData) {
            const notificationResponse = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(notificationData)
            });

            if (notificationResponse.ok) {
                const notificationResult = await notificationResponse.json();
                notification = notificationResult[0];
            }
        }

        return new Response(JSON.stringify({
            data: {
                debt: updatedDebt[0],
                notification: notification,
                message: 'تم تحديث الدين بنجاح',
                update_reason: update_reason || (action ? `تحديث ${action}` : 'تحديث من التاجر')
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Debt Update API error:', error);

        const errorResponse = {
            error: {
                code: 'DEBT_UPDATE_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
