import { MembershipPage } from "@/components/membership/membership-page";

export const metadata = {
  title: "Donate | MKE Black",
  description:
    "Make a one-time donation to support Milwaukee's Black business community."
};

export default function Donate() {
  return <MembershipPage initialKind="donation" />;
}
