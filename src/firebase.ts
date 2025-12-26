// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);