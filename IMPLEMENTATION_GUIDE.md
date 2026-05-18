# Experiments & Datasets Implementation Guide

## Overview
Completed implementation of Experiments and Datasets endpoints with full CRUD operations, filtering, and workspace isolation.

## API Endpoints Summary

### Experiments (`/api/experiments`)

#### GET /api/experiments
List all experiments with advanced filtering
```bash
Query Parameters:
  search?: str          # Search prompt_name, output, variable_values
  provider?: str        # Filter by provider
  promptId?: str        # Filter by prompt_id
  promptVersion?: str   # Filter by version string (e.g., "v3")
  status?: str          # "success" | "error"
  dateRange?: str       # "today" | "week" | "month" | "all"
  datasetId?: str       # Filter by dataset_id
  sortField?: str       # Default: "created_at"
  sortDir?: str         # "asc" | "desc", default: "desc"

# Example
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/experiments?status=success&dateRange=week&sortDir=asc"
```

#### POST /api/experiments
Manually log an experiment
```json
{
  "workspaceId": "uuid",
  "promptId": "uuid",
  "promptVersionId": "uuid",
  "modelId": "uuid",
  "promptName": "Medical QA",
  "promptVersion": "v3",
  "provider": "OpenAI",
  "output": "The diagnosis is...",
  "score": 87.5,
  "status": "success",
  "tags": ["reviewed", "medical"],
  "notes": "Good response"
}
```

#### PATCH /api/experiments/:experimentId
Update experiment fields (score, notes, tags, scores, reasoning)
```json
{
  "score": 92.0,
  "notes": "Updated notes",
  "tags": ["tag1", "tag2"],
  "scores": {
    "Relevance": 90,
    "Correctness": 85
  },
  "reasoning": {
    "Relevance": "The response addresses..."
  }
}
```

#### DELETE /api/experiments/:experimentId
Delete a single experiment
```bash
curl -X DELETE -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/experiments/{experimentId}"
```

#### POST /api/experiments/bulk-delete
Delete multiple experiments at once
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

---

### Datasets (`/api/datasets`)

#### GET /api/datasets
List all datasets with filtering
```bash
Query Parameters:
  search?: str      # Filter by dataset name
  category?: str    # Filter by category

# Example
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/datasets?category=QA&search=medical"
```

Response includes `rowCount` (derived from dataset_rows count), but NOT the full rows

#### POST /api/datasets
Create a new dataset with rows
```json
{
  "name": "Medical QA Dataset",
  "category": "QA",
  "version": "v1",
  "columns": ["symptom_1", "symptom_2", "age", "expected_output"],
  "rows": [
    { "symptom_1": "fever", "symptom_2": "cough", "age": "34", "expected_output": "flu" },
    { "symptom_1": "headache", "symptom_2": "nausea", "age": "28", "expected_output": "migraine" }
  ]
}
```

Each row is stored as a separate record in `dataset_rows` with a `row_index`.

#### GET /api/datasets/:datasetId
Get full dataset including all rows
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/datasets/{datasetId}"

# Response includes full "rows" array
```

#### PUT /api/datasets/:datasetId
Update dataset (optionally replace all rows)
```json
{
  "name": "Updated Name",
  "category": "QA v2",
  "version": "v2",
  "columns": ["col1", "col2", "col3"],
  "rows": [
    { "col1": "new_val1", "col2": "new_val2", "col3": "new_val3" }
  ]
}
```

If `rows` is provided, all existing rows are deleted and replaced.

#### DELETE /api/datasets/:datasetId
Delete a dataset (cascades to dataset_rows)
```bash
curl -X DELETE -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/datasets/{datasetId}"
```

#### POST /api/datasets/import
Import a dataset (same as POST /api/datasets)
```bash
# Frontend parses file, sends structured request (same as POST)
```

---

## Testing Checklist

### Prerequisites
1. Backend running: `python -m uvicorn app.main:app --reload --port 8000`
2. Valid JWT token from `POST /api/auth/login`
3. User has a workspace (created via WorkspaceMember)

### Experiments Testing

- [ ] **GET /api/experiments** - List all experiments
- [ ] **GET /api/experiments?status=error** - Filter by status
- [ ] **GET /api/experiments?dateRange=week** - Filter by date range
- [ ] **GET /api/experiments?search=fever** - Full-text search
- [ ] **POST /api/experiments** - Create manual experiment
- [ ] **PATCH /api/experiments/:id** - Update score/notes/tags
- [ ] **DELETE /api/experiments/:id** - Delete single
- [ ] **POST /api/experiments/bulk-delete** - Delete multiple

### Datasets Testing

- [ ] **GET /api/datasets** - List all datasets
- [ ] **GET /api/datasets?search=medical** - Filter by name
- [ ] **POST /api/datasets** - Create with rows
- [ ] **GET /api/datasets/:id** - Retrieve full dataset with rows
- [ ] **PUT /api/datasets/:id** - Update dataset name/version
- [ ] **PUT /api/datasets/:id** with `rows` - Replace all rows
- [ ] **DELETE /api/datasets/:id** - Delete dataset
- [ ] **POST /api/datasets/import** - Import dataset (alias test)

### Workspace Isolation

- [ ] User in Workspace A cannot access Workspace B experiments
- [ ] Attempting to create experiment in different workspace returns 403
- [ ] Attempting to access non-existent experiment returns 404

---

## Response Format Examples

### Experiment Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "workspaceId": "550e8400-e29b-41d4-a716-446655440001",
  "promptId": "550e8400-e29b-41d4-a716-446655440002",
  "promptVersionId": "550e8400-e29b-41d4-a716-446655440003",
  "modelId": "550e8400-e29b-41d4-a716-446655440004",
  "promptName": "Medical Diagnostics",
  "promptVersion": "v3",
  "provider": "OpenAI",
  "output": "Based on symptoms, possible diagnosis is...",
  "latencyMs": 847,
  "inputTokens": 120,
  "outputTokens": 212,
  "totalTokens": 332,
  "costEstimate": 0.004,
  "status": "success",
  "score": 87.5,
  "scores": {
    "Relevance": 90,
    "Correctness": 85
  },
  "reasoning": {
    "Relevance": "Addresses symptoms directly"
  },
  "tags": ["reviewed", "medical"],
  "notes": "Good response quality",
  "createdAt": "2026-05-18T10:30:00+00:00"
}
```

