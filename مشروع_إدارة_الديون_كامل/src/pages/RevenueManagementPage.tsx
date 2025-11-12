// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  TrendingUp, DollarSign, Calendar, Save, Edit2,
  LineChart as LineChartIcon, Target, Award, TrendingDown
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function RevenueManagementPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState([]);
  const [currentRevenue, setCurrentRevenue] = useState(null);
  const [formData, setFormData] = useState({
    daily_average: '',
    notes: ''
  });

  useEffect(() => {
    loadRevenueData();
  }, [profile]);

  async function loadRevenueData() {
    if (!profile) return;

    try {
      // تحميل آخر إدخال
      const { data: latestData } = await supabase
        .from('revenue')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestData) {
        setCurrentRevenue(latestData);
        setFormData({
          daily_average: latestData.daily_average.toString(),
          notes: latestData.notes || ''
        });
      }

      // تحميل جميع السجلات
      const { data: allData } = await supabase
        .from('revenue')
        .select('*')
        .eq('user_id', profile.id)
        .order('revenue_date', { ascending: true });

      if (allData) {
        setRevenueData(allData);
      }

      setLoading(false);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!profile) return;

    const dailyAverage = parseFloat(formData.daily_average);
    if (isNaN(dailyAverage) || dailyAverage < 0) {
      toast.error('الرجاء إدخال قيمة صحيحة لمتوسط الربح اليومي');
      return;
    }

    // حساب الإجماليات
    const monthlyTotal = dailyAverage * 30;
    const yearTotal = dailyAverage * 365;

    try {
      // إنشاء سجل جديد دائماً لتتبع التغييرات
      const { error } = await supabase
        .from('revenue')
        .insert({
          user_id: profile.id,
          daily_average: dailyAverage,
          monthly_total: monthlyTotal,
          year_total: yearTotal,
          notes: formData.notes,
          revenue_date: new Date().toISOString().split('T')[0]
        });

      if (error) throw error;
      toast.success('تم حفظ متوسط الربح بنجاح');
      loadRevenueData();
    } catch (error) {
      console.error('خطأ في حفظ البيانات:', error);
      toast.error('حدث خطأ في حفظ البيانات');
    }
  }

  // الحسابات
  const dailyAverage = currentRevenue ? currentRevenue.daily_average : 0;
  const monthlyTotal = currentRevenue ? currentRevenue.monthly_total : 0;
  const yearTotal = currentRevenue ? currentRevenue.year_total : 0;

  // حساب معدل النمو
  let growthRate = 0;
  if (revenueData.length >= 2) {
    const latest = revenueData[revenueData.length - 1];
    const previous = revenueData[revenueData.length - 2];
    if (previous.daily_average > 0) {
      growthRate = ((latest.daily_average - previous.daily_average) / previous.daily_average) * 100;
    }
  }

  // بيانات الرسوم البيانية
  const chartData = revenueData.map(item => ({
    date: new Date(item.revenue_date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
    daily: item.daily_average,
    monthly: item.monthly_total,
    yearly: item.year_total
  }));

  // التوقعات المستقبلية (3 أشهر قادمة)
  const forecasts = Array.from({ length: 3 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i + 1);
    return {
      month: date.toLocaleDateString('ar-SA', { month: 'long' }),
      expected: monthlyTotal,
      optimistic: monthlyTotal * 1.2,
      pessimistic: monthlyTotal * 0.8
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-gray-50 to-green-50 min-h-screen" dir="rtl">
      {/* العنوان */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <TrendingUp className="text-green-600" size={32} />
          متوسط الأرباح
        </h1>
        <p className="text-gray-600">تتبع متوسط الأرباح اليومية والتوقعات المستقبلية</p>
      </div>

      {/* المؤشرات الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-green-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">متوسط الربح اليومي</h3>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-700">{dailyAverage.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-blue-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">الربح الشهري المتوقع</h3>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="text-blue-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-700">{monthlyTotal.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-purple-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">الربح السنوي المتوقع</h3>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Award className="text-purple-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-purple-700">{yearTotal.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-orange-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">معدل النمو</h3>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              {growthRate >= 0 ? (
                <TrendingUp className="text-green-600" size={24} />
              ) : (
                <TrendingDown className="text-red-600" size={24} />
              )}
            </div>
          </div>
          <p className={`text-3xl font-bold ${growthRate >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 mt-1">مقارنة بالسابق</p>
        </div>
      </div>

      {/* نموذج إدخال متوسط الربح */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Edit2 className="text-blue-600" size={24} />
          تحديث متوسط الربح اليومي
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                متوسط الربح اليومي (ر.س)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.daily_average}
                onChange={e => setFormData({...formData, daily_average: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                placeholder="أدخل متوسط الربح اليومي"
              />
              <p className="text-sm text-gray-500 mt-2">
                شهري: {(parseFloat(formData.daily_average) * 30 || 0).toFixed(2)} ر.س | 
                سنوي: {(parseFloat(formData.daily_average) * 365 || 0).toFixed(2)} ر.س
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={2}
                placeholder="أضف أي ملاحظات..."
              />
            </div>
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg"
          >
            <Save size={20} />
            حفظ البيانات
          </button>
        </form>
      </div>

      {/* الرسوم البيانية */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* تطور متوسط الربح اليومي */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <LineChartIcon className="text-green-600" size={24} />
              تطور متوسط الربح اليومي
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="daily" stroke="#10B981" fillOpacity={1} fill="url(#colorDaily)" name="المتوسط اليومي" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* الأرباح الشهرية والسنوية */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="text-blue-600" size={24} />
              الأرباح المتوقعة (شهري - سنوي)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="monthly" stroke="#3B82F6" strokeWidth={2} name="شهري" />
                <Line type="monotone" dataKey="yearly" stroke="#8B5CF6" strokeWidth={2} name="سنوي" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* التوقعات المستقبلية */}
      {forecasts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="text-purple-600" size={24} />
            التوقعات المستقبلية (3 أشهر قادمة)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={forecasts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="pessimistic" fill="#EF4444" name="متشائم" />
              <Bar dataKey="expected" fill="#10B981" name="متوقع" />
              <Bar dataKey="optimistic" fill="#3B82F6" name="متفائل" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* جدول السجلات */}
      {revenueData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="text-gray-600" size={24} />
            سجل متوسط الأرباح
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">التاريخ</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">المتوسط اليومي</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">المتوقع الشهري</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">المتوقع السنوي</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {revenueData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(item.revenue_date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-green-700">
                      {item.daily_average.toFixed(2)} ر.س
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-700">
                      {item.monthly_total ? item.monthly_total.toFixed(2) : '-'} ر.س
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-purple-700">
                      {item.year_total ? item.year_total.toFixed(2) : '-'} ر.س
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
