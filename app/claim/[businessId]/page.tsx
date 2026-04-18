import { ClaimListingPage } from "@/components/auth/claim-listing-page";

type ClaimBusinessPageProps = {
  params: {
    businessId: string;
  };
};

export default function ClaimBusinessPage({ params }: ClaimBusinessPageProps) {
  return <ClaimListingPage businessId={params.businessId} />;
}
