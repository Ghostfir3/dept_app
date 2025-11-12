import React, { useState, useEffect } from 'react';
import { supabase, Debt, SUPABASE_URL } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  X, User, Phone, DollarSign, TrendingUp, Calendar, 
  FileText, CheckCircle, Clock, Edit2, Wallet, Plus, AlertCircle
} from 'lucide-react';
import PaymentModal from './PaymentModal';

interface CustomerDetailsModalProps {
  customerPhone: string;
  customerName: string;
  onClose: () => void;
  onUpdate: () => void;
}

const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({
  customerPhone,
  customerName,
  onClose,
  onUpdate
}) => {
  const { profile } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  
  const [addFormData, setAddFormData] = useState({
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

  useEffect(() => {
    loadCustomerDebts();
  }, []);

  async function loadCustomerDebts(forceRefresh = false) {
    if (!profile) return;
    
    setLoading(true);
    
    // إذا كان هناك تحديث قسري، أضف تأخير قصير لضمان كتابة البيانات
    if (forceRefresh) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('merchant_id', profile.id)
      .eq('customer_phone', customerPhone)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      // جلب السدادات لكل دين مع ترتيب حسب الأحدث
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payment_transactions')
        .select('debts_paid, created_at')
        .eq('merchant_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (paymentsError) {
        console.error('Error loading payments:', paymentsError);
      }
      
      // حساب المبلغ المسدد لكل دين
      const paidAmounts: Record<string, number> = {};
      if (paymentsData) {
        paymentsData.forEach(transaction => {
          if (transaction.debts_paid && Array.isArray(transaction.debts_paid)) {
            transaction.debts_paid.forEach((debtPaid: any) => {
              const debtId = debtPaid.debt_id;
              const amountPaid = debtPaid.amount_paid || 0;
              paidAmounts[debtId] = (paidAmounts[debtId] || 0) + amountPaid;
            });
          }
        });
      }
      
      // إضافة المبلغ المتبقي لكل دين
      const debtsWithRemaining = data.map(debt => ({
        ...debt,
        paid_amount: paidAmounts[debt.id] || 0,
        remaining_amount: debt.amount - (paidAmounts[debt.id] || 0)
      }));
      
      setDebts(debtsWithRemaining);
      
      if (forceRefresh) {
        toast.success('تم تحديث البيانات بنجاح');
      }
    } else if (error) {
      console.error('Error loading customer debts:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    }
    
    setLoading(false);
  }

  // حساب الإحصائيات
  const stats = {
    totalOriginal: debts.reduce((sum, d) => sum + d.amount, 0),
    totalPaid: debts.reduce((sum, d) => sum + (d.paid_amount || 0), 0),
    totalRemaining: debts.reduce((sum, d) => sum + (d.remaining_amount || d.amount), 0),
    count: debts.length
  };

  // إضافة دين جديد (ذكي - يبحث عن العميل أولاً)
  async function handleAddDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('الرجاء تسجيل الدخول');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/debt-add-or-update`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customer_phone: customerPhone,
            customer_name: customerName,
            amount: parseFloat(addFormData.amount),
            description: addFormData.description,
            due_date: addFormData.due_date || null
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل في إضافة الدين');
      }

      const result = await response.json();
      toast.success(result.data.message);
      setShowAddDebtModal(false);
      setAddFormData({ amount: '', description: '', due_date: '' });
      loadCustomerDebts(true);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في إضافة الدين');
    }
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
      loadCustomerDebts(true);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في تحديث الدين');
    }
  }

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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998] p-4" dir="rtl" style={{ zIndex: 9998 }}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998] p-4" dir="rtl" style={{ zIndex: 9998 }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* رأس النافذة */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <User className="text-white" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{customerName}</h2>
                <div className="flex items-center gap-2 text-blue-100">
                  <Phone size={16} />
                  <span>{customerPhone}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* إحصائيات سريعة في الرأس */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-white bg-opacity-10 rounded-lg p-3">
              <p className="text-xs text-blue-100 mb-1">المبلغ الأصلي</p>
              <p className="text-xl font-bold">{stats.totalOriginal.toFixed(2)} ر.س</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-3">
              <p className="text-xs text-blue-100 mb-1">المبلغ المسدد</p>
              <p className="text-xl font-bold text-green-200">{stats.totalPaid.toFixed(2)} ر.س</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-3">
              <p className="text-xs text-blue-100 mb-1">المبلغ المتبقي</p>
              <p className="text-xl font-bold text-yellow-200">{stats.totalRemaining.toFixed(2)} ر.س</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-3">
              <p className="text-xs text-blue-100 mb-1">عدد الديون</p>
              <p className="text-xl font-bold">{stats.count}</p>
            </div>
          </div>
        </div>

        {/* المحتوى الرئيسي */}
        <div className="p-6">
          {/* أزرار الإجراءات */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold shadow-lg"
            >
              <Wallet size={20} />
              تسديد
            </button>
            <button
              onClick={() => setShowAddDebtModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-lg"
            >
              <Plus size={20} />
              إضافة دين جديد
            </button>
          </div>

          {/* قائمة الديون */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">قائمة الديون التفصيلية</h3>
            {debts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="mx-auto mb-2" size={48} />
                <p>لا توجد ديون لهذا العميل</p>
              </div>
            ) : (
              debts.map((debt) => {
                const isOverdue = debt.due_date && new Date(debt.due_date) < new Date() && debt.status !== 'paid';
                return (
                  <div
                    key={debt.id}
                    className={`bg-white border-2 rounded-xl p-5 shadow-md hover:shadow-lg transition-all ${
                      isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            debt.status === 'paid' ? 'bg-green-100' :
                            debt.status === 'confirmed' ? 'bg-blue-100' :
                            debt.status === 'disputed' ? 'bg-red-100' :
                            'bg-orange-100'
                          }`}>
                            {debt.status === 'paid' ? <CheckCircle className="text-green-600" size={20} /> :
                             debt.status === 'confirmed' ? <CheckCircle className="text-blue-600" size={20} /> :
                             debt.status === 'disputed' ? <AlertCircle className="text-red-600" size={20} /> :
                             <Clock className="text-orange-600" size={20} />}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-800">
                              دين #{debt.id.substring(0, 8)}
                            </h4>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              debt.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                              debt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                              debt.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {debt.status === 'pending' && 'قيد الانتظار'}
                              {debt.status === 'confirmed' && 'مؤكد'}
                              {debt.status === 'paid' && 'مدفوع'}
                              {debt.status === 'disputed' && 'معترض عليه'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-gray-500">تاريخ الإضافة</p>
                        <p className="text-sm font-bold text-gray-700">
                          {new Date(debt.created_at).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                    </div>

                    {/* تفاصيل المبالغ */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">المبلغ الأصلي</p>
                        <p className="text-lg font-bold text-gray-800">{debt.amount.toFixed(2)} ر.س</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">المبلغ المسدد</p>
                        <p className="text-lg font-bold text-green-700">
                          {(debt.paid_amount || 0).toFixed(2)} ر.س
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">المبلغ المتبقي</p>
                        <p className="text-lg font-bold text-blue-700">
                          {(debt.remaining_amount || debt.amount).toFixed(2)} ر.س
                        </p>
                      </div>
                    </div>

                    {/* تاريخ الاستحقاق والوصف */}
                    <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                      {debt.due_date && (
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className={isOverdue ? 'text-red-600' : 'text-gray-400'} />
                          <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                            استحقاق: {new Date(debt.due_date).toLocaleDateString('ar-SA')}
                          </span>
                        </div>
                      )}
                      {debt.description && (
                        <div className="flex items-center gap-2 flex-1">
                          <FileText size={16} className="text-gray-400" />
                          <span className="truncate">{debt.description}</span>
                        </div>
                      )}
                    </div>

                    {/* أزرار الإجراءات */}
                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => openEditModal(debt)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all font-bold text-sm"
                      >
                        <Edit2 size={16} />
                        تعديل
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* زر الإغلاق في الأسفل */}
        <div className="sticky bottom-0 bg-gray-50 p-4 border-t border-gray-200 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Modal التسديد */}
      {showPaymentModal && profile && (
        <PaymentModal
          customerPhone={customerPhone}
          customerName={customerName}
          merchantId={profile.id}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            loadCustomerDebts(true);
            onUpdate();
          }}
        />
      )}

      {/* Modal إضافة دين جديد */}
      {showAddDebtModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0" onClick={() => setShowAddDebtModal(false)}></div>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative z-10">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Plus size={24} className="text-blue-600" />
                  إضافة دين جديد لـ {customerName}
                </h3>
                <button
                  onClick={() => setShowAddDebtModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleAddDebt} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ (ر.س)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={addFormData.amount}
                  onChange={e => setAddFormData({...addFormData, amount: e.target.value})}
                  placeholder="أدخل المبلغ"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={addFormData.due_date}
                  onChange={e => setAddFormData({...addFormData, due_date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الوصف (اختياري)</label>
                <textarea
                  value={addFormData.description}
                  onChange={e => setAddFormData({...addFormData, description: e.target.value})}
                  className="form-description"
                  rows={3}
                  placeholder="وصف الدين..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                  إضافة الدين
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddDebtModal(false)}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-400 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal تعديل الدين */}
      {showEditModal && selectedDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0" onClick={() => setShowEditModal(false)}></div>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative z-10">
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
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdateDebt} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ (ر.س)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={editFormData.amount}
                  onChange={e => setEditFormData({...editFormData, amount: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">المبلغ الحالي: {selectedDebt.amount.toFixed(2)} ر.س</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={editFormData.due_date}
                  onChange={e => setEditFormData({...editFormData, due_date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الوصف</label>
                <textarea
                  value={editFormData.description}
                  onChange={e => setEditFormData({...editFormData, description: e.target.value})}
                  className="form-description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سبب التعديل (اختياري)</label>
                <textarea
                  value={editFormData.update_reason}
                  onChange={e => setEditFormData({...editFormData, update_reason: e.target.value})}
                  placeholder="اكتب سبب تعديل الدين..."
                  className="form-description"
                  rows={2}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
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
    </div>
  );
};

export default CustomerDetailsModal;
