import { auth } from './firebaseClient';

function mapRecordToHistoryItem(record) {
  return {
    id: record.id,
    request_id: record.id,
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
  };
}

export async function fetchHistory() {
  const user = auth.currentUser;
  if (!user) return [];

  const owner = encodeURIComponent(user.uid);
  const response = await fetch(`/api/admin/records?owner=${owner}&limit=1000&offset=0`);
  if (!response.ok) {
    throw new Error('Failed to fetch history from backend');
  }

  const payload = await response.json();
  const records = Array.isArray(payload.records) ? payload.records : [];

  return records
    .slice()
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
    .map(mapRecordToHistoryItem);
}

export async function savePrediction(entry) {
  const user = auth.currentUser;
  if (!user) return null;

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
  };

  let response;

  if (entry.request_id) {
    response = await fetch(`/api/admin/records/${encodeURIComponent(entry.request_id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePayload),
    });
  } else {
    response = await fetch('/api/admin/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePayload),
    });
  }

  if (!response.ok) {
    throw new Error('Failed to save prediction to backend records');
  }

  const payload = await response.json();
  const savedRecord = payload.record || {
    ...basePayload,
    id: entry.request_id,
    time: entry.time,
  };

  return mapRecordToHistoryItem(savedRecord);
}

export async function clearAllPredictions() {
  const user = auth.currentUser;
  if (!user) return false;

  const owner = encodeURIComponent(user.uid);
  const listResponse = await fetch(`/api/admin/records?owner=${owner}&limit=1000&offset=0`);
  if (!listResponse.ok) return false;

  const payload = await listResponse.json();
  const records = Array.isArray(payload.records) ? payload.records : [];

  await Promise.all(
    records.map((record) =>
      fetch(`/api/admin/records/${encodeURIComponent(record.id)}`, { method: 'DELETE' })
    )
  );

  return true;
}
