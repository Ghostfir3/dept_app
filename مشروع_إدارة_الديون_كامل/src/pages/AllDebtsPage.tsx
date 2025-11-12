
// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase, Debt, SUPABASE_URL } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  Search, Filter, Users, DollarSign, Clock, CheckCircle, XCircle, 
  AlertCircle, Edit2, Trash2, Plus, Calendar, User, Phone, FileText, Wallet, Eye
} from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import CustomerDetailsModal from '../components/CustomerDetailsModal';

interface CustomerSummary {
  customer_phone: string;
  customer_name: string;
  total_original_amount: number;
  total_paid_amount: number;
  total_remaining_amount: number;
  status_counts: {
    pending: number;
    confirmed: number;
    paid: number;
    disputed: number;
  };
  has_overdue: boolean;
  latest_debt_date: string;
  debts: Debt[];
}

interface CustomersData {
  customers: CustomerSummary[];
  stats: {
    total_customers: number;
    total_original_amount: number;
    total_paid_amount: number;
    total_remaining_amount: number;
    pending_amount: number;
    confirmed_amount: number;
    paid_amount: number;
    overdue_amount: number;
    overdue_customers: number;
  };
}

export default function AllDebtsPage() {
  const { profile } = useAuth();
  const [customersData, setCustomersData] = useState<CustomersData | null>(null);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  // البحث والفلاتر
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // إضافة/تعديل دين
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{phone: string, name: string} | null>(null);
  const [addFormData, setAddFormData] = useState({
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

  useEffect(() => {
    loadCustomersData();
  }, [profile]);

  useEffect(() => {
    filterAndSortCustomers();
  }, [customersData, searchTerm, statusFilter, sortBy, sortOrder]);

  async function loadCustomersData(forceRefresh = false) {
    if (!profile) return;
    
    // إذا كان هناك تحديث قسري، أضف تأخير قصير لضمان كتابة البيانات
    if (forceRefresh) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('الرجاء تسجيل الدخول');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/get-customers-summary`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل في جلب البيانات');
      }

      const result = await response.json();
      setCustomersData(result.data);
      
      if (forceRefresh) {
        toast.success('تم تحديث البيانات بنجاح');
      }
    } catch (error: any) {
      console.error('Error loading customers data:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    }
    setLoading(false);
  }

  function filterAndSortCustomers() {
    if (!customersData) return;
    
    let filtered = [...customersData.customers];

    // تطبيق البحث
    if (searchTerm) {
      filtered = filtered.filter(customer => 
        customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customer_phone.includes(searchTerm)
      );
    }

    // تطبيق فلتر الحالة
    if (statusFilter !== 'all') {
      if (statusFilter === 'overdue') {
        filtered = filtered.filter(customer => customer.has_overdue);
      } else if (statusFilter === 'paid') {
        filtered = filtered.filter(customer => customer.status_counts.paid > 0);
      } else {
        filtered = filtered.filter(customer => customer.status_counts[statusFilter as keyof typeof customer.status_counts] > 0);
      }
    }

    // تطبيق الترتيب
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'date':
          compareValue = new Date(a.latest_debt_date).getTime() - new Date(b.latest_debt_date).getTime();
          break;
        case 'amount':
          compareValue = a.total_remaining_amount - b.total_remaining_amount;
          break;
        case 'customer':
          compareValue = a.customer_name.localeCompare(b.customer_name, 'ar');
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    setFilteredCustomers(filtered);
  }

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
        `${SUPABASE_URL}/functions/v1/debt-create-with-notifications`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customer_phone: addFormData.customer_phone,
            customer_name: addFormData.customer_name,
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
      setShowAddModal(false);
      setAddFormData({ customer_phone: '', customer_name: '', amount: '', description: '', due_date: '' });
      loadCustomersData(true);
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في إضافة الدين');
    }
  }





  // حذف عميل مع جميع ديونه
  async function handleDeleteCustomer(customerPhone: string, customerName: string) {
    if (!confirm(`هل أنت متأكد من حذف العميل "${customerName}" وجميع ديونه؟\n\nهذا الإجراء سيحذف جميع الديون المرتبطة بهذا العميل ولا يمكن التراجع عنه.`)) return;

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
      loadCustomersData(true);
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في حذف العميل');
    }
  }



  // حساب الإحصائيات من البيانات المجمعة
  const stats = customersData?.stats || {
    total_customers: 0,
    total_original_amount: 0,
    total_paid_amount: 0,
    total_remaining_amount: 0,
    pending_amount: 0,
    confirmed_amount: 0,
    paid_amount: 0,
    overdue_amount: 0,
    overdue_customers: 0
  };

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
    <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">جميع الديون</h1>
        <p className="text-gray-600">عرض وإدارة جميع الديون والعملاء</p>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-xl p-4 border-r-4 border-blue-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 font-medium text-xs">إجمالي الديون المتبقية</h3>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-blue-600" size={16} />
            </div>
          </div>
          <p className="text-lg font-bold text-gray-800">{stats.total_remaining_amount?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-gray-500 mt-1">ر.س</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-4 border-r-4 border-green-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 font-medium text-xs">المبلغ المسدد</h3>
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-600" size={16} />
            </div>
          </div>
          <p className="text-lg font-bold text-green-700">{stats.total_paid_amount?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-gray-500 mt-1">ر.س</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-4 border-r-4 border-orange-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 font-medium text-xs">قيد الانتظار</h3>
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock className="text-orange-600" size={16} />
            </div>
          </div>
          <p className="text-lg font-bold text-orange-700">{stats.pending_amount?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-gray-500 mt-1">ر.س</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-4 border-r-4 border-gray-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 font-medium text-xs">مدفوع كلياً</h3>
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-gray-600" size={16} />
            </div>
          </div>
          <p className="text-lg font-bold text-gray-700">{stats.paid_amount?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-gray-500 mt-1">ر.س</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-4 border-r-4 border-red-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 font-medium text-xs">متأخر</h3>
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="text-red-600" size={16} />
            </div>
          </div>
          <p className="text-lg font-bold text-red-700">{stats.overdue_amount?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-gray-500 mt-1">ر.س</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-4 border-r-4 border-purple-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium text-sm">العملاء</h3>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="text-purple-600" size={24} />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-700">{stats.total_customers || 0}</p>
          <p className="text-xs text-gray-500 mt-1">عميل</p>
        </div>
      </div>

      {/* شريط البحث والفلاتر */}
      <div className="bg-white rounded-2xl shadow-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* البحث */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">البحث</label>
            <div className="relative">
              <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="ابحث عن عميل، رقم هاتف، أو وصف..."
              />
            </div>
          </div>

          {/* فلتر الحالة */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">الحالة</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">قيد الانتظار</option>
              <option value="confirmed">مؤكد</option>
              <option value="paid">مدفوع</option>
              <option value="disputed">معترض عليه</option>
              <option value="overdue">متأخر</option>
            </select>
          </div>

          {/* الترتيب */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">الترتيب حسب</label>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="date">التاريخ</option>
                <option value="amount">المبلغ</option>
                <option value="customer">العميل</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600">
              عرض {filteredCustomers.length} من {customersData?.stats.total_customers || 0} عميل
            </p>
            <button
              onClick={() => loadCustomersData(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors font-bold text-sm disabled:opacity-50"
              title="تحديث البيانات"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              تحديث
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold shadow-lg"
          >
            <Plus size={20} />
            إضافة دين جديد
          </button>
        </div>
      </div>

      {/* قائمة العملاء المجمعة */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-800">قائمة العملاء والديون</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">العميل</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">رقم الهاتف</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">المبلغ المتبقي</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">المبلغ الأصلي</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">المبلغ المسدد</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">عدد الديون</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الحالة</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">آخر دين</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers.map((customer) => {
                const hasOverdue = customer.has_overdue;
                return (
                  <tr key={customer.customer_phone} className={`hover:bg-gray-50 transition-colors ${hasOverdue ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="text-gray-400" size={16} />
                        <span className="text-sm font-bold text-gray-900">{customer.customer_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Phone className="text-gray-400" size={16} />
                        <span className="text-sm text-gray-600">{customer.customer_phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-blue-700">
                        {(customer.total_remaining_amount || 0).toFixed(2)} ر.س
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {(customer.total_original_amount || 0).toFixed(2)} ر.س
                    </td>
                    <td className="px-6 py-4">
                      {customer.total_paid_amount > 0 ? (
                        <div className="text-sm font-bold text-green-600">
                          {(customer.total_paid_amount || 0).toFixed(2)} ر.س
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-bold text-purple-600">
                        {customer.debts.length}
                      </div>
                      <div className="text-xs text-gray-500">
                        {customer.status_counts.pending > 0 && `${customer.status_counts.pending} قيد الانتظار`}
                        {customer.status_counts.confirmed > 0 && `, ${customer.status_counts.confirmed} مؤكد`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {customer.status_counts.pending > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                            <Clock size={12} />
                            قيد الانتظار
                          </span>
                        )}
                        {customer.status_counts.confirmed > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            <CheckCircle size={12} />
                            مؤكد
                          </span>
                        )}
                        {customer.status_counts.paid > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                            <CheckCircle size={12} />
                            مدفوع
                          </span>
                        )}
                        {hasOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            <AlertCircle size={12} />
                            متأخر
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(customer.latest_debt_date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedCustomer({
                              phone: customer.customer_phone,
                              name: customer.customer_name
                            });
                            setShowCustomerDetailsModal(true);
                          }}
                          className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-all hover:scale-110"
                          title="عرض تفاصيل العميل والديون"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCustomer({
                              phone: customer.customer_phone,
                              name: customer.customer_name
                            });
                            setShowPaymentModal(true);
                          }}
                          className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-all hover:scale-110"
                          title="تسديد"
                        >
                          <Wallet size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.customer_phone, customer.customer_name)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all hover:scale-110"
                          title="حذف العميل وجميع ديونه"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="mx-auto mb-2" size={48} />
              <p>لا توجد عملاء تطابق معايير البحث</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal إضافة دين جديد */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0" onClick={() => setShowAddModal(false)}></div>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative z-10">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Plus size={24} className="text-green-600" />
                  إضافة دين جديد
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleAddDebt} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم العميل</label>
                <input
                  type="text"
                  id="add-customer-name"
                  required
                  autoFocus
                  value={addFormData.customer_name}
                  onChange={e => setAddFormData({...addFormData, customer_name: e.target.value})}
                  placeholder="أدخل اسم العميل"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف</label>
                <input
                  type="tel"
                  id="add-customer-phone"
                  required
                  value={addFormData.customer_phone}
                  onChange={e => setAddFormData({...addFormData, customer_phone: e.target.value})}
                  placeholder="05xxxxxxxx أو 7xxxxxxxx"
                  pattern="[0-9+()\-\s]{8,15}"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ (ر.س)</label>
                <input
                  type="number"
                  id="add-debt-amount"
                  step="0.01"
                  required
                  value={addFormData.amount}
                  onChange={e => setAddFormData({...addFormData, amount: e.target.value})}
                  placeholder="أدخل المبلغ"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  id="add-due-date"
                  value={addFormData.due_date}
                  onChange={e => setAddFormData({...addFormData, due_date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الوصف (اختياري)</label>
                <textarea
                  id="add-description"
                  value={addFormData.description}
                  onChange={e => setAddFormData({...addFormData, description: e.target.value})}
                  rows={3}
                  placeholder="وصف الدين..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors"
                >
                  حفظ
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
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
            // تحديث قسري مع تأخير لضمان كتابة البيانات إلى قاعدة البيانات
            loadCustomersData(true);
          }}
        />
      )}

      {/* Modal تفاصيل العميل */}
      {showCustomerDetailsModal && selectedCustomer && (
        <CustomerDetailsModal
          customerPhone={selectedCustomer.phone}
          customerName={selectedCustomer.name}
          onClose={() => {
            setShowCustomerDetailsModal(false);
            setSelectedCustomer(null);
          }}
          onUpdate={() => {
            loadCustomersData();
          }}
        />
      )}
    </div>
  );
}
