import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileText, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Download,
  Eye,
  X,
  SortAsc,
  SortDesc,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';

type DebtStatus = 'paid' | 'pending' | 'overdue' | 'all';
type PeriodFilter = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year';
type SortField = 'created_at' | 'due_date' | 'amount' | 'merchant_name';
type SortOrder = 'asc' | 'desc';

interface Debt {
  id: string;
  debt_amount: number;
  description: string;
  status: DebtStatus;
  due_date: string;
  created_at: string;
  updated_at: string;
  merchant_name: string;
  business_name?: string;
  customer_name: string;
  customer_phone: string;
  display_status?: string;
  days_overdue?: number;
}

interface DebtStats {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  paymentRate: number;
  oldestDebt?: Debt;
  highestDebt?: Debt;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export default function CustomerDebtsHistoryPage() {
  const { user, profile } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [stats, setStats] = useState<DebtStats>({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    paymentRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  // فلاتر البحث
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DebtStatus>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('all');

  // الترتيب والتصفح
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
  });

  // قائمة التجار الفريدة
  const [availableMerchants, setAvailableMerchants] = useState<string[]>([]);

  // حساب رقم الصفحة والإحصائيات
  const currentStats = useMemo(() => {
    const filteredDebts = debts.filter(debt => {
      const matchesSearch = searchQuery === '' || 
        debt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        debt.merchant_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || debt.display_status === statusFilter;
      
      const matchesMerchant = merchantFilter === 'all' || debt.merchant_name === merchantFilter;

      return matchesSearch && matchesStatus && matchesMerchant;
    });

    return {
      total: filteredDebts.length,
      paid: filteredDebts.filter(d => d.display_status === 'paid').length,
      pending: filteredDebts.filter(d => d.display_status === 'pending').length,
      overdue: filteredDebts.filter(d => d.display_status === 'overdue').length,
      totalAmount: filteredDebts.reduce((sum, d) => sum + (d.debt_amount || 0), 0),
      paidAmount: filteredDebts.filter(d => d.display_status === 'paid').reduce((sum, d) => sum + (d.debt_amount || 0), 0),
      pendingAmount: filteredDebts.filter(d => d.display_status === 'pending').reduce((sum, d) => sum + (d.debt_amount || 0), 0),
      overdueAmount: filteredDebts.filter(d => d.display_status === 'overdue').reduce((sum, d) => sum + (d.debt_amount || 0), 0)
    };
  }, [debts, searchQuery, statusFilter, merchantFilter]);

  // جلب بيانات الديون
  const fetchDebts = async (refresh = false) => {
    if (!user || !profile) return;

    try {
      setLoading(true);

      // بناء URL للـ Edge Function مع المعاملات
      const params = new URLSearchParams({
        status: statusFilter,
        date_range: periodFilter,
        min_amount: minAmount || '',
        max_amount: maxAmount || '',
        merchant_name: merchantFilter || '',
        search: searchQuery || '',
        sort_by: sortField,
        sort_order: sortOrder,
        page: refresh ? '1' : currentPage.toString(),
        limit: '20'
      });

      const { data, error } = await supabase.functions.invoke('customer-debts-history?' + params.toString(), {
        method: 'GET'
      });

      if (error) {
        console.error('Error fetching debts:', error);
        toast.error('فشل في تحميل بيانات الديون');
        return;
      }

      if (data?.data) {
        const responseData = data.data;
        setDebts(responseData.debts || []);
        setPagination(responseData.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          hasMore: false
        });
        
        // تحديث قائمة التجار المتاحة
        if (responseData.filters?.available_merchants) {
          setAvailableMerchants(responseData.filters.available_merchants);
        }

        toast.success('تم تحميل بيانات الديون بنجاح');
      } else {
        toast.error('لم يتم العثور على بيانات');
      }
    } catch (error) {
      console.error('Error fetching debts:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // تحميل البيانات عند تغيير المعايير
  useEffect(() => {
    fetchDebts(true);
  }, [statusFilter, periodFilter, searchQuery, minAmount, maxAmount, merchantFilter, sortField, sortOrder]);

  // عرض تفاصيل الدين
  const handleViewDetails = (debt: Debt) => {
    setSelectedDebt(debt);
  };

  // تحميل المزيد من البيانات
  const loadMore = () => {
    if (pagination.hasMore) {
      setCurrentPage(prev => prev + 1);
      fetchDebts(false);
    }
  };

  // إعادة تعيين الفلاتر
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPeriodFilter('all');
    setMinAmount('');
    setMaxAmount('');
    setMerchantFilter('all');
    setCurrentPage(1);
    setSortField('created_at');
    setSortOrder('desc');
  };

  // تصدير البيانات
  const exportData = () => {
    // هنا يمكن إضافة تصدير البيانات
    toast.success('قريباً سيكون متاحاً');
  };

  // تحديد لون الحالة
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'overdue':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // تحديد نص الحالة
  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'مدفوع';
      case 'pending':
        return 'معلق';
      case 'overdue':
        return 'متأخر';
      default:
        return status;
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* العنوان الرئيسي */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                سجل الديون الكامل
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                تتبع وإدارة جميع ديونك مع فلاتر وبحث متقدم
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download size={18} />
                تصدير البيانات
              </button>
              <button
                onClick={() => fetchDebts(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <RefreshCw size={18} />
                تحديث
              </button>
            </div>
          </div>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي الديون</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentStats.total}
                </p>
                <p className="text-lg text-green-600">
                  {currentStats.totalAmount.toFixed(2)} ريال
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">الديون المدفوعة</p>
                <p className="text-2xl font-bold text-green-600">
                  {currentStats.paid}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentStats.paidAmount.toFixed(2)} ريال
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">الديون المعلقة</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {currentStats.pending}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentStats.pendingAmount.toFixed(2)} ريال
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">الديون المتأخرة</p>
                <p className="text-2xl font-bold text-red-600">
                  {currentStats.overdue}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentStats.overdueAmount.toFixed(2)} ريال
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* أدوات الفلترة والبحث */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* بحث فوري */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="البحث في الديون..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            {/* فلتر الحالة */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DebtStatus)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">جميع الحالات</option>
              <option value="paid">مدفوع</option>
              <option value="pending">معلق</option>
              <option value="overdue">متأخر</option>
            </select>

            {/* فلتر الفترة */}
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">جميع الفترات</option>
              <option value="today">اليوم</option>
              <option value="week">هذا الأسبوع</option>
              <option value="month">هذا الشهر</option>
              <option value="quarter">هذا الربع</option>
              <option value="year">هذه السنة</option>
            </select>

            {/* فلتر التاجر */}
            <select
              value={merchantFilter}
              onChange={(e) => setMerchantFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">جميع التجار</option>
              {availableMerchants.map(merchant => (
                <option key={merchant} value={merchant}>{merchant}</option>
              ))}
            </select>
          </div>

          {/* فلاتر إضافية */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                المبلغ الأدنى
              </label>
              <input
                type="number"
                placeholder="من"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                المبلغ الأعلى
              </label>
              <input
                type="number"
                placeholder="إلى"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Filter size={18} />
                إعادة تعيين
              </button>
            </div>
          </div>
        </div>

        {/* قائمة الديون */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">جاري تحميل البيانات...</p>
              </div>
            </div>
          ) : debts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">لا توجد ديون مطابقة للفلاتر المحددة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      العميل
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      الوسيط التجاري
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      المبلغ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      تاريخ الاستحقاق
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {debts.map((debt) => (
                    <tr key={debt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {debt.customer_name || debt.customer_phone}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {debt.customer_phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {debt.merchant_name}
                        </div>
                        {debt.business_name && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {debt.business_name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          {(debt.debt_amount || 0).toFixed(2)} ريال
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(debt.display_status || debt.status)}`}>
                          {getStatusText(debt.display_status || debt.status)}
                        </span>
                        {debt.days_overdue && debt.days_overdue > 0 && (
                          <div className="text-xs text-red-500 mt-1">
                            متأخر {debt.days_overdue} يوم
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(debt.due_date).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(debt)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* أزرار التنقل */}
          {!loading && debts.length > 0 && pagination.hasMore && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={loadMore}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <RefreshCw size={18} />
                تحميل المزيد
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal تفاصيل الدين */}
      {selectedDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  تفاصيل الدين
                </h2>
                <button
                  onClick={() => setSelectedDebt(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      رقم الدين
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedDebt.id}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      المبلغ
                    </label>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {(selectedDebt.debt_amount || 0).toFixed(2)} ريال
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    الوصف
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedDebt.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      الوسيط التجاري
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedDebt.merchant_name}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      اسم النشاط
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedDebt.business_name || 'غير محدد'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      الحالة
                    </label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedDebt.display_status || selectedDebt.status)}`}>
                      {getStatusText(selectedDebt.display_status || selectedDebt.status)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      تاريخ الاستحقاق
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedDebt.due_date).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      تاريخ الإنشاء
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedDebt.created_at).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      آخر تحديث
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedDebt.updated_at).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setSelectedDebt(null)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  إغلاق
                </button>
                <button
                  onClick={exportData}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  تصدير
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}