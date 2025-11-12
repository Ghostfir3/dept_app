-- تحديث جدول الإشعارات ليدعم الإشعارات الجديدة

-- إنشاء جدول الإشعارات إذا لم يكن موجود
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('new_debt', 'debt_reminder', 'payment_confirmation', 'payment_request', 'objection', 'objection_response', 'discount_offer', 'reminder', 'payment_confirmed', 'info')),
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('read', 'unread')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  data JSONB DEFAULT '{}',
  debt_id UUID REFERENCES debts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_merchant_id ON notifications(merchant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(customer_id, status) WHERE status = 'unread';

-- تفعيل Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- إنشاء سياسات الأمان
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (
    (customer_id IS NOT NULL AND customer_id = auth.uid()) OR 
    (merchant_id IS NOT NULL AND merchant_id = auth.uid())
  );

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (
    (customer_id IS NOT NULL AND customer_id = auth.uid()) OR 
    (merchant_id IS NOT NULL AND merchant_id = auth.uid())
  );

CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (
    (customer_id IS NOT NULL AND customer_id = auth.uid()) OR 
    (merchant_id IS NOT NULL AND merchant_id = auth.uid())
  );

-- إضافة وظيفة محدثة للحذف الآمن
CREATE OR REPLACE FUNCTION delete_old_notifications()
RETURNS void AS $$
BEGIN
  -- حذف الإشعارات الأقدم من 30 يوم (المقروءة فقط)
  DELETE FROM notifications 
  WHERE status = 'read' 
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- إضافة دالة لإنشاء إشعار جديد
CREATE OR REPLACE FUNCTION create_notification(
  p_customer_id UUID,
  p_merchant_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_priority TEXT DEFAULT 'normal',
  p_data JSONB DEFAULT '{}',
  p_debt_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    customer_id,
    merchant_id,
    title,
    message,
    type,
    priority,
    data,
    debt_id
  ) VALUES (
    p_customer_id,
    p_merchant_id,
    p_title,
    p_message,
    p_type,
    p_priority,
    p_data,
    p_debt_id
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إضافة دالة لحساب الإحصائيات
CREATE OR REPLACE FUNCTION get_notifications_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'unread', COUNT(*) FILTER (WHERE status = 'unread'),
    'read', COUNT(*) FILTER (WHERE status = 'read'),
    'urgent', COUNT(*) FILTER (WHERE priority = 'urgent'),
    'high', COUNT(*) FILTER (WHERE priority = 'high'),
    'normal', COUNT(*) FILTER (WHERE priority = 'normal'),
    'new_debt', COUNT(*) FILTER (WHERE type = 'new_debt'),
    'debt_reminder', COUNT(*) FILTER (WHERE type = 'debt_reminder'),
    'payment_confirmation', COUNT(*) FILTER (WHERE type = 'payment_confirmation'),
    'payment_request', COUNT(*) FILTER (WHERE type = 'payment_request'),
    'objection', COUNT(*) FILTER (WHERE type = 'objection'),
    'objection_response', COUNT(*) FILTER (WHERE type = 'objection_response'),
    'discount_offer', COUNT(*) FILTER (WHERE type = 'discount_offer')
  ) INTO result
  FROM notifications
  WHERE (customer_id = p_user_id OR merchant_id = p_user_id);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تفعيل تحديث timestamp التلقائي
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at 
  BEFORE UPDATE ON notifications 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- إدراج بيانات تجريبية للإشعارات
INSERT INTO notifications (customer_id, title, message, type, priority, status, data)
SELECT 
  up.id,
  'مرحباً بك في نظام إدارة الديون',
  'تم تفعيل حسابك بنجاح. ستظهر هنا جميع الإشعارات الخاصة بديونك.',
  'info',
  'normal',
  'unread',
  '{"welcome": true}'
FROM users_profile up 
WHERE up.user_type = 'customer'
ON CONFLICT DO NOTHING;