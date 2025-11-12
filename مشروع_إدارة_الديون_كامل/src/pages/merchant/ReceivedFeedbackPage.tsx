import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Star, Clock, CheckCircle, User, Calendar, Filter, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface Feedback {
  id: string;
  merchant_id: string;
  customer_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
  customer_name?: string;
  customer_phone?: string;
}

export default function ReceivedFeedbackPage() {
  const { profile } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    loadFeedbacks();
  }, [profile, filterStatus, sortBy]);

  async function loadFeedbacks() {
    if (!profile) return;

    try {
      let query = supabase
        .from('feedback')
        .select('*')
        .eq('merchant_id', profile.id);

      // تطبيق الفلترة
      if (filterStatus === 'read') {
        query = query.eq('is_read', true);
      } else if (filterStatus === 'unread') {
        query = query.eq('is_read', false);
      }

      // تطبيق الترتيب
      query = query.order('created_at', { ascending: sortBy === 'oldest' });

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // جلب أسماء العملاء منفصلة
        const customerIds = [...new Set(data.map(f => f.customer_id))];
        
        let processedData = data.map(item => ({
          ...item,
          customer_name: 'عميل غير معروف',
          customer_phone: ''
        }));

        if (customerIds.length > 0) {
          const { data: customersData } = await supabase
            .from('users_profile')
            .select('id, full_name, phone_number')
            .in('id', customerIds);

          if (customersData) {
            processedData = data.map(item => {
              const customer = customersData.find(c => c.id === item.customer_id);
              return {
                ...item,
                customer_name: customer?.full_name || 'عميل غير معروف',
                customer_phone: customer?.phone_number || ''
              };
            });
          }
        }

        setFeedbacks(processedData);
      }
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      toast.error('حدث خطأ في تحميل الملاحظات');
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(feedbackId: string) {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ is_read: true })
        .eq('id', feedbackId);

      if (error) throw error;

      // تحديث الحالة المحلية
      setFeedbacks(prev => 
        prev.map(f => 
          f.id === feedbackId ? { ...f, is_read: true } : f
        )
      );

      toast.success('تم تعليم الملاحظة كمقروءة');
    } catch (error) {
      console.error('Error marking feedback as read:', error);
      toast.error('حدث خطأ في تحديث حالة الملاحظة');
    }
  }

  async function markAsUnread(feedbackId: string) {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ is_read: false })
        .eq('id', feedbackId);

      if (error) throw error;

      setFeedbacks(prev => 
        prev.map(f => 
          f.id === feedbackId ? { ...f, is_read: false } : f
        )
      );

      toast.success('تم تعليم الملاحظة كغير مقروءة');
    } catch (error) {
      console.error('Error marking feedback as unread:', error);
      toast.error('حدث خطأ في تحديث حالة الملاحظة');
    }
  }

  const stats = {
    total: feedbacks.length,
    unread: feedbacks.filter(f => !f.is_read).length,
    read: feedbacks.filter(f => f.is_read).length
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-bold">جاري تحميل الملاحظات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <MessageSquare className="text-blue-600" size={32} />
            الملاحظات المستلمة
          </h1>
          <p className="text-gray-600 mt-2">إدارة ومتابعة ملاحظات العملاء</p>
        </div>

        {/* أدوات التحكم */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border-2 border-gray-300 rounded-xl bg-white text-sm font-bold focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">جميع الملاحظات</option>
            <option value="unread">غير مقروءة</option>
            <option value="read">مقروءة</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border-2 border-gray-300 rounded-xl bg-white text-sm font-bold focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">الأحدث أولاً</option>
            <option value="oldest">الأقدم أولاً</option>
          </select>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <MessageSquare className="text-blue-600" size={24} />
            </div>
            <div className="text-right">
              <h3 className="text-sm text-gray-600 font-medium">إجمالي الملاحظات</h3>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <EyeOff className="text-orange-600" size={24} />
            </div>
            <div className="text-right">
              <h3 className="text-sm text-gray-600 font-medium">غير مقروءة</h3>
              <p className="text-2xl font-bold text-gray-800">{stats.unread}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-green-500">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Eye className="text-green-600" size={24} />
            </div>
            <div className="text-right">
              <h3 className="text-sm text-gray-600 font-medium">مقروءة</h3>
              <p className="text-2xl font-bold text-gray-800">{stats.read}</p>
            </div>
          </div>
        </div>
      </div>

      {/* قائمة الملاحظات */}
      <div className="space-y-4">
        {feedbacks.length > 0 ? (
          feedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className={`bg-white rounded-2xl shadow-lg p-6 border-r-4 transition-all hover:shadow-xl cursor-pointer ${
                feedback.is_read 
                  ? 'border-green-500 bg-white' 
                  : 'border-orange-500 bg-orange-50'
              }`}
              onClick={() => setSelectedFeedback(feedback)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{feedback.customer_name}</h3>
                      {feedback.customer_phone && (
                        <p className="text-sm text-gray-600">{feedback.customer_phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-3">
                    <p className="text-gray-700 leading-relaxed">{feedback.message}</p>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={16} />
                      {new Date(feedback.created_at).toLocaleString('ar-SA')}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    feedback.is_read 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {feedback.is_read ? (
                      <>
                        <Eye size={14} />
                        مقروءة
                      </>
                    ) : (
                      <>
                        <EyeOff size={14} />
                        غير مقروءة
                      </>
                    )}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      feedback.is_read ? markAsUnread(feedback.id) : markAsRead(feedback.id);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      feedback.is_read
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {feedback.is_read ? 'تعليم كغير مقروءة' : 'تعليم كمقروءة'}
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="text-gray-400" size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-600 mb-2">لا توجد ملاحظات</h3>
            <p className="text-gray-500">
              {filterStatus === 'all' 
                ? 'لم يرسل أي عميل ملاحظات بعد'
                : filterStatus === 'unread'
                ? 'لا توجد ملاحظات غير مقروءة'
                : 'لا توجد ملاحظات مقروءة'
              }
            </p>
          </div>
        )}
      </div>

      {/* نافذة تفاصيل الملاحظة */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-bold text-gray-800">تفاصيل الملاحظة</h3>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* معلومات العميل */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="font-bold text-blue-800 mb-2">معلومات العميل</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600 font-medium">الاسم: </span>
                    <span className="text-blue-800 font-bold">{selectedFeedback.customer_name}</span>
                  </div>
                  {selectedFeedback.customer_phone && (
                    <div>
                      <span className="text-blue-600 font-medium">الهاتف: </span>
                      <span className="text-blue-800 font-bold">{selectedFeedback.customer_phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* نص الملاحظة */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3">نص الملاحظة</h4>
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {selectedFeedback.message}
                  </p>
                </div>
              </div>

              {/* معلومات إضافية */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold text-gray-800 mb-3">معلومات إضافية</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 font-medium">تاريخ الإرسال: </span>
                    <span className="text-gray-800 font-bold">
                      {new Date(selectedFeedback.created_at).toLocaleString('ar-SA')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">حالة القراءة: </span>
                    <span className={`font-bold ${selectedFeedback.is_read ? 'text-green-600' : 'text-orange-600'}`}>
                      {selectedFeedback.is_read ? 'مقروءة' : 'غير مقروءة'}
                    </span>
                  </div>
                </div>
              </div>

              {/* أزرار التحكم */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    selectedFeedback.is_read ? markAsUnread(selectedFeedback.id) : markAsRead(selectedFeedback.id);
                    setSelectedFeedback(null);
                  }}
                  className={`flex-1 py-3 rounded-xl font-bold transition-colors ${
                    selectedFeedback.is_read
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {selectedFeedback.is_read ? 'تعليم كغير مقروءة' : 'تعليم كمقروءة'}
                </button>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-400 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}