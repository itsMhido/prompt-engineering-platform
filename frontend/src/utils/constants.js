export const PROVIDER_DEFAULTS = {
  OpenAI: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelId: 'gpt-4-turbo'
  },
  Anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelId: 'claude-3-5-sonnet-20241022'
  },
  Google: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    modelId: 'gemini-2.5-flash'
  },
  Mistral: {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    modelId: 'mistral-large-latest'
  },
  Groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelId: 'llama-3.1-8b-instant'
  },
  HuggingFace: {
    endpoint: 'https://router.huggingface.co/hf-inference/v1/chat/completions',
    modelId: 'meta-llama/Llama-3.1-8B-Instruct'
  },
  Custom: {
    endpoint: '',
    modelId: ''
  }
};

export const MOCK_MODELS = [
  { id: 'm1', name: 'gpt-4-turbo', provider: 'OpenAI', version: 'v1.0.2', temp: 0.7, tokens: 4096 },
  { id: 'm2', name: 'claude-3-opus', provider: 'Anthropic', version: 'v1.2.0', temp: 0.5, tokens: 8192 },
  { id: 'm3', name: 'gemini-2.5-flash', provider: 'Google', version: 'v2.5.0', temp: 0.2, tokens: 1048576 },
];

export const MOCK_EXPERIMENTS = [
  { id: 'e1', promptVersion: 'v3', model: 'gpt-4-turbo', dataset: 'Medical Q&A', latency: '420ms', cost: '$0.002', score: 92, date: '2 mins ago' },
  { id: 'e2', promptVersion: 'v2', model: 'claude-3-opus', dataset: 'Medical Q&A', latency: '850ms', cost: '$0.005', score: 88, date: '1 hour ago' },
  { id: 'e3', promptVersion: 'v1', model: 'gpt-4-turbo', dataset: 'Finance Eval', latency: '380ms', cost: '$0.001', score: 75, date: '2 days ago' },
];
