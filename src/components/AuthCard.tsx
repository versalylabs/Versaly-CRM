import Link from 'next/link';
import VersalyLabsLogo from '@/components/VersalyLabsLogo';

/** Shared frame for the small account pages (forgot/reset password, verify email). */
export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block">
            <VersalyLabsLogo size={52} className="mx-auto rounded-2xl" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-7 shadow-xl">{children}</div>
        <p className="text-center text-sm text-gray-400">
          <Link href="/auth/signin" className="font-semibold text-sky-400 hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}

export const authInputClass =
  'w-full rounded-xl border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30';
export const authButtonClass =
  'w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 py-3 text-sm font-bold text-white shadow-lg transition hover:from-sky-500 hover:to-sky-600 disabled:opacity-50';
