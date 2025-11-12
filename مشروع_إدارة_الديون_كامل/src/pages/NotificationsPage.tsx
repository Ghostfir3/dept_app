
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, CheckCircle, AlertTriangle, Clock, XCircle, Trash2, Check, Filter, Settings, TrendingUp, AlertCircle, Info, Search, Calendar, RotateCcw, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

type NotificationType = 'pending' | 'confirmed' | 'disputed' | 'overdue' | 'payment_received';
type PriorityLevel = 'urgent' | 'important' | 'normal';
type NotificationStyle = 'default' | 'emotional' | 'urgent' | 'friendly' | 'professional';
type NotificationCategory = 'system' | 'debt' | 'payment' | 'delay' | 'thanks' | 'reminder' | 'overdue' | 'settlement';

interface Notification {
  id: string;
  type: NotificationType;
  priority: PriorityLevel;
  title: string;
  message: string;
  debtId?: string;
  customerName: string;
  amount: number;
  read: boolean;
  timestamp: Date;
  style?: NotificationStyle;
  category?: NotificationCategory;
  milestone_days?: number;
  is_automated?: boolean;
  scheduled_at?: Date;
}

interface DbNotification {
  id: string;
  merchant_id: string;
  type: string;
  message: string;
  status: 'read' | 'unread';
  priority: 'urgent' | 'high' | 'normal';
  data?: any;
  metadata?: any;
  created_at: string;
  scheduled_at?: string;
  sent_at?: string;
  notification_category?: string;
  milestone_days?: number;
  is_automated?: boolean;
  reminder_count?: number;
  notification_style?: string;
}

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  
  // فلاتر متقدمة
  const [showFilters, setShowFilters] = useState(false);
  const [filterRead, setFilterRead] = useState<'all' | 'read' | 'unread'>('all');
  const [filterType, setFilterType] = useState<'all' | NotificationType>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | PriorityLevel>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'system' | 'debt' | 'payment' | 'delay' | 'thanks' | 'reminder' | 'overdue' | 'settlement'>('all');
  const [filterStyle, setFilterStyle] = useState<'all' | 'default' | 'emotional' | 'urgent' | 'friendly' | 'professional'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // إعدادات
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    autoMarkRead: false,
    soundEnabled: true,
    showOnlyUrgent: false
  });

  useEffect(() => {
    if (profile) {
      loadNotifications();
    }
  }, [profile]);



  async function loadNotifications() {
    if (!profile) return;
    
    console.log('بدء تحميل الإشعارات...');
    
    const notifs: Notification[] = [];
    
    // التأكد من الـ merchant_id الصحيح
    const merchantId = profile.id || profile.phone_number;
    console.log('Profile data:', profile);
    console.log('Using merchant ID:', merchantId);
    
    // تحميل الإشعارات من جدول notifications (إشعارات السداد والإشعارات الأخرى)
    const { data: dbNotifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });
    
    console.log('Loaded notifications:', dbNotifications); // للتشخيص
    
    console.log('Total notifications from database:', dbNotifications?.length || 0);
    console.log('Notification types found:', [...new Set(dbNotifications?.map(n => n.type) || [])]);
    
    if (dbNotifications) {
      dbNotifications.forEach((notif: DbNotification) => {
        console.log('Processing notification:', notif.id, notif.type, notif.message);
        
        if (notif.type === 'payment_confirmed') {
          const notification: Notification = {
            id: notif.id,
            type: 'payment_received',
            priority: 'important',
            title: '💰 سداد مستلم',
            message: notif.message,
            customerName: notif.data?.customer_name || notif.data?.customer_phone || 'عميل',
            amount: notif.data?.amount || notif.data?.paid_amount || 0,
            read: notif.status === 'read',
            timestamp: new Date(notif.created_at)
          };
          
          notifs.push(notification);
          console.log('Added payment notification:', notification);
        } else if (notif.type === 'overdue' || notif.type === 'reminder') {
          // إشعارات التأخير والتذكير
          const notification: Notification = {
            id: notif.id,
            type: notif.type === 'overdue' ? 'overdue' : 'confirmed',
            priority: notif.priority === 'urgent' ? 'urgent' : 'important',
            title: notif.type === 'overdue' ? '🚨 دين متأخر' : '⏰ تذكير',
            message: notif.message,
            customerName: notif.data?.customer_name || notif.data?.merchant_name || 'عميل',
            amount: notif.data?.debt_amount || notif.data?.amount || 0,
            read: notif.status === 'read',
            timestamp: new Date(notif.created_at)
          };
          
          notifs.push(notification);
        } else if (notif.type === 'new_debt' || notif.type === 'debt_confirmed') {
          // إشعارات الديون الجديدة والتأكيد
          const notification: Notification = {
            id: notif.id,
            type: notif.type === 'new_debt' ? 'pending' : 'confirmed',
            priority: 'important',
            title: notif.type === 'new_debt' ? '💰 دين جديد' : '✅ تأكيد',
            message: notif.message,
            customerName: notif.data?.customer_name || notif.data?.merchant_name || 'عميل',
            amount: notif.data?.amount || 0,
            read: notif.status === 'read',
            timestamp: new Date(notif.created_at)
          };
          
          notifs.push(notification);
        }
      });
    }
    
    // ترتيب التنبيهات: الأولوية ثم التاريخ
    notifs.sort((a, b) => {
      const priorityWeight = { urgent: 3, important: 2, normal: 1 };
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
    console.log('إجمالي الإشعارات النهائية:', notifs.length);
    setNotifications(notifs);
    setLoading(false);
  }

  async function deleteNotification(id: string) {
    if (!profile?.id && !profile?.phone_number) {
      toast.error('خطأ في بيانات المستخدم');
      return;
    }

    try {
      const notification = notifications.find(n => n.id === id);
      if (!notification) return;

      // تحديث القائمة محلياً فوراً
      setNotifications(prev => prev.filter(n => n.id !== id));
      
      toast.success('تم حذف التنبيه');

      // محاولة حذف من قاعدة البيانات
      const merchantId = profile.id || profile.phone_number;
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('merchant_id', merchantId);

      if (error) {
        console.error('Database delete error:', error);
        toast.error('تم الحذف محلياً، لكن هناك مشكلة في قاعدة البيانات');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('حدث خطأ أثناء حذف التنبيه');
    }
  }

  async function markAsRead(id: string) {
    if (!profile?.id && !profile?.phone_number) {
      toast.error('خطأ في بيانات المستخدم');
      return;
    }

    try {
      const notification = notifications.find(n => n.id === id);
      if (!notification) return;

      // التأكد من أن الإشعار غير مقروء بالفعل
      if (notification.read) {
        return; // لا حاجة للحدث
      }

      // تحديث القائمة محلياً فوراً
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      
      toast.success('تم تعليم التنبيه كمقروء');

      // محاولة تحديث قاعدة البيانات
      const merchantId = profile.id || profile.phone_number;
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', id)
        .eq('merchant_id', merchantId);

      if (error) {
        console.error('Database update error:', error);
        toast.error('تم التحديث محلياً، لكن هناك مشكلة في قاعدة البيانات');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('حدث خطأ أثناء تحديث التنبيه');
    }
  }

  async function markAllAsRead() {
    if (!profile?.id && !profile?.phone_number) {
      toast.error('خطأ في بيانات المستخدم');
      return;
    }

    try {
      // تحديث القائمة محلياً فوراً
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      
      toast.success('تم تعليم جميع التنبيهات كمقروءة');

      // محاولة تحديث قاعدة البيانات
      const merchantId = profile.id || profile.phone_number;
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('merchant_id', merchantId)
        .eq('status', 'unread');

      if (error) {
        console.error('Database bulk update error:', error);
        toast.error('تم التحديث محلياً، لكن هناك مشكلة في قاعدة البيانات');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('حدث خطأ أثناء تحديث التنبيهات');
    }
  }

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
    if (filterRead === 'read') result = result.filter(n => n.read);
    if (filterRead === 'unread') result = result.filter(n => !n.read);
    
    // فلتر النوع
    if (filterType !== 'all') result = result.filter(n => n.type === filterType);
    
    // فلتر الأولوية
    if (filterPriority !== 'all') result = result.filter(n => n.priority === filterPriority);
    
    // فلتر التصنيف
    if (filterCategory !== 'all') result = result.filter(n => n.category === filterCategory);
    
    // فلتر النمط
    if (filterStyle !== 'all') result = result.filter(n => n.style === filterStyle);
    
    // فلتر التاريخ
    const now = new Date();
    if (dateRange === 'today') {
      result = result.filter(n => n.timestamp.toDateString() === now.toDateString());
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(n => n.timestamp >= weekAgo);
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter(n => n.timestamp >= monthAgo);
    }
    
    // البحث
    if (searchQuery) {
      result = result.filter(n => 
        n.title.includes(searchQuery) || 
        n.message.includes(searchQuery) || 
        n.customerName.includes(searchQuery)
      );
    }
    
    return result;
  }, [notifications, filterRead, filterType, filterPriority, filterCategory, filterStyle, dateRange, searchQuery]);

  // الإحصائيات
  const stats = useMemo(() => ({
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    urgent: notifications.filter(n => n.priority === 'urgent').length,
    important: notifications.filter(n => n.priority === 'important').length,
    normal: notifications.filter(n => n.priority === 'normal').length,
    pending: notifications.filter(n => n.type === 'pending').length,
    confirmed: notifications.filter(n => n.type === 'confirmed').length,
    disputed: notifications.filter(n => n.type === 'disputed').length,
    overdue: notifications.filter(n => n.type === 'overdue').length,
    payment_received: notifications.filter(n => n.type === 'payment_received').length
  }), [notifications]);

  // أيقونات ولون الأولوية
  function getPriorityConfig(priority: PriorityLevel) {
    switch (priority) {
      case 'urgent':
        return { 
          label: 'عاجل', 
          color: 'bg-red-100 text-red-700 border-red-300',
          icon: <AlertCircle size={14} />
        };
      case 'important':
        return { 
          label: 'مهم', 
          color: 'bg-orange-100 text-orange-700 border-orange-300',
          icon: <TrendingUp size={14} />
        };
      case 'normal':
        return { 
          label: 'عادي', 
          color: 'bg-blue-100 text-blue-700 border-blue-300',
          icon: <Info size={14} />
        };
    }
  }

  // أيقونات ولون النوع
  function getTypeConfig(type: NotificationType) {
    switch (type) {
      case 'pending':
        return { icon: <Clock size={24} />, bg: 'bg-orange-100', text: 'text-orange-600' };
      case 'confirmed':
        return { icon: <CheckCircle size={24} />, bg: 'bg-blue-100', text: 'text-blue-600' };
      case 'disputed':
        return { icon: <XCircle size={24} />, bg: 'bg-red-100', text: 'text-red-600' };
      case 'overdue':
        return { icon: <AlertTriangle size={24} />, bg: 'bg-yellow-100', text: 'text-yellow-600' };
      case 'payment_received':
        return { icon: <Wallet size={24} />, bg: 'bg-green-100', text: 'text-green-600' };
    }
  }

  if (loading) {
    return (
      <div className="p-8 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل التنبيهات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      {/* الرأس */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <div className="relative">
                <Bell className="text-green-600" size={32} />
                {stats.unread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                    {stats.unread}
                  </span>
                )}
              </div>
              التنبيهات الذكية
            </h1>
            <p className="text-gray-600">متابعة جميع التحديثات والأحداث المهمة في الوقت الفعلي</p>
          </div>
          
          <div className="flex gap-2">
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
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-2 border-gray-200 animate-fadeIn">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Settings size={20} />
              إعدادات التنبيهات
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoMarkRead}
                  onChange={e => setSettings(s => ({ ...s, autoMarkRead: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-gray-700">تعليم التنبيهات كمقروءة تلقائياً عند فتحها</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={e => setSettings(s => ({ ...s, soundEnabled: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-gray-700">تشغيل الصوت عند وصول تنبيه جديد</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showOnlyUrgent}
                  onChange={e => setSettings(s => ({ ...s, showOnlyUrgent: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-gray-700">عرض التنبيهات العاجلة فقط في الصفحة الرئيسية</span>
              </label>
            </div>
          </div>
        )}

        {/* إحصائيات التنبيهات - عدادات منفصلة */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow-md p-4 border-r-4 border-gray-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 text-xs mb-1">الإجمالي</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 border-r-4 border-red-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 text-xs mb-1">غير مقروءة</p>
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
            <p className="text-2xl font-bold">{stats.important}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 border-r-4 border-orange-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 text-xs mb-1">قيد الانتظار</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 border-r-4 border-blue-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 text-xs mb-1">مؤكدة</p>
            <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 border-r-4 border-red-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 text-xs mb-1">معترض عليها</p>
            <p className="text-2xl font-bold text-red-600">{stats.disputed}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 border-r-4 border-yellow-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 text-xs mb-1">متأخرة</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.overdue}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 border-r-4 border-green-500 hover:shadow-lg transition-shadow">
            <p className="text-gray-600 text-xs mb-1">سدادات مستلمة</p>
            <p className="text-2xl font-bold text-green-600">{stats.payment_received}</p>
          </div>
        </div>

        {/* شريط البحث والفلاتر */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث في التنبيهات..."
                className="w-full pr-10 pl-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
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
            <div className="pt-4 border-t-2 border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">حالة القراءة</label>
                <select
                  value={filterRead}
                  onChange={e => setFilterRead(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="unread">غير مقروءة</option>
                  <option value="read">مقروءة</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">نوع التنبيه</label>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="confirmed">مؤكدة</option>
                  <option value="disputed">معترض عليها</option>
                  <option value="overdue">متأخرة</option>
                  <option value="payment_received">سدادات مستلمة</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الأولوية</label>
                <select
                  value={filterPriority}
                  onChange={e => setFilterPriority(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="urgent">عاجلة</option>
                  <option value="important">مهمة</option>
                  <option value="normal">عادية</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الفترة الزمنية</label>
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
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
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Bell className="mx-auto mb-4 text-gray-400" size={64} />
            <p className="text-xl text-gray-600 font-bold">لا توجد تنبيهات</p>
            <p className="text-gray-500 mt-2">
              {searchQuery || filterType !== 'all' || filterPriority !== 'all' || filterRead !== 'all' || dateRange !== 'all'
                ? 'لا توجد نتائج مطابقة للفلاتر المحددة'
                : 'سيتم عرض التنبيهات هنا عند حدوث أي تحديثات'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif, index) => {
            const typeConfig = getTypeConfig(notif.type);
            const priorityConfig = getPriorityConfig(notif.priority);
            
            return (
              <div
                key={notif.id}
                className={`bg-white rounded-xl shadow-md p-5 border-r-4 transition-all hover:shadow-lg transform hover:-translate-y-1 ${
                  !notif.read ? 'border-green-500 bg-green-50' : 'border-gray-300'
                } ${
                  notif.type === 'disputed' ? 'border-red-500 bg-red-50' :
                  notif.type === 'overdue' ? 'border-yellow-500 bg-yellow-50' :
                  notif.type === 'confirmed' ? 'border-blue-500' :
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
                      <h3 className="text-lg font-bold text-gray-800 flex-1">{notif.title}</h3>
                      {/* شارة الأولوية */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${priorityConfig.color}`}>
                        {priorityConfig.icon}
                        {priorityConfig.label}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">{notif.message}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {notif.timestamp.toLocaleString('ar-SA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className="font-bold text-gray-700">{notif.amount.toFixed(2)} ر.س</span>
                    </div>
                  </div>

                  {/* الأزرار */}
                  <div className="flex gap-2 flex-shrink-0">
                    {!notif.read && (
                      <button
                        onClick={() => {
                          markAsRead(notif.id);
                          if (settings.autoMarkRead) {
                            toast.success('تم تعليم التنبيه كمقروء');
                          }
                        }}
                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-all hover:scale-110"
                        title="تعليم كمقروء"
                      >
                        <Check size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all hover:scale-110"
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
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700">
            <Filter size={18} />
            <span className="font-bold">
              الفلاتر نشطة - عرض {filteredNotifications.length} من {notifications.length}
            </span>
          </div>
          <button
            onClick={resetFilters}
            className="text-blue-600 hover:text-blue-800 font-bold underline"
          >
            إلغاء جميع الفلاتر
          </button>
        </div>
      )}
    </div>
  );
}
