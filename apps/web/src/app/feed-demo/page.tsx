'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FeedDemoPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?pwa=true');
  }, [router]);

  return null;
}
