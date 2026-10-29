import { Suspense } from 'react';
import { OMRWorkspace } from '@/components/omr-workspace';

export default function OMRPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading OMR Studio...</div>}>
      <OMRWorkspace />
    </Suspense>
  );
}
