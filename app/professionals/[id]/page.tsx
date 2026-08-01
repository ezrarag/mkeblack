import { ProfessionalProfilePage } from "@/components/professionals/professional-profile-page";
export default function ProfessionalPage({ params }: { params: { id: string } }) { return <ProfessionalProfilePage id={params.id} />; }
