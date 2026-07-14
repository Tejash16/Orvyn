import PortalCard from '../components/PortalCard';
import BrandHeader from '../components/BrandHeader';

export default function NotFound() {
  return (
    <PortalCard>
      <BrandHeader />
      <h1 className="text-xl font-bold text-zinc-900 mb-3">Page Not Found</h1>
      <p className="text-sm text-zinc-500">
        The page you're looking for doesn't exist or has expired.
      </p>
    </PortalCard>
  );
}
