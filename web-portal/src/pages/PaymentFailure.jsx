import StatusCard from '../components/StatusCard';

export default function PaymentFailure() {
  return (
    <StatusCard
      type="failure"
      title="Payment Failed"
      message="Payment could not be processed. Please try again from the Orvyn app."
      hint="If the issue persists, check your payment method or contact your bank."
    />
  );
}
