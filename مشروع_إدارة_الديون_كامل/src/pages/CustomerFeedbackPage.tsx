// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { MessageSquare, Send, Users, Calendar, CheckCircle, X } from 'lucide-react';

interface Merchant {
  id: string;
  full_name: string;
  phone_number: string;
}

interface FeedbackItem {
  id: string;
  merchant_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
  merchant_name: string;
}

export default function CustomerFeedbackPage() {
  const { profile } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile]);

  async function loadData() {
    if (!profile) return;

    try {
      // جلب التجار الذين يتعامل معهم العميل
      const { data: debtsData } = await supabase
        .from('debts')
        .select('merchant_id')
        .eq('customer_phone', profile.phone_number);

      if (debtsData && debtsData.length > 0) {
        const merchantIds = [...new Set(debtsData.map(d => d.merchant_id))];

        const { data: merchantsData } = await supabase
          .from('users_profile')
          .select('id, full_name, phone_number')
          .in('id', merchantIds);

        if (merchantsData) {
          setMerchants(merchantsData);
        }
      }

      // جلب سجل الملاحظات
      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('*')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false });

      if (feedbackData) {
        // إضافة أسماء التجار للملاحظات
        const feedbackWithNames = feedbackData.map(fb => {
          const merchant = merchants.find(m => m.id === fb.merchant_id);
          return {
            ...fb,
            merchant_name: merchant?.full_name || 'تاجر غير معروف'
          };
        });
        setFeedbackHistory(feedbackWithNames);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMerchant || !message.trim()) {
      toast.error('الرجاء اختيار تاجر وكتابة رسالة');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          merchant_id: selectedMerchant,
          customer_id: profile?.id,
          message: message.trim(),
          is_read: false
        });

      if (error) throw error;

      toast.success('تم إرسال الملاحظة بنجاح');
      setShowModal(false);
      setSelectedMerchant('');
      setMessage('');
      loadData();
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error('حدث خطأ في إرسال الملاحظة');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 pb-20" dir="rtl">
      <div className="p-4 max-w-4xl mx-auto">
        {/* العنوان */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <MessageSquare className="text-green-600" size={32} />
            الملاحظات والتعليقات
          </h1>
          <p className="text-gray-600">أرسل ملاحظاتك وتعليقاتك للتجار</p>
        </div>

        {/* زر إضافة ملاحظة */}
        <div className="mb-6">
          <button
            onClick={() => setShowModal(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg"
          >
            <Send size={20} />
            إرسال ملاحظة جديدة
          </button>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">عدد التجار</p>
                <p className="text-3xl font-bold text-blue-700">{merchants.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">الملاحظات المرسلة</p>
                <p className="text-3xl font-bold text-green-700">{feedbackHistory.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <MessageSquare className="text-green-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* سجل الملاحظات */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="text-gray-600" size={24} />
            سجل الملاحظات
          </h3>

          {feedbackHistory.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto mb-4 text-gray-400" size={64} />
              <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد ملاحظات</h3>
              <p className="text-gray-500">لم ترسل أي ملاحظات بعد</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackHistory.map((feedback) => (
                <div
                  key={feedback.id}
                  className="border-2 border-gray-200 rounded-lg p-4 hover:border-green-300 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="text-green-600" size={20} />
                      <span className="font-bold text-gray-800">
                        {feedback.merchant_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {feedback.is_read ? (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          <CheckCircle size={12} />
                          تم القراءة
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                          جديدة
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-700 mb-2 bg-gray-50 p-3 rounded-lg">
                    {feedback.message}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(feedback.created_at).toLocaleString('ar-SA')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal إضافة ملاحظة */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Send size={24} className="text-green-600" />
                  إرسال ملاحظة جديدة
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  اختر التاجر
                </label>
                <select
                  required
                  value={selectedMerchant}
                  onChange={e => setSelectedMerchant(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">اختر التاجر...</option>
                  {merchants.map(merchant => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.full_name} - {merchant.phone_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  الرسالة
                </label>
                <textarea
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={5}
                  placeholder="اكتب ملاحظتك هنا..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {sending ? 'جاري الإرسال...' : 'إرسال'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-400 transition-colors"
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
