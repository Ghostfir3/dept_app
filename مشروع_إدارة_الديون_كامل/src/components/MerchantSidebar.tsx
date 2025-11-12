
import { Home, Users, Plus, BarChart3, DollarSign, Settings, LogOut, FileText, Bell, Calculator, PieChart, StickyNote, X, MessageSquare, List, Star, Wallet, Receipt, TrendingUp, Activity } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

export default function MerchantSidebar() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { isSidebarVisible, toggleSidebar } = useSidebar();
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    loadNotificationCount();
  }, [profile]);

  async function loadNotificationCount() {
    if (!profile) return;
    
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const { data: debts } = await supabase
      .from('debts')
      .select('*')
      .eq('merchant_id', profile.id)
      .or(`due_date.lte.${threeDaysFromNow.toISOString()},status.eq.disputed`);
    
    if (debts) {
      const today = new Date();
      const upcomingDebts = debts.filter(d => 
        d.due_date && new Date(d.due_date) > today && new Date(d.due_date) <= threeDaysFromNow && d.status !== 'paid'
      );
      const overdueDebts = debts.filter(d => 
        d.due_date && new Date(d.due_date) < today && d.status !== 'paid'
      );
      const disputedDebts = debts.filter(d => d.status === 'disputed');
      
      setNotificationCount(upcomingDebts.length + overdueDebts.length + disputedDebts.length);
    }
  }

  const menuItems: MenuItem[] = [
    { icon: <Home size={18} />, label: 'الرئيسية', path: '/merchant/home' },
    { icon: <Plus size={18} />, label: 'إضافة دين', path: '/merchant/add-debt' },
    { icon: <List size={18} />, label: 'جميع الديون', path: '/merchant/all-debts' },
    { icon: <Star size={18} />, label: 'العملاء الدائمون', path: '/merchant/loyal-customers' },
    { icon: <Wallet size={18} />, label: 'رأس المال', path: '/merchant/capital-management' },
    { icon: <Receipt size={18} />, label: 'المصروفات', path: '/merchant/expenses' },
    { icon: <TrendingUp size={18} />, label: 'متوسط الأرباح', path: '/merchant/revenue' },
    { icon: <Activity size={18} />, label: 'التحليلات المالية', path: '/merchant/financial-analytics' },
    { icon: <Bell size={18} />, label: 'التنبيهات', path: '/merchant/notifications', badge: notificationCount },
    { icon: <MessageSquare size={18} />, label: 'الاعتراضات', path: '/merchant/objections' },
    { icon: <StickyNote size={18} />, label: 'ملاحظات العملاء', path: '/merchant/notes' },
    { icon: <Settings size={18} />, label: 'الإعدادات', path: '/merchant/settings' },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      {/* Backdrop للـ overlay */}
      {isSidebarVisible && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* الشريط الجانبي */}
      <aside 
        className={`
          fixed top-0 right-0 h-screen w-60 bg-gradient-to-b from-green-800 to-green-900 text-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          ${isSidebarVisible ? 'translate-x-0' : 'translate-x-full'}
          pointer-events-auto
        `}
        style={{ direction: 'rtl' }}
      >
        {/* الشعار مع زر الإغلاق */}
        <div className="p-4 border-b border-green-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center shadow-lg">
                <DollarSign size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold">إدارة الديون</h2>
                <p className="text-xs text-green-200">لوحة التاجر</p>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-green-700 rounded-lg transition-colors"
              aria-label="إغلاق القائمة"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* قائمة التنقل */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                // إغلاق الشريط عند النقر على رابط
                toggleSidebar();
              }}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center justify-between gap-2 px-4 py-3 transition-all duration-200 hover:bg-green-700 ${
                  isActive ? 'bg-green-700 border-r-4 border-white shadow-lg' : ''
                }`
              }
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              {item.badge && item.badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* زر تسجيل الخروج */}
        <div className="p-3 border-t border-green-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-all duration-200 font-bold text-sm shadow-lg hover:shadow-xl"
          >
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
}
