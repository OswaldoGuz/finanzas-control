import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD_2xkr0-D-RXsCaoKFwzeTff6HBZCOqgQ",
  authDomain: "finanzas-personales-425b7.firebaseapp.com",
  projectId: "finanzas-personales-425b7",
  storageBucket: "finanzas-personales-425b7.firebasestorage.app",
  messagingSenderId: "418209910076",
  appId: "1:418209910076:web:ec5891e320d64477eb2239"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
