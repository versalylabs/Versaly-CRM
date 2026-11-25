'use client';

import { useState } from 'react';
import Link from 'next/link';
import { parseCsv, toCsv } from '@/lib/csv';
import { IMPORT_FIELDS, guessField, type ImportField, type ImportedLead } from '@/lib/leadImport';

type Result = { created: number; skipped: { row: number; reason: string }[] };

const FIELD_KEYS = Object.keys(IMPORT_FIELDS) as ImportField[];

export default function ImportLeadsPage() {
  const [fileName, setFileName] = useState('');
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(ImportField | '')[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  async function onFile(file: File | undefined) {
    setError('');
    setResult(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setError('Please choose a .csv file. In Excel or Google Sheets, use File → Save as / Download → CSV.');
      return;
    }
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setError('That file has no data rows under the header row.');
      return;
    }
    setFileName(file.name);
    setHeader(parsed[0]);
    setRows(parsed.slice(1));
    setMapping(parsed[0].map(guessField));
  }

  const mapped = new Set(mapping.filter(Boolean));
  const ready = rows.length > 0 && mapped.has('contactName') && (mapped.has('email') || mapped.has('phone'));

  async function runImport() {
    setBusy(true);
    setError('');
    try {
      const leads: ImportedLead[] = rows.map((r) => {
        const lead: ImportedLead = {};
        mapping.forEach((field, i) => {
          if (field && r[i] !== undefined) lead[field] = r[i];
        });
        return lead;
      });
      const res = await fetch('/api/leads/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed.');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadSkipped() {
    if (!result) return;
    const csv = toCsv([...header, 'Reason skipped'], result.skipped.map((s) => [...(rows[s.row - 2] || []), s.reason]));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: 'skipped-rows.csv' }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div>
        <Link href="/leads" className="text-sm font-semibold text-sky-400 hover:underline">← Back to leads</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Import leads from a spreadsheet</h1>
        <p className="mt-1 text-sm text-gray-400">
          Upload a CSV file with a header row. From Excel or Google Sheets, choose <strong>Save as / Download → CSV</strong>. Each lead needs a name and an
          email or phone number. Contacts already in your CRM are skipped.
        </p>
      </div>

      <label className="block rounded-2xl border border-dashed border-gray-600 p-8 text-center hover:border-sky-500">
        <span className="text-sm font-semibold text-white">{fileName || 'Choose a CSV file'}</span>
        <span className="mt-1 block text-xs text-gray-400">{rows.length ? `${rows.length} rows found` : 'Up to 2,000 rows per file'}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {header.length > 0 && !result && (
        <section className="space-y-4 rounded-2xl border border-gray-700 p-5">
          <h2 className="text-base font-bold text-white">Match your columns</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {header.map((h, i) => (
              <label key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-300" title={h}>{h || `Column ${i + 1}`}</span>
                <select
                  value={mapping[i]}
                  onChange={(e) => setMapping((m) => m.map((v, j) => (j === i ? (e.target.value as ImportField | '') : v)))}
                  className="w-48 rounded-lg border border-gray-600 px-2 py-1.5 text-sm"
                >
                  <option value="">Don&apos;t import</option>
                  {FIELD_KEYS.map((f) => (
                    <option key={f} value={f}>{IMPORT_FIELDS[f].label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="overflow-x-auto">
            <p className="mb-2 text-xs font-semibold text-gray-400">Preview (first 5 rows)</p>
            <table className="min-w-full text-left text-xs">
              <thead className="text-gray-400">
                <tr>{FIELD_KEYS.filter((f) => mapped.has(f)).map((f) => <th key={f} className="pb-2 pr-4">{IMPORT_FIELDS[f].label}</th>)}</tr>
              </thead>
              <tbody className="text-gray-200">
                {rows.slice(0, 5).map((r, ri) => (
                  <tr key={ri}>
                    {FIELD_KEYS.filter((f) => mapped.has(f)).map((f) => (
                      <td key={f} className="py-1 pr-4">{r[mapping.indexOf(f)]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!ready && <p className="text-xs text-amber-300">Match a column to Contact name, and at least one to Email or Phone.</p>}
          <button onClick={runImport} disabled={!ready || busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {busy ? 'Importing…' : `Import ${rows.length} leads`}
          </button>
        </section>
      )}

      {result && (
        <section role="status" className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <p className="text-base font-bold text-white">{result.created} leads imported.</p>
          {result.skipped.length > 0 && (
            <>
              <p className="text-sm text-gray-300">{result.skipped.length} rows were skipped:</p>
              <ul className="max-h-48 overflow-y-auto text-xs text-gray-300">
                {result.skipped.slice(0, 100).map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
              </ul>
              <button onClick={downloadSkipped} className="text-sm font-semibold text-sky-400 underline">Download skipped rows as CSV</button>
            </>
          )}
          <Link href="/leads" className="btn-primary inline-block px-5 py-2.5 text-sm">View leads</Link>
        </section>
      )}
    </div>
  );
}
