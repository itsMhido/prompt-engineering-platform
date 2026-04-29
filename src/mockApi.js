import { supabase } from "./supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const TOKEN_KEY = "pep_auth_token";
const ACTIVE_PROMPT_ID_KEY = "pep_active_prompt_id";
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo12345";
const DEMO_NAME = "Demo User";

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        message = Array.isArray(payload.detail)
          ? payload.detail.map((item) => item.msg || item.type).join(", ")
          : payload.detail;
      }
    } catch {
      // Keep generic message when response body is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function ensureAuthenticated() {
  const { data: existingSession } = await supabase.auth.getSession();
  const sessionToken = existingSession.session?.access_token;
  if (sessionToken) {
    localStorage.setItem(TOKEN_KEY, sessionToken);
    return sessionToken;
  }

  const signIn = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (signIn.error) {
    const signUp = await supabase.auth.signUp({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      options: {
        data: {
          full_name: DEMO_NAME,
        },
      },
    });
    if (signUp.error) {
      throw new Error(signUp.error.message);
    }

    const retrySignIn = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    if (retrySignIn.error) {
      throw new Error(retrySignIn.error.message);
    }

    const retryToken = retrySignIn.data.session?.access_token;
    if (!retryToken) {
      throw new Error("Supabase login did not return an access token");
    }
    localStorage.setItem(TOKEN_KEY, retryToken);
    return retryToken;
  }

  const token = signIn.data.session?.access_token;
  if (!token) {
    throw new Error("Supabase login did not return an access token");
  }
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export const savePromptVersion = async (promptData) => {
  await ensureAuthenticated();

  const persistedPromptId = localStorage.getItem(ACTIVE_PROMPT_ID_KEY);
  const promptId = promptData.id || persistedPromptId;
  const variablesSchema = Object.keys(promptData.variables || {}).reduce((acc, key) => {
    acc[key] = "string";
    return acc;
  }, {});

  if (!promptId) {
    const createdPrompt = await apiRequest("/prompts", {
      method: "POST",
      body: JSON.stringify({
        title: promptData.title || "Prompt Studio Prompt",
        description: promptData.description || "Created from Prompt Studio",
        model_name: promptData.modelName || "gpt-4-turbo",
        temperature: promptData.temperature ?? 0.7,
        tags: promptData.tags || ["prompt-studio"],
        metadata: {
          source: "frontend",
        },
        initial_version: {
          system_prompt: promptData.systemPrompt || "",
          user_prompt_template: promptData.userPromptTemplate || "",
          notes: promptData.notes || "Initial version",
          variables_schema: variablesSchema,
        },
      }),
    });

    localStorage.setItem(ACTIVE_PROMPT_ID_KEY, createdPrompt.id);
    return {
      id: createdPrompt.id,
      version: `v${createdPrompt.current_version}`,
      savedAt: new Date().toISOString(),
      status: "saved",
    };
  }

  const createdVersion = await apiRequest(`/prompts/${promptId}/versions`, {
    method: "POST",
    body: JSON.stringify({
      system_prompt: promptData.systemPrompt || "",
      user_prompt_template: promptData.userPromptTemplate || "",
      notes: promptData.notes || "Updated via Prompt Studio",
      variables_schema: variablesSchema,
    }),
  });

  localStorage.setItem(ACTIVE_PROMPT_ID_KEY, promptId);
  return {
    id: promptId,
    version: `v${createdVersion.version_number}`,
    savedAt: new Date().toISOString(),
    status: "saved",
  };
};

export const loadVersionHistory = async () => {
  await ensureAuthenticated();
  const prompts = await apiRequest("/prompts");
  if (!prompts.length) {
    return [];
  }

  const persistedPromptId = localStorage.getItem(ACTIVE_PROMPT_ID_KEY);
  const activePrompt = prompts.find((prompt) => prompt.id === persistedPromptId) || prompts[0];
  localStorage.setItem(ACTIVE_PROMPT_ID_KEY, activePrompt.id);

  const promptDetail = await apiRequest(`/prompts/${activePrompt.id}`);
  return promptDetail.versions.map((version) => ({
    version: `v${version.version_number}`,
    label: `v${version.version_number}`,
    description: version.notes || "Prompt version",
    createdAt: new Date(version.created_at).toLocaleString(),
    author: "Workspace User",
  }));
};

export const runPromptTest = async (promptVersion, variables, model) => {
  return new Promise(resolve => {
    const latency = Math.floor(Math.random() * (1200 - 300 + 1)) + 300;
    const variableCount = Object.keys(variables || {}).length;
    setTimeout(() => {
      resolve({
        output: `{\n  "model": "${model}",\n  "promptVersion": "${promptVersion}",\n  "variablesReceived": ${variableCount},\n  "diagnosis": "Common Cold",\n  "confidence": 0.85,\n  "recommended_action": "Rest and hydration"\n}`,
        latency: `${latency}ms`,
        tokensUsed: { prompt: 120, completion: 36, total: 156 },
        costEstimate: "$0.0014",
        status: "success"
      });
    }, latency);
  });
};
