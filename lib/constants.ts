import { BusinessCategory, BusinessHours, DAY_KEYS } from "@/lib/types";

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  "Food & Drink",
  "Retail",
  "Services",
  "Health & Wellness",
  "Arts & Culture",
  "Beauty",
  "Professional",
  "Community",
  "Other"
];

export const MILWAUKEE_CENTER = {
  lat: 43.0389,
  lng: -87.9065
};

export function createDefaultBusinessHours(): BusinessHours {
  return DAY_KEYS.reduce((hours, day) => {
    hours[day] = {
      open: "09:00",
      close: "17:00",
      closed: day === "sunday"
    };
    return hours;
  }, {} as BusinessHours);
}

export function createClosedBusinessHours(): BusinessHours {
  return DAY_KEYS.reduce((hours, day) => {
    hours[day] = {
      open: "09:00",
      close: "17:00",
      closed: true
    };
    return hours;
  }, {} as BusinessHours);
}

export function createEmptyBusinessForm() {
  return {
    name: "",
    category: BUSINESS_CATEGORIES[0],
    description: "",
    address: "",
    phone: "",
    website: "",
    email: "",
    hoursText: "",
    hours: createDefaultBusinessHours(),
    photos: [],
    ownerUid: "",
    active: true,
    source: "manual" as const,
    location: { ...MILWAUKEE_CENTER }
  };
}
