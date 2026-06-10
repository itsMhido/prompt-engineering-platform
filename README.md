# Prompt_Env - Prompt Engineering Platform

Prompt_Env is a full-stack prompt engineering platform for creating, versioning, testing, evaluating, and comparing prompts across multiple AI providers.

The backend is already deployed on Railway:

```text
https://prompt-engineering-platform-production.up.railway.app
```

This Railway deployment is expected to remain available until 18/06/2027.

For normal use, you only need to run the frontend locally. The local React app will connect to the deployed Railway backend by default.

## What the Platform Does

Prompt_Env lets users:

- Register and log in to a workspace.
- Register AI models from providers such as OpenAI, Anthropic, Google Gemini, Groq, Mistral, HuggingFace, or custom OpenAI-compatible endpoints.
- Create prompts with system prompts, user templates, variables, tags, and descriptions.
- Save prompt edits or commit new prompt versions.
- Run prompts against selected models.
- Create and import datasets.
- Run batch evaluations across dataset rows.
- Store every run as an experiment.
- Score outputs using AI-based evaluation metrics.
- Compare batch runs across models or prompt versions.

## Tech Stack

### Frontend

- React 18
- Vite
- Custom CSS / Tailwind-style utility classes
- Browser `localStorage` for auth/session snapshots and prompt drafts

### Backend

- FastAPI
- SQLAlchemy
- Pydantic
- Alembic
- JWT authentication
- bcrypt password hashing
- Fernet API key encryption
- httpx for AI provider calls

### Database and Deployment

- Supabase PostgreSQL
- Railway backend deployment
- Dockerfile-based backend service

## Project Structure

```text
prompt-engineering-platform/
  backend/
    app/
      core/              # Auth, config, security helpers
      models/            # SQLAlchemy database models
      routers/           # FastAPI route groups
      schemas/           # Pydantic request/response schemas
      services/          # AI router, encryption, retry, cost, logging
      main.py            # FastAPI app entrypoint
    alembic/             # Database migrations
    Dockerfile
    requirements.txt

  frontend/
    src/
      components/        # Sidebar, top bar, shared UI pieces
      pages/             # Main app pages
      utils/             # API client, auth helpers, constants
      App.jsx            # App shell and view routing
    package.json
    vite.config.js

  report/                # LaTeX project report and screenshot guide
```

## Prerequisites

Install these before running the project:

- Node.js 18 or newer
- npm
- Git

You do not need to install Python, PostgreSQL, Docker, or backend dependencies if you only want to use the app with the deployed Railway backend.

## Download the Project

Clone the repository:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd prompt-engineering-platform
```

If you downloaded the project as a ZIP file, extract it and open a terminal inside the extracted `prompt-engineering-platform` folder.

## Run the Frontend Locally

Go to the frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173
```

Open that URL in your browser.

## Backend Connection

The frontend is configured to use the deployed Railway backend by default:

```text
https://prompt-engineering-platform-production.up.railway.app
```

Deployment availability note: this Railway backend is expected to expire on 18/06/2027.

You usually do not need to create a `.env` file.

If you want to override the backend URL, create `frontend/.env`:

```env
VITE_API_BASE_URL=https://prompt-engineering-platform-production.up.railway.app
```

Then restart the frontend dev server.

## Check Backend Health

You can verify that the backend is online by opening:

```text
https://prompt-engineering-platform-production.up.railway.app/health
```

Expected response:

```json
{
  "status": "ok"
}
```

Railway free-tier services may take a few seconds to wake up after inactivity.

## How to Use the Platform

This section walks through the full workflow from account creation to evaluation.

### 1. Open the App

Start the frontend with:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

You will see the landing page.

### 2. Create an Account or Log In

Click the login/register call-to-action.

To create a new account:

1. Open the Register tab.
2. Enter your name, email, and password.
3. Submit the form.

After registration, the backend automatically creates a workspace for your account and seeds default evaluation metrics:

- Relevance
- Correctness
- Fluency
- Toxicity

If you already have an account, use the Login tab.

### 3. Register an AI Model

Before running prompts, add at least one model.

1. Go to the Models page.
2. Click Add Model.
3. Choose a provider.
4. Enter the model name and model ID.
5. Enter the provider endpoint if required.
6. Paste your provider API key.
7. Adjust parameters such as temperature, max tokens, and top-p if needed.
8. Save the model.

The backend encrypts the API key before storing it. The key is never returned to the frontend in plaintext after saving.

Example model IDs:

```text
OpenAI: gpt-4o-mini
Anthropic: claude-3-5-sonnet-latest
Google: gemini-1.5-flash
Groq: llama-3.1-8b-instant
Mistral: mistral-small-latest
```

Use model IDs and endpoints supported by your own provider account.

### 4. Create a Prompt

1. Go to the Prompts page.
2. Click New Prompt.
3. Enter a name, description, and optional tags.
4. Create the prompt.

The app creates an initial version automatically.

### 5. Edit the Prompt in Prompt Studio

Click the prompt to open Prompt Studio.

Prompt Studio has three main areas:

- Version sidebar
- Prompt editor
- Output preview

You can edit:

- System prompt
- User template
- Variable values
- Selected model

Example user template:

```text
Write a helpful customer support response.

Customer issue:
{customer_issue}

Tone:
{tone}
```

Variables are written with curly braces, such as:

```text
{customer_issue}
{tone}
{product_name}
```

The app detects these variables and shows input fields for them.

### 6. Save or Commit Prompt Versions

Prompt Studio supports two versioning actions:

- Save: updates the current version in place.
- Commit: creates a new version with a commit message.

Use Save for small edits while working.

