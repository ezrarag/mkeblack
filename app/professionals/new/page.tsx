import type { Metadata } from "next";
import { ProfessionalEditorPage } from "@/components/professionals/professional-editor-page";
export const metadata: Metadata = { title: "My Professional Profile | MKE Black" };
export default function NewProfessionalPage() { return <ProfessionalEditorPage />; }
