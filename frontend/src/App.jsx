import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginSuccess, restoreComplete, logout } from './store/authSlice';
import { setTheme, setOnline } from './store/uiSlice';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import SettingsPage from './pages/setting';
import AuthPage from './pages/AuthPage';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import './App.css';

function App() {
  const dispatch        = useDispatch();
  const theme           = useSelector((state) => state.ui.theme);
  const activePage      = useSelector((state) => state.ui.activePage);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isRestoring     = useSelector((state) => state.auth.isRestoring);
  const isOnline        = useSelector((state) => state.ui.isOnline);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.api.auth.restoreSession();
        if (result.success) {
          dispatch(loginSuccess(result.user));
          dispatch(setTheme(result.theme ?? 'light'));
        }
      } finally {
        dispatch(restoreComplete());
      }
    })();
  }, [dispatch]);

  useEffect(() => {
    const cleanup = window.api.auth.onSessionExpired(() => {
      dispatch(logout());
    });
    return cleanup;
  }, [dispatch]);

  useEffect(() => {
    const cleanup = window.api.app.onOfflineStatus((online) => {
      dispatch(setOnline(online));
    });
    return cleanup;
  }, [dispatch]);

  return (
    <div className="app-shell" data-theme={theme}>
      {!isOnline && (
        <div className="offline-banner" role="status">
          Offline — server unreachable. Local data is read-only.
        </div>
      )}

      <Header />

      {window.location.pathname.startsWith('/verify-email') ? (
        <VerifyEmail />
      ) : window.location.pathname.startsWith('/reset-password') ? (
        <ResetPassword />
      ) : isRestoring ? (
        <div className="app-loading" aria-label="Loading">
          <span className="app-loading-dot" />
          <span className="app-loading-dot" />
          <span className="app-loading-dot" />
        </div>
      ) : isAuthenticated ? (
        <div className="app-body">
          <Sidebar />
          <main className="app-content">
            {activePage === 'settings' && <SettingsPage />}
          </main>
        </div>
      ) : (
        <AuthPage />
      )}

    </div>
  );
}

export default App;
