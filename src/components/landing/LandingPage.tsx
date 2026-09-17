'use client';

import React from 'react';
import { LandingNav } from './LandingNav';
import { BackgroundGrid } from './BackgroundGrid';
import { HeroSection } from './HeroSection';
import { TestimonialsAndMetrics } from './TestimonialsAndMetrics';
import { PipelineVisualizer } from './PipelineVisualizer';
import { BentoGridFeatures } from './BentoGridFeatures';
import { PricingSection } from './PricingSection';
import { FaqSection } from './FaqSection';
import { CtaSection } from './CtaSection';
import { ContactSection } from './ContactSection';
import { LandingFooter } from './LandingFooter';
import { Sparkles, ArrowRight, KanbanSquare, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#053048] text-white selection:bg-sky-500 selection:text-white relative">
      {/* Ambient Grid Background */}
      <BackgroundGrid pattern="grid" />

      {/* Sticky Header with Logo, Navigation Links, Sign In & Start Free Trial */}
      <LandingNav />

      {/* Hero Section with Aceternity Spotlight, React Bits Animated Counters & Interactive CRM Dashboard Preview */}
      <HeroSection />

      {/* Social Proof Numbers & Real Testimonials */}
      <TestimonialsAndMetrics />

      {/* Aceternity Bento Grid Features: WhatsApp Outreach, CS Retention Scoring, Telemetry & SLA Dispatch */}
      <BentoGridFeatures />

      {/* Interactive Visual Pipeline Sandbox */}
      <section id="pipeline" className="relative px-5 py-10 lg:py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center mb-6 lg:mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/60 px-3.5 py-1 text-xs font-semibold text-sky-300">
              <KanbanSquare className="h-3.5 w-3.5 text-sky-400" /> Interactive Kanban Sandbox
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Watch deals move forward with total visibility.
            </h2>
            <p className="mt-3 text-base text-sky-200/70 sm:text-lg">
              No hidden stages. No forgotten accounts. Click any deal to simulate advancing stages, automated WhatsApp triggers, and real-time revenue recalculation.
            </p>
          </div>

          <PipelineVisualizer />
        </div>
      </section>

      {/* Subscription Pricing Matrix: Monthly & Annual Toggle, 3 Tiers, Direct Signup Links */}
      <PricingSection />

      {/* Interactive FAQ Accordion */}
      <FaqSection />

      {/* Glowing Bottom CTA Section */}
      <CtaSection />

      {/* Direct Contact Section with Lead Capture Form delivering to versalylabs@gmail.com */}
      <ContactSection />

      {/* Rich Footer with Brand, Solutions, Security and Copyright */}
      <LandingFooter />
    </main>
  );
}

