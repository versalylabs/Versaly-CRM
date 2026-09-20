import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { logLeadActivity } from "../../../../lib/automation";
import { getManagerIds, notifyMany, proposalHref } from "../../../../lib/notifications";

export async function GET() {
  try {
    const proposals = await prisma.proposal.findMany({
      include: { lead: { select: { id: true, contactName: true, companyName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(proposals);
  } catch (error) {
    console.error("Failed to fetch proposals:", error);
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const count = await prisma.proposal.count();
    if (count >= 4) {
      return NextResponse.json(
        { error: "Maximum limit of 4 proposal templates reached. You can only edit existing templates or delete one to add a new one." },
        { status: 400 }
      );
    }
    const body = await request.json();
    if (!body.leadId || !body.title?.trim()) {
      return NextResponse.json({ error: "Lead and proposal title are required" }, { status: 400 });
    }
    const value = body.value === "" || body.value == null ? null : Number(body.value);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: "Proposal value must be a valid positive number" }, { status: 400 });
    }
    const proposal = await prisma.proposal.create({
      data: {
        leadId: body.leadId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        value,
        status: body.status || "draft",
        sentAt: body.status === "sent" ? new Date() : null,
      },
      include: { lead: { select: { id: true, contactName: true, companyName: true, email: true } } },
    });
    await prisma.$transaction(async (tx) => {
      if (proposal.status === "sent") await tx.lead.update({ where: { id: proposal.leadId }, data: { pipelineStage: "PROPOSAL", lastContact: new Date() } });
      await logLeadActivity(tx, proposal.leadId, "PROPOSAL", `Proposal ${proposal.status}`, { proposalId: proposal.id, title: proposal.title, value: proposal.value });
    });
    if (proposal.status === 'sent') {
      const leadOwner = await prisma.lead.findUnique({ where: { id: proposal.leadId }, select: { assignedToId: true } });
      const managers = await getManagerIds();
      await notifyMany([leadOwner?.assignedToId, ...managers], { type: 'PROPOSAL_SENT', title: 'Proposal sent', message: `"${proposal.title}" was sent.`, href: proposalHref(), category: 'proposal' });
    }
    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error("Failed to create proposal:", error);
    return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });
  }
}
