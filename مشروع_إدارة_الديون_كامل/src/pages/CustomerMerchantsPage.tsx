// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, DollarSign, Calendar, Phone, FileText } from 'lucide-react';

interface MerchantInfo {
  merchant_id: string;
  merchant_name: string;
  merchant_phone: string;
  total_debts: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  last_transaction_date: string;
}

export default function CustomerMerchantsPage() {
  const { profile } = useAuth();
  const [merchants, setMerchants] = useState<MerchantInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMerchants();
  }, [profile]);

  async function loadMerchants() {
    if (!profile) return;

    try {
      // استخدام Edge Function للحصول على البيانات مع معلومات التجار
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
        
        // تجميع البيانات لكل تاجر من البيانات المستلمة
        const merchantsMap = new Map<string, MerchantInfo>();

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
            
            // استخدام البيانات الصحيحة من Edge Function
            const paidAmount = debt.paid_amount || 0;
            const remainingAmount = debt.remaining_amount || 0;
            
            merchant.paid_amount += paidAmount;
            merchant.remaining_amount += remainingAmount;
            
            // تحديث تاريخ آخر معاملة إذا كانت أحدث
            if (new Date(debt.created_at) > new Date(merchant.last_transaction_date)) {
              merchant.last_transaction_date = debt.created_at;
            }
          }
        });

        setMerchants(Array.from(merchantsMap.values()));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading merchants:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 pb-20" dir="rtl">
      <div className="p-4 max-w-6xl mx-auto">
        {/* العنوان */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Users className="text-green-600" size={32} />
            التجار
          </h1>
          <p className="text-gray-600">جميع التجار الذين تتعامل معهم</p>
        </div>

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">عدد التجار</p>
                <p className="text-3xl font-bold text-green-700">{merchants.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي المعاملات</p>
                <p className="text-3xl font-bold text-blue-700">
                  {merchants.reduce((sum, m) => sum + m.total_debts, 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">المتبقي الكلي</p>
                <p className="text-3xl font-bold text-orange-700">
                  {merchants.reduce((sum, m) => sum + m.remaining_amount, 0).toFixed(0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <DollarSign className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* قائمة التجار */}
        <div className="space-y-4">
          {merchants.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <Users className="mx-auto mb-4 text-gray-400" size={64} />
              <h3 className="text-xl font-bold text-gray-700 mb-2">لا يوجد تجار</h3>
              <p className="text-gray-500">لم تقم بأي معاملات مع تجار بعد</p>
            </div>
          ) : (
            merchants.map((merchant) => (
              <div
                key={merchant.merchant_id}
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                      <Users className="text-white" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        {merchant.merchant_name}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone size={14} />
                        {merchant.merchant_phone}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">عدد المعاملات</p>
                    <p className="text-lg font-bold text-blue-700">{merchant.total_debts}</p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">المدفوع</p>
                    <p className="text-lg font-bold text-green-700">
                      {merchant.paid_amount.toFixed(0)} ر.س
                    </p>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">المتبقي</p>
                    <p className="text-lg font-bold text-orange-700">
                      {merchant.remaining_amount.toFixed(0)} ر.س
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">آخر معاملة</p>
                    <p className="text-sm font-bold text-purple-700">
                      {new Date(merchant.last_transaction_date).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
