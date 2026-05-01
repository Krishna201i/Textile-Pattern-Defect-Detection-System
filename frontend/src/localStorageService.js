export async function fetchHistory() {
  const data = localStorage.getItem('scans');
  return data ? JSON.parse(data) : [];
}

export async function savePrediction(entry) {
  const scans = await fetchHistory();
  const newEntry = { 
    ...entry, 
    id: Date.now().toString(), 
    time: new Date().toLocaleString(),
    owner: "local_user"
  };
  scans.push(newEntry);
  localStorage.setItem('scans', JSON.stringify(scans));
  return newEntry;
}

export async function clearAllPredictions() {
  localStorage.removeItem('scans');
  return true;
}

export async function fetchAllScans() {
  return fetchHistory();
}

export async function updateScanRecord(id, payload) {
  const scans = await fetchHistory();
  const index = scans.findIndex(s => s.id === id);
  if (index !== -1) {
    scans[index] = { ...scans[index], ...payload };
    localStorage.setItem('scans', JSON.stringify(scans));
  }
}

export async function deleteScanRecord(id) {
  const scans = await fetchHistory();
  const filtered = scans.filter(s => s.id !== id);
  localStorage.setItem('scans', JSON.stringify(filtered));
}
