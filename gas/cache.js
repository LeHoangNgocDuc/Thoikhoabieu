// Read-only last-known-good snapshot. NEVER store passwords, API tokens or sessions.
export const SNAPSHOT_KEY = 'smart-tkb-live-snapshot-v164';
export const SNAPSHOT_VERSION = 1;
const KEYS = ['classes','versions','slots','ppct','baselines','changes','ppct_overrides','extra_patterns','extra_sessions'];
export function createSnapshot(data, savedAt = new Date().toISOString()) {
  if (!data || !Array.isArray(data.classes) || !Array.isArray(data.slots) || !Array.isArray(data.extra_patterns)) throw Error('Không phải dữ liệu Google Sheets hợp lệ');
  return {schema:SNAPSHOT_VERSION, source:'verified-google-sheets', savedAt,
    data:Object.fromEntries(KEYS.map(k=>[k, Array.isArray(data[k]) ? data[k] : []]))};
}
export function validateSnapshot(raw) {
  try {
    const x=typeof raw==='string'?JSON.parse(raw):raw;
    if(x?.schema!==SNAPSHOT_VERSION||x?.source!=='verified-google-sheets'||!Number.isFinite(Date.parse(x.savedAt))) return null;
    if(!x.data||!KEYS.every(k=>Array.isArray(x.data[k]))) return null;
    return x;
  } catch { return null; }
}
export function snapshotText(data, now){return JSON.stringify(createSnapshot(data, now));}
