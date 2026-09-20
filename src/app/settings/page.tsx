'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type Profile = { id: string; name: string | null; email: string; role: string; createdAt: string };

const glassInput =
  'w-full rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition';

export default function SettingsPage() {
  const { update: updateSession } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const r = await fetch('/api/settings', { cache: 'no-store' });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error);
        setProfile(data);
        setName(data.name || '');
        setEmail(data.email || '');
      } catch (e: any) {
        setLoadError(e.message || 'Could not load your settings. Please try again.');
        const prefs = await fetch('/api/notification-preferences').then((r) => r.json());
        setNotificationPrefs(prefs);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      const r = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to update profile.');
      setProfileSuccess('Profile updated successfully.');
      await updateSession();
    } catch (e: any) {
      setProfileError(e.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to update password.');
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPasswordError(e.message || 'Could not update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100">
      <div className="container-custom py-8 space-y-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Account & Preferences</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage your profile details, security credentials, and workspace preferences.
          </p>
        </div>

        {/* Settings Navigation Tabs (Liquid Glass Style) */}
        <div className="flex gap-2 border-b border-white/10 pb-3">
          <Link
            href="/settings"
            className="rounded-xl px-4 py-2 text-xs font-bold bg-sky-500/20 text-cyan-300 border border-sky-400/30 transition"
          >
            👤 Profile & Security
          </Link>
          <Link
            href="/settings/billing"
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition"
          >
            ⚡ Subscription & Plans
          </Link>
          <Link
            href="/settings/integrations"
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition"
          >
            💬 Communication Channels
          </Link>
        </div>

        {loadError && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {loadError}
          </div>
        )}

        {notificationPrefs && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
            <h2 className="text-base font-bold text-white mb-1">Notification Preferences</h2>
            <p className="text-xs text-slate-400 mb-4">Choose which CRM events trigger system notifications.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['taskNotifications', 'Tasks and follow-ups'],
                ['leadNotifications', 'Lead assignments'],
                ['followUpNotifications', 'Follow-up reminders'],
                ['proposalNotifications', 'Proposal updates'],
                ['calendarNotifications', 'Calendar reminders'],
                ['emailNotifications', 'Email notifications'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#042438]/50 p-3 hover:bg-[#042438]/80 transition cursor-pointer"
                >
                  <span className="text-xs font-medium text-slate-200">{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(notificationPrefs[key])}
                    onChange={async (e) => {
                      const next = { ...notificationPrefs, [key]: e.target.checked };
                      setNotificationPrefs(next);
                      await fetch('/api/notification-preferences', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ [key]: e.target.checked }),
                      });
                    }}
                    className="h-4 w-4 rounded border-white/20 bg-[#042438] text-sky-500 focus:ring-0 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-2">
            <div className="text-2xl animate-pulse">⚙️</div>
            <p>Loading settings profile...</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Profile Form (Liquid Glass Panel) */}
            <form
              onSubmit={saveProfile}
              className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl h-fit space-y-4"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

              <div>
                <h2 className="text-base font-bold text-white mb-1">User Profile</h2>
                {profile && (
                  <p className="text-xs text-slate-400">
                    Role: <span className="font-semibold text-cyan-300">{profile.role}</span> · Member since{' '}
                    {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={glassInput}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={glassInput}
                    placeholder="your.email@example.com"
                  />
                </div>
                {profileError && (
                  <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">
                    {profileError}
                  </p>
                )}
                {profileSuccess && (
                  <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5">
                    {profileSuccess}
                  </p>
                )}
                <button
                  disabled={savingProfile}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>

            {/* Change Password Form (Liquid Glass Panel) */}
            <form
              onSubmit={changePassword}
              className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl h-fit space-y-4"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

              <div>
                <h2 className="text-base font-bold text-white mb-1">Change Password</h2>
                <p className="text-xs text-slate-400">Update your account authentication credentials.</p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={glassInput}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={glassInput}
                    placeholder="••••••••"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Minimum 8 characters required.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={glassInput}
                    placeholder="••••••••"
                  />
                </div>
                {passwordError && (
                  <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">
                    {passwordError}
                  </p>
                )}
                {passwordSuccess && (
                  <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5">
                    {passwordSuccess}
                  </p>
                )}
                <button
                  disabled={savingPassword}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
                >
                  {savingPassword ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
