import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);
export const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

function canInitializeFirebase() {
  return typeof window !== "undefined" && isFirebaseConfigured;
}

export async function loadFirebaseAppModule() {
  return import("firebase/app");
}

export async function loadFirebaseAuthModule() {
  return import("firebase/auth");
}

export async function loadFirebaseFirestoreModule() {
  return import("firebase/firestore");
}

export async function loadFirebaseStorageModule() {
  return import("firebase/storage");
}

export async function getFirebaseApp() {
  if (!canInitializeFirebase()) {
    return null;
  }

  if (!app) {
    const { getApp, getApps, initializeApp } = await loadFirebaseAppModule();
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  return app;
}

export async function getFirebaseAuth() {
  const firebaseApp = await getFirebaseApp();

  if (!firebaseApp) {
    return null;
  }

  if (!auth) {
    const { getAuth } = await loadFirebaseAuthModule();
    auth = getAuth(firebaseApp);
  }

  return auth;
}

export async function getFirebaseDb() {
  const firebaseApp = await getFirebaseApp();

  if (!firebaseApp) {
    return null;
  }

  if (!db) {
    const { getFirestore } = await loadFirebaseFirestoreModule();
    db = getFirestore(firebaseApp);
  }

  return db;
}

export async function getFirebaseStorage() {
  const firebaseApp = await getFirebaseApp();

  if (!firebaseApp) {
    return null;
  }

  if (!storage) {
    const { getStorage } = await loadFirebaseStorageModule();
    storage = getStorage(firebaseApp);
  }

  return storage;
}
