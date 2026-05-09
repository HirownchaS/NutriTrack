import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

// ---- Firebase Configuration ----
const firebaseConfig = {
    apiKey: "AIzaSyDoR6LBCOHvbYkZOUxz0bIVUo2fzdKFdwc",
    authDomain: "food-ai-4c45d.firebaseapp.com",
    projectId: "food-ai-4c45d",
    messagingSenderId: "191287408428",
    appId: "1:191287408428:web:91e0bad6bf8fcb3fa0de89"
};

// Singleton App Initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const secondaryApp = getApps().find(a => a.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');

export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

// Singleton Firestore Initialization with Long Polling
let dbInstance;
try {
    dbInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true,
        host: 'firestore.googleapis.com',
        ssl: true
    });
} catch (e) {
    // If initializeFirestore throws, it usually means it's already been initialized.
    // In that case, getFirestore will return the existing instance.
    dbInstance = getFirestore(app);
}

export const db = dbInstance;
export default app;

