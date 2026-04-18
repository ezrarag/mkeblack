import { googleMapsApiKey } from "@/lib/firebase/client";

export async function geocodeAddress(address: string) {
  if (!address.trim() || !googleMapsApiKey) {
    return null;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", googleMapsApiKey);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();

    if (!payload.results?.length) {
      return null;
    }

    const location = payload.results[0].geometry?.location;

    if (typeof location?.lat !== "number" || typeof location?.lng !== "number") {
      return null;
    }

    return {
      lat: location.lat,
      lng: location.lng
    };
  } catch {
    return null;
  }
}
