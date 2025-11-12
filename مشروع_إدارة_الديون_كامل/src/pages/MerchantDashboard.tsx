
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Debt, SUPABASE_URL } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, LogOut, DollarSign, Users, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, Calendar, Edit2, PlusCircle, Trash2 } from 'lucide-react';

export default function MerchantDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
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
  const [quickAddFormData, setQuickAddFormData] = useState({
    amount: '',
    description: '',
    due_date: ''
  });

  useEffect(() => {
    loadDebts();
  }, [profile]);

  async function loadDebts() {
    if (!profile) return;
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('merchant_id', profile.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) setDebts(data);
    setLoading(false);
  }

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

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

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

  // فتح modal الإضافة السريعة
  function openQuickAddModal(debt: Debt) {
    setSelectedDebt(debt);
    setQuickAddFormData({
      amount: '',
      description: '',
      due_date: ''
    });
    setShowQuickAddModal(true);
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

  // حذف دين واحد
  async function handleDeleteDebt(debtId: string, customerName: string) {
    const confirmed = window.confirm(`هل أنت متأكد من حذف دين العميل "${customerName}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`);
    
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('الرجاء تسجيل الدخول');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/delete-debt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            debt_id: debtId,
            delete_type: 'single'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل في حذف الدين');
      }

      const result = await response.json();
      toast.success(result.message || 'تم حذف الدين بنجاح');
      loadDebts();
    } catch (error: any) {
      console.error('Error deleting debt:', error);
      toast.error(error.message || 'حدث خطأ في حذف الدين');
    }
  }

  // حذف عميل مع جميع ديونه
  async function handleDeleteCustomer(customerPhone: string, customerName: string) {
    const confirmed = window.confirm(`هل أنت متأكد من حذف العميل "${customerName}" وجميع ديونه؟\n\nهذا الإجراء سيحذف جميع الديون المرتبطة بهذا العميل ولا يمكن التراجع عنه.`);
    
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('الرجاء تسجيل الدخول');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/delete-debt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customer_phone: customerPhone,
            delete_type: 'customer'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل في حذف العميل');
      }

      const result = await response.json();
      toast.success(result.message || `تم حذف العميل "${customerName}" وجميع ديونه بنجاح`);
      loadDebts();
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      toast.error(error.message || 'حدث خطأ في حذف العميل');
    }
  }

  // إضافة دين سريع
  async function handleQuickAddDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDebt) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('الرجاء تسجيل الدخول');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/debt-quick-add`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reference_debt_id: selectedDebt.id,
            amount: parseFloat(quickAddFormData.amount),
            description: quickAddFormData.description || 'دين جديد',
            due_date: quickAddFormData.due_date || null
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل في إضافة الدين');
      }

      toast.success('تم إضافة الدين بنجاح');
      setShowQuickAddModal(false);
      setSelectedDebt(null);
      loadDebts();
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في إضافة الدين');
    }
  }

  // حساب الإحصائيات
  const stats = {
    total: debts.reduce((sum, d) => sum + d.amount, 0),
    pending: debts.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0),
    confirmed: debts.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + d.amount, 0),
    paid: debts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0),
    disputed: debts.filter(d => d.status === 'disputed').reduce((sum, d) => sum + d.amount, 0),
    count: debts.length,
    customers: new Set(debts.map(d => d.customer_phone)).size
  };

  // بيانات للرسوم البيانية
  const statusData = [
    { name: 'قيد الانتظار', value: debts.filter(d => d.status === 'pending').length, color: '#FFA500' },
    { name: 'مؤكد', value: debts.filter(d => d.status === 'confirmed').length, color: '#4CAF50' },
    { name: 'مدفوع', value: debts.filter(d => d.status === 'paid').length, color: '#2196F3' },
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <DollarSign className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">لوحة التاجر</h1>
              <p className="text-sm text-gray-600">{profile?.full_name}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-blue-500 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-sm font-medium">إجمالي الديون</h3>
              <DollarSign className="text-blue-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.total.toFixed(2)} ر.س</p>
            <p className="text-sm text-gray-500 mt-1">{stats.count} دين</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-orange-500 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-sm font-medium">قيد الانتظار</h3>
              <Clock className="text-orange-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.pending.toFixed(2)} ر.س</p>
            <p className="text-sm text-gray-500 mt-1">{debts.filter(d => d.status === 'pending').length} دين</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-green-500 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-sm font-medium">مدفوع</h3>
              <CheckCircle className="text-green-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.paid.toFixed(2)} ر.س</p>
            <p className="text-sm text-gray-500 mt-1">{debts.filter(d => d.status === 'paid').length} دين</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-purple-500 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-sm font-medium">العملاء</h3>
              <Users className="text-purple-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.customers}</p>
            <p className="text-sm text-gray-500 mt-1">عميل نشط</p>
          </div>
        </div>

        {/* الرسوم البيانية */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* توزيع الديون حسب الحالة */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="text-blue-600" />
              توزيع الديون حسب الحالة
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
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
            <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Calendar className="text-blue-600" size={18} />
              الديون خلال الأشهر الأخيرة
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#2196F3" strokeWidth={2} name="المبلغ (ر.س)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* زر إضافة دين */}
        <div className="mb-4">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Plus size={18} />
            إضافة دين جديد
          </button>
        </div>

        {/* نموذج إضافة دين */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800">إضافة دين جديد</h3>
            <form onSubmit={handleAddDebt} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">اسم العميل *</label>
                <input
                  type="text"
                  required
                  value={formData.customer_name}
                  onChange={e => setFormData({...formData, customer_name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={formData.customer_phone}
                  onChange={e => setFormData({...formData, customer_phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="05xxxxxxxx أو 7xxxxxxxx (يمني)"
                  pattern="[0-9+()\-\s]{8,15}"
                />
                <p className="text-sm text-gray-500 mt-1">
                  يقبل جميع أرقام الهواتف المحلية والدولية
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">المبلغ (ر.س) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData({...formData, due_date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2 text-gray-700">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="md:col-span-2 flex gap-4">
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                  إضافة الدين
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-400 transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* جدول الديون */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-xl font-bold text-gray-800">قائمة الديون</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">العميل</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">رقم الهاتف</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">المبلغ</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الحالة</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">تاريخ الاستحقاق</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">تاريخ الإضافة</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {debts.map((debt) => (
                  <tr key={debt.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{debt.customer_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{debt.customer_phone}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{debt.amount.toFixed(2)} ر.س</td>
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {debt.due_date ? new Date(debt.due_date).toLocaleDateString('ar-SA') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(debt.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(debt)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all hover:scale-110 group"
                          title="تعديل الدين"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => openQuickAddModal(debt)}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-all hover:scale-110 group"
                          title="إضافة دين سريع لنفس العميل"
                        >
                          <PlusCircle size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteDebt(debt.id, debt.customer_name)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all hover:scale-110 group"
                          title="حذف هذا الدين فقط"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(debt.customer_phone, debt.customer_name)}
                          className="p-2 bg-red-200 text-red-800 rounded-lg hover:bg-red-300 transition-all hover:scale-110 group"
                          title="حذف العميل مع جميع ديونه"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {debts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="mx-auto mb-2" size={48} />
                <p>لا توجد ديون مسجلة حالياً</p>
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

        {/* Modal الإضافة السريعة */}
        {showQuickAddModal && selectedDebt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <PlusCircle size={24} className="text-green-600" />
                    إضافة دين سريع
                  </h3>
                  <button
                    onClick={() => setShowQuickAddModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XCircle size={24} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleQuickAddDebt} className="p-6 space-y-4">
                <div className="bg-green-50 rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-700">
                    <p className="font-bold mb-2">سيتم إضافة دين جديد لنفس العميل:</p>
                    <p><span className="font-bold">العميل:</span> {selectedDebt.customer_name}</p>
                    <p><span className="font-bold">الهاتف:</span> {selectedDebt.customer_phone}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ (ر.س) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={quickAddFormData.amount}
                    onChange={e => setQuickAddFormData({...quickAddFormData, amount: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="أدخل مبلغ الدين الجديد"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={quickAddFormData.due_date}
                    onChange={e => setQuickAddFormData({...quickAddFormData, due_date: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الوصف</label>
                  <textarea
                    value={quickAddFormData.description}
                    onChange={e => setQuickAddFormData({...quickAddFormData, description: e.target.value})}
                    placeholder="وصف الدين الجديد..."
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit" 
                    className="flex-1 bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors"
                  >
                    إضافة الدين
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowQuickAddModal(false)} 
                    className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-400 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
