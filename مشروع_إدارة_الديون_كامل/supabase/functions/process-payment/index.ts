Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

        console.log('[process-payment] Starting payment processing...');

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
        const merchantId = userData.id;

        console.log('[process-payment] Merchant ID:', merchantId);

        // Get request data
        const requestData = await req.json();
        const { customer_phone, customer_name, amount, selected_debt_ids, notes } = requestData;

        console.log('[process-payment] Request data:', { customer_phone, customer_name, amount, debts_count: selected_debt_ids?.length });

        // Validate input
        if (!customer_phone || !amount || amount <= 0) {
            throw new Error('Invalid input data');
        }

        // Get selected debts
        let debtsQuery = `${supabaseUrl}/rest/v1/debts?merchant_id=eq.${merchantId}&customer_phone=eq.${customer_phone}&status=in.(pending,confirmed)&order=created_at.asc`;
        
        if (selected_debt_ids && selected_debt_ids.length > 0) {
            debtsQuery += `&id=in.(${selected_debt_ids.join(',')})`;
        }

        const debtsResponse = await fetch(debtsQuery, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!debtsResponse.ok) {
            const errorText = await debtsResponse.text();
            console.error('[process-payment] Failed to fetch debts:', errorText);
            throw new Error('Failed to fetch debts');
        }

        const debts = await debtsResponse.json();
        console.log('[process-payment] Fetched debts:', debts.length);

        // Get all payments to calculate remaining amounts correctly
        const paymentsResponse = await fetch(
            `${supabaseUrl}/rest/v1/payment_transactions?merchant_id=eq.${merchantId}&order=created_at.desc`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!paymentsResponse.ok) {
            const errorText = await paymentsResponse.text();
            console.error('[process-payment] Failed to fetch payments:', errorText);
            throw new Error('Failed to fetch payments');
        }

        const payments = await paymentsResponse.json();
        
        // Calculate paid amounts for each debt
        const paidAmounts: Record<string, number> = {};
        if (payments) {
            payments.forEach((transaction: any) => {
                if (transaction.debts_paid && Array.isArray(transaction.debts_paid)) {
                    transaction.debts_paid.forEach((debtPaid: any) => {
                        const debtId = debtPaid.debt_id;
                        const amountPaid = debtPaid.amount_paid || 0;
                        paidAmounts[debtId] = (paidAmounts[debtId] || 0) + amountPaid;
                    });
                }
            });
        }

        // Add remaining_amount to each debt
        const debtsWithRemaining = debts.map((debt: any) => ({
            ...debt,
            paid_amount: paidAmounts[debt.id] || 0,
            remaining_amount: debt.amount - (paidAmounts[debt.id] || 0)
        }));

        if (debts.length === 0) {
            throw new Error('No debts found');
        }

        // Distribute payment amount across debts (oldest first)
        let remainingAmount = parseFloat(amount);
        const debtsPaid = [];
        const debtsToUpdate = [];

        for (const debt of debtsWithRemaining) {
            if (remainingAmount <= 0) break;

            // Skip debts that are already fully paid
            if (debt.remaining_amount <= 0.01) continue;

            const debtRemaining = debt.remaining_amount;
            const amountToPay = Math.min(remainingAmount, debtRemaining);

            const newPaidAmount = (debt.paid_amount || 0) + amountToPay;
            const newRemainingAmount = debt.amount - newPaidAmount;

            debtsPaid.push({
                debt_id: debt.id,
                amount_paid: amountToPay,
                remaining: newRemainingAmount,
                debt_description: debt.description || 'بدون وصف'
            });

            debtsToUpdate.push({
                id: debt.id,
                paid_amount: newPaidAmount,
                remaining_amount: newRemainingAmount,
                status: newRemainingAmount <= 0.01 ? 'paid' : 'confirmed',
                paid_at: newRemainingAmount <= 0.01 ? new Date().toISOString() : debt.paid_at
            });

            remainingAmount -= amountToPay;
        }

        console.log('[process-payment] Debts to update:', debtsToUpdate.length);

        // Update debts one by one
        let updatedCount = 0;
        for (const debtUpdate of debtsToUpdate) {
            const updateResponse = await fetch(
                `${supabaseUrl}/rest/v1/debts?id=eq.${debtUpdate.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        paid_amount: debtUpdate.paid_amount,
                        remaining_amount: debtUpdate.remaining_amount,
                        status: debtUpdate.status,
                        paid_at: debtUpdate.paid_at
                    })
                }
            );

            if (updateResponse.ok) {
                updatedCount++;
                console.log(`[process-payment] Successfully updated debt ${debtUpdate.id}`);
            } else {
                const errorText = await updateResponse.text();
                console.error(`[process-payment] Failed to update debt ${debtUpdate.id}:`, errorText);
            }
        }

        console.log('[process-payment] Updated debts:', updatedCount, 'of', debtsToUpdate.length);

        // Create payment transaction record
        const transactionResponse = await fetch(
            `${supabaseUrl}/rest/v1/payment_transactions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    merchant_id: merchantId,
                    customer_phone,
                    customer_name,
                    total_amount: parseFloat(amount),
                    payment_method: 'cash',
                    notes: notes || null,
                    debts_paid: debtsPaid
                })
            }
        );

        if (!transactionResponse.ok) {
            const errorText = await transactionResponse.text();
            console.error('[process-payment] Failed to create transaction:', errorText);
            throw new Error('Failed to create transaction record');
        }

        const transaction = await transactionResponse.json();
        console.log('[process-payment] Transaction created:', transaction[0]?.id);

        // Create notification for merchant
        const notificationMessage = `تم تسجيل سداد بمبلغ ${parseFloat(amount).toFixed(2)} ريال من العميل ${customer_name}`;
        
        const notificationResponse = await fetch(
            `${supabaseUrl}/rest/v1/notifications`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    merchant_id: merchantId,
                    type: 'payment_received',
                    message: notificationMessage,
                    metadata: {
                        transaction_id: transaction[0]?.id,
                        customer_phone,
                        customer_name,
                        amount: parseFloat(amount),
                        debts_count: debtsPaid.length
                    },
                    is_read: false
                })
            }
        );

        if (notificationResponse.ok) {
            console.log('[process-payment] Notification created successfully');
        } else {
            const errorText = await notificationResponse.text();
            console.error('[process-payment] Failed to create notification:', errorText);
        }

        // استدعاء auto-notifications لإرسال إشعارات متقدمة
        try {
            console.log('[process-payment] Triggering auto-notifications...');
            
            // إشعار للعميل والتاجر عن السداد
            const firstDebt = debtsToUpdate[0]; // أول دين تم سداده
            const fullPaymentsCount = debtsToUpdate.filter(d => d.status === 'paid').length;
            
            if (firstDebt) {
                const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/auto-notifications`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'trigger_payment_notification',
                        debt_id: firstDebt.id,
                        payment_amount: parseFloat(amount),
                        payment_type: fullPaymentsCount > 0 ? 'full' : 'partial',
                        customer_phone: customer_phone,
                        customer_name: customer_name,
                        merchant_id: merchantId
                    })
                });

                if (notificationResponse.ok) {
                    console.log('[process-payment] Auto-notifications triggered successfully');
                } else {
                    const errorText = await notificationResponse.text();
                    console.error('[process-payment] Failed to trigger auto-notifications:', errorText);
                }
            }
        } catch (autoNotifError) {
            console.error('[process-payment] Error triggering auto-notifications:', autoNotifError);
            // لا نوقف العملية بسبب فشل الإشعارات التلقائية
        }

        return new Response(JSON.stringify({
            data: {
                success: true,
                transaction_id: transaction[0]?.id,
                debts_updated: updatedCount,
                debts_paid_count: debtsToUpdate.filter(d => d.status === 'paid').length,
                message: 'تم تسجيل الدفع بنجاح'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[process-payment] Error:', error);

        const errorResponse = {
            error: {
                code: 'PROCESS_PAYMENT_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
