'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

import { useSession } from 'next-auth/react';

export function LandingNav() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.querySelector(id);
    if (element) {
      const yOffset = -72;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <motion.header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#031d2e]/25 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/[0.12] shadow-[0_8px_32px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.15)] py-2.5'
          : 'bg-[#031d2e]/10 backdrop-blur-xl backdrop-saturate-150 border-b border-white/[0.06] shadow-[0_4px_20px_0_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.1)] py-3.5'
      }`}
    >
      {/* Specular Top Edge Light Refraction */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      {/* Subtle Liquid Gloss Refraction Sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/[0.04]" />

      <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 font-black text-white shadow-lg shadow-sky-500/30 transition-transform group-hover:scale-105">
            V
          </div>
          <div>
            <span className="block text-lg font-black tracking-tight text-white">
              Versaly<span className="text-sky-400">CRM</span>
            </span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-sky-300/70">
              Sales, with direction
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links with Smooth Scroll and Glass Hover States */}
        <nav className="hidden items-center gap-1.5 text-sm font-semibold text-sky-100/80 md:flex">
          <a
            href="#testimonials"
            onClick={(e) => scrollTo(e, '#testimonials')}
            className="rounded-lg px-3.5 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            Testimonials
          </a>
          <a
            href="#features"
            onClick={(e) => scrollTo(e, '#features')}
            className="rounded-lg px-3.5 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            Features
          </a>
          <a
            href="#pipeline"
            onClick={(e) => scrollTo(e, '#pipeline')}
            className="rounded-lg px-3.5 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            Pipeline
          </a>
          <a
            href="#pricing"
            onClick={(e) => scrollTo(e, '#pricing')}
            className="rounded-lg px-3.5 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            Pricing
          </a>
          <a
            href="#contact"
            onClick={(e) => scrollTo(e, '#contact')}
            className="rounded-lg px-3.5 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            Contact
          </a>
          <a
            href="#faqs"
            onClick={(e) => scrollTo(e, '#faqs')}
            className="rounded-lg px-3.5 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            FAQs
          </a>
        </nav>

        {/* User Sign In and CTA Buttons with Glass Effect */}
        <div className="hidden items-center gap-3 sm:flex">
          {session?.user ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition-all hover:bg-sky-400 hover:shadow-sky-500/40"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-sky-200 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup?plan=GROWTH_PRO"
                className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition-all hover:bg-sky-400 hover:shadow-sky-500/40"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-sky-200 backdrop-blur-md hover:bg-white/[0.1] sm:hidden"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer with Matching Glass Effect */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-white/10 bg-[#05293d]/85 px-5 py-5 backdrop-blur-2xl sm:hidden shadow-2xl"
          >
            <nav className="flex flex-col gap-3 text-sm font-bold text-sky-100">
              <a
                href="#testimonials"
                onClick={(e) => scrollTo(e, '#testimonials')}
                className="rounded-lg px-3 py-1.5 hover:bg-white/[0.08] hover:text-white"
              >
                Testimonials
              </a>
              <a
                href="#features"
                onClick={(e) => scrollTo(e, '#features')}
                className="rounded-lg px-3 py-1.5 hover:bg-white/[0.08] hover:text-white"
              >
                Features
              </a>
              <a
                href="#pipeline"
                onClick={(e) => scrollTo(e, '#pipeline')}
                className="rounded-lg px-3 py-1.5 hover:bg-white/[0.08] hover:text-white"
              >
                Pipeline
              </a>
              <a
                href="#pricing"
                onClick={(e) => scrollTo(e, '#pricing')}
                className="rounded-lg px-3 py-1.5 hover:bg-white/[0.08] hover:text-white"
              >
                Pricing
              </a>
              <a
                href="#contact"
                onClick={(e) => scrollTo(e, '#contact')}
                className="rounded-lg px-3 py-1.5 hover:bg-white/[0.08] hover:text-white"
              >
                Contact
              </a>
              <a
                href="#faqs"
                onClick={(e) => scrollTo(e, '#faqs')}
                className="rounded-lg px-3 py-1.5 hover:bg-white/[0.08] hover:text-white"
              >
                FAQs
              </a>
            </nav>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4">
              {session?.user ? (
                <Link
                  href="/dashboard"
                  className="block w-full rounded-xl bg-sky-500 py-2.5 text-center text-sm font-bold text-white shadow-md shadow-sky-500/30"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 text-center text-sm font-bold text-sky-200 backdrop-blur-md"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup?plan=GROWTH_PRO"
                    className="block w-full rounded-xl bg-sky-500 py-2.5 text-center text-sm font-bold text-white shadow-md shadow-sky-500/30"
                  >
                    Start Free Trial
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
