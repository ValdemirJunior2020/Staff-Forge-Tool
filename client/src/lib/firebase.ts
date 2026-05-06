// client/src/lib/firebase.ts

import { initializeApp } from "firebase/app";
import {
  getAnalytics,
  isSupported,
  logEvent,
  type Analytics,
} from "firebase/analytics";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA51gDGvIJ01cwLGRiqwNVxAkNUWfr5WcE",
  authDomain: "quizzhp-3729a.firebaseapp.com",
  projectId: "quizzhp-3729a",
  storageBucket: "quizzhp-3729a.firebasestorage.app",
  messagingSenderId: "511564005836",
  appId: "1:511564005836:web:fa8075e18dd34b47535d69",
  measurementId: "G-XC6SB8RM4J",
};

export const app = initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);

let analyticsInstance: Analytics | null = null;

async function getAnalyticsSafe() {
  try {
    const supported = await isSupported();
    if (!supported) return null;

    if (!analyticsInstance) {
      analyticsInstance = getAnalytics(app);
    }

    return analyticsInstance;
  } catch (error) {
    console.warn("Firebase Analytics unavailable:", error);
    return null;
  }
}

export async function trackEvent(
  eventName: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    const analytics = await getAnalyticsSafe();

    if (analytics) {
      logEvent(analytics, eventName, metadata);
    }

    await addDoc(collection(db, "staffforge_events"), {
      eventName,
      metadata,
      pageUrl: window.location.href,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("Firebase tracking skipped:", error);
  }
}

export async function createFirebaseSession(payload: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "staffforge_sessions"), {
    ...payload,
    startedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    pageUrl: window.location.href,
  });

  return ref.id;
}