const WORKER = 'http://127.0.0.1:8765';

export async function analyzeClip(file, sourceKind, signal) {
  const form = new FormData();
  form.append('file', file, file.name || 'recording');
  form.append('source_kind', sourceKind);
  let response;
  try {
    response = await fetch(WORKER + '/v1/audio/analyze', {
      method: 'POST',
      headers: { 'X-Offbeat-Client': 'local-ui' },
      body: form,
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('The local Python listening engine is not running. Start it with the commands in README.md.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The listening engine returned an unreadable response.'); }
  if (!response.ok) throw new Error(data.error?.message || 'Audio analysis failed.');
  if (data.schema_version !== 'offbeat.phrase.v1') throw new Error('Unsupported analysis schema version.');
  return data;
}
