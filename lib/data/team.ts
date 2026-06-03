export type TeamMember = {
  name: string;
  role: string;
  group: "staff" | "board" | "advisory";
  bio: string;
  photoUrl: string;
};

export const teamMembers: TeamMember[] = [
  // ── Staff ─────────────────────────────────────────────────────────────────
  {
    name: "Asha Sawyers",
    role: "Executive Director",
    group: "staff",
    bio: 'With a background in nonprofit leadership, digital marketing, and program development, Asha leads initiatives that provide entrepreneurs with visibility, education, and access to resources. "I am committed to building sustainable pathways for small business growth and long-term economic equity."',
    photoUrl:
      "https://static.wixstatic.com/media/9f0f22_bbd7931e6c9b4891ba141d70d32fec69~mv2.jpg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/9f0f22_bbd7931e6c9b4891ba141d70d32fec69~mv2.jpg",
  },

  // ── Board of Directors ────────────────────────────────────────────────────
  {
    name: "Rick Banks",
    role: "Chair — Board of Directors & Co-Founder",
    group: "board",
    bio: "Rick Banks is a Milwaukee native who has worked as an activist and organizer in Milwaukee since 2010. He works professionally as the Senior Program Manager of African-American Affairs in the Milwaukee County Office of Equity. He defines his personal mission as the political and economic development of Black people in Milwaukee.",
    photoUrl:
      "https://static.wixstatic.com/media/06d0ba_d0780fb495bf4fb78cec93faa314cac4~mv2.jpg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/06d0ba_d0780fb495bf4fb78cec93faa314cac4~mv2.jpg",
  },
  {
    name: "Solana Patterson-Ramos",
    role: "Vice Chair — Board of Directors",
    group: "board",
    bio: "Solana Patterson-Ramos is a community organizer and educator born and raised in Milwaukee. She has more than 15 years of experience in community outreach focusing on youth, LGBTQ+, and civic engagement in Black and Brown communities.",
    photoUrl:
      "https://static.wixstatic.com/media/82231f_08966fc676cd4ec08aba8092c9ee24d7~mv2.jpg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/82231f_08966fc676cd4ec08aba8092c9ee24d7~mv2.jpg",
  },
  {
    name: "Alesia Miller",
    role: "Member — Board of Directors",
    group: "board",
    bio: "Alesia Miller is a mother, vocalist, and educator. She is the Founder and CEO of Milwaukee's first Black woman-owned kombucha tea brewing company, Soul Brew Kombucha.",
    photoUrl:
      "https://static.wixstatic.com/media/82231f_7cec3d8a5b4c41bcbbd3c15d4c61ed45~mv2.jpeg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/82231f_7cec3d8a5b4c41bcbbd3c15d4c61ed45~mv2.jpeg",
  },
  {
    name: "Dr. Cassandra Bowers",
    role: "Member — Board of Directors",
    group: "board",
    bio: "Dr. Cass Bowers is a respected movement communications leader in Wisconsin. She has been leading All in Wisconsin's communications and narrative work since early 2021 and founded AIW's BIPOC Communicators fellowship and hub. She also serves as board president of the African American Roundtable and is on the advisory board for the Milwaukee Freedom Fund. Dr. Bowers holds a Ph.D. in Business with research focused on Black women leaders in nonprofit organizations.",
    photoUrl:
      "https://static.wixstatic.com/media/82231f_fbfa15aba4744bdc8464ba7e03fd7899~mv2.jpeg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/82231f_fbfa15aba4744bdc8464ba7e03fd7899~mv2.jpeg",
  },
  {
    name: "Terrence Moore Sr.",
    role: "Board Member",
    group: "board",
    bio: "Terrence Moore, Sr. is an accomplished leadership professional with over 30 years of experience spanning entrepreneurship, business development, nonprofit and corporate advisory, and community engagement. He leverages his background in strategy formation, program design, economic and commercial corridor development, and business mentorship to advance Black-owned businesses and community initiatives throughout Milwaukee.",
    photoUrl:
      "https://static.wixstatic.com/media/9f0f22_6fdfc1926bfe4b93b8f25f48b134d550~mv2.jpg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/9f0f22_6fdfc1926bfe4b93b8f25f48b134d550~mv2.jpg",
  },
  {
    name: "Nadiyah Johnson",
    role: "Member — Board of Directors",
    group: "board",
    bio: 'Nadiyah\'s passion for diversity in STEM led her to launch Jet Constellations, a local software company whose social impact arm promotes racial diversity in the tech industry through STEM education and entrepreneurship programming. She is currently realizing the vision that Milwaukee is the "Milky Way Tech Hub" — a tech hub representative of Milwaukee\'s diverse population. Nadiyah is a Milwaukee Business Journal 40 Under 40 honoree and a professor at Marquette University.',
    photoUrl:
      "https://static.wixstatic.com/media/06d0ba_7b98d715a95a42908d51d64d9c4f59f2~mv2.jpg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/06d0ba_7b98d715a95a42908d51d64d9c4f59f2~mv2.jpg",
  },

  // ── Advisory Board ────────────────────────────────────────────────────────
  {
    name: "Reggie Moore",
    role: "Advisory Board Member",
    group: "advisory",
    bio: "Director of Violence Prevention Policy and Engagement for the Medical College of Wisconsin (MCW) Comprehensive Injury Center (CIC).",
    photoUrl:
      "https://static.wixstatic.com/media/06d0ba_471797c1ac22474696273b13b28f1706~mv2.jpg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/06d0ba_471797c1ac22474696273b13b28f1706~mv2.jpg",
  },
  {
    name: "Derrick Mosely",
    role: "Advisory Board Member",
    group: "advisory",
    bio: "Director of Marquette University Law School's Lubar Center for Public Policy Research and Civic Education, former Judge of the Milwaukee Municipal Court, and Black History & Food Blogger.",
    photoUrl:
      "https://static.wixstatic.com/media/82231f_46572f1c5b39405e95470a51f33f3c33~mv2.jpg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/82231f_46572f1c5b39405e95470a51f33f3c33~mv2.jpg",
  },
  {
    name: "Brad Kroupa",
    role: "Advisory Board Member",
    group: "advisory",
    bio: "Executive Director of the Forest County Potawatomi Foundation.",
    photoUrl:
      "https://static.wixstatic.com/media/9f0f22_e6545c424db549f0883c361812dd5913~mv2.jpg/v1/fill/w_480,h_480,al_c,q_85,usm_0.66_1.00_0.01/9f0f22_e6545c424db549f0883c361812dd5913~mv2.jpg",
  },
];
