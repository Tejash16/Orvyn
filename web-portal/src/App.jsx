import { BrowserRouter, Routes, Route } from 'react-router-dom';
import InvitePage from './pages/InvitePage';
import GoogleAuthCallback from './pages/GoogleAuthCallback';
import CheckoutPage from './pages/CheckoutPage';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailure from './pages/PaymentFailure';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter basename="/portal">
      <Routes>
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
        <Route path="/checkout/:token" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<PaymentSuccess />} />
        <Route path="/checkout/failure" element={<PaymentFailure />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
