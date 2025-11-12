import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    phone_number: '',
    full_name: '',
    password: '',
    confirmPassword: '',
    user_type: 'customer' as 'merchant' | 'customer'
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }

    setLoading(true);
    try {
      const email = `${formData.phone_number}@example.com`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('فشل إنشاء الحساب');

      const { error: profileError } = await supabase.from('users_profile').insert({
        id: authData.user.id,
        phone_number: formData.phone_number,
        full_name: formData.full_name,
        user_type: formData.user_type,
      });

      if (profileError) throw profileError;

      toast.success('تم إنشاء الحساب بنجاح');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">إنشاء حساب جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">الاسم الكامل</label>
            <input type="text" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">رقم الهاتف</label>
            <input 
              type="tel" 
              required 
              value={formData.phone_number} 
              onChange={e => setFormData({...formData, phone_number: e.target.value})} 
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" 
              placeholder="05xxxxxxxx أو 7xxxxxxxx (يمني)"
              pattern="[0-9+()\-\s]{8,15}"
            />
            <p className="text-sm text-gray-500 mt-1">
              يقبل جميع أرقام الهواتف المحلية والدولية
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">نوع المستخدم</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input type="radio" value="merchant" checked={formData.user_type === 'merchant'} onChange={e => setFormData({...formData, user_type: e.target.value as any})} className="ml-2" />
                <span>تاجر</span>
              </label>
              <label className="flex items-center">
                <input type="radio" value="customer" checked={formData.user_type === 'customer'} onChange={e => setFormData({...formData, user_type: e.target.value as any})} className="ml-2" />
                <span>عميل</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">كلمة المرور</label>
            <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">تأكيد كلمة المرور</label>
            <input type="password" required value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </form>
        <p className="text-center mt-4 text-sm">
          لديك حساب؟ <button onClick={() => navigate('/login')} className="text-blue-600 font-bold">تسجيل الدخول</button>
        </p>
      </div>
    </div>
  );
}
