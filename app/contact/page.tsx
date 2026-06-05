import { Suspense } from "react";
import { ContactPage } from "@/components/contact/contact-page";

export const metadata = {
  title: "Contact | MKE Black",
  description: "Contact MKE Black for directory submissions, questions, partnerships, or corrections."
};

export default function Contact() {
  return (
    <Suspense>
      <ContactPage />
    </Suspense>
  );
}
