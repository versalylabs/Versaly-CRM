import prisma from './prisma';
import { decryptSecret, encryptSecret } from './secretBox';
import { TAX_TYPES, priceItems, round2, type LineItem, type TaxType } from './quotes';

/**
 * KRA eTIMS through OSCU (Online Sales Control Unit), called directly with the workspace's own KRA PIN,
 * branch and device serial. The device is initialised once (returns a communication key), each tax type
 * gets one registered item code, and every invoice / credit note is transmitted as a sale.
 * shortcut: built to KRA's OSCU spec but not yet verified against the KRA sandbox (needs your sandbox
 * credentials); confirm field values (item class code, refund reason) during certification, or switch
 * this adapter to an approved partner's API.
 */

const BASE: Record<string, string> = {
  sandbox: 'https://etims-api-sbx.kra.go.ke/etims-api',
  production: 'https://etims-api.kra.go.ke/etims-api',
};
const RECEIPT_LINK: Record<string, string> = {
  sandbox: 'https://etims-sbx.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?Data=',
  production: 'https://etims.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?Data=',
};
const SERVICE_CLASS_CODE = '99012000'; // generic services class; confirm with KRA for your goods
const TAX_ORDER: TaxType[] = ['A', 'B', 'C', 'D', 'E'];

/** Kenya-time timestamps: yyyyMMdd and yyyyMMddHHmmss. */
export function kraDate(d: Date, withTime = false) {
  const s = new Date(d.getTime() + 3 * 3600_000).toISOString().replace(/[-:T]/g, '');
  return withTime ? s.slice(0, 14) : s.slice(0, 8);
}

export const etimsItemCode = (taxType: TaxType) => `KE3NTU${String(TAX_ORDER.indexOf(taxType) + 1).padStart(7, '0')}`;

export const receiptQrUrl = (env: string, tin: string, bhfId: string, signature: string) => `${RECEIPT_LINK[env] || RECEIPT_LINK.sandbox}${tin}${bhfId}${signature}`;

type SaleInput = {
  tin: string;
  bhfId: string;
  invoice: { number: string; sequence: number; kind: string; issueDate: Date; items: LineItem[]; paid: boolean };
  originalSequence?: number | null;
  customer: { name: string; phone?: string | null; pin?: string | null };
  seller: { name: string; address?: string | null };
  userName: string;
};

/** The saveTrnsSalesOsdc body. Pure, so the mapping is unit-tested. eTIMS works with VAT-inclusive amounts. */
export function buildSalePayload(s: SaleInput) {
  const { lines } = priceItems(s.invoice.items);
  const sum = (t: TaxType, k: 'total' | 'vat') => round2(lines.filter((l) => l.taxType === t).reduce((n, l) => n + l[k], 0));
  const credit = s.invoice.kind === 'CREDIT_NOTE';
  const taxes: Record<string, number> = {};
  for (const t of TAX_ORDER) {
    taxes[`taxblAmt${t}`] = sum(t, 'total');
    taxes[`taxRt${t}`] = TAX_TYPES[t].rate;
    taxes[`taxAmt${t}`] = sum(t, 'vat');
  }
  const now = new Date();
  return {
    tin: s.tin,
    bhfId: s.bhfId,
    trdInvcNo: s.invoice.number,
    invcNo: s.invoice.sequence,
    orgInvcNo: credit ? s.originalSequence || 0 : 0,
    custTin: s.customer.pin || null,
    custNm: s.customer.name.slice(0, 60),
    salesTyCd: 'N',
    rcptTyCd: credit ? 'R' : 'S',
    pmtTyCd: s.invoice.paid ? '06' : '02', // 06 mobile money, 02 credit (pay later)
    salesSttsCd: '02',
    cfmDt: kraDate(now, true),
    salesDt: kraDate(s.invoice.issueDate),
    stockRlsDt: null,
    cnclReqDt: null,
    cnclDt: null,
    rfdDt: credit ? kraDate(now, true) : null,
    rfdRsnCd: credit ? '06' : null, // shortcut: refund reason fixed; confirm the code list during KRA certification
    totItemCnt: lines.length,
    ...taxes,
    totTaxblAmt: round2(lines.reduce((n, l) => n + l.total, 0)),
    totTaxAmt: round2(lines.reduce((n, l) => n + l.vat, 0)),
    totAmt: round2(lines.reduce((n, l) => n + l.total, 0)),
    prchrAcptcYn: 'N',
    remark: null,
    regrId: 'versalylabs',
    regrNm: s.userName.slice(0, 60),
    modrId: 'versalylabs',
    modrNm: s.userName.slice(0, 60),
    receipt: {
      custTin: s.customer.pin || null,
      custMblNo: s.customer.phone || null,
      rptNo: s.invoice.sequence,
      trdeNm: s.seller.name.slice(0, 60),
      adrs: (s.seller.address || '').slice(0, 200),
      topMsg: s.seller.name.slice(0, 60),
      btmMsg: 'Thank you',
      prchrAcptcYn: 'N',
    },
    itemList: lines.map((l, i) => {
      const rate = TAX_TYPES[l.taxType].rate;
      const prc = round2(l.unitPrice * (1 + rate / 100));
      const splyAmt = round2(prc * l.quantity);
      return {
        itemSeq: i + 1,
        itemCd: etimsItemCode(l.taxType),
        itemClsCd: SERVICE_CLASS_CODE,
        itemNm: l.description.slice(0, 200),
        bcd: null,
        pkgUnitCd: 'NT',
        pkg: l.quantity,
        qtyUnitCd: 'U',
        qty: l.quantity,
        prc,
        splyAmt,
        dcRt: l.discountPct,
        dcAmt: round2(splyAmt - l.total),
        isrccCd: null,
        isrccNm: null,
        isrcRt: null,
        isrcAmt: null,
        taxTyCd: l.taxType,
        taxblAmt: l.total,
        taxAmt: l.vat,
        totAmt: l.total,
      };
    }),
  };
}

