import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard, Lock, Loader2 } from 'lucide-react';
import BrandHeader from '../components/BrandHeader';
import PortalCard from '../components/PortalCard';

function decodeCheckoutToken(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

export default function CheckoutPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const rzpRef = useRef(null);

  useEffect(() => {
    const decoded = decodeCheckoutToken(token);
    if (!decoded) {
      setError('Invalid or expired checkout link. Please start a new checkout from the Orvyn app.');
      return;
    }
    // Check expiry
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      setError('This checkout link has expired. Please start a new checkout from the Orvyn app.');
      return;
    }
    setPlan(decoded);
  }, [token]);

  useEffect(() => {
    // Load Razorpay script
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handlePay = () => {
    if (!window.Razorpay || !plan) return;
    setPaying(true);

    const options = {
      key: plan.razorpayKeyId,
      subscription_id: plan.subscriptionId,
      name: 'Orvyn',
      description: plan.planDescription,
      handler: () => {
        navigate(`/checkout/success?subscription_id=${plan.subscriptionId}`);
      },
      prefill: {
        email: plan.userEmail,
        name: plan.userName,
      },
      theme: { color: '#059669' },
      modal: {
        ondismiss: () => setPaying(false),
      },
    };

    rzpRef.current = new window.Razorpay(options);
    rzpRef.current.open();
  };

  if (error) {
    return (
      <PortalCard>
        <BrandHeader subtitle="Secure Checkout" />
        <p className="text-red-600 text-[15px] leading-relaxed">{error}</p>
      </PortalCard>
    );
  }

  if (!plan) {
    return (
      <PortalCard>
        <BrandHeader subtitle="Secure Checkout" />
        <div className="py-8">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
        </div>
      </PortalCard>
    );
  }

  return (
    <PortalCard>
      <BrandHeader subtitle="Secure Checkout" />

      {/* Plan details */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-6 mb-7">
        <h1 className="text-xl font-bold text-zinc-900 mb-2">
          Upgrade to Orvyn {plan.planName}
        </h1>
        <p className="text-[32px] font-extrabold text-emerald-600 mb-2">
          {plan.formattedPrice}
          <span className="text-base font-medium text-zinc-500">/month</span>
        </p>
        <p className="text-sm text-zinc-600 leading-relaxed">{plan.planDescription}</p>
      </div>

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={paying}
        className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 bg-emerald-600 text-white rounded-[10px] text-base font-semibold border-none cursor-pointer transition-all duration-200 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mb-4"
      >
        {paying ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <CreditCard className="w-5 h-5" />
        )}
        {paying ? 'Processing...' : 'Pay with Razorpay'}
      </button>

      {/* Security note */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400">
        <Lock className="w-3.5 h-3.5" />
        <span>Secured by Razorpay. We never store your card details.</span>
      </div>
    </PortalCard>
  );
}
