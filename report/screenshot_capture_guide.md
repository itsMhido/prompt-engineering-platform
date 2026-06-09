# Screenshot and Figure Capture Guide

This file lists every image expected by `technical_project_report.tex`, the exact filename to use, and how to acquire it. Put all files under:

- `report/figures/diagrams/`
- `report/figures/screenshots/`

The LaTeX report compiles without these images by showing placeholders, but the final submission should include the images below.

## 1. Prepare Folders

From the repository root:

```powershell
New-Item -ItemType Directory -Force -Path report\figures\diagrams
New-Item -ItemType Directory -Force -Path report\figures\screenshots
```

## 2. Diagram Images

Source file: `project_diagrams.md`

Recommended acquisition methods:

1. Open `project_diagrams.md` in VS Code with a Mermaid preview extension, then export each diagram as PNG.
2. Or copy each Mermaid block into <https://mermaid.live>, choose a light background if preferred, and export as PNG.
3. Or use Mermaid CLI if available:

```powershell
npx -p @mermaid-js/mermaid-cli mmdc -i input.mmd -o output.png -b white -s 2
```

Use these exact filenames:

| Diagram | Required file | Source block |
|---|---|---|
| System Architecture | `report/figures/diagrams/diagram_01_system_architecture.png` | Diagram 1 |
| Deployment Diagram | `report/figures/diagrams/diagram_02_deployment.png` | Diagram 2 |
| Entity Relationship Diagram | `report/figures/diagrams/diagram_03_entity_relationship.png` | Diagram 3 |
| Use Case Diagram | `report/figures/diagrams/diagram_04_use_case.png` | Diagram 4 |
| Inference Sequence | `report/figures/diagrams/diagram_05_inference_sequence.png` | Diagram 5 |
| Auth Sequence | `report/figures/diagrams/diagram_06_auth_sequence.png` | Diagram 6 |
| Batch Scoring Sequence | `report/figures/diagrams/diagram_07_batch_scoring_sequence.png` | Diagram 7 |
| Prompt Lifecycle | `report/figures/diagrams/diagram_08_prompt_lifecycle.png` | Diagram 8 |
| Experiment State | `report/figures/diagrams/diagram_09_experiment_state.png` | Diagram 9 |
| API Endpoint Map | `report/figures/diagrams/diagram_10_api_endpoint_map.png` | Diagram 10 |
| Security Architecture | `report/figures/diagrams/diagram_11_security_architecture.png` | Diagram 11 |
| Frontend Navigation | `report/figures/diagrams/diagram_12_frontend_navigation.png` | Diagram 12 |
| Backend Components | `report/figures/diagrams/diagram_13_backend_components.png` | Diagram 13 |
| Data Flow DFD | `report/figures/diagrams/diagram_14_data_flow_dfd.png` | Diagram 14 |

## 3. Run the App for UI Screenshots

Backend:

- The frontend defaults to the Railway backend: `https://prompt-engineering-platform-production.up.railway.app`
- If using another backend, create `frontend\.env` with:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally:

```text
http://localhost:5173
```

Use a desktop viewport such as `1440x900` or `1920x1080`. Capture PNG screenshots at high resolution.

## 4. Demo Data Needed Before Screenshots

Create or prepare:

- One user account.
- At least two model configurations, ideally from different providers.
- One prompt named `Customer Support Assistant`.
- At least two prompt versions.
- One dataset with columns similar to `customer_issue`, `tone`, `customer_tier`, and `expected_output`.
- At least two named batch runs, produced by different models or prompt versions.
- AI scores for at least one batch.

Suggested customer support dataset rows:

| customer_issue | tone | customer_tier | expected_output |
|---|---|---|---|
| Order arrived damaged | Empathetic | Gold | Apologize, explain replacement/refund path, and ask for order ID/photos. |
| Cannot reset password | Clear | Standard | Provide reset steps and escalation path if email is not received. |
| Wants invoice copy | Professional | Business | Explain where to download invoice or offer to send one. |

Suggested prompt variables:

```text
You are a customer support assistant. Respond to a {customer_tier} customer.
Issue: {customer_issue}
Tone: {tone}
```

## 5. UI Screenshots

Use these exact filenames:

| Required file | Page or state | How to acquire |
|---|---|---|
| `report/figures/screenshots/01_landing_page.png` | Landing page | Log out, open `/`, capture the hero and first visible section. |
| `report/figures/screenshots/02_login_page.png` | Login page | Open `/login`, keep the Login tab active, capture the full form. |
| `report/figures/screenshots/03_models_page.png` | Models page | Log in, open Models, capture cards with at least one active model. |
| `report/figures/screenshots/04_prompts_library.png` | Prompts library | Open Prompts, capture at least one prompt card with tags/version count. |
| `report/figures/screenshots/05_prompt_studio.png` | Prompt Studio | Open `Customer Support Assistant`, show variables and an output preview. |
| `report/figures/screenshots/06_datasets_page.png` | Datasets page | Open Datasets, capture dataset cards or dataset table preview. |
| `report/figures/screenshots/07_experiments_page.png` | Experiments page | Open Experiments after several runs, show filters and populated table. |
| `report/figures/screenshots/08_evaluations_overview.png` | Evaluations overview | Open Evaluations > Overview, capture score/stat cards and tables. |
| `report/figures/screenshots/09_evaluations_comparison.png` | Evaluations comparison | Open Evaluations > Comparison, select two batch runs, capture side-by-side comparison. |
| `report/figures/screenshots/10_evaluations_batch_eval.png` | Batch eval | Open Evaluations > Batch Eval, capture either Existing Runs or Run New Batch with populated selectors. |
| `report/figures/screenshots/11_workspace_settings.png` | Workspace settings | Open Workspace Settings, capture profile, workspace name, and metrics section. |
| `report/figures/screenshots/12_demo_batch_comparison_two_models.png` | Final demo comparison | Select two named batches from different models or versions and capture winner indicators. |

## 6. Metrics to Record in the Report

The report includes a table for real measurements. During the demo, record:

- Model name.
- Prompt version.
- Latency in milliseconds.
- Input tokens.
- Output tokens.
- Total tokens.
- Cost estimate.
- Overall score.
- Per-metric scores: Relevance, Correctness, Fluency, Toxicity, and any custom metric.

Where to find them:

- Prompt Studio output preview shows latency/tokens/cost after a run.
- Experiments page shows logged runs, status, score, latency, tokens, and details.
- Evaluations overview shows aggregate statistics.
- Evaluations comparison shows batch-level averages and per-row winners.

## 7. LaTeX Compilation

From `report/`, compile with:

```powershell
pdflatex technical_project_report.tex
pdflatex technical_project_report.tex
```

Run twice so the table of contents, list of figures, and list of tables are updated.

Before submission, fill these placeholders in `technical_project_report.tex`:

- `\StudentName`
- `\StudentId`
- `\SupervisorName`
- `\GitHubUrl`
- Demo metrics table values
