export interface PipelineStageItem {
  id?: string;
  key: string;
  label: string;
  probability: number;
  color: string;
  category: 'ACTIVE' | 'WON' | 'LOST';
  order: number;
  isDefault?: boolean;
}

export const DEFAULT_PIPELINE_STAGES: PipelineStageItem[] = [
  {
    key: 'NEW_LEAD',
    label: 'New Lead',
    probability: 10,
    color: 'slate',
    category: 'ACTIVE',
    order: 0,
    isDefault: true,
  },
  {
    key: 'RESEARCHING',
    label: 'Researching',
    probability: 20,
    color: 'blue',
    category: 'ACTIVE',
    order: 1,
    isDefault: true,
  },
  {
    key: 'CONTACTED',
    label: 'Contacted',
    probability: 35,
    color: 'cyan',
    category: 'ACTIVE',
    order: 2,
    isDefault: true,
  },
  {
    key: 'FOLLOW_UP',
    label: 'Follow Up',
    probability: 50,
    color: 'amber',
    category: 'ACTIVE',
    order: 3,
    isDefault: true,
  },
  {
    key: 'INTERESTED',
    label: 'Interested',
    probability: 65,
    color: 'emerald',
    category: 'ACTIVE',
    order: 4,
    isDefault: true,
  },
  {
    key: 'PROPOSAL',
    label: 'Proposal',
    probability: 80,
    color: 'sky',
    category: 'ACTIVE',
    order: 5,
    isDefault: true,
  },
  {
    key: 'WON',
    label: 'Closed Won',
    probability: 100,
    color: 'emerald',
    category: 'WON',
    order: 6,
    isDefault: true,
  },
  {
    key: 'LOST',
    label: 'Closed Lost',
    probability: 0,
    color: 'rose',
    category: 'LOST',
    order: 7,
    isDefault: true,
  },
];

export const STAGE_COLOR_OPTIONS = [
  { id: 'slate', name: 'Slate / Neutral', preview: 'bg-slate-500' },
  { id: 'blue', name: 'Blue', preview: 'bg-blue-500' },
  { id: 'cyan', name: 'Cyan / Sky', preview: 'bg-cyan-500' },
  { id: 'sky', name: 'Deep Sky', preview: 'bg-sky-500' },
  { id: 'amber', name: 'Amber / Gold', preview: 'bg-amber-500' },
  { id: 'emerald', name: 'Emerald / Green', preview: 'bg-emerald-500' },
  { id: 'purple', name: 'Purple / Violet', preview: 'bg-purple-500' },
  { id: 'rose', name: 'Rose / Red', preview: 'bg-rose-500' },
];

export function getStageColorStyles(colorKey: string) {
  switch (colorKey) {
    case 'blue':
      return {
        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        dotColor: 'bg-blue-500 shadow-blue-500/50',
        accentBorder: 'border-t-blue-500',
        columnBg: 'bg-blue-950/20',
        pill: 'border-blue-400/40 text-blue-300 bg-blue-950/40',
      };
    case 'cyan':
      return {
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        dotColor: 'bg-cyan-500 shadow-cyan-500/50',
        accentBorder: 'border-t-cyan-500',
        columnBg: 'bg-cyan-950/20',
        pill: 'border-cyan-400/40 text-cyan-300 bg-cyan-950/40',
      };
    case 'sky':
      return {
        badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
        dotColor: 'bg-sky-500 shadow-sky-500/50',
        accentBorder: 'border-t-sky-500',
        columnBg: 'bg-sky-950/20',
        pill: 'border-sky-400/40 text-sky-300 bg-sky-950/40',
      };
    case 'amber':
      return {
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        dotColor: 'bg-[#fca311] shadow-[#fca311]/50',
        accentBorder: 'border-t-[#fca311]',
        columnBg: 'bg-amber-950/20',
        pill: 'border-amber-400/40 text-amber-300 bg-amber-950/40',
      };
    case 'emerald':
      return {
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        dotColor: 'bg-emerald-500 shadow-emerald-500/50',
        accentBorder: 'border-t-emerald-500',
        columnBg: 'bg-emerald-950/20',
        pill: 'border-emerald-400/40 text-emerald-300 bg-emerald-950/40',
      };
    case 'purple':
      return {
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        dotColor: 'bg-purple-500 shadow-purple-500/50',
        accentBorder: 'border-t-purple-500',
        columnBg: 'bg-purple-950/20',
        pill: 'border-purple-400/40 text-purple-300 bg-purple-950/40',
      };
    case 'rose':
      return {
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        dotColor: 'bg-rose-500 shadow-rose-500/50',
        accentBorder: 'border-t-rose-500',
        columnBg: 'bg-rose-950/20',
        pill: 'border-rose-400/40 text-rose-300 bg-rose-950/40',
      };
    case 'slate':
    default:
      return {
        badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        dotColor: 'bg-slate-400 shadow-slate-400/50',
        accentBorder: 'border-t-slate-400',
        columnBg: 'bg-slate-900/40',
        pill: 'border-slate-400/40 text-slate-300 bg-slate-900/60',
      };
  }
}

export function slugifyStageKey(label: string): string {
  const slug = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'CUSTOM_STAGE';
}
