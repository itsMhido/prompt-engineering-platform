const MODELS_KEY = 'pe_models';
const PROMPTS_KEY = 'pe_prompts';
const EXPERIMENTS_KEY = 'pe_experiments';
const GOOGLE_GENERATE_CONTENT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent';
const GOOGLE_DEFAULT_MODEL_ID = 'gemini-2.5-flash';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


function normalizeModelConfig(model) {
  if (model?.provider !== 'Google') {
    return model;
  }

  const usesGoogleGenerateContentEndpoint = typeof model.endpoint === 'string'
    && model.endpoint.includes('https://generativelanguage.googleapis.com/')
    && model.endpoint.includes(':generateContent');

  if (!usesGoogleGenerateContentEndpoint || model.endpoint.includes('{model}')) {
    return model;
  }

  return {
    ...model,
    endpoint: GOOGLE_GENERATE_CONTENT_ENDPOINT
  };
}

function loadModelsDb() {
  const data = localStorage.getItem(MODELS_KEY);
  if (!data) {
    return initModelsDb();
  }
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return initModelsDb();
    }
    const normalized = parsed.map(normalizeModelConfig);
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      saveModelsDb(normalized);
    }
    return normalized;
  } catch (e) {
    return initModelsDb();
  }
}

function saveModelsDb(data) {
  localStorage.setItem(MODELS_KEY, JSON.stringify(data));
}

function initModelsDb() {
  const initial = [
    {
      id: 'm1',
      name: 'GPT-4 Turbo',
      provider: 'OpenAI',
      modelId: 'gpt-4-turbo',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      stopSequences: [],
      status: 'active'
    },
    {
      id: 'm2',
      name: 'Claude Sonnet',
      provider: 'Anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      endpoint: 'https://api.anthropic.com/v1/messages',
      apiKey: '',
      temperature: 0.5,
      maxTokens: 4096,
      topP: 1.0,
      stopSequences: [],
      status: 'active'
    },
    {
      id: 'm3',
      name: 'Gemini Flash',
      provider: 'Google',
      modelId: GOOGLE_DEFAULT_MODEL_ID,
      endpoint: GOOGLE_GENERATE_CONTENT_ENDPOINT,
      apiKey: '',
      temperature: 0.2,
      maxTokens: 4096,
      topP: 1.0,
      stopSequences: [],
      status: 'active'
    },
    {
      id: 'm4',
      name: 'Mistral Large',
      provider: 'Mistral',
      modelId: 'mistral-large-latest',
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      apiKey: '',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      stopSequences: [],
      status: 'active'
    }
  ];
  saveModelsDb(initial);
  return initial;
}

function loadPromptsDb() {
  const data = localStorage.getItem(PROMPTS_KEY);
  if (data) {
    try { return JSON.parse(data); } catch (e) { return initPromptsDb(); }
  }
  return initPromptsDb();
}

function savePromptsDb(data) {
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(data));
}

function initPromptsDb() {
  const initial = {
    p1: {
      versions: [
        { version: 'v3', label: 'v3', description: 'Added context variable', createdAt: new Date().toISOString(), systemPrompt: "You are an expert medical assistant. Reply in structured json.", userPrompt: "Patient shows symptoms of {symptom_1} and {symptom_2}. Patient age is {age}. Provide a diagnosis." },
        { version: 'v2', label: 'v2', description: 'Tweaked temperature instructions', createdAt: new Date(Date.now() - 3600000).toISOString(), systemPrompt: "You are a medical assistant. Reply in json.", userPrompt: "Patient shows symptoms of {symptom_1}. Provide a diagnosis." },
        { version: 'v1', label: 'v1', description: 'Initial version', createdAt: new Date(Date.now() - 86400000).toISOString(), systemPrompt: "You are a medical bot. Be helpful.", userPrompt: "Patient is sick with {symptom_1}. Help." }
      ]
    }
  };
  savePromptsDb(initial);
  return initial;
}

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " mins ago";
  return "just now";
}

export const savePromptVersion = async (promptData) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const db = loadPromptsDb();
      if (!db[promptData.id]) db[promptData.id] = { versions: [] };
      const versions = db[promptData.id].versions;
      
      const newVersionNum = versions.length > 0 ? parseInt(versions[0].version.replace('v', '')) + 1 : 1;
      const newVersionName = `v${newVersionNum}`;
      
      const newEntry = {
        version: newVersionName,
        label: newVersionName,
        description: promptData.commitMessage || 'Saved draft version',
        createdAt: new Date().toISOString(),
        systemPrompt: promptData.systemPrompt || "",
        userPrompt: promptData.userPrompt || "",
        selectedModelId: promptData.selectedModelId || ""
      };
      
      versions.unshift(newEntry);
      savePromptsDb(db);
      
      resolve(newEntry);
    }, 300);
  });
};

