import prisma from './prisma';
import { sendEmail } from './email';

export const WORKFLOW_TRIGGERS = ['LEAD_CREATED','LEAD_STAGE_CHANGED','TASK_CREATED','TASK_COMPLETED','LEAD_UPDATED','ACTIVITY_CREATED','OUTREACH_SENT','OUTREACH_REPLIED','LEAD_INACTIVE'] as const;
export const WORKFLOW_ACTIONS = ['CREATE_TASK','UPDATE_STAGE','ASSIGN_USER','ADD_NOTE','SEND_EMAIL','CREATE_ACTIVITY','SET_FOLLOW_UP'] as const;
export type Trigger = (typeof WORKFLOW_TRIGGERS)[number];

export const TRIGGER_LABELS: Record<Trigger,string> = {
  LEAD_CREATED:'New lead created', LEAD_STAGE_CHANGED:'Lead/deal stage changed', TASK_CREATED:'Task created', TASK_COMPLETED:'Task completed',
  LEAD_UPDATED:'Customer/contact updated', ACTIVITY_CREATED:'New workspace activity', OUTREACH_SENT:'Outreach sent', OUTREACH_REPLIED:'Outreach replied', LEAD_INACTIVE:'Lead inactive'
};

export function parseObject(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }

function normalize(v:any){ return String(v ?? '').trim().toUpperCase(); }
function matchesConditions(config: Record<string,any>, context:any) {
  const c = parseObject(config.conditions || config);
  const lead = context.lead || {};
  const task = context.task || {};
  const pairs: [any,any][] = [
    [c.stage, lead.pipelineStage], [c.pipelineStage, lead.pipelineStage], [c.status, lead.outreachStatus || task.completed],
    [c.assignedUserId, lead.assignedToId || task.assignedToId], [c.source, lead.leadSource], [c.priority, task.priority],
  ];
  for (const [expected, actual] of pairs) if (expected !== undefined && String(expected) !== String(actual ?? '')) return false;
  if (c.field && typeof c.field === 'object') {
    const field = String(c.field.name || '').trim(); const expected = c.field.value;
    if (field && String(lead[field] ?? '') !== String(expected ?? '')) return false;
  }
  if (c.inactiveDays) {
    const last = lead.lastContact ? new Date(lead.lastContact).getTime() : 0;
    if (last && (Date.now()-last)/86400000 < Number(c.inactiveDays)) return false;
  }
  if (c.channel && normalize(c.channel) !== normalize(context.outreachType)) return false;
  if (c.outreachStatus && normalize(c.outreachStatus) !== normalize(context.outreachStatus)) return false;
  return true;
}

async function currentUsage(organizationId:string){
  const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return prisma.automationExecution.count({ where: { organizationId, executedAt: { gte: start } } });
}

