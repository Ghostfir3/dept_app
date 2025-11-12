// Edge Function: التأكيد التلقائي للديون بعد 24 ساعة
// النوع: Cron Job (يعمل كل ساعة)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // إنشاء عميل Supabase باستخدام service role key للوصول الكامل
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // البحث عن جميع الديون التي:
    // 1. حالتها 'pending'
    // 2. مر عليها أكثر من 24 ساعة (dispute_deadline أقل من الوقت الحالي)
    const now = new Date().toISOString();
    
    const { data: expiredDebts, error: fetchError } = await supabase
      .from('debts')
      .select('id, customer_name, amount, created_at')
      .eq('status', 'pending')
      .lt('dispute_deadline', now);

    if (fetchError) {
      console.error('Error fetching debts:', fetchError);
      throw fetchError;
    }

    if (!expiredDebts || expiredDebts.length === 0) {
      console.log('No debts to auto-confirm');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No debts to auto-confirm',
          count: 0 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // تحديث حالة الديون إلى 'confirmed'
    const debtIds = expiredDebts.map(debt => debt.id);
    
    const { data: updatedDebts, error: updateError } = await supabase
      .from('debts')
      .update({ 
        status: 'confirmed',
        confirmed_at: now
      })
      .in('id', debtIds)
      .select();

    if (updateError) {
      console.error('Error updating debts:', updateError);
      throw updateError;
    }

    console.log(`Auto-confirmed ${updatedDebts.length} debts:`, updatedDebts);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully auto-confirmed ${updatedDebts.length} debts`,
        count: updatedDebts.length,
        debts: updatedDebts
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in auto-confirm-debts function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: {
          code: 'FUNCTION_ERROR',
          message: error.message
        }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
