export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export type DailyHours = {
  open: string;
  close: string;
  closed: boolean;
};

export type BusinessHours = Record<DayKey, DailyHours>;

export type BusinessCategory =
  | "Food & Drink"
  | "Retail"
  | "Services"
  | "Health & Wellness"
  | "Arts & Culture"
  | "Beauty"
  | "Professional"
  | "Community"
  | "Other";

export type Business = {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  hours: BusinessHours;
  photos: string[];
  ownerUid: string;
  active: boolean;
  location: {
    lat: number;
    lng: number;
  };
};

export type UserRole = "business" | "admin";

export type UserProfile = {
  uid: string;
  email: string;
  role: UserRole;
  businessId: string;
};

export type BusinessFormValues = Omit<Business, "id">;
