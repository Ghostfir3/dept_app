
import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  isSidebarVisible: boolean;
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    // قراءة الحالة المحفوظة من localStorage
    const saved = localStorage.getItem('sidebar_visible');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // افتراضياً: مخفي على جميع الأجهزة
    return false;
  });

  useEffect(() => {
    // حفظ الحالة عند التغيير
    localStorage.setItem('sidebar_visible', JSON.stringify(isSidebarVisible));
  }, [isSidebarVisible]);

  const toggleSidebar = () => {
    setIsSidebarVisible((prev: boolean) => !prev);
  };

  const setSidebarVisible = (visible: boolean) => {
    setIsSidebarVisible(visible);
  };

  return (
    <SidebarContext.Provider value={{ isSidebarVisible, toggleSidebar, setSidebarVisible }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
