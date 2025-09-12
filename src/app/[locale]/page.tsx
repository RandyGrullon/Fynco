"use client";

import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const t = useTranslations('common');

  useEffect(() => {
    if (!loading) {
        if (user) {
            router.replace('/dashboard');
        } else {
            router.replace('/login');
        }
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <svg
          className="h-12 w-12 animate-spin text-primary"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    </div>
  );
}
