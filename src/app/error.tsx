'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <h1 className="text-3xl font-extrabold text-white">Something went wrong</h1>
      <p className="mt-3 max-w-md text-base text-sky-100/75">
        This page hit an unexpected error. Try again, and if it keeps happening, contact support
        {error.digest ? ` with reference ${error.digest}` : ''}.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-primary px-5 py-2.5 text-sm">Try again</button>
        <Link href="/dashboard" className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
