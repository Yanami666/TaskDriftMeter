// firebase.js
// Realtime prototype setup (CDN module style)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Your Firebase web app config (from Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyBsz7HyQn5NvFm4euWi3CKKv7CQWVHDXYU",
  authDomain: "group-work-meter.firebaseapp.com",
  projectId: "group-work-meter",
  storageBucket: "group-work-meter.firebasestorage.app",
  messagingSenderId: "474010642998",
  appId: "1:474010642998:web:8db25bc9a81f4e1db3c697"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Firestore (realtime database)
export const db = getFirestore(app);

// (Optional) export config if you want it elsewhere later
export { firebaseConfig };