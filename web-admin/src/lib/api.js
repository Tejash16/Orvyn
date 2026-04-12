const API_BASE = '/api/v1';

function getToken() {
  return localStorage.getItem('admin_token');
}

export function setToken(token) {
  localStorage.setItem('admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('admin_token');
}

export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export async function adminFetch(path, options = {}) {
  const token = getToken();
  const url = `${API_BASE}/admin${path}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  // Handle CSV/blob downloads
  if (options.responseType === 'blob') {
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    return res.blob();
  }

  const data = await res.json().catch(() => null);

  if (res.status === 401) {
    clearToken();
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export async function adminLogin(email, password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || 'Login failed');
  }

  setToken(data.token);
  return data;
}
