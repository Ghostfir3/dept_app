
import { useState } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Plus, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AddDebtPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    customer_phone: '',
    customer_name: '',
    amount: '',
    description: '',
    due_date: ''
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('الرجاء تسجيل الدخول');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/debt-create-with-notifications`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customer_phone: formData.customer_phone,
            customer_name: formData.customer_name,
            amount: parseFloat(formData.amount),
            description: formData.description,
            due_date: formData.due_date || null
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل في إضافة الدين');
      }

      const result = await response.json();
      toast.success(result.data.message);
      setFormData({ customer_phone: '', customer_name: '', amount: '', description: '', due_date: '' });
      
      // العودة لصفحة الديون بعد 1.5 ثانية
      setTimeout(() => navigate('/merchant/debts'), 1500);
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في إضافة الدين');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Plus className="text-green-600" size={24} />
            إضافة دين جديد
          </h1>
          <p className="text-gray-600">أدخل معلومات الدين الجديد بدقة</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">اسم العميل *</label>
                <input
                  type="text"
                  required
                  value={formData.customer_name}
                  onChange={e => setFormData({...formData, customer_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                  placeholder="أدخل اسم العميل"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={formData.customer_phone}
                  onChange={e => setFormData({...formData, customer_phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                  placeholder="05xxxxxxxx أو 7xxxxxxxx (يمني)"
                  pattern="[0-9+()\-\s]{8,15}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  يقبل جميع أرقام الهواتف المحلية والدولية
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">المبلغ (ر.س) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all pr-10 text-sm"
                    placeholder="0.00"
                  />
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData({...formData, due_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700">الوصف (اختياري)</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                rows={3}
                placeholder="أضف تفاصيل إضافية عن الدين..."
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>ملاحظة:</strong> سيتم إرسال إشعار للعميل بإضافة هذا الدين. لديه 24 ساعة لتأكيد الدين أو الاعتراض عليه، وإلا سيتم تأكيده تلقائياً.
              </p>
            </div>

            <div className="flex gap-4 pt-2">
              <button 
                type="submit" 
                disabled={submitting}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-green-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'جاري الإضافة...' : 'إضافة الدين'}
              </button>
              <button 
                type="button" 
                onClick={() => navigate('/merchant/debts')}
                className="px-6 bg-gray-300 text-gray-700 py-3 rounded-lg font-bold text-sm hover:bg-gray-400 transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>

        {/* معلومات إضافية */}
        <div className="mt-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-lg p-4 border border-green-200">
          <h3 className="text-sm font-bold text-gray-800 mb-2">نصائح لإضافة الديون:</h3>
          <ul className="space-y-1 text-xs text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">•</span>
              <span>تأكد من صحة رقم هاتف العميل لضمان وصول الإشعارات</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">•</span>
              <span>حدد تاريخ استحقاق واضح لتجنب التأخير في السداد</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">•</span>
              <span>أضف وصفاً تفصيلياً للدين لتجنب أي سوء فهم مستقبلاً</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
