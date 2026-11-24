import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-sky-400">404</p>
      <h1 className="mt-2 text-3xl font-extrabold text-white">Page not found</h1>
      <p className="mt-3 max-w-md text-base text-sky-100/75">
        The page you are looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/dashboard" className="btn-primary px-5 py-2.5 text-sm">Go to dashboard</Link>
        <Link href="/" className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
          Home page
        </Link>
      </div>
    </div>
  );
}
