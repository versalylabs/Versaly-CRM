'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Percent,
  Sparkles,
  KanbanSquare,
  ArrowRight,
  Info,
  X,
} from 'lucide-react';
import {
  PipelineStageItem,
  STAGE_COLOR_OPTIONS,
  getStageColorStyles,
} from '@/lib/pipelineStages';

const glassInput =
  'w-full rounded-xl bg-[#0e172a] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition';

export default function PipelineSettingsPage() {
  const [stages, setStages] = useState<PipelineStageItem[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, { count: number; totalValue: number }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStageItem | null>(null);
  const [deletingStage, setDeletingStage] = useState<PipelineStageItem | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('');

  // Create form state
  const [formLabel, setFormLabel] = useState('');
  const [formProbability, setFormProbability] = useState<number>(50);
  const [formColor, setFormColor] = useState('cyan');
  const [formCategory, setFormCategory] = useState<'ACTIVE' | 'WON' | 'LOST'>('ACTIVE');

  // Load stages & lead counts
  const loadStages = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pipeline/stages');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load pipeline stages.');
      setStages(data.stages || []);
      setLeadCounts(data.leadCounts || {});
    } catch (err: any) {
      setError(err.message || 'Error loading stages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStages();
  }, []);

  // Open Create Modal
  const openCreateModal = () => {
    setFormLabel('');
    setFormProbability(50);
    setFormColor('cyan');
    setFormCategory('ACTIVE');
    setCreateModalOpen(true);
  };

  // Submit Create Stage
  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/pipeline/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: formLabel.trim(),
          probability: formProbability,
          color: formColor,
          category: formCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create stage.');
      setSuccess(`Stage "${formLabel}" added successfully.`);
      setCreateModalOpen(false);
      await loadStages();
    } catch (err: any) {
      setError(err.message || 'Failed to create stage.');
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (stage: PipelineStageItem) => {
    setEditingStage({ ...stage });
  };

  // Submit Edit Stage
  const handleUpdateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/pipeline/stages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStage.id,
          label: editingStage.label.trim(),
          probability: editingStage.probability,
          color: editingStage.color,
          category: editingStage.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update stage.');
      setSuccess(`Stage "${editingStage.label}" updated successfully.`);
      setEditingStage(null);
      await loadStages();
    } catch (err: any) {
      setError(err.message || 'Failed to update stage.');
    } finally {
      setSaving(false);
    }
  };

  // Move stage up or down in order
  const handleMoveStage = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const [moved] = newStages.splice(index, 1);
    newStages.splice(targetIndex, 0, moved);

    // Optimistically update
    setStages(newStages.map((s, idx) => ({ ...s, order: idx })));

    try {
      const reorderPayload = newStages.map((s, idx) => ({ id: s.id, order: idx }));
      const res = await fetch('/api/pipeline/stages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: reorderPayload }),
      });
      if (!res.ok) {
        await loadStages();
      }
    } catch {
      await loadStages();
    }
  };

  // Open Delete Modal
  const openDeleteModal = (stage: PipelineStageItem) => {
    setDeletingStage(stage);
    const otherStage = stages.find((s) => s.key !== stage.key);
    setReassignTarget(otherStage?.key || 'NEW_LEAD');
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingStage) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const currentLeadsInStage = leadCounts[deletingStage.key]?.count || 0;
      let url = `/api/pipeline/stages?id=${encodeURIComponent(deletingStage.id || '')}&key=${encodeURIComponent(deletingStage.key)}`;
      if (currentLeadsInStage > 0 && reassignTarget) {
        url += `&reassignTo=${encodeURIComponent(reassignTarget)}`;
      }

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete stage.');
      setSuccess(`Stage "${deletingStage.label}" deleted.`);
      setDeletingStage(null);
      await loadStages();
    } catch (err: any) {
      setError(err.message || 'Failed to delete stage.');
    } finally {
      setSaving(false);
    }
  };

  // Reset to default stages
  const handleResetDefaults = async () => {
    if (!confirm('Reset all pipeline stages back to the default CRM configuration? Custom names will be restored to defaults.')) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/pipeline/stages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset stages.');
      setSuccess('Stages reset to default configuration.');
      await loadStages();
    } catch (err: any) {
      setError(err.message || 'Failed to reset.');
    } finally {
      setSaving(false);
    }
  };

  const activeStages = stages.filter((s) => s.category === 'ACTIVE');
  const closedStages = stages.filter((s) => s.category !== 'ACTIVE');
  const totalLeadsInFunnel = Object.values(leadCounts).reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="min-h-screen bg-[#14213d] text-slate-100">
      <div className="container-custom py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Workspace Customization
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">
              Pipeline Stages & Deal Workflow
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 max-w-2xl">
              Configure deal stages, win probabilities, and funnel progression tailored to your company's sales process.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/pipeline"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <KanbanSquare className="h-3.5 w-3.5 text-cyan-400" />
              <span>View Pipeline Board</span>
            </Link>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-500 hover:to-cyan-400"
            >
              <Plus className="h-4 w-4" />
              <span>Add Stage</span>
            </button>
          </div>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          <Link
            href="/settings"
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition"
          >
            👤 Profile & Security
          </Link>
          <Link
            href="/settings/pipeline"
            className="rounded-xl px-4 py-2 text-xs font-bold bg-sky-500/20 text-cyan-300 border border-sky-400/30 transition"
          >
            🎯 Pipeline Stages
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

        {/* Messages */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-400 hover:text-white">✕</button>
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Stages', value: stages.length, icon: Layers, color: 'text-cyan-400' },
            { label: 'Active Funnel Stages', value: activeStages.length, icon: Target, color: 'text-sky-400' },
            { label: 'Closed Outcome Stages', value: closedStages.length, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Leads Managed in Stages', value: totalLeadsInFunnel, icon: Percent, color: 'text-amber-400' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1b2a4a]/80 to-[#0e172a]/90 p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.28)] backdrop-blur-xl"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                  <Icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <p className={`mt-2 text-2xl font-extrabold ${item.color}`}>{item.value}</p>
              </div>
            );
          })}
        </div>

        {/* Pipeline Stage Management Container */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1b2a4a]/80 shadow-[0_8px_32px_0_rgba(0,0,0,0.28)] backdrop-blur-xl p-6 space-y-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Target className="h-4 w-4 text-cyan-400" />
                <span>Configured Deal Progression</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Reorder stages using the arrow controls. Drag-and-drop columns on the Pipeline board automatically align with this sequence.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetDefaults}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                <span>Reset Defaults</span>
              </button>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-[#0e172a] hover:bg-cyan-400 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Stage</span>
              </button>
            </div>
          </div>

          {/* Stage List Table */}
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <div className="text-2xl animate-pulse">🎯</div>
              <p>Loading pipeline stages...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stages.map((stage, idx) => {
                const style = getStageColorStyles(stage.color);
                const leadInfo = leadCounts[stage.key] || { count: 0, totalValue: 0 };

                return (
                  <div
                    key={stage.id || stage.key}
                    className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0e172a]/70 p-4 transition-all hover:border-cyan-400/40 hover:bg-[#0e172a]/90"
                  >
                    {/* Left: Reorder arrows & Badge */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleMoveStage(idx, 'up')}
                          disabled={idx === 0 || saving}
                          className="h-6 w-6 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition"
                          title="Move stage earlier in funnel"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveStage(idx, 'down')}
                          disabled={idx === stages.length - 1 || saving}
                          className="h-6 w-6 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition"
                          title="Move stage later in funnel"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-[11px] font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className={`h-3 w-3 rounded-full ${style.dotColor}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">{stage.label}</h3>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${style.badgeColor}`}>
                              {stage.probability}% Win Prob
                            </span>
                            {stage.category !== 'ACTIVE' && (
                              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                {stage.category === 'WON' ? 'Closed Won' : 'Closed Lost'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Key: {stage.key}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Lead Count & Action Buttons */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right mr-2 hidden sm:block">
                        <span className="text-xs font-semibold text-white">
                          {leadInfo.count} {leadInfo.count === 1 ? 'deal' : 'deals'}
                        </span>
                        <p className="text-[10px] text-slate-400">Active in stage</p>
                      </div>

                      <button
                        onClick={() => openEditModal(stage)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => openDeleteModal(stage)}
                        disabled={stages.length <= 2}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 transition"
                        title="Delete stage"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tips Info Box */}
          <div className="rounded-xl border border-sky-400/20 bg-sky-950/20 p-4 text-xs text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-sky-400">
              <Info className="h-4 w-4" />
              <span>How Pipeline Customization Works</span>
            </div>
            <p className="leading-relaxed">
              When you add or edit stages, they are immediately reflected on your <strong>Kanban Pipeline</strong>, <strong>Lead Filters</strong>, and <strong>Forecasting Metrics</strong>. Win probabilities are multiplied with deal values to calculate weighted expected pipeline revenue.
            </p>
          </div>
        </div>
      </div>

      {/* ==========================================
          MODAL: Add New Stage
         ========================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateStage}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1b2a4a] via-[#16233f] to-[#0e172a] p-6 shadow-2xl space-y-4"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-cyan-400" />
                <span>Add Pipeline Stage</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Stage Name *</label>
                <input
                  required
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. Technical Demo, Negotiation, Review"
                  className={glassInput}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Win Probability (%)</label>
                  <span className="text-xs font-bold text-cyan-400">{formProbability}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formProbability}
                  onChange={(e) => setFormProbability(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>0% (Cold)</span>
                  <span>50% (Mid-Funnel)</span>
                  <span>100% (Guaranteed)</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Stage Theme Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {STAGE_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormColor(c.id)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-xs transition ${
                        formColor === c.id
                          ? 'border-cyan-400 bg-cyan-950/40 text-white font-bold'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span className={`h-3 w-3 rounded-full ${c.preview}`} />
                      <span className="truncate">{c.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Stage Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className={glassInput}
                >
                  <option value="ACTIVE" className="bg-[#14213d] text-white">Active Funnel (In Progress)</option>
                  <option value="WON" className="bg-[#14213d] text-white">Closed Won (Success / Converted)</option>
                  <option value="LOST" className="bg-[#14213d] text-white">Closed Lost (Archived / Unqualified)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-500 hover:to-cyan-400 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Stage'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          MODAL: Edit Stage
         ========================================== */}
      {editingStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleUpdateStage}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1b2a4a] via-[#16233f] to-[#0e172a] p-6 shadow-2xl space-y-4"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-cyan-400" />
                <span>Edit Stage: {editingStage.label}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingStage(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Stage Name *</label>
                <input
                  required
                  value={editingStage.label}
                  onChange={(e) => setEditingStage({ ...editingStage, label: e.target.value })}
                  className={glassInput}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Win Probability (%)</label>
                  <span className="text-xs font-bold text-cyan-400">{editingStage.probability}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={editingStage.probability}
                  onChange={(e) => setEditingStage({ ...editingStage, probability: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Stage Theme Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {STAGE_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditingStage({ ...editingStage, color: c.id })}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-xs transition ${
                        editingStage.color === c.id
                          ? 'border-cyan-400 bg-cyan-950/40 text-white font-bold'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span className={`h-3 w-3 rounded-full ${c.preview}`} />
                      <span className="truncate">{c.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Stage Category</label>
                <select
                  value={editingStage.category}
                  onChange={(e) => setEditingStage({ ...editingStage, category: e.target.value as any })}
                  className={glassInput}
                >
                  <option value="ACTIVE" className="bg-[#14213d] text-white">Active Funnel (In Progress)</option>
                  <option value="WON" className="bg-[#14213d] text-white">Closed Won (Success / Converted)</option>
                  <option value="LOST" className="bg-[#14213d] text-white">Closed Lost (Archived / Unqualified)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingStage(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-[#0e172a] hover:bg-cyan-400 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          MODAL: Delete Stage & Lead Reassignment
         ========================================== */}
      {deletingStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1b2a4a] via-[#16233f] to-[#0e172a] p-6 shadow-2xl space-y-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-400" />
                <span>Delete Stage: {deletingStage.label}</span>
              </h3>
              <button
                type="button"
                onClick={() => setDeletingStage(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong>{deletingStage.label}</strong> from your pipeline?
            </p>

            {/* Check if leads exist in this stage */}
            {(leadCounts[deletingStage.key]?.count || 0) > 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {leadCounts[deletingStage.key]?.count} {leadCounts[deletingStage.key]?.count === 1 ? 'deal is' : 'deals are'} currently in this stage.
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Select where to safely move these deals before deleting this stage:
                </p>
                <select
                  value={reassignTarget}
                  onChange={(e) => setReassignTarget(e.target.value)}
                  className={glassInput}
                >
                  {stages
                    .filter((s) => s.key !== deletingStage.key)
                    .map((s) => (
                      <option key={s.key} value={s.key} className="bg-[#14213d] text-white">
                        Move to: {s.label} ({s.probability}%)
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                There are currently no active deals in this stage. It can be safely removed.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDeletingStage(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 transition disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
