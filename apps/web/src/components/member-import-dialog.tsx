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
  const [busy, setBusy] = useState(false);

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
    setRows([]);
    setError("");
    setFileErrors([]);
    if (file.size > 2_000_000) {
      setError("CSV must be smaller than 2 MB.");
      return;
    }
    setFileName(file.name);
    setCsvText(await file.text());
    setIdempotencyKey(crypto.randomUUID());
  }

  async function validate() {
    if (!csvText || !idempotencyKey) return;
    setBusy(true);
    setError("");
    setFileErrors([]);
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
    }
    setBusy(false);
  }

  async function commit() {
    if (!summary || summary.import_status !== "VALIDATED") return;
    setBusy(true);
    setError("");
    const response = await fetch(
      `/api/organizations/${encodeURIComponent(organizationSlug)}/member-imports/${summary.import_id}/commit`,
      { method: "POST" },
    );
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Unable to commit import.");
      setBusy(false);
      return;
    }
    setSummary({ ...summary, import_status: "COMMITTED" });
    await onCommitted();
    setBusy(false);
  }

  return (
    <div className="modal-backdrop">
      <section className="member-import-dialog" role="dialog" aria-modal="true" aria-labelledby="member-import-title">
        <header>
          <div><h2 id="member-import-title">Import {isStudent ? "students" : "faculty"}</h2><p>Validate every row before creating pending member records.</p></div>
          <button onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="import-actions">
          <Button variant="outline" onClick={downloadSample}>Download template</Button>
          <label className="pz-button pz-button-secondary import-file-button">{fileName || "Choose CSV"}<input type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event)} /></label>
          <Button variant="primary" disabled={!csvText || busy} onClick={() => void validate()}>{busy && !summary ? "Validating…" : "Validate CSV"}</Button>
        </div>

        {error && <div className="form-error" role="alert">{error}{fileErrors.length > 0 && <ul>{fileErrors.map((message) => <li key={message}>{message}</li>)}</ul>}</div>}
        {summary && (
          <>
            <div className="import-summary">
              <Badge variant={summary.invalid_rows ? "warning" : "success"}>{summary.import_status}</Badge>
              <span>{summary.total_rows} total</span><span>{summary.valid_rows} valid</span><span>{summary.invalid_rows} invalid</span>
            </div>
            <div className="import-preview">
              <table><thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Identifier</th><th>Result</th></tr></thead>
                <tbody>{rows.map((row) => <tr key={row.row_number}><td>{row.row_number}</td><td>{row.normalized_data?.displayName ?? "—"}</td><td>{row.normalized_data?.email ?? "—"}</td><td>{row.normalized_data?.rollNumber ?? row.normalized_data?.employeeCode ?? "—"}</td><td>{row.errors.length ? <span className="row-errors">{row.errors.join(" ")}</span> : <span className="row-valid">Valid</span>}</td></tr>)}</tbody>
              </table>
              {summary.total_rows > rows.length && <p>Showing the first {rows.length} rows.</p>}
            </div>
          </>
        )}

        <footer>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={!summary || summary.import_status !== "VALIDATED" || busy} onClick={() => void commit()}>
            {summary?.import_status === "COMMITTED" ? "Import committed" : busy ? "Committing…" : "Commit valid import"}
          </Button>
        </footer>
      </section>
    </div>
  );
}
