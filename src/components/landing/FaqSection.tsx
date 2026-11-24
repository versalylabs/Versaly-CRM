'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

// Answers must describe what the product does today; mark anything planned as coming soon.
const FAQS = [
  {
    question: 'How does the 14-day free trial work?',
    answer:
      'You get 14 days of full access on the plan you choose, and no credit card is needed to start. Invite your team, connect your email and WhatsApp, build your pipeline and try automations before you decide.',
  },
  {
    question: 'How do I pay? Can I pay in Kenyan shillings?',
    answer:
      'Our prices are set in Kenyan shillings. You can pay by card today, and M-Pesa payments are coming soon. If you need an invoice for your accounts team, contact us.',
  },
  {
    question: 'How does the WhatsApp integration work?',
    answer:
      "You connect your WhatsApp Business number through the WhatsApp Cloud API from Meta. Messages your team sends, and replies from customers, appear in the shared inbox and on each lead's timeline. A simpler one-click connection is coming soon.",
  },
  {
    question: 'Is our company data private?',
    answer:
      "Yes. Each workspace's data is kept separate and is only visible to the people you invite. Passwords and app credentials for your connected email and WhatsApp accounts are encrypted. Our privacy policy explains how we handle your data.",
  },
  {
    question: 'Can I import my existing leads from Excel or another CRM?',
    answer:
      'Self-service CSV and Excel import is coming soon. Until then, contact us and we will help you move your contacts across. Developers can also add leads through our API.',
  },
  {
    question: 'Can we change plans or cancel at any time?',
    answer:
      'Yes. Workspace admins can change plans in Settings → Billing and cancel at any time. There are no cancellation fees.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section id="faqs" className="relative px-5 py-10 lg:py-12 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/60 px-3.5 py-1 text-xs font-semibold text-sky-300">
            <HelpCircle className="h-3.5 w-3.5 text-sky-400" /> Got Questions?
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-base text-sky-200/70">
            Everything you need to know before you start.
          </p>
        </div>

        {/* FAQ Accordion List with Level 2 Glass */}
        <div className="relative overflow-hidden mt-8 divide-y divide-white/10 rounded-3xl border border-white/[0.12] bg-ink-700/60 p-5 sm:p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.14)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div key={index} className="py-5 first:pt-0 last:pb-0">
                <button
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between text-left text-base font-bold text-white transition-colors hover:text-sky-300 sm:text-lg"
                >
                  <span className="pr-4">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-400"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="mt-3 text-sm leading-relaxed text-sky-200/80 sm:text-base">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