async function oscu<T = any>(env: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE[env] || BASE.sandbox}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.resultCd !== '000') throw new Error(`eTIMS: ${json.resultMsg || `request failed (${res.status})`}`);
  return json as T;
}

type EtimsOrg = { id: string; kraPin: string | null; etimsEnv: string | null; etimsBranchId: string | null; etimsDeviceSerial: string | null; etimsCmcKey: string | null; etimsItems: unknown };

function config(org: EtimsOrg) {
  if (!org.etimsEnv || !org.kraPin || !org.etimsDeviceSerial) throw new Error('Set up eTIMS first (KRA PIN, branch and device serial in Settings → Invoicing).');
  return { env: org.etimsEnv, tin: org.kraPin, bhfId: org.etimsBranchId || '00', serial: org.etimsDeviceSerial };
}

/** One-time device initialisation; KRA returns the communication key used on every later call. */
export async function initialiseDevice(org: EtimsOrg) {
  const c = config(org);
  const json = await oscu<any>(c.env, '/selectInitOsdcInfo', { tin: c.tin, bhfId: c.bhfId, dvcSrlNo: c.serial });
  const key = json?.data?.info?.cmcKey;
  if (!key) throw new Error('eTIMS did not return a communication key.');
  await prisma.organization.update({ where: { id: org.id }, data: { etimsCmcKey: encryptSecret(key) } });
  return key as string;
}

async function headersFor(org: EtimsOrg) {
  const c = config(org);
  const key = decryptSecret(org.etimsCmcKey) || (await initialiseDevice(org));
  return { tin: c.tin, bhfId: c.bhfId, cmcKey: key };
}

/** Registers the generic item code for each tax type the invoice uses (once per workspace). */
async function ensureItems(org: EtimsOrg, types: TaxType[], userName: string) {
  const c = config(org);
  const done = { ...((org.etimsItems || {}) as Record<string, string>) };
  const headers = await headersFor(org);
  for (const t of [...new Set(types)]) {
    if (done[t]) continue;
    await oscu(c.env, '/saveItem', {
      itemCd: etimsItemCode(t), itemClsCd: SERVICE_CLASS_CODE, itemTyCd: '3', itemNm: `Goods and services (${TAX_TYPES[t].label})`,
      itemStdNm: null, orgnNatCd: 'KE', pkgUnitCd: 'NT', qtyUnitCd: 'U', taxTyCd: t, btchNo: null, bcd: null, dftPrc: 1,
      grpPrcL1: null, grpPrcL2: null, grpPrcL3: null, grpPrcL4: null, grpPrcL5: null, addInfo: null, sftyQty: null,
      isrcAplcbYn: 'N', useYn: 'Y', regrId: 'versalylabs', regrNm: userName, modrId: 'versalylabs', modrNm: userName,
    }, headers);
    done[t] = etimsItemCode(t);
  }
  await prisma.organization.update({ where: { id: org.id }, data: { etimsItems: done } });
}

/** Transmits an invoice or credit note to KRA and stores the control-unit details printed on the document. */
export async function submitToEtims(invoiceId: string, userName: string) {
  const inv = await prisma.salesInvoice.findUnique({ where: { id: invoiceId }, include: { organization: true, lead: true, original: true } });
  if (!inv) throw new Error('Invoice not found.');
  if (inv.etimsStatus === 'SUBMITTED') return inv;
  const org = inv.organization;
  const c = config(org);
  const items = inv.items as LineItem[];
  try {
    await ensureItems(org, items.map((i) => i.taxType), userName);
    const fresh = await prisma.organization.findUnique({ where: { id: org.id } });
    const payload = buildSalePayload({
      tin: c.tin,
      bhfId: c.bhfId,
      invoice: { number: inv.number, sequence: inv.sequence, kind: inv.kind, issueDate: inv.issueDate, items, paid: inv.amountPaid >= inv.total },
      originalSequence: inv.original?.sequence,
      customer: { name: inv.lead.companyName || inv.lead.contactName, phone: inv.lead.phone },
      seller: { name: org.legalName || org.name, address: org.businessAddress },
      userName,
    });
    const json = await oscu<any>(c.env, '/saveTrnsSalesOsdc', payload, await headersFor(fresh!));
    const d = json.data || {};
    return prisma.salesInvoice.update({
      where: { id: inv.id },
      data: {
        etimsStatus: 'SUBMITTED',
        etimsReceiptNo: d.rcptNo !== undefined ? String(d.rcptNo) : null,
        etimsSignature: d.rcptSign || null,
        etimsInternalData: d.intrlData || null,
        etimsSdcId: d.sdcId || null,
        etimsMrcNo: d.mrcNo || null,
        etimsDateTime: d.vsdcRcptPbctDate || null,
        etimsError: null,
      },
    });
  } catch (e: any) {
    await prisma.salesInvoice.update({ where: { id: inv.id }, data: { etimsStatus: 'FAILED', etimsError: String(e.message || e).slice(0, 300) } });
    throw e;
  }
}
