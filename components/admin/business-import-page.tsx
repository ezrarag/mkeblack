"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatePanel } from "@/components/ui/state-panel";
import { useAllBusinesses } from "@/hooks/use-all-businesses";
import { createBusinessDuplicateKey } from "@/lib/businesses";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { importBusinesses } from "@/lib/firebase/businesses";

type ImportField =
  | "name"
  | "category"
  | "address"
  | "phone"
  | "website"
  | "email"
  | "hoursText";

type ParsedSpreadsheet = {
  fileName: string;
  headers: string[];
  rows: Array<Record<string, string>>;
};

type ImportSummary = {
  imported: number;
  duplicates: number;
  failed: number;
};

const FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  category: "Category",
  address: "Address",
  phone: "Phone",
  website: "Website",
  email: "Email",
  hoursText: "Hours"
};

const REQUIRED_FIELDS: ImportField[] = ["name", "category"];

const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: ["name", "businessname", "business", "company", "companyname", "listingname"],
  category: ["category", "type", "businesscategory", "industry"],
  address: ["address", "streetaddress", "location", "fulladdress"],
  phone: ["phone", "phonenumber", "telephone", "mobile", "contactnumber"],
  website: ["website", "url", "web", "site", "businesswebsite"],
  email: ["email", "emailaddress", "contactemail", "businessemail"],
  hoursText: ["hours", "hourstext", "businesshours", "openinghours", "schedule"]
};

function normalizeHeaderName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function detectMappings(headers: string[]) {
  const nextMappings: Record<ImportField, string> = {
    name: "",
    category: "",
    address: "",
    phone: "",
    website: "",
    email: "",
    hoursText: ""
  };

  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: normalizeHeaderName(header)
  }));

  (Object.keys(FIELD_ALIASES) as ImportField[]).forEach((field) => {
    const match = normalizedHeaders.find(({ normalized }) =>
      FIELD_ALIASES[field].includes(normalized)
    );

    if (match) {
      nextMappings[field] = match.raw;
    }
  });

  return nextMappings;
}

async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("The uploaded spreadsheet does not contain any sheets.");
  }

  const firstSheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(
    firstSheet,
    {
      header: 1,
      defval: ""
    }
  );

  if (!matrix.length) {
    throw new Error("The uploaded spreadsheet is empty.");
  }

  const headers = (matrix[0] ?? []).map((cell, index) => {
    const nextHeader = String(cell ?? "").trim();
    return nextHeader || `Column ${index + 1}`;
  });

  const rows = matrix.slice(1).map((row) => {
    const nextRow: Record<string, string> = {};

    headers.forEach((header, index) => {
      nextRow[header] = String(row[index] ?? "").trim();
    });

    return nextRow;
  });

  return {
    fileName: file.name,
    headers,
    rows
  };
}

