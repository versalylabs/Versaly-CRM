import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help centre',
  description: 'Short guides for getting started with VersalyLabs CRM: importing leads, pipelines, custom fields, your team and billing.',
};

const WHATSAPP = 'https://wa.me/254704611033?text=' + encodeURIComponent('Hi VersalyLabs, I need help with my CRM account.');

const TOPICS: { heading: string; articles: { q: string; a: React.ReactNode }[] }[] = [
  {
    heading: 'Getting started',
    articles: [
      {
        q: 'How do I set up my workspace?',
        a: (
          <p>
            After you sign up, the setup wizard asks for your industry and creates a pipeline that fits it (for example real estate, schools or car
            dealers). You can rename, add or remove stages at any time under <strong>Settings → Pipeline</strong>.
          </p>
        ),
      },
      {
        q: 'How do I add my first leads?',
        a: (
          <p>
            Open <strong>Leads</strong> and choose <strong>Add lead</strong>, or bring in everyone at once with <strong>Import CSV</strong>. You can
            also share your lead capture link or WhatsApp link from <strong>Settings → Lead capture</strong> so new enquiries arrive on their own.
          </p>
        ),
      },
    ],
  },
  {
    heading: 'Leads and pipeline',
    articles: [
      {
        q: 'How do I import contacts from Excel or Google Sheets?',
        a: (
          <ol>
            <li>In Excel choose File → Save as → CSV. In Google Sheets choose File → Download → CSV.</li>
            <li>Go to Leads → Import CSV and pick the file.</li>
            <li>Match each column to a lead field. Each lead needs a name and an email or phone number.</li>
            <li>Contacts already in your CRM are skipped, and you can download the skipped rows to fix them.</li>
          </ol>
        ),
      },
      {
        q: 'How do I update many leads at once?',
        a: (
          <p>
            Admins and managers can tick the boxes next to leads in the Leads list, then assign them to a team member, move them to a stage or delete them
            in one step.
          </p>
        ),
      },
      {
        q: 'Can I track details specific to my business?',
        a: (
          <p>
            Yes. Under <strong>Settings → Custom fields</strong> add fields such as budget, plot size or car model. They show on every lead and can be
            filled from a spreadsheet import. Custom fields are included from the Starter plan.
          </p>
        ),
      },
    ],
  },
  {
    heading: 'Your team',
    articles: [
      {
        q: 'How do I invite my team?',
        a: (
          <p>
            Admins can invite people from <strong>Settings → Team</strong>. Each person gets an email to set their password. Your plan sets how many team
            members you can have.
          </p>
        ),
      },
      {
        q: 'What can each role do?',
        a: (
          <p>
            Admins manage billing, the team and all settings. Managers can import, bulk-edit and set up custom fields. Sales reps work on leads,
            tasks and conversations.
          </p>
        ),
      },
    ],
  },
  {
    heading: 'Billing',
    articles: [
      {
        q: 'How do I pay?',
        a: (
          <p>
            Go to <strong>Settings → Billing</strong>, choose a plan and pay by M-Pesa or card. A receipt is saved under Billing after every payment. Paying
            yearly costs less than paying monthly.
          </p>
        ),
      },
      {
        q: 'What happens if my subscription ends?',
        a: (
          <p>
            Your data stays safe and you can still view it, but adding or changing records is paused until you renew. Renewing restores full access
            straight away.
          </p>
        ),
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-ink-850 px-5 py-12 text-sky-100/90">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-sky-300 hover:text-white">← Back to VersalyLabs</Link>
        <h1 className="mt-6 text-3xl font-extrabold text-white sm:text-4xl">Help centre</h1>
        <p className="mt-2 text-base">Quick answers for running your business on VersalyLabs CRM.</p>

        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-bold text-[#051f20] hover:opacity-90"
        >
          Chat with us on WhatsApp
        </a>
        <p className="mt-2 text-sm text-sky-300/80">
          Or call 0704 611 033, or email <a className="underline hover:text-white" href="mailto:versalylabs@gmail.com">versalylabs@gmail.com</a>.
        </p>

        {TOPICS.map((topic) => (
          <section key={topic.heading} className="mt-10">
            <h2 className="text-xl font-bold text-white">{topic.heading}</h2>
            <div className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
              {topic.articles.map((article) => (
                <details key={article.q} className="group p-4">
                  <summary className="cursor-pointer list-none font-semibold text-white marker:hidden">
                    <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden>›</span>
                    {article.q}
                  </summary>
                  <div className="mt-3 space-y-2 pl-5 text-base leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5">{article.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
