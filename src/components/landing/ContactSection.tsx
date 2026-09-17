'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Phone, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: 'General Inquiry',
    message: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit inquiry.');
      }

      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        subject: 'General Inquiry',
        message: '',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please reach out to versalylabs@gmail.com directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="relative px-5 py-16 lg:py-24 lg:px-8 border-t border-sky-500/10">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl h-96 bg-cyan-500/5 blur-[120px] rounded-full" />

      <div className="relative mx-auto max-w-7xl">
        {/* Section Title */}
        <div className="mx-auto max-w-3xl text-center mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/60 px-3.5 py-1 text-xs font-semibold text-cyan-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Get In Touch · Direct Contact</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Have a question, or ready to supercharge your sales?
          </h2>
          <p className="mt-3 text-base text-sky-200/70 sm:text-lg">
            Send our founders and engineering team a message. Inquiries are dispatched straight to our inbox at <span className="text-cyan-300 font-semibold">versalylabs@gmail.com</span> and answered promptly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Direct Contact Info & Socials */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#073652]/80 to-[#041c2c]/90 p-8 shadow-xl backdrop-blur-xl">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Let&apos;s talk about your business
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-sky-200/70">
                Whether you need a personalized walkthrough, want custom API integrations, or need enterprise multi-seat provisioning, we are ready to assist.
              </p>

              <div className="mt-8 space-y-5">
                {/* Email Item */}
                <a 
                  href="mailto:versalylabs@gmail.com" 
                  className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-white/10 transition-all group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300/70">Direct Email</span>
                    <p className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                      versalylabs@gmail.com
                    </p>
                  </div>
                </a>

                {/* Phone Lines */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300/70">Direct Support & Sales Lines</span>
                      <div className="flex items-center gap-3 mt-0.5">
                        <a 
                          href="tel:0704611033" 
                          className="text-xs font-bold text-white hover:text-cyan-300 transition-colors"
                        >
                          0704611033
                        </a>
                        <span className="text-sky-500/60">/</span>
                        <a 
                          href="tel:0792986825" 
                          className="text-xs font-bold text-white hover:text-cyan-300 transition-colors"
                        >
                          0792986825
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guarantees */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-sky-200/70">
                    <Clock className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span>Avg. Response: &lt; 15 mins</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-sky-200/70">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Confidential & Secure</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Social channels card */}
            <div className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-[#073652]/60 to-[#041c2c]/80 p-6 shadow-lg backdrop-blur-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300/70 block mb-3">
                Follow & Message Our Socials
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Instagram */}
                <a
                  href="https://instagram.com/versalylabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-pink-500/40 hover:bg-pink-500/10 transition-all text-center group"
                >
                  <svg className="h-5 w-5 text-pink-400 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span className="text-[11px] font-semibold text-white mt-1.5">Instagram</span>
                </a>

                {/* TikTok */}
                <a
                  href="https://tiktok.com/@versalylabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-400/40 hover:bg-cyan-400/10 transition-all text-center group"
                >
                  <svg className="h-5 w-5 text-cyan-300 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                  </svg>
                  <span className="text-[11px] font-semibold text-white mt-1.5">TikTok</span>
                </a>

                {/* Facebook */}
                <a
                  href="https://facebook.com/versalylabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/40 hover:bg-blue-500/10 transition-all text-center group"
                >
                  <svg className="h-5 w-5 text-blue-400 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="text-[11px] font-semibold text-white mt-1.5">Facebook</span>
                </a>

                {/* X (Twitter) */}
                <a
                  href="https://x.com/versalylabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-sky-400/40 hover:bg-sky-400/10 transition-all text-center group"
                >
                  <svg className="h-5 w-5 text-sky-400 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span className="text-[11px] font-semibold text-white mt-1.5">X (Twitter)</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#073652]/90 to-[#041c2c]/95 p-8 sm:p-10 shadow-2xl backdrop-blur-2xl">
              {submitted ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12 space-y-4"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Inquiry Dispatched!</h3>
                  <p className="text-sm text-sky-200/80 max-w-md mx-auto leading-relaxed">
                    Thank you for reaching out. Your message has been sent straight to our team at <strong className="text-white">versalylabs@gmail.com</strong> and logged into our CRM. We will get back to you shortly.
                  </p>
                  <div className="pt-4">
                    <button
                      onClick={() => setSubmitted(false)}
                      className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-6 py-2.5 text-xs font-bold text-sky-300 hover:bg-sky-500/20 transition-all"
                    >
                      Send Another Message
                    </button>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Send Us a Message
                    </h3>
                    <p className="text-xs text-sky-200/70 mt-0.5">
                      Fill out the form below and we will receive it at <strong className="text-cyan-300">versalylabs@gmail.com</strong>.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-semibold text-sky-200/90 mb-1.5">
                        Your Name <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Alex Mercer"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-xl border border-sky-500/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-sky-200/40 outline-none focus:border-cyan-400 focus:bg-white/10 transition-all"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-semibold text-sky-200/90 mb-1.5">
                        Work Email <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="alex@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-xl border border-sky-500/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-sky-200/40 outline-none focus:border-cyan-400 focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-semibold text-sky-200/90 mb-1.5">
                        Phone Number <span className="text-sky-400/60 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +254 700 000 000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full rounded-xl border border-sky-500/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-sky-200/40 outline-none focus:border-cyan-400 focus:bg-white/10 transition-all"
                      />
                    </div>

                    {/* Company */}
                    <div>
                      <label className="block text-xs font-semibold text-sky-200/90 mb-1.5">
                        Company / Workspace <span className="text-sky-400/60 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Media Corp"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full rounded-xl border border-sky-500/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-sky-200/40 outline-none focus:border-cyan-400 focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Subject Dropdown */}
                  <div>
                    <label className="block text-xs font-semibold text-sky-200/90 mb-1.5">
                      What can we help you with?
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full rounded-xl border border-sky-500/20 bg-[#041c2c] px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400 transition-all"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Custom Enterprise / Scale Plan">Custom Enterprise / Scale Plan</option>
                      <option value="Agency / B2B Provisioning">Agency / B2B Provisioning</option>
                      <option value="Omnichannel WhatsApp & Social Setup">Omnichannel WhatsApp & Social Setup</option>
                      <option value="Platform Demo Request">Platform Demo Request</option>
                      <option value="Technical Partnership / API">Technical Partnership / API</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-semibold text-sky-200/90 mb-1.5">
                      Your Message <span className="text-cyan-400">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Tell us about your team, your current sales workflow, or how we can help..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full rounded-xl border border-sky-500/20 bg-white/5 p-3 text-xs text-white placeholder-sky-200/40 outline-none focus:border-cyan-400 focus:bg-white/10 transition-all resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-400 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 hover:from-sky-400 hover:to-cyan-300 transition-all disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>Sending to versalylabs@gmail.com...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Send Message to Versaly</span>
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-center text-[10px] text-sky-300/60">
                      We never share your information. Messages go directly to our team.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
