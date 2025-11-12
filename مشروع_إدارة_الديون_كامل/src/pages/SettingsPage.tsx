
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { User, Phone, Save, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || ''
      });
    }
  }, [profile]);

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({
          full_name: formData.full_name,
          phone_number: formData.phone_number
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('تم حفظ التغييرات بنجاح');
      
      // إعادة تحميل الصفحة لتحديث البيانات
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast.error('حدث خطأ في حفظ التغييرات');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">الإعدادات</h1>
          <p className="text-gray-600">إدارة معلومات حسابك</p>
        </div>

        {/* معلومات الحساب */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <User className="text-green-600" size={24} />
            معلومات الحساب
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">الاسم الكامل *</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent pr-12"
                  placeholder="أدخل اسمك الكامل"
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">رقم الهاتف *</label>
              <div className="relative">
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={e => setFormData({...formData, phone_number: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent pr-12"
                  placeholder="05xxxxxxxx أو 7xxxxxxxx (يمني)"
                  pattern="[0-9+()\-\s]{8,15}"
                />
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                يقبل جميع أرقام الهواتف المحلية والدولية
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">البريد الإلكتروني</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">لا يمكن تغيير البريد الإلكتروني</p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">نوع الحساب</label>
              <input
                type="text"
                value={profile?.user_type === 'merchant' ? 'تاجر' : 'عميل'}
                disabled
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">لا يمكن تغيير نوع الحساب</p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} />
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>

        {/* معلومات الأمان */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl shadow-lg p-6 border-2 border-blue-200">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Shield className="text-blue-600" size={24} />
            معلومات الأمان
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>يتم تشفير جميع بياناتك وحمايتها بأعلى معايير الأمان</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>رقم هاتفك يُستخدم كمعرّف فريد لحسابك</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>لا نشارك معلوماتك مع أي جهة خارجية</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
