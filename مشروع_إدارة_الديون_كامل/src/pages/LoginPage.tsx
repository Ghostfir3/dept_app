import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    try {
      const email = `${phone}@example.com`;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) throw error;
      
      const { data: profile } = await supabase.from('users_profile').select('*').eq('id', data.user.id).single();
      
      toast.success('تم تسجيل الدخول بنجاح');
      navigate(profile?.user_type === 'merchant' ? '/merchant/home' : '/customer');
    } catch (error: any) {
      toast.error('بيانات الدخول غير صحيحة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">تسجيل الدخول</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">رقم الهاتف</label>
            <input 
              type="tel" 
              required 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" 
              placeholder="05xxxxxxxx أو 7xxxxxxxx (يمني)"
              pattern="[0-9+()\-\s]{8,15}"
            />
            <p className="text-sm text-gray-500 mt-1">
              يقبل جميع أرقام الهواتف المحلية والدولية
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">كلمة المرور</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>
        <p className="text-center mt-4 text-sm">
          ليس لديك حساب؟ <button onClick={() => navigate('/register')} className="text-blue-600 font-bold">إنشاء حساب جديد</button>
        </p>
      </div>
    </div>
  );
}
