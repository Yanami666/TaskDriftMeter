import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

// Your Firebase web app config
const firebaseConfig = {
  apiKey: "AIzaSyBsz7HyQn5NvFm4euWi3CKKv7CQWVHDXYU",
  authDomain: "group-work-meter.firebaseapp.com",
  projectId: "group-work-meter",
  storageBucket: "group-work-meter.firebasestorage.app",
  messagingSenderId: "474010642998",
  appId: "1:474010642998:web:8db25bc9a81f4e1db3c697"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);

export { firebaseConfig };