import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD-ER0hh-YaUDqjSIEsrsFG3Ry4Gxo3yDQ",
  authDomain: "scheduler-93b61.firebaseapp.com",
  projectId: "scheduler-93b61",
  storageBucket: "scheduler-93b61.firebasestorage.app",
  messagingSenderId: "968195147522",
  appId: "1:968195147522:web:85958bd02b2c7e74fae41b",
  measurementId: "G-8XD3W5W8TG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export default app;
