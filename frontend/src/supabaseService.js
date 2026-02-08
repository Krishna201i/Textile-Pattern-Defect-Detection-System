import { supabase } from './supabaseClient';

/**
 * Fetch all scans from Supabase, ordered oldest-first.
 * Table: "Scans" with columns: id, image_path, Confidience, defect_probability, created_at
 */
export async function fetchHistory() {
  const { data, error } = await supabase
    .from('Scans')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch history:', error.message, error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    label: parseFloat(row.defect_probability) > 50 ? 'defective' : 'non_defective',
    confidence: parseFloat(row.Confidience),
    defect_probability: parseFloat(row.defect_probability),
    preview: row.image_path,
    filename: null,
    time: new Date(row.created_at).toLocaleTimeString(),
  }));
}

/**
 * Insert a new scan into Supabase.
 */
export async function savePrediction(entry) {
  // Compress large base64 preview images
  let preview = entry.preview;
  if (preview && preview.length > 500000) {
    try {
      const img = new Image();
      const loaded = new Promise((resolve) => { img.onload = resolve; });
      img.src = preview;
      await loaded;
      const canvas = document.createElement('canvas');
      const maxDim = 400;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      preview = canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      preview = null;
    }
  }

  const { data, error } = await supabase
    .from('Scans')
    .insert({
      image_path: preview || '',
      Confidience: entry.confidence,
      defect_probability: entry.defect_probability,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save scan:', error.message, error);
    return null;
  }

  return {
    id: data.id,
    label: parseFloat(data.defect_probability) > 50 ? 'defective' : 'non_defective',
    confidence: parseFloat(data.Confidience),
    defect_probability: parseFloat(data.defect_probability),
    preview: data.image_path,
    filename: null,
    time: new Date(data.created_at).toLocaleTimeString(),
  };
}

/**
 * Delete all scans from Supabase.
 */
export async function clearAllPredictions() {
  const { error } = await supabase
    .from('Scans')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('Failed to clear scans:', error.message);
    return false;
  }
  return true;
}
