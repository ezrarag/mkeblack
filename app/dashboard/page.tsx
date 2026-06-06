import { Suspense } from "react";
import { DashboardPageContent } from "@/components/dashboard/dashboard-page";

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardPageContent />
    </Suspense>
  );
}