### Dataset List Response
```json
{
  "datasets": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Medical QA Dataset",
      "category": "QA",
      "version": "v1",
      "columns": ["symptom_1", "symptom_2", "age", "expected_output"],
      "rowCount": 2,
      "createdAt": "2026-05-18T10:00:00+00:00",
      "updatedAt": "2026-05-18T10:30:00+00:00"
    }
  ]
}
```

### Dataset Full Response (with rows)
```json
{
  "dataset": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Medical QA Dataset",
    "category": "QA",
    "version": "v1",
    "columns": ["symptom_1", "symptom_2", "age", "expected_output"],
    "rows": [
      { "symptom_1": "fever", "symptom_2": "cough", "age": "34", "expected_output": "flu" },
      { "symptom_1": "headache", "symptom_2": "nausea", "age": "28", "expected_output": "migraine" }
    ],
    "rowCount": 2,
    "createdAt": "2026-05-18T10:00:00+00:00",
    "updatedAt": "2026-05-18T10:30:00+00:00"
  }
}
```

---

## Implementation Details

### Key Features

1. **Filtering & Search**
   - Experiments: Full-text search on `prompt_name`, `output`, `variable_values` (JSONB)
   - Datasets: Substring search on `name`
   - Both use ILIKE for case-insensitive matching

2. **Date Range Filtering**
   - `"today"` → from start of today
   - `"week"` → last 7 days
   - `"month"` → last 30 days
   - `"all"` → no filter

3. **Sorting**
   - Experiments: Sort by any column (default: `created_at` DESC)
   - Datasets: Sort by `updated_at` DESC

4. **Workspace Isolation**
   - All queries filtered by `workspace_id`
   - Workspace obtained from current user's WorkspaceMember record
   - 403 Forbidden if attempting cross-workspace operations

5. **Data Integrity**
   - Dataset rows stored separately in `dataset_rows` table
   - `row_index` maintains insertion order
   - Cascade delete when dataset deleted
   - Row replacement via PUT fully replaces rows (delete old, insert new)

---

## Database Schema Reference

### Experiments Table
```sql
CREATE TABLE experiments (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  prompt_id UUID REFERENCES prompts(id),
  prompt_version_id UUID REFERENCES prompt_versions(id),
  model_id UUID REFERENCES models(id),
  dataset_id UUID REFERENCES datasets(id),
  prompt_name TEXT,
  prompt_version TEXT,  -- e.g., 'v3'
  provider TEXT,
  output TEXT,
  status TEXT DEFAULT 'success',  -- 'success' | 'error'
  score FLOAT,
  scores JSONB DEFAULT '{}',
  reasoning JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Datasets Table
```sql
CREATE TABLE datasets (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Custom',
  version TEXT DEFAULT 'v1',
  columns TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dataset_rows (
  id UUID PRIMARY KEY,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  row_data JSONB NOT NULL
);
```

---

## Next Steps

1. ✅ Implement Experiments endpoints
2. ✅ Implement Datasets endpoints
3. Test with curl/Postman
4. Integrate with frontend forms
5. Add batch evaluation (`/api/evaluations/batch-run`)
6. Add inference logging auto-capture
