import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AdminAuthProvider, useAdminAuth } from '@/context/AdminAuthContext';
import { LoginPage } from '@/screens/auth/LoginPage';
import { SignUpPage } from '@/screens/auth/SignUpPage';
import { DashboardLayout } from '@/screens/dashboard/DashboardLayout';
import { ProductsScreen } from '@/screens/dashboard/ProductsScreen';
import { TeamScreen } from '@/screens/dashboard/TeamScreen';
import { WalletScreen } from '@/screens/dashboard/WalletScreen';
import { RedeemGiftScreen } from '@/screens/dashboard/RedeemGiftScreen';
import { AdminLogin } from '@/screens/admin/AdminLogin';
import { AdminDashboard } from '@/screens/admin/AdminDashboard';
import { DepositCallback } from '@/screens/dashboard/DepositCallback';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin } = useAdminAuth();
  if (!admin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Public auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />

            {/* Paystack callback — MUST be a top-level route */}
            <Route path="/deposit-callback" element={<DepositCallback />} />

            {/* User app routes — nested under /app */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ProductsScreen />} />
              <Route path="products" element={<ProductsScreen />} />
              <Route path="gift" element={<RedeemGiftScreen />} />
              <Route path="team" element={<TeamScreen />} />
              <Route path="wallet" element={<WalletScreen />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/dashboard"
              element={
                <AdminProtectedRoute>
                  <AdminDashboard />
                </AdminProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </AuthProvider>
  );
}