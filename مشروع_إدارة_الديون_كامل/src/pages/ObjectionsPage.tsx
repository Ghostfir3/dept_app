import { useState, useEffect, useMemo } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  RotateCcw,
  TrendingUp,
  Users,
  Calendar,
  FileText,
  Reply,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';

type ObjectionStatus = 'pending' | 'resolved' | 'rejected';

interface Objection {
  id: string;
  debt_id: string;
  customer_id: string;
  title: string;
  description: string;
  status: ObjectionStatus;
  merchant_response?: string;
  response_date?: string;
  created_at: string;
  updated_at: string;
  debts: {
    id: string;
    customer_name: string;
    customer_phone: string;
    amount: number;
    description: string;
    merchant_id: string;
  };
}

interface ObjectionStats {
  total: number;
  pending: number;
  resolved: number;
  rejected: number;
}

interface Pagination {
  total_count: number;
  current_page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export default function ObjectionsPage() {
  const { profile } = useAuth();
  const [objections, setObjections] = useState<Objection[]>([]);
  const [stats, setStats] = useState<ObjectionStats>({
    total: 0,
    pending: 0,
    resolved: 0,
    rejected: 0
  });
  const [pagination, setPagination] = useState<Pagination>({
    total_count: 0,
    current_page: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false
  });
  const [loading, setLoading] = useState(true);
  
  // فلاتر
  const [statusFilter, setStatusFilter] = useState<'all' | ObjectionStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  
  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedObjection, setSelectedObjection] = useState<Objection | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState<ObjectionStatus>('resolved');
  
  // حقول تعديل مقدار الدين
  const [adjustedAmount, setAdjustedAmount] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [enableAmountAdjustment, setEnableAmountAdjustment] = useState(false);

  useEffect(() => {
    if (profile && profile.user_type === 'merchant') {
      loadObjections();
    }
  }, [profile, statusFilter, searchQuery, currentPage]);

