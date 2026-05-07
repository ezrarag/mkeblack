import { Suspense } from "react";
import { JoinForm } from "@/components/auth/join-form";

export const metadata = {
  title: "Join MKE Black",
  description:
    "Create a free account to save your favorite Black-owned businesses and track where you've been."
};

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
