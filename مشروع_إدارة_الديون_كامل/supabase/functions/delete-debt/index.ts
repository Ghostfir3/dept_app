import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'No authorization header' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request data
    const { debt_id, customer_phone, delete_type } = await req.json();

    if (delete_type === 'single' && debt_id) {
      // Delete single debt
      const { data, error } = await supabaseClient
        .from('debts')
        .delete()
        .eq('id', debt_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'تم حذف الدين بنجاح' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (delete_type === 'customer' && customer_phone) {
      // Delete all debts for a customer
      const { data, error } = await supabaseClient
        .from('debts')
        .delete()
        .eq('customer_phone', customer_phone);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'تم حذف العميل وجميع ديونه بنجاح' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_INPUT', message: 'بيانات غير صحيحة' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in delete-debt function:', error);
    return new Response(
      JSON.stringify({ 
        error: { 
          code: 'DELETE_FAILED', 
          message: error.message || 'حدث خطأ في حذف البيانات' 
        } 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});