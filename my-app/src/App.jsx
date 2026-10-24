import { lazy, Suspense, useState } from 'react';
import LandingPage from './LandingPage';

const WaterBillInquiry = lazy(() => import('./WaterBillInquiry'));

export default function App() {
  const [showBillPortal, setShowBillPortal] = useState(false);

  return showBillPortal ? (
    <Suspense fallback={<p className="p-6 text-center font-sans">Opening bill search...</p>}>
      <WaterBillInquiry onBack={() => setShowBillPortal(false)} />
    </Suspense>
  ) : (
    <LandingPage onSearchBill={() => setShowBillPortal(true)} />
  );
}