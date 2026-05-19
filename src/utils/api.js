const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://prompt-engineering-platform-production.up.railway.app').replace(/\/$/, '');
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL || 'codex-demo@prompt-platform.com';
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'PromptPlatformDemo123!';
const DEMO_NAME = import.meta.env.VITE_DEMO_NAME || 'Alex Developer';

let sessionState = {
  token: null,
  user: null,
  workspace: null
};

let bootstrapPromise = null;
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
  const data = text ? JSON.parse(text) : null;

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
    skipAuth = false,
    retryOnAuthFailure = true
  } = options;

  if (!skipAuth) {
    await ensureSession();
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(sessionState.token && !skipAuth ? { Authorization: `Bearer ${sessionState.token}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (response.status === 401 && !skipAuth && retryOnAuthFailure) {
    resetSession();
    await ensureSession();
    return fetchJson(path, { ...options, retryOnAuthFailure: false });
  }

  return parseResponse(response);
}

function setSessionFromAuthResponse(authResponse) {
  sessionState = {
    token: authResponse.token,
    user: authResponse.user,
    workspace: authResponse.workspace
  };
  emitSession();
  return getSessionSnapshot();
}

function resetSession() {
  sessionState = {
    token: null,
    user: null,
    workspace: null
  };
  emitSession();
}

async function loginDemoUser() {
  return fetchJson('/api/auth/login', {
    method: 'POST',
    body: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD
    },
    skipAuth: true
  });
}

async function registerDemoUser() {
  return fetchJson('/api/auth/register', {
    method: 'POST',
    body: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      name: DEMO_NAME
    },
    skipAuth: true
  });
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
    token: sessionState.token,
    user: sessionState.user,
    workspace: sessionState.workspace
  };
}

export async function ensureSession() {
  if (sessionState.token) {
    return getSessionSnapshot();
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        const auth = await loginDemoUser();
        return setSessionFromAuthResponse(auth);
      } catch (error) {
        if (error.status && error.status !== 401) {
          throw error;
        }

        const auth = await registerDemoUser();
        return setSessionFromAuthResponse(auth);
      }
    })()
      .finally(() => {
        bootstrapPromise = null;
      });
  }

  return bootstrapPromise;
}

export async function bootstrapApp() {
  return ensureSession();
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
