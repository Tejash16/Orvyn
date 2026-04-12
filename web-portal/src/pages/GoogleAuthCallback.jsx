import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import BrandHeader from '../components/BrandHeader';
import PortalCard from '../components/PortalCard';
import DeepLinkButton from '../components/DeepLinkButton';
import { apiFetch } from '../lib/api';

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading | success | error | linking
  const [error, setError] = useState(null);
  const [authData, setAuthData] = useState(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setError(
        errorParam === 'access_denied'
          ? 'You declined the Google sign-in request.'
          : `Google returned an error: ${errorParam}`
      );
      return;
    }

    if (!code) {
      setStatus('error');
      setError('No authorization code received from Google.');
      return;
    }

    // Exchange the code with Express backend
    apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        code,
        redirectUri: window.location.origin + '/portal/auth/google/callback',
      }),
    })
      .then((data) => {
        if (data.requiresLinking) {
          // Account linking needed — pass info back to desktop app
          setStatus('linking');
          setAuthData(data);
        } else {
          // Success — create deep link token
          setStatus('success');
          setAuthData(data);
        }
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Authentication failed. Please try again.');
      });
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <PortalCard>
        <BrandHeader subtitle="Signing In" />
        <div className="py-8 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm text-zinc-500">Completing Google sign-in...</p>
        </div>
      </PortalCard>
    );
  }

  if (status === 'error') {
    return (
      <PortalCard>
        <BrandHeader subtitle="Sign In" />
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-red-50 border-2 border-red-200 text-red-600">
          <XCircle className="w-8 h-8" />
        </div>
        <h1 className="text-[22px] font-bold text-red-600 mb-3">Sign-in Failed</h1>
        <p className="text-[15px] text-zinc-600 leading-relaxed mb-2">{error}</p>
        <p className="text-[13px] text-zinc-400 leading-relaxed">
          Please close this tab and try again from the Orvyn app.
        </p>
      </PortalCard>
    );
  }

  if (status === 'linking') {
    // Requires linking — redirect to desktop app with linking info
    const deepLink = `orvyn://auth/google?action=link&email=${encodeURIComponent(authData.email)}&googleId=${encodeURIComponent(authData.googleId)}&picture=${encodeURIComponent(authData.picture || '')}`;

    return (
      <PortalCard>
        <BrandHeader subtitle="Account Linking Required" />
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-amber-50 border-2 border-amber-200 text-amber-600">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-zinc-900 mb-3">Link Your Account</h1>
        <p className="text-[15px] text-zinc-600 leading-relaxed mb-6">
          An account with <strong>{authData.email}</strong> already exists. Open Orvyn to verify your password and link your Google account.
        </p>
        <DeepLinkButton href={deepLink}>Continue in Orvyn</DeepLinkButton>
      </PortalCard>
    );
  }

  // Success — provide deep link with auth token
  const deepLink = `orvyn://auth/google?action=login&token=${encodeURIComponent(authData.accessToken)}&refreshToken=${encodeURIComponent(authData.refreshToken)}&isNewUser=${authData.isNewUser || false}`;

  return (
    <PortalCard>
      <BrandHeader subtitle="Sign In" />
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-emerald-50 border-2 border-emerald-200 text-emerald-600">
        <CheckCircle className="w-8 h-8" />
      </div>
      <h1 className="text-[22px] font-bold text-emerald-600 mb-3">You're all set!</h1>
      <p className="text-[15px] text-zinc-600 leading-relaxed mb-6">
        Google sign-in successful. Click below to continue in Orvyn.
      </p>
      <DeepLinkButton href={deepLink} />
      <p className="text-[13px] text-zinc-400 leading-relaxed mt-4">
        This tab will close automatically when Orvyn opens.
      </p>
    </PortalCard>
  );
}
