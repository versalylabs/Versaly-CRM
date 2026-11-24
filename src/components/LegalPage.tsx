import Link from 'next/link';

export type LegalSection = { heading: string; body: React.ReactNode };

export default function LegalPage({ title, updated, intro, sections }: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-[#14213d] px-5 py-12 text-sky-100/90">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-sky-300 hover:text-white">← Back to VersalyLabs</Link>
        <h1 className="mt-6 text-3xl font-extrabold text-white sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-sky-300/80">Last updated: {updated}</p>
        <div className="mt-6 space-y-4 text-base leading-relaxed">{intro}</div>
        {sections.map((s, i) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-xl font-bold text-white">{i + 1}. {s.heading}</h2>
            <div className="mt-3 space-y-3 text-base leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">{s.body}</div>
          </section>
        ))}
        <p className="mt-12 border-t border-white/10 pt-6 text-sm text-sky-300/80">
          Questions? Email <a className="underline hover:text-white" href="mailto:versalylabs@gmail.com">versalylabs@gmail.com</a> or
          call 0704 611 033. See also our{' '}
          <Link className="underline hover:text-white" href={title.startsWith('Privacy') ? '/terms' : '/privacy'}>
            {title.startsWith('Privacy') ? 'Terms of Service' : 'Privacy Policy'}
          </Link>.
        </p>
      </article>
    </div>
  );
}
