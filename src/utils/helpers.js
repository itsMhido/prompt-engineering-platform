import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PROMPT_DRAFT_KEY } from './constants';

// Util for tailwind classes
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function readLocalStorageJSON(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    const parsed = JSON.parse(data);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalStorageJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadPromptDraft() {
  const draft = readLocalStorageJSON(PROMPT_DRAFT_KEY, null);
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return null;
  }

  return {
    systemPrompt: typeof draft.systemPrompt === 'string' ? draft.systemPrompt : '',
    userPrompt: typeof draft.userPrompt === 'string' ? draft.userPrompt : '',
    variables: draft.variables && typeof draft.variables === 'object' && !Array.isArray(draft.variables) ? draft.variables : {},
    selectedModelId: typeof draft.selectedModelId === 'string' ? draft.selectedModelId : '',
    activeVersion: typeof draft.activeVersion === 'string' ? draft.activeVersion : '',
    savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : null
  };
}

export function getVariableNames(prompt) {
  if (!prompt) return [];
  return Array.from(new Set(
    Array.from(prompt.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)).map(match => match[1])
  ));
}

export function syncVariablesWithPrompt(prompt, previousVariables = {}) {
  return getVariableNames(prompt).reduce((acc, variableName) => {
    acc[variableName] = previousVariables[variableName] || "";
    return acc;
  }, {});
}

export function timeAgo(dateString) {
  if (!dateString) return '';
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)} years ago`;
  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)} months ago`;
  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)} days ago`;
  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)} hours ago`;
  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)} min ago`;
  return 'just now';
}

export function getComparableVersionState(source, fallbackSelectedModelId = '') {
  const hasSelectedModelId = source && Object.prototype.hasOwnProperty.call(source, 'selectedModelId');
  return JSON.stringify({
    systemPrompt: source?.systemPrompt || '',
    userPrompt: source?.userPrompt || '',
    selectedModelId: hasSelectedModelId ? (source.selectedModelId || '') : fallbackSelectedModelId
  });
}
