import { AdminPageContent } from "@/components/admin/admin-page";

type AdminPageProps = {
  searchParams?: {
    mode?: string | string[];
  };
};

export default function AdminPage({ searchParams }: AdminPageProps) {
  return <AdminPageContent initialMode={searchParams?.mode} />;
}
