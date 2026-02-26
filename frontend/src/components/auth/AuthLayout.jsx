import { useState } from 'react';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import styles from './auth.module.css';

function AuthLayout() {
  const [activeView, setActiveView] = useState('login');

  return (
    <div className={styles.authWrap}>
      <div className={styles.card}>
        {activeView === 'login'    && <Login          onSwitchView={setActiveView} />}
        {activeView === 'register' && <Register       onSwitchView={setActiveView} />}
        {activeView === 'forgot'   && <ForgotPassword onSwitchView={setActiveView} />}
      </div>
    </div>
  );
}

export default AuthLayout;
