import { ReactNode } from 'react';
import CustomerBottomNav from './CustomerBottomNav';

interface CustomerLayoutProps {
  children: ReactNode;
}

export default function CustomerLayout({ children }: CustomerLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-slate-100 pb-20" dir="rtl">
      {/* المحتوى الرئيسي */}
      <main className="w-full">
        {children}
      </main>
      
      {/* شريط التنقل السفلي */}
      <CustomerBottomNav />
    </div>
  );
}