import { GroupsDirectoryPage } from "@/components/groups/groups-directory-page";

export const metadata = {
  title: "Groups — MKE Black",
  description:
    "Visitor-run community groups — fan clubs, regulars' crews, and neighborhood circles built around Milwaukee's Black-owned businesses."
};

export default function GroupsRoute() {
  return <GroupsDirectoryPage />;
}
