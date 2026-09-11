'use client';

import { Suspense } from 'react';
import { MeiPricingPlans } from '@/components/onboarding/MeiPricingPlans';
import { LoadingPanel } from '@/components/ui/LoadingPanel';

export default function PlanosPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Carregando planos…" />}>
      <MeiPricingPlans />
    </Suspense>
  );
}
