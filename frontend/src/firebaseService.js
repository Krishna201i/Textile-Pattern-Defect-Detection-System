import { auth, db, storage } from './firebaseClient';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

const SCANS_COLLECTION = 'scan_records';

function mapDocToHistoryItem(docSnap) {
  const record = docSnap.data() || {};
  return mapRecordToHistoryItem({ ...record, id: docSnap.id });
}

async function uploadPreviewImage(preview, owner, filename) {
  if (!preview || !storage) return null;
  const safeOwner = owner || 'unknown';
  const safeName = filename || `scan_${Date.now()}.jpg`;
  const storageRef = ref(storage, `scans/${safeOwner}/${Date.now()}_${safeName}`);
  await uploadString(storageRef, preview, 'data_url');
  return getDownloadURL(storageRef);
}

function mapRecordToHistoryItem(record) {
  return {
    id: record.id,
    request_id: record.id,
    owner: record.owner || null,          // FIX: was missing — caused blank owner in CSV export
    label: record.label || 'unknown',
    confidence: Number(record.confidence || 0),
    defect_probability: Number(record.defect_probability || 0),
    source: record.source || 'upload',
    pipeline: record.pipeline || 'cnn_cv_hybrid',
    cnn_defect_probability: Number(record.cnn_defect_probability || 0),
    cv_defect_probability: Number(record.cv_defect_probability || 0),
    preview: record.image_url || null,
    filename: record.filename || null,
    time: record.time || new Date().toLocaleTimeString(),
    admin_note: record.admin_note || '',
  };
}

export async function fetchHistory() {
  const user = auth.currentUser;
  if (!user) return [];

  const scansRef = collection(db, SCANS_COLLECTION);
  const q = query(
    scansRef,
    where('owner', '==', user.uid),
    orderBy('created_at', 'desc'),
    limit(1000)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapDocToHistoryItem);
}

export async function savePrediction(entry) {
  const user = auth.currentUser;
  if (!user) return null;

  // Firestore has a 1MB per-document hard limit.
  // Base64-encoded images can easily exceed this for high-res photos.
  // FIX: only store the preview if it is under 700KB (safe margin).
  const MAX_PREVIEW_BYTES = 700 * 1024;
  const rawPreview = entry.preview || null;
  const imageUrl =
    rawPreview && rawPreview.length <= MAX_PREVIEW_BYTES ? rawPreview : null;

  const basePayload = {
    owner: user.uid,
    label: entry.label || 'unknown',
    confidence: Number(entry.confidence || 0),
    defect_probability: Number(entry.defect_probability || 0),
    source: entry.source || 'upload',
    pipeline: entry.pipeline || 'cnn_cv_hybrid',
    cnn_defect_probability: Number(entry.cnn_defect_probability || 0),
    cv_defect_probability: Number(entry.cv_defect_probability || 0),
    filename: entry.filename || 'image',
    admin_note: '',
    image_url: imageUrl,
    time: new Date().toISOString(),
    created_at: serverTimestamp(),
  };

  if (entry.request_id) {
    const docRef = doc(db, SCANS_COLLECTION, entry.request_id);
    await setDoc(docRef, basePayload, { merge: true });
    return mapRecordToHistoryItem({ ...basePayload, id: entry.request_id });
  }

  const docRef = await addDoc(collection(db, SCANS_COLLECTION), basePayload);
  return mapRecordToHistoryItem({ ...basePayload, id: docRef.id });
}

export async function clearAllPredictions() {
  const user = auth.currentUser;
  if (!user) return false;

  const scansRef = collection(db, SCANS_COLLECTION);
  const q = query(scansRef, where('owner', '==', user.uid));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return true;
}

export async function fetchAllScans(limitCount = 2000) {
  const scansRef = collection(db, SCANS_COLLECTION);
  const q = query(scansRef, orderBy('created_at', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(mapDocToHistoryItem);
}

export async function updateScanRecord(scanId, updates) {
  if (!scanId) throw new Error('Missing scan id');
  const docRef = doc(db, SCANS_COLLECTION, scanId);
  await updateDoc(docRef, { ...updates, updated_at: serverTimestamp() });
}

export async function deleteScanRecord(scanId) {
  if (!scanId) throw new Error('Missing scan id');
  const docRef = doc(db, SCANS_COLLECTION, scanId);
  await deleteDoc(docRef);
}
