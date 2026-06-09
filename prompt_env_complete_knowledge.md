# Prompt_Env — Complete Project Documentation

> Full technical record of the Prompt Engineering Platform project.
> Covers everything built, every decision made, every struggle encountered.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Backend API](#5-backend-api)
6. [Frontend Pages & Features](#6-frontend-pages--features)
7. [AI Inference System](#7-ai-inference-system)
8. [Evaluation & Scoring System](#8-evaluation--scoring-system)
9. [Design System](#9-design-system)
10. [Important Technical Decisions](#10-important-technical-decisions)
11. [Security](#11-security)
12. [Deployment](#12-deployment)
13. [Development Timeline & Struggles](#13-development-timeline--struggles)
14. [Known Limitations & Future Work](#14-known-limitations--future-work)

---

## 1. Project Overview

**Prompt_Env** is a full-stack prompt engineering platform enabling AI/ML teams to design, version, test, and evaluate LLM prompts in a structured and collaborative environment.

The platform provides a Git-inspired development lifecycle for prompts — treating them as versioned, testable artifacts. It is inspired by platforms like LangSmith, Braintrust, and PromptLayer, but built entirely from scratch.

### Core Objectives

- Enable teams to build high-quality prompts faster through structured iteration
- Test prompts systematically across datasets with variable interpolation
- Reduce hallucinations and unsafe outputs through evaluation metrics
- Track prompt performance over time with full experiment logging
- Provide a secure, multi-provider AI inference layer where API keys never touch the browser

### What Makes It Different

- **Multi-provider** — Anthropic, OpenAI, Google, Groq, Mistral, HuggingFace, and Custom endpoints all supported from one interface
- **Version-controlled prompts** — Save (edit in place) vs Commit (create new version) pattern matching professional tools
- **Dataset-driven evaluation** — Run prompts against entire datasets, not just one input at a time
- **AI-powered scoring** — Use any LLM as a judge to automatically score outputs with chain-of-thought reasoning
- **Custom evaluation metrics** — Define your own rubrics instead of being forced into fixed metrics
- **Secure by design** — API keys Fernet-encrypted at rest, all inference server-side

---

## 2. Architecture

### High-Level Architecture

```
Browser (React SPA)
        ↕  REST API + JWT Auth
FastAPI Backend (Railway)
        ↕  SQLAlchemy + psycopg2
Supabase (Hosted PostgreSQL)

FastAPI Backend → AI Providers (Anthropic, OpenAI, Google, Groq, Mistral, HuggingFace)
```

### Three-Tier Structure

| Tier | Technology | Responsibility |
|---|---|---|
| Frontend | React (Vite) | UI, routing, state management, localStorage draft persistence |
| Backend | Python FastAPI | Business logic, auth, encryption, AI provider routing |
| Database | Supabase PostgreSQL | Persistent storage of all application data |

### Key Architectural Decisions

**1. All AI calls go through the backend**

The original prototype called AI providers directly from the browser with API keys stored in localStorage. This was replaced entirely. Every inference request now goes:
```
Browser → FastAPI (/api/inference/run) → AI Provider
```
API keys are decrypted server-side and never sent to the browser after initial submission.

**2. Frontend-only draft state**

Draft state (unsaved prompt edits, variable values, selected model) stays in `localStorage` keyed by `promptId`. This was a deliberate decision to avoid unnecessary backend complexity for ephemeral working state. Versions are the only thing persisted to the database.

**3. Supabase cloud instead of self-hosted Postgres**

Chosen over a locally Dockerized database for simplicity and free tier availability. The trade-off: running Alembic migrations requires a network that allows outbound connections on port 5432, which blocked access on restricted university/school networks. Workaround was either mobile hotspot or running migrations directly in Supabase SQL Editor.

**4. Monorepo structure**

Frontend and backend coexist in the same GitHub repository:
```
prompt-engineering-platform/
├── src/                    ← React frontend (Vite)
├── backend/                ← FastAPI backend
├── public/
├── package.json
└── railway.json
```

Railway deploys the backend from the `backend/` subdirectory. The frontend runs locally with `npm run dev` during development.

---

## 3. Technology Stack

### Frontend
| Tool | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool and dev server |
| IBM Plex Sans / IBM Plex Mono | Typography |
| Custom CSS | All styling — no component library |
| localStorage | Draft persistence, auth token storage |

### Backend
| Tool | Purpose |
|---|---|
| Python FastAPI | API framework |
| SQLAlchemy | ORM |
| Alembic | Database migrations |
| psycopg2-binary | PostgreSQL driver |
| python-jose | JWT token generation and validation |
| passlib[bcrypt] | Password hashing |
| cryptography (Fernet) | API key encryption at rest |
| httpx | Async HTTP client for AI provider calls |
| pydantic[email] | Request/response validation |
| python-dotenv | Environment variable loading |

### Infrastructure
| Tool | Purpose |
|---|---|
| Supabase | Hosted PostgreSQL database |
| Railway | Backend deployment (auto-deploys from GitHub) |
| Docker | Backend containerization |
| GitHub | Version control, CI/CD trigger |

### AI Providers Supported
| Provider | Format | Auth |
|---|---|---|
| Anthropic | Custom `/v1/messages` | `x-api-key` header |
| OpenAI | OpenAI Chat Completions | `Authorization: Bearer` |
| Google Gemini | `generateContent` | `?key=` query param |
| Groq | OpenAI-compatible | `Authorization: Bearer` |
| Mistral | OpenAI-compatible | `Authorization: Bearer` |
| HuggingFace | OpenAI-compatible router | `Authorization: Bearer` |
| Custom | OpenAI-compatible (fallback) | `Authorization: Bearer` |

---

## 4. Database Schema

10 tables total. All primary keys are UUIDs. All timestamps use timezone-aware PostgreSQL `TIMESTAMPTZ`.

### `users`
```sql
id UUID PK, email TEXT UNIQUE, password_hash TEXT,
name TEXT, role TEXT DEFAULT 'member', created_at TIMESTAMPTZ
```

### `workspaces`
```sql
id UUID PK, name TEXT, owner_id UUID → users, created_at TIMESTAMPTZ
```
Each user gets one workspace automatically on registration.

### `workspace_members`
```sql
id UUID PK, workspace_id UUID → workspaces,
user_id UUID → users, role TEXT DEFAULT 'member'
UNIQUE(workspace_id, user_id)
```
Foundation for future multi-user collaboration (not yet fully implemented in UI).

### `models`
```sql
id UUID PK, workspace_id UUID, name TEXT, provider TEXT,
model_id TEXT, endpoint TEXT, api_key_encrypted TEXT,
temperature FLOAT, max_tokens INT, top_p FLOAT,
stop_sequences TEXT[], status TEXT DEFAULT 'active',
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```
`api_key_encrypted` stores Fernet-encrypted API key. Never plaintext. Never returned in API responses.

### `prompts`
```sql
id UUID PK, workspace_id UUID, name TEXT, description TEXT,
tags TEXT[], created_by UUID → users,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```
A named container. Actual content lives in `prompt_versions`.

### `prompt_versions`
```sql
id UUID PK, prompt_id UUID → prompts,
version_number INT,  -- per-prompt incrementing, starts at 1
system_prompt TEXT, user_template TEXT,  -- canonical: user_template NOT user_prompt
commit_message TEXT, created_by UUID → users, created_at TIMESTAMPTZ
UNIQUE(prompt_id, version_number)
```

### `datasets`
```sql
id UUID PK, workspace_id UUID, name TEXT, category TEXT,
version TEXT DEFAULT 'v1', columns TEXT[],
created_by UUID → users, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

### `dataset_rows`
```sql
id UUID PK, dataset_id UUID → datasets,
row_index INT, row_data JSONB
```
Rows stored separately. List view returns `rowCount` only. Detail view returns full rows.

### `experiments`
```sql
id UUID PK, workspace_id UUID,
prompt_id UUID → prompts, prompt_version_id UUID → prompt_versions,
model_id UUID → models, dataset_id UUID → datasets (nullable),
dataset_row_index INT (nullable),
batch_id VARCHAR (nullable), batch_name VARCHAR (nullable),

-- Denormalized snapshots at run time
prompt_name TEXT, prompt_version TEXT, model_name TEXT, provider TEXT,
system_prompt TEXT, user_template TEXT,
variable_values JSONB, interpolated_prompt TEXT,

-- Output
output TEXT, latency_ms INT, input_tokens INT,
output_tokens INT, total_tokens INT, cost_estimate FLOAT,
status TEXT DEFAULT 'success', error_message TEXT,

-- Evaluation
score FLOAT, scores JSONB, reasoning JSONB,
tags TEXT[], notes TEXT,
created_by UUID → users, created_at TIMESTAMPTZ
```

### `evaluation_metrics`
```sql
id UUID PK, workspace_id UUID, name TEXT, description TEXT,
is_inverse BOOLEAN DEFAULT FALSE,  -- True = lower is better (e.g. Toxicity)
is_default BOOLEAN DEFAULT TRUE,
order_index INT DEFAULT 0, created_at TIMESTAMPTZ
```
Default 4 metrics seeded per workspace: Relevance, Correctness, Fluency, Toxicity.

---

## 5. Backend API

Base URL: `https://prompt-engineering-platform-production.up.railway.app/api`

All endpoints except `/auth/register` and `/auth/login` require:
```
Authorization: Bearer <jwt_token>
```

### Auth (`/api/auth`)
| Method | Path | Description |
|---|---|---|
| POST | `/register` | Create account, auto-create workspace, return JWT |
| POST | `/login` | Authenticate, return JWT + user + workspace |
| GET | `/me` | Get current user + workspace |
| PATCH | `/me` | Update display name |

### Models (`/api/models`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | List all models in workspace |
| POST | `/` | Create model (encrypts API key immediately) |
| PATCH | `/:id` | Update model (re-encrypts key if provided) |
| DELETE | `/:id` | Delete model |
| POST | `/validate` | Test if API key is valid (SSRF-protected) |

### Prompts (`/api/prompts`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | List prompts (search, tag filter) |
| POST | `/` | Create prompt + auto-create v1 |
| PATCH | `/:id` | Update name/description/tags |
| POST | `/:id/duplicate` | Duplicate prompt + all versions |
| DELETE | `/:id` | Delete prompt (cascades to versions) |
| GET | `/:id/versions` | List versions (newest first) |
| POST | `/:id/versions` | Create new version (auto-increment version_number) |
| GET | `/:id/versions/:vid` | Get single version |
| PATCH | `/:id/versions/:vid` | Update version in place (Save, not Commit) |

### Datasets (`/api/datasets`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | List datasets with rowCount |
| POST | `/` | Create dataset + rows |
| GET | `/:id` | Get dataset with full rows array |
| PUT | `/:id` | Update dataset (replaces rows if provided) |
| DELETE | `/:id` | Delete dataset + rows (cascade) |
| POST | `/import` | Import from parsed CSV/JSON |

### Experiments (`/api/experiments`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | List with filters (search, provider, promptId, version, status, dateRange, datasetId, batchId) |
| POST | `/` | Manual experiment log |
| PATCH | `/:id` | Update score/notes/tags/scores/reasoning |
| DELETE | `/:id` | Delete single |
| POST | `/bulk-delete` | Delete multiple by ID array |
| GET | `/batches` | List batch runs (grouped by batch_id, includes synthetic "ungrouped") |
| PATCH | `/batches/:batchId` | Rename a batch |

### Inference (`/api/inference`)
| Method | Path | Description |
|---|---|---|
| POST | `/run` | Run prompt against provider, auto-log experiment |

### Evaluations (`/api/evaluations`)
| Method | Path | Description |
|---|---|---|
| POST | `/score` | Score single experiment with AI (chain-of-thought, auto-fetches expected output) |
| POST | `/score-batch` | Start background batch scoring job |
| GET | `/score-batch/:jobId` | Poll scoring job progress |
| POST | `/score-batch/:jobId/cancel` | Cancel running scoring job |
| POST | `/batch-run` | Run prompt against entire dataset |

### Metrics (`/api/metrics`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | List workspace evaluation metrics |
| POST | `/` | Create custom metric (injection-protected) |
| PATCH | `/:id` | Update metric |
| DELETE | `/:id` | Delete metric (cannot delete last one) |

### Workspaces (`/api/workspaces`)
| Method | Path | Description |
|---|---|---|
| PATCH | `/:id` | Rename workspace |

---

## 6. Frontend Pages & Features

### Landing Page (`/`)
- Two-column layout: branding left, CTA right
- Authenticated users see "Go to App →" instead of "Get Started"
- Hero mockup built in HTML/CSS (no screenshots)
- Sections: hero, features (6 cards), how it works (4-step stepper), providers, CTA, footer
- Fade-in on scroll via `IntersectionObserver`
- Unauthenticated: shows landing. Authenticated: accessible via logo click.

### Auth Page (`/login`, `/register`)
- Two-column: branding panel left, form right
- Tab switcher between Login and Register
- JWT stored in `localStorage` as `pe_auth_token`
- Authenticated state checked via `isAuthenticated()` which decodes JWT expiry client-side
- 401 responses globally redirect to login

### Models Page
- Card grid (3 columns)
- Provider chips: OAI, ANT, GGL, GRQ, MST, HF, CUST
- Add/Edit modal with sliders for temperature, top-p
- API key masked after save (`••••••••`)
- Status toggle: Active/Inactive
- Pre-seeded with 4 defaults on first load (localStorage fallback)

### Datasets Page
- Card grid with category chips, row count, column preview
- Detail view: spreadsheet-style table
  - Per-cell debounced autosave (800ms, independent timers per cell)
  - Editing cell A never blocks cell B from saving
  - `onBlur` flushes debounce immediately
  - `flushAllPendingEdits()` called before row add/delete
- CSV and JSON import with 5-row preview
- Export to CSV or JSON

### Prompts Library Page
- Card grid showing version count, experiment count, last run model
- Search by name/description/tags, filter by tag chips
- New Prompt modal → auto-opens Prompt Studio at v1

### Prompt Studio Page
- Accessed by clicking a prompt in the library (never directly from sidebar)
- Breadcrumb: `Prompts / {Prompt Name}`
- Three-column layout: version sidebar | editor | output preview

**Version Sidebar:**
- Lists versions newest-first
- Active version: green left border
- Draft indicator: `"Draft saved · just now"`
- Save button: updates current version in place (PATCH)
- Commit button: creates new version (POST), increments version_number per prompt
- Commit message input appears inline before confirming
- Unsaved changes detected by comparing editor state to `lastSavedContent`

**Editor Panel:**
- System prompt: plain textarea
- User template: textarea + mirror div overlay (highlight pattern)
  - `{variable}` tokens highlighted with green tint, zero-cost CSS spans
  - Spans use only `background-color` and `color` — no padding/margin/border to prevent cursor desync
  - `useLayoutEffect` syncs `mirror.scrollTop = textarea.scrollTop`
- Variables panel: auto-synced 2-column grid, preserves values when template changes
- Draft auto-saved to `pe_drafts[promptId]` in localStorage (800ms debounce)
- Draft includes: systemPrompt, userTemplate, variableValues, selectedModelId

**Output Preview:**
- Empty state: flask icon + "Hit Run Prompt"
- After run: response text, metadata chips (latency, tokens, cost, status)
- Latency colored: amber if >3000ms, muted otherwise (never red — red = error not slowness)

### Experiments Page
- Full-featured table with filters: search, provider, prompt, version, status, date range, dataset, batch
- Sortable columns
- Bulk select + delete + JSON export
- Experiment detail drawer (right side):
  - Output in dark contained monospace block with copy button
  - Metadata as pill chips
  - Scores section: overall bar + per-metric bars + reasoning as left-bordered blocks
  - Scorer model dropdown (loads from API) + Score button
  - Rescore all or individual metric with `↺` button on hover
  - Shows "✓ Scored against expected output" indicator when dataset row was found
  - Notes textarea (autosaves on blur)

### Evaluations Page (3 tabs)

**Overview Tab:**
- 5 stat cards: scored experiments, avg relevance, avg correctness, avg toxicity, avg overall
- Performance by Model table with prompt selector filter
- Performance by Version table with prompt selector filter
- Toxicity excluded from Overall average (inverse metric)

**Comparison Tab:**
- Select two named batch runs (A vs B) from dropdowns
- Summary cards per batch: name, row count, avg overall score
- Row-by-row comparison: outputs side by side, per-metric scores, winner indicator (`▲ Better by X%`)
- Rows matched by `dataset_row_index`
- Batch naming: set when launching, or rename inline from Existing Runs tab

**Batch Eval Tab:**
- Two sub-tabs: Existing Runs | Run New Batch
- Existing Runs: batch selector as pill buttons, table filtered to selected batch
- Run New Batch: dataset selector, prompt version selector, model selector, variable mapping, row limit, optional batch name
- Real-time progress bar during run
- Score All with AI: triggers backend job, polls every 3 seconds, safe to navigate away
- Progress shows "Running on server — safe to navigate away"
- Cancel button stops after current experiment

### Workspace Settings Page
- Workspace name (inline editable)
- Display name (editable)
- **Evaluation Metrics section**: list workspace metrics, add/edit/delete, toggle default, "lower is better" flag
- Sign out button (subtle, no "DANGER ZONE" label)

---

## 7. AI Inference System

### Provider Dispatcher (`ai_router.py`)

Single `call_provider(model, system_prompt, user_message)` function routes to provider-specific handlers:

```
Anthropic  → _call_anthropic()    POST /v1/messages, x-api-key header
OpenAI     → _call_openai_compatible()   POST endpoint, Bearer auth
Mistral    → _call_openai_compatible()   same format
Groq       → _call_openai_compatible()   same format
HuggingFace → _call_openai_compatible()  router.huggingface.co/v1
Google     → _call_google()        POST model URL, ?key= query param
Custom     → _call_openai_compatible()   fallback
```

### Google-Specific Notes
- URL must interpolate `model_id`: `https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent`
- API key passed as `?key=` query param, NOT Authorization header
- Body format completely different from OpenAI: `contents`, `systemInstruction`, `generationConfig`
- Response path: `candidates[0].content.parts[0].text`

### Retry Logic (`retry.py`)

Two exception types trigger retries:
- `RateLimitError` — HTTP 429 from provider, extracts `retry_after` from error message if available
- `ParseError` — LLM returned malformed JSON or missing metrics

Both use `with_exponential_backoff()`:
- Rate limit: max 4 retries, base 2s delay, max 60s, with jitter
- Parse failure: max 3 retries, base 1s delay, max 10s

### Cost Estimation (`cost.py`)

Hardcoded per-1k-token rates per model. Returns `0.0` for unknown models (safe fallback). Groq free tier always returns `0.0`. Cost stored as `FLOAT` in database — never as formatted string.

### SSRF Protection

Before any HTTP request to a provider endpoint:
- Blocks private IP ranges: `10.x`, `172.16.x`, `192.168.x`, `127.x`, `169.254.x` (AWS metadata)
- Allowlist of permitted hostnames for major providers
- Custom endpoints must be publicly routable hostnames
- Applied in both `/validate` endpoint and `call_provider()`

---

## 8. Evaluation & Scoring System

### Scoring Flow

```
User clicks "Score" / "Score All with AI"
    ↓
Frontend sends POST /api/evaluations/score (single) or POST /api/evaluations/score-batch (batch)
    ↓
Backend loads experiment + scorer model + workspace metrics
    ↓
Auto-fetches expected output from dataset row (if experiment has datasetId + datasetRowIndex)
    ↓
Builds chain-of-thought scoring prompt
    ↓
Calls call_provider() with retry logic
    ↓
Parses JSON from end of LLM response (CoT puts JSON last)
    ↓
Safe-merges new scores into existing scores (never overwrites other metrics)
    ↓
Recalculates overall (excludes inverse metrics, excludes None values)
    ↓
Saves to experiments table
    ↓
Returns updatedExperiment to frontend
```

### Chain-of-Thought Prompt Design

The scoring prompt explicitly asks the LLM to:
1. **Step 1**: Reason about each metric (2-3 sentences each)
2. **Step 2**: Output the final JSON scores

This "scratchpad prompting" approach consistently improves LLM-as-judge accuracy compared to zero-shot JSON requests.

User-defined metric rubrics are wrapped in XML-style delimiters to prevent prompt injection:
```xml
<metric name="Tone">
  Is the response formal and professional?
</metric>
```

### JSON Parsing Strategy

Parser searches for JSON from the **end** of the response (CoT outputs reasoning before JSON):
1. Find all `{ }` blocks, try from last to first
2. Fallback: find last `{` and parse from there
3. Fallback: regex extraction of individual metric scores
4. Complete failure: return empty dict, trigger `ParseError` retry

### Score Merge Safety

When rescoring a single metric, only that metric is updated. Other metrics are preserved:
```python
merged_scores = {**existing_scores, **new_scores}  # only overwrites requested metrics
```

### Inverse Metrics

Toxicity (and any user-defined `is_inverse=True` metric) is:
- Excluded from Overall score calculation
- Displayed separately in UI
- Not averaged into the aggregate stats

### Overall Score Calculation

```python
INVERSE_METRICS = [m.name for m in workspace_metrics if m.is_inverse]
scoreable = {
    k: v for k, v in merged_scores.items()
    if k not in INVERSE_METRICS
    and v is not None
    and isinstance(v, (int, float))
    and v >= 0
}
overall = round(sum(scoreable.values()) / len(scoreable), 1) if scoreable else None
```

### Batch Scoring (Background Job)

- Triggered via `POST /api/evaluations/score-batch`
- Returns immediately with `jobId`
- Runs as FastAPI `BackgroundTask` on Railway server
- Frontend polls `GET /api/evaluations/score-batch/:jobId` every 3 seconds
- Safe to navigate away — scoring continues on server
- Cancel via `POST /api/evaluations/score-batch/:jobId/cancel`
- Job state stored in module-level `SCORING_JOBS` dict (in-memory, single Railway instance)

### Custom Metrics

- Stored per workspace in `evaluation_metrics` table
- Users define name, description/rubric, direction (higher/lower is better), default status
- Injected into scoring prompt dynamically — no hardcoded metric names
- Injection protection: keyword blocklist, 500-char max, XML delimiters
- Seeded with 4 defaults on workspace creation

---

## 9. Design System

### Colors
```css
--background:     #0f0e0d    /* page background */
--surface:        #161613    /* cards, panels */
--surface-raised: #1a1916    /* elevated elements */
--border:         #252320    /* all borders */
--text-primary:   #f0ece4    /* main text */
--text-muted:     #6b6860    /* secondary text */
--accent:         #88d273    /* primary green */
--error:          #ff6b6b    /* errors */
--warning:        #e8a847    /* warnings, amber */
```

### Typography
- **Body**: IBM Plex Sans
- **Code / Labels / Pills**: IBM Plex Mono
- **Section labels**: `font-size: 11px`, `letter-spacing: 0.08em`, `text-transform: uppercase`, monospace, muted color
- **Version pills**: monospace, green border, `padding: 2px 6px`, `border-radius: 4px`

### Component Patterns
- **Modals**: close on Escape + outside click. Outside click uses `onMouseDown` + `onMouseUp` pair — NOT `onClick`. This prevents the drag-outside bug where clicking inside and releasing outside would close the modal.
- **Sliders**: custom `input[type="range"]` with CSS fill tracking via `--range-progress` CSS variable
- **Checkboxes**: custom styled, hidden native, `appearance: none`
- **Scrollbar**: 6px width, transparent track, `#333` thumb, `border-radius: 3px`
- **Empty states**: centered icon + title + subtitle + action button. Never show empty state during loading — show skeleton instead.
- **Skeleton loaders**: pulse animation, approximate card shapes, only shown during initial fetch

### Design Principles
- No gradients except subtle radial hero glow
- No neon/glow box shadows
- No typewriter animations
- Warm dark theme — backgrounds slightly warm (`#0f0e0d`) not cold blue-black
- Latency color coding: amber >3000ms, muted otherwise. **Never red for latency** — red is reserved for errors only
- Toxicity displayed same as other metrics visually — no special "lower is better" annotation in UI

---

## 10. Important Technical Decisions

### 1. `user_template` not `user_prompt`

During the codebase analysis, two field names were found in use: `user_template` (new) and `user_prompt` (legacy). The canonical name `user_template` was enforced across all backend schemas, migrations, and API responses. Frontend was migrated to match.

### 2. Version numbers are per-prompt, not global

`version_number` auto-increments per prompt independently. Medical Assistant can have v1-v9 while Finance Analyzer has its own v1-v3. The database has `UNIQUE(prompt_id, version_number)` to enforce this.

### 3. `versionDisplay` derived, not stored

The display string `"v3"` is derived as `f"v{version_number}"` in API responses. Never stored in the database. This prevents inconsistency between stored strings and actual version numbers.

### 4. `costEstimate` is always a `FLOAT`

Early experiments stored cost as formatted strings (`"~$0.004"`, `"Free tier"`). This caused crashes in the experiments page (`costEstimate.replace is not a function`). All costs normalized to `FLOAT` in the database. Frontend formats for display.

### 5. Save vs Commit versioning pattern

The original design auto-created a new version on every save, leaving v1 permanently empty. This was redesigned after researching LangSmith and Braintrust:
- **Save** (`PATCH /api/prompts/:id/versions/:vid`): updates current version in place
- **Commit** (`POST /api/prompts/:id/versions`): creates a new version with a message

This means v1 holds real content from the first save. Nothing is ever wasted.

### 6. Batch runs grouped by `batch_id`

All experiments from a single batch run share the same `batch_id` UUID generated before the loop starts. A synthetic "Individual Runs (no batch)" group is created for experiments with `batch_id = NULL`. This enables the Comparison tab to compare batch runs rather than individual experiments.

### 7. Backend batch scoring over frontend loop

The original "Score All with AI" implementation was a JavaScript `for` loop in the frontend firing one API call per experiment. Navigating away would silently cancel it mid-batch. Replaced with:
- Single `POST /api/evaluations/score-batch` triggers a FastAPI `BackgroundTask`
- Returns `jobId` immediately
- Frontend polls every 3 seconds
- Railway server runs the entire loop regardless of browser state

### 8. Supabase for database tier, not local Postgres

Chosen for managed hosting, free tier, and dashboard visibility. The downside: port 5432 is blocked on many university/corporate networks, making `alembic upgrade head` fail. Workaround: direct SQL in Supabase SQL Editor, or mobile hotspot.

### 9. Drafts stay in localStorage (not database)

Draft state is per-user, per-device, ephemeral. Storing it in the database adds complexity (draft API endpoints, draft table, sync logic) for minimal benefit at this stage. Decision: `pe_drafts` stays in `localStorage`, keyed by `promptId`, with 800ms debounce autosave.

### 10. No workspace collaboration UI (yet)

The database schema fully supports multi-user workspaces (`workspace_members` table with roles). The backend creates a default workspace per user. However, the invite/join/switch UI was deliberately deferred — single-workspace-per-user works for the current use case.

---

## 11. Security

### Implemented

| Measure | Implementation |
|---|---|
| API key encryption | Fernet symmetric encryption. Key in Railway env vars, never in code. |
| Password hashing | bcrypt via passlib. 72-char limit enforced. |
| JWT auth | `python-jose`, 7-day expiry, `HS256` algorithm |
| API key masking | Responses always return `"••••••••"`, never plaintext |
| SSRF protection | Hostname allowlist + private IP range blocklist on all outbound HTTP |
| IDOR fix | Workspace ownership verified on scoring job cancel |
| CORS restriction | Specific methods and headers only, not `["*"]` |
| Prompt injection protection | Keyword blocklist + length limits + XML delimiters on user metric rubrics |

### Known Remaining Issues

| ID | Severity | Description |
|---|---|---|
| SEC-001 | Critical | `.env` file must not be committed to git. Verify with `git log --all --full-history -- backend/.env` |
| SEC-004 | High | No rate limiting on `/api/auth/login`. Vulnerable to brute force and CPU-exhaustion DoS via bcrypt. Fix: `slowapi` library. |
| SEC-005 | Medium | Single static Fernet key. If exposed, all API keys compromised. Future: KMS or Vault. |

### Security Fixes Applied (from audit)

- **SEC-002 (SSRF)**: `validate_endpoint_url()` added to `models.py` and `ai_router.py`
- **SEC-003 (IDOR)**: Workspace ownership check added to `cancel_scoring_job`
- **SEC-006 (CORS)**: Restricted to specific methods and headers

---

## 12. Deployment

### Production Setup

| Component | Platform | Notes |
|---|---|---|
| Backend | Railway | Auto-deploys on push to `main`. Dockerfile in `backend/`. |
| Database | Supabase cloud | Free tier. EU Central region. |
| Frontend | Local dev | `npm run dev` on port 5173. Not yet deployed. |

### Railway Configuration

- Root directory set to `backend/`
- All secrets in Railway environment variables (never in code)
- `ALLOWED_ORIGINS` includes `http://localhost:5173` for local dev
- `docker-compose.yml` present but Railway uses the `Dockerfile` directly

### Environment Variables Required

```env
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require
SUPABASE_URL=https://[REF].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
SECRET_KEY=<random 32+ char string>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ENCRYPTION_KEY=<Fernet key ending in =>
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173,https://[your-railway-url].up.railway.app
```

### Cold Start Issue

Railway free tier spins down after inactivity. First request after sleep can take 10-30 seconds. Frontend handles this with a `wakeUpBackend()` call on app load that pings `/health` before loading user data.

---

## 13. Development Timeline & Struggles

### Major Struggles

**1. Network restrictions blocking Supabase (persistent)**

Port 5432 is blocked on university and corporate networks. Running `alembic upgrade head` consistently timed out. Required mobile hotspot for every migration. This was encountered repeatedly throughout the project — every new migration meant switching networks. Workarounds: mobile hotspot, or applying SQL directly in Supabase SQL Editor.

**2. The variable highlight cursor desync bug**

The most persistent frontend bug. `{variable}` tokens in the User Template editor needed syntax highlighting without breaking the text cursor. Multiple approaches failed:
- `contenteditable` with innerHTML rewriting: cursor position reset on every keystroke
- Transparent textarea over highlight div: span padding/margin caused text reflow desync

Final solution: textarea + mirror div with **zero-cost CSS spans** — only `background-color` and `color` changed, every other property explicitly inherited. `useLayoutEffect` syncing `scrollTop`. Took multiple iterations to get right.

**3. Railway deployment crashes from syntax errors**

Several backend changes introduced Python syntax errors that only surfaced at Railway deployment time (not caught locally because files weren't run directly). Each crash took a full redeploy cycle to fix. Root cause: AI agents making partial edits to large files, introducing mismatched brackets.

**4. Token context limits on AI coding agents**

`App.jsx` grew to thousands of lines before the refactor. AI agents consistently hit output token limits mid-edit, leaving files half-updated or corrupted. Solution: split into separate component files (`src/pages/`, `src/utils/`, `src/components/`). After the refactor, agents could edit individual files independently without hitting limits.

**5. bcrypt version incompatibility**

`passlib` doesn't support newer versions of the `bcrypt` library. Register endpoint crashed with `AttributeError: module 'bcrypt' has no attribute '__about__'` and a separate `ValueError: password cannot be longer than 72 bytes`. Fixed by pinning `bcrypt==4.0.1`.

**6. Google API URL interpolation bug**

Google's endpoint URL contains a `{model}` placeholder: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`. This placeholder wasn't being replaced with the actual model ID before the HTTP call, sending literal `{model}` in the URL. Google returned a 404. Fix: `url = endpoint.replace("{model}", model.model_id)`.

**7. AI scoring returning "metric missing" errors**

The original scoring system made 4 separate API calls (one per metric). Each call had independent chances to hit rate limits or return malformed JSON. With Groq's free tier TPM limits, this caused frequent partial failures. Solution: single API call requesting all metrics in one prompt, with chain-of-thought reasoning before the JSON output. Parse failures trigger retry via `ParseError` exception type.

**8. `costEstimate` type inconsistency crash**

The Experiments page crashed with `TypeError: e.costEstimate?.replace is not a function` because some experiments stored cost as a string (`"~$0.004"`, `"Free tier"`) while the code expected a number. Fixed by normalizing all costs to `FLOAT` in the database and adding defensive parsing everywhere.

**9. Hooks order violation black screen**

The Experiments page rendered a black screen after the Prompts Library refactor. Error: `"Rendered more hooks than during the previous render"`. A `useEffect` had been placed after a conditional `return` statement, violating React's Rules of Hooks. Fixed by moving all hooks above any conditional logic.

**10. 499 errors on load (Railway cold start)**

After deployment, the app would show "Connecting to workspace..." indefinitely. Browser was cancelling requests (499) before Railway's sleeping server responded. Fixed with `wakeUpBackend()` — a health ping before loading user data, giving Railway time to wake up.

### Architectural Evolution

The project went through several significant architectural shifts:

1. **localStorage → backend API** — The prototype used localStorage for everything. Migrating to a real backend was the most significant change, requiring replacement of every `localStorage.get/set` call with authenticated `fetch()` calls.

2. **Single prompt → Prompts Library** — Originally one unnamed prompt with global versions. Refactored to named prompts each with independent version histories, matching how real platforms work.

3. **Frontend AI calls → Backend inference** — API keys moved from browser localStorage to server-side Fernet-encrypted database storage. All AI calls now proxied through `/api/inference/run`.

4. **Frontend scoring loop → Backend job** — "Score All with AI" moved from a JavaScript `for` loop (cancelled on navigation) to a FastAPI `BackgroundTask` with polling.

---

## 14. Known Limitations & Future Work

### Current Limitations

| Area | Limitation |
|---|---|
| Workspace collaboration | Single workspace per user. `workspace_members` table exists but no invite UI. |
| Local model support | Requires either local backend or ngrok tunnel. Railway can't reach `localhost:11434`. |
| JWT revocation | Tokens can't be invalidated on logout — only expire after 7 days. |
| Rate limiting | No brute-force protection on `/api/auth/login`. |
| In-memory job store | `SCORING_JOBS` dict lost on Railway restart. Jobs in progress when server restarts are lost. |
| No per-row scoring | Can only "Score All" — no way to score a single row from Batch Eval table. |
| Frontend not deployed | Only runs locally. No public URL for the React app. |

### Planned / Discussed But Not Built

| Feature | Notes |
|---|---|
| HuggingFace Inference API | Research done, confirmed OpenAI-compatible format via `router.huggingface.co/v1`. Partially implemented. |
| Docker Compose self-hosting | Would enable local model support. `docker-compose.yml` exists for backend. Frontend Dockerfile not written. |
| DevOps / CI/CD pipeline | Discussed as a learning exercise. Structure: Docker → GitHub Actions → Kubernetes + Argo CD. Not started. |
| Workspace invites | Schema ready (`workspace_members`). Backend endpoints for invite/accept not built. |
| Per-row scoring button | Phase 5 of AI scoring redesign. Not started. |
| Scoring transparency | Show user the exact prompt sent to scorer model. Not built. |
| Refresh token mechanism | Currently single long-lived JWT. Refresh token pattern not implemented. |
| Rate limiting on auth | `slowapi` library identified. Not yet added. |
| Key rotation for Fernet | Future KMS/Vault integration. Currently single static key. |

### Tech Debt

- Some frontend pages may still read from localStorage for certain operations — full migration verification needed
- Legacy `-1` sentinel values for failed scores may exist in old experiment records (SQL cleanup query provided but not confirmed run)
- `pe_versions` localStorage key may still exist on some clients with old format (migration function handles this on load)
