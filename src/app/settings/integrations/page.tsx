'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ChannelStatus {
  channel: string;
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING';
  displayName: string;
  accountName?: string;
  accountHandle?: string;
  externalAccountId?: string;
  lastSyncAt?: string | null;
  errorMessage?: string;
  setupInstructions: string;
  requiresCredentials: string[];
}

interface ConnectedAccount {
  id: string;
  channel: string;
  accountName: string;
  accountHandle: string;
  externalAccountId?: string | null;
  status: string;
  avatarUrl?: string | null;
  hasAccessToken?: boolean;
  hasAppSecret?: boolean;
  webhookSecret?: string | null;
  lastSyncAt?: string | null;
  errorMessage?: string | null;
  connectedAt: string;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  EMAIL: (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </div>
  ),
  WHATSAPP: (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </div>
  ),
  INSTAGRAM: (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/20 via-rose-500/20 to-purple-500/20 text-rose-400 border border-rose-500/20">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    </div>
  ),
  FACEBOOK: (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    </div>
  ),
  X: (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-500/10 text-zinc-300 border border-zinc-500/20">
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </div>
  ),
  TIKTOK: (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    </div>
  ),
};

export default function CommunicationChannelsSettingsPage() {
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Modal State
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountHandle, setAccountHandle] = useState('');
  const [externalAccountId, setExternalAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inbox/channels', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        setAccounts(data.accounts || []);
      }
    } catch (e) {
      console.error('Failed to load channel configurations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openConnectModal = (channelName: string) => {
    setSelectedChannel(channelName);
    const existingAcc = accounts.find((a) => a.channel === channelName);
    setAccountName(existingAcc?.accountName || '');
    setAccountHandle(existingAcc?.accountHandle || '');
    setExternalAccountId(existingAcc?.externalAccountId || '');
    setAccessToken('');
    setAppId('');
    setAppSecret('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) return;

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/inbox/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel,
          accountName,
          accountHandle,
          externalAccountId,
          accessToken: accessToken || undefined,
          appId: appId || undefined,
          appSecret: appSecret || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect channel');
      }

      setSuccessMsg(`${selectedChannel} credentials registered successfully.`);
      await loadData();
      setTimeout(() => {
        setSelectedChannel(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting channel');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (channelName: string) => {
    const acc = accounts.find((a) => a.channel === channelName);
    if (!acc) return;

    if (!confirm(`Are you sure you want to disconnect ${channelName}?`)) return;

    try {
      const res = await fetch(`/api/inbox/channels?id=${acc.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Error disconnecting channel:', err);
    }
  };

  const copyWebhookUrl = (channelName: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/api/webhooks/communications/${channelName.toLowerCase()}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(channelName);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 tracking-wider uppercase">
            <span>Workspace Integrations</span>
            <span>·</span>
            <span>Unified Communication Hub</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Communication Channels</h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Configure omnichannel messaging connections for Email, WhatsApp, Instagram, Facebook Messenger, X (Twitter), and TikTok.
            Credentials remain encrypted and are never exposed to clients.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 gap-2">
          <Link
            href="/settings"
            className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white transition"
          >
            👤 Profile & Security
          </Link>
          <Link
            href="/settings/billing"
            className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white transition"
          >
            ⚡ Subscription & Plans
          </Link>
          <Link
            href="/settings/integrations"
            className="border-b-2 border-sky-400 px-4 py-2.5 text-xs font-bold text-sky-400"
          >
            💬 Communication Channels
          </Link>
          <Link
            href="/integrations"
            className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white transition"
          >
            🔌 Developer API & Webhooks
          </Link>
        </div>

        {/* Channels Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading channel configurations...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {channels.map((chan) => {
              const acc = accounts.find((a) => a.channel === chan.channel);
              const isConnected = chan.connected || Boolean(acc);
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const webhookUrl = `${origin}/api/webhooks/communications/${chan.channel.toLowerCase()}`;

              return (
                <div
                  key={chan.channel}
                  className="rounded-2xl border border-white/10 bg-[#073b58]/80 backdrop-blur-md p-5 flex flex-col justify-between shadow-xl hover:border-sky-500/30 transition duration-200"
                >
                  <div className="space-y-4">
                    {/* Top row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {CHANNEL_ICONS[chan.channel] || CHANNEL_ICONS.EMAIL}
                        <div>
                          <h2 className="text-base font-bold text-white">{chan.displayName}</h2>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-500'
                              }`}
                            />
                            <span
                              className={`text-[11px] font-semibold tracking-wide uppercase ${
                                isConnected ? 'text-emerald-400' : 'text-slate-400'
                              }`}
                            >
                              {isConnected ? 'Connected' : 'Not Connected'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-xs text-slate-300 bg-[#042a40]/60 rounded-xl p-3 border border-white/5">
                      {acc ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Account:</span>
                            <span className="font-medium text-white truncate max-w-[180px]">{acc.accountName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Handle/ID:</span>
                            <span className="font-mono text-sky-300">{acc.accountHandle}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Connected:</span>
                            <span>{new Date(acc.connectedAt).toLocaleDateString()}</span>
                          </div>
                        </>
                      ) : chan.channel === 'EMAIL' && isConnected ? (
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Mode:</span>
                            <span className="text-emerald-400 font-medium">SMTP Gateway</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">From Address:</span>
                            <span className="font-mono text-sky-300">{chan.accountHandle || 'Active in .env'}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 leading-relaxed">{chan.setupInstructions}</p>
                      )}

                      {chan.errorMessage && (
                        <div className="text-rose-400 text-[11px] pt-1 border-t border-rose-500/20">
                          {chan.errorMessage}
                        </div>
                      )}
                    </div>

                    {/* Webhook Endpoint Info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Inbound Webhook URL</span>
                        <button
                          type="button"
                          onClick={() => copyWebhookUrl(chan.channel)}
                          className="text-sky-400 hover:text-sky-300 font-medium transition"
                        >
                          {copiedUrl === chan.channel ? '✓ Copied!' : 'Copy URL'}
                        </button>
                      </div>
                      <div className="font-mono text-[10px] bg-[#031d2c] text-slate-400 p-2 rounded-lg truncate select-all border border-white/5">
                        {webhookUrl}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 mt-4 border-t border-white/10 flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openConnectModal(chan.channel)}
                          className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 border border-white/10 transition text-center"
                        >
                          Reconfigure
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisconnect(chan.channel)}
                          className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-400 border border-rose-500/20 transition"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openConnectModal(chan.channel)}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-xs font-bold text-white shadow-lg shadow-sky-500/20 transition text-center"
                      >
                        Connect {chan.displayName.split(' ')[0]}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Configuration Modal */}
        {selectedChannel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#073b58] p-6 md:p-8 shadow-2xl space-y-6 text-slate-100 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  {CHANNEL_ICONS[selectedChannel]}
                  <div>
                    <h2 className="text-xl font-bold text-white">Connect {selectedChannel}</h2>
                    <p className="text-xs text-slate-400">Configure provider credentials for live delivery</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedChannel(null)}
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1">
                <p className="font-semibold">⚠️ Production Requirement Notice</p>
                <p className="text-amber-300/80">
                  Versaly CRM does not fabricate mock deliveries. Entering valid provider credentials connects live external APIs. Without credentials, the channel remains safe and disconnected.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleSaveConnection} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Account Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder={`e.g. Versaly Agency ${selectedChannel}`}
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {selectedChannel === 'WHATSAPP' ? 'Phone Number or Handle' : 'Account Handle / Username'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={selectedChannel === 'WHATSAPP' ? '+1 555-0199' : '@youraccount'}
                    value={accountHandle}
                    onChange={(e) => setAccountHandle(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {selectedChannel === 'WHATSAPP'
                      ? 'WhatsApp Phone Number ID'
                      : selectedChannel === 'FACEBOOK'
                      ? 'Facebook Page ID'
                      : 'External Account ID (Optional)'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 104829482049182"
                    value={externalAccountId}
                    onChange={(e) => setExternalAccountId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    API Access Token / Bearer Token
                  </label>
                  <input
                    type="password"
                    placeholder="Paste permanent API or Page Access Token"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">App / Client ID</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">App Secret</label>
                    <input
                      type="password"
                      placeholder="Optional"
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedChannel(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-xs font-bold text-white shadow-md shadow-sky-500/25 disabled:opacity-60 transition"
                  >
                    {saving ? 'Saving...' : 'Save & Connect'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
