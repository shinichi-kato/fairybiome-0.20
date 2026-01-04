
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.GATSBY_FIREBASE_API_KEY!,
  authDomain: process.env.GATSBY_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.GATSBY_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.GATSBY_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.GATSBY_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.GATSBY_FIREBASE_APP_ID!,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence); // 永続化：local
const db = getFirestore(app);

export { app, auth, db };
