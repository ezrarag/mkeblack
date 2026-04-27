import { BusinessCategory, BusinessHours, DAY_KEYS } from "@/lib/types";

/**
 * Categories match the Wix export taxonomy exactly so imported businesses
 * land in the correct filter bucket without any post-import cleanup.
 */
export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  "Food & Drink",
  "Hair, Beauty & Grooming",
  "Retail & Shopping",
  "Music, Entertainment & Culture",
  "Arts, Media & Creative Services",
  "Professional & Business Services",
  "Health & Wellness",
  "Mental Health",
  "Education, Youth & Family Services",
  "Home, Cleaning & Maintenance",
  "Work & Event Spaces",
  "Legal & Consulting",
  "Automotive",
  "Sports & Entertainment",
  "Catering, Snacks & Drinks",
  "Online Goods & Products",
  "Online Clothing & Accessories",
  "Nonprofits",
  "Resources",
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
    instagramReelUrl: "",
    email: "",
    hoursText: "",
    neighborhood: "",
    tags: ["black-owned"],
    hours: createDefaultBusinessHours(),
    photos: [],
    ownerUid: "",
    active: true,
    source: "manual" as const,
    location: { ...MILWAUKEE_CENTER }
  };
}
