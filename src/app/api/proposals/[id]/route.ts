import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { logLeadActivity } from "../../../../../lib/automation";
import { getManagerIds, notifyMany, proposalHref } from "../../../../../lib/notifications";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: any = {};
    for (const key of ["title", "description", "status"]) if (body[key] !== undefined) data[key] = body[key];
    if (body.value !== undefined) data.value = body.value === "" || body.value == null ? null : Number(body.value);
    if (body.status === "sent" && body.previousStatus !== "sent") data.sentAt = new Date();
    if (["accepted","rejected"].includes(body.status) && body.previousStatus !== body.status) data.respondedAt = new Date();
    const proposal = await prisma.proposal.update({ where: { id }, data, include: { lead: true } });
    await prisma.$transaction(async (tx) => {
      if (body.status === "sent") await tx.lead.update({ where: { id: proposal.leadId }, data: { pipelineStage: "PROPOSAL", lastContact: new Date() } });
      if (body.status === "accepted") await tx.lead.update({ where: { id: proposal.leadId }, data: { pipelineStage: "WON", lastContact: new Date() } });
      if (body.status === "rejected") await tx.lead.update({ where: { id: proposal.leadId }, data: { pipelineStage: "LOST", lastContact: new Date() } });
      if (body.status && body.previousStatus !== body.status) await logLeadActivity(tx, proposal.leadId, "PROPOSAL", `Proposal ${body.status}`, { proposalId: proposal.id, title: proposal.title, value: proposal.value });
    });
    if (body.status && body.previousStatus !== body.status && ['sent', 'accepted', 'rejected'].includes(body.status)) {
      const leadOwner = await prisma.lead.findUnique({ where: { id: proposal.leadId }, select: { assignedToId: true } });
      const managers = await getManagerIds();
      const label = body.status === 'accepted' ? 'Proposal accepted' : body.status === 'rejected' ? 'Proposal rejected' : 'Proposal sent';
      await notifyMany([leadOwner?.assignedToId, ...managers], { type: `PROPOSAL_${String(body.status).toUpperCase()}`, title: label, message: `"${proposal.title}" was ${body.status}.`, href: proposalHref(), category: 'proposal' });
    }
    return NextResponse.json(proposal);
  } catch (error) {
    console.error("Failed to update proposal:", error);
    return NextResponse.json({ error: "Failed to update proposal" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.proposal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete proposal" }, { status: 500 });
  }
}
