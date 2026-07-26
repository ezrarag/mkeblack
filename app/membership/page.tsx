import { Suspense } from "react";
import { MembershipPage } from "@/components/membership/membership-page";

export const metadata = {
  title: "Membership | MKE Black",
  description: "Join the MKE Black Solidarity Circle and support Milwaukee's Black business community."
};

export default function Membership() {
  // Suspense boundary required because MembershipPage reads `?route=` via
  // useSearchParams (Next.js requirement for CSR bailout on search params).
  return (
    <Suspense fallback={null}>
      <MembershipPage />
    </Suspense>
  );
}
