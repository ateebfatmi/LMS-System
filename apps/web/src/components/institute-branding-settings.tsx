"use client";

import { ImagePlus, Palette } from "lucide-react";
import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import {
  INSTITUTE_ACCENT_PATTERN, INSTITUTE_LOGO_FORMATS, INSTITUTE_LOGO_MAX_BYTES, INSTITUTE_NAME_MAX_LENGTH,
} from "@prepzii/contracts";
import { useDashboardInstitute } from "@/components/dashboard-layout";
import { InstituteMark } from "@/components/institute-mark";
import { type ActiveOrganization, resolveActiveOrganization } from "@/lib/client-org";

export function InstituteBrandingSettings() {
  const institute = useDashboardInstitute();
  if (institute?.selection.role !== "OWNER") return null;
  const organization = institute.selection.organization;

  return <BrandingForm key={organization.id} organization={organization} refresh={async () => {
    const selection = await resolveActiveOrganization({ refresh: true });
    if (selection?.organization.id === organization.id) institute.updateSelection(selection);
    else window.location.reload();
  }} />;
}

function BrandingForm({ organization, refresh }: { organization: ActiveOrganization; refresh: () => Promise<void> }) {
  const [name, setName] = useState(organization.name);
  const [accentColor, setAccentColor] = useState(organization.accentColor ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function clearFile() {
    setFile(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("accentColor", accentColor.trim());
      form.set("logoAction", file ? "replace" : removeLogo ? "remove" : "keep");
      if (file) form.set("logo", file);

      const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/branding`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(result?.error ?? "Unable to save institute branding.");
        return;
      }

      await refresh();
      setName(name.trim());
      clearFile();
      setRemoveLogo(false);
      setStatus("Institute branding saved.");
    } catch {
      setError("Unable to confirm the branding update. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const previewName = name.trim() || organization.name;
  const previewLogo = file ? preview : removeLogo ? null : organization.logoUrl;
  const previewAccent = INSTITUTE_ACCENT_PATTERN.test(accentColor) ? accentColor : undefined;

  return (
    <section className="panel institute-branding-panel" aria-labelledby="institute-branding-title">
      <div className="institute-branding-heading">
        <span aria-hidden="true"><Palette size={21} /></span>
        <div>
          <h2 id="institute-branding-title">Institute Branding</h2>
          <p>Personalize the workspace your staff, students, and parents see.</p>
        </div>
      </div>

      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <div className="institute-branding-preview" style={{ "--institute-accent": previewAccent ?? "#facc15" } as CSSProperties}>
            <InstituteMark name={previewName} logoUrl={previewLogo} />
            <div><small>Workspace preview</small><strong>{previewName}</strong></div>
          </div>

          <div className="institute-branding-fields">
            <label>
              Institute name
              <input required maxLength={INSTITUTE_NAME_MAX_LENGTH} value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label>
              Accent color <span className="institute-optional">(optional)</span>
              <span className="institute-accent-field">
                <span className="institute-color-swatch" style={{ backgroundColor: previewAccent }} aria-hidden="true" />
                <input value={accentColor} onChange={(event) => setAccentColor(event.target.value)}
                  maxLength={7} pattern="#[0-9A-Fa-f]{6}" placeholder="Default workspace color"
                  aria-describedby="institute-accent-help" />
              </span>
              <small id="institute-accent-help">Enter a hex color like #2563EB, or leave blank for the default.</small>
            </label>

            <div className="institute-logo-field">
              <label>
                <span><ImagePlus size={16} aria-hidden="true" /> Institute logo</span>
                <input ref={fileInput} type="file" accept={INSTITUTE_LOGO_FORMATS.join(",")} aria-describedby="institute-logo-help"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0];
                    if (!nextFile) {
                      clearFile();
                      return;
                    }
                    if (!INSTITUTE_LOGO_FORMATS.some((type) => type === nextFile.type) || nextFile.size > INSTITUTE_LOGO_MAX_BYTES) {
                      clearFile();
                      setError("Choose a PNG, JPEG, or WebP image up to 2 MB.");
                      return;
                    }
                    setError("");
                    setStatus("");
                    setFile(nextFile);
                    setPreview(URL.createObjectURL(nextFile));
                    setRemoveLogo(false);
                  }} />
              </label>
              <small id="institute-logo-help">PNG, JPEG, or WebP up to 2 MB. A square image works best.</small>
              {(file || organization.logoUrl) && (
                <button type="button" className="pz-button pz-button-outline" onClick={() => {
                  if (file) clearFile();
                  else setRemoveLogo(!removeLogo);
                  setStatus("");
                  setError("");
                }}>{file ? "Discard selected file" : removeLogo ? "Keep current logo" : "Remove logo"}</button>
              )}
              {file && <small>Selected {file.name}</small>}
            </div>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {status && <p className="institute-branding-success" role="status">{status}</p>}
          <button className="pz-button pz-button-primary" type="submit">{busy ? "Saving…" : "Save branding"}</button>
        </fieldset>
      </form>
    </section>
  );
}
