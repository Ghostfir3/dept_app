
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Debt } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { LogOut, DollarSign, Clock, CheckCircle, AlertTriangle, MessageSquare, Calendar as CalendarIcon, XCircle, Bell, FileText, Gift, Megaphone } from 'lucide-react';

interface Objection {
  id: string;
  debt_id: string;
  customer_id: string;
  title: string;
  description: string;
  status: 'pending' | 'resolved' | 'rejected';
  merchant_response?: string;
  response_date?: string;
  created_at: string;
}

export default function CustomerDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [merchantNames, setMerchantNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
    // تم إزالة الـ interval غير الضروري لتحسين الأداء
  }, [profile]);

  async function loadData() {
    if (!profile) return;
    
    const { data: debtsData } = await supabase
      .from('debts')
      .select('*')
      .eq('customer_phone', profile.phone_number)
      .order('created_at', { ascending: false });
    
    if (debtsData) {
      setDebts(debtsData);
      
      // جلب أسماء التجار
      const merchantIds = [...new Set(debtsData.map(d => d.merchant_id))];
      const { data: merchantsData } = await supabase
        .from('users_profile')
        .select('id, full_name')
        .in('id', merchantIds);
      
      if (merchantsData) {
        const names: Record<string, string> = {};
        merchantsData.forEach(m => {
          names[m.id] = m.full_name;
        });
        setMerchantNames(names);
      }
    }

    const debtIds = debtsData?.map(d => d.id) || [];
    if (debtIds.length > 0) {
      const { data: objectionsData } = await supabase
        .from('objections')
        .select('*')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (objectionsData) setObjections(objectionsData);
    }

    setLoading(false);
  }

  async function handleConfirmDebt(debt: Debt) {
    try {
      const { error } = await supabase
        .from('debts')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', debt.id);
      
      if (error) throw error;

      toast.success('تم تأكيد الدين بنجاح');
      loadData();
    } catch (error: any) {
      toast.error('حدث خطأ في تأكيد الدين');
    }
  }

  async function handleDispute(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDebt || !disputeReason.trim()) return;

    try {
      // إنشاء اعتراض في جدول objections
      const { error } = await supabase.from('objections').insert({
        debt_id: selectedDebt.id,
        customer_id: profile?.id,
        title: 'اعتراض على الدين',
        description: disputeReason,
        status: 'pending'
      });

      if (error) throw error;

      await supabase.from('debts').update({ status: 'disputed' }).eq('id', selectedDebt.id);

      toast.success('تم إرسال الاعتراض بنجاح');
      setShowDisputeModal(false);
      setDisputeReason('');
      setSelectedDebt(null);
      loadData();
    } catch (error: any) {
      toast.error('حدث خطأ في إرسال الاعتراض');
    }
  }

  async function handlePaymentClaim(debt: Debt) {
    if (!profile) return;
    
    try {
      const { error } = await supabase.functions.invoke('payment-claim-submit', {
        body: {
          debt_id: debt.id,
          customer_name: profile.full_name,
          amount: debt.amount
        }
      });

      if (error) throw error;

      toast.success('تم إرسال المطالبة بنجاح للتاجر');
    } catch (error: any) {
      console.error('Error submitting payment claim:', error);
      toast.error('فشل إرسال المطالبة');
    }
  }

  function getDebtBorderStyle(debt: Debt): string {
    // للديون المسددة
    if (debt.status === 'paid') {
      return 'border-blue-500';
    }
    
    // للديون المعترض عليها
    if (debt.status === 'disputed') {
      return 'border-red-500';
    }
    
    // للديون التي لها تاريخ استحقاق
    if (debt.due_date) {
      const dueDate = new Date(debt.due_date);
      const today = new Date();
      const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLate > 7) {
        // متأخر أكثر من 7 أيام - أحمر متوهج
        return 'border-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]';
      } else if (daysLate > 3) {
        // متأخر 3-7 أيام - برتقالي متوهج
        return 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]';
      } else if (daysLate > 0) {
        // متأخر 1-3 أيام - أصفر
        return 'border-yellow-500';
      } else if (daysLate === 0) {
        // مستحق اليوم - برتقالي
        return 'border-orange-400';
      }
    }
    
    // الديون قيد الانتظار
    if (debt.status === 'pending') {
      return 'border-orange-500';
    }
    
    // الديون المؤكدة
    if (debt.status === 'confirmed') {
      return 'border-green-500';
    }
    
    return 'border-gray-300';
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  function getTimeRemaining(createdAt: string): string {
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + 24 * 60 * 60 * 1000); // 24 ساعة
    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();

    if (remaining <= 0) return 'انتهى الوقت - سيتم التأكيد قريباً';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    return `${hours}س ${minutes}د ${seconds}ث`;
  }

  function getTimePercentage(createdAt: string): number {
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const total = 24 * 60 * 60 * 1000;
    const remaining = deadline.getTime() - now.getTime();
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  }

  const stats = {
    total: debts.reduce((sum, d) => sum + d.amount, 0),
    pending: debts.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0),
    confirmed: debts.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + d.amount, 0),
    overdue: debts.filter(d => d.due_date && new Date(d.due_date) < new Date() && d.status !== 'paid').length
  };

  // بيانات التقويم
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay();
  
  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const getDebtsForDay = (day: number) => {
    return debts.filter(debt => {
      if (!debt.due_date) return false;
      const dueDate = new Date(debt.due_date);
      return dueDate.getDate() === day && 
             dueDate.getMonth() === selectedMonth && 
             dueDate.getFullYear() === selectedYear;
    });
  };

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">جاري التحميل...</div>;
  }

  return (
    <div>
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
              <DollarSign className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">لوحة العميل</h1>
              <p className="text-xs text-blue-100">{profile?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleLogout} className="flex items-center gap-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-lg hover:shadow-xl">
              <LogOut size={16} />
              <span className="font-bold text-sm">تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-4 border-t-4 border-blue-500 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-xs font-bold">إجمالي الديون</h3>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <DollarSign className="text-blue-600" size={16} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800">{stats.total.toFixed(2)} ر.س</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-4 border-t-4 border-orange-500 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-xs font-bold">الديون المعلقة</h3>
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="text-orange-600" size={16} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800">{stats.pending.toFixed(2)} ر.س</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-4 border-t-4 border-green-500 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-xs font-bold">الديون المؤكدة</h3>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="text-green-600" size={16} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800">{stats.confirmed.toFixed(2)} ر.س</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-4 border-t-4 border-red-500 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-xs font-bold">الديون المتأخرة</h3>
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={16} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800">{stats.overdue}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* التقويم */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <CalendarIcon className="text-blue-600" size={18} />
                تقويم مواعيد الاستحقاق
              </h3>
              <div className="flex gap-2">
                <select 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(parseInt(e.target.value))}
                  className="px-2 py-1 border-2 border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
                <select 
                  value={selectedYear} 
                  onChange={e => setSelectedYear(parseInt(e.target.value))}
                  className="px-2 py-1 border-2 border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
                >
                  {[2024, 2025, 2026].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2 text-center mb-3">
              {['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map(day => (
                <div key={day} className="text-xs font-bold text-gray-600 py-2">{day}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, idx) => {
                const dayDebts = day ? getDebtsForDay(day) : [];
                const hasDebts = dayDebts.length > 0;
                const isOverdue = dayDebts.some(d => new Date(d.due_date!) < new Date() && d.status !== 'paid');
                
                return (
                  <div 
                    key={idx} 
                    className={`aspect-square flex items-center justify-center rounded-xl text-sm font-bold relative transition-all ${
                      day ? 'bg-gray-50 hover:bg-gray-100 cursor-pointer shadow-sm' : ''
                    } ${hasDebts ? (isOverdue ? 'bg-red-100 border-2 border-red-500 shadow-md' : 'bg-blue-100 border-2 border-blue-500 shadow-md') : ''}`}
                    title={hasDebts ? dayDebts.map(d => `${d.customer_name}: ${d.amount} ر.س`).join('\n') : ''}
                  >
                    {day && (
                      <>
                        <span className="font-bold">{day}</span>
                        {hasDebts && (
                          <span className="absolute bottom-1 right-1 w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* معلومات سريعة */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-lg p-6 text-white">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <AlertTriangle size={24} />
              معلومات مهمة
            </h3>
            <div className="space-y-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <p className="text-sm font-bold mb-2">آلية التأكيد التلقائي</p>
                <p className="text-xs opacity-90">إذا لم تؤكد أو تعترض على أي دين خلال 24 ساعة من إنشائه، سيتم تأكيده تلقائياً.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <p className="text-sm font-bold mb-2">الاعتراض على الديون</p>
                <p className="text-xs opacity-90">يمكنك الاعتراض على أي دين تعتقد أنه غير صحيح. سيتم مراجعته من قبل التاجر.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <p className="text-sm font-bold mb-2">الديون المؤكدة</p>
                <p className="text-xs opacity-90">الديون المؤكدة هي التي اعترفت بها أو تم تأكيدها تلقائياً بعد 24 ساعة.</p>
              </div>
            </div>
          </div>
        </div>

        {/* قائمة الديون - بطاقات */}
        <div className="space-y-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="text-blue-600" size={28} />
            ديوني
          </h2>
          {debts.map((debt) => {
            const isOverdue = debt.due_date && new Date(debt.due_date) < new Date() && debt.status !== 'paid';
            const hasObjection = objections.some(d => d.debt_id === debt.id && d.status === 'pending');
            const isPending = debt.status === 'pending';
            const timeRemaining = isPending ? getTimeRemaining(debt.created_at) : null;
            const timePercentage = isPending ? getTimePercentage(debt.created_at) : 0;
            
            return (
              <div key={debt.id} className={`bg-white rounded-xl shadow-md p-4 border-r-4 transition-all hover:shadow-lg ${
                getDebtBorderStyle(debt)
              } ${isOverdue ? 'bg-red-50' : ''}`}>
                <div className="flex flex-col lg:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-1">{merchantNames[debt.merchant_id] || 'التاجر'}</h3>
                        {debt.description && (
                          <p className="text-sm text-gray-600">{debt.description}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                        debt.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                        debt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        debt.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {debt.status === 'pending' && <Clock size={14} />}
                        {debt.status === 'confirmed' && <CheckCircle size={14} />}
                        {debt.status === 'paid' && <CheckCircle size={14} />}
                        {debt.status === 'disputed' && <XCircle size={14} />}
                        {debt.status === 'pending' && 'قيد الانتظار'}
                        {debt.status === 'confirmed' && 'مؤكد'}
                        {debt.status === 'paid' && 'مدفوع'}
                        {debt.status === 'disputed' && 'معترض عليه'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">المبلغ</p>
                        <p className="text-lg font-bold text-gray-800">{debt.amount.toFixed(2)} ر.س</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">تاريخ الإضافة</p>
                        <p className="text-sm font-bold text-gray-700">{new Date(debt.created_at).toLocaleDateString('ar-SA')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">تاريخ الاستحقاق</p>
                        <p className="text-sm font-bold text-gray-700">{debt.due_date ? new Date(debt.due_date).toLocaleDateString('ar-SA') : '-'}</p>
                      </div>
                      {isOverdue && (
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="text-red-600" size={20} />
                          </div>
                          <span className="text-sm font-bold text-red-700">متأخر</span>
                        </div>
                      )}
                    </div>

                    {/* زر المطالبة بالتسديد */}
                    {debt.status === 'confirmed' && (
                      <div className="mb-3">
                        <button
                          onClick={() => handlePaymentClaim(debt)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all text-sm font-bold"
                        >
                          <Megaphone size={16} />
                          طالبت بتسجيل التسديد
                        </button>
                      </div>
                    )}

                    {/* عداد التأكيد التلقائي */}
                    {isPending && timeRemaining && (
                      <div className="mb-4 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold text-orange-800">العداد التنازلي للتأكيد التلقائي</p>
                          <span className={`text-lg font-bold ${timePercentage < 25 ? 'text-red-600 animate-pulse' : 'text-orange-700'}`}>
                            {timeRemaining}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              timePercentage < 25 ? 'bg-red-500' : 
                              timePercentage < 50 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${timePercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* الأزرار */}
                  <div className="flex lg:flex-col gap-2">
                    {debt.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleConfirmDebt(debt)}
                          className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-all shadow-md hover:shadow-lg"
                        >
                          <CheckCircle size={16} />
                          تأكيد الدين
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDebt(debt);
                            setShowDisputeModal(true);
                          }}
                          disabled={hasObjection}
                          className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                        >
                          <MessageSquare size={16} />
                          الاعتراض
                        </button>
                      </>
                    )}
                    {hasObjection && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 rounded-lg">
                        <Clock className="text-orange-600" size={16} />
                        <span className="text-xs font-bold text-orange-700">تحت المراجعة</span>
                      </div>
                    )}
                    {debt.status === 'confirmed' && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-100 rounded-lg">
                        <CheckCircle className="text-green-600" size={16} />
                        <span className="text-xs font-bold text-green-700">تم التأكيد</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {debts.length === 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-blue-600" size={40} />
              </div>
              <p className="text-xl font-bold text-gray-600">لا توجد ديون مسجلة</p>
            </div>
          )}
        </div>

        {/* قائمة الاعتراضات */}
        {objections.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MessageSquare className="text-red-600" size={24} />
              اعتراضاتي
            </h3>
            <div className="space-y-4">
              {objections.map((objection) => {
                const debt = debts.find(d => d.id === objection.debt_id);
                return (
                  <div key={objection.id} className="border-2 border-gray-200 rounded-xl p-5 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-gray-800 text-lg">
                          {objection.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-2 bg-white p-3 rounded-lg border border-gray-200">
                          الدين: {debt?.customer_name} - {debt?.amount.toFixed(2)} ر.س
                        </p>
                        <p className="text-sm text-gray-700 mt-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
                          {objection.description}
                        </p>
                        {objection.merchant_response && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm font-bold text-green-800 mb-1">رد التاجر:</p>
                            <p className="text-sm text-green-700">{objection.merchant_response}</p>
                          </div>
                        )}
                      </div>
                      <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                        objection.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                        objection.status === 'resolved' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {objection.status === 'pending' && 'قيد المراجعة'}
                        {objection.status === 'resolved' && 'تم الحل'}
                        {objection.status === 'rejected' && 'مرفوض'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(objection.created_at).toLocaleString('ar-SA')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* نافذة الاعتراض */}
      {showDisputeModal && selectedDebt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">تقديم اعتراض</h3>
            <div className="mb-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
              <p className="text-sm text-gray-600 mb-1">التاجر: {selectedDebt.customer_name}</p>
              <p className="text-sm text-gray-600">المبلغ: <span className="font-bold text-gray-800">{selectedDebt.amount.toFixed(2)} ر.س</span></p>
            </div>
            <form onSubmit={handleDispute}>
              <div className="mb-6">
                <label className="block text-sm font-bold mb-2 text-gray-700">سبب الاعتراض *</label>
                <textarea
                  required
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="اشرح سبب الاعتراض بالتفصيل..."
                />
              </div>
              <div className="flex gap-4">
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
                >
                  إرسال الاعتراض
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowDisputeModal(false);
                    setSelectedDebt(null);
                    setDisputeReason('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-400 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
