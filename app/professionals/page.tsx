import type { Metadata } from "next";
import { ProfessionalsDirectoryPage } from "@/components/professionals/professionals-directory-page";
export const metadata: Metadata = { title: "Professional Directory | MKE Black", description: "Discover Black professionals and expertise across Milwaukee." };
export default function ProfessionalsPage() { return <ProfessionalsDirectoryPage />; }
