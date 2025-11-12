import React, { useState, useEffect } from 'react';
import { supabase, DiscountOffer } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Gift, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const CustomerDiscountOffersPage: React.FC = () => {
  const { profile } = useAuth();
  const [offers, setOffers] = useState<DiscountOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(null);

  useEffect(() => {
    fetchOffers();
  }, [profile?.phone_number]);

  const fetchOffers = async () => {
    if (!profile?.phone_number) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('discount_offers')
        .select('*')
        .eq('customer_phone', profile.phone_number)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOffers(data || []);
    } catch (error: any) {
      console.error('Error fetching offers:', error);
      toast.error('فشل تحميل عروض الخصم');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    if (!confirm('هل أنت متأكد من قبول هذا العرض؟')) {
      return;
    }

    try {
      setProcessingOfferId(offerId);

      const { data, error } = await supabase.functions.invoke('discount-offers-management', {
        method: 'PATCH',
        body: {
          action: 'accept'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Use direct Supabase update as fallback
      const { error: updateError } = await supabase
        .from('discount_offers')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', offerId);

      if (updateError) throw updateError;

      toast.success('تم قبول العرض بنجاح!');
      fetchOffers();
    } catch (error: any) {
      console.error('Error accepting offer:', error);
      toast.error('فشل قبول العرض');
    } finally {
      setProcessingOfferId(null);
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    const reason = prompt('يرجى إدخال سبب الرفض (اختياري):');
    if (reason === null) return; // User cancelled

    try {
      setProcessingOfferId(offerId);

      // Use direct Supabase update
      const { error } = await supabase
        .from('discount_offers')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          customer_rejection_reason: reason || null
        })
        .eq('id', offerId);

      if (error) throw error;

      toast.success('تم رفض العرض');
      fetchOffers();
    } catch (error: any) {
      console.error('Error rejecting offer:', error);
      toast.error('فشل رفض العرض');
    } finally {
      setProcessingOfferId(null);
    }
  };

  const getRemainingTime = (validUntil: string) => {
    const now = new Date();
    const expiry = new Date(validUntil);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return 'منتهي الصلاحية';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} يوم و ${hours} ساعة`;
    } else if (hours > 0) {
      return `${hours} ساعة`;
    } else {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${minutes} دقيقة`;
    }
  };

  const isExpiringSoon = (validUntil: string) => {
    const now = new Date();
    const expiry = new Date(validUntil);
    const diff = expiry.getTime() - now.getTime();
    const hoursRemaining = diff / (1000 * 60 * 60);
    return hoursRemaining <= 24 && hoursRemaining > 0;
  };

  const getStatusBadge = (offer: DiscountOffer) => {
    switch (offer.status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800 border border-yellow-300">
            <Clock size={16} />
            في انتظار الرد
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 border border-green-300">
            <CheckCircle size={16} />
            مقبول
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-red-100 text-red-800 border border-red-300">
            <XCircle size={16} />
            مرفوض
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 border border-gray-300">
            <AlertCircle size={16} />
            منتهي الصلاحية
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 border border-gray-300">
            <XCircle size={16} />
            ملغي
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل عروض الخصم...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">عروض الخصم المتاحة</h1>
        <p className="text-gray-600">تصفح العروض الخاصة المتاحة لك</p>
      </div>

      {offers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Gift size={64} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-700 mb-2">لا توجد عروض خصم حالياً</h2>
          <p className="text-gray-600">سنرسل لك إشعار عند توفر عروض جديدة</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className={`bg-white rounded-lg shadow-md overflow-hidden ${
                offer.status === 'pending' ? 'border-2 border-green-500' : 'border border-gray-200'
              }`}
            >
              {/* Offer Header */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="text-green-600" size={28} />
                      <h3 className="text-2xl font-bold text-gray-800">عرض خصم خاص!</h3>
                    </div>
                    {getStatusBadge(offer)}
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-gray-600 mb-1">تاريخ الإنشاء</p>
                    <p className="font-bold">{new Date(offer.created_at).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
              </div>

              {/* Offer Body */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Original Amount */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">إجمالي ديونك</p>
                    <p className="text-3xl font-bold text-gray-800">{offer.original_amount.toFixed(2)} ريال</p>
                  </div>

                  {/* Discount Percentage */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">نسبة الخصم</p>
                    <p className="text-3xl font-bold text-green-700">{offer.discount_percentage}%</p>
                  </div>

                  {/* Discounted Amount */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">المبلغ المطلوب بعد الخصم</p>
                    <p className="text-4xl font-bold text-blue-700">{offer.discounted_amount.toFixed(2)} ريال</p>
                  </div>

                  {/* Savings */}
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">مقدار التوفير</p>
                    <p className="text-4xl font-bold text-yellow-700">{offer.savings_amount.toFixed(2)} ريال</p>
                  </div>
                </div>

                {/* Validity */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="text-gray-600" size={20} />
                    <span className="font-semibold text-gray-700">صلاحية العرض:</span>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    offer.status === 'pending' && isExpiringSoon(offer.valid_until)
                      ? 'bg-red-50 border border-red-300'
                      : 'bg-gray-50'
                  }`}>
                    <p className="text-lg font-bold mb-1">
                      {new Date(offer.valid_until).toLocaleString('ar-SA')}
                    </p>
                    {offer.status === 'pending' && (
                      <p className={`text-sm font-medium ${
                        isExpiringSoon(offer.valid_until) ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {isExpiringSoon(offer.valid_until) && '⚠️ '}
                        متبقي: {getRemainingTime(offer.valid_until)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom Message */}
                {offer.custom_message && (
                  <div className="mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-gray-600 text-sm mb-2">رسالة من التاجر:</p>
                      <p className="text-gray-800 font-medium">{offer.custom_message}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {offer.status === 'pending' && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleAcceptOffer(offer.id)}
                      disabled={processingOfferId === offer.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processingOfferId === offer.id ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          جاري المعالجة...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={24} />
                          قبول العرض والسداد الآن
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRejectOffer(offer.id)}
                      disabled={processingOfferId === offer.id}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold text-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processingOfferId === offer.id ? (
                        'جاري المعالجة...'
                      ) : (
                        <>
                          <XCircle size={24} />
                          رفض العرض
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Status Messages */}
                {offer.status === 'accepted' && (
                  <div className="bg-green-100 border border-green-300 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="text-green-700" size={24} />
                      <p className="text-green-800 font-bold text-lg">تم قبول العرض</p>
                    </div>
                    <p className="text-green-700">
                      تم القبول في: {new Date(offer.accepted_at!).toLocaleString('ar-SA')}
                    </p>
                  </div>
                )}

                {offer.status === 'rejected' && (
                  <div className="bg-red-100 border border-red-300 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="text-red-700" size={24} />
                      <p className="text-red-800 font-bold text-lg">تم رفض العرض</p>
                    </div>
                    <p className="text-red-700">
                      تم الرفض في: {new Date(offer.rejected_at!).toLocaleString('ar-SA')}
                    </p>
                    {offer.customer_rejection_reason && (
                      <p className="text-red-700 mt-2">
                        <strong>السبب:</strong> {offer.customer_rejection_reason}
                      </p>
                    )}
                  </div>
                )}

                {offer.status === 'expired' && (
                  <div className="bg-gray-100 border border-gray-300 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="text-gray-700" size={24} />
                      <p className="text-gray-800 font-bold text-lg">انتهت صلاحية العرض</p>
                    </div>
                    <p className="text-gray-700">
                      انتهت الصلاحية في: {new Date(offer.expired_at!).toLocaleString('ar-SA')}
                    </p>
                  </div>
                )}

                {offer.status === 'cancelled' && (
                  <div className="bg-gray-100 border border-gray-300 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="text-gray-700" size={24} />
                      <p className="text-gray-800 font-bold text-lg">تم إلغاء العرض من التاجر</p>
                    </div>
                    <p className="text-gray-700">
                      تم الإلغاء في: {new Date(offer.cancelled_at!).toLocaleString('ar-SA')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerDiscountOffersPage;
