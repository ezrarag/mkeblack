import { GroupPage } from "@/components/groups/group-page";

type GroupRouteProps = {
  params: {
    groupId: string;
  };
};

export default function GroupRoute({ params }: GroupRouteProps) {
  return <GroupPage groupId={params.groupId} />;
}
