// Thin wrapper around the AI Capsule API.
//
// credentials: 'include' sends the httpOnly session cookie. In production the
// frontend and API share an origin, so this is same-origin and no CORS
// configuration is involved.

const BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message = data && data.error ? data.error : `Request failed (HTTP ${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export const getMe = () => request('/me');
export const listCapsules = () => request('/capsules');
export const createCapsule = (payload) =>
  request('/capsules', { method: 'POST', body: JSON.stringify(payload) });
export const updateCapsule = (id, payload) =>
  request(`/capsules/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteCapsule = (id) => request(`/capsules/${id}`, { method: 'DELETE' });