export async function executeAutomationWorkflows(input:{ organizationId:string; triggerType:Trigger; leadId?:string|null; taskId?:string|null; outreachType?:string|null; outreachStatus?:string|null; manual?:boolean; eventId?:string; }) {
  const org = await prisma.organization.findUnique({ where:{id:input.organizationId}, select:{id:true,automationRunLimit:true,planStatus:true,suspendedAt:true} });
  if (!org) return { executed:0, results:[], limited:false };
  if (org.suspendedAt) return { executed:0, results:[], limited:true, reason:'Workspace is suspended.' };
  const lead = input.leadId ? await prisma.lead.findFirst({ where:{id:input.leadId,organizationId:input.organizationId} }) : null;
  const task = input.taskId ? await prisma.task.findFirst({ where:{id:input.taskId,organizationId:input.organizationId} }) : null;
  const workflows = await prisma.automationWorkflow.findMany({ where:{organizationId:input.organizationId,isActive:true,triggerType:input.triggerType}, orderBy:{createdAt:'asc'} });
  const results:any[]=[]; let usage=await currentUsage(input.organizationId);
  for (const workflow of workflows) {
    if (usage >= org.automationRunLimit) { results.push({workflowId:workflow.id,status:'SKIPPED',message:`Monthly automation limit of ${org.automationRunLimit} reached.`}); continue; }
    const context={...input,lead,task,triggerType:input.triggerType};
    if (!matchesConditions(parseObject(workflow.triggerConfig),context)) continue;
    const key = `${workflow.id}:${input.eventId || input.triggerType}:${input.leadId || ''}:${input.taskId || ''}`;
    const prior = await prisma.automationExecution.findUnique({ where:{executionKey:key} });
    if (prior) { results.push(prior); continue; }
    let status='COMPLETED', message='';
    try {
      const cfg=parseObject(workflow.actionConfig);
      if (workflow.actionType==='CREATE_TASK') {
        const delay=Math.max(0,Number(cfg.delayHours ?? 24)); const marker=`[WORKFLOW:${workflow.id}]`;
        const exists=await prisma.task.findFirst({where:{organizationId:input.organizationId,leadId:lead?.id||null,completed:false,description:{contains:marker}}});
        if(exists){status='SKIPPED';message='A matching workflow task is already open.';} else {
          await prisma.task.create({data:{organizationId:input.organizationId,leadId:lead?.id||null,assignedToId:cfg.assignedToId||lead?.assignedToId||null,title:String(cfg.title||`Follow up with ${lead?.contactName||'customer'}`),description:`${marker} ${String(cfg.description||'Created automatically by a workflow.')}`,dueDate:new Date(Date.now()+delay*3600000),priority:['low','medium','high'].includes(String(cfg.priority))?String(cfg.priority):'medium'}});
          message='Created a follow-up task.';
        }
      } else if(workflow.actionType==='UPDATE_STAGE') {
        if(!lead) throw new Error('This action requires a lead.'); const stage=normalize(cfg.stage); const allowed=['NEW_LEAD','RESEARCHING','CONTACTED','FOLLOW_UP','INTERESTED','PROPOSAL','WON','LOST']; if(!allowed.includes(stage)) throw new Error('Invalid pipeline stage.');
        await prisma.lead.update({where:{id:lead.id},data:{pipelineStage:stage as any}}); message=`Moved lead to ${stage.replaceAll('_',' ')}.`;
      } else if(workflow.actionType==='ASSIGN_USER') {
        if(!lead) throw new Error('This action requires a lead.'); const user=await prisma.user.findFirst({where:{id:String(cfg.userId||''),organizationId:input.organizationId,isActive:true}}); if(!user) throw new Error('Assigned user was not found in this workspace.');
        await prisma.lead.update({where:{id:lead.id},data:{assignedToId:user.id}}); message=`Assigned lead to ${user.name||user.email}.`;
      } else if(workflow.actionType==='ADD_NOTE') {
        if(!lead) throw new Error('This action requires a lead.'); const note=String(cfg.note||'Automated workflow note.').trim(); await prisma.lead.update({where:{id:lead.id},data:{notes:[lead.notes,note].filter(Boolean).join('\n\n')}}); message='Added an internal lead note.';
      } else if(workflow.actionType==='SEND_EMAIL') {
        const to=String(cfg.to||lead?.email||'').trim(); if(!to) throw new Error('No recipient email is available.'); const subject=String(cfg.subject||`Update from ${workflow.name}`); const text=String(cfg.body||`Automated message from ${workflow.name}.`); const result=await sendEmail({to,subject,text}); message=result.sent?`Email sent to ${to}.`:`Email skipped: ${result.reason}.`;
      } else if(workflow.actionType==='CREATE_ACTIVITY') {
        if(!lead) throw new Error('This action requires a lead.'); await prisma.activityEvent.create({data:{leadId:lead.id,type:'WORKFLOW',action:String(cfg.action||'Automated follow-up activity'),metadata:{workflowId:workflow.id}}}); message='Created a follow-up activity.';
      } else if(workflow.actionType==='SET_FOLLOW_UP') {
        if(!lead) throw new Error('This action requires a lead.'); const delay=Math.max(1,Number(cfg.delayHours??24)); const nextFollowUp=new Date(Date.now()+delay*3600000); await prisma.lead.update({where:{id:lead.id},data:{nextFollowUp}}); message='Set the next follow-up date.';
      } else throw new Error('Unsupported workflow action.');
    } catch(e:any){status='FAILED';message=e?.message||'Workflow execution failed.';}
    const execution=await prisma.automationExecution.create({data:{organizationId:input.organizationId,workflowId:workflow.id,leadId:input.leadId||null,triggerType:input.triggerType,status,message,executionKey:key,metadata:{taskId:input.taskId||null,outreachType:input.outreachType||null,outreachStatus:input.outreachStatus||null,manual:Boolean(input.manual)}}});
    results.push(execution); usage++;
  }
  return {executed:results.length,results,limited:usage>=org.automationRunLimit};
}

export async function runInactiveLeadWorkflows(organizationId?:string){
  const orgs=organizationId?[{id:organizationId}]:await prisma.organization.findMany({select:{id:true}}); let executed=0;
  for(const org of orgs){ const workflows=await prisma.automationWorkflow.findMany({where:{organizationId:org.id,isActive:true,triggerType:'LEAD_INACTIVE'}}); if(!workflows.length) continue; const min=Math.min(...workflows.map(w=>Math.max(1,Number(parseObject(w.triggerConfig).inactiveDays??7)))); const cutoff=new Date(Date.now()-min*86400000); const leads=await prisma.lead.findMany({where:{organizationId:org.id,pipelineStage:{in:['NEW_LEAD','RESEARCHING','CONTACTED','FOLLOW_UP','INTERESTED','PROPOSAL'] as any},OR:[{lastContact:null},{lastContact:{lt:cutoff}}]},select:{id:true},take:500}); for(const lead of leads){const r=await executeAutomationWorkflows({organizationId:org.id,triggerType:'LEAD_INACTIVE',leadId:lead.id,manual:true,eventId:`inactive:${lead.id}:${cutoff.toISOString().slice(0,10)}`}); executed+=r.executed;}}
  return {executed};
}
