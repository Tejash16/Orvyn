import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Check, XCircle, Link } from 'lucide-react';
import BrandHeader from '../components/BrandHeader';
import PortalCard from '../components/PortalCard';
import DeepLinkButton from '../components/DeepLinkButton';
import { apiFetch } from '../lib/api';

export default function InvitePage() {
  const { code } = useParams();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch(`/organizations/invites/${code}`)
      .then((data) => setInvite(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (loading) {
    return (
      <PortalCard>
        <BrandHeader subtitle="Organization Invite" />
        <div className="py-8">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </PortalCard>
    );
  }

  if (error) {
    return (
      <PortalCard>
        <BrandHeader subtitle="Organization Invite" />
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-red-50 border-2 border-red-200 text-red-600">
          <XCircle className="w-8 h-8" />
        </div>
        <h1 className="text-[22px] font-bold text-red-600 mb-3">Invite unavailable</h1>
        <p className="text-[15px] text-zinc-600 leading-relaxed mb-2">{error}</p>
        <p className="text-[13px] text-zinc-400 leading-relaxed">
          Ask your team admin to send a new invite.
        </p>
      </PortalCard>
    );
  }

  const deepLink = `orvyn://invite?code=${code}`;

  return (
    <PortalCard>
      <BrandHeader subtitle="Organization Invite" />

      {/* Invite details card */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl px-6 py-7 mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-[1.5px] font-semibold mb-2">
          You've been invited to join
        </p>
        <h1 className="text-[26px] font-extrabold text-zinc-900 mb-2.5 leading-tight break-words">
          {invite.orgName}
        </h1>
        <p className="text-sm text-zinc-600 leading-relaxed mb-2.5">
          by <strong className="text-zinc-900 font-semibold">{invite.inviterName}</strong> as{' '}
          <strong className="text-zinc-900 font-semibold">{invite.role}</strong>
        </p>
        <p className="text-xs text-zinc-400">
          Expires on {new Date(invite.expiresAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      <DeepLinkButton href={deepLink} />

      {/* Divider */}
      <div className="flex items-center gap-3 my-5 text-zinc-400 text-xs uppercase tracking-[1.5px]">
        <div className="flex-1 h-px bg-zinc-200" />
        <span>or</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>

      {/* Manual code entry */}
      <div className="bg-zinc-100 border border-zinc-200 rounded-[10px] px-4 py-4 mb-5">
        <p className="text-xs text-zinc-500 uppercase tracking-[1px] font-medium mb-2.5">
          Enter this code manually in Orvyn
        </p>
        <div className="flex items-center gap-2.5 justify-center">
          <code className="font-mono text-sm text-emerald-600 bg-white px-3 py-2 rounded-md border border-zinc-300 tracking-wider break-all flex-1 text-left">
            {code}
          </code>
          <button
            onClick={handleCopy}
            aria-label="Copy code"
            className={`inline-flex items-center justify-center w-9 h-9 rounded-md border cursor-pointer transition-all duration-150 shrink-0 ${
              copied
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <p className="text-[13px] text-zinc-500 leading-relaxed">
        Don't have Orvyn installed?{' '}
        <a
          href="https://orvyn.app/download"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 font-semibold no-underline hover:underline"
        >
          Download for Windows
        </a>
      </p>
    </PortalCard>
  );
}
