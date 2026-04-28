import { callModel as mockApiCallModel } from './mockApi';

function maybeDecodeApiKey(value) {
  if (!value || typeof value !== 'string') return '';
  return value;
}

function normalizeModel(model) {
  if (!model || typeof model !== 'object') {
    throw new Error('Invalid model configuration');
  }

  const resolvedApiKey = maybeDecodeApiKey(
    model.apiKey ||
    model.encryptedApiKey ||
    model.apiKeyEncrypted ||
    ''
  );

  return {
    ...model,
    apiKey: resolvedApiKey
  };
}

function normalizeResult(result) {
  const output = result?.output ?? result?.text ?? '';
  const latency = Number(result?.latencyMs ?? result?.latency ?? 0);
  const inputTokens = Number(result?.inputTokens ?? result?.tokens?.input ?? 0);
  const outputTokens = Number(result?.outputTokens ?? result?.tokens?.output ?? 0);
  const totalTokens = Number(result?.totalTokens ?? result?.tokens?.total ?? (inputTokens + outputTokens));

  let costEstimate = result?.costEstimate ?? result?.cost ?? 0;
  if (typeof costEstimate === 'string') {
    if (costEstimate.toLowerCase() === 'free tier') {
      costEstimate = 0;
    } else {
      const parsed = parseFloat(costEstimate.replace(/[^\d.]/g, ''));
      costEstimate = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  return {
    output,
    latency,
    inputTokens,
    outputTokens,
    totalTokens,
    costEstimate
  };
}

// Accepts: (modelObject, systemPrompt, userMessage)
// Returns: { output, latency, inputTokens, outputTokens, totalTokens, costEstimate }
export async function callModel(model, systemPrompt, userMessage) {
  const normalizedModel = normalizeModel(model);
  const result = await mockApiCallModel(normalizedModel, systemPrompt, userMessage);
  return normalizeResult(result);
}