export const loadVersionHistory = async (promptId) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const db = loadPromptsDb();
      const versions = db[promptId]?.versions || [];
      const mapped = versions.map(v => ({
        ...v,
        createdAtDisplay: timeAgo(v.createdAt)
      }));
      resolve(mapped);
    }, 300);
  });
};

// ---- EXPERIMENTS DB ----

function loadExperimentsDb() {
  const data = localStorage.getItem(EXPERIMENTS_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveExperimentsDb(data) {
  try {
    localStorage.setItem(EXPERIMENTS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save experiments:', e);
  }
}

export const saveExperiment = async (experimentData) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const experiments = loadExperimentsDb();
      const experiment = {
        id: generateUUID(),
        ...experimentData,
        timestamp: new Date().toISOString()
      };
      experiments.unshift(experiment);
      saveExperimentsDb(experiments);
      resolve(experiment);
    }, 100);
  });
};

export const loadExperiments = async () => {
  return new Promise(resolve => {
    setTimeout(() => {
      const experiments = loadExperimentsDb();
      resolve(experiments);
    }, 200);
  });
};

export const deleteExperiment = async (experimentId) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const experiments = loadExperimentsDb();
      const filtered = experiments.filter(e => e.id !== experimentId);
      saveExperimentsDb(filtered);
      resolve(true);
    }, 100);
  });
};

export const updateExperimentScore = async (experimentId, score) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const experiments = loadExperimentsDb();
      const idx = experiments.findIndex(e => e.id === experimentId);
      if (idx > -1) {
        experiments[idx].score = Math.max(0, Math.min(100, score));
        saveExperimentsDb(experiments);
        resolve(experiments[idx]);
      } else {
        resolve(null);
      }
    }, 100);
  });
};

export const updateExperimentNotes = async (experimentId, notes) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const experiments = loadExperimentsDb();
      const idx = experiments.findIndex(e => e.id === experimentId);
      if (idx > -1) {
        experiments[idx].notes = notes;
        saveExperimentsDb(experiments);
        resolve(experiments[idx]);
      } else {
        resolve(null);
      }
    }, 100);
  });
};

export const updateExperimentTags = async (experimentId, tags) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const experiments = loadExperimentsDb();
      const idx = experiments.findIndex(e => e.id === experimentId);
      if (idx > -1) {
        experiments[idx].tags = tags;
        saveExperimentsDb(experiments);
        resolve(experiments[idx]);
      } else {
        resolve(null);
      }
    }, 100);
  });
};

