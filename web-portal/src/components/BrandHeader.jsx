export default function BrandHeader({ subtitle }) {
  return (
    <div className="mb-7 text-center">
      <div className="text-[28px] font-extrabold text-emerald-600 tracking-wide mb-1">
        Orvyn
      </div>
      {subtitle && (
        <p className="text-[13px] text-zinc-400 uppercase tracking-[1.5px] font-medium">
          {subtitle}
        </p>
      )}
    </div>
  );
}
