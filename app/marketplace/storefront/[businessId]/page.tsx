import { MarketplaceStorefrontPage } from "@/components/marketplace/marketplace-storefront-page";

export const metadata = {
  title: "Marketplace Storefront — MKE Black",
  description: "Shop products and services from an MKE Black Solidarity Circle business."
};

export default function MarketplaceStorefrontRoute({
  params
}: {
  params: { businessId: string };
}) {
  return <MarketplaceStorefrontPage businessId={params.businessId} />;
}