export const callModel = async (model, systemPrompt, userMessage) => {
  const startTime = Date.now();

  try {
    let response;
    let body;
    let headers = {};
    let latency;
    let result;

    switch (model.provider.toLowerCase()) {
      case 'anthropic':
        headers = {
          'x-api-key': model.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        };
        body = {
          model: model.modelId,
          max_tokens: model.maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        };
        response = await fetch(model.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        const anthropicData = await response.json();
        latency = Date.now() - startTime;
        result = {
          text: anthropicData.content[0]?.text || '',
          tokens: { input: anthropicData.usage?.input_tokens || 0, output: anthropicData.usage?.output_tokens || 0, total: (anthropicData.usage?.input_tokens || 0) + (anthropicData.usage?.output_tokens || 0) },
          latencyMs: latency,
          latency: `${latency}ms`,
          cost: estimateCost(model.provider, anthropicData.usage?.input_tokens || 0, anthropicData.usage?.output_tokens || 0)
        };
        break;

      case 'openai':
      case 'mistral':
      case 'groq':
        headers = {
          'Authorization': `Bearer ${model.apiKey}`,
          'content-type': 'application/json'
        };
        body = {
          model: model.modelId,
          max_tokens: model.maxTokens,
          temperature: model.temperature,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        };
        response = await fetch(model.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        const openaiData = await response.json();
        latency = Date.now() - startTime;
        result = {
          text: openaiData.choices[0]?.message?.content || '',
          tokens: { input: openaiData.usage?.prompt_tokens || 0, output: openaiData.usage?.completion_tokens || 0, total: openaiData.usage?.total_tokens || 0 },
          latencyMs: latency,
          latency: `${latency}ms`,
          cost: estimateCost(model.provider, openaiData.usage?.prompt_tokens || 0, openaiData.usage?.completion_tokens || 0)
        };
        break;

      case 'google':
        const googleUrl = new URL(model.endpoint.replace('{model}', model.modelId));
        googleUrl.searchParams.set('key', model.apiKey);
        body = {
          contents: [{ parts: [{ text: userMessage }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            maxOutputTokens: model.maxTokens,
            temperature: model.temperature
          }
        };
        response = await fetch(googleUrl.toString(), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        const googleData = await response.json();
        latency = Date.now() - startTime;
        result = {
          text: googleData.candidates[0]?.content?.parts[0]?.text || '',
          tokens: { input: googleData.usageMetadata?.promptTokenCount || 0, output: googleData.usageMetadata?.candidatesTokenCount || 0, total: (googleData.usageMetadata?.promptTokenCount || 0) + (googleData.usageMetadata?.candidatesTokenCount || 0) },
          latencyMs: latency,
          latency: `${latency}ms`,
          cost: estimateCost(model.provider, googleData.usageMetadata?.promptTokenCount || 0, googleData.usageMetadata?.candidatesTokenCount || 0)
        };
        break;

      case 'custom':
        // Attempt OpenAI-compatible
        headers = {
          'Authorization': `Bearer ${model.apiKey}`,
          'content-type': 'application/json'
        };
        body = {
          model: model.modelId,
          max_tokens: model.maxTokens,
          temperature: model.temperature,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        };
        response = await fetch(model.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        const customData = await response.json();
        latency = Date.now() - startTime;
        result = {
          text: customData.choices?.[0]?.message?.content || customData.content?.[0]?.text || '',
          tokens: { input: customData.usage?.prompt_tokens || customData.usage?.input_tokens || 0, output: customData.usage?.completion_tokens || customData.usage?.output_tokens || 0, total: customData.usage?.total_tokens || 0 },
          latencyMs: latency,
          latency: `${latency}ms`,
          cost: '~$0.00'
        };
        break;

      default:
        throw new Error(`Unsupported provider: ${model.provider}`);
    }

    return result;
  } catch (error) {
    throw error;
  }
};

function estimateCost(provider, inputTokens, outputTokens) {
  // Groq is free tier
  if (provider.toLowerCase() === 'groq') {
    return 'Free tier';
  }
  // Approximate rates per 1k tokens
  const rates = {
    openai: { input: 0.0015, output: 0.002 },
    anthropic: { input: 0.003, output: 0.015 },
    google: { input: 0.00025, output: 0.0005 },
    mistral: { input: 0.0002, output: 0.0006 }
  };
  const rate = rates[provider.toLowerCase()] || { input: 0, output: 0 };
  const cost = ((inputTokens / 1000) * rate.input) + ((outputTokens / 1000) * rate.output);
  return `~$${cost.toFixed(4)}`;
}


export const loadModels = async () => {
  return new Promise(resolve => {
    setTimeout(() => {
      const models = loadModelsDb();
      resolve(models);
    }, 300);
  });
};

export const saveModel = async (modelData) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const models = loadModelsDb();
      let savedModel;
      const normalizedModelData = normalizeModelConfig(modelData);
      if (modelData.id) {
        const index = models.findIndex(m => m.id === modelData.id);
        if (index > -1) {
          models[index] = { ...models[index], ...normalizedModelData };
          savedModel = models[index];
        }
      }
      if (!savedModel) {
        savedModel = {
          id: `m${Date.now()}`,
          ...normalizedModelData
        };
        models.push(savedModel);
      }
      saveModelsDb(models);
      resolve(savedModel);
    }, 300);
  });
};

export const deleteModel = async (modelId) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const models = loadModelsDb();
      const filtered = models.filter(m => m.id !== modelId);
      saveModelsDb(filtered);
      resolve(true);
    }, 300);
  });
};

export const validateModel = async (name, apiKey) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!apiKey || apiKey.length < 5) {
        resolve({ valid: false, error: "Invalid API Key length/format." });
      } else if (!name || name.trim().length < 3) {
        resolve({ valid: false, error: "Model name is required." });
      } else {
        resolve({ valid: true });
      }
    }, 800);
  });
};