Use Commit when the prompt reaches a meaningful checkpoint, for example:

```text
Improved support tone and added refund instructions
```

This keeps prompt history clean and avoids creating a new version for every minor edit.

### 7. Run a Single Prompt

1. Select a registered model.
2. Fill the variable values.
3. Click Run Prompt.

The frontend sends the request to the backend.

The backend:

1. Validates your JWT token.
2. Loads the selected model.
3. Decrypts the provider API key server-side.
4. Calls the external AI provider.
5. Saves the result as an experiment.
6. Returns the output to the frontend.

The output appears in Prompt Studio.

### 8. View Experiments

Go to the Experiments page.

Each prompt run is stored as an experiment with:

- Prompt name
- Prompt version
- Model
- Provider
- Output
- Status
- Latency
- Token counts
- Cost estimate
- Scores
- Notes
- Tags

You can filter, sort, inspect, update, export, or delete experiments.

### 9. Create or Import a Dataset

Datasets let you test prompts against multiple rows.

Go to the Datasets page.

You can:

- Create a dataset manually.
- Import a CSV file.
- Import JSON data.
- Edit rows in a spreadsheet-like table.
- Export datasets as CSV or JSON.

Example dataset columns:

```text
customer_issue
tone
expected_output
```

Example row:

```text
customer_issue: My order arrived damaged
tone: Empathetic
expected_output: Apologize, ask for order details, and explain replacement steps.
```

### 10. Run Batch Evaluation

Go to Evaluations, then open the Batch Eval tab.

To run a new batch:

1. Select a dataset.
2. Select a prompt.
3. Select a prompt version.
4. Select a model.
5. Map prompt variables to dataset columns.
6. Optionally set a row limit.
7. Optionally enter a batch name.
8. Start the batch run.

The backend runs the prompt for each dataset row and saves each output as an experiment.

All experiments from the same batch share a `batch_id`, which allows the platform to compare batches later.

### 11. Score Outputs With AI

After creating experiments, you can score them.

You can score:

- One experiment from the Experiments page.
- A full batch from the Evaluations page.

The AI scoring system uses the workspace evaluation metrics.

Default metrics:

- Relevance
- Correctness
- Fluency
- Toxicity

The backend builds a scoring prompt, calls the selected scorer model, parses the returned scores, and saves the results to the experiment.

For batch scoring:

1. Select a batch.
2. Choose a scorer model.
3. Select metrics.
4. Start scoring.

The backend runs scoring as a background task and the frontend polls progress.

### 12. Compare Batch Runs

Go to Evaluations, then open the Comparison tab.

1. Select Batch A.
2. Select Batch B.
3. Compare outputs row by row.

This is useful for comparing:

- Two different models.
- Two prompt versions.
- Two different prompt strategies.

The comparison view shows batch-level summaries, row-level outputs, scores, and winner indicators.

### 13. Manage Evaluation Metrics

Go to Workspace Settings.

In the Evaluation Metrics section, you can:

- View default metrics.
- Add custom metrics.
- Edit metric descriptions.
- Mark metrics as lower-is-better.
- Delete custom metrics when allowed.

Custom metrics are included in AI scoring prompts.

Example custom metric:

```text
Name: Professionalism
Description: Does the response sound polite, clear, and appropriate for a customer support context?
```

### 14. Update Workspace or Profile

In Workspace Settings, you can also:

- Rename the workspace.
- Update your display name.
- Sign out.

## Recommended Demo Flow

For a presentation or demo, use this sequence:

1. Register or log in.
2. Show the Models page with at least one configured model.
3. Create or open a prompt.
4. Show variables in Prompt Studio.
5. Run the prompt once.
6. Open Experiments and show the saved run.
7. Create or open a dataset.
8. Run a batch evaluation.
9. Score the batch with AI.
10. Compare two batch runs.

## Security Features

The platform includes several security measures:

- Passwords are hashed with bcrypt.
- JWT tokens authenticate protected API requests.
- Provider API keys are encrypted with Fernet before storage.
- API keys are never returned to the frontend in plaintext.
- CORS is restricted to configured origins.
- Authentication endpoints are rate-limited.
- Provider endpoint URLs are validated to reduce SSRF risk.
- Custom metric text is sanitized before being inserted into scoring prompts.

## Common Issues

### Backend takes time to respond

The Railway backend may sleep after inactivity. Wait a few seconds and refresh the page.

You can also open:

```text
https://prompt-engineering-platform-production.up.railway.app/health
```

### Frontend cannot connect to backend

Check that `VITE_API_BASE_URL` is correct if you created `frontend/.env`.

If no `.env` file exists, the frontend uses the deployed Railway backend by default.

### AI provider call fails

Check:

- The API key is valid.
- The model ID is correct.
- The endpoint matches the provider.
- The provider account has enough quota.
- The model is active in the Models page.

### Batch scoring is slow

Batch scoring depends on:

- Number of experiments.
- Selected scorer model.
- Provider rate limits.
- Output length.

The backend continues the scoring job while the frontend polls progress.

## Optional: Backend Development

The backend is already deployed, so this is not required for normal use.

If you want to run the backend locally, you need:

- Python 3.11 or newer
- PostgreSQL connection string
- Supabase credentials
- Fernet encryption key
- JWT secret key

Install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env` with the required variables:

```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
SECRET_KEY=...
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ENCRYPTION_KEY=...
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173
```

Run migrations:

```bash
alembic upgrade head
```

Start the backend:

```bash
uvicorn app.main:app --reload
```

Then set the frontend backend URL:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Useful Commands

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
```

Backend, only if running locally:

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

## License

This project was built as an academic full-stack prompt engineering platform.
