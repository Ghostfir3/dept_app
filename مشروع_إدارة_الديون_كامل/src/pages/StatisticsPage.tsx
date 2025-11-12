
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { supabase, Debt } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, TrendingUp, Users, Clock, CheckCircle, AlertTriangle, DollarSign, Calendar, Download, Grid3x3, Filter as FilterIcon } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, FunnelChart, Funnel, LabelList } from 'recharts';
import toast from 'react-hot-toast';

export default function StatisticsPage() {
  const { profile } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([
    'overview', 'status', 'amounts', 'timeline', 'customers', 'heatmap', 'funnel'
  ]);

  useEffect(() => {
    loadDebts();
    loadWidgetPreferences();
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

  function loadWidgetPreferences() {
    const saved = localStorage.getItem('statistics_widgets');
    if (saved) {
      setSelectedWidgets(JSON.parse(saved));
    }
  }

  function saveWidgetPreferences(widgets: string[]) {
    localStorage.setItem('statistics_widgets', JSON.stringify(widgets));
    setSelectedWidgets(widgets);
    toast.success('تم حفظ تفضيلات العرض');
  }

  function toggleWidget(widgetId: string) {
    const newWidgets = selectedWidgets.includes(widgetId)
      ? selectedWidgets.filter(w => w !== widgetId)
      : [...selectedWidgets, widgetId];
    saveWidgetPreferences(newWidgets);
  }

  // الإحصائيات العامة
  const stats = useMemo(() => {
    const totalAmount = debts.reduce((sum, d) => sum + d.amount, 0);
    const paidAmount = debts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0);
    const pendingAmount = debts.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0);
    const confirmedAmount = debts.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + d.amount, 0);
    const disputedAmount = debts.filter(d => d.status === 'disputed').reduce((sum, d) => sum + d.amount, 0);

    const totalCount = debts.length;
    const paidCount = debts.filter(d => d.status === 'paid').length;
    const paymentRate = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
    const avgDebtAmount = totalCount > 0 ? totalAmount / totalCount : 0;
    const uniqueCustomers = new Set(debts.map(d => d.customer_phone)).size;

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      confirmedAmount,
      disputedAmount,
      totalCount,
      paidCount,
      paymentRate,
      avgDebtAmount,
      uniqueCustomers
    };
  }, [debts]);

  // توزيع الحالات
  const statusDistribution = useMemo(() => [
    { name: 'مدفوع', value: debts.filter(d => d.status === 'paid').length, amount: stats.paidAmount, color: '#10B981' },
    { name: 'معلق', value: debts.filter(d => d.status === 'pending').length, amount: stats.pendingAmount, color: '#F59E0B' },
    { name: 'مؤكد', value: debts.filter(d => d.status === 'confirmed').length, amount: stats.confirmedAmount, color: '#3B82F6' },
    { name: 'معترض', value: debts.filter(d => d.status === 'disputed').length, amount: stats.disputedAmount, color: '#EF4444' },
  ], [debts, stats]);

  // التوزيع الزمني
  const timeData = useMemo(() => {
    const now = new Date();
    const data: { [key: string]: { paid: number, pending: number, total: number } } = {};

    debts.forEach(debt => {
      const date = new Date(debt.created_at);
      let key: string;

      if (timeRange === 'week') {
        const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < 7) {
          key = date.toLocaleDateString('ar-SA', { weekday: 'short' });
        } else {
          return;
        }
      } else if (timeRange === 'month') {
        if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
          key = date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
        } else {
          return;
        }
      } else { // year
        key = date.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });
      }

      if (!data[key]) {
        data[key] = { paid: 0, pending: 0, total: 0 };
      }

      data[key].total += debt.amount;
      if (debt.status === 'paid') {
        data[key].paid += debt.amount;
      } else {
        data[key].pending += debt.amount;
      }
    });

    return Object.entries(data).map(([name, values]) => ({
      name,
      مدفوع: values.paid,
      معلق: values.pending,
      إجمالي: values.total
    }));
  }, [debts, timeRange]);

  // أفضل 5 عملاء
  const topCustomers = useMemo(() => {
    return debts.reduce((acc: any[], debt) => {
      const existing = acc.find(item => item.phone === debt.customer_phone);
      if (existing) {
        existing.total += debt.amount;
        existing.count += 1;
        if (debt.status === 'paid') existing.paid += debt.amount;
      } else {
        acc.push({
          name: debt.customer_name,
          phone: debt.customer_phone,
          total: debt.amount,
          paid: debt.status === 'paid' ? debt.amount : 0,
          count: 1
        });
      }
      return acc;
    }, []).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [debts]);

  // توزيع المبالغ
  const amountDistribution = useMemo(() => {
    const ranges = [
      { range: '0-100', min: 0, max: 100, count: 0, color: '#10B981' },
      { range: '100-500', min: 100, max: 500, count: 0, color: '#3B82F6' },
      { range: '500-1000', min: 500, max: 1000, count: 0, color: '#F59E0B' },
      { range: '1000-5000', min: 1000, max: 5000, count: 0, color: '#8B5CF6' },
      { range: '+5000', min: 5000, max: Infinity, count: 0, color: '#EF4444' },
    ];

    debts.forEach(debt => {
      const range = ranges.find(r => debt.amount >= r.min && debt.amount < r.max);
      if (range) range.count++;
    });

    return ranges.filter(r => r.count > 0);
  }, [debts]);

  // Heatmap للأداء اليومي (7 أيام × 24 ساعة)
  const heatmapData = useMemo(() => {
    const now = new Date();
    const data: { day: string; hour: number; count: number }[] = [];
    
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    // تهيئة البيانات
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        data.push({ day: days[d], hour: h, count: 0 });
      }
    }
    
    // حساب عدد الديون لكل يوم وساعة
    debts.forEach(debt => {
      const date = new Date(debt.created_at);
      const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < 7) {
        const dayName = days[date.getDay()];
        const hour = date.getHours();
        const cell = data.find(d => d.day === dayName && d.hour === hour);
        if (cell) cell.count++;
      }
    });
    
    return data;
  }, [debts]);

  // أكثر الساعات نشاطاً
  const hourlyActivity = useMemo(() => {
    const hourCounts: { [key: number]: number } = {};
    
    debts.forEach(debt => {
      const hour = new Date(debt.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    return Object.entries(hourCounts)
      .map(([hour, count]) => ({
        hour: `${hour}:00`,
        count
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [debts]);

  // Funnel Chart لمراحل الديون
  const funnelData = useMemo(() => {
    const stages = [
      { name: 'إجمالي الديون', value: debts.length, fill: '#6366F1' },
      { name: 'معلقة', value: debts.filter(d => d.status === 'pending').length, fill: '#F59E0B' },
      { name: 'مؤكدة', value: debts.filter(d => d.status === 'confirmed').length, fill: '#3B82F6' },
      { name: 'مدفوعة', value: debts.filter(d => d.status === 'paid').length, fill: '#10B981' },
    ];
    
    return stages.filter(s => s.value > 0);
  }, [debts]);

  // تصدير Excel/CSV
  function exportToCSV() {
    const headers = [
      'التاريخ',
      'اسم العميل',
      'رقم الهاتف',
      'المبلغ',
      'الحالة',
      'الوصف'
    ];
    
    const rows = debts.map(d => [
      new Date(d.created_at).toLocaleDateString('ar-SA'),
      d.customer_name,
      d.customer_phone,
      d.amount.toFixed(2),
      d.status === 'paid' ? 'مدفوع' : d.status === 'pending' ? 'معلق' : d.status === 'confirmed' ? 'مؤكد' : 'معترض',
      d.description || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `statistics-export-${Date.now()}.csv`;
    link.click();
    toast.success('تم تصدير البيانات بنجاح');
  }

  function exportToExcel() {
    toast.info('ميزة التصدير إلى Excel ستكون متاحة قريباً. يمكنك استخدام تصدير CSV حالياً.');
  }

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-green-500">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-bold">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

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

  const widgets = {
    overview: (
      <div className="bg-white rounded-2xl shadow-xl p-6 col-span-full">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="text-green-600" size={24} />
          نظرة عامة
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">إجمالي المبلغ</span>
              <DollarSign size={20} />
            </div>
            <p className="text-3xl font-bold">{stats.totalAmount.toFixed(2)}</p>
            <p className="text-xs opacity-80 mt-1">{stats.totalCount} دين</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">معدل السداد</span>
              <CheckCircle size={20} />
            </div>
            <p className="text-3xl font-bold">{stats.paymentRate.toFixed(1)}%</p>
            <p className="text-xs opacity-80 mt-1">{stats.paidCount} من {stats.totalCount}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">متوسط الدين</span>
              <TrendingUp size={20} />
            </div>
            <p className="text-3xl font-bold">{stats.avgDebtAmount.toFixed(2)}</p>
            <p className="text-xs opacity-80 mt-1">ريال سعودي</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">العملاء</span>
              <Users size={20} />
            </div>
            <p className="text-3xl font-bold">{stats.uniqueCustomers}</p>
            <p className="text-xs opacity-80 mt-1">عميل نشط</p>
          </div>
        </div>
      </div>
    ),
    status: (
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">توزيع حالات الديون</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={statusDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {statusDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    ),
    amounts: (
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">توزيع المبالغ (ر.س)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={amountDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="عدد الديون" radius={[8, 8, 0, 0]}>
              {amountDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    ),
    timeline: (
      <div className="bg-white rounded-2xl shadow-xl p-6 col-span-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">الأداء الزمني</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                timeRange === 'week' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              أسبوع
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                timeRange === 'month' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              شهر
            </button>
            <button
              onClick={() => setTimeRange('year')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                timeRange === 'year' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              سنة
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area type="monotone" dataKey="مدفوع" stackId="1" stroke="#10B981" fill="#10B981" />
            <Area type="monotone" dataKey="معلق" stackId="1" stroke="#F59E0B" fill="#F59E0B" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    ),
    customers: (
      <div className="bg-white rounded-2xl shadow-xl p-6 col-span-full">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="text-green-600" size={24} />
          أفضل 5 عملاء
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الترتيب</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">اسم العميل</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">رقم الهاتف</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">إجمالي الديون</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">المدفوع</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">عدد الديون</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topCustomers.map((customer, index) => (
                <tr key={customer.phone} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold">
                      #{index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{customer.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.phone}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{customer.total.toFixed(2)} ر.س</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold">{customer.paid.toFixed(2)} ر.س</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
    heatmap: (
      <div className="bg-white rounded-2xl shadow-xl p-6 col-span-full">
        <h3 className="text-xl font-bold text-gray-800 mb-4">خريطة حرارية للنشاط (آخر 7 أيام)</h3>
        <div className="mb-4">
          <h4 className="text-sm font-bold text-gray-700 mb-3">النشاط حسب الساعة</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              {/* @ts-ignore */}
              <Tooltip content={<CustomTooltip />} />
              {/* @ts-ignore */}
              <Bar dataKey="count" fill="#10B981" name="عدد الديون" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <p className="text-xs text-gray-500 mb-2">التوزيع اليومي والساعي (الألوان الأغمق = نشاط أكثر)</p>
          <div className="grid grid-cols-25 gap-0.5">
            <div className="col-span-1"></div>
            {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map(hour => (
              <div key={hour} className="col-span-2 text-xs text-gray-600 text-center">{hour}</div>
            ))}
          </div>
          {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
            <div key={day} className="grid grid-cols-25 gap-0.5 mt-0.5">
              <div className="text-xs text-gray-600 flex items-center">{day.slice(0, 3)}</div>
              {Array.from({ length: 24 }).map((_, hour) => {
                const cell = heatmapData.find(d => d.day === day && d.hour === hour);
                const count = cell?.count || 0;
                const opacity = count === 0 ? 0.1 : Math.min(count / 5, 1);
                return (
                  <div
                    key={hour}
                    className="h-6 rounded-sm"
                    style={{
                      backgroundColor: `rgba(16, 185, 129, ${opacity})`,
                      border: '1px solid #e5e7eb'
                    }}
                    title={`${day} ${hour}:00 - ${count} ديون`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    ),
    funnel: (
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">مسار الديون (Funnel)</h3>
        <ResponsiveContainer width="100%" height={300}>
          {/* @ts-ignore */}
          <FunnelChart>
            {/* @ts-ignore */}
            <Tooltip content={<CustomTooltip />} />
            {/* @ts-ignore */}
            <Funnel dataKey="value" data={funnelData} isAnimationActive>
              <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
              {funnelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2">
          {funnelData.map((stage, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: stage.fill }}></div>
                <span className="text-sm font-bold text-gray-700">{stage.name}</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stage.value} ديون</span>
            </div>
          ))}
        </div>
      </div>
    )
  };

  return (
    <div className="p-8 p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <BarChart3 className="text-green-600" size={32} />
              الإحصائيات المتقدمة
            </h1>
            <p className="text-gray-600">لوحة تحكم تفاعلية مع widgets قابلة للتخصيص</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg"
            >
              <Download size={20} />
              تصدير CSV
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
            >
              <Download size={20} />
              تصدير Excel
            </button>
          </div>
        </div>

        {/* اختيار الـ Widgets */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Grid3x3 className="text-green-600" size={20} />
            تخصيص العرض
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
              { id: 'status', label: 'توزيع الحالات', icon: CheckCircle },
              { id: 'amounts', label: 'توزيع المبالغ', icon: DollarSign },
              { id: 'timeline', label: 'الأداء الزمني', icon: Clock },
              { id: 'customers', label: 'أفضل العملاء', icon: Users },
              { id: 'heatmap', label: 'خريطة حرارية', icon: Calendar },
              { id: 'funnel', label: 'مسار الديون', icon: TrendingUp },
            ].map(widget => {
              const Icon = widget.icon;
              return (
                <button
                  key={widget.id}
                  onClick={() => toggleWidget(widget.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                    selectedWidgets.includes(widget.id)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {widget.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {selectedWidgets.includes('overview') && widgets.overview}
        {selectedWidgets.includes('status') && widgets.status}
        {selectedWidgets.includes('amounts') && widgets.amounts}
        {selectedWidgets.includes('timeline') && widgets.timeline}
        {selectedWidgets.includes('customers') && widgets.customers}
        {selectedWidgets.includes('heatmap') && widgets.heatmap}
        {selectedWidgets.includes('funnel') && widgets.funnel}
      </div>

      {selectedWidgets.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <FilterIcon className="mx-auto mb-4 text-gray-400" size={64} />
          <p className="text-xl text-gray-600 font-bold">لم يتم اختيار أي widgets</p>
          <p className="text-gray-500 mt-2">اختر widget واحد على الأقل من الأعلى لعرض الإحصائيات</p>
        </div>
      )}
    </div>
  );
}
