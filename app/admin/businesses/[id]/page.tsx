import { BusinessEditPage } from "@/components/admin/business-edit-page";

type AdminBusinessEditPageProps = {
  params: {
    id: string;
  };
};

export default function AdminBusinessEditRoute({
  params
}: AdminBusinessEditPageProps) {
  return <BusinessEditPage businessId={params.id} />;
}
