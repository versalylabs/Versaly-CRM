import crypto from 'crypto';
import QRCode from 'qrcode';
import prisma from './prisma';
import { getStageGroups } from './stages';
import { logLeadActivity } from './automation';
import { getManagerIds, notifyMany, proposalHref } from './notifications';
import { balanceDue, docNumber, invoiceStatus, parseItems, priceItems, type LineItem } from './quotes';
import { receiptQrUrl } from './etims';

export const newShareToken = () => crypto.randomBytes(18).toString('base64url');

/** Next document number for a workspace. The atomic increment means two users never get the same number. */
export async function nextSequence(organizationId: string, kind: 'quote' | 'invoice') {
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: kind === 'quote' ? { quoteCounter: { increment: 1 } } : { invoiceCounter: { increment: 1 } },
    select: { quoteCounter: true, invoiceCounter: true },
  });
  return kind === 'quote' ? org.quoteCounter : org.invoiceCounter;
}

/** Recalculated totals for request line items (never trust totals sent by the browser). */
export function totalsFrom(items: unknown) {
  const clean = parseItems(items);
  const priced = priceItems(clean);
  return { items: clean, subtotal: priced.subtotal, vatTotal: priced.vatTotal, total: priced.total };
}

/** What happens when a quote/proposal changes status, whether your team or the client changed it. */
export async function afterProposalStatusChange(proposalId: string, status: string, by?: string) {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }, include: { lead: true } });
  if (!proposal?.lead) return;
  const stages = await getStageGroups(proposal.lead.organizationId);
  const stage = status === 'sent' ? (stages.all.includes('PROPOSAL') ? 'PROPOSAL' : undefined) : status === 'accepted' ? stages.won[0] : status === 'rejected' ? stages.lost[0] : undefined;
  await prisma.$transaction(async (tx) => {
    if (stage) await tx.lead.update({ where: { id: proposal.leadId }, data: { pipelineStage: stage, lastContact: new Date() } });
    await logLeadActivity(tx, proposal.leadId, 'PROPOSAL', `${proposal.number ? `Quote ${proposal.number}` : 'Proposal'} ${status}${by ? ` by ${by}` : ''}`, { proposalId: proposal.id, title: proposal.title, value: proposal.value });
  });
  if (['sent', 'accepted', 'rejected'].includes(status) && proposal.organizationId) {
    const managers = await getManagerIds(proposal.organizationId);
    const label = status === 'accepted' ? 'Quote accepted' : status === 'rejected' ? 'Quote declined' : 'Quote sent';
    await notifyMany([proposal.lead.assignedToId, ...managers], { type: `PROPOSAL_${status.toUpperCase()}`, title: label, message: `"${proposal.title}" was ${status === 'rejected' ? 'declined' : status}${by ? ` by ${by}` : ''}.`, href: proposalHref(), category: 'proposal' });
  }
}

/** Creates an invoice (or credit note) with a fresh number and share link. */
export async function createSalesInvoice(input: {
  organizationId: string;
  leadId: string;
  items: LineItem[];
  dueDate?: Date | null;
  notes?: string | null;
  proposalId?: string | null;
  kind?: 'INVOICE' | 'CREDIT_NOTE';
  originalId?: string | null;
  status?: 'DRAFT' | 'SENT';
  userId?: string | null;
}) {
  const priced = priceItems(input.items);
  const seq = await nextSequence(input.organizationId, 'invoice');
  const kind = input.kind || 'INVOICE';
  return prisma.salesInvoice.create({
    data: {
      organizationId: input.organizationId,
      leadId: input.leadId,
      proposalId: input.proposalId || null,
      kind,
      originalId: input.originalId || null,
      number: docNumber(kind === 'CREDIT_NOTE' ? 'CN' : 'INV', seq),
      sequence: seq,
      items: input.items as any,
      subtotal: priced.subtotal,
      vatTotal: priced.vatTotal,
      total: priced.total,
      status: input.status || 'DRAFT',
      sentAt: input.status === 'SENT' ? new Date() : null,
      dueDate: kind === 'INVOICE' ? input.dueDate ?? new Date(Date.now() + 14 * 86_400_000) : null,
      notes: input.notes || null,
      shareToken: newShareToken(),
      createdById: input.userId || null,
    },
  });
}

type Org = { name: string; legalName: string | null; kraPin: string | null; businessAddress: string | null; invoiceFooter: string | null; etimsEnv: string | null; etimsBranchId: string | null };
type Lead = { contactName: string; companyName: string | null; email: string | null; phone: string | null };

const business = (o: Org) => ({ name: o.legalName || o.name, kraPin: o.kraPin, address: o.businessAddress, footer: o.invoiceFooter });
const customer = (l: Lead) => ({ name: l.contactName, company: l.companyName, email: l.email, phone: l.phone });

/** Everything the printable quote page shows. */
export function quoteDocument(p: any) {
  const priced = priceItems((p.items || []) as LineItem[]);
  return {
    type: 'QUOTE' as const,
    number: p.number || 'Quote',
    title: p.title,
    status: p.status,
    business: business(p.organization),
    customer: customer(p.lead),
    lines: priced.lines,
    subtotal: priced.subtotal,
    vatTotal: priced.vatTotal,
    total: priced.total,
    issueDate: p.createdAt,
    validUntil: p.validUntil,
    notes: [p.description, p.terms].filter(Boolean).join('\n\n') || null,
    accepted: p.acceptedAt ? { name: p.acceptedName, at: p.acceptedAt } : null,
  };
}

/** Everything the printable invoice page shows, including the eTIMS block and QR when transmitted. */
export async function invoiceDocument(inv: any) {
  const priced = priceItems(inv.items as LineItem[]);
  const env = inv.organization.etimsEnv;
  const etims = inv.etimsStatus === 'SUBMITTED' && inv.etimsSignature && inv.organization.kraPin
    ? {
        receiptNo: inv.etimsReceiptNo,
        sdcId: inv.etimsSdcId,
        mrcNo: inv.etimsMrcNo,
        dateTime: inv.etimsDateTime,
        internalData: inv.etimsInternalData,
        signature: inv.etimsSignature,
        qr: await QRCode.toDataURL(receiptQrUrl(env, inv.organization.kraPin, inv.organization.etimsBranchId || '00', inv.etimsSignature), { margin: 1, width: 180 }),
      }
    : null;
  return {
    type: inv.kind === 'CREDIT_NOTE' ? ('CREDIT_NOTE' as const) : ('INVOICE' as const),
    number: inv.number,
    status: invoiceStatus(inv),
    business: business(inv.organization),
    customer: customer(inv.lead),
    lines: priced.lines,
    subtotal: inv.subtotal,
    vatTotal: inv.vatTotal,
    total: inv.total,
    amountPaid: inv.amountPaid,
    balance: balanceDue(inv),
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    notes: inv.notes,
    originalNumber: inv.original?.number || null,
    etims,
  };
}
