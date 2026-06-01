import { clearAuth, getToken, getUser, getWorkspace, setAuth } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://prompt-engineering-platform-production.up.railway.app').replace(/\/$/, '');

const sessionListeners = new Set();

function emitSession() {
  const snapshot = getSessionSnapshot();
  sessionListeners.forEach((listener) => listener(snapshot));
}

function buildUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url;
}

async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = typeof data?.detail === 'string'
      ? data.detail
      : data?.detail?.message || data?.message || `Request failed with ${response.status}`;
    const error = new Error(detail);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function fetchJson(path, options = {}) {
  const {
    method = 'GET',
    body,
    query,
    headers,
    skipAuth = false
  } = options;

  const token = getToken();

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(!skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (response.status === 401 && !skipAuth) {
    clearSession();
    window.location.href = '/';
    throw new Error('Session expired. Please log in again.');
  }

  return parseResponse(response);
}

function setSessionFromAuthResponse(authResponse) {
  setAuth(authResponse.token, authResponse.user, authResponse.workspace);
  emitSession();
  return getSessionSnapshot();
}

function setSessionFromMeResponse(meResponse) {
  const token = getToken();
  setAuth(token, meResponse.user, meResponse.workspace);
  emitSession();
  return getSessionSnapshot();
}

export function clearSession() {
  clearAuth();
  emitSession();
}

export async function login({ email, password }) {
  return fetchJson('/api/auth/login', {
    method: 'POST',
    body: {
      email,
      password
    },
    skipAuth: true
  }).then(setSessionFromAuthResponse);
}

export async function register({ name, email, password }) {
  return fetchJson('/api/auth/register', {
    method: 'POST',
    body: {
      name,
      email,
      password
    },
    skipAuth: true
  }).then(setSessionFromAuthResponse);
}

function normalizeVersion(version) {
  return {
    ...version,
    version: version.versionNumber,
    label: version.versionDisplay
  };
}

function normalizeDataset(dataset) {
  return {
    ...dataset,
    rows: Array.isArray(dataset.rows) ? dataset.rows : [],
    rowCount: typeof dataset.rowCount === 'number'
      ? dataset.rowCount
      : Array.isArray(dataset.rows) ? dataset.rows.length : 0
  };
}

function normalizeExperiment(experiment) {
  return {
    ...experiment,
    model: experiment.modelName,
    version: experiment.promptVersion,
    timestamp: experiment.createdAt
  };
}

export function subscribeToSession(listener) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function getSessionSnapshot() {
  return {
    token: getToken(),
    user: getUser(),
    workspace: getWorkspace()
  };
}

export async function ensureSession() {
  return getSessionSnapshot();
}

export async function bootstrapApp() {
  const me = await fetchJson('/api/auth/me');
  return setSessionFromMeResponse(me);
}

export async function updateCurrentUser(payload) {
  const data = await fetchJson('/api/auth/me', {
    method: 'PATCH',
    body: payload
  });

  setSessionFromMeResponse({
    user: data.user,
    workspace: getWorkspace()
  });

  return data.user;
}

export async function updateWorkspace(workspaceId, payload) {
  const data = await fetchJson(`/api/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: payload
  });

  setSessionFromMeResponse({
    user: getUser(),
    workspace: data.workspace
  });

  return data.workspace;
}

export async function listModels() {
  const data = await fetchJson('/api/models');
  return data.models || [];
}

export async function createModel(model) {
  const data = await fetchJson('/api/models', {
    method: 'POST',
    body: model
  });
  return data.model;
}

export async function updateModel(modelId, model) {
  const data = await fetchJson(`/api/models/${modelId}`, {
    method: 'PATCH',
    body: model
  });
  return data.model;
}

export async function removeModel(modelId) {
  await fetchJson(`/api/models/${modelId}`, {
    method: 'DELETE'
  });
  return true;
}

export async function validateModel(payload) {
  return fetchJson('/api/models/validate', {
    method: 'POST',
    body: payload
  });
}

export async function listPrompts(params) {
  const data = await fetchJson('/api/prompts', { query: params });
  return data.prompts || [];
}

export async function createPrompt(payload) {
  const data = await fetchJson('/api/prompts', {
    method: 'POST',
    body: payload
  });

  return {
    prompt: data.prompt,
    initialVersion: normalizeVersion(data.initialVersion)
  };
}

export async function updatePrompt(promptId, payload) {
  const data = await fetchJson(`/api/prompts/${promptId}`, {
    method: 'PATCH',
    body: payload
  });
  return data.prompt;
}

export async function duplicatePrompt(promptId) {
  const data = await fetchJson(`/api/prompts/${promptId}/duplicate`, {
    method: 'POST'
  });

  return {
    prompt: data.prompt,
    versions: (data.versions || []).map(normalizeVersion)
  };
}

export async function removePrompt(promptId) {
  await fetchJson(`/api/prompts/${promptId}`, {
    method: 'DELETE'
  });
  return true;
}

export async function listPromptVersions(promptId, sort = 'version_desc') {
  const data = await fetchJson(`/api/prompts/${promptId}/versions`, {
    query: { sort }
  });
  return (data.versions || []).map(normalizeVersion);
}

export async function createPromptVersion(promptId, payload) {
  const data = await fetchJson(`/api/prompts/${promptId}/versions`, {
    method: 'POST',
    body: payload
  });
  return normalizeVersion(data.version);
}

export async function updatePromptVersion(promptId, versionId, payload) {
  const data = await fetchJson(`/api/prompts/${promptId}/versions/${versionId}`, {
    method: 'PATCH',
    body: payload
  });
  return normalizeVersion(data.version);
}

export async function listDatasets(params) {
  const data = await fetchJson('/api/datasets', { query: params });
  return (data.datasets || []).map(normalizeDataset);
}

export async function getDataset(datasetId) {
  const data = await fetchJson(`/api/datasets/${datasetId}`);
  return normalizeDataset(data.dataset);
}

export async function createDataset(payload) {
  const data = await fetchJson('/api/datasets', {
    method: 'POST',
    body: payload
  });
  return normalizeDataset(data.dataset);
}

export async function importDataset(payload) {
  const data = await fetchJson('/api/datasets/import', {
    method: 'POST',
    body: payload
  });
  return normalizeDataset(data.dataset);
}

export async function updateDataset(datasetId, payload) {
  const data = await fetchJson(`/api/datasets/${datasetId}`, {
    method: 'PUT',
    body: payload
  });
  return normalizeDataset(data.dataset);
}

export async function removeDataset(datasetId) {
  await fetchJson(`/api/datasets/${datasetId}`, {
    method: 'DELETE'
  });
  return true;
}

export async function listExperiments(params) {
  const data = await fetchJson('/api/experiments', { query: params });
  return (data.experiments || []).map(normalizeExperiment);
}

export async function updateExperiment(experimentId, payload) {
  const data = await fetchJson(`/api/experiments/${experimentId}`, {
    method: 'PATCH',
    body: payload
  });
  return normalizeExperiment(data.experiment);
}

export async function removeExperiment(experimentId) {
  await fetchJson(`/api/experiments/${experimentId}`, {
    method: 'DELETE'
  });
  return true;
}

export async function bulkDeleteExperiments(ids) {
  return fetchJson('/api/experiments/bulk-delete', {
    method: 'POST',
    body: { ids }
  });
}

export async function runPrompt(payload) {
  const data = await fetchJson('/api/inference/run', {
    method: 'POST',
    body: payload
  });

  return {
    ...data,
    experiment: data.experiment ? normalizeExperiment(data.experiment) : null
  };
}

export async function runBatchEvaluation(payload) {
  const data = await fetchJson('/api/evaluations/batch-run', {
    method: 'POST',
    body: payload
  });

  return {
    ...data,
    experiments: (data.experiments || []).map(normalizeExperiment)
  };
}

export async function scoreEvaluation(payload) {
  const data = await fetchJson('/api/evaluations/score', {
    method: 'POST',
    body: payload
  });

  return {
    ...data,
    updatedExperiment: data.updatedExperiment ? normalizeExperiment(data.updatedExperiment) : null
  };
}

export async function listBatches() {
  const data = await fetchJson('/api/experiments/batches');
  return data.batches || [];
}
