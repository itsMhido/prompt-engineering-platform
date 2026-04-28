# Prompt Engineering Platform — Backend API Specification

> Generated from frontend codebase analysis + architectural decisions.  
> This document is the single source of truth for backend implementation.  
> Last updated: April 2026

---

## Table of Contents

1. [Architectural Decisions](#1-architectural-decisions)
2. [Canonical Field Names](#2-canonical-field-names)
3. [Database Schema](#3-database-schema)
4. [API Endpoints](#4-api-endpoints)
5. [Provider Contracts](#5-provider-contracts)
6. [Field Mismatch Reference](#6-field-mismatch-reference)
7. [Build Order](#7-build-order)

---

## 1. Architectural Decisions

### Stack
| Layer | Technology |
|---|---|
| Backend | Python FastAPI |
| Database | Supabase (hosted Postgres) |
| Containerization | Docker (backend only) |
| Auth | JWT via `python-jose` + `passlib[bcrypt]` |
| API Key Encryption | Fernet symmetric encryption (`cryptography` library) |

### What lives where
- **Backend** — Dockerized, runs on port `8000`
- **Database** — Supabase cloud free tier (no local Docker needed)
- **Frontend** — Runs normally with `npm run dev` during development

### Drafts — kept in frontend only
Draft state (`pe_drafts`) is ephemeral per-user working state. It stays in `localStorage` on the frontend only. **Do not implement draft API endpoints** — the added complexity is not worth it at this stage. Add later if multi-device sync is needed.

### API Key Security
- Frontend sends the plaintext API key once (on model creation/update)
- Backend encrypts it immediately using **Fernet** before storing
- Fernet secret key lives in `.env` as `ENCRYPTION_KEY`, never committed to git
- Backend decrypts the key only at request time when calling a provider
- API key is **never returned** to the frontend after initial save — responses return `"apiKey": "••••••••"` or omit it entirely

### costEstimate — normalized to float
- Database stores `cost_estimate` as `FLOAT`
- Backend always returns it as a number (e.g. `0.004`)
- Frontend is responsible for display formatting (`~$0.004`, `Free tier`, etc.)
- Never store `"Free tier"` or formatted strings in the database

---

## 2. Canonical Field Names

These are the **resolved** names. Use these everywhere — backend models, schemas, API responses, and frontend migration.

| Concept | Canonical Name | Deprecated / Drop |
|---|---|---|
| Prompt template | `user_template` | `user_prompt`, `userPrompt` |
| Version number | `version_number` (int in DB) | `"v3"` string in DB |
| Version display | derive as `f"v{version_number}"` in response | — |
| Cost | `cost_estimate` (float) | `"~$0.004"` string, `"Free tier"` |
| Prompt version ref in experiment | `prompt_version` | duplicate `version` field |
| Model identifier | `model_id` | — |
| Model display name | `name` | — |
| Encrypted key | `api_key_encrypted` | `encryptedApiKey`, `apiKeyEncrypted` |

### camelCase ↔ snake_case mapping (frontend → backend)
| Frontend (camelCase) | Backend (snake_case) |
|---|---|
| `promptId` | `prompt_id` |
| `modelId` | `model_id` |
| `datasetId` | `dataset_id` |
| `versionNumber` | `version_number` |
| `systemPrompt` | `system_prompt` |
| `userTemplate` | `user_template` |
| `commitMessage` | `commit_message` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `maxTokens` | `max_tokens` |
| `stopSequences` | `stop_sequences` |
| `topP` | `top_p` |
| `latencyMs` | `latency_ms` |
| `inputTokens` | `input_tokens` |
| `outputTokens` | `output_tokens` |
| `totalTokens` | `total_tokens` |
| `costEstimate` | `cost_estimate` |
| `errorMessage` | `error_message` |
| `variableValues` | `variable_values` |
| `interpolatedPrompt` | `interpolated_prompt` |
| `datasetRowIndex` | `dataset_row_index` |
| `promptName` | `prompt_name` |
| `promptVersion` | `prompt_version` |

> **Note:** FastAPI with Pydantic handles this automatically using `model_config = ConfigDict(populate_by_name=True)` and alias generators.

---

## 3. Database Schema

### `users`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           TEXT UNIQUE NOT NULL
password_hash   TEXT NOT NULL
name            TEXT NOT NULL
role            TEXT DEFAULT 'member'   -- 'admin' | 'member'
created_at      TIMESTAMPTZ DEFAULT now()
```

### `workspaces`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL
owner_id        UUID REFERENCES users(id) ON DELETE CASCADE
created_at      TIMESTAMPTZ DEFAULT now()
```

### `workspace_members`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
role            TEXT DEFAULT 'member'   -- 'admin' | 'member'
UNIQUE(workspace_id, user_id)
```

### `models`
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id        UUID REFERENCES workspaces(id) ON DELETE CASCADE
name                TEXT NOT NULL
provider            TEXT NOT NULL       -- 'OpenAI' | 'Anthropic' | 'Google' | 'Mistral' | 'Groq' | 'Custom'
model_id            TEXT NOT NULL       -- e.g. 'claude-sonnet-4-20250514'
endpoint            TEXT NOT NULL
api_key_encrypted   TEXT NOT NULL       -- Fernet encrypted, never plaintext
temperature         FLOAT DEFAULT 0.7
max_tokens          INT DEFAULT 1024
top_p               FLOAT DEFAULT 1.0
stop_sequences      TEXT[] DEFAULT '{}'
status              TEXT DEFAULT 'active'   -- 'active' | 'inactive'
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

### `prompts`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE
name            TEXT NOT NULL
description     TEXT DEFAULT ''
tags            TEXT[] DEFAULT '{}'
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### `prompt_versions`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
prompt_id       UUID REFERENCES prompts(id) ON DELETE CASCADE
version_number  INT NOT NULL            -- per-prompt incrementing, starts at 1
system_prompt   TEXT DEFAULT ''
user_template   TEXT DEFAULT ''         -- canonical name, NOT user_prompt
commit_message  TEXT DEFAULT ''
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(prompt_id, version_number)
```

### `datasets`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE
name            TEXT NOT NULL
category        TEXT DEFAULT 'Custom'   -- 'QA' | 'Summarization' | 'Classification' | 'RAG' | 'Custom'
version         TEXT DEFAULT 'v1'
columns         TEXT[] NOT NULL
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### `dataset_rows`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
dataset_id      UUID REFERENCES datasets(id) ON DELETE CASCADE
row_index       INT NOT NULL
row_data        JSONB NOT NULL          -- { column_name: value }
```

### `experiments`
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id        UUID REFERENCES workspaces(id) ON DELETE CASCADE
prompt_id           UUID REFERENCES prompts(id)
prompt_version_id   UUID REFERENCES prompt_versions(id)
model_id            UUID REFERENCES models(id)
dataset_id          UUID REFERENCES datasets(id)     -- nullable
dataset_row_index   INT                              -- nullable

-- Denormalized display fields (snapshot at run time)
prompt_name         TEXT
prompt_version      TEXT                -- e.g. 'v3' (derived display string)
model_name          TEXT
provider            TEXT

-- Prompt content snapshot
system_prompt       TEXT
user_template       TEXT
variable_values     JSONB DEFAULT '{}'
interpolated_prompt TEXT

-- Output
output              TEXT
latency_ms          INT
input_tokens        INT
output_tokens       INT
total_tokens        INT
cost_estimate       FLOAT DEFAULT 0     -- always a number, never a string

-- Status
status              TEXT DEFAULT 'success'   -- 'success' | 'error'
error_message       TEXT

-- Evaluation
score               FLOAT               -- nullable, 0-100
scores              JSONB DEFAULT '{}'  -- { "Relevance": 87, "Correctness": 92 }
reasoning           JSONB DEFAULT '{}'  -- { "Relevance": "explanation..." }
tags                TEXT[] DEFAULT '{}'
notes               TEXT DEFAULT ''

created_by          UUID REFERENCES users(id)
created_at          TIMESTAMPTZ DEFAULT now()
```

---

## 4. API Endpoints

### Base URL
```
http://localhost:8000/api
```

### Authentication header (all protected routes)
```
Authorization: Bearer <jwt_token>
```

---

### Auth

#### `POST /api/auth/register`
```json
// Request
{
  "email": "alex@acme.com",
  "password": "securepassword",
  "name": "Alex Developer"
}

// Response 201
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "member" },
  "token": "jwt_token_string"
}
```

#### `POST /api/auth/login`
```json
// Request
{
  "email": "alex@acme.com",
  "password": "securepassword"
}

// Response 200
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "member" },
  "token": "jwt_token_string"
}
```

#### `GET /api/auth/me`
```json
// Response 200
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "member" }
}
```

---

### Models

#### `GET /api/models`
```json
// Response 200
{
  "models": [
    {
      "id": "uuid",
      "name": "GPT-4 Turbo",
      "provider": "OpenAI",
      "modelId": "gpt-4-turbo",
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "apiKey": "••••••••",         // never return plaintext
      "temperature": 0.7,
      "maxTokens": 1024,
      "topP": 1.0,
      "stopSequences": [],
      "status": "active",
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

#### `POST /api/models`
```json
// Request
{
  "name": "GPT-4 Turbo",
  "provider": "OpenAI",
  "modelId": "gpt-4-turbo",
  "endpoint": "https://api.openai.com/v1/chat/completions",
  "apiKey": "sk-...",              // backend encrypts immediately, never stores plaintext
  "temperature": 0.7,
  "maxTokens": 1024,
  "topP": 1.0,
  "stopSequences": [],
  "status": "active"
}

// Response 201
{ "model": { ...same as GET item, apiKey: "••••••••" } }
```

#### `PATCH /api/models/:modelId`
```json
// Request (all fields optional)
{
  "name": "GPT-4 Turbo Updated",
  "apiKey": "sk-new-key...",       // only include if changing the key
  "temperature": 0.9,
  "status": "inactive"
}

// Response 200
{ "model": { ...updated model } }
```

#### `DELETE /api/models/:modelId`
```json
// Response 200
{ "ok": true }
```

#### `POST /api/models/validate`
> Tests if an API key is valid by making a minimal real request to the provider.
```json
// Request
{
  "modelId": "uuid",               // validate existing saved model
  // OR provide inline:
  "provider": "Anthropic",
  "apiKey": "sk-ant-...",
  "endpoint": "https://api.anthropic.com/v1/messages",
  "providerModelId": "claude-haiku-4-5-20251001"
}

// Response 200
{ "valid": true }
// or
{ "valid": false, "error": "invalid_api_key" }
```

---

### Prompts

#### `GET /api/prompts`
```
Query params:
  search?: string       -- filters name, description, tags
  tag?: string          -- filter by single tag
```
```json
// Response 200
{
  "prompts": [
    {
      "id": "uuid",
      "name": "Medical Assistant",
      "description": "Diagnoses based on symptoms",
      "tags": ["medical", "qa"],
      "versionCount": 9,           // derived count
      "experimentCount": 12,       // derived count
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

#### `POST /api/prompts`
```json
// Request
{
  "name": "Medical Assistant",
  "description": "Diagnoses based on symptoms",
  "tags": ["medical", "qa"]
}

// Response 201
{
  "prompt": { ...prompt object },
  "initialVersion": {             // v1 created automatically
    "id": "uuid",
    "promptId": "uuid",
    "versionNumber": 1,
    "versionDisplay": "v1",
    "systemPrompt": "",
    "userTemplate": "",
    "commitMessage": "Initial version",
    "createdAt": "..."
  }
}
```

#### `PATCH /api/prompts/:promptId`
```json
// Request (all optional)
{
  "name": "Updated Name",
  "description": "Updated description",
  "tags": ["new-tag"]
}

// Response 200
{ "prompt": { ...updated prompt } }
```

#### `POST /api/prompts/:promptId/duplicate`
```json
// Response 201
{
  "prompt": { ...new prompt with name "Medical Assistant (copy)" },
  "versions": [ ...all versions duplicated ]
}
```

#### `DELETE /api/prompts/:promptId`
```json
// Response 200
{ "ok": true }
// Cascades to: prompt_versions, experiments (set prompt_id null or cascade)
```

---

### Prompt Versions

#### `GET /api/prompts/:promptId/versions`
```
Query params:
  sort?: 'version_desc' (default) | 'version_asc'
```
```json
// Response 200
{
  "versions": [
    {
      "id": "uuid",
      "promptId": "uuid",
      "versionNumber": 9,
      "versionDisplay": "v9",      // always derived: f"v{version_number}"
      "systemPrompt": "You are...",
      "userTemplate": "Patient shows {symptom_1}...",
      "commitMessage": "Added context variable",
      "createdAt": "..."
    }
  ]
}
```

#### `POST /api/prompts/:promptId/versions`
```json
// Request
{
  "systemPrompt": "You are a medical assistant...",
  "userTemplate": "Patient shows {symptom_1} and {symptom_2}...",
  "commitMessage": "Added context variable"
}

// Response 201
{
  "version": {
    "id": "uuid",
    "promptId": "uuid",
    "versionNumber": 10,           // auto-incremented per prompt
    "versionDisplay": "v10",
    "systemPrompt": "...",
    "userTemplate": "...",
    "commitMessage": "...",
    "createdAt": "..."
  }
}
```

#### `GET /api/prompts/:promptId/versions/:versionId`
```json
// Response 200
{ "version": { ...full version object } }
```

---

### Datasets

#### `GET /api/datasets`
```
Query params:
  search?: string       -- filter by name
  category?: string     -- filter by category
```
```json
// Response 200
{
  "datasets": [
    {
      "id": "uuid",
      "name": "Medical QA",
      "category": "QA",
      "version": "v1",
      "columns": ["symptom_1", "symptom_2", "age", "expected_output"],
      "rowCount": 12,              // derived count from dataset_rows
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

#### `POST /api/datasets`
```json
// Request
{
  "name": "Medical QA",
  "category": "QA",
  "columns": ["symptom_1", "symptom_2", "age", "expected_output"],
  "rows": [
    { "symptom_1": "fever", "symptom_2": "cough", "age": "34", "expected_output": "flu" }
  ],
  "version": "v1"
}

// Response 201
{ "dataset": { ...dataset with rowCount } }
```

#### `GET /api/datasets/:datasetId`
```json
// Response 200
{
  "dataset": {
    "id": "uuid",
    "name": "Medical QA",
    "category": "QA",
    "version": "v1",
    "columns": ["symptom_1", "symptom_2", "age", "expected_output"],
    "rows": [
      { "symptom_1": "fever", "symptom_2": "cough", "age": "34", "expected_output": "flu" }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### `PUT /api/datasets/:datasetId`
```json
// Request (all optional)
{
  "name": "Medical QA v2",
  "category": "QA",
  "version": "v2",
  "columns": ["symptom_1", "symptom_2", "age", "expected_output"],
  "rows": [ ...full updated rows array... ]
}

// Response 200
{ "dataset": { ...updated dataset } }
```

#### `DELETE /api/datasets/:datasetId`
```json
// Response 200
{ "ok": true }
```

#### `POST /api/datasets/import`
> For CSV/JSON file uploads. Frontend parses the file and sends structured data.
```json
// Request
{
  "name": "Imported Dataset",
  "category": "Custom",
  "columns": ["col1", "col2"],
  "rows": [ { "col1": "val1", "col2": "val2" } ]
}

// Response 201
{ "dataset": { ...created dataset } }
```

---

### Experiments

#### `GET /api/experiments`
```
Query params:
  search?: string           -- full text search across promptName, output, variableValues
  provider?: string
  promptId?: string
  promptVersion?: string    -- e.g. 'v3'
  status?: string           -- 'success' | 'error'
  dateRange?: string        -- 'today' | 'week' | 'month' | 'all'
  datasetId?: string
  sortField?: string        -- default: 'created_at'
  sortDir?: string          -- 'asc' | 'desc', default: 'desc'
```
```json
// Response 200
{
  "experiments": [ ...Experiment[] ]
}
```

#### `POST /api/experiments`
> Used when frontend logs an experiment after a run (legacy path).  
> Prefer `POST /api/inference/run` which logs automatically.
```json
// Request: full Experiment object minus id/created_at
// Response 201
{ "experiment": { ...Experiment } }
```

#### `PATCH /api/experiments/:experimentId`
```json
// Request (all optional — only send fields being updated)
{
  "score": 87.5,
  "notes": "Good response but verbose",
  "tags": ["medical", "reviewed"],
  "scores": { "Relevance": 90, "Correctness": 85, "Toxicity": 2, "Fluency": 88 },
  "reasoning": { "Relevance": "Response addresses the question directly" }
}

// Response 200
{ "experiment": { ...updated experiment } }
```

#### `DELETE /api/experiments/:experimentId`
```json
// Response 200
{ "ok": true }
```

#### `POST /api/experiments/bulk-delete`
```json
// Request
{ "ids": ["uuid1", "uuid2", "uuid3"] }

// Response 200
{ "ok": true, "deletedCount": 3 }
```

---

### Inference

#### `POST /api/inference/run`
> The most important endpoint. Routes to the correct AI provider using the stored (encrypted) API key. Logs the result as an experiment automatically.
```json
// Request
{
  "modelId": "uuid",               // references models table
  "systemPrompt": "You are a medical assistant...",
  "userMessage": "Patient shows fever and cough. Age is 34.",
  "promptId": "uuid",              // for experiment logging
  "promptVersionId": "uuid",       // for experiment logging
  "variableValues": { "symptom_1": "fever", "age": "34" },
  "userTemplate": "Patient shows {symptom_1}...",
  "datasetId": "uuid",             // optional, for batch runs
  "datasetRowIndex": 2             // optional, for batch runs
}

// Response 200
{
  "output": "Based on the symptoms...",
  "latency": 847,                  // ms
  "inputTokens": 120,
  "outputTokens": 212,
  "totalTokens": 332,
  "costEstimate": 0.004,           // always a float, never a string
  "status": "success",
  "experiment": { ...full logged Experiment object }
}

// Response 200 (error case — provider returned error)
{
  "output": null,
  "status": "error",
  "errorMessage": "invalid_api_key",
  "experiment": { ...logged experiment with status: 'error' }
}
```

---

### Evaluations

#### `POST /api/evaluations/score`
> Uses an AI model to automatically score an experiment output.
```json
// Request
{
  "experimentId": "uuid",
  "metrics": ["Relevance", "Correctness", "Toxicity", "Fluency"],
  "expectedOutput": "flu",         // optional reference answer
  "scorerModelId": "uuid"          // optional: which model to use for scoring
}

// Response 200
{
  "scores": { "Relevance": 90, "Correctness": 85, "Toxicity": 2, "Fluency": 88 },
  "reasoning": {
    "Relevance": "Response directly addresses the symptoms provided",
    "Correctness": "Diagnosis aligns with expected output"
  },
  "updatedExperiment": { ...full Experiment with scores populated }
}
```

#### `POST /api/evaluations/batch-run`
> Runs a prompt version against all rows of a dataset sequentially.
```json
// Request
{
  "promptId": "uuid",
  "versionId": "uuid",
  "datasetId": "uuid",
  "modelId": "uuid",
  "rowLimit": "all",               // 'all' | 5 | 10
  "variableMapping": {             // promptVariable -> datasetColumn
    "symptom_1": "symptom_1",
    "symptom_2": "symptom_2",
    "age": "age"
  },
  "delayMs": 300                   // delay between rows, default 300
}

// Response 200
{
  "successCount": 11,
  "failCount": 1,
  "experiments": [ ...Experiment[] ],
  "errors": [
    { "rowIndex": 3, "message": "Rate limit exceeded" }
  ]
}
```

---

## 5. Provider Contracts

The backend's `ai_router.py` service handles all provider-specific formatting. Frontend only ever calls `/api/inference/run`.

### Anthropic
```python
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: {decrypted_api_key}
  anthropic-version: 2023-06-01
  content-type: application/json
Body:
  model, max_tokens, system, messages[{role: user, content: userMessage}]
Response path:
  output: content[0].text
  input_tokens: usage.input_tokens
  output_tokens: usage.output_tokens
```

### OpenAI / Mistral / Groq (same format)
```python
POST {endpoint}
Headers:
  Authorization: Bearer {decrypted_api_key}
  content-type: application/json
Body:
  model, max_tokens, temperature,
  messages[{role: system, content: systemPrompt}, {role: user, content: userMessage}]
Response path:
  output: choices[0].message.content
  input_tokens: usage.prompt_tokens
  output_tokens: usage.completion_tokens
```

### Google
```python
POST https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={decrypted_api_key}
# Note: {model_id} must be interpolated into the URL — not a placeholder
# Note: API key is a query param, NOT a header
Body:
  contents[{parts[{text: userMessage}]}]
  systemInstruction: {parts[{text: systemPrompt}]}
  generationConfig: {maxOutputTokens, temperature}
Response path:
  output: candidates[0].content.parts[0].text
  input_tokens: usageMetadata.promptTokenCount
  output_tokens: usageMetadata.candidatesTokenCount
```

### Cost Estimation (client-side rates in `cost.py`)
```python
COST_PER_1K_TOKENS = {
  "claude-haiku-4-5-20251001":      {"input": 0.00025, "output": 0.00125},
  "claude-sonnet-4-20250514":       {"input": 0.003,   "output": 0.015},
  "claude-opus-4-5":                {"input": 0.015,   "output": 0.075},
  "gpt-4-turbo":                    {"input": 0.01,    "output": 0.03},
  "gpt-4o":                         {"input": 0.005,   "output": 0.015},
  "gemini-2.5-flash":               {"input": 0.00015, "output": 0.0006},
  # Groq models: free tier, always return 0.0
}
```

---

## 6. Field Mismatch Reference

Critical inconsistencies found in the frontend codebase that the backend must resolve:

| Issue | Frontend (inconsistent) | Backend canonical | Action |
|---|---|---|---|
| Template field name | `userTemplate` and `userPrompt` both used | `user_template` | Backend only accepts `userTemplate` in requests |
| Version as string | `"v3"` stored in some experiment records | `version_number: int` in DB | Derive display string in response: `f"v{n}"` |
| Cost as mixed type | `0.004`, `"~$0.004"`, `"Free tier"` | `cost_estimate: float` | Always return float; frontend formats for display |
| Prompt version in experiment | Both `promptVersion` and `version` fields | `promptVersion` only | Drop duplicate `version` field from experiment responses |
| API key field name | `apiKey`, `encryptedApiKey`, `apiKeyEncrypted` | `apiKey` in requests, never returned | Standardize: accept `apiKey` in POST/PATCH, never return it |
| Prompt shape | Array vs object-keyed-by-id in old mock | Array only | Backend always returns arrays |
| Model display vs ID | `model` (display) and `modelId` both in experiments | `modelName` + `modelId` | Denormalize both as snapshots at run time |

---

## 7. Build Order

Build and test each step fully before moving to the next.

### Step 1 — Project Setup
- FastAPI app scaffold, `Dockerfile`, `docker-compose.yml`
- `.env` with: `DATABASE_URL`, `SECRET_KEY` (JWT), `ENCRYPTION_KEY` (Fernet)
- Supabase project created, connection string in `.env`
- `GET /health` returns `{"status": "ok"}`
- `docker compose up` starts successfully

### Step 2 — Database
- SQLAlchemy models for all 8 tables
- Alembic migration: `alembic revision --autogenerate` + `alembic upgrade head`
- Verify all tables exist in Supabase dashboard

### Step 3 — Auth
- `POST /api/auth/register` and `POST /api/auth/login`
- JWT token generation and validation middleware
- `GET /api/auth/me` protected route
- Test all three in Postman before continuing

### Step 4 — Models CRUD
- Full CRUD endpoints
- Fernet encryption on `apiKey` → stored as `api_key_encrypted`
- Response always masks key as `"••••••••"`
- `POST /api/models/validate` tests the key with a real minimal API call

### Step 5 — Prompts + Versions
- Full CRUD for prompts
- Version endpoints with auto-incrementing `version_number` per prompt
- Duplicate endpoint copies prompt + all versions
- Initial v1 created automatically on `POST /api/prompts`

### Step 6 — `/api/inference/run` ⭐
- Provider dispatcher in `ai_router.py` (port from frontend `callModel.js`)
- Decrypt API key, route to correct provider format, normalize response
- Auto-log experiment to database
- Test with each provider: Anthropic, OpenAI, Groq, Google

### Step 7 — Experiments
- List with all filter query params
- PATCH for score/notes/tags/scores/reasoning
- DELETE single + bulk-delete
- `POST /api/experiments` for manual logging (legacy path)

### Step 8 — Datasets
- Full CRUD + import endpoint
- `dataset_rows` stored separately, returned inline in `GET /api/datasets/:id`
- Row count derived in list view

### Step 9 — Evaluations
- `POST /api/evaluations/score` — AI scoring via `ai_router.py`
- `POST /api/evaluations/batch-run` — sequential row execution with delay

### Step 10 — Frontend Migration
- Replace every `localStorage` read/write with `fetch()` to the API
- One page at a time: Models → Prompts → Prompt Studio → Datasets → Experiments → Evaluations
- Add JWT token to all request headers
- Handle 401 responses by redirecting to login

---

## Appendix — Python Requirements

```
fastapi
uvicorn[standard]
sqlalchemy
alembic
psycopg2-binary
python-jose[cryptography]
passlib[bcrypt]
cryptography
python-dotenv
httpx
pydantic[email]
python-multipart
```

## Appendix — Project Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app, router registration, CORS
│   ├── database.py              # SQLAlchemy engine + session
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── workspace.py
│   │   ├── model.py
│   │   ├── prompt.py
│   │   ├── dataset.py
│   │   └── experiment.py
│   ├── schemas/                 # Pydantic request/response models
│   │   ├── auth.py
│   │   ├── model.py
│   │   ├── prompt.py
│   │   ├── dataset.py
│   │   └── experiment.py
│   ├── routers/                 # One file per feature area
│   │   ├── auth.py
│   │   ├── models.py
│   │   ├── prompts.py
│   │   ├── datasets.py
│   │   ├── experiments.py
│   │   ├── inference.py
│   │   └── evaluations.py
│   ├── services/
│   │   ├── ai_router.py         # Provider dispatch logic
│   │   ├── crypto.py            # Fernet encrypt/decrypt
│   │   └── cost.py              # Token cost calculation
│   └── core/
│       ├── config.py            # Env var loading
│       └── auth.py              # JWT helpers + dependency
├── alembic/
│   ├── env.py
│   └── versions/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env                         # never commit this
```
