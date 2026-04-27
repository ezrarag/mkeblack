import {
  fetchOfficialMilwaukeeNeighborhoods,
  normalizeNeighborhoodFeature
} from "@/lib/neighborhood";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { MilwaukeeNeighborhood } from "@/lib/types";

const COLLECTION_NAME = "milwaukee_neighborhoods";

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  return {
    db,
    firestoreModule
  };
}

function normalizeNeighborhoodRecord(
  value: Record<string, unknown>,
  id: string
): MilwaukeeNeighborhood | null {
  const name = typeof value.name === "string" ? value.name : "";
  const geojson = value.geojson;

  if (
    !name ||
    typeof geojson !== "object" ||
    geojson === null ||
    !("type" in geojson) ||
    geojson.type !== "Feature"
  ) {
    return null;
  }

  return normalizeNeighborhoodFeature(
    geojson as MilwaukeeNeighborhood["geojson"]
  ) ?? {
    id,
    name,
    geojson: geojson as MilwaukeeNeighborhood["geojson"]
  };
}

export async function getMilwaukeeNeighborhoods() {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const collectionReference = firestoreModule.collection(db, COLLECTION_NAME);
  const snapshot = await firestoreModule.getDocs(collectionReference);

  if (!snapshot.empty) {
    return snapshot.docs
      .map((document) =>
        normalizeNeighborhoodRecord(document.data(), document.id)
      )
      .filter((neighborhood): neighborhood is MilwaukeeNeighborhood =>
        Boolean(neighborhood)
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  const neighborhoods = await fetchOfficialMilwaukeeNeighborhoods();

  await Promise.all(
    neighborhoods.map((neighborhood) =>
      firestoreModule.setDoc(
        firestoreModule.doc(db, COLLECTION_NAME, neighborhood.id),
        neighborhood
      )
    )
  );

  return neighborhoods.sort((left, right) => left.name.localeCompare(right.name));
}

export async function redetectBusinessNeighborhood(location: {
  lat: number;
  lng: number;
}) {
  const { getNeighborhoodForPoint } = await import("@/lib/neighborhood");
  const neighborhoods = await getMilwaukeeNeighborhoods();
  return getNeighborhoodForPoint(location.lat, location.lng, neighborhoods) ?? "";
}
