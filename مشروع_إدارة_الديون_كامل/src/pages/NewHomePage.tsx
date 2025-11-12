// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Debt, SUPABASE_URL } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  DollarSign, Users, TrendingUp, CheckCircle, Clock, AlertCircle, 
  Plus, Search, Download, Star, Filter, BarChart3, FileText,
  Sparkles, Bell, Zap, Eye, Edit2, XCircle,
  Calendar, ArrowLeftRight, Wallet
} from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';

export default function NewHomePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{phone: string, name: string} | null>(null);

  const [formData, setFormData] = useState({
    customer_phone: '',
    customer_name: '',
    amount: '',
    description: '',
    due_date: ''
  });
  
  const [editFormData, setEditFormData] = useState({
    amount: '',
    description: '',
    due_date: '',
    update_reason: ''
  });

  const [quote] = useState(getRandomQuote());
  
  // Performance data states
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performancePeriod, setPerformancePeriod] = useState('6_months');

  useEffect(() => {
    loadDebts();
  }, [profile]);

  useEffect(() => {
    loadPerformanceData();
  }, [profile, performancePeriod]);

  async function loadDebts() {
    if (!profile) return;

    try {
      // استخدام Edge Function للحصول على البيانات المتزامنة
      const { data, error } = await supabase.functions.invoke('merchant-dashboard-data', {
        body: {
          status: 'all',
          date_range: 'all',
          page: '1',
          limit: '1000'
        }
      });

      if (error) {
        console.error('Error fetching debts from edge function:', error);
        // Fallback إلى الاستعلام المباشر في حالة فشل Edge Function
        const { data: directData, error: directError } = await supabase
          .from('debts')
          .select('*')
          .eq('merchant_id', profile.id)
          .order('created_at', { ascending: false });
        
        if (!directError && directData) {
          setDebts(directData);
        }
        setLoading(false);
        return;
      }

      if (data && data.data && data.data.debts) {
        setDebts(data.data.debts);
      } else {
        // في حالة عدم وجود بيانات من edge function، استخدم الاستعلام المباشر
        const { data: directData, error: directError } = await supabase
          .from('debts')
          .select('*')
          .eq('merchant_id', profile.id)
          .order('created_at', { ascending: false });
        
        if (!directError && directData) {
          setDebts(directData);
        }
      }
    } catch (error) {
      console.error('Error loading debts:', error);
      // Fallback إلى الاستعلام المباشر
      const { data: directData, error: directError } = await supabase
        .from('debts')
        .select('*')
        .eq('merchant_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (!directError && directData) {
        setDebts(directData);
      }
    }
    setLoading(false);
  }

  // Load performance data
  async function loadPerformanceData() {
    if (!profile) return;
    
    try {
      setPerformanceLoading(true);
      const { data, error } = await supabase.functions.invoke('merchant-performance-data', {
        body: { period: performancePeriod }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setPerformanceData(data.data);
      }
    } catch (error) {
      console.error('Error loading performance data:', error);
      toast.error('فشل في تحميل بيانات الأداء');
    } finally {
      setPerformanceLoading(false);
    }
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

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const total = debts.reduce((sum, d) => sum + d.amount, 0);
    const pending = debts.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0);
    const confirmed = debts.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + d.amount, 0);
    const paid = debts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0);
    const disputed = debts.filter(d => d.status === 'disputed').reduce((sum, d) => sum + d.amount, 0);
    const count = debts.length;
    const customers = new Set(debts.map(d => d.customer_phone)).size;
    const collectionRate = count > 0 ? (debts.filter(d => d.status === 'paid').length / count) * 100 : 0;

    return { total, pending, confirmed, paid, disputed, count, customers, collectionRate };
  }, [debts]);

  // بيانات للرسوم البيانية
  const statusData = [
    { name: 'مدفوع', value: debts.filter(d => d.status === 'paid').length, color: '#4CAF50' },
    { name: 'قيد الانتظار', value: debts.filter(d => d.status === 'pending').length, color: '#FFA500' },
    { name: 'مؤكد', value: debts.filter(d => d.status === 'confirmed').length, color: '#2196F3' },
    { name: 'معترض عليه', value: debts.filter(d => d.status === 'disputed').length, color: '#F44336' }
  ];

  const monthlyData = debts.reduce((acc: any[], debt) => {
    const month = new Date(debt.created_at).toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.amount += debt.amount;
      existing.count += 1;
    } else {
      acc.push({ month, amount: debt.amount, count: 1 });
    }
    return acc;
  }, []).slice(-6);

  // التنبيهات العاجلة
  const urgentAlerts = useMemo(() => {
    const today = new Date();
    const overdue = debts.filter(d => d.due_date && new Date(d.due_date) < today && d.status !== 'paid');
    const dueToday = debts.filter(d => d.due_date && new Date(d.due_date).toDateString() === today.toDateString());
    const disputed = debts.filter(d => d.status === 'disputed');
    
    return { overdue: overdue.length, dueToday: dueToday.length, disputed: disputed.length };
  }, [debts]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  // Functions for debt management (same as before)
  async function handleAddDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    try {
      const { error } = await supabase.from('debts').insert({
        merchant_id: profile.id,
        customer_phone: formData.customer_phone,
        customer_name: formData.customer_name,
        amount: parseFloat(formData.amount),
        description: formData.description || null,
        due_date: formData.due_date || null,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('تم إضافة الدين بنجاح');
      setShowAddForm(false);
      setFormData({ customer_phone: '', customer_name: '', amount: '', description: '', due_date: '' });
      loadDebts();
    } catch (error: any) {
      toast.error('حدث خطأ في إضافة الدين');
    }
  }

  // فتح modal التعديل
  function openEditModal(debt: Debt) {
    setSelectedDebt(debt);
    setEditFormData({
      amount: debt.amount.toString(),
      description: debt.description || '',
      due_date: debt.due_date || '',
      update_reason: ''
    });
    setShowEditModal(true);
  }

  // تحديث دين
  async function handleUpdateDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDebt) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('الرجاء تسجيل الدخول');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/debt-update`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            debt_id: selectedDebt.id,
            amount: parseFloat(editFormData.amount),
            description: editFormData.description,
            due_date: editFormData.due_date || null,
            update_reason: editFormData.update_reason
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل في تحديث الدين');
      }

      toast.success('تم تحديث الدين بنجاح');
      setShowEditModal(false);
      setSelectedDebt(null);
      loadDebts();
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في تحديث الدين');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <DollarSign className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">نظام إدارة الديون</h1>
              <p className="text-sm text-gray-600">{profile?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {urgentAlerts.overdue > 0 && (
              <div className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                <Bell size={16} />
                {urgentAlerts.overdue} متأخر
              </div>
            )}
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
              <ArrowLeftRight size={20} />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Hero Section with Quote */}
        <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-6 right-6 w-24 h-24 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-6 left-6 w-28 h-28 bg-white rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="animate-pulse" size={24} />
              <h2 className="text-2xl font-bold">مرحباً بك، {profile?.full_name}</h2>
            </div>
            <p className="text-lg mb-4 opacity-90">نتمنى لك يوماً مليئاً بالإنجازات والنجاح</p>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-sm italic mb-1">"{quote.text}"</p>
              <p className="text-xs opacity-75">- {quote.author}</p>
            </div>
          </div>
        </div>

        {/* التنبيهات العاجلة */}
        {(urgentAlerts.overdue > 0 || urgentAlerts.dueToday > 0 || urgentAlerts.disputed > 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="text-yellow-600" size={20} />
              <h3 className="font-bold text-yellow-800">تنبيهات عاجلة</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {urgentAlerts.overdue > 0 && (
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="text-red-800 font-bold">{urgentAlerts.overdue} دين متأخر</p>
                  <p className="text-red-600 text-sm">يجب المتابعة</p>
                </div>
              )}
              {urgentAlerts.dueToday > 0 && (
                <div className="bg-orange-100 p-3 rounded-lg">
                  <p className="text-orange-800 font-bold">{urgentAlerts.dueToday} دين مستحق اليوم</p>
                  <p className="text-orange-600 text-sm">للمتابعة</p>
                </div>
              )}
              {urgentAlerts.disputed > 0 && (
                <div className="bg-purple-100 p-3 rounded-lg">
                  <p className="text-purple-800 font-bold">{urgentAlerts.disputed} دين معترض عليه</p>
                  <p className="text-purple-600 text-sm">للمعالجة</p>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Zap className="text-yellow-600" />
            إجراءات سريعة
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-3 p-4 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all hover:scale-105"
            >
              <Plus size={24} />
              <div className="text-right">
                <p className="font-bold">إضافة دين جديد</p>
                <p className="text-sm opacity-75">إنشاء دين جديد للعميل</p>
              </div>
            </button>
            
            <button
              onClick={() => navigate('/analytics')}
              className="flex items-center gap-3 p-4 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all hover:scale-105"
            >
              <BarChart3 size={24} />
              <div className="text-right">
                <p className="font-bold">الإحصائيات المتقدمة</p>
                <p className="text-sm opacity-75">عرض التحليلات والتقارير</p>
              </div>
            </button>
            
            <button
              onClick={() => navigate('/capital-profits')}
              className="flex items-center gap-3 p-4 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all hover:scale-105"
            >
              <TrendingUp size={24} />
              <div className="text-right">
                <p className="font-bold">رأس المال والأرباح</p>
                <p className="text-sm opacity-75">إدارة رأس المال والأرباح</p>
              </div>
            </button>
          </div>
        </div>

        {/* نموذج إضافة دين */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <Plus className="text-green-600" />
              إضافة دين جديد
            </h3>
            <form onSubmit={handleAddDebt} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">اسم العميل *</label>
                <input
                  type="text"
                  required
                  value={formData.customer_name}
                  onChange={e => setFormData({...formData, customer_name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={formData.customer_phone}
                  onChange={e => setFormData({...formData, customer_phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">المبلغ (ر.س) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData({...formData, due_date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2 text-gray-700">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="md:col-span-2 flex gap-4">
                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors">
                  إضافة الدين
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-400 transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}





        {/* Monthly Summary Chart */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="text-blue-600" />
            الملخص الشهري - آخر 6 أشهر
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="amount" fill="#10B981" name="المبلغ (ر.س)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* الأداء العام */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                <BarChart3 className="text-green-600" size={28} />
                الأداء العام للأعمال
              </h3>
              <select
                value={performancePeriod}
                onChange={(e) => setPerformancePeriod(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 font-bold"
              >
                <option value="3_months">آخر 3 أشهر</option>
                <option value="6_months">آخر 6 أشهر</option>
                <option value="12_months">آخر 12 شهر</option>
              </select>
            </div>
          </div>

          {performanceLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">جاري تحميل بيانات الأداء...</p>
            </div>
          ) : performanceData ? (
            <div className="p-6 space-y-6">
              {/* إحصائيات سريعة */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">إجمالي الديون</p>
                      <p className="text-3xl font-bold">{performanceData.summary.totalDebts.toFixed(0)}</p>
                      <p className="text-blue-100 text-xs">ر.س</p>
                    </div>
                    <DollarSign size={32} className="text-blue-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">إجمالي المدفوعات</p>
                      <p className="text-3xl font-bold">{performanceData.summary.totalPayments.toFixed(0)}</p>
                      <p className="text-green-100 text-xs">ر.س</p>
                    </div>
                    <TrendingUp size={32} className="text-green-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">معدل السداد</p>
                      <p className="text-3xl font-bold">{performanceData.paymentRate}%</p>
                      <p className="text-purple-100 text-xs">نسبة</p>
                    </div>
                    <CheckCircle size={32} className="text-purple-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm">متوسط الدين</p>
                      <p className="text-3xl font-bold">{performanceData.averageDebtAmount.toFixed(0)}</p>
                      <p className="text-orange-100 text-xs">ر.س</p>
                    </div>
                    <BarChart3 size={32} className="text-orange-200" />
                  </div>
                </div>
              </div>

              {/* الرسوم البيانية */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* رسم بياني للديون والمدفوعات */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Calendar className="text-blue-600" />
                    تطور الديون والمدفوعات
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceData.monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [
                        `${value} ر.س`, 
                        name === 'totalDebts' ? 'الديون' : 'المدفوعات'
                      ]} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="totalDebts" 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        name="totalDebts"
                        dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalPayments" 
                        stroke="#10B981" 
                        strokeWidth={3}
                        name="totalPayments"
                        dot={{ fill: '#10B981', strokeWidth: 2, r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* رسم دائري لحالة الديون */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <PieChart className="text-purple-600" />
                    توزيع حالة الديون
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={performanceData.statusDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {performanceData.statusDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* إحصائيات مفصلة */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-yellow-50 rounded-xl">
                  <Clock className="mx-auto mb-2 text-yellow-600" size={24} />
                  <p className="text-2xl font-bold text-yellow-700">{performanceData.summary.totalPending}</p>
                  <p className="text-sm text-yellow-600">ديون قيد الانتظار</p>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <CheckCircle className="mx-auto mb-2 text-blue-600" size={24} />
                  <p className="text-2xl font-bold text-blue-700">{performanceData.summary.totalConfirmed}</p>
                  <p className="text-sm text-blue-600">ديون مؤكدة</p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <DollarSign className="mx-auto mb-2 text-green-600" size={24} />
                  <p className="text-2xl font-bold text-green-700">{performanceData.summary.totalPaid}</p>
                  <p className="text-sm text-green-600">ديون مدفوعة</p>
                </div>
                
                <div className="text-center p-4 bg-red-50 rounded-xl">
                  <AlertCircle className="mx-auto mb-2 text-red-600" size={24} />
                  <p className="text-2xl font-bold text-red-700">{performanceData.summary.totalOverdue}</p>
                  <p className="text-sm text-red-600">ديون متأخرة</p>
                </div>
              </div>

              {/* معدلات النمو */}
              {performanceData.growthData && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="text-indigo-600" />
                    معدل النمو الشهري
                  </h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={performanceData.growthData.slice(-3)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [
                        `${value}%`, 
                        name === 'debtGrowth' ? 'نمو الديون' : 'نمو المدفوعات'
                      ]} />
                      <Legend />
                      <Bar dataKey="debtGrowth" fill="#3B82F6" name="debtGrowth" />
                      <Bar dataKey="paymentGrowth" fill="#10B981" name="paymentGrowth" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <BarChart3 className="mx-auto mb-4 text-gray-400" size={64} />
              <p>لا توجد بيانات أداء متاحة</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal تعديل الدين */}
      {showEditModal && selectedDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Edit2 size={24} className="text-blue-600" />
                  تعديل الدين
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdateDebt} className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-700">
                  <p><span className="font-bold">العميل:</span> {selectedDebt.customer_name}</p>
                  <p><span className="font-bold">الهاتف:</span> {selectedDebt.customer_phone}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ (ر.س)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editFormData.amount}
                  onChange={e => setEditFormData({...editFormData, amount: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">المبلغ الحالي: {selectedDebt.amount.toFixed(2)} ر.س</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={editFormData.due_date}
                  onChange={e => setEditFormData({...editFormData, due_date: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الوصف</label>
                <textarea
                  value={editFormData.description}
                  onChange={e => setEditFormData({...editFormData, description: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سبب التعديل (اختياري)</label>
                <textarea
                  value={editFormData.update_reason}
                  onChange={e => setEditFormData({...editFormData, update_reason: e.target.value})}
                  placeholder="اكتب سبب تعديل الدين..."
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                  حفظ التعديلات
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)} 
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-400 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal التسديد */}
      {showPaymentModal && selectedCustomer && profile && (
        <PaymentModal
          customerPhone={selectedCustomer.phone}
          customerName={selectedCustomer.name}
          merchantId={profile.id}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedCustomer(null);
          }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setSelectedCustomer(null);
            loadDebts();
          }}
        />
      )}


    </div>
  );
}