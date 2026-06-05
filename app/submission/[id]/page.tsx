import { SubmissionStatusPage } from "@/components/contact/submission-status-page";

type SubmissionRoutePageProps = {
  params: {
    id: string;
  };
};

export default function SubmissionRoutePage({ params }: SubmissionRoutePageProps) {
  return <SubmissionStatusPage submissionId={params.id} />;
}
