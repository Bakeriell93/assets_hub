import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, FirebaseStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAFfWS8fD8G1XRvWHXefeUmCjdHY8l7t8s",
  authDomain: "content-b7d4c.firebaseapp.com",
  projectId: "content-b7d4c",
  storageBucket: "eu13657", // EU bucket for faster uploads
  messagingSenderId: "451578978927",
  appId: "1:451578978927:web:3294a541652f07b944239a",
  measurementId: "G-Z0QF8SYSW2"
};

// Initialize Firebase with comprehensive error handling
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let initError: Error | null = null;

try {
  // Use existing app if already initialized (prevents hot-reload errors)
  if (getApps().length > 0) {
    app = getApp();
  } else {
    app = initializeApp(firebaseConfig);
  }
  
  // Initialize services with error handling
  if (app) {
    try {
      db = getFirestore(app);
      // Explicitly specify the EU bucket for storage
      storage = getStorage(app, "gs://eu13657");
      
      // Verify services are available
      if (!db) {
        throw new Error("Firestore service is not available");
      }
      if (!storage) {
        throw new Error("Storage service is not available");
      }
      
      console.log("Firebase initialized successfully with EU bucket:", "eu13657");
    } catch (serviceError: any) {
      console.error("Firebase service initialization error:", serviceError);
      initError = new Error(`Firebase services not available: ${serviceError?.message || 'Unknown error'}`);
    }
  }
} catch (error: any) {
  console.error("Firebase initialization error:", error);
  initError = new Error(`Firebase initialization failed: ${error?.message || 'Unknown error'}`);
}

// Export with null checks - services will throw helpful errors if used before initialization
export { app, db, storage, initError };