// js-rssi/firebaseApp.js
// Firebase v11 ESM を gstatic から import
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getDatabase, ref, child, get, onChildAdded, query, limitToLast } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

export const fb = {
  initializeApp, getDatabase, ref, child, get, onChildAdded, query, limitToLast,
  getAuth, signInAnonymously, onAuthStateChanged
};

export const firebaseConfig = {
  apiKey: "AIzaSyDU8s-5XLJH1Ac-EIfkL9SQPm8X1Wb2QZY",
  authDomain: "beaconmanager-405e2.firebaseapp.com",
  databaseURL: "https://beaconmanager-405e2-default-rtdb.firebaseio.com",
  projectId: "beaconmanager-405e2",
  storageBucket: "beaconmanager-405e2.appspot.com",
  messagingSenderId: "380153233269",
  appId: "1:380153233269:web:85d844b4897d2c8b169d3c"
};

export function initFirebase(){
  const app = initializeApp(firebaseConfig);
  const db  = getDatabase(app);
  const auth = getAuth(app);
  return { app, db, auth };
}
