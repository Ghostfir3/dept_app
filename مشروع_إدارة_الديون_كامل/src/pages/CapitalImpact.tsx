
// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase, Debt, Expense } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Save, PieChart as PieChartIcon,
  Calculator, Plus, Edit2, Trash2, X, Receipt, Calendar, BarChart3, LineChart as LineChartIcon
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';

const EXPENSE_CATEGORIES = [
  'رواتب',
  'إيجار',
  'مواد خام',
  'مرافق',
  'نقل وشحن',
  'تسويق',
  'صيانة',
  'أخرى'
];

export default function CapitalImpact() {
  const { profile } = useAuth();
  const [capital, setCapital] = useState<number>(0);
  const [inputCapital, setInputCapital] = useState<string>('');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  // حاسبة الأرباح
  const [profitPeriod, setProfitPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [profitProduct, setProfitProduct] = useState<string>('all');
  
  // إدارة المصروفات
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [profile]);

  async function loadData() {
    if (!profile) return;

    // تحميل رأس المال
    const { data: profileData } = await supabase
      .from('users_profile')
      .select('capital')
      .eq('id', profile.id)
      .single();
    
    if (profileData && profileData.capital) {
      setCapital(profileData.capital);
      setInputCapital(profileData.capital.toString());
    }

    // تحميل الديون
    const { data: debtsData } = await supabase
      .from('debts')
      .select('*')
      .eq('merchant_id', profile.id);
    
    if (debtsData) setDebts(debtsData);

    // تحميل المصروفات
    const { data: expensesData } = await supabase
      .from('expenses')
      .select('*')
      .eq('merchant_id', profile.id)
      .order('expense_date', { ascending: false });
    
    if (expensesData) setExpenses(expensesData);
    
    setLoading(false);
  }

  async function handleSaveCapital() {
    if (!profile || !inputCapital) return;

    const capitalValue = parseFloat(inputCapital);
    if (isNaN(capitalValue) || capitalValue <= 0) {
      toast.error('الرجاء إدخال قيمة صحيحة لرأس المال');
      return;
    }

    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ capital: capitalValue })
        .eq('id', profile.id);

      if (error) throw error;

      setCapital(capitalValue);
      toast.success('تم حفظ رأس المال بنجاح');
    } catch (error: any) {
      toast.error('حدث خطأ في حفظ رأس المال');
    }
  }

  // إدارة المصروفات
  function openExpenseModal(expense?: Expense) {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        amount: expense.amount.toString(),
        category: expense.category,
        description: expense.description || '',
        expense_date: expense.expense_date
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({
        amount: '',
        category: '',
        description: '',
        expense_date: new Date().toISOString().split('T')[0]
      });
    }
    setShowExpenseModal(true);
  }

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    try {
      if (editingExpense) {
        // تحديث
        const { error } = await supabase
          .from('expenses')
          .update({
            amount,
            category: expenseForm.category,
            description: expenseForm.description,
            expense_date: expenseForm.expense_date
          })
          .eq('id', editingExpense.id);

        if (error) throw error;
        toast.success('تم تحديث المصروف بنجاح');
      } else {
        // إضافة جديد
        const { error } = await supabase
          .from('expenses')
          .insert({
            merchant_id: profile.id,
            amount,
            category: expenseForm.category,
            description: expenseForm.description,
            expense_date: expenseForm.expense_date
          });

        if (error) throw error;
        toast.success('تم إضافة المصروف بنجاح');
      }

      setShowExpenseModal(false);
      loadData();
    } catch (error: any) {
      toast.error('حدث خطأ في حفظ المصروف');
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف المصروف بنجاح');
      loadData();
    } catch (error: any) {
      toast.error('حدث خطأ في حذف المصروف');
    }
  }

  // الحسابات المالية
  const paidDebts = debts.filter(d => d.status === 'paid');
  const pendingDebts = debts.filter(d => d.status !== 'paid');
  
  const totalRevenue = paidDebts.reduce((sum, d) => sum + d.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const roi = capital > 0 ? (netProfit / capital) * 100 : 0;
  
  const pendingAmount = pendingDebts.reduce((sum, d) => sum + d.amount, 0);
  const availableCapital = capital - pendingAmount;
  const debtPercentage = capital > 0 ? (pendingAmount / capital) * 100 : 0;
  const restrictedCapital = pendingAmount;
  const freeCapital = Math.max(0, capital - pendingAmount);

  // حساب نمو الإيرادات
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const currentMonthRevenue = paidDebts
    .filter(d => {
      const date = new Date(d.created_at);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
    .reduce((sum, d) => sum + d.amount, 0);

  const lastMonthRevenue = paidDebts
    .filter(d => {
      const date = new Date(d.created_at);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    })
    .reduce((sum, d) => sum + d.amount, 0);

  const revenueGrowth = lastMonthRevenue > 0 
    ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
    : 0;

  // بيانات الرسوم البيانية
  const capitalPieData = [
    { name: 'رأس المال الحر', value: freeCapital, color: '#4CAF50' },
    { name: 'رأس المال المقيد', value: restrictedCapital, color: '#F44336' },
  ];

  const profitExpenseData = [
    { name: 'الإيرادات', value: totalRevenue, color: '#4CAF50' },
    { name: 'المصروفات', value: totalExpenses, color: '#F44336' },
    { name: 'صافي الربح', value: netProfit, color: '#2196F3' }
  ];

  // بيانات شهرية للإيرادات والمصروفات
  const monthlyFinancialData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const month = date.getMonth();
    const year = date.getFullYear();
    const monthName = date.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });

    const revenue = paidDebts
      .filter(d => {
        const dDate = new Date(d.created_at);
        return dDate.getMonth() === month && dDate.getFullYear() === year;
      })
      .reduce((sum, d) => sum + d.amount, 0);

    const expense = expenses
      .filter(e => {
        const eDate = new Date(e.expense_date);
        return eDate.getMonth() === month && eDate.getFullYear() === year;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      month: monthName,
      revenue,
      expense,
      profit: revenue - expense
    };
  });

  // بيانات المصروفات حسب الفئة
  const expensesByCategory = EXPENSE_CATEGORIES.map(category => ({
    name: category,
    value: expenses.filter(e => e.category === category).reduce((sum, e) => sum + e.amount, 0)
  })).filter(item => item.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">رأس المال والأرباح</h1>
        <p className="text-gray-600">إدارة رأس المال، حساب الأرباح، وتتبع المصروفات</p>
      </div>

      {/* نموذج إدخال رأس المال */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <DollarSign className="text-green-600" size={24} />
          إدخال رأس المال الأساسي
        </h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2 text-gray-700">رأس المال (ر.س)</label>
            <input
              type="number"
              step="0.01"
              value={inputCapital}
              onChange={e => setInputCapital(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
              placeholder="أدخل رأس المال الأساسي"
            />
          </div>
          <button
            onClick={handleSaveCapital}
            className="self-end flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg"
          >
            <Save size={20} />
            حفظ
          </button>
        </div>
      </div>

      {/* مؤشرات الأداء الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-blue-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">رأس المال الأساسي</h3>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-blue-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{capital.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ر.س</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-green-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">صافي الربح</h3>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-700">{netProfit.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ر.س</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-purple-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">عائد الاستثمار ROI</h3>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Calculator className="text-purple-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-purple-700">{roi.toFixed(1)}%</p>
          <p className="text-sm text-gray-500 mt-1">من رأس المال</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-orange-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">هامش الربح</h3>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <BarChart3 className="text-orange-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-orange-700">{profitMargin.toFixed(1)}%</p>
          <p className="text-sm text-gray-500 mt-1">من الإيرادات</p>
        </div>
      </div>

      {/* بطاقات الإحصائيات المالية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-cyan-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">إجمالي الإيرادات</h3>
            <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-cyan-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-cyan-700">{totalRevenue.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ر.س</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-red-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">إجمالي المصروفات</h3>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <TrendingDown className="text-red-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-red-700">{totalExpenses.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ر.س</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-indigo-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">نمو الإيرادات</h3>
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <LineChartIcon className="text-indigo-600" size={24} />
            </div>
          </div>
          <p className={`text-3xl font-bold ${revenueGrowth >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 mt-1">مقارنة بالشهر السابق</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-pink-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">رأس المال المتاح</h3>
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-pink-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-pink-700">{availableCapital.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ر.س</p>
        </div>
      </div>

      {/* الرسوم البيانية - الصف الأول */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* الإيرادات والمصروفات الشهرية */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <LineChartIcon className="text-blue-600" size={24} />
            الإيرادات والمصروفات الشهرية
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyFinancialData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#4CAF50" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F44336" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#F44336" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#4CAF50" fillOpacity={1} fill="url(#colorRevenue)" name="الإيرادات" />
              <Area type="monotone" dataKey="expense" stroke="#F44336" fillOpacity={1} fill="url(#colorExpense)" name="المصروفات" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* توزيع رأس المال */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <PieChartIcon className="text-green-600" size={24} />
            توزيع رأس المال
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={capitalPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {capitalPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* الرسوم البيانية - الصف الثاني */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* مقارنة الإيرادات والمصروفات والأرباح */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={24} />
            مقارنة الإيرادات والمصروفات
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={profitExpenseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" name="المبلغ (ر.س)">
                {profitExpenseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* المصروفات حسب الفئة */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <PieChartIcon className="text-red-600" size={24} />
            المصروفات حسب الفئة
          </h3>
          {expensesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 60%)`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              <p>لا توجد مصروفات مسجلة</p>
            </div>
          )}
        </div>
      </div>

      {/* إدارة المصروفات */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Receipt className="text-blue-600" size={24} />
            إدارة المصروفات
          </h3>
          <button
            onClick={() => openExpenseModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-lg"
          >
            <Plus size={20} />
            إضافة مصروف
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الفئة</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">المبلغ</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الوصف</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">التاريخ</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-red-700">{expense.amount.toFixed(2)} ر.س</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{expense.description || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(expense.expense_date).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openExpenseModal(expense)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all"
                        title="تعديل"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Receipt className="mx-auto mb-2" size={48} />
              <p>لا توجد مصروفات مسجلة</p>
            </div>
          )}
        </div>
      </div>

      {/* تحليل وتوصيات */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl shadow-xl p-6 border-2 border-blue-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <AlertCircle className="text-blue-600" size={24} />
          تحليل مالي وتوصيات
        </h3>
        <div className="space-y-3">
          {netProfit > 0 && (
            <div className="p-4 bg-green-100 border-r-4 border-green-500 rounded-lg">
              <p className="font-bold text-green-800">ممتاز: تحقيق أرباح صافية إيجابية</p>
              <p className="text-sm text-green-700 mt-1">
                صافي الربح الحالي: {netProfit.toFixed(2)} ر.س مع هامش ربح {profitMargin.toFixed(1)}%
              </p>
            </div>
          )}
          {netProfit < 0 && (
            <div className="p-4 bg-red-100 border-r-4 border-red-500 rounded-lg">
              <p className="font-bold text-red-800">تنبيه: خسارة صافية</p>
              <p className="text-sm text-red-700 mt-1">
                المصروفات أعلى من الإيرادات. يُنصح بمراجعة المصروفات وزيادة الإيرادات.
              </p>
            </div>
          )}
          {roi > 20 && (
            <div className="p-4 bg-green-100 border-r-4 border-green-500 rounded-lg">
              <p className="font-bold text-green-800">عائد استثمار ممتاز</p>
              <p className="text-sm text-green-700 mt-1">
                عائد الاستثمار {roi.toFixed(1)}% يعتبر ممتازاً ويدل على أداء مالي قوي.
              </p>
            </div>
          )}
          {roi < 5 && roi > 0 && (
            <div className="p-4 bg-orange-100 border-r-4 border-orange-500 rounded-lg">
              <p className="font-bold text-orange-800">عائد استثمار منخفض</p>
              <p className="text-sm text-orange-700 mt-1">
                عائد الاستثمار {roi.toFixed(1)}% منخفض. يُنصح بتحسين الكفاءة التشغيلية.
              </p>
            </div>
          )}
          {debtPercentage > 75 && (
            <div className="p-4 bg-red-100 border-r-4 border-red-500 rounded-lg">
              <p className="font-bold text-red-800">تحذير: نسبة الديون مرتفعة</p>
              <p className="text-sm text-red-700 mt-1">
                {debtPercentage.toFixed(1)}% من رأس المال مقيد بالديون. يُنصح بتحصيل الديون المعلقة.
              </p>
            </div>
          )}
          {revenueGrowth > 10 && (
            <div className="p-4 bg-green-100 border-r-4 border-green-500 rounded-lg">
              <p className="font-bold text-green-800">نمو إيرادات قوي</p>
              <p className="text-sm text-green-700 mt-1">
                نمو الإيرادات {revenueGrowth.toFixed(1)}% مقارنة بالشهر السابق يدل على أداء جيد.
              </p>
            </div>
          )}
          {revenueGrowth < -10 && (
            <div className="p-4 bg-red-100 border-r-4 border-red-500 rounded-lg">
              <p className="font-bold text-red-800">انخفاض في الإيرادات</p>
              <p className="text-sm text-red-700 mt-1">
                انخفضت الإيرادات بنسبة {Math.abs(revenueGrowth).toFixed(1)}% مقارنة بالشهر السابق.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal إضافة/تعديل مصروف */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Receipt size={24} className="text-blue-600" />
                  {editingExpense ? 'تعديل مصروف' : 'إضافة مصروف جديد'}
                </h3>
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ (ر.س)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="أدخل المبلغ"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الفئة</label>
                <select
                  required
                  value={expenseForm.category}
                  onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">اختر الفئة</option>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ المصروف</label>
                <input
                  type="date"
                  required
                  value={expenseForm.expense_date}
                  onChange={e => setExpenseForm({...expenseForm, expense_date: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الوصف (اختياري)</label>
                <textarea
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="وصف المصروف..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                  {editingExpense ? 'حفظ التعديلات' : 'إضافة المصروف'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowExpenseModal(false)} 
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-400 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
