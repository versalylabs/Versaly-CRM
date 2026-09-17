'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  Mail,
  Zap,
  AlertTriangle,
  Check,
  Search,
  Target,
  ClipboardList,
  Key,
  Trash2,
  Plus,
  Copy,
} from 'lucide-react';

type Role = 'ADMIN' | 'MANAGER' | 'AGENT';
type User = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  _count?: {
    assignedLeads: number;
    assignedTasks: number;
  };
};

type WorkspaceData = {
  users: User[];
  seatLimit: number;
  seatUsed: number;
  plan: string;
  organizationName: string;
};

const roles: { value: Role; label: string; description: string; badge: string }[] = [
  {
    value: 'ADMIN',
    label: 'Workspace Admin',
    description: 'Full CRM operations, billing, and team permissions',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  },
  {
    value: 'MANAGER',
    label: 'Sales Manager',
    description: 'Team lead oversight, report analytics, and deal management',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  {
    value: 'AGENT',
    label: 'Sales Agent',
    description: 'Day-to-day leads, pipeline stages, outreach, and tasks',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
];

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Modals & Panels
  const [activeModal, setActiveModal] = useState<'create' | 'invite' | 'password' | null>(null);
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Form states
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'AGENT' as Role });
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'AGENT' as Role });
  const [generatedInvite, setGeneratedInvite] = useState<{ url: string; email: string; role: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Filter
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load workspace users');
      setWorkspace(data);
    } catch (err: any) {
      setError(err.message || 'Could not load workspace users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.replace('/');
        return;
      }
      loadData();
    }
    if (status === 'unauthenticated') router.replace('/auth/signin');
  }, [status, session, router]);

  // Create User directly
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingId('create');
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');

      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              users: [...prev.users, data],
              seatUsed: prev.seatUsed + 1,
            }
          : prev
      );
      setCreateForm({ name: '', email: '', password: '', role: 'AGENT' });
      setActiveModal(null);
      setSuccess('Team member created and added to workspace successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setSavingId(null);
    }
  };

  // Generate Invite Link
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingId('invite');
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate invitation');

      setGeneratedInvite({
        url: data.inviteUrl,
        email: data.email,
        role: data.role,
      });
      setInviteForm({ email: '', role: 'AGENT' });
      setSuccess('Invitation link generated! Share it with your team member.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate invitation');
    } finally {
      setSavingId(null);
    }
  };

  // Update Role or Active Status
  const handleUpdateUser = async (user: User, patch: Partial<User>) => {
    setSavingId(user.id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update user');

      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) => (u.id === data.id ? { ...u, ...data } : u)),
            }
          : prev
      );
      setSuccess('Member permissions updated.');
    } catch (err: any) {
      setError(err.message || 'Could not update user');
    } finally {
      setSavingId(null);
    }
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;
    setSavingId('password');
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/users/${passwordTargetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password');

      setActiveModal(null);
      setPasswordTargetUser(null);
      setNewPassword('');
      setSuccess(`Password updated for ${passwordTargetUser.name || passwordTargetUser.email}.`);
    } catch (err: any) {
      setError(err.message || 'Could not reset password');
    } finally {
      setSavingId(null);
    }
  };

  // Delete User
  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to remove ${user.name || user.email} from the workspace? This will free up 1 team seat.`)) {
      return;
    }
    setSavingId(user.id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete user');

      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.filter((u) => u.id !== user.id),
              seatUsed: Math.max(0, prev.seatUsed - 1),
            }
          : prev
      );
      setSuccess('Member removed and seat released.');
    } catch (err: any) {
      setError(err.message || 'Could not delete user');
    } finally {
      setSavingId(null);
    }
  };

  const copyInviteUrl = () => {
    if (!generatedInvite) return;
    navigator.clipboard.writeText(generatedInvite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    if (!workspace) return [];
    return workspace.users.filter((user) => {
      if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (user.name || '').toLowerCase().includes(q);
        const matchesEmail = user.email.toLowerCase().includes(q);
        return matchesName || matchesEmail;
      }
      return true;
    });
  }, [workspace, roleFilter, search]);

  const seatLimit = workspace?.seatLimit || 10;
  const seatUsed = workspace?.seatUsed || 0;
  const seatPercent = Math.min(100, Math.round((seatUsed / (seatLimit || 1)) * 100));
  const isAtSeatLimit = seatUsed >= seatLimit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-gray-50 dark:bg-[#053048]"
    >
      <div className="container-custom py-8">
        
        {/* Header with Organization & Actions */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              <span>{workspace?.organizationName || 'Workspace'} Team</span>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                {workspace?.plan.replace('_', ' ') || 'Growth Pro'}
              </span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Team Members & Role Access
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Manage team accounts, role-based CRM permissions, and seat quotas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setActiveModal('invite');
                setGeneratedInvite(null);
              }}
              disabled={isAtSeatLimit}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-700 shadow-xs hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60 transition disabled:opacity-40"
            >
              <Mail className="h-4 w-4" />
              <span>Send Invite Link</span>
            </button>
            <button
              onClick={() => setActiveModal('create')}
              disabled={isAtSeatLimit}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-sky-500 hover:to-sky-600 transition disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              <span>Add Member Direct</span>
            </button>
          </div>
        </div>

        {/* Seat Quota Callout Banner */}
        <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.28)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Team Seat Capacity
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({seatUsed} of {seatLimit} seats allocated)
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isAtSeatLimit
                    ? 'Your workspace has reached the seat limit on your current plan.'
                    : `You can add ${seatLimit - seatUsed} more team member${seatLimit - seatUsed === 1 ? '' : 's'} under your ${workspace?.plan.replace('_', ' ')} plan.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-48">
                <div className="flex justify-between text-[11px] font-semibold mb-1 text-gray-600 dark:text-gray-300">
                  <span>Quota</span>
                  <span>{seatPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isAtSeatLimit
                        ? 'bg-rose-500'
                        : seatPercent > 70
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-sky-500 to-emerald-500'
                    }`}
                    style={{ width: `${Math.max(6, seatPercent)}%` }}
                  />
                </div>
              </div>

              <Link
                href="/settings/billing"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gray-100 px-3.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Upgrade Seats</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-200/80 bg-rose-50/80 p-4 text-xs font-medium text-rose-700 backdrop-blur-md dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="font-bold">✕</button>
          </div>
        )}
        {success && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4 text-xs font-medium text-emerald-800 backdrop-blur-md dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess('')} className="font-bold">✕</button>
          </div>
        )}

        {/* Filters Bar */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white/80 p-3.5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/80">
          <div className="flex flex-1 items-center gap-2.5">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member by name or email..."
              className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none dark:text-white dark:placeholder-gray-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-xs text-gray-400 hover:text-gray-600">
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-gray-100 sm:pl-3 pt-2 sm:pt-0 dark:border-gray-800">
            <span className="text-[11px] font-medium text-gray-400">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admins Only</option>
              <option value="MANAGER">Managers Only</option>
              <option value="AGENT">Agents Only</option>
            </select>
          </div>
        </div>

        {/* Team Members List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900/40">
            <div className="space-y-3">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading workspace team members...</p>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900/40">
            <p className="text-xs text-gray-500 dark:text-gray-400">No members matched your search filter.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200/80 bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                    <th className="py-3.5 pl-5 pr-3">Member</th>
                    <th className="px-3 py-3.5">Role Permission</th>
                    <th className="px-3 py-3.5">Workload</th>
                    <th className="px-3 py-3.5">Account Status</th>
                    <th className="px-3 py-3.5">Joined</th>
                    <th className="py-3.5 pl-3 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs dark:divide-gray-800">
                  {filteredUsers.map((user) => {
                    const isSelf = user.id === session?.user?.id;
                    const roleInfo = roles.find((r) => r.value === user.role);

                    return (
                      <tr
                        key={user.id}
                        className="transition hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                      >
                        {/* Member Name & Email */}
                        <td className="py-4 pl-5 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-sky-600 to-sky-400 text-xs font-bold text-white shadow-xs">
                              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-900 dark:text-white truncate">
                                  {user.name || 'Unnamed Member'}
                                </span>
                                {isSelf && (
                                  <span className="rounded-full bg-sky-100 px-2 py-0.2 text-[9px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate block">
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role Selector */}
                        <td className="px-3 py-4">
                          <select
                            value={user.role}
                            disabled={isSelf || savingId === user.id}
                            onChange={(e) => handleUpdateUser(user, { role: e.target.value as Role })}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none transition ${roleInfo?.badge} ${
                              isSelf ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                            }`}
                          >
                            {roles.map((r) => (
                              <option key={r.value} value={r.value} className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Workload */}
                        <td className="px-3 py-4 text-[11px] text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                              <Target className="h-3.5 w-3.5 text-sky-500" />
                              <span>{user._count?.assignedLeads || 0} leads</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <ClipboardList className="h-3.5 w-3.5 text-sky-500" />
                              <span>{user._count?.assignedTasks || 0} tasks</span>
                            </span>
                          </div>
                        </td>

                        {/* Status Toggle */}
                        <td className="px-3 py-4">
                          <button
                            onClick={() => handleUpdateUser(user, { isActive: !user.isActive })}
                            disabled={isSelf || savingId === user.id}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                              user.isActive
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            } ${isSelf ? 'cursor-not-allowed opacity-80' : 'hover:opacity-80'}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            {user.isActive ? 'Active' : 'Deactivated'}
                          </button>
                        </td>

                        {/* Created Date */}
                        <td className="px-3 py-4 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(user.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-3 pr-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => {
                                setPasswordTargetUser(user);
                                setActiveModal('password');
                              }}
                              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-white transition"
                              title="Reset Password"
                            >
                              <Key className="h-4 w-4" />
                            </button>

                            {!isSelf && (
                              <button
                                onClick={() => handleDeleteUser(user)}
                                disabled={savingId === user.id}
                                className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 transition"
                                title="Remove User & Free Seat"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal 1: Generate Invite Link */}
        {activeModal === 'invite' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Invite Team Member
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Generate a secure sign-up link for your colleague.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  ✕
                </button>
              </div>

              {!generatedInvite ? (
                <form onSubmit={handleGenerateInvite} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Colleague's Work Email
                    </label>
                    <input
                      type="email"
                      required
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="e.g. colleague@company.com"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Role Access
                    </label>
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as Role })}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {roles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label} — {r.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingId === 'invite'}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-sky-500 transition disabled:opacity-50"
                    >
                      {savingId === 'invite' ? 'Generating...' : 'Generate Invite Link'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      <span>Invitation Link Ready</span>
                    </span>
                    <p className="mt-1 text-xs text-emerald-900 dark:text-emerald-200 font-semibold">
                      Invite for {generatedInvite.email} ({generatedInvite.role})
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-400">
                      Valid for 7 days. Anyone with this link can set their password and join your workspace.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Shareable URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedInvite.url}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 select-all dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      />
                      <button
                        onClick={copyInviteUrl}
                        className="inline-flex items-center gap-1.5 shrink-0 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-sky-500 transition"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        setActiveModal(null);
                        setGeneratedInvite(null);
                      }}
                      className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal 2: Direct Member Creation */}
        {activeModal === 'create' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                    <UserPlus className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Create Team Member Direct
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Provision an active user with immediate login credentials.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="e.g. sarah@company.com"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Role Permission
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {roles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label} — {r.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingId === 'create'}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-sky-500 transition disabled:opacity-50"
                  >
                    {savingId === 'create' ? 'Creating...' : 'Create Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Reset Password */}
        {activeModal === 'password' && passwordTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                    <Key className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Reset Password
                  </h3>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enter a new password for <span className="font-bold text-gray-800 dark:text-gray-200">{passwordTargetUser.name || passwordTargetUser.email}</span>.
                </p>

                <div>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingId === 'password'}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-sky-500 transition disabled:opacity-50"
                  >
                    {savingId === 'password' ? 'Updating...' : 'Set Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
}
