'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { normalizePhone } from '@/lib/phone';

function CopyBox({ label, value, rows = 1 }: { label: string; value: string; rows?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">{label}</span>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
          className="text-xs font-semibold text-sky-400 hover:underline"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <textarea readOnly rows={rows} value={value} aria-label={label} className="w-full rounded-lg border border-gray-600 p-2 font-mono text-xs" onFocus={(e) => e.target.select()} />
    </div>
  );
}

export default function LeadCapturePage() {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('Hello, I would like to know more about your services.');

  useEffect(() => {
    fetch('/api/billing', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setSlug(d.organization?.slug || '');
        setName(d.organization?.name || '');
      })
      .catch(() => {});
  }, []);

  const endpoint = typeof window !== 'undefined' && slug ? `${window.location.origin}/api/public/lead?workspace=${slug}` : '';
  const snippet = useMemo(
    () => `<!-- ${name || 'VersalyLabs'} enquiry form: new enquiries arrive in VersalyLabs CRM as leads -->
<form id="vl-lead-form" style="display:grid;gap:8px;max-width:420px">
  <input name="name" placeholder="Your name" required>
  <input name="phone" placeholder="Phone / WhatsApp" type="tel">
  <input name="email" placeholder="Email" type="email">
  <textarea name="message" placeholder="How can we help?"></textarea>
  <button type="submit">Send</button>
  <p id="vl-lead-msg" role="status"></p>
</form>
<script>
document.getElementById('vl-lead-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var f = new FormData(this), msg = document.getElementById('vl-lead-msg');
  if (!f.get('phone') && !f.get('email')) { msg.textContent = 'Please add a phone number or email.'; return; }
  var res = await fetch('${endpoint}', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: f.get('name'), phone: f.get('phone'), email: f.get('email'), message: f.get('message') }) });
  var data = await res.json().catch(function () { return {}; });
  msg.textContent = res.ok ? 'Thank you! We will get back to you shortly.' : (data.error || 'Something went wrong. Please try again.');
  if (res.ok) this.reset();
});
</script>`,
    [endpoint, name]
  );

  const waNumber = normalizePhone(phone);
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}` : '';

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div>
        <Link href="/settings" className="text-sm font-semibold text-sky-400 hover:underline">← Settings</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Lead capture</h1>
        <p className="mt-1 text-sm text-gray-400">Turn website visitors and WhatsApp chats into leads automatically.</p>
      </div>

      <section className="space-y-4 rounded-2xl border border-gray-700 p-5">
        <div>
          <h2 className="text-base font-bold text-white">Website enquiry form</h2>
          <p className="mt-1 text-sm text-gray-400">
            Paste this into any page of your website (WordPress: add a &quot;Custom HTML&quot; block). Each enquiry becomes a lead here, is assigned to a team
            member and gets a follow-up task.
          </p>
        </div>
        {slug ? <CopyBox label="Form code" value={snippet} rows={14} /> : <p className="text-sm text-gray-400">Loading…</p>}
        {endpoint && <CopyBox label="Form address (for developers or form tools such as Zapier)" value={endpoint} />}
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-700 p-5">
        <div>
          <h2 className="text-base font-bold text-white">WhatsApp click-to-chat link</h2>
          <p className="mt-1 text-sm text-gray-400">Put this link on Instagram, Facebook, posters or your website so customers can message you in one tap.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-300">
            Your WhatsApp number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" type="tel" className="mt-1 w-full rounded-lg border border-gray-600 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm text-gray-300">
            Message the customer starts with
            <input value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-600 px-3 py-2 text-sm" />
          </label>
        </div>
        {phone && !waNumber && <p className="text-xs text-amber-300">Enter a valid phone number, for example 0712 345 678.</p>}
        {waLink && (
          <>
            <CopyBox label="Your link" value={waLink} />
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-sky-400 underline">Test the link</a>
          </>
        )}
      </section>
    </div>
  );
}
