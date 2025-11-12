// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  DollarSign, TrendingUp, TrendingDown, Save, Plus, Edit2, 
  History, LineChart as LineChartIcon, PieChart as PieChartIcon,
  AlertCircle, Calculator
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function CapitalManagementPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentCapital, setCurrentCapital] = useState(null);
  const [capitalHistory, setCapitalHistory] = useState([]);
  const [formData, setFormData] = useState({
    initial_capital: '',
    current_balance: '',
    notes: ''
  });

  useEffect(() => {
    loadCapitalData();
  }, [profile]);

  async function loadCapitalData() {
    if (!profile) return;

    try {
      // تحميل رأس المال الحالي
      const { data: capitalData, error: capitalError } = await supabase
        .from('capital')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (capitalData) {
        setCurrentCapital(capitalData);
        setFormData({
          initial_capital: capitalData.initial_capital.toString(),
          current_balance: capitalData.current_balance.toString(),
          notes: capitalData.notes || ''
        });
      }

      // تحميل سجل رأس المال
      const { data: historyData } = await supabase
        .from('capital')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true });

      if (historyData) {
        setCapitalHistory(historyData);
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

    const initialCapital = parseFloat(formData.initial_capital);
    const currentBalance = parseFloat(formData.current_balance);

    if (isNaN(initialCapital) || initialCapital < 0) {
      toast.error('الرجاء إدخال قيمة صحيحة لرأس المال الأساسي');
      return;
    }

    if (isNaN(currentBalance) || currentBalance < 0) {
      toast.error('الرجاء إدخال قيمة صحيحة للرصيد الحالي');
      return;
    }

    try {
      if (currentCapital) {
        // تحديث
        const { error } = await supabase
          .from('capital')
          .update({
            initial_capital: initialCapital,
            current_balance: currentBalance,
            notes: formData.notes,
            last_updated: new Date().toISOString()
          })
          .eq('id', currentCapital.id);

        if (error) throw error;
        toast.success('تم تحديث رأس المال بنجاح');
      } else {
        // إضافة جديد
        const { error } = await supabase
          .from('capital')
          .insert({
            user_id: profile.id,
            initial_capital: initialCapital,
            current_balance: currentBalance,
            notes: formData.notes
          });

        if (error) throw error;
        toast.success('تم إضافة رأس المال بنجاح');
      }

      loadCapitalData();
    } catch (error) {
      console.error('خطأ في حفظ رأس المال:', error);
      toast.error('حدث خطأ في حفظ البيانات');
    }
  }

  // الحسابات
  const capitalChange = currentCapital 
    ? currentCapital.current_balance - currentCapital.initial_capital 
    : 0;
  const capitalChangePercent = currentCapital && currentCapital.initial_capital > 0
    ? (capitalChange / currentCapital.initial_capital) * 100
    : 0;

  // بيانات الرسم البياني
  const chartData = capitalHistory.map(item => ({
    date: new Date(item.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
    initial: item.initial_capital,
    current: item.current_balance,
    change: item.current_balance - item.initial_capital
  }));

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
          <DollarSign className="text-green-600" size={32} />
          إدارة رأس المال
        </h1>
        <p className="text-gray-600">تتبع وإدارة رأس المال الأساسي والرصيد الحالي</p>
      </div>

      {/* المؤشرات الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-blue-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">رأس المال الأساسي</h3>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-blue-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {currentCapital ? currentCapital.initial_capital.toFixed(2) : '0.00'}
          </p>
          <p className="text-sm text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-green-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">الرصيد الحالي</h3>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-700">
            {currentCapital ? currentCapital.current_balance.toFixed(2) : '0.00'}
          </p>
          <p className="text-sm text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-purple-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">التغير في رأس المال</h3>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Calculator className="text-purple-600" size={24} />
            </div>
          </div>
          <p className={`text-3xl font-bold ${capitalChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {capitalChange >= 0 ? '+' : ''}{capitalChange.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-orange-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">نسبة التغير</h3>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              {capitalChangePercent >= 0 ? (
                <TrendingUp className="text-green-600" size={24} />
              ) : (
                <TrendingDown className="text-red-600" size={24} />
              )}
            </div>
          </div>
          <p className={`text-3xl font-bold ${capitalChangePercent >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {capitalChangePercent >= 0 ? '+' : ''}{capitalChangePercent.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 mt-1">من رأس المال الأساسي</p>
        </div>
      </div>

      {/* نموذج إدخال/تحديث رأس المال */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Edit2 className="text-blue-600" size={24} />
          {currentCapital ? 'تحديث رأس المال' : 'إضافة رأس المال'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                رأس المال الأساسي (ر.س)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.initial_capital}
                onChange={e => setFormData({...formData, initial_capital: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                placeholder="أدخل رأس المال الأساسي"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                الرصيد الحالي (ر.س)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.current_balance}
                onChange={e => setFormData({...formData, current_balance: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                placeholder="أدخل الرصيد الحالي"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              ملاحظات (اختياري)
            </label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="أضف أي ملاحظات..."
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg"
          >
            <Save size={20} />
            {currentCapital ? 'تحديث البيانات' : 'حفظ البيانات'}
          </button>
        </form>
      </div>

      {/* الرسوم البيانية */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* تطور رأس المال */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <LineChartIcon className="text-blue-600" size={24} />
              تطور رأس المال عبر الزمن
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="initial" stroke="#3B82F6" strokeWidth={2} name="رأس المال الأساسي" />
                <Line type="monotone" dataKey="current" stroke="#10B981" strokeWidth={2} name="الرصيد الحالي" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* التغيرات في رأس المال */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <PieChartIcon className="text-purple-600" size={24} />
              التغيرات في رأس المال
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorChange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="change" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorChange)" name="التغير" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* سجل التعديلات */}
      {capitalHistory.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <History className="text-gray-600" size={24} />
            سجل التعديلات
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">التاريخ</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">رأس المال الأساسي</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الرصيد الحالي</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">التغير</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {capitalHistory.map((item) => {
                  const change = item.current_balance - item.initial_capital;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(item.created_at).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-blue-700">
                        {item.initial_capital.toFixed(2)} ر.س
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-green-700">
                        {item.current_balance.toFixed(2)} ر.س
                      </td>
                      <td className={`px-6 py-4 text-sm font-bold ${change >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)} ر.س
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* نصائح وتوصيات */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl shadow-xl p-6 mt-8 border-2 border-blue-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <AlertCircle className="text-blue-600" size={24} />
          نصائح وتوصيات
        </h3>
        <div className="space-y-3">
          {capitalChange > 0 && (
            <div className="p-4 bg-green-100 border-r-4 border-green-500 rounded-lg">
              <p className="font-bold text-green-800">نمو إيجابي في رأس المال</p>
              <p className="text-sm text-green-700 mt-1">
                رأس المال ينمو بشكل جيد. استمر في هذا الأداء الممتاز!
              </p>
            </div>
          )}
          {capitalChange < 0 && (
            <div className="p-4 bg-red-100 border-r-4 border-red-500 rounded-lg">
              <p className="font-bold text-red-800">انخفاض في رأس المال</p>
              <p className="text-sm text-red-700 mt-1">
                يُنصح بمراجعة المصروفات والإيرادات لتحسين الوضع المالي.
              </p>
            </div>
          )}
          {currentCapital && currentCapital.initial_capital < 10000 && (
            <div className="p-4 bg-orange-100 border-r-4 border-orange-500 rounded-lg">
              <p className="font-bold text-orange-800">رأس مال محدود</p>
              <p className="text-sm text-orange-700 mt-1">
                زيادة رأس المال قد تساعد في تحقيق نمو أسرع للأعمال.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
