
// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase, Debt } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, TrendingUp, Calendar, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ChartsPage() {
  const { profile } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDebts();
  }, [profile]);

  async function loadDebts() {
    if (!profile) return;
    const { data } = await supabase
      .from('debts')
      .select('*')
      .eq('merchant_id', profile.id)
      .order('created_at', { ascending: false });
    
    if (data) setDebts(data);
    setLoading(false);
  }

  // توزيع الديون حسب الحالة
  const statusData = [
    { name: 'قيد الانتظار', value: debts.filter(d => d.status === 'pending').length, color: '#FFA500' },
    { name: 'مؤكد', value: debts.filter(d => d.status === 'confirmed').length, color: '#4CAF50' },
    { name: 'مدفوع', value: debts.filter(d => d.status === 'paid').length, color: '#2196F3' },
    { name: 'معترض عليه', value: debts.filter(d => d.status === 'disputed').length, color: '#F44336' }
  ];

  // الديون الشهرية
  const monthlyData = debts.reduce((acc: any[], debt) => {
    const month = new Date(debt.created_at).toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.amount += debt.amount;
      existing.count += 1;
    } else {
      acc.push({ month, amount: debt.amount, count: 1 });
    }
    return acc;
  }, []).slice(-12);

  // توزيع المبالغ حسب الحالة
  const amountByStatus = [
    { name: 'قيد الانتظار', amount: debts.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0), color: '#FFA500' },
    { name: 'مؤكد', amount: debts.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + d.amount, 0), color: '#4CAF50' },
    { name: 'مدفوع', amount: debts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0), color: '#2196F3' },
    { name: 'معترض عليه', amount: debts.filter(d => d.status === 'disputed').reduce((sum, d) => sum + d.amount, 0), color: '#F44336' }
  ];

  // أفضل العملاء (حسب إجمالي الديون)
  const customerData = debts.reduce((acc: any[], debt) => {
    const existing = acc.find(item => item.phone === debt.customer_phone);
    if (existing) {
      existing.total += debt.amount;
      existing.count += 1;
    } else {
      acc.push({ 
        name: debt.customer_name, 
        phone: debt.customer_phone,
        total: debt.amount,
        count: 1 
      });
    }
    return acc;
  }, []).sort((a, b) => b.total - a.total).slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">الرسوم البيانية والإحصائيات</h1>
        <p className="text-gray-600">عرض شامل لتحليل الديون والأداء المالي</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* توزيع عدد الديون حسب الحالة */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <PieChartIcon className="text-green-600" size={24} />
            توزيع عدد الديون حسب الحالة
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* توزيع المبالغ حسب الحالة */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={24} />
            توزيع المبالغ حسب الحالة
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={amountByStatus}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" name="المبلغ (ر.س)">
                {amountByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* الديون الشهرية - مبلغ */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="text-purple-600" size={24} />
            إجمالي المبالغ الشهرية
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} name="المبلغ (ر.س)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* عدد الديون الشهرية */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="text-orange-600" size={24} />
            عدد الديون الشهرية
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#F59E0B" name="عدد الديون" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* أكبر العملاء ديوناً */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="text-red-600" size={24} />
            أكبر 10 عملاء من حيث إجمالي الديون
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={customerData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#EF4444" name="إجمالي الديون (ر.س)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
