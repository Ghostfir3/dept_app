import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import MerchantSidebar from './components/MerchantSidebar';
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NewHomePage from './pages/NewHomePage';
import MerchantDashboard from './pages/MerchantDashboard';
import DebtsManagementPage from './pages/DebtsManagementPage';
import AddDebtPage from './pages/AddDebtPage';
import ChartsPage from './pages/ChartsPage';
import CapitalImpact from './pages/CapitalImpact';
import SettingsPage from './pages/SettingsPage';
import CustomerDashboard from './pages/CustomerDashboard';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import CustomerNotesPage from './pages/CustomerNotesPage';
import NetProfitPage from './pages/NetProfitPage';
import StatisticsPage from './pages/StatisticsPage';
import CustomerNotificationsPage from './pages/CustomerNotificationsPage';
import CustomerDebtsHistoryPage from './pages/CustomerDebtsHistoryPage';
import CustomerMerchantsPage from './pages/CustomerMerchantsPage';
import CustomerFeedbackPage from './pages/CustomerFeedbackPage';
import CustomerDebtsPage from './pages/customer/CustomerDebtsPage';
import CustomerLayout from './components/CustomerLayout';
import ReceivedFeedbackPage from './pages/merchant/ReceivedFeedbackPage';
import ObjectionsPage from './pages/ObjectionsPage';
import AllDebtsPage from './pages/AllDebtsPage';
import LoyalCustomersPage from './pages/LoyalCustomersPage';
import CustomerDiscountOffersPage from './pages/CustomerDiscountOffersPage';
import CapitalManagementPage from './pages/CapitalManagementPage';
import ExpensesManagementPage from './pages/ExpensesManagementPage';
import RevenueManagementPage from './pages/RevenueManagementPage';
import FinancialAnalyticsPage from './pages/FinancialAnalyticsPage';

function PrivateRoute({ children, allowedType }: { children: React.ReactNode; allowedType?: 'merchant' | 'customer' }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-bold">جاري التحميل...</p>
        </div>
      </div>
    );
  }
  
  if (!user || !profile) return <Navigate to="/login" />;
  if (allowedType && profile.user_type !== allowedType) {
    // Redirect to appropriate dashboard based on user type
    if (profile.user_type === 'merchant') {
      return <Navigate to="/merchant/home" />;
    } else if (profile.user_type === 'customer') {
      return <Navigate to="/customer" />;
    } else {
      return <Navigate to="/login" />;
    }
  }
  
  return <>{children}</>;
}

function MerchantLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarVisible, toggleSidebar } = useSidebar();
  
  return (
    <div className="min-h-screen w-full relative" dir="rtl">
      {/* الشريط الجانبي */}
      <MerchantSidebar />
      
      {/* المحتوى الرئيسي - مع margin-left للتفادي مع الشريط (الشريط من اليمين) */}
      <div 
        className={`
          w-full min-h-screen relative z-10 transition-all duration-300 ease-in-out
          ${isSidebarVisible ? 'ml-60' : 'ml-0'}
          pr-4 py-6
        `}
      >

        {/* زر الهامبرغر */}
        <button
          onClick={toggleSidebar}
          className="fixed top-4 right-4 z-50 bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
          aria-label="فتح القائمة"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        
        {/* المحتوى مباشرة */}
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-bold">جاري التحميل...</p>
        </div>
      </div>
    );
  }
  
  if (!user || !profile) {
    return <Navigate to="/welcome" />;
  }
  
  // Redirect based on user type
  if (profile.user_type === 'merchant') {
    return <Navigate to="/merchant/home" />;
  } else if (profile.user_type === 'customer') {
    return <Navigate to="/customer" />;
  }
  
  return <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* مسارات التاجر */}
            <Route path="/merchant" element={<Navigate to="/merchant/home" />} />
            <Route path="/merchant/home" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <NewHomePage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/debts" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <MerchantDashboard />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/add-debt" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <AddDebtPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/analytics" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <ChartsPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/capital-profits" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <CapitalImpact />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/charts" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <ChartsPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/capital" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <CapitalImpact />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/reports" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <ReportsPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/notifications" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <NotificationsPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/notes" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <CustomerNotesPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/net-profit" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <NetProfitPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/statistics" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <StatisticsPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/settings" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <SettingsPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/objections" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <ObjectionsPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/all-debts" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <AllDebtsPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/loyal-customers" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <LoyalCustomersPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/capital-management" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <CapitalManagementPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/expenses" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <ExpensesManagementPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/revenue" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <RevenueManagementPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            <Route path="/merchant/financial-analytics" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <FinancialAnalyticsPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
            
            {/* مسارات العميل */}
            <Route path="/customer" element={
              <PrivateRoute allowedType="customer">
                <CustomerLayout>
                  <CustomerDashboard />
                </CustomerLayout>
              </PrivateRoute>
            } />
            <Route path="/customer/debts" element={
              <PrivateRoute allowedType="customer">
                <CustomerLayout>
                  <CustomerDebtsPage />
                </CustomerLayout>
              </PrivateRoute>
            } />
            <Route path="/customer/discount-offers" element={
              <PrivateRoute allowedType="customer">
                <CustomerLayout>
                  <CustomerDiscountOffersPage />
                </CustomerLayout>
              </PrivateRoute>
            } />
            <Route path="/customer/notifications" element={
              <PrivateRoute allowedType="customer">
                <CustomerLayout>
                  <CustomerNotificationsPage />
                </CustomerLayout>
              </PrivateRoute>
            } />
            <Route path="/customer/debts-history" element={
              <PrivateRoute allowedType="customer">
                <CustomerLayout>
                  <CustomerDebtsHistoryPage />
                </CustomerLayout>
              </PrivateRoute>
            } />
            <Route path="/customer/merchants" element={
              <PrivateRoute allowedType="customer">
                <CustomerLayout>
                  <CustomerMerchantsPage />
                </CustomerLayout>
              </PrivateRoute>
            } />
            <Route path="/customer/feedback" element={
              <PrivateRoute allowedType="customer">
                <CustomerLayout>
                  <CustomerFeedbackPage />
                </CustomerLayout>
              </PrivateRoute>
            } />
            
            {/* صفحة استقبال الملاحظات للتاجر */}
            <Route path="/merchant/received-feedback" element={
              <PrivateRoute allowedType="merchant">
                <MerchantLayout>
                  <ReceivedFeedbackPage />
                </MerchantLayout>
              </PrivateRoute>
            } />
          </Routes>
          <Toaster position="top-center" />
        </BrowserRouter>
      </SidebarProvider>
    </AuthProvider>
  );
}

export default App;
