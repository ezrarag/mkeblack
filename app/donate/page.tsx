import { Suspense } from "react";
import { MembershipPage } from "@/components/membership/membership-page";

export const metadata = {
  title: "Donate | MKE Black",
  description:
    "Make a one-time donation to support Milwaukee's Black business community."
};

export default function Donate() {
  // Suspense boundary required because MembershipPage reads `?route=` via
  // useSearchParams (Next.js requirement for CSR bailout on search params).
  return (
    <Suspense fallback={null}>
      <MembershipPage initialKind="donation" />
    </Suspense>
  );
}
