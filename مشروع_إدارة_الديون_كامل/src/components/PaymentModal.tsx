import React, { useState, useEffect } from 'react';
import { supabase, Debt } from '../lib/supabase';
import { X, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentModalProps {
  customerPhone: string;
  customerName: string;
  merchantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  customerPhone,
  customerName,
  merchantId,
  onClose,
  onSuccess
}) => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchCustomerDebts();
  }, []);

  const fetchCustomerDebts = async () => {
    try {
      setLoading(true);

      // جلب ديون العميل
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('customer_phone', customerPhone)
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      // جلب السدادات لجميع الديون لحساب المبلغ المتبقي
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payment_transactions')
        .select('debts_paid, created_at')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      if (paymentsError) {
        console.error('Error loading payments:', paymentsError);
      }

      // حساب المبلغ المسدد لكل دين
      const paidAmounts: Record<string, number> = {};
      if (paymentsData) {
        paymentsData.forEach(transaction => {
          if (transaction.debts_paid && Array.isArray(transaction.debts_paid)) {
            transaction.debts_paid.forEach((debtPaid: any) => {
              const debtId = debtPaid.debt_id;
              const amountPaid = debtPaid.amount_paid || 0;
              paidAmounts[debtId] = (paidAmounts[debtId] || 0) + amountPaid;
            });
          }
        });
      }

      // إضافة المبلغ المتبقي لكل دين
      const debtsWithRemaining = (data || []).map(debt => ({
        ...debt,
        paid_amount: paidAmounts[debt.id] || 0,
        remaining_amount: debt.amount - (paidAmounts[debt.id] || 0)
      }));

      setDebts(debtsWithRemaining);
      // Select all debts by default
      setSelectedDebtIds((data || []).map(d => d.id));
    } catch (error: any) {
      console.error('Error fetching debts:', error);
      toast.error('فشل تحميل الديون');
    } finally {
      setLoading(false);
    }
  };

  const toggleDebtSelection = (debtId: string) => {
    setSelectedDebtIds(prev =>
      prev.includes(debtId)
        ? prev.filter(id => id !== debtId)
        : [...prev, debtId]
    );
  };

  const totalDebtAmount = debts
    .filter(d => selectedDebtIds.includes(d.id))
    .reduce((sum, d) => sum + (d.remaining_amount || d.amount), 0);

  const remainingAmount = totalDebtAmount - (parseFloat(paymentAmount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (selectedDebtIds.length === 0) {
      toast.error('يرجى اختيار دين واحد على الأقل');
      return;
    }

    try {
      setProcessing(true);

      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: {
          customer_phone: customerPhone,
          customer_name: customerName,
          amount: parseFloat(paymentAmount),
          selected_debt_ids: selectedDebtIds,
          notes: notes || null
        }
      });

      if (error) throw error;

      if (data?.data?.success) {
        toast.success(data.data.message || 'تم تسجيل الدفع بنجاح');
        onSuccess();
      } else {
        throw new Error('فشل معالجة الدفع');
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast.error(error.message || 'فشل تسجيل الدفع');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <DollarSign className="text-green-600" size={28} />
            تسديد دين - {customerName}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">جاري تحميل الديون...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Customer Info */}
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="mb-2"><strong>رقم الهاتف:</strong> {customerPhone}</p>
              <p><strong>إجمالي الديون المحددة:</strong> <span className="text-blue-700 font-bold">{totalDebtAmount.toFixed(2)} ريال</span></p>
            </div>

            {/* Debts List */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">الديون غير المسددة:</label>
              {debts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">لا توجد ديون غير مسددة</p>
              ) : (
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {debts.map((debt) => {
                    const debtAmount = debt.remaining_amount || debt.amount;
                    return (
                      <div
                        key={debt.id}
                        className={`p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                          selectedDebtIds.includes(debt.id) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleDebtSelection(debt.id)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedDebtIds.includes(debt.id)}
                            onChange={() => toggleDebtSelection(debt.id)}
                            className="text-blue-600"
                          />
                          <div className="flex-1">
                            <p className="font-medium">
                              دين #{debt.id.substring(0, 8)} - {debtAmount.toFixed(2)} ريال
                            </p>
                            <p className="text-sm text-gray-600">
                              تاريخ الإنشاء: {new Date(debt.created_at).toLocaleDateString('ar-SA')}
                            </p>
                            {debt.description && (
                              <p className="text-sm text-gray-500">{debt.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Amount */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">المبلغ المسدد:</label>
              <div className="relative">
                <input
                  type="tel"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  step="0.01"
                  min="0"
                  autoComplete="off"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="أدخل المبلغ"
                  required
                  style={{ fontSize: '16px' }} // Prevents zoom on iOS
                />
                <span className="absolute left-3 top-3 text-gray-500">ريال</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">يمكنك كتابة المبلغ بالريال والدين</p>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات (اختياري):</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                autoComplete="off"
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="أضف ملاحظات..."
                style={{ fontSize: '16px' }} // Prevents zoom on iOS
              />
              <p className="text-xs text-gray-500 mt-1">مثل: "دفع جزئي" أو "سداد نقدي"</p>
            </div>

            {/* Summary */}
            <div className="bg-green-50 p-4 rounded-lg mb-6">
              <p className="text-lg">
                <strong>المتبقي:</strong>{' '}
                <span className={remainingAmount < 0 ? 'text-red-600' : 'text-gray-800'}>
                  {totalDebtAmount.toFixed(2)} - {(parseFloat(paymentAmount) || 0).toFixed(2)} = {remainingAmount.toFixed(2)} ريال
                </span>
              </p>
              {remainingAmount < 0 && (
                <p className="text-sm text-red-600 mt-1">المبلغ المدخل أكبر من الديون المحددة</p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={processing || debts.length === 0 || !paymentAmount}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    جاري التسديد...
                  </>
                ) : (
                  'تأكيد التسديد'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
