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
    const { period = '6_months' } = await req.json();
    
    // الحصول على المفاتيح
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    // جلب جميع الديون
    const debtsResponse = await fetch(`${supabaseUrl}/rest/v1/debts?select=*`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    if (!debtsResponse.ok) {
      throw new Error('Failed to fetch debts');
    }

    const debts = await debtsResponse.json();
    
    // جلب المدفوعات
    const paymentsResponse = await fetch(`${supabaseUrl}/rest/v1/payments?select=*`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    const payments = paymentsResponse.ok ? await paymentsResponse.json() : [];
    
    // جلب ملفات PDF (تم إنشاؤها أسبوعياً)
    const pdfsResponse = await fetch(`${supabaseUrl}/rest/v1/generated_pdfs?select=*`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    const pdfs = pdfsResponse.ok ? await pdfsResponse.json() : [];

    // حساب فترة البيانات
    const now = new Date();
    const monthsBack = period === '6_months' ? 6 : period === '12_months' ? 12 : 3;
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

    // إنشاء مصفوفة الأشهر
    const months = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().substring(0, 7); // YYYY-MM
      const monthName = monthDate.toLocaleDateString('ar-SA', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      months.push({
        key: monthKey,
        name: monthName,
        year: monthDate.getFullYear(),
        month: monthDate.getMonth() + 1
      });
    }

    // تجميع البيانات شهرياً
    const monthlyData = months.map(month => {
      // فلترة الديون والشيكات في هذا الشهر
      const monthDebts = debts.filter(debt => {
        const debtDate = new Date(debt.created_at);
        return debtDate.getFullYear() === month.year && 
               (debtDate.getMonth() + 1) === month.month;
      });

      // فلترة المدفوعات في هذا الشهر
      const monthPayments = payments.filter(payment => {
        const paymentDate = new Date(payment.created_at);
        return paymentDate.getFullYear() === month.year && 
               (paymentDate.getMonth() + 1) === month.month;
      });

      // فلترة PDFs في هذا الشهر
      const monthPdfs = pdfs.filter(pdf => {
        const pdfDate = new Date(pdf.created_at);
        return pdfDate.getFullYear() === month.year && 
               (pdfDate.getMonth() + 1) === month.month;
      });

      // حساب الإحصائيات
      const totalDebts = monthDebts.reduce((sum, debt) => sum + parseFloat(debt.amount || 0), 0);
      const totalPayments = monthPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      const overdueCount = monthDebts.filter(debt => 
        debt.due_date && new Date(debt.due_date) < now && debt.status !== 'paid'
      ).length;
      
      const pendingCount = monthDebts.filter(debt => debt.status === 'pending').length;
      const confirmedCount = monthDebts.filter(debt => debt.status === 'confirmed').length;
      const paidCount = monthDebts.filter(debt => debt.status === 'paid').length;

      return {
        month: month.name,
        key: month.key,
        totalDebts: Math.round(totalDebts * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        overdueCount,
        pendingCount,
        confirmedCount,
        paidCount,
        pdfCount: monthPdfs.length,
        // نسب المحول لألوان مختلفة في الرسوم البيانية
        debtRatio: totalDebts,
        paymentRatio: totalPayments
      };
    });

    // حساب الإحصائيات الإجمالية
    const totalDebts = debts.reduce((sum, debt) => sum + parseFloat(debt.amount || 0), 0);
    const totalPayments = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
    const totalOverdue = debts.filter(debt => 
      debt.due_date && new Date(debt.due_date) < now && debt.status !== 'paid'
    ).length;
    const totalPending = debts.filter(debt => debt.status === 'pending').length;
    const totalConfirmed = debts.filter(debt => debt.status === 'confirmed').length;
    const totalPaid = debts.filter(debt => debt.status === 'paid').length;

    // إحصائيات متقدمة
    const statusDistribution = [
      { name: 'مؤكدة', value: totalConfirmed, color: '#10B981' },
      { name: 'قيد الانتظار', value: totalPending, color: '#F59E0B' },
      { name: 'مدفوعة', value: totalPaid, color: '#3B82F6' },
      { name: 'متأخرة', value: totalOverdue, color: '#EF4444' }
    ];

    // نمو شهري
    const growthData = monthlyData.map((item, index) => {
      const previousMonth = index > 0 ? monthlyData[index - 1] : null;
      const debtGrowth = previousMonth ? 
        ((item.totalDebts - previousMonth.totalDebts) / previousMonth.totalDebts * 100).toFixed(1) : '0';
      const paymentGrowth = previousMonth ? 
        ((item.totalPayments - previousMonth.totalPayments) / previousMonth.totalPayments * 100).toFixed(1) : '0';
      
      return {
        month: item.month,
        debtGrowth: parseFloat(debtGrowth),
        paymentGrowth: parseFloat(paymentGrowth)
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        // البيانات الشهرية
        monthly: monthlyData,
        
        // الإحصائيات الإجمالية
        summary: {
          totalDebts: Math.round(totalDebts * 100) / 100,
          totalPayments: Math.round(totalPayments * 100) / 100,
          totalOverdue,
          totalPending,
          totalConfirmed,
          totalPaid,
          totalPdfReports: pdfs.length
        },

        // توزيع الحالات
        statusDistribution,

        // نمو شهري
        growthData,

        // معدل السداد
        paymentRate: totalDebts > 0 ? Math.round((totalPaid / (totalPaid + totalPending + totalOverdue)) * 100) : 0,

        // متوسط المبلغ للديون
        averageDebtAmount: debts.length > 0 ? Math.round((totalDebts / debts.length) * 100) / 100 : 0,

        // متوسط المبلغ للمدفوعات
        averagePaymentAmount: payments.length > 0 ? Math.round((totalPayments / payments.length) * 100) / 100 : 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching performance data:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'PERFORMANCE_DATA_ERROR',
        message: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
