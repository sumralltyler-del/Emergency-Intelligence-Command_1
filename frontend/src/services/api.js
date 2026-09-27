async function request(path, signal) {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || `Request failed (${response.status})`);
  return body;
}

export const api = {
  regions: (signal) => request('/api/regions', signal),
  operatingPicture: (regionId, signal) => request(`/api/operating-picture?region=${encodeURIComponent(regionId)}`, signal)
};

