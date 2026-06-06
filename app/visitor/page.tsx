import { Suspense } from "react";
import { ConsumerRoute } from "@/components/auth/consumer-route";
import { VisitorDashboard } from "@/components/visitor/visitor-dashboard";

export const metadata = {
  title: "My MKE Black",
  description: "Your saved favorites and recently viewed businesses."
};

export default function VisitorPage() {
  return (
    <ConsumerRoute>
      <Suspense>
        <VisitorDashboard />
      </Suspense>
    </ConsumerRoute>
  );
}
