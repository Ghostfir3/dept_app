// Edge Function: Database Setup - إعداد جدول customer_notes تلقائياً
// هذه الدالة تُستدعى مرة واحدة فقط لإنشاء الجدول

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // تنفيذ SQL لإنشاء الجدول
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        -- إنشاء جدول customer_notes
        CREATE TABLE IF NOT EXISTS customer_notes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          merchant_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
          customer_phone VARCHAR(20) NOT NULL,
          customer_name VARCHAR(255),
          note_text TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- فهارس للأداء
        CREATE INDEX IF NOT EXISTS idx_notes_merchant ON customer_notes(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_notes_customer ON customer_notes(customer_phone);

        -- Row Level Security
        ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

        -- سياسات RLS
        DROP POLICY IF EXISTS "Merchants can view their notes" ON customer_notes;
        CREATE POLICY "Merchants can view their notes"
          ON customer_notes FOR SELECT
          USING (merchant_id = auth.uid());

        DROP POLICY IF EXISTS "Merchants can insert their notes" ON customer_notes;
        CREATE POLICY "Merchants can insert their notes"
          ON customer_notes FOR INSERT
          WITH CHECK (merchant_id = auth.uid());

        DROP POLICY IF EXISTS "Merchants can update their notes" ON customer_notes;
        CREATE POLICY "Merchants can update their notes"
          ON customer_notes FOR UPDATE
          USING (merchant_id = auth.uid());

        DROP POLICY IF EXISTS "Merchants can delete their notes" ON customer_notes;
        CREATE POLICY "Merchants can delete their notes"
          ON customer_notes FOR DELETE
          USING (merchant_id = auth.uid());
      `
    });

    if (error) {
      console.error('Error executing SQL:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Database setup completed successfully',
        data
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in database-setup function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: {
          code: 'SETUP_ERROR',
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
