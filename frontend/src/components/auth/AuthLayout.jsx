import { useState } from 'react';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import VerifyCode from './VerifyCode';
import styles from './auth.module.css';

function AuthLayout() {
  const [activeView, setActiveView] = useState('login');
  const [verifyEmail, setVerifyEmail] = useState('');

  function handleSwitchView(view, email) {
    setActiveView(view);
    if (view === 'verify' && email) {
      setVerifyEmail(email);
    }
  }

  return (
    <div className={styles.authWrap}>
      <div className={styles.card}>
        {activeView === 'login'    && <Login          onSwitchView={handleSwitchView} />}
        {activeView === 'register' && <Register       onSwitchView={handleSwitchView} />}
        {activeView === 'forgot'   && <ForgotPassword onSwitchView={handleSwitchView} />}
        {activeView === 'verify'   && <VerifyCode     email={verifyEmail} onSwitchView={handleSwitchView} />}
      </div>
    </div>
  );
}

export default AuthLayout;
