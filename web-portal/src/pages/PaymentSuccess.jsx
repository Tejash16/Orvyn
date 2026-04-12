import StatusCard from '../components/StatusCard';

export default function PaymentSuccess() {
  return (
    <StatusCard
      type="success"
      title="Payment Successful"
      message="Your subscription is now active. You can close this tab and return to Orvyn."
      hint="The Orvyn app will automatically detect the upgrade."
    />
  );
}
