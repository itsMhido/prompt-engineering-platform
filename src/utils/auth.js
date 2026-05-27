const TOKEN_KEY = 'pe_auth_token';
const USER_KEY = 'pe_auth_user';
const WORKSPACE_KEY = 'pe_auth_workspace';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getUser = () => {
  try {
    const value = localStorage.getItem(USER_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const getWorkspace = () => {
  try {
    const value = localStorage.getItem(WORKSPACE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const setAuth = (token, user, workspace) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  } catch (error) {
    console.error('Failed to save auth:', error);
  }
};

export const clearAuth = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
  } catch (error) {
    console.error('Failed to clear auth:', error);
  }
};

export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;

  try {
    // Decode JWT payload only to check client-side expiry.
    const payloadPart = token.split('.')[1];
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    const payload = JSON.parse(atob(padded));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
};
