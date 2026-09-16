'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type Profile = { id: string; name: string | null; email: string; role: string; createdAt: string };

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
        const prefs = await fetch('/api/notification-preferences').then(r => r.json());
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
      if (!r.ok) throw new Error(data.error || 'Failed to update profile');
      setProfile(data);
      await updateSession({ name: data.name, email: data.email });
      setProfileSuccess('Profile updated.');
    } catch (e: any) {
      setProfileError(e.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      const r = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to change password');
      setPasswordSuccess('Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPasswordError(e.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-custom py-8">
        <div className="flex flex-col gap-1 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your account details and workspace preferences.</p>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="mb-6 flex border-b border-gray-200 dark:border-gray-800">
          <Link
            href="/settings"
            className="border-b-2 border-sky-600 px-4 py-2.5 text-xs font-bold text-sky-600 dark:border-sky-400 dark:text-sky-400"
          >
            👤 Profile & Security
          </Link>
          <Link
            href="/settings/billing"
            className="border-b-2 border-transparent px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition"
          >
            ⚡ Subscription & Plans
          </Link>
        </div>

        {loadError && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{loadError}</div>}



        {notificationPrefs && <div className="mb-6 rounded-xl bg-white p-6 shadow-soft"><h2 className="text-lg font-semibold text-gray-900">Notifications</h2><p className="mt-1 text-sm text-gray-500">Choose which CRM events should notify you.</p><div className="mt-4 space-y-3">{[['taskNotifications','Tasks'],['leadNotifications','Lead assignments'],['followUpNotifications','Follow-up reminders'],['proposalNotifications','Proposal updates'],['calendarNotifications','Calendar reminders'],['emailNotifications','Email notifications']].map(([key,label])=><label key={key} className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm font-medium text-gray-800">{label}</span><input type="checkbox" checked={Boolean(notificationPrefs[key])} onChange={async e=>{const next={...notificationPrefs,[key]:e.target.checked};setNotificationPrefs(next);await fetch('/api/notification-preferences',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({[key]:e.target.checked})})}} /></label>)}</div></div>}
        {loading ? (
          <p className="py-10 text-center text-gray-500">Loading settings...</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={saveProfile} className="rounded-xl bg-white p-6 shadow-soft h-fit">
              <h2 className="text-lg font-semibold mb-1">Profile</h2>
              {profile && (
                <p className="text-sm text-gray-500 mb-5">
                  Role: <span className="font-medium text-gray-700">{profile.role}</span> · Member since{' '}
                  {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border p-3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border p-3" />
                </div>
                {profileError && <p className="text-sm text-red-600">{profileError}</p>}
                {profileSuccess && <p className="text-sm text-emerald-600">{profileSuccess}</p>}
                <button disabled={savingProfile} className="w-full rounded-lg bg-gray-900 py-3 font-medium text-white disabled:opacity-60">
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>

            <form onSubmit={changePassword} className="rounded-xl bg-white p-6 shadow-soft h-fit">
              <h2 className="text-lg font-semibold mb-5">Change Password</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  />
                  <p className="text-xs text-gray-400 mt-1">At least 8 characters.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  />
                </div>
                {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                {passwordSuccess && <p className="text-sm text-emerald-600">{passwordSuccess}</p>}
                <button disabled={savingPassword} className="w-full rounded-lg bg-gray-900 py-3 font-medium text-white disabled:opacity-60">
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
