import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './lib/api';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UserListPage from './pages/users/UserListPage';
import UserDetailPage from './pages/users/UserDetailPage';
import PromoListPage from './pages/promo-codes/PromoListPage';
import PromoCreatePage from './pages/promo-codes/PromoCreatePage';
import SubListPage from './pages/subscriptions/SubListPage';
import OrgListPage from './pages/organizations/OrgListPage';
import OrgDetailPage from './pages/organizations/OrgDetailPage';
import AuditLogPage from './pages/audit-logs/AuditLogPage';
import BrowserPage from './pages/database/BrowserPage';
import CollabListPage from './pages/collaborations/CollabListPage';
import BroadcastPage from './pages/notifications/BroadcastPage';
import HealthPage from './pages/system/HealthPage';
import ExportPage from './pages/export/ExportPage';
import DataRoomListPage from './pages/shared-datarooms/DataRoomListPage';

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="users" element={<UserListPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="promo-codes" element={<PromoListPage />} />
          <Route path="promo-codes/create" element={<PromoCreatePage />} />
          <Route path="subscriptions" element={<SubListPage />} />
          <Route path="organizations" element={<OrgListPage />} />
          <Route path="organizations/:id" element={<OrgDetailPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="database" element={<BrowserPage />} />
          <Route path="database/:collection" element={<BrowserPage />} />
          <Route path="collaborations" element={<CollabListPage />} />
          <Route path="notifications/broadcast" element={<BroadcastPage />} />
          <Route path="system-health" element={<HealthPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="shared-datarooms" element={<DataRoomListPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
