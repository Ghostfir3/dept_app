import { NavLink } from 'react-router-dom';
import { Home, BarChart3, Users, MessageSquare, Gift, Bell, History } from 'lucide-react';

export default function CustomerBottomNav() {
  const navItems = [
    { path: '/customer', icon: Home, label: 'الرئيسية' },
    { path: '/customer/debts', icon: BarChart3, label: 'ديوني' },
    { path: '/customer/merchants', icon: Users, label: 'التجار' },
    { path: '/customer/feedback', icon: MessageSquare, label: 'الملاحظات' },
    { path: '/customer/discount-offers', icon: Gift, label: 'العروض' },
    { path: '/customer/notifications', icon: Bell, label: 'الإشعارات' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200/50 shadow-lg z-[9999]"
      style={{ direction: 'rtl', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999 }}
    >
      <div className="flex justify-around items-center h-14 px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-lg transition-all duration-200 flex-1 min-w-0 cursor-pointer ${
                isActive 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`
            }
            onClick={(e) => {
              console.log('Navigating to:', item.path);
              // NavLink handles navigation automatically
            }}
          >
            {({ isActive }) => (
              <>
                <item.icon 
                  size={18} 
                  className={`transition-colors ${isActive ? 'text-blue-600' : 'text-gray-600'}`}
                />
                <span className={`text-[10px] font-medium leading-tight transition-colors truncate ${
                  isActive ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
