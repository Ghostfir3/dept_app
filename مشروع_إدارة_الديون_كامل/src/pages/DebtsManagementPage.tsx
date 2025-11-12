
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, Debt } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Users, Clock, CheckCircle, XCircle, AlertCircle, Search, Star, Download, FileText, TrendingUp, RotateCcw } from 'lucide-react';

interface SavedSearch {
  id: string;
  name: string;
  searchTerm: string;
  statusFilter: string;
  minAmount: number | '';
  maxAmount: number | '';
  dateFrom: string;
  dateTo: string;
}

export default function DebtsManagementPage() {
  const { profile } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    loadDebts();
    loadSavedSearches();
  }, [profile]);

  // Debounce للبحث المباشر
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // اقتراحات البحث
  useEffect(() => {
    if (searchTerm.length > 1) {
      const suggestions = Array.from(new Set(debts.map(d => d.customer_name)));
      const phoneSuggestions = Array.from(new Set(debts.map(d => d.customer_phone)));
      const allSuggestions = [...suggestions, ...phoneSuggestions]
        .filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 5);
      setSearchSuggestions(allSuggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [searchTerm, debts]);

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

  function loadSavedSearches() {
    const saved = localStorage.getItem('saved_searches');
    if (saved) setSavedSearches(JSON.parse(saved));
  }

  function saveCurrentSearch() {
    const name = prompt('أدخل اسم للبحث المحفوظ:');
    if (!name) return;
    
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name,
      searchTerm,
      statusFilter,
      minAmount,
      maxAmount,
      dateFrom,
      dateTo
    };
    
    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem('saved_searches', JSON.stringify(updated));
    toast.success('تم حفظ البحث بنجاح');
  }

  function loadSavedSearch(search: SavedSearch) {
    setSearchTerm(search.searchTerm);
    setStatusFilter(search.statusFilter);
    setMinAmount(search.minAmount);
    setMaxAmount(search.maxAmount);
    setDateFrom(search.dateFrom);
    setDateTo(search.dateTo);
    toast.success(`تم تحميل البحث: ${search.name}`);
  }

  function deleteSavedSearch(id: string) {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem('saved_searches', JSON.stringify(updated));
    toast.success('تم حذف البحث المحفوظ');
  }

  function exportToCSV() {
    const headers = ['اسم العميل', 'رقم الهاتف', 'المبلغ', 'الحالة', 'تاريخ الاستحقاق', 'تاريخ الإضافة'];
    const rows = filteredDebts.map(d => [
      d.customer_name,
      d.customer_phone,
      d.amount.toFixed(2),
      d.status,
      d.due_date || '',
      new Date(d.created_at).toLocaleDateString('ar-SA')
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `debts-export-${Date.now()}.csv`;
    link.click();
    toast.success('تم تصدير البيانات بنجاح');
  }

  function highlightMatch(text: string, query: string) {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? 
        `<mark class="bg-yellow-300 font-bold">${part}</mark>` : part
    ).join('');
  }

  const stats = {
    total: debts.reduce((sum, d) => sum + d.amount, 0),
    pending: debts.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0),
    confirmed: debts.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + d.amount, 0),
    paid: debts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0),
    disputed: debts.filter(d => d.status === 'disputed').reduce((sum, d) => sum + d.amount, 0),
    count: debts.length,
    customers: new Set(debts.map(d => d.customer_phone)).size
  };

  // تصفية الديون المتقدمة مع useMemo للأداء
  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      // استخدام debouncedSearchTerm للبحث المباشر
      const matchesSearch = debt.customer_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           debt.customer_phone.includes(debouncedSearchTerm) ||
                           (debt.description && debt.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || debt.status === statusFilter;
      const matchesMinAmount = minAmount === '' || debt.amount >= minAmount;
      const matchesMaxAmount = maxAmount === '' || debt.amount <= maxAmount;
      
      const debtDate = new Date(debt.created_at);
      const matchesDateFrom = !dateFrom || debtDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || debtDate <= new Date(dateTo + 'T23:59:59');
      
      return matchesSearch && matchesStatus && matchesMinAmount && matchesMaxAmount && matchesDateFrom && matchesDateTo;
    });
  }, [debts, debouncedSearchTerm, statusFilter, minAmount, maxAmount, dateFrom, dateTo]);

  // إحصائيات نتائج البحث
  const searchStats = useMemo(() => ({
    totalAmount: filteredDebts.reduce((sum, d) => sum + d.amount, 0),
    avgAmount: filteredDebts.length > 0 ? filteredDebts.reduce((sum, d) => sum + d.amount, 0) / filteredDebts.length : 0,
    uniqueCustomers: new Set(filteredDebts.map(d => d.customer_phone)).size
  }), [filteredDebts]);

  // دالة لإعادة تعيين الفلاتر
  function resetFilters() {
    setSearchTerm('');
    setStatusFilter('all');
    setMinAmount('');
    setMaxAmount('');
    setDateFrom('');
    setDateTo('');
  }

  if (loading) {
    return (
      <div className="p-8 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">إدارة العملاء والديون</h1>
        <p className="text-gray-600">عرض وإدارة جميع الديون والعملاء</p>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-green-500 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm font-medium">إجمالي الديون</h3>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Users className="text-green-600" size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.total.toFixed(2)} ر.س</p>
          <p className="text-sm text-gray-500 mt-1">{stats.count} دين</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-orange-500 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm font-medium">قيد الانتظار</h3>
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock className="text-orange-600" size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.pending.toFixed(2)} ر.س</p>
          <p className="text-sm text-gray-500 mt-1">{debts.filter(d => d.status === 'pending').length} دين</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-blue-500 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm font-medium">مدفوع</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-blue-600" size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.paid.toFixed(2)} ر.س</p>
          <p className="text-sm text-gray-500 mt-1">{debts.filter(d => d.status === 'paid').length} دين</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-purple-500 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm font-medium">العملاء</h3>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="text-purple-600" size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.customers}</p>
          <p className="text-sm text-gray-500 mt-1">عميل نشط</p>
        </div>
      </div>

      {/* أدوات التصفية والبحث */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex flex-col gap-4">
          {/* الصف الأول: البحث والحالة */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="بحث باسم العميل، رقم الهاتف، أو الوصف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-12 pl-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-6 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 font-bold"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">قيد الانتظار</option>
              <option value="confirmed">مؤكد</option>
              <option value="paid">مدفوع</option>
              <option value="disputed">معترض عليه</option>
            </select>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="px-6 py-3 bg-blue-100 text-blue-600 rounded-xl font-bold hover:bg-blue-200 transition-all"
            >
              {showAdvancedFilters ? 'إخفاء الفلاتر المتقدمة' : 'فلاتر متقدمة'}
            </button>
          </div>

          {/* الفلاتر المتقدمة */}
          {showAdvancedFilters && (
            <div className="border-t-2 border-gray-200 pt-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الحد الأدنى للمبلغ</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الحد الأقصى للمبلغ</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">من تاريخ</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">إلى تاريخ</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-all"
                >
                  إعادة تعيين الفلاتر
                </button>
              </div>
            </div>
          )}

          {/* عرض عدد النتائج */}
          <div className="text-sm text-gray-600">
            عرض <span className="font-bold text-green-600">{filteredDebts.length}</span> من أصل <span className="font-bold">{debts.length}</span> دين
          </div>
        </div>
      </div>

      {/* جدول الديون */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white">
              <tr>
                <th className="px-6 py-4 text-right text-sm font-bold">العميل</th>
                <th className="px-6 py-4 text-right text-sm font-bold">رقم الهاتف</th>
                <th className="px-6 py-4 text-right text-sm font-bold">المبلغ</th>
                <th className="px-6 py-4 text-right text-sm font-bold">الحالة</th>
                <th className="px-6 py-4 text-right text-sm font-bold">تاريخ الاستحقاق</th>
                <th className="px-6 py-4 text-right text-sm font-bold">تاريخ الإضافة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDebts.map((debt) => (
                <tr key={debt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{debt.customer_name}</p>
                      {debt.description && (
                        <p className="text-xs text-gray-500 mt-1">{debt.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-medium">{debt.customer_phone}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDebts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="mx-auto mb-2" size={48} />
              <p>لا توجد ديون تطابق معايير البحث</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
