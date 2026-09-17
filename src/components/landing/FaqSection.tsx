'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
  {
    question: 'How does the 14-day free trial work?',
    answer:
      'You get complete, unrestricted access to the Growth Pro plan for 14 days. No credit card is required to begin. You can import your contacts, invite your team members, connect WhatsApp & email, and test all automated workflows with zero obligation.',
  },
  {
    question: 'Can I pay in Kenyan Shillings (KES) or USD?',
    answer:
      'Yes! Versaly CRM natively supports multi-currency billing including KES, USD, EUR, and GBP. You can pay via international cards, Stripe checkout, or regional payment rails seamlessly.',
  },
  {
    question: 'How does the WhatsApp integration work?',
    answer:
      'Versaly integrates directly with WhatsApp so your team can send personalized follow-ups, trigger automated alerts when leads advance stages, and receive prospect replies directly in the CRM contact timeline without sharing personal devices.',
  },
  {
    question: 'Is our company data completely private and isolated?',
    answer:
      'Absolutely. Every organization in Versaly CRM operates in a cryptographically isolated multi-tenant workspace with strict row-level security. Your leads, confidential deal terms, revenue numbers, and customer conversations are strictly yours and never shared.',
  },
  {
    question: 'Can I import existing leads and deals from Excel, CSV, or another CRM?',
    answer:
      'Yes. Versaly includes a one-click CSV and Excel contact importer with smart column mapping. We also provide native API webhooks so leads from Meta Lead Ads, Google Forms, and your website landing pages land straight into your pipeline.',
  },
  {
    question: 'Can we change plans or cancel at any time?',
    answer:
      'Yes, you maintain full control. You can upgrade, downgrade, or cancel your subscription anytime directly from your Subscription & Billing settings. There are no cancellation penalties or hidden termination fees.',
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
            Everything you need to know about switching to Versaly CRM.
          </p>
        </div>

        {/* FAQ Accordion List with Level 2 Glass */}
        <div className="relative overflow-hidden mt-8 divide-y divide-white/10 rounded-3xl border border-white/[0.12] bg-[#073652]/60 p-5 sm:p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.14)] backdrop-blur-xl">
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
