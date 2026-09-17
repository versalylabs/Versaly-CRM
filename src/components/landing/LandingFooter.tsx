'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Heart, Phone, Mail } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-sky-500/20 bg-[#041c2c] text-sky-200/80">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-5">
          {/* Brand Col */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 font-black text-white shadow-md shadow-sky-500/30">
                V
              </div>
              <span className="text-lg font-black tracking-tight text-white">
                Versaly<span className="text-sky-400">CRM</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-sky-200/70">
              The high-velocity revenue and retention operating system designed for modern subscription businesses, agencies, and B2B scale-ups.
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Systems Operational (99.9% Uptime)</span>
            </div>

            {/* Direct Phone Lines */}
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-sky-200">
              <Phone className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="text-sky-400/80 font-bold">Contact:</span>
              <a href="tel:0704611033" className="hover:text-cyan-300 transition-colors font-bold">0704611033</a>
              <span className="text-sky-500/60">/</span>
              <a href="tel:0792986825" className="hover:text-cyan-300 transition-colors font-bold">0792986825</a>
            </div>

            {/* Social Media Links: Instagram, TikTok, Facebook, X */}
            <div className="mt-4 flex items-center gap-2.5">
              <a
                href="https://instagram.com/versalylabs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-pink-400 hover:border-pink-500/40 hover:bg-pink-500/15 hover:text-white transition-all shadow-sm"
                title="Follow us on Instagram"
                aria-label="Instagram"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>

              <a
                href="https://tiktok.com/@versalylabs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-400/15 hover:text-white transition-all shadow-sm"
                title="Follow us on TikTok"
                aria-label="TikTok"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              </a>

              <a
                href="https://facebook.com/versalylabs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/15 hover:text-white transition-all shadow-sm"
                title="Follow us on Facebook"
                aria-label="Facebook"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>

              <a
                href="https://x.com/versalylabs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-sky-400 hover:border-sky-400/40 hover:bg-sky-400/15 hover:text-white transition-all shadow-sm"
                title="Follow us on X (Twitter)"
                aria-label="X (Twitter)"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Platform</h4>
            <ul className="mt-4 space-y-2.5 text-xs text-sky-200/70">
              <li><a href="#testimonials" className="hover:text-white transition-colors">Client Testimonials</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Platform Features</a></li>
              <li><a href="#pipeline" className="hover:text-white transition-colors">Visual Pipeline</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Subscription Pricing</a></li>
              <li><a href="#contact" className="hover:text-white transition-colors">Direct Contact</a></li>
              <li><Link href="/auth/signin" className="hover:text-white transition-colors">Sign In</Link></li>
            </ul>
          </div>

          {/* Solutions Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Solutions</h4>
            <ul className="mt-4 space-y-2.5 text-xs text-sky-200/70">
              <li><span className="text-sky-200/50">B2B Agencies</span></li>
              <li><span className="text-sky-200/50">Recurring SaaS</span></li>
              <li><span className="text-sky-200/50">Consulting Firms</span></li>
              <li><span className="text-sky-200/50">FinTech Operators</span></li>
              <li><span className="text-sky-200/50">Sales Teams</span></li>
            </ul>
          </div>

          {/* Trust & Security */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Trust & Security</h4>
            <ul className="mt-4 space-y-2.5 text-xs text-sky-200/70">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-400" /> Multi-Tenant Isolation
              </li>
              <li><span className="text-sky-200/50">End-to-End Encryption</span></li>
              <li><span className="text-sky-200/50">KES & USD Billing</span></li>
              <li><span className="text-sky-200/50">GDPR & Data Privacy</span></li>
              <li><a href="#faqs" className="hover:text-white transition-colors">FAQ Knowledge Base</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & notes */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-sky-500/10 pt-8 text-xs text-sky-300/60 sm:flex-row">
          <p>© 2026 Versaly Technologies Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/auth/signin" className="hover:text-sky-200 transition-colors">
              Workspace Login
            </Link>
            <Link href="/auth/signup?plan=GROWTH_PRO" className="hover:text-sky-200 transition-colors">
              Start Free Trial
            </Link>
            <a href="#faqs" className="hover:text-sky-200 transition-colors">
              Help Center
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
