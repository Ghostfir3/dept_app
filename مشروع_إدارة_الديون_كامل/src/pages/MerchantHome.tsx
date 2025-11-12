
// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase, Debt } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, Users, TrendingUp, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function MerchantHome() {
  const { profile } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [quote] = useState(getRandomQuote());

  useEffect(() => {
    loadDebts();
  }, [profile]);

  async function loadDebts() {
    if (!profile) return;
    const { data } = await supabase
      .from('debts')
      .select('*')
      .eq('merchant_id', profile.id);
    
    if (data) setDebts(data);
    setLoading(false);
  }

  function getRandomQuote() {
    const quotes = [
      { text: 'النجاح هو مجموع الجهود الصغيرة المتكررة يوماً بعد يوم', author: 'روبرت كولير' },
      { text: 'إدارة الأموال بحكمة هي مفتاح النجاح المستدام', author: 'وارن بافيت' },
      { text: 'الإدارة المالية الجيدة هي أساس كل عمل ناجح', author: 'بنجامين فرانكلين' },
      { text: 'احتفظ بسجلات دقيقة لتحقيق النجاح في أعمالك', author: 'مثل تجاري' },
      { text: 'الانضباط المالي يؤدي إلى الحرية المالية', author: 'روبرت كيوساكي' },
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  const stats = {
    total: debts.reduce((sum, d) => sum + d.amount, 0),
    pending: debts.filter(d => d.status === 'pending' || d.status === 'confirmed').reduce((sum, d) => sum + d.amount, 0),
    paid: debts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0),
    count: debts.length,
    customers: new Set(debts.map(d => d.customer_phone)).size,
    collectionRate: debts.length > 0 ? (debts.filter(d => d.status === 'paid').length / debts.length) * 100 : 0,
  };

  const statusData = [
    { name: 'مدفوع', value: debts.filter(d => d.status === 'paid').length, color: '#4CAF50' },
    { name: 'قيد الانتظار', value: debts.filter(d => d.status === 'pending').length, color: '#FFA500' },
    { name: 'مؤكد', value: debts.filter(d => d.status === 'confirmed').length, color: '#2196F3' },
    { name: 'معترض عليه', value: debts.filter(d => d.status === 'disputed').length, color: '#F44336' },
  ];

  const monthlyData = debts.reduce((acc: any[], debt) => {
    const month = new Date(debt.created_at).toLocaleDateString('ar-SA', { month: 'short' });
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.amount += debt.amount;
    } else {
      acc.push({ month, amount: debt.amount });
    }
    return acc;
  }, []).slice(-6);

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-green-50 via-white to-blue-50 min-h-screen" dir="rtl">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-2xl shadow-xl p-6 mb-6 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute top-6 right-6 w-24 h-24 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-6 left-6 w-28 h-28 bg-white rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="animate-pulse" size={24} />
            <h1 className="text-2xl font-bold">مرحباً، {profile?.full_name}</h1>
          </div>
          <p className="text-lg mb-4 opacity-90">نتمنى لك يوماً مليئاً بالإنجازات والنجاح</p>
          
          {/* اقتباس تحفيزي */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <p className="text-sm italic mb-1">"{quote.text}"</p>
            <p className="text-xs opacity-75">- {quote.author}</p>
          </div>
        </div>
      </div>

      {/* بطاقات الإحصائيات السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-4 border-r-4 border-green-500 hover:shadow-xl transition-all hover:-translate-y-1 duration-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 font-medium text-sm">إجمالي الديون</h3>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-green-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 mb-1">{stats.total.toFixed(2)} ر.س</p>
          <p className="text-xs text-gray-500">{stats.count} دين مسجل</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 border-r-4 border-blue-500 hover:shadow-xl transition-all hover:-translate-y-1 duration-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 font-medium text-sm">عدد العملاء</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="text-blue-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 mb-1">{stats.customers}</p>
          <p className="text-xs text-gray-500">عميل نشط</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 border-r-4 border-orange-500 hover:shadow-xl transition-all hover:-translate-y-1 duration-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 font-medium text-sm">نسبة التحصيل</h3>
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <TrendingUp className="text-orange-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 mb-1">{stats.collectionRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500">من إجمالي الديون</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 border-r-4 border-purple-500 hover:shadow-xl transition-all hover:-translate-y-1 duration-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 font-medium text-sm">المبلغ المحصل</h3>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-purple-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 mb-1">{stats.paid.toFixed(2)} ر.س</p>
          <p className="text-xs text-gray-500">من أصل {stats.total.toFixed(2)} ر.س</p>
        </div>
      </div>

      {/* الرسوم البيانية المصغرة */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* توزيع الديون */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <div className="w-2 h-6 bg-green-600 rounded-full"></div>
            توزيع حالات الديون
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* الديون الشهرية */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
            الديون خلال الأشهر الأخيرة
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill="#10B981" name="المبلغ (ر.س)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* آخر النشاطات */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <div className="w-2 h-6 bg-orange-600 rounded-full"></div>
          أحدث الديون المسجلة
        </h3>
        <div className="space-y-2">
          {debts.slice(0, 5).map((debt) => (
            <div key={debt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  debt.status === 'paid' ? 'bg-green-100' : 
                  debt.status === 'disputed' ? 'bg-red-100' : 'bg-orange-100'
                }`}>
                  {debt.status === 'paid' ? <CheckCircle className="text-green-600" size={16} /> :
                   debt.status === 'disputed' ? <Clock className="text-red-600" size={16} /> :
                   <Clock className="text-orange-600" size={16} />}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{debt.customer_name}</p>
                  <p className="text-xs text-gray-500">{debt.customer_phone}</p>
                </div>
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-800 text-sm">{debt.amount.toFixed(2)} ر.س</p>
                <p className="text-xs text-gray-500">{new Date(debt.created_at).toLocaleDateString('ar-SA')}</p>
              </div>
            </div>
          ))}
          {debts.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <p>لا توجد ديون مسجلة بعد</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
