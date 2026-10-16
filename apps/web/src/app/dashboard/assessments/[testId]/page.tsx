import { AssessmentAttemptWorkspace } from "@/components/assessment-attempt-workspace";

export default async function AssessmentAttemptPage({ params }: { params: Promise<{ testId: string }> }) {
  return <AssessmentAttemptWorkspace testId={(await params).testId} />;
}
