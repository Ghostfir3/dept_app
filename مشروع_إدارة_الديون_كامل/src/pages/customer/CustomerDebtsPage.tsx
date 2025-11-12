import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, Debt } from '../../lib/supabase';
import { DollarSign, TrendingUp, Calendar, PieChart, BarChart3, Users, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface MerchantDebtSummary {
  merchant_id: string;
  merchant_name: string;
  total_amount: number;
  pending_amount: number;
  confirmed_amount: number;
  paid_amount: number;
  debts_count: number;
}

export default function CustomerDebtsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [merchantSummaries, setMerchantSummaries] = useState<MerchantDebtSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | '7days' | '30days' | '90days'>('all');

  useEffect(() => {
    loadDebtsData();
  }, [profile, selectedPeriod]);

  async function loadDebtsData() {
    if (!profile) return;

    try {
      // استدعاء edge function للحصول على الديون مع معلومات التجار
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('customer-debts-history', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: {
          status: selectedPeriod === 'all' ? 'all' : 'confirmed',
          date_range: selectedPeriod === 'all' ? 'all' : (selectedPeriod === '7days' ? 'week' : 'month')
        }
      });

      if (error) {
        console.error('Error fetching debts:', error);
        return;
      }

      if (data && data.data) {
        const processedDebts = data.data.debts || [];
        
        // إضافة console.log للتشخيص
        console.log('Debts data from edge function:', processedDebts);
        if (processedDebts.length > 0) {
          console.log('First debt example:', processedDebts[0]);
          console.log('Paid amount field:', processedDebts[0].paid_amount);
          console.log('Remaining amount field:', processedDebts[0].remaining_amount);
        }
        
        setDebts(processedDebts);

        // حساب ملخصات التجار
        const merchantSummaries: MerchantDebtSummary[] = [];
        const merchantSummaryMap = new Map<string, any>();

        processedDebts.forEach((debt: any) => {
          if (debt.merchant_name) {
            if (!merchantSummaryMap.has(debt.merchant_id)) {
              merchantSummaryMap.set(debt.merchant_id, {
                merchant_id: debt.merchant_id,
                merchant_name: debt.merchant_name,
                total_amount: 0,
                remaining_amount: 0,
                paid_amount: 0,
                pending_amount: 0,
                confirmed_amount: 0,
                debts_count: 0
              });
            }
            
            const summary = merchantSummaryMap.get(debt.merchant_id);
            
            // استخدام البيانات المرجعة من edge function
            const debtAmount = debt.debt_amount || debt.amount || 0;
            const paidAmount = debt.paid_amount || 0;
            const remainingAmount = debt.remaining_amount || (debtAmount - paidAmount);
            
            summary.total_amount += debtAmount;
            summary.paid_amount += paidAmount;
            summary.remaining_amount += remainingAmount;
            summary.debts_count += 1;
            
            if (debt.display_status === 'pending' || debt.status === 'pending') {
              summary.pending_amount += debtAmount;
            } else if (debt.display_status === 'confirmed' || debt.status === 'confirmed') {
              summary.confirmed_amount += debtAmount;
            } else if (debt.display_status === 'paid' || debt.status === 'paid') {
              // دين مسدد، مُضاف للمبالغ الأخرى
            }
          }
        });

        setMerchantSummaries(Array.from(merchantSummaryMap.values()).sort((a, b) => b.total_amount - a.total_amount));
      } else {
        setDebts([]);
        setMerchantSummaries([]);
      }
    } catch (error) {
      console.error('Error loading debts data:', error);
    } finally {
      setLoading(false);
    }
  }

  // إحصائيات عامة
  const totalStats = {
    total_amount: debts.reduce((sum, d) => sum + d.amount, 0),
    remaining_amount: debts.reduce((sum, d) => sum + (d.remaining_amount || 0), 0),
    paid_amount: debts.reduce((sum, d) => sum + (d.paid_amount || 0), 0),
    pending_amount: debts.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0),
    confirmed_amount: debts.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + d.amount, 0),
    total_count: debts.length
  };

  // بيانات الرسم الدائري - توزيع الديون حسب الحالة
  const statusChartData = {
    labels: ['معلقة', 'مؤكدة', 'مسددة'],
    datasets: [
      {
        data: [totalStats.pending_amount, totalStats.confirmed_amount, totalStats.paid_amount],
        backgroundColor: ['#f59e0b', '#10b981', '#3b82f6'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  // بيانات الرسم البياني - الديون حسب التاجر
  const merchantChartData = {
    labels: merchantSummaries.slice(0, 6).map(m => m.merchant_name.length > 10 ? m.merchant_name.substring(0, 10) + '...' : m.merchant_name),
    datasets: [
      {
        label: 'إجمالي الديون (ر.س)',
        data: merchantSummaries.slice(0, 6).map(m => m.total_amount),
        backgroundColor: '#3b82f6',
        borderRadius: 8,
      }
    ]
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return value + ' ر.س';
          }
        }
      }
    }
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-gray-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-bold">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/customer')}
            className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 className="text-blue-600" size={28} />
              جميع ديوني
            </h1>
            <p className="text-sm text-gray-600">تحليل شامل لحالة الديون مع جميع التجار</p>
          </div>
        </div>

        {/* فلتر الفترة الزمنية */}
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value as any)}
          className="px-4 py-2 border-2 border-gray-300 rounded-xl bg-white text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">جميع الفترات</option>
          <option value="7days">آخر 7 أيام</option>
          <option value="30days">آخر 30 يوم</option>
          <option value="90days">آخر 90 يوم</option>
        </select>
      </div>

      {/* بطاقات الإحصائيات الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-blue-600" size={24} />
            </div>
            <div className="text-right">
              <h3 className="text-sm text-gray-600 font-medium">إجمالي الديون</h3>
              <p className="text-2xl font-bold text-gray-800">{totalStats.total_amount.toFixed(2)}</p>
              <p className="text-xs text-gray-500">ر.س</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-orange-500">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Calendar className="text-orange-600" size={24} />
            </div>
            <div className="text-right">
              <h3 className="text-sm text-gray-600 font-medium">الديون المعلقة</h3>
              <p className="text-2xl font-bold text-gray-800">{totalStats.pending_amount.toFixed(2)}</p>
              <p className="text-xs text-gray-500">ر.س</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <div className="text-right">
              <h3 className="text-sm text-gray-600 font-medium">الديون المؤكدة</h3>
              <p className="text-2xl font-bold text-gray-800">{totalStats.confirmed_amount.toFixed(2)}</p>
              <p className="text-xs text-gray-500">ر.س</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="text-purple-600" size={24} />
            </div>
            <div className="text-right">
              <h3 className="text-sm text-gray-600 font-medium">عدد التجار</h3>
              <p className="text-2xl font-bold text-gray-800">{merchantSummaries.length}</p>
              <p className="text-xs text-gray-500">تاجر</p>
            </div>
          </div>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* الرسم الدائري - توزيع الديون حسب الحالة */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <PieChart className="text-blue-600" size={20} />
            توزيع الديون حسب الحالة
          </h3>
          <div className="h-64">
            <Doughnut data={statusChartData} options={doughnutOptions} />
          </div>
        </div>

        {/* الرسم البياني - الديون حسب التاجر */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={20} />
            أعلى التجار (الديون)
          </h3>
          <div className="h-64">
            <Bar data={merchantChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* جدول ملخص التجار */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Users className="text-blue-600" size={20} />
          ملخص الديون حسب التاجر
        </h3>
        
        {merchantSummaries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-right py-3 px-4 font-bold text-gray-700">التاجر</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">إجمالي الديون</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">معلقة</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">مؤكدة</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">المدفوعة</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">عدد الديون</th>
                </tr>
              </thead>
              <tbody>
                {merchantSummaries.map((summary) => (
                  <tr key={summary.merchant_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="font-bold text-gray-800">{summary.merchant_name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-bold text-blue-600">{summary.total_amount.toFixed(2)} ر.س</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-orange-600 font-medium">{summary.pending_amount.toFixed(2)} ر.س</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-green-600 font-medium">{summary.confirmed_amount.toFixed(2)} ر.س</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-purple-600 font-medium">{summary.paid_amount.toFixed(2)} ر.س</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold">
                        {summary.debts_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-gray-400" size={40} />
            </div>
            <p className="text-gray-600 font-medium">لا توجد ديون في الفترة المحددة</p>
          </div>
        )}
      </div>
    </div>
  );
}
