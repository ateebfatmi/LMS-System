"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, DateTimePicker, MetricCard, Select } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";

type Organization = { name: string; slug: string };
type Course = { id: string; title: string; description: string | null; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" };
type Module = { id: string; course_id: string; title: string; description: string | null; order_index: number; is_published: boolean; release_at: string | null };
type Lesson = { id: string; module_id: string; title: string; kind: string; description: string | null; duration_minutes: number | null; is_published: boolean; release_at: string | null };
type Resource = { id: string; lesson_id: string; name: string; resource_type: string; mime_type: string | null; byte_size: number | null; download_allowed: boolean };
type Progress = { lesson_id: string; progress_percent: number; completed_at: string | null };
type Batch = { id: string; name: string };
type LearningData = { courses: Course[]; modules: Module[]; lessons: Lesson[]; resources: Resource[]; progress: Progress[]; batches: Batch[]; role: string };
const empty: LearningData = { courses: [], modules: [], lessons: [], resources: [], progress: [], batches: [], role: "" };

export function LearningWorkspace() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<LearningData>(empty);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (active: Organization) => {
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/learning`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Unable to load learning content."); return; }
    setData(result); setError("");
    setSelectedCourseId((current) => current && result.courses.some((course: Course) => course.id === current) ? current : result.courses[0]?.id ?? "");
  }, []);

  useEffect(() => {
    async function initialize() {
      const response = await fetch("/api/organizations/active", { cache: "no-store" });
      const active = response.ok ? (await response.json()).organization as Organization | null : null;
      setOrganization(active);
      if (active) await load(active); else setError("Select an institute before opening learning content.");
    }
    void initialize();
  }, [load]);

  const modules = useMemo(() => data.modules.filter((module) => module.course_id === selectedCourseId), [data.modules, selectedCourseId]);
  const moduleIds = useMemo(() => new Set(modules.map((module) => module.id)), [modules]);
  const lessons = useMemo(() => data.lessons.filter((lesson) => moduleIds.has(lesson.module_id)), [data.lessons, moduleIds]);
  const completion = new Map(data.progress.map((item) => [item.lesson_id, item.progress_percent]));
  const selectedCourse = data.courses.find((course) => course.id === selectedCourseId);
  const staff = data.role !== "STUDENT";
  const canManageCatalogue = ["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR"].includes(data.role);

  async function mutate(action: string, payload: Record<string, unknown>) {
    if (!organization) return false;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/learning`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to save learning content.");
    else { await load(organization); setNotice("Learning content updated."); }
    setBusy(false);
    return response.ok;
  }

  async function submit(event: FormEvent<HTMLFormElement>, action: string, builder: (form: FormData) => Record<string, unknown>) {
    event.preventDefault();
    if (await mutate(action, builder(new FormData(event.currentTarget)))) event.currentTarget.reset();
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/academic`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "CREATE_COURSE", payload: { title: String(form.get("title") ?? ""), description: String(form.get("description") ?? "") || null, subjectId: null } }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to create course.");
    else { event.currentTarget.reset(); await load(organization); setNotice("Draft course created."); }
    setBusy(false);
  }

  async function uploadResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/learning/resources`, { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to upload resource.");
    else { event.currentTarget.reset(); await load(organization); setNotice("Private resource uploaded."); }
    setBusy(false);
  }

  async function openResource(resourceId: string) {
    if (!organization) return;
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/learning/resources/${resourceId}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.url) { setError(result.error ?? "Unable to open resource."); return; }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  const stringValue = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
  return (
    <DashboardLayout title={staff ? "Course delivery" : "My learning"} subtitle={`${organization?.name ?? "Institute"} · Private, enrolment-aware content`}>
      <div className="metrics-grid learning-metrics">
        <MetricCard label="Courses" value={String(data.courses.length)} detail={staff ? "Visible catalogue" : "Your enrolments"} accent="yellow" />
        <MetricCard label="Modules" value={String(data.modules.length)} detail="Structured curriculum" accent="navy" />
        <MetricCard label="Lessons" value={String(data.lessons.length)} detail={`${data.resources.length} resources`} accent="blue" />
        <MetricCard label="Completed" value={String(data.progress.filter((item) => item.completed_at).length)} detail={staff ? "Your own progress" : "Lessons completed"} accent="green" />
      </div>
      {error && <div className="form-error directory-error" role="alert">{error}</div>}
      {notice && <div className="form-success directory-error" role="status">{notice}</div>}

      <div className={`learning-layout ${staff ? "" : "student"}`}>
        <aside className="panel learning-catalogue">
          <h2>{staff ? "Course catalogue" : "Enrolled courses"}</h2>
          {data.courses.map((course) => <button key={course.id} className={course.id === selectedCourseId ? "active" : ""} onClick={() => setSelectedCourseId(course.id)}><span><strong>{course.title}</strong><small>{course.description ?? "No description"}</small></span><Badge variant={course.status === "PUBLISHED" ? "success" : "neutral"}>{course.status}</Badge></button>)}
          {!data.courses.length && <p className="empty-state">{staff ? "Create the first draft course." : "No published courses are linked to your batches yet."}</p>}
          {canManageCatalogue && <form className="compact-form" onSubmit={(event) => void createCourse(event)}><h3>New draft course</h3><label>Course title<input name="title" required placeholder="JEE Electrodynamics" /></label><label>Description<textarea name="description" placeholder="Outcomes and syllabus" /></label><Button disabled={busy}>Create course</Button></form>}
        </aside>

        <section className="panel learning-content">
          <header><div><h2>{selectedCourse?.title ?? "Choose a course"}</h2><p>{selectedCourse?.description ?? "Modules and lessons will appear here."}</p></div>{canManageCatalogue && selectedCourse && <Button variant="secondary" disabled={busy} onClick={() => void mutate("PUBLISH_COURSE", { courseId: selectedCourse.id, published: selectedCourse.status !== "PUBLISHED" })}>{selectedCourse.status === "PUBLISHED" ? "Return to draft" : "Publish course"}</Button>}</header>
          {modules.map((module) => <article className="learning-module" key={module.id}><header><div><strong>{module.title}</strong><small>{module.description ?? "No module description"}</small></div>{staff && <Button variant="outline" disabled={busy} onClick={() => void mutate("PUBLISH_MODULE", { moduleId: module.id, published: !module.is_published })}>{module.is_published ? "Unpublish" : "Publish"}</Button>}</header><div className="lesson-list">{lessons.filter((lesson) => lesson.module_id === module.id).map((lesson) => <div className="lesson-row" key={lesson.id}><div><span>{lesson.kind === "VIDEO" ? "▶" : lesson.kind === "DPP" ? "✎" : "▤"}</span><div><strong>{lesson.title}</strong><small>{lesson.duration_minutes ? `${lesson.duration_minutes} min · ` : ""}{lesson.description ?? lesson.kind}</small></div></div><div className="lesson-actions">{completion.get(lesson.id) === 100 && <Badge variant="success">DONE</Badge>}{data.resources.filter((resource) => resource.lesson_id === lesson.id).map((resource) => <Button key={resource.id} variant="outline" onClick={() => void openResource(resource.id)}>{resource.name}</Button>)}{staff ? <><Button variant="secondary" disabled={busy} onClick={() => setSelectedLessonId(lesson.id)}>Add resource</Button><Button variant="outline" disabled={busy} onClick={() => void mutate("PUBLISH_LESSON", { lessonId: lesson.id, published: !lesson.is_published })}>{lesson.is_published ? "Hide" : "Release"}</Button></> : <Button disabled={busy || completion.get(lesson.id) === 100} onClick={() => void mutate("MARK_COMPLETE", { lessonId: lesson.id })}>Mark complete</Button>}</div></div>)}</div></article>)}
          {selectedCourse && !modules.length && <p className="empty-state">{staff ? "Add the first module to structure this course." : "Content has not been released yet."}</p>}
        </section>

        {staff && <aside className="panel learning-tools">
          <h2>Authoring tools</h2>
          {canManageCatalogue && <form className="compact-form" onSubmit={(event) => void submit(event, "LINK_BATCH", (form) => ({ courseId: selectedCourseId, batchId: stringValue(form, "batchId") }))}><h3>Assign course to batch</h3><Select name="batchId" required placeholder="Choose batch"><option value="">Choose batch</option>{data.batches.map((batch) => <option value={batch.id} key={batch.id}>{batch.name}</option>)}</Select><Button disabled={busy || !selectedCourseId}>Assign batch</Button></form>}
          <form className="compact-form" onSubmit={(event) => void submit(event, "CREATE_MODULE", (form) => ({ courseId: selectedCourseId, title: stringValue(form, "title"), description: stringValue(form, "description") || null, orderIndex: modules.length, releaseAt: stringValue(form, "releaseAt") ? new Date(stringValue(form, "releaseAt")).toISOString() : null }))}><h3>Add module</h3><input name="title" required placeholder="Electrostatics"/><textarea name="description" placeholder="Module overview"/><label>Scheduled release<DateTimePicker name="releaseAt" placeholder="Scheduled release (optional)" /></label><Button disabled={busy || !selectedCourseId}>Add module</Button></form>
          <form className="compact-form" onSubmit={(event) => void submit(event, "CREATE_LESSON", (form) => ({ moduleId: stringValue(form, "moduleId"), title: stringValue(form, "title"), kind: stringValue(form, "kind"), description: stringValue(form, "description") || null, learningObjectives: stringValue(form, "objectives").split("\n").map((item) => item.trim()).filter(Boolean), durationMinutes: Number(stringValue(form, "durationMinutes")) || null, orderIndex: lessons.filter((lesson) => lesson.module_id === stringValue(form, "moduleId")).length, releaseAt: null }))}><h3>Add lesson</h3><Select name="moduleId" required value={selectedModuleId} onChange={(val) => setSelectedModuleId(val)} placeholder="Choose module"><option value="">Choose module</option>{modules.map((module) => <option value={module.id} key={module.id}>{module.title}</option>)}</Select><input name="title" required placeholder="Gauss's law"/><Select name="kind" defaultValue="VIDEO"><option value="VIDEO">VIDEO</option><option value="DOCUMENT">DOCUMENT</option><option value="DPP">DPP</option><option value="LIVE_CLASS">LIVE_CLASS</option></Select><textarea name="description" placeholder="Lesson description"/><textarea name="objectives" placeholder="One learning objective per line"/><input name="durationMinutes" min="1" type="number" placeholder="Duration in minutes"/><Button disabled={busy}>Add lesson</Button></form>
          <form className="compact-form" onSubmit={(event) => void uploadResource(event)}><h3>Upload private resource</h3><Select name="lessonId" required value={selectedLessonId} onChange={(val) => setSelectedLessonId(val)} placeholder="Choose lesson"><option value="">Choose lesson</option>{lessons.map((lesson) => <option value={lesson.id} key={lesson.id}>{lesson.title}</option>)}</Select><input name="file" type="file" required accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp"/><label className="check-row"><input name="downloadAllowed" type="checkbox" defaultChecked value="true"/> Allow download</label><Button disabled={busy}>Upload securely</Button></form>
          <form className="compact-form" onSubmit={(event) => void submit(event, "CREATE_EXTERNAL_RESOURCE", (form) => ({ lessonId: stringValue(form, "lessonId"), name: stringValue(form, "name"), externalUrl: stringValue(form, "externalUrl"), downloadAllowed: false }))}><h3>Add HTTPS resource</h3><Select name="lessonId" required placeholder="Choose lesson"><option value="">Choose lesson</option>{lessons.map((lesson) => <option value={lesson.id} key={lesson.id}>{lesson.title}</option>)}</Select><input name="name" required placeholder="Recorded lecture"/><input name="externalUrl" required type="url" placeholder="https://…"/><Button disabled={busy}>Add link</Button></form>
        </aside>}
      </div>
    </DashboardLayout>
  );
}
