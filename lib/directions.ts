export type LatLng = {
  lat: number;
  lng: number;
};

export function getGoogleMapsDirectionsUrl(
  destination: LatLng,
  origin?: LatLng | null
) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving"
  });

  if (origin) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
