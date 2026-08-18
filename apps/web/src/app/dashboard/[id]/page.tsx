'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardDetailPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?pwa=true');
  }, [router]);

  return null;
}
