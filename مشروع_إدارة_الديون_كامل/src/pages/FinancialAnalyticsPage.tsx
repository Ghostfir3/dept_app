// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  BarChart3, DollarSign, TrendingUp, TrendingDown, AlertCircle,
  PieChart as PieChartIcon, Target, Award, Lightbulb, Activity
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

export default function FinancialAnalyticsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState({
    capital: null,
    revenue: null,
    expenses: [],
    debts: [],
    analytics: null
  });

  useEffect(() => {
    loadAllFinancialData();
  }, [profile]);

  async function loadAllFinancialData() {
    if (!profile) return;

    try {
      // تحميل رأس المال
      const { data: capitalData } = await supabase
        .from('capital')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // تحميل متوسط الأرباح
      const { data: revenueData } = await supabase
        .from('revenue')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // تحميل المصروفات
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*')
        .eq('merchant_id', profile.id);

      // تحميل الديون
      const { data: debtsData } = await supabase
        .from('debts')
        .select('*')
        .eq('merchant_id', profile.id);

      setFinancialData({
        capital: capitalData,
        revenue: revenueData,
        expenses: expensesData || [],
        debts: debtsData || [],
        analytics: null
      });

      // حساب وحفظ التحليلات
      if (capitalData && revenueData && expensesData) {
        await calculateAndSaveAnalytics(capitalData, revenueData, expensesData, debtsData || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      setLoading(false);
    }
  }

  async function calculateAndSaveAnalytics(capital, revenue, expenses, debts) {
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const monthlyRevenue = revenue.monthly_total || 0;
    const totalDebts = debts.filter(d => d.status !== 'paid').reduce((sum, d) => sum + d.amount, 0);
    const currentBalance = capital.current_balance || 0;

    // حساب المؤشرات
    const expenseToRevenueRatio = monthlyRevenue > 0 ? (totalExpenses / monthlyRevenue) : 0;
    const roi = capital.initial_capital > 0 ? 
      ((currentBalance - capital.initial_capital) / capital.initial_capital) : 0;
    const dailyGrowthRate = revenue.daily_average > 0 ? 
      ((monthlyRevenue - revenue.daily_average * 30) / (revenue.daily_average * 30)) : 0;
    const debtToCapitalRatio = currentBalance > 0 ? (totalDebts / currentBalance) : 0;

    // التوصيات الذكية
    const recommendations = generateRecommendations({
      expenseToRevenueRatio,
      roi,
      debtToCapitalRatio,
      dailyGrowthRate,
      totalExpenses,
      monthlyRevenue
    });

    const analyticsData = {
      user_id: profile.id,
      analysis_date: new Date().toISOString().split('T')[0],
      expense_to_revenue_ratio: expenseToRevenueRatio,
      roi: roi,
      daily_growth_rate: dailyGrowthRate,
      debt_to_capital_ratio: debtToCapitalRatio,
      recommendations: recommendations,
      metrics: {
        total_expenses: totalExpenses,
        monthly_revenue: monthlyRevenue,
        total_debts: totalDebts,
        current_balance: currentBalance
      }
    };

    // حفظ التحليلات
    try {
      await supabase
        .from('analytics_insights')
        .insert(analyticsData);
    } catch (error) {
      console.error('خطأ في حفظ التحليلات:', error);
    }

    setFinancialData(prev => ({
      ...prev,
      analytics: analyticsData
    }));
  }

  function generateRecommendations(metrics) {
    const recommendations = [];

    // تحليل نسبة المصروفات إلى الإيرادات
    if (metrics.expenseToRevenueRatio > 0.7) {
      recommendations.push({
        type: 'warning',
        title: 'نسبة مصروفات مرتفعة',
        message: 'المصروفات تشكل أكثر من 70% من الإيرادات. يُنصح بتقليل النفقات أو زيادة الإيرادات.',
        priority: 'high'
      });
    } else if (metrics.expenseToRevenueRatio < 0.3) {
      recommendations.push({
        type: 'success',
        title: 'كفاءة مالية ممتازة',
        message: 'المصروفات منخفضة مقارنة بالإيرادات. استمر في هذا الأداء!',
        priority: 'low'
      });
    }

    // تحليل ROI
    if (metrics.roi > 0.2) {
      recommendations.push({
        type: 'success',
        title: 'عائد استثمار ممتاز',
        message: `عائد الاستثمار ${(metrics.roi * 100).toFixed(1)}% يعتبر ممتازاً.`,
        priority: 'low'
      });
    } else if (metrics.roi < 0.05 && metrics.roi > 0) {
      recommendations.push({
        type: 'warning',
        title: 'عائد استثمار منخفض',
        message: 'يُنصح بتحسين الكفاءة التشغيلية لزيادة العائد على الاستثمار.',
        priority: 'medium'
      });
    } else if (metrics.roi < 0) {
      recommendations.push({
        type: 'danger',
        title: 'خسارة في رأس المال',
        message: 'رأس المال انخفض. يجب مراجعة الاستراتيجية المالية فوراً.',
        priority: 'high'
      });
    }

    // تحليل نسبة الديون
    if (metrics.debtToCapitalRatio > 0.75) {
      recommendations.push({
        type: 'danger',
        title: 'نسبة ديون مرتفعة جداً',
        message: 'الديون تشكل أكثر من 75% من رأس المال. يجب تحصيل الديون المعلقة بشكل عاجل.',
        priority: 'high'
      });
    } else if (metrics.debtToCapitalRatio > 0.5) {
      recommendations.push({
        type: 'warning',
        title: 'نسبة ديون مرتفعة',
        message: 'الديون تشكل أكثر من 50% من رأس المال. يُنصح بالتركيز على التحصيل.',
        priority: 'medium'
      });
    }

    // تحليل معدل النمو
    if (metrics.dailyGrowthRate > 0.1) {
      recommendations.push({
        type: 'success',
        title: 'نمو قوي في الأرباح',
        message: `معدل النمو اليومي ${(metrics.dailyGrowthRate * 100).toFixed(1)}% ممتاز!`,
        priority: 'low'
      });
    } else if (metrics.dailyGrowthRate < -0.1) {
      recommendations.push({
        type: 'warning',
        title: 'انخفاض في الأرباح',
        message: 'هناك انخفاض في معدل الأرباح. يجب البحث عن فرص لزيادة الإيرادات.',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  // الحسابات
  const totalRevenue = financialData.revenue ? financialData.revenue.monthly_total : 0;
  const totalExpenses = financialData.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const currentCapital = financialData.capital ? financialData.capital.current_balance : 0;
  const totalDebts = financialData.debts.filter(d => d.status !== 'paid').reduce((sum, d) => sum + d.amount, 0);

  // بيانات الرسوم البيانية
  const financialOverview = [
    { name: 'الإيرادات', value: totalRevenue, color: '#10B981' },
    { name: 'المصروفات', value: totalExpenses, color: '#EF4444' },
    { name: 'صافي الربح', value: netProfit, color: '#3B82F6' }
  ];

  const performanceMetrics = [
    { metric: 'الربحية', value: profitMargin > 0 ? Math.min(profitMargin, 100) : 0 },
    { metric: 'السيولة', value: currentCapital > 0 ? Math.min((currentCapital / (currentCapital + totalDebts)) * 100, 100) : 0 },
    { metric: 'الكفاءة', value: totalRevenue > 0 ? Math.min(((totalRevenue - totalExpenses) / totalRevenue) * 100, 100) : 0 },
    { metric: 'النمو', value: financialData.analytics ? Math.min(Math.abs(financialData.analytics.daily_growth_rate * 100), 100) : 0 },
    { metric: 'الاستقرار', value: totalDebts > 0 ? Math.max(100 - (totalDebts / currentCapital) * 100, 0) : 100 }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      {/* العنوان */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <BarChart3 className="text-blue-600" size={32} />
          التحليلات المالية المتكاملة
        </h1>
        <p className="text-gray-600">لوحة معلومات شاملة لجميع المؤشرات والتحليلات المالية</p>
      </div>

      {/* المؤشرات الرئيسية (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-blue-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium text-sm">رأس المال الحالي</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-blue-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-700">{currentCapital.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-green-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium text-sm">الإيرادات الشهرية</h3>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="text-green-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-700">{totalRevenue.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-red-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium text-sm">المصروفات الشهرية</h3>
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <TrendingDown className="text-red-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-700">{totalExpenses.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-purple-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium text-sm">الديون المتبقية</h3>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <AlertCircle className="text-purple-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-700">{totalDebts.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-cyan-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium text-sm">صافي الربح</h3>
            <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
              <Award className="text-cyan-600" size={20} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {netProfit.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">ريال سعودي</p>
        </div>
      </div>

      {/* الرسوم البيانية - الصف الأول */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* نظرة عامة مالية */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <PieChartIcon className="text-blue-600" size={24} />
            النظرة المالية العامة
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={financialOverview}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {financialOverview.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* مؤشرات الأداء */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="text-purple-600" size={24} />
            مؤشرات الأداء الرئيسية
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={performanceMetrics}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="الأداء" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* المؤشرات التفصيلية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-xl p-6 border-2 border-blue-200">
          <h4 className="text-sm font-medium text-gray-600 mb-2">نسبة المصروفات للإيرادات</h4>
          <p className="text-3xl font-bold text-blue-700">
            {financialData.analytics ? (financialData.analytics.expense_to_revenue_ratio * 100).toFixed(1) : '0.0'}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-xl p-6 border-2 border-green-200">
          <h4 className="text-sm font-medium text-gray-600 mb-2">عائد الاستثمار (ROI)</h4>
          <p className="text-3xl font-bold text-green-700">
            {financialData.analytics ? (financialData.analytics.roi * 100).toFixed(1) : '0.0'}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl shadow-xl p-6 border-2 border-orange-200">
          <h4 className="text-sm font-medium text-gray-600 mb-2">معدل النمو اليومي</h4>
          <p className="text-3xl font-bold text-orange-700">
            {financialData.analytics ? (financialData.analytics.daily_growth_rate * 100).toFixed(1) : '0.0'}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl shadow-xl p-6 border-2 border-purple-200">
          <h4 className="text-sm font-medium text-gray-600 mb-2">نسبة الديون لرأس المال</h4>
          <p className="text-3xl font-bold text-purple-700">
            {financialData.analytics ? (financialData.analytics.debt_to_capital_ratio * 100).toFixed(1) : '0.0'}%
          </p>
        </div>
      </div>

      {/* التوصيات الذكية */}
      {financialData.analytics?.recommendations && financialData.analytics.recommendations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Lightbulb className="text-yellow-600" size={24} />
            النصائح والتوصيات الذكية
          </h3>
          <div className="space-y-3">
            {financialData.analytics.recommendations.map((rec, index) => {
              const colors = {
                success: 'bg-green-100 border-green-500 text-green-800',
                warning: 'bg-orange-100 border-orange-500 text-orange-800',
                danger: 'bg-red-100 border-red-500 text-red-800'
              };
              return (
                <div key={index} className={`p-4 border-r-4 rounded-lg ${colors[rec.type]}`}>
                  <p className="font-bold">{rec.title}</p>
                  <p className="text-sm mt-1">{rec.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* رسالة عدم وجود بيانات */}
      {!financialData.capital && !financialData.revenue && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-yellow-600" size={48} />
          <h3 className="text-xl font-bold text-gray-800 mb-2">لا توجد بيانات كافية للتحليل</h3>
          <p className="text-gray-600">
            يرجى إدخال بيانات رأس المال والإيرادات والمصروفات للحصول على تحليلات مفصلة.
          </p>
        </div>
      )}
    </div>
  );
}
