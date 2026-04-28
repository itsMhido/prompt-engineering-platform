import { readLocalStorageJSON, writeLocalStorageJSON } from './helpers';

const PROMPTS_KEY = 'pe_prompts';
const VERSIONS_KEY = 'pe_versions';
const DRAFTS_KEY = 'pe_drafts';
const EXPERIMENTS_KEY = 'pe_experiments';
const LEGACY_DRAFT_KEY = 'pe_draft';

function nowIso() {
  return new Date().toISOString();
}

function safeArray(key) {
  const data = readLocalStorageJSON(key, []);
  return Array.isArray(data) ? data : [];
}

export function getPrompts() {
  return safeArray(PROMPTS_KEY);
}

export function getVersions() {
  return safeArray(VERSIONS_KEY);
}

export function getDrafts() {
  const drafts = readLocalStorageJSON(DRAFTS_KEY, {});
  return drafts && typeof drafts === 'object' && !Array.isArray(drafts) ? drafts : {};
}

export function getExperiments() {
  return safeArray(EXPERIMENTS_KEY);
}

export function savePrompts(prompts) {
  writeLocalStorageJSON(PROMPTS_KEY, Array.isArray(prompts) ? prompts : []);
}

export function saveVersions(versions) {
  writeLocalStorageJSON(VERSIONS_KEY, Array.isArray(versions) ? versions : []);
}

export function saveDrafts(drafts) {
  writeLocalStorageJSON(DRAFTS_KEY, drafts && typeof drafts === 'object' ? drafts : {});
}

export function saveExperiments(experiments) {
  writeLocalStorageJSON(EXPERIMENTS_KEY, Array.isArray(experiments) ? experiments : []);
}

export function getVersionsForPrompt(promptId) {
  return getVersions()
    .filter(v => v.promptId === promptId)
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
}

export function getNextVersionNumber(promptId) {
  const versions = getVersionsForPrompt(promptId);
  if (versions.length === 0) return 1;
  return Math.max(...versions.map(v => Number(v.version || 0))) + 1;
}

export function createPrompt({ name, description = '', tags = [], createdBy = 'Alex Developer' }) {
  const prompt = {
    id: crypto.randomUUID(),
    name: name?.trim() || 'Untitled Prompt',
    description: description?.trim() || '',
    tags: Array.isArray(tags) ? tags : [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy
  };

  const prompts = getPrompts();
  savePrompts([...prompts, prompt]);

  const versions = getVersions();
  versions.push({
    id: crypto.randomUUID(),
    promptId: prompt.id,
    version: 1,
    systemPrompt: '',
    userTemplate: '',
    commitMessage: 'Initial version',
    createdAt: nowIso()
  });
  saveVersions(versions);

  return prompt;
}

export function duplicatePrompt(promptId) {
  const prompts = getPrompts();
  const source = prompts.find(p => p.id === promptId);
  if (!source) return null;

  const duplicate = {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name} Copy`,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const allVersions = getVersions();
  const sourceVersions = allVersions
    .filter(v => v.promptId === promptId)
    .sort((a, b) => Number(a.version || 0) - Number(b.version || 0));

  const duplicatedVersions = sourceVersions.map(v => ({
    ...v,
    id: crypto.randomUUID(),
    promptId: duplicate.id
  }));

  savePrompts([...prompts, duplicate]);
  saveVersions([...allVersions, ...duplicatedVersions]);

  const drafts = getDrafts();
  if (drafts[promptId]) {
    drafts[duplicate.id] = { ...drafts[promptId], savedAt: nowIso() };
    saveDrafts(drafts);
  }

  return duplicate;
}

export function deletePrompt(promptId) {
  const prompts = getPrompts().filter(p => p.id !== promptId);
  const versions = getVersions().filter(v => v.promptId !== promptId);
  const experiments = getExperiments().filter(e => e.promptId !== promptId);
  const drafts = getDrafts();
  delete drafts[promptId];

  savePrompts(prompts);
  saveVersions(versions);
  saveExperiments(experiments);
  saveDrafts(drafts);
}

export function seedPromptsIfEmpty() {
  const prompts = getPrompts();
  if (prompts.length > 0) return;

  const medical = {
    id: crypto.randomUUID(),
    name: 'Medical Assistant',
    description: 'Diagnoses patient conditions based on reported symptoms',
    tags: ['medical', 'qa'],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: 'Alex Developer'
  };

  const finance = {
    id: crypto.randomUUID(),
    name: 'Finance Analyzer',
    description: 'Analyzes financial metrics and provides insights',
    tags: ['finance', 'analysis'],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: 'Alex Developer'
  };

  const existingVersions = getVersions();
  const migratedToMedical = existingVersions.map(v => ({
    ...v,
    promptId: medical.id,
    version: Number(v.version || 1),
    userTemplate: v.userTemplate || v.userPrompt || '',
    createdAt: v.createdAt || nowIso()
  }));

  const financeSeedVersion = {
    id: crypto.randomUUID(),
    promptId: finance.id,
    version: 1,
    systemPrompt: 'You are a financial analyst assistant.',
    userTemplate: 'Analyze {metric} for {company} in {period}.',
    commitMessage: 'Initial version',
    createdAt: nowIso()
  };

  savePrompts([medical, finance]);
  saveVersions([...migratedToMedical, financeSeedVersion]);
}

export function migrateIfNeeded() {
  const promptsExist = localStorage.getItem(PROMPTS_KEY);
  if (promptsExist) return;

  const existingVersionsRaw = readLocalStorageJSON(VERSIONS_KEY, []);
  const existingVersions = Array.isArray(existingVersionsRaw) ? existingVersionsRaw : [];
  if (existingVersions.length === 0) return;

  const defaultPrompt = {
    id: crypto.randomUUID(),
    name: 'Medical Assistant',
    description: 'Migrated from previous session',
    tags: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: 'Alex Developer'
  };

  const migratedVersions = existingVersions.map(v => ({
    ...v,
    promptId: defaultPrompt.id,
    version: Number(v.version || String(v.version || '').replace('v', '') || 1),
    userTemplate: v.userTemplate || v.userPrompt || ''
  }));

  const existingDraft = readLocalStorageJSON(LEGACY_DRAFT_KEY, null);
  const migratedDrafts = existingDraft && typeof existingDraft === 'object' && !Array.isArray(existingDraft)
    ? { [defaultPrompt.id]: existingDraft }
    : {};

  const existingExperimentsRaw = readLocalStorageJSON(EXPERIMENTS_KEY, []);
  const existingExperiments = Array.isArray(existingExperimentsRaw) ? existingExperimentsRaw : [];
  const migratedExperiments = existingExperiments.map(e => ({
    ...e,
    promptId: defaultPrompt.id,
    promptName: defaultPrompt.name
  }));

  savePrompts([defaultPrompt]);
  saveVersions(migratedVersions);
  saveDrafts(migratedDrafts);
  saveExperiments(migratedExperiments);
  localStorage.removeItem(LEGACY_DRAFT_KEY);
}