  // تحميل الاعتراضات
  async function loadObjections() {
    try {
      setLoading(true);
      
      // بناء URL مع query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      // استدعاء Edge Function مع المعاملات في URL
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('الرجاء تسجيل الدخول');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/objections-management?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل في تحميل الاعتراضات');
      }

      const result = await response.json();

      if (result?.data) {
        setObjections(result.data.objections || []);
        setStats(result.data.stats || stats);
        setPagination(result.data.pagination || pagination);
      }
    } catch (error) {
      console.error('Error loading objections:', error);
      toast.error('فشل في تحميل الاعتراضات');
    } finally {
      setLoading(false);
    }
  }

  // تحديث اعتراض مع إمكانية تعديل مقدار الدين
  async function updateObjection(objectionId: string, merchantResponse?: string, newStatus?: ObjectionStatus) {
    try {
      const updateData: any = {
        objection_id: objectionId
      };

      if (merchantResponse !== undefined) {
        updateData.merchant_response = merchantResponse;
      }
      
      if (newStatus !== undefined) {
        updateData.status = newStatus;
      }

      // إذا تم تفعيل تعديل المبلغ
      if (enableAmountAdjustment && adjustedAmount && selectedObjection) {
        updateData.original_amount = selectedObjection.debts.amount;
        updateData.adjusted_amount = parseFloat(adjustedAmount);
        updateData.amount_adjustment_reason = adjustmentReason;

        // تحديث مقدار الدين الفعلي في جدول الديون
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const debtUpdateResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/debt-update`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                debt_id: selectedObjection.debt_id,
                amount: parseFloat(adjustedAmount),
                update_reason: adjustmentReason || 'تعديل من الاعتراض'
              })
            }
          );

          if (!debtUpdateResponse.ok) {
            throw new Error('فشل في تحديث مقدار الدين');
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('الرجاء تسجيل الدخول');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/objections-management`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل في تحديث الاعتراض');
      }

      // تحديث القائمة محلياً
      setObjections(prev => 
        prev.map(obj => 
          obj.id === objectionId 
            ? { 
                ...obj, 
                merchant_response: merchantResponse || obj.merchant_response,
                status: newStatus || obj.status,
                response_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                debts: enableAmountAdjustment && adjustedAmount ? {
                  ...obj.debts,
                  amount: parseFloat(adjustedAmount)
                } : obj.debts
              } 
            : obj
        )
      );

      // تحديث الإحصائيات
      if (newStatus) {
        setStats(prev => {
          const currentObjection = objections.find(obj => obj.id === objectionId);
          if (!currentObjection) return prev;

          const newStats = { ...prev };
          
          // طرح من الحالة القديمة
          if (currentObjection.status === 'pending') newStats.pending--;
          else if (currentObjection.status === 'resolved') newStats.resolved--;
          else if (currentObjection.status === 'rejected') newStats.rejected--;
          
          // إضافة للحالة الجديدة
          if (newStatus === 'pending') newStats.pending++;
          else if (newStatus === 'resolved') newStats.resolved++;
          else if (newStatus === 'rejected') newStats.rejected++;

          return newStats;
        });
      }

      toast.success(enableAmountAdjustment && adjustedAmount ? 'تم تحديث الاعتراض وتعديل المبلغ بنجاح' : 'تم تحديث الاعتراض بنجاح');
      setShowResponseModal(false);
      setResponseText('');
      setAdjustedAmount('');
      setAdjustmentReason('');
      setEnableAmountAdjustment(false);
    } catch (error) {
      console.error('Error updating objection:', error);
      toast.error((error as Error)?.message || 'فشل في تحديث الاعتراض');
    }
  }

  // فتح modal الرد
  function openResponseModal(objection: Objection) {
    setSelectedObjection(objection);
    setResponseText(objection.merchant_response || '');
    setResponseStatus(objection.status);
    setAdjustedAmount(objection.debts.amount.toString());
    setAdjustmentReason('');
    setEnableAmountAdjustment(false);
    setShowResponseModal(true);
  }

  // فتح modal التفاصيل
  function openDetailsModal(objection: Objection) {
    setSelectedObjection(objection);
    setShowDetailsModal(true);
  }

  // إعادة تعيين الفلاتر
  function resetFilters() {
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
    toast.success('تم إعادة تعيين الفلاتر');
  }

  // الحصول على إعدادات الحالة
  function getStatusConfig(status: ObjectionStatus) {
    switch (status) {
      case 'pending':
        return {
          label: 'معلق',
          color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-600',
          icon: <Clock size={16} />
        };
      case 'resolved':
        return {
          label: 'تم الحل',
          color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-600',
          icon: <CheckCircle size={16} />
        };
      case 'rejected':
        return {
          label: 'مرفوض',
          color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-600',
          icon: <XCircle size={16} />
        };
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">جاري تحميل الاعتراضات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 min-h-screen transition-colors duration-300" dir="rtl">
      {/* الرأس */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <MessageSquare className="text-red-600 dark:text-red-300" size={24} />
              </div>
              إدارة الاعتراضات
            </h1>
            <p className="text-gray-600 dark:text-gray-300">متابعة ومعالجة جميع اعتراضات العملاء</p>
          </div>
        </div>

        {/* إحصائيات الاعتراضات */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-r-4 border-gray-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-600 dark:text-gray-400 text-sm font-bold">الإجمالي</h3>
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <Users className="text-gray-600 dark:text-gray-400" size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">جميع الاعتراضات</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-md p-6 text-white hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold">معلقة</h3>
              <Clock size={24} />
            </div>
            <p className="text-3xl font-bold">{stats.pending}</p>
            <p className="text-sm opacity-90 mt-1">
              {stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}% من الإجمالي
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md p-6 text-white hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold">تم الحل</h3>
              <CheckCircle size={24} />
            </div>
            <p className="text-3xl font-bold">{stats.resolved}</p>
            <p className="text-sm opacity-90 mt-1">
              {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}% من الإجمالي
            </p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md p-6 text-white hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold">مرفوضة</h3>
              <XCircle size={24} />
            </div>
            <p className="text-3xl font-bold">{stats.rejected}</p>
            <p className="text-sm opacity-90 mt-1">
              {stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0}% من الإجمالي
            </p>
          </div>
        </div>

        {/* أدوات البحث والفلترة */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث في الاعتراضات..."
                className="w-full pr-10 pl-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md"
            >
              <Filter size={18} />
              فلاتر
            </button>
          </div>

          {/* الفلاتر المتقدمة */}
          {showFilters && (
            <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">الحالة</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="pending">معلقة</option>
                  <option value="resolved">تم الحل</option>
                  <option value="rejected">مرفوضة</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-all"
                >
                  <RotateCcw size={18} />
                  إعادة تعيين
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* قائمة الاعتراضات */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {objections.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="mx-auto mb-4 text-gray-400" size={64} />
            <p className="text-xl text-gray-600 dark:text-gray-300 font-bold">لا توجد اعتراضات</p>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {searchQuery || statusFilter !== 'all'
                ? 'لا توجد نتائج مطابقة للفلاتر المحددة'
                : 'لا توجد اعتراضات مسجلة حالياً'}
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 font-bold text-gray-700 dark:text-gray-300 text-sm">
                <div>العميل</div>
                <div>العنوان</div>
                <div>المبلغ</div>
                <div>الحالة</div>
                <div>تاريخ التقديم</div>
                <div>تاريخ الرد</div>
                <div>الإجراءات</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200 dark:divide-gray-600">
              {objections.map((objection, index) => {
                const statusConfig = getStatusConfig(objection.status);
                
                return (
                  <div
                    key={objection.id}
                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                      {/* العميل */}
                      <div>
                        <div className="font-bold text-gray-800 dark:text-white">
                          {objection.debts.customer_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {objection.debts.customer_phone}
                        </div>
                      </div>

                      {/* العنوان */}
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-white">
                          {objection.title}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {objection.description.length > 50 
                            ? `${objection.description.substring(0, 50)}...`
                            : objection.description}
                        </div>
                      </div>

                      {/* المبلغ */}
                      <div className="font-bold text-green-600 dark:text-green-400">
                        {objection.debts.amount.toFixed(2)} ر.س
                      </div>

                      {/* الحالة */}
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* تاريخ التقديم */}
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(objection.created_at).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>

                      {/* تاريخ الرد */}
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {objection.response_date 
                          ? new Date(objection.response_date).toLocaleDateString('ar-SA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : '-'}
                      </div>

                      {/* الإجراءات */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => openDetailsModal(objection)}
                          className="p-2 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-all hover:scale-110"
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openResponseModal(objection)}
                          className="p-2 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-all hover:scale-110"
                          title="الرد على الاعتراض"
                        >
                          <Reply size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    عرض {((pagination.current_page - 1) * 10) + 1} إلى {Math.min(pagination.current_page * 10, pagination.total_count)} من {pagination.total_count}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={!pagination.has_previous}
                      className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      السابق
                    </button>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded font-bold">
                      {pagination.current_page}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={!pagination.has_next}
                      className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      التالي
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal تفاصيل الاعتراض */}
      {showDetailsModal && selectedObjection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FileText size={24} />
                  تفاصيل الاعتراض
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* معلومات العميل */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-bold text-gray-800 dark:text-white mb-3">معلومات العميل</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">الاسم:</span>
                    <p className="font-semibold text-gray-800 dark:text-white">{selectedObjection.debts.customer_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">رقم الهاتف:</span>
                    <p className="font-semibold text-gray-800 dark:text-white">{selectedObjection.debts.customer_phone}</p>
                  </div>
                </div>
              </div>

              {/* معلومات الدين */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-bold text-gray-800 dark:text-white mb-3">معلومات الدين</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">المبلغ:</span>
                    <p className="font-semibold text-green-600 dark:text-green-400">{selectedObjection.debts.amount.toFixed(2)} ر.س</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">الوصف:</span>
                    <p className="font-semibold text-gray-800 dark:text-white">{selectedObjection.debts.description}</p>
                  </div>
                </div>
              </div>

              {/* تفاصيل الاعتراض */}
              <div>
                <h4 className="font-bold text-gray-800 dark:text-white mb-3">تفاصيل الاعتراض</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">العنوان:</span>
                    <p className="font-semibold text-gray-800 dark:text-white">{selectedObjection.title}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">الوصف:</span>
                    <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      {selectedObjection.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">الحالة:</span>
                      <div className="mt-1">
                        {(() => {
                          const statusConfig = getStatusConfig(selectedObjection.status);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${statusConfig.color}`}>
                              {statusConfig.icon}
                              {statusConfig.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">تاريخ التقديم:</span>
                      <p className="font-semibold text-gray-800 dark:text-white">
                        {new Date(selectedObjection.created_at).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* رد التاجر */}
              {selectedObjection.merchant_response && (
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-white mb-3">رد التاجر</h4>
                  <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                    <p className="text-gray-700 dark:text-gray-300">{selectedObjection.merchant_response}</p>
                    {selectedObjection.response_date && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                        تاريخ الرد: {new Date(selectedObjection.response_date).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all"
              >
                إغلاق
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  openResponseModal(selectedObjection);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <Reply size={18} />
                الرد على الاعتراض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal الرد على الاعتراض */}
      {showResponseModal && selectedObjection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Reply size={24} />
                  الرد على الاعتراض
                </h3>
                <button
                  onClick={() => setShowResponseModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  نص الرد
                </label>
                <textarea
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  placeholder="اكتب رد التاجر على الاعتراض..."
                  rows={4}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  حالة الاعتراض
                </label>
                <select
                  value={responseStatus}
                  onChange={e => setResponseStatus(e.target.value as ObjectionStatus)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="pending">معلق</option>
                  <option value="resolved">تم الحل</option>
                  <option value="rejected">مرفوض</option>
                </select>
              </div>

              {/* قسم تعديل مقدار الدين */}
              <div className="border-t-2 border-gray-200 dark:border-gray-600 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    تعديل مقدار الدين
                  </label>
                  <button
                    type="button"
                    onClick={() => setEnableAmountAdjustment(!enableAmountAdjustment)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      enableAmountAdjustment
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {enableAmountAdjustment ? 'مفعل' : 'غير مفعل'}
                  </button>
                </div>

                {enableAmountAdjustment && (
                  <div className="space-y-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                        المبلغ الأصلي: {selectedObjection?.debts.amount.toFixed(2)} ر.س
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        المبلغ المعدل (ر.س)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={adjustedAmount}
                        onChange={e => setAdjustedAmount(e.target.value)}
                        placeholder="أدخل المبلغ المعدل"
                        className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        سبب التعديل (اختياري)
                      </label>
                      <textarea
                        value={adjustmentReason}
                        onChange={e => setAdjustmentReason(e.target.value)}
                        placeholder="اكتب سبب تعديل المبلغ..."
                        rows={2}
                        className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none resize-none"
                      />
                    </div>
                    {adjustedAmount && parseFloat(adjustedAmount) !== selectedObjection?.debts.amount && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <AlertTriangle size={14} />
                        سيتم تحديث مقدار الدين في النظام
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowResponseModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all"
              >
                إلغاء
              </button>
              <button
                onClick={() => updateObjection(selectedObjection.id, responseText, responseStatus)}
                disabled={!responseText.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
                إرسال الرد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* رسالة الفلاتر النشطة */}
      {(searchQuery || statusFilter !== 'all') && (
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Filter size={18} />
            <span className="font-bold">
              الفلاتر نشطة - عرض {objections.length} من {stats.total}
            </span>
          </div>
          <button
            onClick={resetFilters}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-bold underline"
          >
            إلغاء جميع الفلاتر
          </button>
        </div>
      )}
    </div>
  );
}