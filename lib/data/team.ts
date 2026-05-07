export type TeamMember = {
  name: string;
  role: string;
  group: "staff" | "board" | "advisory";
};

export const teamMembers: TeamMember[] = [
  { name: "Kenge Adams", role: "Project Manager", group: "staff" },
  { name: "Rick Banks", role: "Board Chair", group: "board" },
  { name: "Solana Patterson-Ramos", role: "Vice Chair", group: "board" },
  { name: "Asha Sawyers", role: "Secretary", group: "board" },
  { name: "Ayrton Bryan", role: "Board Member", group: "board" },
  { name: "Alecia Miller", role: "Board Member", group: "board" },
  { name: "Nadiyah Johnson", role: "Board Member", group: "board" },
  { name: "Dr. Cassandra Bowers", role: "Board Member", group: "board" },
  { name: "Derrick Mosely", role: "Advisory Board", group: "advisory" },
  { name: "Reggie Moore", role: "Advisory Board", group: "advisory" },
];
