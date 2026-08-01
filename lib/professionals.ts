import { Professional, ProfessionalAffiliation } from "@/lib/types";

export const PROFESSIONAL_INDUSTRIES = [
  "Business Owners",
  "Medical",
  "Legal",
  "Home Repair & Construction",
  "Financial Advisors & Accountants",
  "Loan & Program Officers",
  "Nonprofit Leadership",
  "Education",
  "Science & Technology",
  "Government & Civic Leadership",
  "Spiritual Leadership",
  "Arts, Media & Culture",
  "Marketing & Communications",
  "Other"
] as const;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") return toDate.call(value);
  }
  return null;
}

export function normalizeAffiliation(value: unknown, index = 0): ProfessionalAffiliation {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    id: stringValue(data.id) || `affiliation-${index}`,
    organizationName: stringValue(data.organizationName),
    title: stringValue(data.title),
    description: stringValue(data.description),
    location: stringValue(data.location),
    startDate: stringValue(data.startDate),
    endDate: stringValue(data.endDate),
    current: data.current === true,
    businessId: stringValue(data.businessId) || null,
    organizationUrl: stringValue(data.organizationUrl),
    source: data.source === "linkedin_export" ? "linkedin_export" : "manual"
  };
}

export function normalizeProfessionalRecord(value: unknown, id: string): Professional {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    id,
    uid: stringValue(data.uid),
    name: stringValue(data.name) || stringValue(data.businessName),
    headline: stringValue(data.headline),
    bio: stringValue(data.bio),
    photoUrl: stringValue(data.photoUrl),
    location: stringValue(data.location),
    industries: stringArray(data.industries).length
      ? stringArray(data.industries)
      : [stringValue(data.category)].filter(Boolean),
    skills: stringArray(data.skills),
    linkedinUrl: stringValue(data.linkedinUrl),
    websiteUrl: stringValue(data.websiteUrl),
    instagramUrl: stringValue(data.instagramUrl),
    contactEmail: stringValue(data.contactEmail),
    showContactEmail: data.showContactEmail === true,
    openToWork: data.openToWork === true,
    openToCollaboration: data.openToCollaboration === true,
    beamParticipant: data.beamParticipant === true,
    affiliations: Array.isArray(data.affiliations)
      ? data.affiliations.map(normalizeAffiliation).filter((item) => item.organizationName)
      : [],
    active: data.active !== false,
    verified: data.verified === true || data.verifiedStatus === true,
    tierLevel: data.tierLevel === "featured" ? "featured" : "free",
    subscriptionActive: data.subscriptionActive === true,
    stripeCustomerId: stringValue(data.stripeCustomerId),
    stripeConnectAccountId: stringValue(data.stripeConnectAccountId),
    referralPercentage: typeof data.referralPercentage === "number" ? data.referralPercentage : 0,
    visitorCount: typeof data.visitorCount === "number" ? data.visitorCount : 0,
    interactionLog: [],
    externalSync: {},
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt)
  };
}

export function createEmptyAffiliation(source: ProfessionalAffiliation["source"] = "manual"): ProfessionalAffiliation {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `affiliation-${Date.now()}`,
    organizationName: "",
    title: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    businessId: null,
    organizationUrl: "",
    source
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

export function parseLinkedInPositionsCsv(csv: string): ProfessionalAffiliation[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const at = (...names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const companyIndex = at("company name", "company");
  const titleIndex = at("title");
  const descriptionIndex = at("description");
  const locationIndex = at("location");
  const startIndex = at("started on", "start date");
  const endIndex = at("finished on", "end date");
  if (companyIndex < 0) return [];
  return lines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    return {
      ...createEmptyAffiliation("linkedin_export"),
      organizationName: row[companyIndex]?.trim() ?? "",
      title: titleIndex >= 0 ? row[titleIndex]?.trim() ?? "" : "",
      description: descriptionIndex >= 0 ? row[descriptionIndex]?.trim() ?? "" : "",
      location: locationIndex >= 0 ? row[locationIndex]?.trim() ?? "" : "",
      startDate: startIndex >= 0 ? row[startIndex]?.trim() ?? "" : "",
      endDate: endIndex >= 0 ? row[endIndex]?.trim() ?? "" : "",
      current: endIndex < 0 || !row[endIndex]?.trim()
    };
  }).filter((item) => item.organizationName);
}
