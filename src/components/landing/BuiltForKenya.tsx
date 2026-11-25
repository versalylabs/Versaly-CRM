'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Inbox, BellRing, KanbanSquare, Users, Clock } from 'lucide-react';

// Only describe features that work today. Planned features belong in COMING_NEXT.
const POINTS = [
  {
    icon: Inbox,
    title: 'Every enquiry in one inbox',
    body: 'Email and WhatsApp conversations land in a shared team inbox, where each one is assigned to the right person.',
  },
  {
    icon: BellRing,
    title: 'Follow-ups that actually happen',
    body: 'Automations create tasks, move deals and flag leads that have gone quiet, so nobody is forgotten.',
  },
  {
    icon: KanbanSquare,
    title: 'Your pipeline, in shillings',
    body: 'See every deal and its value in KES, using stages that match how your business sells.',
  },
  {
    icon: Users,
    title: 'The right access for each person',
    body: 'Admin, manager and agent roles: agents see their own work, and managers see the whole team.',
  },
];

const COMING_NEXT = ['AI reply assistant', 'Installable mobile app', 'Multi-branch workspaces'];

export function BuiltForKenya() {
  return (
    <section id="why" className="relative px-5 py-10 lg:py-12 lg:px-8 border-y border-sky-500/15 bg-ink-900/60">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Built for how Kenyan businesses sell.
          </h2>
          <p className="mt-3 text-base text-sky-200/75 sm:text-lg">
            Your customers message you on WhatsApp and expect fast replies. VersalyLabs keeps every lead, chat and
            follow-up in one place, so no sale slips through the cracks.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-2xl border border-white/[0.1] bg-ink-800/60 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
            >
              <p.icon className="h-6 w-6 text-sky-400" aria-hidden="true" />
              <h3 className="mt-3 text-base font-bold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sky-100/75">{p.body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-sky-200/75">
          <span className="inline-flex items-center gap-1.5 font-semibold text-sky-300">
            <Clock className="h-4 w-4" aria-hidden="true" /> Coming next:
          </span>
          {COMING_NEXT.map((item) => (
            <span key={item} className="rounded-full border border-white/10 px-3 py-1">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
