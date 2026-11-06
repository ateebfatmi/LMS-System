"use client";

import { ChangeEvent, useState } from "react";
import { Badge, Button } from "@prepzii/ui";

type ImportRole = "STUDENT" | "TEACHER";
type PreviewRow = {
  row_number: number;
  normalized_data: { displayName?: string; email?: string; rollNumber?: string; employeeCode?: string } | null;
  errors: string[];
  status: string;
};
type ImportSummary = {
  import_id: string;
  import_status: "VALIDATED" | "INVALID" | "COMMITTED";
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
};

export function MemberImportDialog({
  organizationSlug,
  role,
  onClose,
  onCommitted,
}: {
  organizationSlug: string;
  role: ImportRole;
  onClose: () => void;
  onCommitted: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [operation, setOperation] = useState<"validate" | "commit" | null>(null);
  const [committedRows, setCommittedRows] = useState<number | null>(null);
  const busy = operation !== null;

  const isStudent = role === "STUDENT";
  const sample = isStudent
    ? "name,email,phone,rollNumber,guardianName,guardianPhone,joinedOn\nAarav Sharma,aarav@example.com,9876543210,STU-001,Raj Sharma,9876543211,2026-04-01"
    : "name,email,phone,employeeCode,qualification,subjectSpecialization,joinedOn\nVivek Gupta,vivek@example.com,9876543210,FAC-001,M.Sc. Physics,Mechanics,2026-04-01";

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([sample], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${role.toLowerCase()}-import-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSummary(null);
    setCommittedRows(null);
    setFileName("");
    setCsvText("");
    setIdempotencyKey("");
    setRows([]);
    setError("");
    setFileErrors([]);
    if (file.size > 2_000_000) {
      setError("CSV must be smaller than 2 MB.");
      return;
    }
    try {
      setCsvText(await file.text());
      setFileName(file.name);
      setIdempotencyKey(crypto.randomUUID());
    } catch {
      setError("Unable to read this file. Choose the CSV again.");
    }
  }

  async function validate() {
    if (!csvText || !idempotencyKey) return;
    setOperation("validate");
    setError("");
    setFileErrors([]);
    try {
      const response = await fetch(`/api/organizations/${encodeURIComponent(organizationSlug)}/member-imports`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ fileName, csvText, role }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to validate CSV.");
        setFileErrors(result.fileErrors ?? []);
      } else {
        setSummary(result.import);
        setRows(result.rows);
        if (result.import.import_status === "COMMITTED") setCommittedRows(result.import.valid_rows);
      }
    } catch {
      setError("Unable to validate CSV. Check your connection and try again.");
    } finally {
      setOperation(null);
    }
  }

  async function commit() {
    if (!summary || summary.import_status !== "VALIDATED") return;
    setOperation("commit");
    setError("");
    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationSlug)}/member-imports/${summary.import_id}/commit`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to import records.");
        return;
      }
      setSummary({ ...summary, import_status: "COMMITTED" });
      setCommittedRows(result.result?.committed_rows ?? summary.valid_rows);
      await onCommitted();
    } catch {
      setError("Unable to confirm the import. Try again to check its status.");
    } finally {
      setOperation(null);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="member-import-dialog" role="dialog" aria-modal="true" aria-labelledby="member-import-title">
        <header>
          <div><h2 id="member-import-title">Import {isStudent ? "students" : "faculty"}</h2><p>Validate every row before creating pending member records.</p></div>
          <button onClick={onClose} disabled={busy} aria-label="Close">✕</button>
        </header>

        <div className="import-actions">
          <Button variant="outline" onClick={downloadSample}>Download template</Button>
          <label className="pz-button pz-button-secondary import-file-button">{fileName || "Choose CSV"}<input type="file" disabled={busy} accept=".csv,text/csv" onChange={(event) => void chooseFile(event)} /></label>
          <Button variant="primary" disabled={!csvText || busy || summary?.import_status === "COMMITTED"} onClick={() => void validate()}>{operation === "validate" ? "Validating…" : "Validate CSV"}</Button>
        </div>

        {error && <div className="form-error" role="alert">{error}{fileErrors.length > 0 && <ul>{fileErrors.map((message) => <li key={message}>{message}</li>)}</ul>}</div>}
        {summary && (
          <>
            {committedRows !== null ? (
              <p className="success-banner" role="status">{committedRows} {committedRows === 1 ? "profile" : "profiles"} imported. New accounts remain pending until invited and activated.</p>
            ) : summary.invalid_rows > 0 ? (
              <p className="form-error" role="alert">Fix the flagged rows and upload the corrected CSV. No records have been saved.</p>
            ) : <p className="readiness-note">All rows are ready. Confirm to save them to the directory.</p>}
            <div className="import-summary">
              <Badge variant={summary.invalid_rows ? "warning" : "success"}>{summary.import_status === "COMMITTED" ? "Imported" : summary.invalid_rows ? "Needs changes" : "Ready to import"}</Badge>
              <span>{summary.total_rows} total</span><span>{summary.valid_rows} valid</span><span>{summary.invalid_rows} invalid</span>
            </div>
            <div className="import-preview">
              <table><thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Identifier</th><th>Result</th></tr></thead>
                <tbody>{rows.map((row) => <tr key={row.row_number}><td>{row.row_number}</td><td>{row.normalized_data?.displayName ?? "—"}</td><td>{row.normalized_data?.email ?? "—"}</td><td>{row.normalized_data?.rollNumber ?? row.normalized_data?.employeeCode ?? "—"}</td><td>{row.errors.length ? <ul className="row-errors">{row.errors.map((message, index) => <li key={index}>{message}</li>)}</ul> : <span className="row-valid">{committedRows === null ? "Valid" : "Imported"}</span>}</td></tr>)}</tbody>
              </table>
              {(summary.invalid_rows || summary.total_rows) > rows.length && <p>{summary.invalid_rows ? `Showing ${rows.length} of ${summary.invalid_rows} rows that need attention.` : `Showing the first ${rows.length} rows.`}</p>}
            </div>
          </>
        )}

        <footer>
          <Button variant="outline" disabled={busy} onClick={onClose}>{committedRows === null ? "Close" : "Done"}</Button>
          <Button variant="primary" disabled={!summary || summary.import_status !== "VALIDATED" || busy} onClick={() => void commit()}>
            {summary?.import_status === "COMMITTED" ? "Import complete" : operation === "commit" ? "Importing…" : "Import records"}
          </Button>
        </footer>
      </section>
    </div>
  );
}
