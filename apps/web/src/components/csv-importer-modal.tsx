"use client";

import { useState } from "react";
import { Badge, Button } from "@prepzii/ui";

export interface CSVColumnConfig {
  key: string;
  label: string;
  required?: boolean;
}

export interface CSVImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  columns: CSVColumnConfig[];
  sampleFileName: string;
  sampleCSVData: string;
  onImportSuccess: (data: Record<string, string>[]) => void;
}

export function CSVImporterModal({
  isOpen,
  onClose,
  title,
  subtitle,
  columns,
  sampleFileName,
  sampleCSVData,
  onImportSuccess,
}: CSVImporterModalProps) {
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const downloadSampleCSV = () => {
    const blob = new Blob([sampleCSVData.trim()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", sampleFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSVText(text);
    };

    reader.readAsText(file);
  };

  const parseCSVText = (rawText: string) => {
    const lines = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      setErrors(["The uploaded CSV file is empty or missing data rows."]);
      setParsedRows([]);
      return;
    }

    const rows: Record<string, string>[] = [];
    const validationErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const rowObject: Record<string, string> = {};

      columns.forEach((col, index) => {
        const val = values[index] || "";
        rowObject[col.key] = val;

        if (col.required && !val) {
          validationErrors.push(`Row ${i}: Missing required field "${col.label}"`);
        }
      });

      rows.push(rowObject);
    }

    setErrors(validationErrors.slice(0, 5));
    setParsedRows(rows);
    setIsSuccess(false);
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    onImportSuccess(parsedRows);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "780px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "20px",
          border: "1px solid var(--line)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          padding: "28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontFamily: "var(--font-display)" }}>{title}</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
              {subtitle || "Upload a formatted CSV file to import records in bulk"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "20px",
              cursor: "pointer",
              color: "var(--muted)",
            }}
          >
            ✕
          </button>
        </div>

        {/* Step 1 & 2: Template Download & File Upload */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "14px", marginBottom: "20px" }}>
          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: "14px",
              padding: "16px",
              background: "#f8fafc",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>📄</div>
            <strong style={{ display: "block", fontSize: "13px", marginBottom: "4px" }}>Step 1: Download Sample</strong>
            <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 12px" }}>
              Download pre-formatted template with required columns.
            </p>
            <Button variant="outline" onClick={downloadSampleCSV} style={{ width: "100%", fontSize: "12px" }}>
              📥 {sampleFileName}
            </Button>
          </div>

          <div
            style={{
              border: "2px dashed #93c5fd",
              borderRadius: "14px",
              padding: "16px",
              background: "#eff6ff",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>📤</div>
            <strong style={{ display: "block", fontSize: "13px", marginBottom: "4px" }}>Step 2: Upload CSV File</strong>
            <p style={{ fontSize: "11px", color: "#3b82f6", margin: "0 0 10px" }}>
              {fileName ? `File selected: ${fileName}` : "Click or drag your CSV file here"}
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
                width: "100%",
                height: "100%",
              }}
            />
            <Button variant="brand" style={{ width: "100%", fontSize: "12px", pointerEvents: "none" }}>
              {fileName ? "Change Selected CSV" : "Select CSV File"}
            </Button>
          </div>
        </div>

        {/* Validation Errors */}
        {errors.length > 0 && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "16px",
              fontSize: "12px",
              color: "#991b1b",
            }}
          >
            <strong>Validation Notices ({errors.length}):</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Step 3: Parsed Data Preview Table */}
        {parsedRows.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <strong style={{ fontSize: "13px" }}>
                Preview Parsed Records ({parsedRows.length} Valid Rows)
              </strong>
              <Badge variant="success" size="sm">READY FOR IMPORT</Badge>
            </div>

            <div
              style={{
                maxHeight: "220px",
                overflowY: "auto",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                marginBottom: "20px",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "8px 12px" }}>#</th>
                    {columns.map((col) => (
                      <th key={col.key} style={{ padding: "8px 12px" }}>
                        {col.label} {col.required && <span style={{ color: "#ef4444" }}>*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{rIdx + 1}</td>
                      {columns.map((col) => (
                        <td key={col.key} style={{ padding: "8px 12px", fontWeight: col.required ? 600 : 400 }}>
                          {row[col.key] || <span style={{ color: "#cbd5e1", fontStyle: "italic" }}>-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {isSuccess && (
          <div
            style={{
              padding: "14px",
              borderRadius: "10px",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            ✓ Successfully imported {parsedRows.length} records into workspace!
          </div>
        )}

        {/* Modal Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={parsedRows.length === 0}
            onClick={handleConfirmImport}
          >
            Confirm & Import {parsedRows.length > 0 ? `${parsedRows.length} Records` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
