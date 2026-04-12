import { CheckCircle, XCircle } from 'lucide-react';

export default function StatusCard({ type = 'success', title, message, hint }) {
  const isSuccess = type === 'success';

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] max-w-[440px] w-full p-12 text-center">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border-2 ${
          isSuccess
            ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}
      >
        {isSuccess ? (
          <CheckCircle className="w-8 h-8" />
        ) : (
          <XCircle className="w-8 h-8" />
        )}
      </div>
      <h1
        className={`text-2xl font-bold mb-3 ${
          isSuccess ? 'text-emerald-600' : 'text-red-600'
        }`}
      >
        {title}
      </h1>
      {message && (
        <p className="text-[15px] text-zinc-600 leading-relaxed mb-2">{message}</p>
      )}
      {hint && (
        <p className="text-[13px] text-zinc-400 leading-relaxed">{hint}</p>
      )}
    </div>
  );
}
