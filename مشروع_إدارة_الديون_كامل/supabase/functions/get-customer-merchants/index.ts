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

        // الحصول على بيانات العميل
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

        // 1. الحصول على التجار من جدول الديون
        const debtsResponse = await fetch(`${supabaseUrl}/rest/v1/debts?customer_phone=eq.${userProfile.phone_number}&select=merchant_id,amount,remaining_amount,paid_amount,created_at`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        let merchantsFromDebts = [];
        if (debtsResponse.ok) {
            const debts = await debtsResponse.json();
            const merchantMap = new Map();
            
            debts.forEach(debt => {
                if (!merchantMap.has(debt.merchant_id)) {
                    merchantMap.set(debt.merchant_id, {
                        merchant_id: debt.merchant_id,
                        total_debts: 0,
                        total_amount: 0,
                        paid_amount: 0,
                        remaining_amount: 0,
                        last_transaction_date: debt.created_at,
                        notes_sent: 0  // عدد الملاحظات المرسلة
                    });
                }
                
                const merchant = merchantMap.get(debt.merchant_id);
                merchant.total_debts += 1;
                merchant.total_amount += parseFloat(debt.amount) || 0;
                merchant.paid_amount += parseFloat(debt.paid_amount) || 0;
                merchant.remaining_amount += parseFloat(debt.remaining_amount) || 0;
                
                // تحديث آخر معاملة
                if (new Date(debt.created_at) > new Date(merchant.last_transaction_date)) {
                    merchant.last_transaction_date = debt.created_at;
                }
            });
            
            merchantsFromDebts = Array.from(merchantMap.values());
        }

        // 2. الحصول على التجار من جدول الملاحظات (أولائك الذين أرسل لهم العميل ملاحظات)
        const notesResponse = await fetch(`${supabaseUrl}/rest/v1/customer_notes?customer_phone=eq.${userProfile.phone_number}&select=merchant_id,created_at`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        let merchantsFromNotes = [];
        if (notesResponse.ok) {
            const notes = await notesResponse.json();
            const merchantMap = new Map();
            
            notes.forEach(note => {
                if (!merchantMap.has(note.merchant_id)) {
                    merchantMap.set(note.merchant_id, {
                        merchant_id: note.merchant_id,
                        total_debts: 0,
                        total_amount: 0,
                        paid_amount: 0,
                        remaining_amount: 0,
                        last_transaction_date: note.created_at,
                        notes_sent: 0
                    });
                }
                
                const merchant = merchantMap.get(note.merchant_id);
                merchant.notes_sent += 1;
                
                // تحديث آخر تفاعل
                if (new Date(note.created_at) > new Date(merchant.last_transaction_date)) {
                    merchant.last_transaction_date = note.created_at;
                }
            });
            
            merchantsFromNotes = Array.from(merchantMap.values());
        }

        // 3. دمج القوائم وإزالة التكرار
        const allMerchantIds = new Set([
            ...merchantsFromDebts.map(m => m.merchant_id),
            ...merchantsFromNotes.map(m => m.merchant_id)
        ]);

        // 4. الحصول على معلومات التجار من جدول users_profile
        const merchantsData = [];
        if (allMerchantIds.size > 0) {
            const merchantIdsArray = Array.from(allMerchantIds);
            const merchantsQuery = `${supabaseUrl}/rest/v1/users_profile?id=in.(${merchantIdsArray.map(id => `"${id}"`).join(',')})&select=id,full_name,phone_number`;
            
            const merchantsResponse = await fetch(merchantsQuery, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            });

            if (merchantsResponse.ok) {
                const merchantProfiles = await merchantsResponse.json();
                
                // دمج البيانات
                merchantProfiles.forEach(profile => {
                    const merchantFromDebts = merchantsFromDebts.find(m => m.merchant_id === profile.id) || {
                        merchant_id: profile.id,
                        total_debts: 0,
                        total_amount: 0,
                        paid_amount: 0,
                        remaining_amount: 0,
                        last_transaction_date: new Date().toISOString(),
                        notes_sent: 0
                    };
                    
                    const merchantFromNotes = merchantsFromNotes.find(m => m.merchant_id === profile.id);
                    if (merchantFromNotes) {
                        merchantFromDebts.notes_sent = merchantFromNotes.notes_sent;
                        if (new Date(merchantFromNotes.last_transaction_date) > new Date(merchantFromDebts.last_transaction_date)) {
                            merchantFromDebts.last_transaction_date = merchantFromNotes.last_transaction_date;
                        }
                    }
                    
                    merchantsData.push({
                        merchant_id: profile.id,
                        merchant_name: profile.full_name,
                        merchant_phone: profile.phone_number,
                        total_debts: merchantFromDebts.total_debts,
                        total_amount: merchantFromDebts.total_amount,
                        paid_amount: merchantFromDebts.paid_amount,
                        remaining_amount: merchantFromDebts.remaining_amount,
                        last_transaction_date: merchantFromDebts.last_transaction_date,
                        notes_sent: merchantFromDebts.notes_sent
                    });
                });
            }
        }

        // 5. ترتيب التجار حسب آخر معاملة/تفاعل
        const sortedMerchants = merchantsData.sort((a, b) => 
            new Date(b.last_transaction_date).getTime() - new Date(a.last_transaction_date).getTime()
        );

        return new Response(JSON.stringify({
            data: {
                merchants: sortedMerchants,
                summary: {
                    total_merchants: sortedMerchants.length,
                    merchants_with_debts: merchantsFromDebts.length,
                    merchants_with_notes_only: merchantsFromNotes.length
                }
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Get customer merchants error:', error);

        const errorResponse = {
            error: {
                code: 'GET_CUSTOMER_MERCHANTS_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});