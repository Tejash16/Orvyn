export default function PortalCard({ children, className = '' }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] max-w-[460px] w-full px-9 py-10 text-center ${className}`}
    >
      {children}
    </div>
  );
}
