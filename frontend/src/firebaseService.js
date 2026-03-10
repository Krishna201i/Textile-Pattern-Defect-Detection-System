// Firestore + Storage persistence for scan history (requires authenticated user).

import { db, storage, auth } from './firebaseClient';

const isFirebaseConfigured = Boolean(db && storage && auth);

export async function fetchHistory() {
  if (!isFirebaseConfigured) return [];

  const { collection, query, orderBy, where, getDocs } = await import('firebase/firestore');
  const user = auth.currentUser;
  if (!user) return [];

  const col = collection(db, 'scans');
  const q = query(col, where('owner', '==', user.uid), orderBy('created_at', 'asc'));
  const snap = await getDocs(q);
  const items = [];
  snap.forEach((doc) => {
    const data = doc.data();
    items.push({
      id: doc.id,
      label: data.label || 'unknown',
      confidence: Number(data.confidence || 0),
      defect_probability: Number(data.defect_probability || 0),
      preview: data.image_url || null,
      filename: data.filename || null,
      time: (data.created_at && data.created_at.toDate) ? data.created_at.toDate().toLocaleTimeString() : (data.time || new Date().toLocaleTimeString()),
    });
  });
  return items;
}

export async function savePrediction(entry) {
  if (!isFirebaseConfigured) return null;

  const { collection, addDoc, serverTimestamp, doc, updateDoc } = await import('firebase/firestore');
  const { ref: storageRef, uploadString, getDownloadURL } = await import('firebase/storage');

  const user = auth.currentUser;
  if (!user) return null;

  const col = collection(db, 'scans');
  const docRef = await addDoc(col, {
    label: entry.label || 'unknown',
    confidence: Number(entry.confidence || 0),
    defect_probability: Number(entry.defect_probability || 0),
    filename: entry.filename || null,
    created_at: serverTimestamp(),
    time: entry.time || new Date().toLocaleTimeString(),
    image_url: '',
    owner: user.uid,
  });

  let downloadUrl = null;
  if (entry.preview && entry.preview.startsWith('data:')) {
    const fileRef = storageRef(storage, `scans/${user.uid}/${docRef.id}.jpg`);
    await uploadString(fileRef, entry.preview, 'data_url');
    downloadUrl = await getDownloadURL(fileRef);
    await updateDoc(doc(db, 'scans', docRef.id), { image_url: downloadUrl });
  }

  return {
    id: docRef.id,
    label: entry.label || 'unknown',
    confidence: Number(entry.confidence || 0),
    defect_probability: Number(entry.defect_probability || 0),
    preview: downloadUrl || entry.preview || null,
    filename: entry.filename || null,
    time: entry.time || new Date().toLocaleTimeString(),
  };
}

export async function clearAllPredictions() {
  if (!isFirebaseConfigured) return false;

  const { collection, getDocs, deleteDoc, doc, query, where } = await import('firebase/firestore');
  const { ref: storageRef, deleteObject } = await import('firebase/storage');
  const user = auth.currentUser;
  if (!user) return false;

  const col = collection(db, 'scans');
  const q = query(col, where('owner', '==', user.uid));
  const snap = await getDocs(q);
  const deletes = snap.docs.map(async (d) => {
    try {
      const data = d.data();
      if (data && data.image_url) {
        const fileRef = storageRef(storage, `scans/${user.uid}/${d.id}.jpg`);
        await deleteObject(fileRef).catch(() => {});
      }
    } catch (e) {}
    await deleteDoc(doc(db, 'scans', d.id));
  });
  await Promise.all(deletes);
  return true;
}
