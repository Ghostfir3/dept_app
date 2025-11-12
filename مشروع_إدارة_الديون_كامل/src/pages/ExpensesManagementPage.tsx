// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  Receipt, Plus, Edit2, Trash2, X, Calendar,
  TrendingDown, PieChart as PieChartIcon, BarChart3,
  Filter, Download
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const EXPENSE_CATEGORIES = [
  { key: 'transport', label: 'مواصلات', color: '#3B82F6' },
  { key: 'food', label: 'طعام', color: '#10B981' },
  { key: 'rent', label: 'إيجار', color: '#F59E0B' },
  { key: 'electricity', label: 'كهرباء', color: '#EF4444' },
  { key: 'office', label: 'مكاتب', color: '#8B5CF6' },
  { key: 'labor', label: 'عمالة', color: '#EC4899' },
  { key: 'other', label: 'أخرى', color: '#6B7280' },
];

export default function ExpensesManagementPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadExpenses();
  }, [profile]);

  async function loadExpenses() {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('merchant_id', profile.id)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      if (data) setExpenses(data);
      setLoading(false);
    } catch (error) {
      console.error('خطأ في تحميل المصروفات:', error);
      toast.error('حدث خطأ في تحميل البيانات');
      setLoading(false);
    }
  }

  function openModal(expense = null) {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        category: expense.category,
        amount: expense.amount.toString(),
        description: expense.description || '',
        expense_date: expense.expense_date
      });
    } else {
      setEditingExpense(null);
      setFormData({
        category: '',
        amount: '',
        description: '',
        expense_date: new Date().toISOString().split('T')[0]
      });
    }
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!profile) return;

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    if (!formData.category) {
      toast.error('الرجاء اختيار فئة المصروف');
      return;
    }

    try {
      if (editingExpense) {
        // تحديث
        const { error } = await supabase
          .from('expenses')
          .update({
            category: formData.category,
            amount,
            description: formData.description,
            expense_date: formData.expense_date
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
            category: formData.category,
            amount,
            description: formData.description,
            expense_date: formData.expense_date
          });

        if (error) throw error;
        toast.success('تم إضافة المصروف بنجاح');
      }

      setShowModal(false);
      loadExpenses();
    } catch (error) {
      console.error('خطأ في حفظ المصروف:', error);
      toast.error('حدث خطأ في حفظ البيانات');
    }
  }

  async function handleDelete(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف المصروف بنجاح');
      loadExpenses();
    } catch (error) {
      console.error('خطأ في حذف المصروف:', error);
      toast.error('حدث خطأ في حذف البيانات');
    }
  }

  // التصفية
  const filteredExpenses = expenses.filter(expense => {
    const categoryMatch = filterCategory === 'all' || expense.category === filterCategory;
    const monthMatch = filterMonth === 'all' || 
      new Date(expense.expense_date).getMonth() === parseInt(filterMonth);
    return categoryMatch && monthMatch;
  });

  // الحسابات
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyExpenses = filteredExpenses.filter(e => {
    const expenseDate = new Date(e.expense_date);
    const now = new Date();
    return expenseDate.getMonth() === now.getMonth() && 
           expenseDate.getFullYear() === now.getFullYear();
  }).reduce((sum, e) => sum + e.amount, 0);

  const yearlyExpenses = filteredExpenses.filter(e => {
    return new Date(e.expense_date).getFullYear() === new Date().getFullYear();
  }).reduce((sum, e) => sum + e.amount, 0);

  // بيانات الرسوم البيانية
  const expensesByCategory = EXPENSE_CATEGORIES.map(cat => ({
    name: cat.label,
    value: filteredExpenses
      .filter(e => e.category === cat.key)
      .reduce((sum, e) => sum + e.amount, 0),
    color: cat.color
  })).filter(item => item.value > 0);

  // بيانات شهرية
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const month = date.getMonth();
    const year = date.getFullYear();
    const monthName = date.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });

    const total = expenses
      .filter(e => {
        const eDate = new Date(e.expense_date);
        return eDate.getMonth() === month && eDate.getFullYear() === year;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    return { month: monthName, total };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-gray-50 to-red-50 min-h-screen" dir="rtl">
      {/* العنوان */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Receipt className="text-red-600" size={32} />
          إدارة المصروفات
        </h1>
        <p className="text-gray-600">تتبع وتصنيف جميع مصروفات العمل</p>
      </div>

      {/* المؤشرات الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-red-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">إجمالي المصروفات</h3>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <TrendingDown className="text-red-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-red-700">{totalExpenses.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-orange-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">المصروفات الشهرية</h3>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Calendar className="text-orange-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-orange-700">{monthlyExpenses.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ريال سعودي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-r-4 border-purple-500 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">المصروفات السنوية</h3>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <BarChart3 className="text-purple-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-purple-700">{yearlyExpenses.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">ريال سعودي</p>
        </div>
      </div>

      {/* أدوات التصفية والإضافة */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب الفئة</label>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">جميع الفئات</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.key} value={cat.key}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب الشهر</label>
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">جميع الأشهر</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(2024, i, 1).toLocaleDateString('ar-SA', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-lg"
          >
            <Plus size={20} />
            إضافة مصروف
          </button>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* توزيع المصروفات حسب الفئة */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <PieChartIcon className="text-blue-600" size={24} />
            توزيع المصروفات حسب الفئة
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
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              <p>لا توجد مصروفات في هذه الفترة</p>
            </div>
          )}
        </div>

        {/* المصروفات الشهرية */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="text-red-600" size={24} />
            المصروفات الشهرية
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#EF4444" name="المصروفات (ر.س)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* جدول المصروفات */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Receipt className="text-gray-600" size={24} />
          قائمة المصروفات ({filteredExpenses.length})
        </h3>
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
              {filteredExpenses.map((expense) => {
                const category = EXPENSE_CATEGORIES.find(c => c.key === expense.category);
                return (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span 
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: category?.color || '#6B7280' }}
                      >
                        {category?.label || expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-red-700">
                      {expense.amount.toFixed(2)} ر.س
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {expense.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(expense.expense_date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(expense)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all"
                          title="تعديل"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredExpenses.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Receipt className="mx-auto mb-2" size={48} />
              <p>لا توجد مصروفات مسجلة</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal إضافة/تعديل مصروف */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Receipt size={24} className="text-blue-600" />
                  {editingExpense ? 'تعديل مصروف' : 'إضافة مصروف جديد'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الفئة</label>
                <select
                  required
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">اختر الفئة</option>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ (ر.س)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="أدخل المبلغ"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ المصروف</label>
                <input
                  type="date"
                  required
                  value={formData.expense_date}
                  onChange={e => setFormData({...formData, expense_date: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الوصف (اختياري)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
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
                  onClick={() => setShowModal(false)} 
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
