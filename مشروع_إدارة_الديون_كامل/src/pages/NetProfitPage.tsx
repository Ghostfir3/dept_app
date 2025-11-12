
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { supabase, Debt } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, TrendingUp, TrendingDown, Calculator, AlertCircle, Download, ArrowUpRight, ArrowDownRight, Lightbulb } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area } from 'recharts';
import toast from 'react-hot-toast';

interface ExpenseCategory {
  key: string;
  label: string;
  color: string;
}

const expenseCategories: ExpenseCategory[] = [
  { key: 'operationalCosts', label: 'تكاليف تشغيلية', color: '#FF6384' },
  { key: 'taxes', label: 'ضرائب', color: '#36A2EB' },
  { key: 'salaries', label: 'رواتب', color: '#FFCE56' },
  { key: 'rent', label: 'إيجار', color: '#4BC0C0' },
  { key: 'utilities', label: 'مرافق', color: '#9966FF' },
  { key: 'marketing', label: 'تسويق', color: '#FF9F40' },
  { key: 'other', label: 'أخرى', color: '#C9CBCF' },
];

export default function NetProfitPage() {
  const { profile } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState({
    operationalCosts: 0,
    taxes: 0,
    salaries: 0,
    rent: 0,
    utilities: 0,
    marketing: 0,
    other: 0
  });
  const [showExpenseInput, setShowExpenseInput] = useState(false);
  const [forecastMonths, setForecastMonths] = useState(3);

  useEffect(() => {
    loadDebts();
    loadSavedExpenses();
  }, [profile]);

  async function loadDebts() {
    if (!profile) return;
    const { data } = await supabase
      .from('debts')
      .select('*')
      .eq('merchant_id', profile.id)
      .order('created_at', { ascending: false });
    
    if (data) setDebts(data);
    setLoading(false);
  }

  function loadSavedExpenses() {
    const saved = localStorage.getItem('monthly_expenses');
    if (saved) {
      setExpenses(JSON.parse(saved));
    }
  }

  function saveExpenses() {
    localStorage.setItem('monthly_expenses', JSON.stringify(expenses));
    toast.success('تم حفظ المصروفات بنجاح');
  }

  // الحسابات المالية
  const totalRevenue = useMemo(() => 
    debts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0),
    [debts]
  );

  const totalPending = useMemo(() =>
    debts.filter(d => d.status !== 'paid').reduce((sum, d) => sum + d.amount, 0),
    [debts]
  );

  const totalExpenses = useMemo(() =>
    Object.values(expenses).reduce((sum, val) => sum + val, 0),
    [expenses]
  );

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // مقارنات زمنية
  const getLastMonthRevenue = () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    return debts
      .filter(d => {
        const date = new Date(d.updated_at || d.created_at);
        return d.status === 'paid' && date >= lastMonth && date <= lastMonthEnd;
      })
      .reduce((sum, d) => sum + d.amount, 0);
  };

  const lastMonthRevenue = getLastMonthRevenue();
  const revenueChange = lastMonthRevenue > 0 
    ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
    : 0;

  // بيانات الرسوم البيانية
  const expensesData = expenseCategories
    .map(cat => ({
      name: cat.label,
      value: expenses[cat.key as keyof typeof expenses],
      color: cat.color
    }))
    .filter(item => item.value > 0);

  // Waterfall Chart Data
  const waterfallData = [
    { name: 'الإيرادات', value: totalRevenue, fill: '#10B981' },
    { name: 'تكاليف تشغيلية', value: -expenses.operationalCosts, fill: '#EF4444' },
    { name: 'ضرائب', value: -expenses.taxes, fill: '#EF4444' },
    { name: 'رواتب', value: -expenses.salaries, fill: '#EF4444' },
    { name: 'إيجار', value: -expenses.rent, fill: '#EF4444' },
    { name: 'مرافق', value: -expenses.utilities, fill: '#EF4444' },
    { name: 'تسويق', value: -expenses.marketing, fill: '#EF4444' },
    { name: 'أخرى', value: -expenses.other, fill: '#EF4444' },
    { name: 'صافي الربح', value: netProfit, fill: netProfit >= 0 ? '#3B82F6' : '#F59E0B' },
  ].filter(item => item.value !== 0);

  // الأداء الشهري (آخر 6 أشهر)
  const monthlyData = useMemo(() => {
    const data: any[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthDate.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });
      
      const revenue = debts
        .filter(d => {
          const date = new Date(d.updated_at || d.created_at);
          return d.status === 'paid' && date >= monthDate && date <= monthEnd;
        })
        .reduce((sum, d) => sum + d.amount, 0);
      
      data.push({
        month: monthName,
        revenue: revenue,
        expenses: totalExpenses,
        profit: revenue - totalExpenses
      });
    }
    
    return data;
  }, [debts, totalExpenses]);

  // التوقعات المستقبلية
  const forecastData = useMemo(() => {
    if (monthlyData.length < 3) return [];
    
    const avgRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0) / monthlyData.length;
    const trend = (monthlyData[monthlyData.length - 1].revenue - monthlyData[0].revenue) / monthlyData.length;
    
    const forecast: any[] = [];
    for (let i = 1; i <= forecastMonths; i++) {
      const predictedRevenue = avgRevenue + (trend * i);
      forecast.push({
        month: `توقع ${i}`,
        revenue: predictedRevenue,
        expenses: totalExpenses,
        profit: predictedRevenue - totalExpenses,
        isForecast: true
      });
    }
    
    return [...monthlyData, ...forecast];
  }, [monthlyData, forecastMonths, totalExpenses]);

  // التنبيهات الذكية
  const alerts = useMemo(() => {
    const alerts: { type: 'warning' | 'danger' | 'info'; message: string }[] = [];
    
    if (netProfit < 0) {
      alerts.push({ type: 'danger', message: 'تحذير: صافي الربح سالب! يجب تقليل المصروفات أو زيادة الإيرادات' });
    }
    
    if (profitMargin < 10 && profitMargin >= 0) {
      alerts.push({ type: 'warning', message: 'تنبيه: هامش الربح منخفض (أقل من 10%)' });
    }
    
    if (totalExpenses > totalRevenue * 0.8) {
      alerts.push({ type: 'warning', message: 'المصروفات تشكل أكثر من 80% من الإيرادات' });
    }
    
    if (expenses.salaries > totalRevenue * 0.4) {
      alerts.push({ type: 'info', message: 'الرواتب تشكل أكثر من 40% من الإيرادات' });
    }
    
    if (totalPending > totalRevenue) {
      alerts.push({ type: 'info', message: `لديك ${totalPending.toFixed(2)} ر.س ديون معلقة يمكن تحصيلها` });
    }
    
    return alerts;
  }, [netProfit, profitMargin, totalExpenses, totalRevenue, expenses, totalPending]);

  // Custom Tooltip للرسوم
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-green-500">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-bold">
              {entry.name}: {entry.value.toFixed(2)} ر.س
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  function exportToPDF() {
    toast.success('ميزة التصدير إلى PDF ستكون متاحة قريباً');
  }

  if (loading) {
    return (
      <div className="p-8 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Calculator className="text-green-600" size={32} />
              حاسبة صافي الربح المتقدمة
            </h1>
            <p className="text-gray-600">تحليل مالي شامل مع توقعات مستقبلية وتنبيهات ذكية</p>
          </div>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
          >
            <Download size={20} />
            تصدير PDF
          </button>
        </div>

        {/* التنبيهات الذكية */}
        {alerts.length > 0 && (
          <div className="space-y-2 mb-6">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border-r-4 flex items-start gap-3 ${
                  alert.type === 'danger'
                    ? 'bg-red-50 border-red-500 text-red-800'
                    : alert.type === 'warning'
                    ? 'bg-orange-50 border-orange-500 text-orange-800'
                    : 'bg-blue-50 border-blue-500 text-blue-800'
                }`}
              >
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <p className="font-bold text-sm">{alert.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* بطاقات KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium opacity-90">إجمالي الإيرادات</h3>
            <DollarSign size={28} />
          </div>
          <p className="text-4xl font-bold mb-2">{totalRevenue.toFixed(2)}</p>
          <p className="text-sm opacity-90">ريال سعودي</p>
          {revenueChange !== 0 && (
            <div className={`flex items-center gap-1 mt-2 ${revenueChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {revenueChange >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              <span className="text-xs font-bold">{Math.abs(revenueChange).toFixed(1)}% مقارنة بالشهر الماضي</span>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium opacity-90">إجمالي المصروفات</h3>
            <TrendingDown size={28} />
          </div>
          <p className="text-4xl font-bold mb-2">{totalExpenses.toFixed(2)}</p>
          <p className="text-sm opacity-90">ريال سعودي</p>
          <p className="text-xs opacity-80 mt-2">
            {totalRevenue > 0 ? `${((totalExpenses / totalRevenue) * 100).toFixed(1)}% من الإيرادات` : 'لا توجد إيرادات'}
          </p>
        </div>

        <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium opacity-90">صافي الربح</h3>
            <Calculator size={28} />
          </div>
          <p className="text-4xl font-bold mb-2">{netProfit.toFixed(2)}</p>
          <p className="text-sm opacity-90">ريال سعودي</p>
          <p className="text-xs opacity-80 mt-2">الإيرادات - المصروفات</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium opacity-90">هامش الربح</h3>
            <TrendingUp size={28} />
          </div>
          <p className="text-4xl font-bold mb-2">{profitMargin.toFixed(1)}%</p>
          <p className="text-sm opacity-90">من الإيرادات</p>
          <p className="text-xs opacity-80 mt-2">
            {profitMargin >= 20 ? 'ممتاز' : profitMargin >= 10 ? 'جيد' : 'يحتاج تحسين'}
          </p>
        </div>
      </div>

      {/* إدخال المصروفات */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <AlertCircle className="text-green-600" size={24} />
            إدارة المصروفات الشهرية
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExpenseInput(!showExpenseInput)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all"
            >
              {showExpenseInput ? 'إخفاء' : 'تعديل'}
            </button>
            <button
              onClick={saveExpenses}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
            >
              حفظ
            </button>
          </div>
        </div>

        {showExpenseInput && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {expenseCategories.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-gray-700 font-bold mb-2">{label}</label>
                <input
                  type="number"
                  step="0.01"
                  value={expenses[key as keyof typeof expenses]}
                  onChange={(e) => setExpenses({ ...expenses, [key]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
        )}

        {/* عرض ملخص المصروفات */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {expenseCategories.map(({ key, label, color }) => (
            <div key={key} className="bg-gray-50 rounded-lg p-3 border-r-4" style={{ borderColor: color }}>
              <p className="text-xs text-gray-600 mb-1">{label}</p>
              <p className="text-lg font-bold text-gray-800">{expenses[key as keyof typeof expenses].toFixed(0)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Waterfall Chart */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">شلال الأرباح والمصروفات</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} style={{ fontSize: '11px' }} />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* توزيع المصروفات */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">توزيع المصروفات</h3>
          {expensesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={expensesData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={110}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expensesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500">
              لا توجد مصروفات مسجلة
            </div>
          )}
        </div>
      </div>

      {/* الأداء الشهري مع التوقعات */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">الأداء الشهري والتوقعات المستقبلية</h3>
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-gray-700">عدد أشهر التوقع:</label>
            <select
              value={forecastMonths}
              onChange={(e) => setForecastMonths(parseInt(e.target.value))}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              <option value="1">شهر واحد</option>
              <option value="3">3 أشهر</option>
              <option value="6">6 أشهر</option>
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              fill="#10B981" 
              stroke="#10B981" 
              fillOpacity={0.3}
              name="الإيرادات"
              strokeDasharray={(entry: any) => entry.isForecast ? "5 5" : "0"}
            />
            <Line 
              type="monotone" 
              dataKey="expenses" 
              stroke="#EF4444" 
              strokeWidth={2}
              name="المصروفات"
            />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="#3B82F6" 
              strokeWidth={3}
              name="صافي الربح"
              strokeDasharray={(entry: any) => entry.isForecast ? "5 5" : "0"}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-3 text-center">
          الخطوط المنقطة تمثل التوقعات المستقبلية بناءً على الاتجاه الحالي
        </p>
      </div>

      {/* نصائح ذكية */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl shadow-xl p-6 border-r-4 border-green-500">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Lightbulb className="text-green-600" size={24} />
          نصائح ذكية لتحسين الأرباح
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border-r-4 border-green-500">
            <h4 className="font-bold text-gray-800 mb-2">تقليل المصروفات</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• راجع المصروفات التشغيلية شهرياً</li>
              <li>• ابحث عن بدائل أقل تكلفة للخدمات</li>
              <li>• قلل المصروفات غير الأساسية</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl p-4 border-r-4 border-blue-500">
            <h4 className="font-bold text-gray-800 mb-2">زيادة الإيرادات</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• تابع الديون المعلقة ({totalPending.toFixed(2)} ر.س)</li>
              <li>• حسّن استراتيجيات التحصيل</li>
              <li>• وسّع قاعدة العملاء</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl p-4 border-r-4 border-purple-500">
            <h4 className="font-bold text-gray-800 mb-2">تحسين الهامش</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• استهدف هامش ربح 20% أو أكثر</li>
              <li>• وازن بين التكاليف والإيرادات</li>
              <li>• راقب المؤشرات المالية</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl p-4 border-r-4 border-orange-500">
            <h4 className="font-bold text-gray-800 mb-2">التخطيط المستقبلي</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• استخدم التوقعات لاتخاذ القرارات</li>
              <li>• خطط للنمو المستدام</li>
              <li>• احتفظ باحتياطي نقدي</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
