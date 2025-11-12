
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { supabase, Debt } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Download, Calendar, TrendingUp, DollarSign, Users, CheckCircle, Clock, Filter, RotateCcw, Search, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

export default function ReportsPage() {
  const { profile } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // فلاتر متقدمة
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // الجدول
  const [sortField, setSortField] = useState('total');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const rowsPerPage = 10;

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

  // تصفية الديون حسب الفترة المحددة
  function getFilteredDebts() {
    const now = new Date();
    return debts.filter(debt => {
      const debtDate = new Date(debt.created_at);
      
      // فلتر الزمن
      let dateMatch = false;
      if (reportType === 'daily') {
        dateMatch = debtDate.toDateString() === now.toDateString();
      } else if (reportType === 'weekly') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateMatch = debtDate >= weekAgo;
      } else {
        dateMatch = debtDate.getMonth() === selectedMonth && debtDate.getFullYear() === selectedYear;
      }

      // فلتر العميل
      const customerMatch = selectedCustomer === 'all' || debt.customer_phone === selectedCustomer;

      // فلتر المبلغ
      const min = minAmount ? parseFloat(minAmount) : 0;
      const max = maxAmount ? parseFloat(maxAmount) : Infinity;
      const amountMatch = debt.amount >= min && debt.amount <= max;

      // فلتر الحالة
      const statusMatch = statusFilter === 'all' || debt.status === statusFilter;

      return dateMatch && customerMatch && amountMatch && statusMatch;
    });
  }

  const filteredDebts = getFilteredDebts();

  // حساب إحصائيات الشهر الماضي للمقارنة
  function getPreviousMonthStats() {
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    
    const prevDebts = debts.filter(debt => {
      const debtDate = new Date(debt.created_at);
      return debtDate.getMonth() === prevMonth && debtDate.getFullYear() === prevYear;
    });

    return {
      total: prevDebts.reduce((sum, d) => sum + d.amount, 0),
      paid: prevDebts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0),
      count: prevDebts.length
    };
  }

  const previousStats = reportType === 'monthly' ? getPreviousMonthStats() : null;

  // الإحصائيات الأساسية
  const total = filteredDebts.reduce((sum, d) => sum + d.amount, 0);
  const paid = filteredDebts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0);
  const pending = filteredDebts.filter(d => d.status !== 'paid').reduce((sum, d) => sum + d.amount, 0);
  const count = filteredDebts.length;
  const paidCount = filteredDebts.filter(d => d.status === 'paid').length;
  const paymentRate = filteredDebts.length > 0 ? (paidCount / count) * 100 : 0;
  const customers = new Set(filteredDebts.map(d => d.customer_phone)).size;
  const avgPaymentDays = calculateAvgPaymentDays(filteredDebts);
  const monthlyCollectionRate = count > 0 ? (paid / (total || 1)) * 100 : 0;

  // الإحصائيات الكاملة
  const stats = {
    total,
    paid,
    pending,
    count,
    paidCount,
    paymentRate,
    customers,
    avgPaymentDays,
    monthlyCollectionRate,
    monthlyGrowth: previousStats ? ((total - previousStats.total) / (previousStats.total || 1)) * 100 : 0
  };

  // حساب متوسط مدة السداد
  function calculateAvgPaymentDays(debts: Debt[]) {
    const paidDebts = debts.filter(d => d.status === 'paid');
    if (paidDebts.length === 0) return 0;

    const totalDays = paidDebts.reduce((sum, debt) => {
      const created = new Date(debt.created_at);
      const updated = new Date(debt.updated_at);
      const days = Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);

    return Math.round(totalDays / paidDebts.length);
  }

  // بيانات الاتجاهات لآخر 6 أشهر
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(selectedYear, selectedMonth - i, 1);
      const monthDebts = debts.filter(d => {
        const debtDate = new Date(d.created_at);
        return debtDate.getMonth() === date.getMonth() && debtDate.getFullYear() === date.getFullYear();
      });
      
      months.push({
        month: date.toLocaleDateString('ar-SA', { month: 'short' }),
        total: monthDebts.reduce((sum, d) => sum + d.amount, 0),
        paid: monthDebts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0),
        pending: monthDebts.filter(d => d.status !== 'paid').reduce((sum, d) => sum + d.amount, 0)
      });
    }
    return months;
  }, [debts, selectedMonth, selectedYear]);

  // قائمة العملاء الفريدة
  const uniqueCustomers = useMemo(() => {
    const customers = debts.reduce((acc: any[], debt) => {
      if (!acc.find(c => c.phone === debt.customer_phone)) {
        acc.push({ name: debt.customer_name, phone: debt.customer_phone });
      }
      return acc;
    }, []);
    return customers.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [debts]);

  // أكثر العملاء ديوناً
  const topCustomers = useMemo(() => {
    const customers = filteredDebts.reduce((acc: any[], debt) => {
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
    }, []);

    // الفرز
    let sorted = [...customers];
    if (sortField === 'name') {
      sorted.sort((a, b) => sortDirection === 'asc' ? 
        a.name.localeCompare(b.name, 'ar') : 
        b.name.localeCompare(a.name, 'ar'));
    } else if (sortField === 'total') {
      sorted.sort((a, b) => sortDirection === 'asc' ? a.total - b.total : b.total - a.total);
    } else if (sortField === 'count') {
      sorted.sort((a, b) => sortDirection === 'asc' ? a.count - b.count : b.count - a.count);
    }

    // البحث
    if (searchQuery) {
      sorted = sorted.filter(c => 
        c.name.includes(searchQuery) || c.phone.includes(searchQuery)
      );
    }

    return sorted;
  }, [filteredDebts, sortField, sortDirection, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(topCustomers.length / rowsPerPage);
  const paginatedCustomers = topCustomers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // توزيع الديون
  const statusData = [
    { name: 'مدفوع', value: filteredDebts.filter(d => d.status === 'paid').length, color: '#4CAF50' },
    { name: 'معلق', value: filteredDebts.filter(d => d.status === 'pending').length, color: '#FFA500' },
    { name: 'مؤكد', value: filteredDebts.filter(d => d.status === 'confirmed').length, color: '#2196F3' },
    { name: 'معترض', value: filteredDebts.filter(d => d.status === 'disputed').length, color: '#F44336' },
  ].filter(item => item.value > 0);

  // إعادة تعيين الفلاتر
  function resetFilters() {
    setSelectedCustomer('all');
    setMinAmount('');
    setMaxAmount('');
    setStatusFilter('all');
  }

  // الفرز
  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  }

  // تصدير إلى PDF مع الرسوم البيانية
  async function exportToPDF() {
    const doc = new jsPDF();

    // إعداد الخط العربي
    doc.setLanguage('ar');
    doc.setFont('helvetica');

    // شعار وعنوان
    doc.setFontSize(22);
    doc.setTextColor(22, 163, 74); // green-600
    doc.text('Debt Management System', 105, 15, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Advanced Financial Report', 105, 25, { align: 'center' });
    
    // ترويسة بمعلومات
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const periodText = reportType === 'daily' ? 'Daily Report' : 
                      reportType === 'weekly' ? 'Weekly Report' : 
                      `Monthly Report - ${monthNames[selectedMonth]} ${selectedYear}`;
    doc.text(periodText, 105, 32, { align: 'center' });
    doc.text(`Merchant: ${profile?.full_name || 'N/A'}`, 15, 40);
    doc.text(`Generated: ${new Date().toLocaleString('ar-SA')}`, 15, 46);

    // خط فاصل
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 50, 195, 50);

    // الإحصائيات الرئيسية
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Key Statistics', 15, 58);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let yPos = 66;
    
    const statsData = [
      ['Total Debts', `${stats.total.toFixed(2)} SAR`, `(${stats.count} debts)`],
      ['Paid Amount', `${stats.paid.toFixed(2)} SAR`, `(${stats.paidCount} debts)`],
      ['Pending Amount', `${stats.pending.toFixed(2)} SAR`, `(${stats.count - stats.paidCount} debts)`],
      ['Payment Rate', `${stats.paymentRate.toFixed(1)}%`, ''],
      ['Unique Customers', `${stats.customers}`, ''],
      ['Avg Payment Days', `${stats.avgPaymentDays} days`, ''],
      ['Monthly Collection Rate', `${stats.monthlyCollectionRate.toFixed(1)}%`, '']
    ];

    statsData.forEach(([label, value, extra]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label + ':', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value + ' ' + extra, 80, yPos);
      yPos += 6;
    });

    // مقارنة شهرية
    if (reportType === 'monthly' && previousStats) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Month-over-Month Comparison', 15, yPos + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      yPos += 12;

      const growthPercent = stats.monthlyGrowth;
      const growthText = growthPercent >= 0 ? `+${growthPercent.toFixed(1)}%` : `${growthPercent.toFixed(1)}%`;
      doc.text(`Total Growth: ${growthText}`, 20, yPos);
      yPos += 6;
      doc.text(`Previous Month: ${previousStats.total.toFixed(2)} SAR`, 20, yPos);
      yPos += 6;
      doc.text(`Current Month: ${stats.total.toFixed(2)} SAR`, 20, yPos);
    }

    // جدول أفضل العملاء
    if (topCustomers.length > 0) {
      autoTable(doc, {
        startY: yPos + 10,
        head: [['Rank', 'Customer', 'Phone', 'Total Debts', 'Count']],
        body: topCustomers.slice(0, 10).map((c, idx) => [
          `#${idx + 1}`,
          c.name,
          c.phone,
          `${c.total.toFixed(2)} SAR`,
          c.count
        ]),
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 9 }
      });
    }

    // تذييل في كل صفحة
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
      doc.text(`Printed on: ${new Date().toLocaleDateString('ar-SA')}`, 195, 290, { align: 'right' });
    }

    // حفظ الملف
    const filename = `debt-report-${reportType}-${Date.now()}.pdf`;
    doc.save(filename);
  }

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border-2 border-gray-200 rounded-lg shadow-lg">
          <p className="font-bold text-gray-800 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {Number(entry.value || 0).toFixed(2)} ر.س
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-8 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" dir="rtl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <FileText className="text-green-600" size={32} />
            التقارير المتقدمة
          </h1>
          <p className="text-gray-600">تقارير تفصيلية عن الديون والأداء المالي</p>
        </div>
        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg hover:scale-105"
        >
          <Download size={20} />
          تصدير PDF
        </button>
      </div>

      {/* اختيار نوع التقرير */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="text-gray-600" size={20} />
            <span className="font-bold text-gray-700">نوع التقرير:</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setReportType('daily')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                reportType === 'daily' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              يومي
            </button>
            <button
              onClick={() => setReportType('weekly')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                reportType === 'weekly' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              أسبوعي
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                reportType === 'monthly' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              شهري
            </button>
          </div>

          {reportType === 'monthly' && (
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg font-bold focus:border-green-500 focus:outline-none"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg font-bold focus:border-green-500 focus:outline-none"
              >
                {[2023, 2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="mr-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
          >
            <Filter size={18} />
            فلاتر متقدمة
          </button>
        </div>

        {/* الفلاتر المتقدمة */}
        {showAdvancedFilters && (
          <div className="mt-6 pt-6 border-t-2 border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">العميل</label>
              <select
                value={selectedCustomer}
                onChange={e => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              >
                <option value="all">جميع العملاء</option>
                {uniqueCustomers.map(customer => (
                  <option key={customer.phone} value={customer.phone}>
                    {customer.name} ({customer.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">الحد الأدنى للمبلغ</label>
              <input
                type="number"
                value={minAmount}
                onChange={e => setMinAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">الحد الأقصى للمبلغ</label>
              <input
                type="number"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                placeholder="غير محدود"
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">حالة الدين</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              >
                <option value="all">الكل</option>
                <option value="pending">معلق</option>
                <option value="confirmed">مؤكد</option>
                <option value="disputed">معترض</option>
                <option value="paid">مدفوع</option>
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

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-blue-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">إجمالي الديون</h3>
            <DollarSign className="text-blue-600" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.total.toFixed(2)} ر.س</p>
          <p className="text-sm text-gray-500 mt-1">{stats.count} دين</p>
          {reportType === 'monthly' && previousStats && (
            <div className={`mt-2 flex items-center gap-1 text-sm font-bold ${
              stats.total >= previousStats.total ? 'text-green-600' : 'text-red-600'
            }`}>
              {stats.total >= previousStats.total ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              {Math.abs(((stats.total - previousStats.total) / (previousStats.total || 1)) * 100).toFixed(1)}%
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-green-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">المبلغ المدفوع</h3>
            <CheckCircle className="text-green-600" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.paid.toFixed(2)} ر.س</p>
          <p className="text-sm text-gray-500 mt-1">{stats.paidCount} دين</p>
          {reportType === 'monthly' && previousStats && (
            <div className={`mt-2 flex items-center gap-1 text-sm font-bold ${
              stats.paid >= previousStats.paid ? 'text-green-600' : 'text-red-600'
            }`}>
              {stats.paid >= previousStats.paid ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              {Math.abs(((stats.paid - previousStats.paid) / (previousStats.paid || 1)) * 100).toFixed(1)}%
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-orange-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">المبلغ المعلق</h3>
            <Clock className="text-orange-600" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.pending.toFixed(2)} ر.س</p>
          <p className="text-sm text-gray-500 mt-1">{stats.count - stats.paidCount} دين</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-purple-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-600 font-medium">معدل السداد</h3>
            <TrendingUp className="text-purple-600" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.paymentRate.toFixed(1)}%</p>
          <p className="text-sm text-gray-500 mt-1">{stats.customers} عميل</p>
        </div>

        {/* إحصائيات إضافية */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">معدل التحصيل الشهري</h3>
            <TrendingUp size={24} />
          </div>
          <p className="text-3xl font-bold">{stats.monthlyCollectionRate.toFixed(1)}%</p>
          <p className="text-sm opacity-90 mt-1">من إجمالي الديون</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">متوسط مدة السداد</h3>
            <Clock size={24} />
          </div>
          <p className="text-3xl font-bold">{stats.avgPaymentDays}</p>
          <p className="text-sm opacity-90 mt-1">يوم</p>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* توزيع حسب الحالة */}
        <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <h3 className="text-xl font-bold text-gray-800 mb-4">توزيع الديون حسب الحالة</h3>
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
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* المبالغ حسب الحالة */}
        <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <h3 className="text-xl font-bold text-gray-800 mb-4">المبالغ حسب الحالة</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { name: 'مدفوع', value: stats.paid },
              { name: 'معلق', value: stats.pending }
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#10B981" name="المبلغ (ر.س)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* الاتجاهات الشهرية */}
        <div className="bg-white rounded-2xl shadow-lg p-6 lg:col-span-2 hover:shadow-xl transition-shadow">
          <h3 className="text-xl font-bold text-gray-800 mb-4">الاتجاهات الشهرية (آخر 6 أشهر)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="total" stroke="#3B82F6" fillOpacity={1} fill="url(#colorTotal)" name="الإجمالي" />
              <Area type="monotone" dataKey="paid" stroke="#10B981" fillOpacity={1} fill="url(#colorPaid)" name="المدفوع" />
              <Area type="monotone" dataKey="pending" stroke="#F59E0B" fillOpacity={1} fill="url(#colorPending)" name="المعلق" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* جدول العملاء */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-green-600" size={24} />
            تفاصيل العملاء ({topCustomers.length})
          </h3>
          <div className="flex items-center gap-2">
            <Search className="text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث باسم أو رقم..."
              className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الترتيب</th>
                <th 
                  className="px-6 py-3 text-right text-sm font-bold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    اسم العميل
                    {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">رقم الهاتف</th>
                <th 
                  className="px-6 py-3 text-right text-sm font-bold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center gap-1">
                    إجمالي الديون
                    {sortField === 'total' && (sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-right text-sm font-bold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('count')}
                >
                  <div className="flex items-center gap-1">
                    عدد الديون
                    {sortField === 'count' && (sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedCustomers.map((customer, index) => (
                <tr key={customer.phone} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    #{(currentPage - 1) * rowsPerPage + index + 1}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{customer.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.phone}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{customer.total.toFixed(2)} ر.س</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {topCustomers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>لا توجد بيانات للفترة المحددة</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              عرض {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, topCustomers.length)} من {topCustomers.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight size={20} />
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg font-bold ${
                      currentPage === page
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
