import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ReportFlowProvider } from './context/ReportFlowContext';
import { MobileHeader } from './components/layout/MobileHeader';
import { DesktopNavbar } from './components/layout/DesktopNavbar';
import { BottomNav } from './components/layout/BottomNav';
import { LoginPage } from './pages/LoginPage';
import { HomeScreen } from './pages/HomeScreen';
import { ListingsPage } from './pages/ListingsPage';
import { MyReportsPage } from './pages/MyReportsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ClaimsPage } from './pages/ClaimsPage';
import { CustodyPage } from './pages/CustodyPage';
import { AdminPage } from './pages/AdminPage';
import { CreateReportPage } from './pages/CreateReportPage';

import { UserRole } from './types';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-300">Authenticating campus credentials...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white flex flex-col transition-colors duration-200">
      {/* Mobile Top Header (hidden on desktop) */}
      <MobileHeader />

      {/* Desktop Top Navbar (hidden on mobile) */}
      <DesktopNavbar />

      {/* Main Content: Full width on mobile, centered max-w-7xl on desktop */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (hidden on desktop) */}
      <BottomNav />
    </div>
  );
};

const RoleGuard: React.FC<{
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { role } = useAuth();
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const AppContent: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = 'CampusTrace — AI Lost & Found';
    if (path === '/') title = 'CampusTrace — Home';
    else if (path === '/listings') title = 'CampusTrace — Explore';
    else if (path === '/my-reports') title = 'CampusTrace — My Reports';
    else if (path === '/claims') title = 'CampusTrace — Ownership Claims';
    else if (path === '/custody') title = 'CampusTrace — Custody Queue';
    else if (path === '/admin') title = 'CampusTrace — Admin Dashboard';
    else if (path === '/profile') title = 'CampusTrace — Profile';
    else if (path === '/login') title = 'CampusTrace — Sign In';
    else if (path.startsWith('/reports/')) title = 'CampusTrace — Report Details';
    else if (path === '/report/lost') title = 'CampusTrace — Report Lost Item';
    else if (path === '/report/found') title = 'CampusTrace — Register Found Item';
    document.title = title;
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Destination 1: Home Screen */}
      <Route
        path="/"
        element={
          <ProtectedLayout>
            <HomeScreen />
          </ProtectedLayout>
        }
      />

      {/* Destination 2: Explore / Listings */}
      <Route
        path="/listings"
        element={
          <ProtectedLayout>
            <ListingsPage />
          </ProtectedLayout>
        }
      />

      {/* Destination 4: My Items / My Reports */}
      <Route
        path="/my-reports"
        element={
          <ProtectedLayout>
            <MyReportsPage />
          </ProtectedLayout>
        }
      />

      {/* Destination 5: Profile & Settings */}
      <Route
        path="/profile"
        element={
          <ProtectedLayout>
            <ProfilePage />
          </ProtectedLayout>
        }
      />

      {/* Report Detail View */}
      <Route
        path="/reports/:id"
        element={
          <ProtectedLayout>
            <ReportDetailPage />
          </ProtectedLayout>
        }
      />

      {/* AI Matching Removed - Redirect /matches to /listings */}
      <Route
        path="/matches"
        element={<Navigate to="/listings" replace />}
      />

      {/* Claims View */}
      <Route
        path="/claims"
        element={
          <ProtectedLayout>
            <ClaimsPage />
          </ProtectedLayout>
        }
      />

      {/* Teacher Custody Queue */}
      <Route
        path="/custody"
        element={
          <ProtectedLayout>
            <RoleGuard allowedRoles={['TEACHER', 'COLLEGE_ADMIN', 'PLATFORM_ADMIN', 'ADMIN']}>
              <CustodyPage />
            </RoleGuard>
          </ProtectedLayout>
        }
      />

      {/* Admin View */}
      <Route
        path="/admin"
        element={
          <ProtectedLayout>
            <RoleGuard allowedRoles={['COLLEGE_ADMIN', 'PLATFORM_ADMIN', 'ADMIN']}>
              <AdminPage />
            </RoleGuard>
          </ProtectedLayout>
        }
      />

      {/* Backward-compatibility redirects for existing notification URLs */}
      <Route path="/claims/:id" element={<Navigate to="/claims" replace />} />
      <Route path="/teacher/claims/:id" element={<Navigate to="/claims" replace />} />
      <Route
        path="/teacher/reports/:id"
        element={
          <ProtectedLayout>
            <ReportDetailPage />
          </ProtectedLayout>
        }
      />

      {/* Direct Report Fallback Forms */}
      <Route
        path="/report/lost"
        element={
          <ProtectedLayout>
            <CreateReportPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/report/found"
        element={
          <ProtectedLayout>
            <CreateReportPage />
          </ProtectedLayout>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ReportFlowProvider>
            <AppContent />
          </ReportFlowProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
