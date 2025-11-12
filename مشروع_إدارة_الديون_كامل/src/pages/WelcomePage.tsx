import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, Shield, Clock, TrendingUp, CheckCircle } from 'lucide-react';

export default function WelcomePage() {
  const navigate = useNavigate();

  const features = [
    { icon: BarChart3, title: 'إدارة ديون احترافية', desc: 'نظام متكامل لتتبع وإدارة جميع الديون' },
    { icon: Users, title: 'ربط التجار والعملاء', desc: 'تواصل مباشر وآمن بين الطرفين' },
    { icon: Shield, title: 'أمان عالي', desc: 'حماية كاملة لبياناتك المالية' },
    { icon: Clock, title: 'تنبيهات تلقائية', desc: 'إشعارات بمواعيد الاستحقاق' },
    { icon: TrendingUp, title: 'تقارير تحليلية', desc: 'رسوم بيانية ومخططات مفصلة' },
    { icon: CheckCircle, title: 'نظام اعتراضات', desc: 'إمكانية الاعتراض على الديون بشفافية' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center text-white mb-16 animate-fade-in">
          <div className="mb-6">
            <div className="inline-block p-4 bg-white/10 rounded-full backdrop-blur-sm">
              <BarChart3 className="w-16 h-16" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4">نظام إدارة الديون الاحترافي</h1>
          <p className="text-2xl text-blue-100 mb-2">حلول حديثة لإدارة الديون في مجتمعك</p>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            تطبيق احترافي يربط بين التجار والعملاء لإدارة الديون بطريقة آمنة ومنظمة
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 hover:bg-white/20 transition-all transform hover:scale-105">
              <feature.icon className="w-12 h-12 text-blue-200 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-blue-100">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          <button onClick={() => navigate('/login')} className="px-8 py-4 bg-white text-blue-600 rounded-full font-bold text-lg hover:bg-blue-50 transition-all transform hover:scale-105 shadow-xl">
            تسجيل الدخول
          </button>
          <button onClick={() => navigate('/register')} className="px-8 py-4 bg-blue-500 text-white rounded-full font-bold text-lg hover:bg-blue-400 transition-all transform hover:scale-105 shadow-xl">
            إنشاء حساب جديد
          </button>
        </div>
      </div>
    </div>
  );
}
