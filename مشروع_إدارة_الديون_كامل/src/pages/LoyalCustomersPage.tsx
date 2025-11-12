import React, { useState, useEffect } from 'react';
import { supabase, LoyalCustomer, DiscountOffer } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Award, Search, Plus, TrendingUp, Gift, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const LoyalCustomersPage: React.FC = () => {
  const { profile } = useAuth();
  const [loyalCustomers, setLoyalCustomers] = useState<LoyalCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAdditionType, setFilterAdditionType] = useState('all');
  const [filterBadgeType, setFilterBadgeType] = useState('all');
  const [sortBy, setSortBy] = useState('transactions_desc');
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<LoyalCustomer | null>(null);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    gold: 0,
    silver: 0,
    platinum: 0,
    activeOffers: 0
  });

  useEffect(() => {
    fetchLoyalCustomers();
    fetchActiveOffers();
  }, [profile?.id]);

  const fetchLoyalCustomers = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('loyal_customers')
        .select('*')
        .eq('merchant_id', profile.id)
        .eq('status', 'active')
        .order('weekly_transactions', { ascending: false });

      if (error) throw error;

      setLoyalCustomers(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      console.error('Error fetching loyal customers:', error);
      toast.error('فشل تحميل العملاء الدائمين');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveOffers = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('discount_offers')
        .select('*')
        .eq('merchant_id', profile.id)
        .eq('status', 'pending');

      if (error) throw error;

      setStats(prev => ({ ...prev, activeOffers: data?.length || 0 }));
    } catch (error) {
      console.error('Error fetching active offers:', error);
    }
  };

  const calculateStats = (customers: LoyalCustomer[]) => {
    setStats({
      total: customers.length,
      gold: customers.filter(c => c.badge_type === 'gold').length,
      silver: customers.filter(c => c.badge_type === 'silver').length,
      platinum: customers.filter(c => c.badge_type === 'platinum').length,
      activeOffers: stats.activeOffers
    });
  };

  const getBadgeEmoji = (badgeType: string) => {
    switch (badgeType) {
      case 'gold':
        return '🥇';
      case 'silver':
        return '🥈';
      case 'platinum':
        return '💎';
      default:
        return '⚪';
    }
  };

  const getBadgeColor = (badgeType: string) => {
    switch (badgeType) {
      case 'gold':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'silver':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'platinum':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      default:
        return 'text-gray-400 bg-gray-50 border-gray-200';
    }
  };

  const getSpeedColor = (days: number | null) => {
    if (!days) return 'text-gray-500';
    if (days <= 1) return 'text-green-600 font-bold';
    if (days <= 5) return 'text-blue-600';
    if (days <= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  const toggleRowExpansion = (customerId: string) => {
    setExpandedRows(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleRemoveCustomer = async (customerId: string) => {
    if (!confirm('هل أنت متأكد من إزالة هذا العميل من القائمة الدائمة؟')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('loyal_customers')
        .update({ status: 'inactive' })
        .eq('id', customerId);

      if (error) throw error;

      toast.success('تم إزالة العميل من القائمة');
      fetchLoyalCustomers();
    } catch (error: any) {
      console.error('Error removing customer:', error);
      toast.error('فشل إزالة العميل');
    }
  };

  const openDiscountModal = (customer: LoyalCustomer) => {
    setSelectedCustomer(customer);
    setShowDiscountModal(true);
  };

  const filteredCustomers = loyalCustomers.filter(customer => {
    const matchesSearch = customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.customer_phone.includes(searchTerm);
    const matchesAdditionType = filterAdditionType === 'all' || customer.addition_type === filterAdditionType;
    const matchesBadgeType = filterBadgeType === 'all' || customer.badge_type === filterBadgeType;
    
    return matchesSearch && matchesAdditionType && matchesBadgeType;
  });

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    switch (sortBy) {
      case 'transactions_desc':
        return b.weekly_transactions - a.weekly_transactions;
      case 'last_transaction':
        return new Date(b.last_transaction_date || 0).getTime() - new Date(a.last_transaction_date || 0).getTime();
      case 'payment_speed':
        return (a.average_payment_days || 999) - (b.average_payment_days || 999);
      case 'added_date':
        return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل العملاء الدائمين...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">إدارة العملاء الدائمين</h1>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">إجمالي العملاء</p>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <Users className="text-blue-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">عملاء بلاتينيين</p>
              <p className="text-3xl font-bold text-purple-600">{stats.platinum}</p>
              <p className="text-xs text-gray-500">سداد خلال يوم</p>
            </div>
            <Award className="text-purple-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">عملاء ذهبيين</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.gold}</p>
              <p className="text-xs text-gray-500">سداد خلال 5 أيام</p>
            </div>
            <Award className="text-yellow-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">عملاء فضيين</p>
              <p className="text-3xl font-bold text-gray-600">{stats.silver}</p>
              <p className="text-xs text-gray-500">سداد خلال 10 أيام</p>
            </div>
            <Award className="text-gray-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">عروض خصم نشطة</p>
              <p className="text-3xl font-bold text-green-600">{stats.activeOffers}</p>
              <p className="text-xs text-gray-500">في انتظار الرد</p>
            </div>
            <Gift className="text-green-500" size={40} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="ابحث بالاسم أو الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Addition Type Filter */}
            <select
              value={filterAdditionType}
              onChange={(e) => setFilterAdditionType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">نوع الإضافة: الكل</option>
              <option value="auto">تلقائي</option>
              <option value="manual">يدوي</option>
            </select>

            {/* Badge Filter */}
            <select
              value={filterBadgeType}
              onChange={(e) => setFilterBadgeType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">الشارة: الكل</option>
              <option value="platinum">بلاتيني</option>
              <option value="gold">ذهبي</option>
              <option value="silver">فضي</option>
              <option value="none">بدون شارة</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="transactions_desc">عدد التعاملات ↓</option>
              <option value="last_transaction">آخر تعامل</option>
              <option value="payment_speed">سرعة السداد</option>
              <option value="added_date">تاريخ الإضافة</option>
            </select>
          </div>

          {/* Add Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            إضافة عميل يدوياً
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">اسم العميل</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الهاتف</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الشارة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">التعاملات</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">متوسط السداد</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">نوع الإضافة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    لا توجد عملاء دائمين حالياً
                  </td>
                </tr>
              ) : (
                sortedCustomers.map((customer) => (
                  <React.Fragment key={customer.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Users className="text-blue-500" size={20} />
                          <span className="font-medium">{customer.customer_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{customer.customer_phone}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border ${getBadgeColor(customer.badge_type)}`}>
                          {getBadgeEmoji(customer.badge_type)}
                          {customer.badge_type === 'platinum' && 'بلاتيني'}
                          {customer.badge_type === 'gold' && 'ذهبي'}
                          {customer.badge_type === 'silver' && 'فضي'}
                          {customer.badge_type === 'none' && 'لا يوجد'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-bold text-blue-600">{customer.weekly_transactions}</span>
                        <span className="text-gray-500"> / {customer.total_transactions}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={getSpeedColor(customer.average_payment_days)}>
                          {customer.average_payment_days ? `${customer.average_payment_days.toFixed(1)} يوم` : 'غير متوفر'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                          customer.addition_type === 'auto' 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'bg-green-50 text-green-700'
                        }`}>
                          {customer.addition_type === 'auto' ? '🤖 تلقائي' : '✋ يدوي'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleRowExpansion(customer.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="عرض التفاصيل"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => openDiscountModal(customer)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="إرسال عرض خصم"
                          >
                            <Gift size={18} />
                          </button>
                          <button
                            onClick={() => handleRemoveCustomer(customer.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="إزالة من القائمة"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Details */}
                    {expandedRows.includes(customer.id) && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50">
                          <div className="p-6 rounded-lg border border-gray-200 bg-white">
                            <h4 className="font-bold text-lg mb-4">تفاصيل العميل</h4>
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-gray-600 text-sm">تاريخ الإضافة</p>
                                <p className="font-medium">{new Date(customer.added_at).toLocaleDateString('ar-SA')}</p>
                              </div>
                              <div>
                                <p className="text-gray-600 text-sm">آخر تعامل</p>
                                <p className="font-medium">
                                  {customer.last_transaction_date 
                                    ? new Date(customer.last_transaction_date).toLocaleDateString('ar-SA')
                                    : 'غير متوفر'}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600 text-sm">أسرع سداد</p>
                                <p className="font-medium text-green-600">
                                  {customer.fastest_payment_days !== null 
                                    ? `${customer.fastest_payment_days} يوم` 
                                    : 'غير متوفر'}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600 text-sm">معدل الموثوقية</p>
                                <p className="font-medium text-blue-600">
                                  {customer.payment_reliability_score.toFixed(0)}%
                                </p>
                              </div>
                            </div>
                            {customer.addition_reason && (
                              <div className="mt-4">
                                <p className="text-gray-600 text-sm mb-1">سبب الإضافة</p>
                                <p className="text-gray-800">{customer.addition_reason}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchLoyalCustomers();
          }}
        />
      )}

      {/* Discount Offer Modal */}
      {showDiscountModal && selectedCustomer && (
        <DiscountOfferModal
          customer={selectedCustomer}
          onClose={() => {
            setShowDiscountModal(false);
            setSelectedCustomer(null);
          }}
          onSuccess={() => {
            setShowDiscountModal(false);
            setSelectedCustomer(null);
            fetchActiveOffers();
          }}
        />
      )}
    </div>
  );
};

// Add Customer Modal Component
const AddCustomerModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [additionReason, setAdditionReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    try {
      const { data, error } = await supabase
        .from('debts')
        .select('customer_phone, customer_name')
        .eq('merchant_id', profile?.id)
        .or(`customer_phone.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      // Remove duplicates
      const uniqueCustomers = Array.from(
        new Map(data?.map(item => [item.customer_phone, item])).values()
      );

      setSearchResults(uniqueCustomers);
    } catch (error: any) {
      console.error('Error searching customers:', error);
      toast.error('فشل البحث عن العملاء');
    }
  };

  const handleAddCustomer = async () => {
    if (!selectedCustomer) {
      toast.error('يرجى اختيار عميل');
      return;
    }

    try {
      setLoading(true);

      // Get total transactions count
      const { data: debtsData } = await supabase
        .from('debts')
        .select('id')
        .eq('merchant_id', profile?.id)
        .eq('customer_phone', selectedCustomer.customer_phone);

      const { error } = await supabase
        .from('loyal_customers')
        .insert({
          merchant_id: profile?.id,
          customer_phone: selectedCustomer.customer_phone,
          customer_name: selectedCustomer.customer_name,
          addition_type: 'manual',
          addition_reason: additionReason || 'إضافة يدوية من التاجر',
          total_transactions: debtsData?.length || 0,
          weekly_transactions: 0,
          status: 'active'
        });

      if (error) throw error;

      toast.success('تمت إضافة العميل بنجاح');
      onSuccess();
    } catch (error: any) {
      console.error('Error adding customer:', error);
      if (error.code === '23505') {
        toast.error('هذا العميل موجود بالفعل في القائمة الدائمة');
      } else {
        toast.error('فشل إضافة العميل');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.length >= 2) {
      const debounce = setTimeout(() => {
        handleSearch();
      }, 500);

      return () => clearTimeout(debounce);
    } else {
      setSearchResults([]);
    }
    return undefined;
  }, [searchTerm]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">إضافة عميل إلى القائمة الدائمة</h2>

        {/* Search */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">البحث عن العميل</label>
          <div className="relative">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-4 max-h-60 overflow-y-auto border rounded-lg">
            <div className="p-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">نتائج البحث</label>
              {searchResults.map((customer) => (
                <div
                  key={customer.customer_phone}
                  className={`p-3 border rounded cursor-pointer mb-2 transition-colors ${
                    selectedCustomer?.customer_phone === customer.customer_phone
                      ? 'bg-blue-100 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={selectedCustomer?.customer_phone === customer.customer_phone}
                      onChange={() => setSelectedCustomer(customer)}
                      className="text-blue-600"
                    />
                    <div>
                      <p className="font-medium">{customer.customer_name}</p>
                      <p className="text-sm text-gray-600">{customer.customer_phone}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">سبب الإضافة (اختياري)</label>
          <textarea
            placeholder="عميل مميز، يستحق الاهتمام..."
            value={additionReason}
            onChange={(e) => setAdditionReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleAddCustomer}
            disabled={!selectedCustomer || loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'جاري الإضافة...' : 'إضافة'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Discount Offer Modal Component
const DiscountOfferModal: React.FC<{
  customer: LoyalCustomer;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ customer, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [originalAmount, setOriginalAmount] = useState<number>(0);
  const [discountPercentage, setDiscountPercentage] = useState<number>(10);
  const [validDays, setValidDays] = useState<number>(3);
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDebt, setLoadingDebt] = useState(true);

  useEffect(() => {
    fetchCustomerDebt();
  }, [customer]);

  const fetchCustomerDebt = async () => {
    try {
      setLoadingDebt(true);
      const { data, error } = await supabase
        .from('debts')
        .select('amount')
        .eq('merchant_id', profile?.id)
        .eq('customer_phone', customer.customer_phone)
        .eq('status', 'pending');

      if (error) throw error;

      const total = data?.reduce((sum, debt) => sum + debt.amount, 0) || 0;
      setOriginalAmount(total);
    } catch (error) {
      console.error('Error fetching customer debt:', error);
      toast.error('فشل تحميل بيانات الديون');
    } finally {
      setLoadingDebt(false);
    }
  };

  const discountedAmount = originalAmount * (1 - discountPercentage / 100);
  const savingsAmount = originalAmount - discountedAmount;

  const handleSendOffer = async () => {
    if (originalAmount <= 0) {
      toast.error('لا توجد ديون معلقة لهذا العميل');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('discount-offers-management', {
        body: {
          customer_phone: customer.customer_phone,
          customer_name: customer.customer_name,
          original_amount: originalAmount,
          discount_percentage: discountPercentage,
          valid_days: validDays,
          custom_message: customMessage || null
        }
      });

      if (error) throw error;

      toast.success('تم إرسال عرض الخصم بنجاح');
      onSuccess();
    } catch (error: any) {
      console.error('Error sending discount offer:', error);
      toast.error('فشل إرسال عرض الخصم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">إرسال عرض خصم للعميل</h2>

        {/* Customer Info */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="mb-2"><strong>اسم العميل:</strong> {customer.customer_name}</p>
          <p className="mb-2"><strong>رقم الهاتف:</strong> {customer.customer_phone}</p>
          <p>
            <strong>إجمالي الديون المعلقة:</strong>{' '}
            {loadingDebt ? (
              <span>جاري التحميل...</span>
            ) : (
              <span className="text-blue-700 font-bold">{originalAmount.toFixed(2)} ريال</span>
            )}
          </p>
        </div>

        {/* Discount Percentage */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">نسبة الخصم</label>
          <div className="flex gap-2 mb-3">
            {[5, 10, 15, 20, 25, 30].map((percent) => (
              <button
                key={percent}
                onClick={() => setDiscountPercentage(percent)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  discountPercentage === percent
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {percent}%
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            max="100"
            value={discountPercentage}
            onChange={(e) => setDiscountPercentage(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="أو أدخل نسبة مخصصة"
          />
        </div>

        {/* Calculation */}
        <div className="bg-green-50 p-4 rounded-lg mb-6">
          <p className="mb-2">
            <strong>المبلغ بعد الخصم:</strong>{' '}
            <span className="text-green-700 font-bold text-xl">{discountedAmount.toFixed(2)} ريال</span>
          </p>
          <p className="text-green-600">
            <strong>التوفير:</strong> {savingsAmount.toFixed(2)} ريال (-{discountPercentage}%)
          </p>
        </div>

        {/* Validity */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">صلاحية العرض</label>
          <div className="flex gap-2 mb-3">
            {[1, 3, 7, 14].map((days) => (
              <button
                key={days}
                onClick={() => setValidDays(days)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  validDays === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {days === 1 ? '24 ساعة' : `${days} أيام`}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            value={validDays}
            onChange={(e) => setValidDays(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="أو أدخل عدد أيام مخصص"
          />
          <p className="text-sm text-gray-600 mt-2">
            صالح حتى:{' '}
            {new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toLocaleDateString('ar-SA')}
          </p>
        </div>

        {/* Custom Message */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">رسالة إضافية (اختيارية)</label>
          <textarea
            placeholder="عرض خاص! سدد الآن واحصل على خصم..."
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSendOffer}
            disabled={loading || loadingDebt || originalAmount <= 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال العرض'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoyalCustomersPage;
