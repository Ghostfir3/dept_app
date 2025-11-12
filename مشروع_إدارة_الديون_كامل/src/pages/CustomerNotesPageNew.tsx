// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Edit2, Trash2, Save, X, User, Tag, Clock, Filter, Calendar, Send, MessageCircle, Users, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

type NoteCategory = 'general' | 'financial' | 'technical' | 'other';

interface Merchant {
  merchant_id: string;
  merchant_name: string;
  merchant_phone: string;
  total_debts: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  last_transaction_date: string;
}

export default function CustomerNotesPage() {
  const { profile } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [formData, setFormData] = useState({
    note_text: '',
    category: 'general' as NoteCategory
  });

  useEffect(() => {
    loadMerchants();
  }, [profile]);

  async function loadMerchants() {
    if (!profile) return;

    try {
      // استخدام Edge Function للحصول على قائمة التجار
      const { data, error } = await supabase.functions.invoke('customer-debts-history', {
        body: {
          status: 'all',
          date_range: 'all',
          page: '1',
          limit: '100', // الحصول على جميع الديون للحصول على قائمة شاملة بالتجار
          sort_by: 'created_at',
          sort_order: 'desc'
        }
      });

      if (error) {
        console.error('Error fetching merchants data:', error);
        setLoading(false);
        return;
      }

      if (data?.data) {
        const responseData = data.data;
        const debts = responseData.debts || [];
        
        // تجميع البيانات لكل تاجر
        const merchantsMap = new Map<string, Merchant>();

        debts.forEach((debt: any) => {
          if (debt.merchant_name && debt.merchant_id) {
            if (!merchantsMap.has(debt.merchant_id)) {
              merchantsMap.set(debt.merchant_id, {
                merchant_id: debt.merchant_id,
                merchant_name: debt.merchant_name,
                merchant_phone: debt.merchant_phone || '',
                total_debts: 0,
                total_amount: 0,
                paid_amount: 0,
                remaining_amount: 0,
                last_transaction_date: debt.created_at
              });
            }
            
            const merchant = merchantsMap.get(debt.merchant_id);
            const amount = debt.debt_amount || debt.amount || 0;
            
            merchant.total_debts += 1;
            merchant.total_amount += amount;
            
            if (debt.display_status === 'paid' || debt.status === 'paid') {
              merchant.paid_amount += amount;
            }
            
            merchant.remaining_amount += (debt.remaining_amount || (amount - (debt.paid_amount || 0)));
            
            // تحديث آخر تاريخ للمعاملة
            if (new Date(debt.created_at) > new Date(merchant.last_transaction_date)) {
              merchant.last_transaction_date = debt.created_at;
            }
          }
        });

        // تحويل إلى مصفوفة وترتيب حسب آخر معاملة
        const merchantsList = Array.from(merchantsMap.values())
          .sort((a, b) => new Date(b.last_transaction_date).getTime() - new Date(a.last_transaction_date).getTime());
        
        setMerchants(merchantsList);
      }
    } catch (error) {
      console.error('Error loading merchants:', error);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedMerchant || !formData.note_text) {
      toast.error('الرجاء اختيار التاجر وكتابة الملاحظة');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customer_notes')
        .insert({
          merchant_id: selectedMerchant.merchant_id,
          customer_phone: profile?.phone_number || '',
          customer_name: profile?.full_name || '',
          note_text: formData.note_text,
          category: formData.category,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (!error) {
        toast.success('تم إرسال الملاحظة للتاجر بنجاح');
        closeModal();
        // لا نحتاج لإعادة تحميل التجار، فقط إغلاق المودال
      } else {
        toast.error('حدث خطأ في إرسال الملاحظة');
      }
    } catch (error) {
      console.error('Error sending note:', error);
      toast.error('حدث خطأ في إرسال الملاحظة');
    }
  }

  function openAddModal(merchant: Merchant) {
    setSelectedMerchant(merchant);
    setFormData({
      note_text: '',
      category: 'general'
    });
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setSelectedMerchant(null);
    setFormData({
      note_text: '',
      category: 'general'
    });
  }

  // فلاتر البحث
  const filteredMerchants = merchants.filter(merchant =>
    merchant.merchant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    merchant.merchant_phone.includes(searchTerm)
  );

  // دوال مساعدة للتصنيفات
  function getCategoryLabel(category: NoteCategory): string {
    const labels = {
      general: 'عام',
      financial: 'مالي',
      technical: 'تقني',
      other: 'أخرى'
    };
    return labels[category] || category;
  }

  function getCategoryColor(category: NoteCategory): string {
    const colors = {
      general: 'bg-gray-100 text-gray-700 border-gray-300',
      financial: 'bg-green-100 text-green-700 border-green-300',
      technical: 'bg-blue-100 text-blue-700 border-blue-300',
      other: 'bg-purple-100 text-purple-700 border-purple-300'
    };
    return colors[category] || colors.general;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-gray-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-bold">جاري تحميل قائمة التجار...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <MessageCircle className="text-blue-600" size={28} />
            الملاحظات والتواصل مع التجار
          </h1>
          <p className="text-sm text-gray-600">إرسال ملاحظات وتواصل مع التجار</p>
        </div>
      </div>

      {/* شريط البحث */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="البحث في التجار..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* قائمة التجار */}
      {filteredMerchants.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <Users className="mx-auto mb-4 text-gray-400" size={64} />
          <p className="text-xl text-gray-600 font-bold">لا توجد تجار</p>
          <p className="text-gray-500 mt-2">
            {searchTerm ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد تجار مرتبطين بحسابك'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMerchants.map((merchant, index) => (
            <div
              key={merchant.merchant_id}
              className="bg-white rounded-xl shadow-md p-6 border-r-4 border-green-500 hover:shadow-lg transition-all transform hover:-translate-y-1"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="text-green-600" size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-gray-800 truncate">
                      {merchant.merchant_name}
                    </h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Phone size={14} />
                      {merchant.merchant_phone}
                    </p>
                  </div>
                </div>
              </div>

              {/* إحصائيات التاجر */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <p className="text-blue-600 font-bold">{merchant.total_debts}</p>
                  <p className="text-blue-800">إجمالي الديون</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <p className="text-green-600 font-bold">{merchant.total_amount.toFixed(0)} ر.س</p>
                  <p className="text-green-800">إجمالي المبلغ</p>
                </div>
                <div className="text-center p-2 bg-purple-50 rounded-lg">
                  <p className="text-purple-600 font-bold">{merchant.paid_amount.toFixed(0)} ر.س</p>
                  <p className="text-purple-800">المدفوع</p>
                </div>
                <div className="text-center p-2 bg-orange-50 rounded-lg">
                  <p className="text-orange-600 font-bold">{merchant.remaining_amount.toFixed(0)} ر.س</p>
                  <p className="text-orange-800">المتبقي</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-200">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  آخر معاملة: {new Date(merchant.last_transaction_date).toLocaleDateString('ar-SA', { 
                    year: 'numeric', month: 'short', day: 'numeric'
                  })}
                </span>
              </div>

              <button
                onClick={() => openAddModal(merchant)}
                className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-bold"
              >
                <Send size={16} />
                إرسال ملاحظة
              </button>
            </div>
          ))}
        </div>
      )}

      {/* مودال إضافة ملاحظة */}
      {showAddModal && selectedMerchant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">إرسال ملاحظة للتاجر</h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* معلومات التاجر */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-gray-800">{selectedMerchant.merchant_name}</h3>
                <p className="text-sm text-gray-600">{selectedMerchant.merchant_phone}</p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">تصنيف الملاحظة</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as NoteCategory })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="general">عام</option>
                    <option value="financial">مالي</option>
                    <option value="technical">تقني</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">نص الملاحظة *</label>
                  <textarea
                    name="note_text"
                    value={formData.note_text}
                    onChange={(e) => setFormData({ ...formData, note_text: e.target.value })}
                    placeholder="اكتب ملاحظتك هنا..."
                    rows={4}
                    required
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold flex items-center justify-center gap-2"
                  >
                    <Send size={16} />
                    إرسال
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
