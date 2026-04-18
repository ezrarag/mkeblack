import { BusinessProfilePage } from "@/components/business/business-profile-page";

type BusinessPageProps = {
  params: {
    id: string;
  };
};

export default function BusinessPage({ params }: BusinessPageProps) {
  return <BusinessProfilePage businessId={params.id} />;
}
