import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Trash2, 
  Check, 
  Filter, 
  Settings, 
  TrendingUp, 
  AlertCircle, 
  Info, 
  Search, 
  Calendar, 
  RotateCcw,
  Moon,
  Sun,
  Monitor,
  Mail,
  Smartphone,
  Volume2,
  VolumeX
} from 'lucide-react';
import toast from 'react-hot-toast';

type NotificationType = 'reminder' | 'payment_confirmed' | 'objection' | 'objection_response' | 'new_debt' | 'info';
type NotificationStatus = 'read' | 'unread';
type PriorityLevel = 'urgent' | 'high' | 'normal';

interface Notification {
  id: string;
  customer_id: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  priority: PriorityLevel;
  debt_id?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  urgent: number;
  high: number;
  normal: number;
  reminder: number;
  payment_confirmed: number;
  objection: number;
  objection_response: number;
  new_debt: number;
  info: number;
}

interface UserPreferences {
  id: string;
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export default function CustomerNotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    read: 0,
    urgent: 0,
    high: 0,
    normal: 0,
    reminder: 0,
    payment_confirmed: 0,
    objection: 0,
    objection_response: 0,
    new_debt: 0,
    info: 0
  });
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  
  // فلاتر متقدمة
  const [showFilters, setShowFilters] = useState(false);
  const [filterRead, setFilterRead] = useState<'all' | 'read' | 'unread'>('all');
  const [filterType, setFilterType] = useState<'all' | NotificationType>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | PriorityLevel>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // إعدادات
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState({
    autoMarkRead: false,
    soundEnabled: true,
    showOnlyUrgent: false
  });

  useEffect(() => {
    if (profile) {
      loadNotifications();
      loadPreferences();
    }
  }, [profile]);

  // تحميل الإشعارات
  async function loadNotifications() {
    try {
      const { data, error } = await supabase.functions.invoke('customer-notifications', {
        method: 'GET'
      });

      if (error) {
        throw error;
      }

      if (data?.data) {
        setNotifications(data.data.notifications || []);
        setStats(data.data.stats || stats);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('فشل في تحميل الإشعارات');
    } finally {
      setLoading(false);
    }
  }

  // تحميل التفضيلات
  async function loadPreferences() {
    try {
      const { data, error } = await supabase.functions.invoke('customer-preferences', {
        method: 'GET'
      });

      if (error) {
        throw error;
      }

      if (data?.data) {
        setPreferences(data.data);
        updateTheme(data.data.theme);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }

  // تحديث الثيم
  function updateTheme(theme: 'light' | 'dark' | 'system') {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system theme
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    
    localStorage.setItem('theme', theme);
  }

  // تعليم إشعار كمقروء
  async function markAsRead(notificationId: string) {
    try {
      // التأكد من أن الإشعار غير مقروء بالفعل
      const currentNotification = notifications.find(n => n.id === notificationId);
      if (!currentNotification || currentNotification.status === 'read') {
        return; // لا حاجة للحدث
      }

      // تحديث القائمة محلياً فوراً
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, status: 'read' as NotificationStatus } : n)
      );
      
      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        read: prev.read + 1
      }));

      if (localSettings.autoMarkRead) {
        toast.success('تم تعليم الإشعار كمقروء');
      }

      // محاولة حفظ التغيير في قاعدة البيانات
      const { data, error } = await supabase.functions.invoke('customer-notifications', {
        method: 'PUT',
        body: {
          notification_id: notificationId,
          status: 'read'
        }
      });

      if (error) {
        console.error('Database error:', error);
        toast.error('تم التحديث محلياً، لكن هناك مشكلة في قاعدة البيانات');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('حدث خطأ أثناء تحديث الإشعار');
    }
  }

  // تعليم جميع الإشعارات كمقروءة
  async function markAllAsRead() {
    try {
      // تحديث القائمة محلياً فوراً
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as NotificationStatus })));
      setStats(prev => ({
        ...prev,
        unread: 0,
        read: prev.total
      }));

      toast.success('تم تعليم جميع الإشعارات كمقروءة');

      // محاولة حفظ التغيير في قاعدة البيانات
      const { error } = await supabase.functions.invoke('customer-notifications', {
        method: 'POST',
        body: {
          action: 'mark_all_read'
        }
      });

      if (error) {
        console.error('Database error:', error);
        toast.error('تم التحديث محلياً، لكن هناك مشكلة في قاعدة البيانات');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('حدث خطأ أثناء تحديث الإشعارات');
    }
  }

  // حذف إشعار
  async function deleteNotification(notificationId: string) {
    try {
      // تحديث القائمة محلياً فوراً
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) return;
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      setStats(prev => {
        const newStats = { ...prev };
        newStats.total = newStats.total - 1;
        if (notification.status === 'unread') {
          newStats.unread = Math.max(0, newStats.unread - 1);
        } else if (notification.status === 'read') {
          newStats.read = Math.max(0, newStats.read - 1);
        }
        
        // تحديث عدادات الأولوية والنوع
        if (newStats[notification.priority] !== undefined) {
          newStats[notification.priority] = Math.max(0, newStats[notification.priority] - 1);
        }
        if (newStats[notification.type] !== undefined) {
          newStats[notification.type] = Math.max(0, newStats[notification.type] - 1);
        }
        
        return newStats;
      });

      toast.success('تم حذف الإشعار');

      // محاولة حفظ التغيير في قاعدة البيانات
      const { error } = await supabase.functions.invoke('customer-notifications', {
        method: 'DELETE',
        body: {
          notification_id: notificationId
        }
      });

      if (error) {
        console.error('Database error:', error);
        toast.error('تم الحذف محلياً، لكن هناك مشكلة في قاعدة البيانات');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('حدث خطأ أثناء حذف الإشعار');
    }
  }

  // تحديث التفضيلات
  async function updatePreferences(updates: Partial<UserPreferences>) {
    try {
      const { data, error } = await supabase.functions.invoke('customer-preferences', {
        method: 'PUT',
        body: updates
      });

      if (error) {
        throw error;
      }

      if (data?.data) {
        setPreferences(data.data);
        
        if (updates.theme) {
          updateTheme(updates.theme);
        }
      }

      toast.success('تم حفظ التفضيلات');
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('فشل في حفظ التفضيلات');
    }
  }

  // إعادة تعيين الفلاتر
  function resetFilters() {
    setFilterRead('all');
    setFilterType('all');
    setFilterPriority('all');
    setDateRange('all');
    setSearchQuery('');
    toast.success('تم إعادة تعيين الفلاتر');
  }

  // تطبيق الفلاتر
  const filteredNotifications = useMemo(() => {
    let result = [...notifications];
    
    // فلتر القراءة
    if (filterRead === 'read') result = result.filter(n => n.status === 'read');
    if (filterRead === 'unread') result = result.filter(n => n.status === 'unread');
    
    // فلتر النوع
    if (filterType !== 'all') result = result.filter(n => n.type === filterType);
    
    // فلتر الأولوية
    if (filterPriority !== 'all') result = result.filter(n => n.priority === filterPriority);
    
    // فلتر التاريخ
    const now = new Date();
    if (dateRange === 'today') {
      result = result.filter(n => {
        const createdAt = new Date(n.created_at);
        return createdAt.toDateString() === now.toDateString();
      });
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(n => new Date(n.created_at) >= weekAgo);
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter(n => new Date(n.created_at) >= monthAgo);
    }
    
    // البحث
    if (searchQuery) {
      result = result.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        n.message.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return result;
  }, [notifications, filterRead, filterType, filterPriority, dateRange, searchQuery]);

  // أيقونات ولون الأولوية
  function getPriorityConfig(priority: PriorityLevel) {
    switch (priority) {
      case 'urgent':
        return { 
          label: 'عاجل', 
          color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-600',
          icon: <AlertCircle size={14} />
        };
      case 'high':
        return { 
          label: 'مهم', 
          color: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-600',
          icon: <TrendingUp size={14} />
        };
      case 'normal':
        return { 
          label: 'عادي', 
          color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-600',
          icon: <Info size={14} />
        };
    }
  }

  // أيقونات ولون النوع
  function getTypeConfig(type: NotificationType) {
    switch (type) {
      case 'reminder':
        return { 
          icon: <Clock size={24} />, 
          bg: 'bg-orange-100 dark:bg-orange-900', 
          text: 'text-orange-600 dark:text-orange-300',
          label: 'تذكير'
        };
      case 'payment_confirmed':
        return { 
          icon: <CheckCircle size={24} />, 
          bg: 'bg-green-100 dark:bg-green-900', 
          text: 'text-green-600 dark:text-green-300',
          label: 'تأكيد دفع'
        };
      case 'objection':
        return { 
          icon: <XCircle size={24} />, 
          bg: 'bg-red-100 dark:bg-red-900', 
          text: 'text-red-600 dark:text-red-300',
          label: 'اعتراض'
        };
      case 'objection_response':
        return { 
          icon: <AlertTriangle size={24} />, 
          bg: 'bg-blue-100 dark:bg-blue-900', 
          text: 'text-blue-600 dark:text-blue-300',
          label: 'رد على اعتراض'
        };
      case 'new_debt':
        return { 
          icon: <AlertTriangle size={24} />, 
          bg: 'bg-purple-100 dark:bg-purple-900', 
          text: 'text-purple-600 dark:text-purple-300',
          label: 'دين جديد'
        };
      default:
        return { 
          icon: <Info size={24} />, 
          bg: 'bg-gray-100 dark:bg-gray-800', 
          text: 'text-gray-600 dark:text-gray-300',
          label: 'عام'
        };
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">جاري تحميل الإشعارات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 min-h-screen transition-colors duration-300" dir="rtl">
      {/* الرأس */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-3">
              <div className="relative">
                <Bell className="text-green-600 dark:text-green-400" size={32} />
                {stats.unread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                    {stats.unread}
                  </span>
                )}
              </div>
              إشعارات العميل
            </h1>
            <p className="text-gray-600 dark:text-gray-300">متابعة جميع التحديثات والأحداث المهمة الخاصة بحسابك</p>
          </div>
          
          <div className="flex gap-2">
            {/* زر الثيم */}
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg p-1 shadow-lg">
              <button
                onClick={() => updatePreferences({ theme: 'light' })}
                className={`p-2 rounded ${preferences?.theme === 'light' ? 'bg-yellow-100 text-yellow-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="الوضع النهاري"
              >
                <Sun size={18} />
              </button>
              <button
                onClick={() => updatePreferences({ theme: 'dark' })}
                className={`p-2 rounded ${preferences?.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                title="الوضع الليلي"
              >
                <Moon size={18} />
              </button>
              <button
                onClick={() => updatePreferences({ theme: 'system' })}
                className={`p-2 rounded ${preferences?.theme === 'system' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="تلقائي"
              >
                <Monitor size={18} />
              </button>
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-all shadow-md hover:shadow-lg"
            >
              <Settings size={18} />
              الإعدادات
            </button>
            {stats.unread > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all shadow-md hover:shadow-lg"
              >
                <Check size={18} />
                تعليم الكل كمقروء ({stats.unread})
              </button>
            )}
          </div>
        </div>

        {/* إعدادات التنبيهات */}
        {showSettings && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6 border-2 border-gray-200 dark:border-gray-700 animate-fadeIn">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Settings size={20} />
              إعدادات الإشعارات
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* إعدادات التنبيهات */}
              <div className="space-y-3">
                <h4 className="text-md font-bold text-gray-700 dark:text-gray-300">تفضيلات التنبيهات</h4>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences?.notifications_enabled || false}
                    onChange={e => updatePreferences({ notifications_enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <Bell size={18} className="text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">تفعيل التنبيهات</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences?.email_notifications || false}
                    onChange={e => updatePreferences({ email_notifications: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <Mail size={18} className="text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">تنبيهات البريد الإلكتروني</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences?.push_notifications || false}
                    onChange={e => updatePreferences({ push_notifications: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <Smartphone size={18} className="text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">التنبيهات الفورية</span>
                </label>
              </div>

              {/* إعدادات محلية */}
              <div className="space-y-3">
                <h4 className="text-md font-bold text-gray-700 dark:text-gray-300">إعدادات العرض</h4>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.autoMarkRead}
                    onChange={e => setLocalSettings(s => ({ ...s, autoMarkRead: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <span className="text-gray-700 dark:text-gray-300">تعليم الإشعارات كمقروءة تلقائياً</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.soundEnabled}
                    onChange={e => setLocalSettings(s => ({ ...s, soundEnabled: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  {localSettings.soundEnabled ? <Volume2 size={18} className="text-gray-500" /> : <VolumeX size={18} className="text-gray-500" />}
                  <span className="text-gray-700 dark:text-gray-300">تشغيل الصوت للتنبيهات الجديدة</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.showOnlyUrgent}
                    onChange={e => setLocalSettings(s => ({ ...s, showOnlyUrgent: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <AlertCircle size={18} className="text-red-500" />
                  <span className="text-gray-700 dark:text-gray-300">عرض التنبيهات العاجلة فقط</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* إحصائيات التنبيهات */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border-r-4 border-gray-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">الإجمالي</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border-r-4 border-red-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">غير مقروءة</p>
            <p className="text-2xl font-bold text-red-600">{stats.unread}</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md p-4 text-white hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-1 mb-1">
              <AlertCircle size={14} />
              <p className="text-xs">عاجلة</p>
            </div>
            <p className="text-2xl font-bold">{stats.urgent}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md p-4 text-white hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp size={14} />
              <p className="text-xs">مهمة</p>
            </div>
            <p className="text-2xl font-bold">{stats.high}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border-r-4 border-orange-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">تذكير</p>
            <p className="text-2xl font-bold text-orange-600">{stats.reminder}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border-r-4 border-green-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">تأكيد دفع</p>
            <p className="text-2xl font-bold text-green-600">{stats.payment_confirmed}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border-r-4 border-purple-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">ديون جديدة</p>
            <p className="text-2xl font-bold text-purple-600">{stats.new_debt}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border-r-4 border-red-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">اعتراضات</p>
            <p className="text-2xl font-bold text-red-600">{stats.objection}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border-r-4 border-blue-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">ردود</p>
            <p className="text-2xl font-bold text-blue-600">{stats.objection_response}</p>
          </div>
        </div>

        {/* شريط البحث والفلاتر */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث في الإشعارات..."
                className="w-full pr-10 pl-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md"
            >
              <Filter size={18} />
              فلاتر متقدمة
            </button>
          </div>

          {/* الفلاتر المتقدمة */}
          {showFilters && (
            <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">حالة القراءة</label>
                <select
                  value={filterRead}
                  onChange={e => setFilterRead(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="unread">غير مقروءة</option>
                  <option value="read">مقروءة</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">نوع التنبيه</label>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="reminder">تذكير</option>
                  <option value="payment_confirmed">تأكيد دفع</option>
                  <option value="objection">اعتراض</option>
                  <option value="objection_response">رد على اعتراض</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">الأولوية</label>
                <select
                  value={filterPriority}
                  onChange={e => setFilterPriority(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="urgent">عاجلة</option>
                  <option value="high">مهمة</option>
                  <option value="normal">عادية</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">الفترة الزمنية</label>
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="all">كل الأوقات</option>
                  <option value="today">اليوم</option>
                  <option value="week">آخر أسبوع</option>
                  <option value="month">آخر شهر</option>
                </select>
              </div>

              <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-all"
                >
                  <RotateCcw size={18} />
                  إعادة تعيين الفلاتر
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* قائمة التنبيهات */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
            <Bell className="mx-auto mb-4 text-gray-400" size={64} />
            <p className="text-xl text-gray-600 dark:text-gray-300 font-bold">لا توجد إشعارات</p>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {searchQuery || filterType !== 'all' || filterPriority !== 'all' || filterRead !== 'all' || dateRange !== 'all'
                ? 'لا توجد نتائج مطابقة للفلاتر المحددة'
                : 'ستظهر الإشعارات هنا عند حدوث أي تحديثات على حسابك'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification, index) => {
            const typeConfig = getTypeConfig(notification.type);
            const priorityConfig = getPriorityConfig(notification.priority);
            
            return (
              <div
                key={notification.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border-r-4 transition-all hover:shadow-lg transform hover:-translate-y-1 ${
                  notification.status === 'unread' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600'
                } ${
                  notification.type === 'objection' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                  notification.priority === 'urgent' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                  ''
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  {/* أيقونة النوع */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${typeConfig.bg} flex-shrink-0`}>
                    <div className={typeConfig.text}>
                      {typeConfig.icon}
                    </div>
                  </div>
                  
                  {/* المحتوى */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white flex-1">{notification.title}</h3>
                      {/* شارة الأولوية */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${priorityConfig.color}`}>
                        {priorityConfig.icon}
                        {priorityConfig.label}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-2">{notification.message}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(notification.created_at).toLocaleString('ar-SA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {typeConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* الأزرار */}
                  <div className="flex gap-2 flex-shrink-0">
                    {notification.status === 'unread' && (
                      <button
                        onClick={() => {
                          markAsRead(notification.id);
                          if (localSettings.autoMarkRead) {
                            toast.success('تم تعليم الإشعار كمقروء');
                          }
                        }}
                        className="p-2 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-all hover:scale-110"
                        title="تعليم كمقروء"
                      >
                        <Check size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-2 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-all hover:scale-110"
                      title="حذف"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* رسالة الفلاتر النشطة */}
      {(searchQuery || filterType !== 'all' || filterPriority !== 'all' || filterRead !== 'all' || dateRange !== 'all') && (
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Filter size={18} />
            <span className="font-bold">
              الفلاتر نشطة - عرض {filteredNotifications.length} من {notifications.length}
            </span>
          </div>
          <button
            onClick={resetFilters}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-bold underline"
          >
            إلغاء جميع الفلاتر
          </button>
        </div>
      )}
    </div>
  );
}