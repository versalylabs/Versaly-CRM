import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';

const ACTIVE_STAGES = ['NEW_LEAD', 'RESEARCHING', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED', 'PROPOSAL'];
const MANAGER_ROLES = ['ADMIN', 'MANAGER'];

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[\",\n]/.test(text) ? `\"${text.replace(/\"/g, '\"\"')}\"` : text;
}

function getDateRange(value: string | null) {
  const range = value === '90' || value === '365' || value === 'all' ? value : '30';
  if (range === 'all') return { range, start: null as Date | null, label: 'All time' };
  const days = Number(range);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return { range, start, label: `Last ${days} days` };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const params = new URL(req.url).searchParams;
    const canViewTeam = MANAGER_ROLES.includes(session.user.role || '');
    const requestedScope = params.get('scope');
    const scope = canViewTeam && requestedScope === 'mine' ? 'mine' : 'team';
    const { range, start, label } = getDateRange(params.get('range'));

    const organizationId = session.user.organizationId;
    const orgWhere = organizationId ? { organizationId } : {};
    const leadOwnerWhere = {
      ...orgWhere,
      ...(scope === 'mine' ? { assignedToId: session.user.id } : {}),
    };
    const taskOwnerWhere = {
      ...orgWhere,
      ...(scope === 'mine' ? { assignedToId: session.user.id } : {}),
    };
    const createdSince = start ? { gte: start } : undefined;
    const leadWhere: any = { ...leadOwnerWhere, ...(createdSince ? { createdAt: createdSince } : {}) };
    const outreachWhere: any = {
      ...(scope === 'mine' ? { lead: { is: leadOwnerWhere } } : (organizationId ? { lead: { is: { organizationId } } } : {})),
      ...(createdSince ? { sentAt: createdSince } : {}),
    };
    const proposalWhere: any = {
      ...(scope === 'mine' ? { lead: { is: leadOwnerWhere } } : (organizationId ? { lead: { is: { organizationId } } } : {})),
      ...(createdSince ? { createdAt: createdSince } : {}),
    };
    const taskWhere: any = { ...taskOwnerWhere, ...(createdSince ? { createdAt: createdSince } : {}) };

    const [leads, outreach, proposals, tasks, stageGroups] = await Promise.all([
      prisma.lead.findMany({
        where: leadWhere,
        select: { id: true, leadSource: true, pipelineStage: true, dealValue: true, dateAdded: true, createdAt: true, updatedAt: true, assignedToId: true },
      }),
      prisma.outreachLog.findMany({
        where: outreachWhere,
        select: { id: true, type: true, status: true, sentAt: true, leadId: true },
      }),
      prisma.proposal.findMany({
        where: proposalWhere,
        select: { id: true, status: true, value: true, createdAt: true, updatedAt: true, leadId: true },
      }),
      prisma.task.findMany({
        where: taskWhere,
        select: { id: true, completed: true, dueDate: true, priority: true, createdAt: true, assignedToId: true },
      }),
      prisma.lead.groupBy({
        by: ['pipelineStage'],
        where: { ...leadOwnerWhere },
        _count: { _all: true },
        _sum: { dealValue: true },
      }),
    ]);

    const sourceMap = new Map<string, { source: string; leads: number; won: number; lost: number; value: number }>();
    for (const lead of leads) {
      const current = sourceMap.get(lead.leadSource) || { source: lead.leadSource, leads: 0, won: 0, lost: 0, value: 0 };
      current.leads += 1;
      if (lead.pipelineStage === 'WON') current.won += 1;
      if (lead.pipelineStage === 'LOST') current.lost += 1;
      current.value += lead.dealValue || 0;
      sourceMap.set(lead.leadSource, current);
    }
    const leadSources = Array.from(sourceMap.values())
      .map((item) => ({ ...item, conversionRate: item.leads ? (item.won / item.leads) * 100 : 0 }))
      .sort((a, b) => b.leads - a.leads);

    const stageMap = new Map(stageGroups.map((item) => [item.pipelineStage, { count: item._count._all, value: item._sum.dealValue || 0 }]));
    const stageOrder = ['NEW_LEAD', 'RESEARCHING', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED', 'PROPOSAL', 'WON', 'LOST'];
    const pipeline = stageOrder.map((stage) => ({ stage, count: stageMap.get(stage as any)?.count || 0, value: stageMap.get(stage as any)?.value || 0 }));

    const outreachTypes = new Map<string, number>();
    const outreachStatuses = new Map<string, number>();
    for (const item of outreach) {
      outreachTypes.set(item.type, (outreachTypes.get(item.type) || 0) + 1);
      outreachStatuses.set(item.status, (outreachStatuses.get(item.status) || 0) + 1);
    }
    const outreachSummary = Array.from(outreachTypes.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
    const statusSummary = Array.from(outreachStatuses.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
    const replies = outreach.filter((item) => item.status === 'REPLIED').length;

    const proposalStatuses = new Map<string, { count: number; value: number }>();
    for (const item of proposals) {
      const current = proposalStatuses.get(item.status) || { count: 0, value: 0 };
      current.count += 1;
      current.value += item.value || 0;
      proposalStatuses.set(item.status, current);
    }
    const proposalSummary = Array.from(proposalStatuses.entries()).map(([status, value]) => ({ status, ...value })).sort((a, b) => b.count - a.count);
    const accepted = proposals.filter((item) => item.status === 'accepted').length;
    const responded = proposals.filter((item) => ['accepted', 'rejected'].includes(item.status)).length;

    const now = new Date();
    const completed = tasks.filter((task) => task.completed).length;
    const nowTime = now.getTime();
    const overdue = tasks.filter((task) => !task.completed && task.dueDate && new Date(task.dueDate).getTime() < nowTime).length;
    const priorityMap = new Map<string, { priority: string; total: number; completed: number }>();
    for (const task of tasks) {
      const current = priorityMap.get(task.priority) || { priority: task.priority, total: 0, completed: 0 };
      current.total += 1;
      if (task.completed) current.completed += 1;
      priorityMap.set(task.priority, current);
    }

    const wonLeads = leads.filter((lead) => lead.pipelineStage === 'WON');
    const salesCycles = wonLeads.map((lead) => (lead.updatedAt.getTime() - (lead.dateAdded || lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const averageSalesCycleDays = salesCycles.length ? salesCycles.reduce((sum, val) => sum + val, 0) / salesCycles.length : 0;

    const trendMap = new Map<string, { key: string; leads: number; won: number; outreach: number; proposals: number }>();
    const addTrend = (date: Date) => {
      const key = monthKey(date);
      if (!trendMap.has(key)) trendMap.set(key, { key, leads: 0, won: 0, outreach: 0, proposals: 0 });
      return trendMap.get(key)!;
    };
    leads.forEach((lead) => { const item = addTrend(lead.createdAt); item.leads += 1; if (lead.pipelineStage === 'WON') item.won += 1; });
    outreach.forEach((item) => { addTrend(item.sentAt).outreach += 1; });
    proposals.forEach((item) => { addTrend(item.createdAt).proposals += 1; });
    const trends = Array.from(trendMap.values()).sort((a, b) => a.key.localeCompare(b.key)).map((item) => ({ ...item, label: monthLabel(item.key) }));

    let agents: any[] = [];
    if (canViewTeam && scope === 'team') {
      const users = await prisma.user.findMany({ where: { isActive: true, ...(organizationId ? { organizationId } : {}) }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } });
      const allLeads = await prisma.lead.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, select: { assignedToId: true, pipelineStage: true, dealValue: true } });
      const allTasks = await prisma.task.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, select: { assignedToId: true, completed: true, dueDate: true } });
      const today = new Date();
      agents = users.map((user) => {
        const userLeads = allLeads.filter((lead) => lead.assignedToId === user.id);
        const userTasks = allTasks.filter((task) => task.assignedToId === user.id);
        const won = userLeads.filter((lead) => lead.pipelineStage === 'WON').length;
        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role,
          leads: userLeads.length,
          won,
          conversionRate: userLeads.length ? (won / userLeads.length) * 100 : 0,
          activeValue: userLeads.filter((lead) => ACTIVE_STAGES.includes(lead.pipelineStage)).reduce((sum, lead) => sum + (lead.dealValue || 0), 0),
          openTasks: userTasks.filter((task) => !task.completed).length,
          completedTasks: userTasks.filter((task) => task.completed).length,
          overdueTasks: userTasks.filter((task) => !task.completed && task.dueDate && task.dueDate < today).length,
        };
      });
    }

    const totalLeads = leads.length;
    const won = wonLeads.length;
    const lost = leads.filter((lead) => lead.pipelineStage === 'LOST').length;
    const activeValue = leads.filter((lead) => ACTIVE_STAGES.includes(lead.pipelineStage)).reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
    const wonValue = wonLeads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
    const lostValue = leads.filter((lead) => lead.pipelineStage === 'LOST').reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
    const averageDealSize = won ? wonValue / won : 0;
    const weightedForecast = pipeline.reduce((sum, item) => {
      const probability: Record<string, number> = { NEW_LEAD: 0.10, RESEARCHING: 0.15, CONTACTED: 0.25, FOLLOW_UP: 0.35, INTERESTED: 0.50, PROPOSAL: 0.70, WON: 1, LOST: 0 };
      return sum + item.value * (probability[item.stage] ?? 0);
    }, 0);
    const activeLeadsForAging = leads.filter((lead) => ACTIVE_STAGES.includes(lead.pipelineStage));
    const agingBuckets = [
      { bucket: '0–7 days', min: 0, max: 7 },
      { bucket: '8–30 days', min: 8, max: 30 },
      { bucket: '31–60 days', min: 31, max: 60 },
      { bucket: '61–90 days', min: 61, max: 90 },
      { bucket: '90+ days', min: 91, max: Infinity },
    ].map(({ bucket, min, max }) => {
      const matching = activeLeadsForAging.filter((lead) => {
        const age = Math.max(0, (now.getTime() - (lead.dateAdded || lead.createdAt).getTime()) / 86400000);
        return age >= min && age <= max;
      });
      return { bucket, leads: matching.length, value: matching.reduce((sum, lead) => sum + (lead.dealValue || 0), 0) };
    });
    const funnel = stageOrder.map((stage, index) => {
      const current = pipeline.find((item) => item.stage === stage)!;
      const previous = index === 0 ? current.count : pipeline[index - 1].count;
      return { stage, count: current.count, value: current.value, progressionRate: previous ? (current.count / previous) * 100 : 0 };
    });

    if (params.get('format') === 'csv') {
      const rows = [
        ['Metric', 'Value'],
        ['Report range', label],
        ['Scope', scope],
        ['Total leads', totalLeads],
        ['Won deals', won],
        ['Lost deals', lost],
        ['Conversion rate', `${totalLeads ? (won / totalLeads) * 100 : 0}`],
        ['Active pipeline value', activeValue],
        ['Won value', wonValue],
        ['Lost value', lostValue],
        ['Average won deal size', averageDealSize],
        ['Weighted pipeline forecast', weightedForecast],
        ['Outreach count', outreach.length],
        ['Reply rate', `${outreach.length ? (replies / outreach.length) * 100 : 0}`],
        ['Proposal count', proposals.length],
        ['Proposal win rate', `${responded ? (accepted / responded) * 100 : 0}`],
        ['Task completion rate', `${tasks.length ? (completed / tasks.length) * 100 : 0}`],
        ['Overdue tasks', overdue],
        ['Average sales cycle days', averageSalesCycleDays],
      ];
      const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
      return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="straten-report-${range}.csv"`, 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({
      generatedAt: now.toISOString(),
      viewer: { id: session.user.id, name: session.user.name || session.user.email || 'User', role: session.user.role || 'AGENT', scope, canViewTeam },
      filters: { range, label },
      summary: {
        totalLeads,
        won,
        lost,
        conversionRate: totalLeads ? (won / totalLeads) * 100 : 0,
        activeValue,
        outreachCount: outreach.length,
        replyRate: outreach.length ? (replies / outreach.length) * 100 : 0,
        proposalCount: proposals.length,
        proposalWinRate: responded ? (accepted / responded) * 100 : 0,
        taskCompletionRate: tasks.length ? (completed / tasks.length) * 100 : 0,
        overdueTasks: overdue,
        averageSalesCycleDays,
        averageDealSize,
        wonValue,
        lostValue,
        weightedForecast,
      },
      funnel,
      agingBuckets,
      leadSources,
      pipeline,
      outreach: { total: outreach.length, replied: replies, byType: outreachSummary, byStatus: statusSummary },
      proposals: { total: proposals.length, accepted, responded, byStatus: proposalSummary },
      tasks: { total: tasks.length, completed, open: tasks.length - completed, overdue, byPriority: Array.from(priorityMap.values()).sort((a, b) => b.total - a.total) },
      trends,
      agents,
    });
  } catch (error) {
    console.error('Failed to load reports:', error);
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
  }
}
