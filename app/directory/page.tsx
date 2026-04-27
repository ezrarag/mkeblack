import { DirectoryPage } from "@/components/directory/directory-page";

type DirectoryRoutePageProps = {
  searchParams?: {
    tag?: string | string[];
  };
};

export default function DirectoryRoutePage({
  searchParams
}: DirectoryRoutePageProps) {
  const tags = Array.isArray(searchParams?.tag)
    ? searchParams.tag
    : searchParams?.tag
    ? [searchParams.tag]
    : [];

  return <DirectoryPage initialTags={tags} />;
}
