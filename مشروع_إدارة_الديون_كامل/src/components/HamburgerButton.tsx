
import { Menu } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';

export default function HamburgerButton() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="fixed top-4 right-4 z-30 p-3 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition-all duration-200 hover:scale-105"
      aria-label="فتح/إغلاق القائمة"
    >
      <Menu size={24} />
    </button>
  );
}
