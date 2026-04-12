import { ExternalLink } from 'lucide-react';

export default function DeepLinkButton({ href, children = 'Open in Orvyn' }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 bg-emerald-600 text-white rounded-[10px] text-base font-semibold no-underline transition-all duration-200 hover:bg-emerald-700 active:scale-[0.98]"
    >
      <ExternalLink className="w-[18px] h-[18px]" />
      {children}
    </a>
  );
}
