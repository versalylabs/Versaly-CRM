import { normalizePhone } from './phone';

/** Lead fields that can be imported from a spreadsheet, with header names we recognise for each. */
export const IMPORT_FIELDS = {
  contactName: { label: 'Contact name', synonyms: ['name', 'full name', 'contact', 'contact name', 'client', 'customer', 'customer name', 'jina'] },
  email: { label: 'Email', synonyms: ['email', 'e-mail', 'email address', 'mail'] },
  phone: { label: 'Phone / WhatsApp', synonyms: ['phone', 'phone number', 'mobile', 'tel', 'telephone', 'whatsapp', 'cell', 'simu', 'number'] },
  companyName: { label: 'Company', synonyms: ['company', 'company name', 'business', 'organisation', 'organization', 'school', 'kampuni'] },
  jobTitle: { label: 'Job title', synonyms: ['title', 'job title', 'position', 'role'] },
  location: { label: 'Location', synonyms: ['location', 'town', 'city', 'county', 'area', 'address'] },
  website: { label: 'Website', synonyms: ['website', 'site', 'url', 'web'] },
  dealValue: { label: 'Deal value (KES)', synonyms: ['value', 'deal value', 'amount', 'budget', 'price', 'kes'] },
  notes: { label: 'Notes', synonyms: ['notes', 'note', 'comments', 'comment', 'remarks', 'description'] },
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;
export type ImportedLead = Partial<Record<ImportField, string>>;

const clean = (s: string) => s.trim().toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ');

/** Best guess of which lead field a spreadsheet column holds, or '' to ignore it. */
export function guessField(header: string): ImportField | '' {
  const h = clean(header);
  for (const [field, def] of Object.entries(IMPORT_FIELDS) as [ImportField, (typeof IMPORT_FIELDS)[ImportField]][]) {
    if ((def.synonyms as readonly string[]).some((syn) => clean(syn) === h)) return field;
  }
  return '';
}

export type CleanLead = {
  contactName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  location: string | null;
  website: string | null;
  dealValue: number | null;
  notes: string | null;
};

/** Validates and normalises one imported row. Returns the lead, or an error message for the report. */
export function cleanImportedLead(row: ImportedLead): { lead: CleanLead } | { error: string } {
  const str = (v?: string) => (v && v.trim() ? v.trim().slice(0, 500) : null);
  const contactName = str(row.contactName) || str(row.companyName);
  if (!contactName) return { error: 'Missing contact name' };
  const email = str(row.email)?.toLowerCase() || null;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: `Invalid email "${email}"` };
  const phone = row.phone && row.phone.trim() ? normalizePhone(row.phone) : null;
  if (row.phone && row.phone.trim() && !phone) return { error: `Invalid phone "${row.phone.trim()}"` };
  if (!email && !phone) return { error: 'Needs an email or a phone number' };
  let dealValue: number | null = null;
  if (row.dealValue && row.dealValue.trim()) {
    dealValue = Number(row.dealValue.replace(/[^\d.\-]/g, ''));
    if (!Number.isFinite(dealValue)) return { error: `Invalid deal value "${row.dealValue}"` };
  }
  return {
    lead: { contactName, email, phone, companyName: str(row.companyName), jobTitle: str(row.jobTitle), location: str(row.location), website: str(row.website), dealValue, notes: str(row.notes) },
  };
}
