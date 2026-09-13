const API_BASE = '/api';

export function getDeviceId() {
  let deviceId = localStorage.getItem('device_fingerprint');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('device_fingerprint', deviceId);
  }
  return deviceId;
}

export function getAuthToken() {
  return localStorage.getItem('auth_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

// Safely handles responses so non-JSON or empty bodies never crash the parser
async function safeParseJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return { message: text || `Server error (${res.status})` };
  }
}

export async function fetchCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Device-Fingerprint': getDeviceId(),
      },
    });
    if (!res.ok) {
      setAuthToken(null);
      return null;
    }
    return await safeParseJson(res);
  } catch (err) {
    return null;
  }
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': getDeviceId(),
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await safeParseJson(res);
  if (!res.ok) throw new Error(data.message || 'Login failed');
  setAuthToken(data.token);
  return data;
}

export async function signup(email, password) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': getDeviceId(),
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await safeParseJson(res);
  if (!res.ok) throw new Error(data.message || 'Signup failed');
  setAuthToken(data.token);
  return data;
}

export async function loginWithGithub(code) {
  const res = await fetch(`${API_BASE}/auth/github`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': getDeviceId(),
    },
    body: JSON.stringify({ code }),
  });
  const data = await safeParseJson(res);
  if (!res.ok) throw new Error(data.message || 'GitHub login failed');
  setAuthToken(data.token);
  return data;
}

export async function loginWithGoogle(credential) {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': getDeviceId(),
    },
    body: JSON.stringify({ credential }),
  });
  const data = await safeParseJson(res);
  if (!res.ok) throw new Error(data.message || 'Google login failed');
  setAuthToken(data.token);
  return data;
}

export async function analyzeResume(file, jobDescription) {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('resume', file);
  formData.append('jobDescription', jobDescription);

  const headers = {
    'X-Device-Fingerprint': getDeviceId(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await safeParseJson(res);
  if (!res.ok) {
    throw new Error(data.message || 'Analysis failed. Please check file format and try again.');
  }
  return data;
}