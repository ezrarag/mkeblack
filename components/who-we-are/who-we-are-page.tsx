import { teamMembers, type TeamMember } from "@/lib/data/team";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function MemberCard({ member }: { member: TeamMember }) {
  const initials = getInitials(member.name);
  return (
    <div className="rounded-2xl border border-line bg-panel/80 p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-display text-xl font-bold text-accent">
        {initials}
      </div>
      <p className="mt-4 font-display text-lg font-bold text-ink">{member.name}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-accent">
        {member.role}
      </p>
    </div>
  );
}

function GroupSection({
  label,
  members
}: {
  label: string;
  members: TeamMember[];
}) {
  if (!members.length) return null;
  return (
    <div className="mt-12">
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
        {label}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((member) => (
          <MemberCard key={member.name} member={member} />
        ))}
      </div>
    </div>
  );
}

export function WhoWeArePage() {
  const staff = teamMembers.filter((m) => m.group === "staff");
  const board = teamMembers.filter((m) => m.group === "board");
  const advisory = teamMembers.filter((m) => m.group === "advisory");

  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Who We Are
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            The people behind MKE Black.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            A dedicated team of community builders, advocates, and leaders driving Black
            economic empowerment in Milwaukee and beyond.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        <GroupSection label="Staff" members={staff} />
        <GroupSection label="Board of Directors" members={board} />
        <GroupSection label="Advisory Board" members={advisory} />
      </section>
    </main>
  );
}
