import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, doc, setDoc, getDocs, getDoc,
  query, orderBy, limit, serverTimestamp, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = !!(cfg.apiKey && cfg.projectId);
const db = firebaseEnabled ? getFirestore(initializeApp(cfg)) : null;
const RUNS = 'leadIntelRuns';

// Firestore can't store nested arrays inside arrays well and caps docs at 1MB,
// so each lead's analysis is its own doc in a subcollection.

export async function createRun({ fileName, columns, total, offer }) {
  if (!db) return null;
  const ref = await addDoc(collection(db, RUNS), {
    fileName, columns, total, offer,
    done: 0, failed: 0, status: 'running', segment: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveLead(runId, index, payload) {
  if (!db || !runId) return;
  await setDoc(doc(db, RUNS, runId, 'leads', String(index).padStart(5, '0')), payload);
}

export async function updateRun(runId, patch) {
  if (!db || !runId) return;
  await updateDoc(doc(db, RUNS, runId), patch);
}

export async function listRuns() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, RUNS), orderBy('createdAt', 'desc'), limit(50)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function loadRun(runId) {
  if (!db) return null;
  const run = await getDoc(doc(db, RUNS, runId));
  if (!run.exists()) return null;
  const leadsSnap = await getDocs(collection(db, RUNS, runId, 'leads'));
  const leads = leadsSnap.docs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => d.data());
  return { id: run.id, ...run.data(), leads };
}

export async function deleteRun(runId) {
  if (!db) return;
  const leadsSnap = await getDocs(collection(db, RUNS, runId, 'leads'));
  const batch = writeBatch(db);
  leadsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await deleteDoc(doc(db, RUNS, runId));
}
