import { MilwaukeeNeighborhood, NeighborhoodGeoJsonFeature } from "@/lib/types";
import { slugify, titleCase } from "@/lib/utils";

export const MILWAUKEE_NEIGHBORHOODS_ARCGIS_URL =
  "https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/AGO/neighborhoods/MapServer/0/query?where=1%3D1&outFields=NEIGHBORHD&outSR=4326&f=geojson";

type ArcGisFeatureCollection = {
  type: "FeatureCollection";
  features: Array<NeighborhoodGeoJsonFeature>;
};

function isLngLatPair(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: number[][]
): boolean {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];

    if (!isLngLatPair(currentPoint) || !isLngLatPair(previousPoint)) {
      continue;
    }

    const xi = currentPoint[0];
    const yi = currentPoint[1];
    const xj = previousPoint[0];
    const yj = previousPoint[1];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInPolygonWithHoles(
  lat: number,
  lng: number,
  rings: number[][][]
) {
  const [outerRing, ...holes] = rings;

  if (!outerRing || !pointInPolygon(lat, lng, outerRing)) {
    return false;
  }

  return !holes.some((hole) => pointInPolygon(lat, lng, hole));
}

export function getNeighborhoodForPoint(
  lat: number,
  lng: number,
  neighborhoods: MilwaukeeNeighborhood[]
): string | null {
  for (const neighborhood of neighborhoods) {
    const { geometry } = neighborhood.geojson;

    if (geometry.type === "Polygon") {
      if (pointInPolygonWithHoles(lat, lng, geometry.coordinates)) {
        return neighborhood.name;
      }
    }

    if (geometry.type === "MultiPolygon") {
      const containsPoint = geometry.coordinates.some((polygon) =>
        pointInPolygonWithHoles(lat, lng, polygon)
      );

      if (containsPoint) {
        return neighborhood.name;
      }
    }
  }

  return null;
}

export function normalizeNeighborhoodFeature(
  feature: NeighborhoodGeoJsonFeature
): MilwaukeeNeighborhood | null {
  const rawName = feature.properties.NEIGHBORHD;

  if (typeof rawName !== "string" || !rawName.trim()) {
    return null;
  }

  const name = titleCase(rawName.trim());

  return {
    id: slugify(rawName),
    name,
    geojson: {
      ...feature,
      properties: {
        ...feature.properties,
        NEIGHBORHD: rawName.trim(),
        name
      }
    }
  };
}

export async function fetchOfficialMilwaukeeNeighborhoods() {
  const response = await fetch(MILWAUKEE_NEIGHBORHOODS_ARCGIS_URL);

  if (!response.ok) {
    throw new Error("Milwaukee neighborhood GIS data could not be loaded.");
  }

  const collection = (await response.json()) as ArcGisFeatureCollection;

  if (!Array.isArray(collection.features)) {
    throw new Error("Milwaukee neighborhood GIS data was not valid GeoJSON.");
  }

  return collection.features
    .map(normalizeNeighborhoodFeature)
    .filter((neighborhood): neighborhood is MilwaukeeNeighborhood =>
      Boolean(neighborhood)
    );
}

export function getNeighborhoodBounds(feature: NeighborhoodGeoJsonFeature) {
  const bounds: [[number, number], [number, number]] = [
    [Infinity, Infinity],
    [-Infinity, -Infinity]
  ];

  function includeRing(ring: number[][]) {
    for (const point of ring) {
      if (!isLngLatPair(point)) {
        continue;
      }

      bounds[0][0] = Math.min(bounds[0][0], point[0]);
      bounds[0][1] = Math.min(bounds[0][1], point[1]);
      bounds[1][0] = Math.max(bounds[1][0], point[0]);
      bounds[1][1] = Math.max(bounds[1][1], point[1]);
    }
  }

  if (feature.geometry.type === "Polygon") {
    feature.geometry.coordinates.forEach(includeRing);
  } else {
    feature.geometry.coordinates.forEach((polygon) => polygon.forEach(includeRing));
  }

  return Number.isFinite(bounds[0][0]) ? bounds : null;
}