export function BusinessImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { businesses } = useAllBusinesses();
  const [parsedFile, setParsedFile] = useState<ParsedSpreadsheet | null>(null);
  const [mappings, setMappings] = useState<Record<ImportField, string>>({
    name: "",
    category: "",
    address: "",
    phone: "",
    website: "",
    email: "",
    hoursText: ""
  });
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  const duplicateKeys = useMemo(
    () =>
      new Set(
        businesses.map((business) =>
          createBusinessDuplicateKey(business.name, business.address)
        )
      ),
    [businesses]
  );

  const reviewedRows = useMemo(() => {
    if (!parsedFile) {
      return [];
    }

    return parsedFile.rows.map((row, index) => {
      const mappedRow = {
        rowNumber: index + 2,
        name: mappings.name ? row[mappings.name] ?? "" : "",
        category: mappings.category ? row[mappings.category] ?? "" : "",
        address: mappings.address ? row[mappings.address] ?? "" : "",
        phone: mappings.phone ? row[mappings.phone] ?? "" : "",
        website: mappings.website ? row[mappings.website] ?? "" : "",
        email: mappings.email ? row[mappings.email] ?? "" : "",
        hoursText: mappings.hoursText ? row[mappings.hoursText] ?? "" : ""
      };

      const missingRequired =
        REQUIRED_FIELDS.filter((field) => !mappedRow[field].trim());
      const duplicate =
        !missingRequired.length &&
        duplicateKeys.has(
          createBusinessDuplicateKey(mappedRow.name, mappedRow.address)
        );

      return {
        ...mappedRow,
        missingRequired,
        duplicate
      };
    });
  }, [duplicateKeys, mappings, parsedFile]);

  const validImportCount = reviewedRows.filter(
    (row) => !row.missingRequired.length && !row.duplicate
  ).length;

  useEffect(() => {
    if (!summary) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      router.push("/admin/businesses");
    }, 1800);

    return () => window.clearTimeout(redirectTimer);
  }, [router, summary]);

  async function handleFile(file: File) {
    setFeedback(null);
    setSummary(null);
    setProgress(0);

    try {
      const nextParsedFile = await parseSpreadsheet(file);
      setParsedFile(nextParsedFile);
      setMappings(detectMappings(nextParsedFile.headers));
      setFeedbackTone("success");
      setFeedback(`Loaded ${nextParsedFile.fileName}. Review the preview and mappings.`);
    } catch (parseError) {
      setFeedbackTone("error");
      setFeedback(parseError instanceof Error ? parseError.message : "Unable to read that file.");
    }
  }

  async function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];

    if (!nextFile) {
      return;
    }

    await handleFile(nextFile);
    event.target.value = "";
  }

  async function handleImport() {
    if (!parsedFile) {
      return;
    }

    setProcessing(true);
    setSummary(null);
    setFeedback(null);

    try {
      const nextSummary = await importBusinesses(
        reviewedRows.map((row) => ({
          name: row.name,
          category: row.category,
          address: row.address,
          phone: row.phone,
          website: row.website,
          email: row.email,
          hoursText: row.hoursText
        })),
        {
          onProgress: (completed, total) => {
            setProgress(total ? Math.round((completed / total) * 100) : 0);
          }
        }
      );

      setSummary(nextSummary);
      setFeedbackTone("success");
      setFeedback(
        `Import complete. ${nextSummary.imported} imported, ${nextSummary.duplicates} duplicates skipped, ${nextSummary.failed} rows failed validation. Redirecting to business management...`
      );
    } catch (importError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(importError));
    } finally {
      setProcessing(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);

    const nextFile = event.dataTransfer.files?.[0];

    if (nextFile) {
      void handleFile(nextFile);
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2.6rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
                Spreadsheet import
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
                Import businesses from Excel or CSV.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">
                Upload a `.xlsx` or `.csv`, map its columns, review skipped rows,
                then write clean records into Firestore with import metadata.
              </p>
            </div>
          </div>
        </div>

        {feedback ? (
          <div
            className={`mt-6 rounded-3xl px-5 py-4 text-sm ${
              feedbackTone === "success"
                ? "border border-success/35 bg-success/10 text-stone-100"
                : "border border-danger/35 bg-danger/10 text-stone-100"
            }`}
          >
            {feedback}
          </div>
        ) : null}

        <div className="mt-6 space-y-6">
          <div className="rounded-[2.2rem] border border-line bg-panel/85 p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
              Step 1 · Upload
            </p>
            <button
              type="button"
              onClick={openFilePicker}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={onDrop}
              className={`mt-5 flex min-h-[220px] w-full flex-col items-center justify-center rounded-[2rem] border border-dashed px-6 py-10 text-center transition ${
                dragActive
                  ? "border-accent/55 bg-accent/10"
                  : "border-line bg-canvas/30 hover:border-accent/35 hover:bg-panelAlt/50"
              }`}
            >
              <p className="font-display text-3xl text-ink">
                Drop a spreadsheet here
              </p>
              <p className="mt-3 text-sm leading-7 text-stone-300">
                Or click to choose a `.xlsx` or `.csv` file.
              </p>
              {parsedFile ? (
                <p className="mt-4 text-sm text-accentSoft">
                  Loaded file: {parsedFile.fileName}
                </p>
              ) : null}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileInput}
              className="hidden"
            />

            {parsedFile ? (
              <div className="mt-6 overflow-hidden rounded-[2rem] border border-line">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line text-left text-sm">
                    <thead className="bg-panelAlt/80">
                      <tr>
                        {parsedFile.headers.map((header) => (
                          <th
                            key={header}
                            className="whitespace-nowrap px-4 py-3 font-medium text-stone-100"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-panel/70">
                      {parsedFile.rows.slice(0, 10).map((row, index) => (
                        <tr key={index}>
                          {parsedFile.headers.map((header) => (
                            <td key={header} className="px-4 py-3 text-stone-300">
                              {row[header] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>

          {parsedFile ? (
            <div className="rounded-[2.2rem] border border-line bg-panel/85 p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                Step 2 · Column mapping
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(FIELD_LABELS) as ImportField[]).map((field) => (
                  <div key={field} className="rounded-3xl border border-line bg-panelAlt/70 p-4">
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                      {FIELD_LABELS[field]}
                      {REQUIRED_FIELDS.includes(field) ? " · Required" : " · Optional"}
                    </label>
                    <select
                      value={mappings[field]}
                      onChange={(event) =>
                        setMappings((current) => ({
                          ...current,
                          [field]: event.target.value
                        }))
                      }
                    >
                      <option value="">Not mapped</option>
                      {parsedFile.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {parsedFile ? (
            <div className="rounded-[2.2rem] border border-line bg-panel/85 p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                    Step 3 · Review & import
                  </p>
                  <p className="mt-2 text-sm text-stone-300">
                    {validImportCount} valid of {reviewedRows.length} businesses ready to import.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={
                    processing ||
                    !mappings.name ||
                    !mappings.category ||
                    !reviewedRows.length
                  }
                  className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft"
                >
                  {processing ? "Importing..." : "Import"}
                </button>
              </div>

              {processing ? (
                <div className="mt-5">
                  <div className="h-3 overflow-hidden rounded-full bg-panelAlt/80">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-stone-300">{progress}% complete</p>
                </div>
              ) : null}

              {summary ? (
                <div className="mt-5 rounded-3xl border border-success/35 bg-success/10 px-5 py-4 text-sm text-stone-100">
                  {summary.imported} imported, {summary.duplicates} duplicate rows skipped, {summary.failed} rows failed validation.
                </div>
              ) : null}

              <div className="mt-6 overflow-hidden rounded-[2rem] border border-line">
                <div className="max-h-[480px] overflow-auto">
                  <table className="min-w-full divide-y divide-line text-left text-sm">
                    <thead className="sticky top-0 bg-panelAlt/90">
                      <tr>
                        <th className="px-4 py-3 font-medium text-stone-100">Row</th>
                        <th className="px-4 py-3 font-medium text-stone-100">Name</th>
                        <th className="px-4 py-3 font-medium text-stone-100">Category</th>
                        <th className="px-4 py-3 font-medium text-stone-100">Address</th>
                        <th className="px-4 py-3 font-medium text-stone-100">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-panel/70">
                      {reviewedRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={
                            row.missingRequired.length
                              ? "bg-danger/10"
                              : row.duplicate
                                ? "bg-accent/5"
                                : ""
                          }
                        >
                          <td className="px-4 py-3 text-stone-300">{row.rowNumber}</td>
                          <td className="px-4 py-3 text-stone-200">{row.name || "—"}</td>
                          <td className="px-4 py-3 text-stone-200">{row.category || "—"}</td>
                          <td className="px-4 py-3 text-stone-300">{row.address || "—"}</td>
                          <td className="px-4 py-3">
                            {row.missingRequired.length ? (
                              <span className="rounded-full border border-danger/35 bg-danger/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-200">
                                Missing {row.missingRequired.join(", ")}
                              </span>
                            ) : row.duplicate ? (
                              <span className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accentSoft">
                                Duplicate
                              </span>
                            ) : (
                              <span className="rounded-full border border-success/35 bg-success/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-success">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <StatePanel
              title="Upload a spreadsheet to begin"
              description="The import flow stays in the browser until you click Import, so you can inspect headers, remap columns, and catch invalid rows first."
            />
          )}
        </div>
      </section>
    </ProtectedRoute>
  );
}
