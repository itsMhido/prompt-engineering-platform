# Project Diagrams

### Diagram 1 — System Architecture
This diagram shows the high-level system architecture, depicting how the frontend, backend, database, and third-party AI providers interact.

```mermaid
graph TD
    Browser[Browser] -->|HTTPS| FastAPI[FastAPI API on Railway]
    GitHub[GitHub] -.->|Auto-deploy| FastAPI
    FastAPI -->|PostgreSQL| Supabase[(Supabase Database)]
    
    subgraph "AI Providers"
        Anthropic[Anthropic]
        OpenAI[OpenAI]
        Google[Google]
        Groq[Groq]
        Mistral[Mistral]
        HuggingFace[HuggingFace]
    end
    
    FastAPI -->|API Calls| Anthropic
    FastAPI -->|API Calls| OpenAI
    FastAPI -->|API Calls| Google
    FastAPI -->|API Calls| Groq
    FastAPI -->|API Calls| Mistral
    FastAPI -->|API Calls| HuggingFace
```

### Diagram 2 — Deployment Diagram
This diagram outlines the deployment strategy, moving from the developer's local environment through GitHub to the production environment on Railway and Supabase.

```mermaid
graph LR
    subgraph "Developer Machine"
        VSCode[VS Code]
        DevServer[npm dev server: port 5173]
        LocalEnv[.env file]
    end
    
    subgraph "GitHub"
        GitHubRepo[GitHub Repo]
    end
    
    subgraph "Railway Platform"
        RailwayEnv[Railway Environment Variables]
        RailwayApp[FastAPI App: port 8000]
    end
    
    subgraph "Supabase Cloud"
        SupabaseDB[(PostgreSQL: port 5432)]
    end

    VSCode -->|Push| GitHubRepo
    DevServer -->|API calls| RailwayApp
    LocalEnv -.-> DevServer
    GitHubRepo -->|Auto-deploy| RailwayApp
    RailwayEnv -.-> RailwayApp
    RailwayApp -->|TCP/SSL connection| SupabaseDB
```

### Diagram 3 — Entity Relationship Diagram
This diagram describes the core database schema, outlining all 10 major tables, their key columns, and their cardinality.

```mermaid
erDiagram
    users {
        UUID id PK
        string email
        string password_hash
        timestamp created_at
    }
    workspaces {
        UUID id PK
        string name
        UUID owner_id FK
        timestamp created_at
    }
    workspace_members {
        UUID id PK
        UUID workspace_id FK
        UUID user_id FK
        string role
    }
    models {
        UUID id PK
        UUID workspace_id FK
        string name
        string provider
        string api_key_encrypted
    }
    prompts {
        UUID id PK
        UUID workspace_id FK
        string name
        timestamp created_at
    }
    prompt_versions {
        UUID id PK
        UUID prompt_id FK
        string version_number
        string template
        JSONB parameters
    }
    datasets {
        UUID id PK
        UUID workspace_id FK
        string name
        string[] columns
    }
    dataset_rows {
        UUID id PK
        UUID dataset_id FK
        int row_index
        JSONB row_data
    }
    experiments {
        UUID id PK
        UUID workspace_id FK
        UUID prompt_id FK
        UUID prompt_version_id FK
        UUID model_id FK
        string output
        float score
        string status
    }
    evaluation_metrics {
        UUID id PK
        UUID workspace_id FK
        string name
        string description
        boolean is_inverse
    }

    users ||--o{ workspaces : owns
    users ||--o{ workspace_members : belongs_to
    workspaces ||--o{ workspace_members : contains
    workspaces ||--o{ models : has
    workspaces ||--o{ prompts : has
    workspaces ||--o{ datasets : has
    workspaces ||--o{ evaluation_metrics : configures
    prompts ||--o{ prompt_versions : contains
    datasets ||--o{ dataset_rows : contains
    workspaces ||--o{ experiments : records
    prompts ||--o{ experiments : tested_in
    prompt_versions ||--o{ experiments : tested_in
    models ||--o{ experiments : executed_with
```

### Diagram 4 — Use Case Diagram
This diagram outlines the primary workflows available to an authenticated user within the prompt engineering platform.

```mermaid
graph TD
    User([Authenticated User])
    
    subgraph "Manage Models"
        AddMod[Add Model]
        EditMod[Edit Model]
        DelMod[Delete Model]
        ValMod[Validate API Key]
    end
    
    subgraph "Manage Prompts"
        CrePrm[Create Prompt]
        VerPrm[Version Prompt]
        SavPrm[Save Prompt]
        ComPrm[Commit Prompt]
    end
    
    subgraph "Run Inference"
        RunSgl[Single Run]
        RunBch[Batch Run]
    end
    
    subgraph "Manage Datasets"
        CreDat[Create Dataset]
        ImpDat[Import CSV/JSON]
        EdiDat[Edit Rows]
    end
    
    subgraph "Track Experiments"
        VwExp[View Experiments]
        FltExp[Filter Experiments]
        CmpExp[Compare Experiments]
        ExpExp[Export Experiments]
    end
    
    subgraph "Evaluate Outputs"
        ScrAI[Score with AI]
        CusMet[Custom Metrics]
        CmpBch[Compare Batches]
    end
    
    subgraph "Manage Settings"
        WsNam[Workspace Name]
        CusSet[Custom Metrics Settings]
        PrfSet[Profile Settings]
    end

    User --> AddMod
    User --> EditMod
    User --> DelMod
    User --> ValMod

    User --> CrePrm
    User --> VerPrm
    User --> SavPrm
    User --> ComPrm

    User --> RunSgl
    User --> RunBch

    User --> CreDat
    User --> ImpDat
    User --> EdiDat

    User --> VwExp
    User --> FltExp
    User --> CmpExp
    User --> ExpExp

    User --> ScrAI
    User --> CusMet
    User --> CmpBch

    User --> WsNam
    User --> CusSet
    User --> PrfSet
```

### Diagram 5 — Sequence Diagram: Inference Flow
This sequence diagram walks through the process of running a single inference call from the browser through the API to the external AI provider.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant FastAPI
    participant ai_router
    participant AIProvider
    participant Database

    User->>Frontend: Clicks Run Prompt
    Frontend->>FastAPI: POST /api/inference/run with JWT token
    FastAPI->>FastAPI: Validates JWT
    FastAPI->>Database: Loads model from DB
    Database-->>FastAPI: Model data (encrypted API key)
    FastAPI->>FastAPI: Decrypts API key
    FastAPI->>ai_router: call_provider()
    ai_router->>AIProvider: Request with provider format
    AIProvider-->>ai_router: Returns response
    ai_router-->>FastAPI: Normalized response
    FastAPI->>Database: Logs experiment to DB
    Database-->>FastAPI: Experiment saved
    FastAPI-->>Frontend: Returns output + experiment
    Frontend->>User: Updates UI
```

### Diagram 6 — Sequence Diagram: Auth Flow
This diagram illustrates the user registration and login flows, including workspace and default metric creation during signup, and the protected route authentication mechanism.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant FastAPI
    participant Database

    %% Register Flow
    User->>Frontend: Form submit (Register)
    Frontend->>FastAPI: POST /api/auth/register
    FastAPI->>FastAPI: Hash password
    FastAPI->>Database: Create user
    Database-->>FastAPI: User created
    FastAPI->>Database: Create workspace
    Database-->>FastAPI: Workspace created
    FastAPI->>Database: Seed default metrics
    Database-->>FastAPI: Metrics seeded
    FastAPI-->>Frontend: Return JWT

    %% Login Flow
    User->>Frontend: Form submit (Login)
    Frontend->>FastAPI: POST /api/auth/login
    FastAPI->>FastAPI: Verify password
    FastAPI-->>Frontend: Return JWT

    %% Protected Request
    Frontend->>FastAPI: Request with Bearer token
    FastAPI->>FastAPI: Decode JWT
    FastAPI->>Database: Load user
    Database-->>FastAPI: User data
    FastAPI-->>Frontend: Return data
```

### Diagram 7 — Sequence Diagram: Batch AI Scoring
This diagram models the asynchronous workflow of scoring a batch of experiments using an AI background task with frontend polling.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant FastAPI
    participant BackgroundTask
    participant AIProvider
    participant Database

    User->>Frontend: Clicks Score All with AI
    Frontend->>FastAPI: POST /api/evaluations/score-batch
    FastAPI->>BackgroundTask: Spawns BackgroundTask
    FastAPI-->>Frontend: Gets jobId

    loop Polling (Every 3s)
        Frontend->>FastAPI: GET /api/evaluations/score-batch/{jobId}
        FastAPI-->>Frontend: Progress { completed, total, status }
    end
    
    loop Evaluation Loop
        BackgroundTask->>BackgroundTask: Build prompt
        BackgroundTask->>AIProvider: Call AIProvider
        AIProvider-->>BackgroundTask: Return response
        BackgroundTask->>BackgroundTask: Parse response
        BackgroundTask->>Database: Save scores to DB
    end

    User->>Frontend: User navigates away
    Note over Frontend, FastAPI: Polling stops
    Note over BackgroundTask, Database: BackgroundTask continues on Railway

    User->>Frontend: User returns
    Frontend->>FastAPI: GET /api/evaluations/score-batch/{jobId}
    FastAPI-->>Frontend: Sees updated progress
    
    Note over BackgroundTask: BackgroundTask completes
    BackgroundTask->>Database: Update status = "completed"
    
    Frontend->>FastAPI: GET /api/evaluations/score-batch/{jobId}
    FastAPI-->>Frontend: Progress { completed, total, status: "completed" }
```

### Diagram 8 — Activity Diagram: Prompt Lifecycle
This diagram visualizes the states a prompt traverses throughout its lifetime, distinguishing between autosaving drafts and explicitly committing new versions.

```mermaid
stateDiagram-v2
    [*] --> Created : empty v1
    Created --> Editing : draft autosaved
    Editing --> Saved : v1 updated in place
    Saved --> Editing : edit
    Editing --> Committed : v2 created
    Saved --> Committed : v2 created
    Committed --> Editing : edit v2
    Saved --> Running : inference called
    Committed --> Running : inference called
    Running --> ExperimentLogged
    ExperimentLogged --> Evaluated : AI scored
    Evaluated --> [*]
```

### Diagram 9 — State Diagram: Experiment
This diagram shows how experiments transition from running through to being fully scored, including edge cases like partial scoring or rescoring.

```mermaid
stateDiagram-v2
    [*] --> Running
    Running --> Success : inference call completes
    Running --> Error : inference call completes
    Success --> Unscored
    Unscored --> PartiallyScored : Score button clicked
    Unscored --> FullyScored : Score button clicked
    PartiallyScored --> FullyScored : Score button clicked
    FullyScored --> PartiallyScored : Rescore clicked
    PartiallyScored --> PartiallyScored : Rescore clicked
```

### Diagram 10 — API Endpoint Map
This diagram maps out the structure of the FastAPI application by logically grouping endpoints under their respective router subgraphs.

```mermaid
graph TD
    subgraph "Auth"
        A_Reg[/register]
        A_Log[/login]
        A_Me[GET /me]
        A_MeP[PATCH /me]
    end

    subgraph "Models"
        M_CRUD[GET/POST/PATCH/DELETE]
        M_Val[/validate]
    end

    subgraph "Prompts"
        P_CRUD[GET/POST/PATCH/DELETE]
        P_Dup[/duplicate]
        P_Ver[GET/POST/PATCH /versions]
    end

    subgraph "Datasets"
        D_CRUD[GET/POST/PUT/DELETE]
        D_Imp[/import]
    end

    subgraph "Experiments"
        E_CRUD[GET/POST/PATCH/DELETE]
        E_Bulk[/bulk-delete]
        E_Batch[GET/PATCH /batches]
    end

    subgraph "Inference"
        I_Run[/run]
    end

    subgraph "Evaluations"
        Ev_Sco[/score]
        Ev_ScoB_P[POST /score-batch]
        Ev_ScoB_G[GET /score-batch]
        Ev_ScoB_C[POST /score-batch/cancel]
        Ev_BchR[/batch-run]
    end

    subgraph "Metrics"
        Met_CRUD[GET/POST/PATCH/DELETE]
    end
```

### Diagram 11 — Security Architecture
This diagram traces the flow of sensitive data, demonstrating how API keys are encrypted at rest and dynamically decrypted for inference without ever leaving the server.

```mermaid
graph LR
    User[User submits plaintext key] -->|HTTPS| FastAPI[FastAPI receives]
    FastAPI -->|Fernet.encrypt| DB[(Stored as api_key_encrypted in DB)]
    
    DB -->|Fetch| FastAPI_Inf[At inference time]
    FastAPI_Inf -->|Fernet.decrypt| ProviderCall[httpx call to Provider]
    ProviderCall -->|key never leaves server| AIProvider[AI Provider]
    
    subgraph "Railway Environment"
        FastAPI
        FastAPI_Inf
        ProviderCall
        SECRET_KEY[SECRET_KEY]
    end
    
    JWT[JWT flow] -.-> SECRET_KEY
    CORS[CORS boundary] -.->|only allowed| localhost[localhost:5173]
    CORS -.->|only allowed| RailwayURL[Railway URL]
```

### Diagram 12 — Frontend Page Navigation
This diagram provides a sitemap of the React frontend application, illustrating exactly how a user navigates between the various views.

```mermaid
graph TD
    Landing[LandingPage] -->|unauthenticated| Auth[AuthPage]
    Auth -->|Login/Register tabs| Auth
    Auth -->|on success| App[App Shell]
    
    subgraph "App Sidebar"
        Models[Models]
        Datasets[Datasets]
        Prompts[Prompts]
        Experiments[Experiments]
        Evaluations[Evaluations]
        Workspaces[WorkspaceSettings]
    end
    
    App --> Models
    App --> Datasets
    App --> Prompts
    App --> Experiments
    App --> Evaluations
    App --> Workspaces
    
    Prompts --> PStudio[PromptStudio scoped to prompt]
    PStudio -->|breadcrumb| Prompts
    
    App -->|Logo click| Landing
    App -->|Profile dropdown > Sign Out| Landing
    App -->|Profile dropdown > WorkspaceSettings| Workspaces
```

### Diagram 13 — Component Diagram: Backend
This diagram maps out the internal dependencies inside the backend, showing how FastAPI routers depend on utility services and data models.

```mermaid
graph TD
    Main[main.py entry point]
    
    subgraph "Routers"
        R_Auth[auth router]
        R_Models[models router]
        R_Prompts[prompts router]
        R_Datasets[datasets router]
        R_Exp[experiments router]
        R_Inf[inference router]
        R_Eval[evaluations router]
        R_Met[metrics router]
    end
    
    Main --> R_Auth
    Main --> R_Models
    Main --> R_Prompts
    Main --> R_Datasets
    Main --> R_Exp
    Main --> R_Inf
    Main --> R_Eval
    Main --> R_Met
    
    subgraph "Services"
        S_AI[ai_router]
        S_Cry[crypto]
        S_Cos[cost]
        S_Ret[retry]
    end
    
    subgraph "Models"
        M_Usr[User]
        M_Wks[Workspace]
        M_Mod[Model]
        M_Prm[Prompt]
        M_PrV[PromptVersion]
        M_Dat[Dataset]
        M_DtR[DatasetRow]
        M_Exp[Experiment]
        M_EvM[EvaluationMetric]
    end
    
    R_Auth --> M_Usr
    R_Auth --> M_Wks
    R_Models --> M_Mod
    R_Models --> S_Cry
    R_Prompts --> M_Prm
    R_Prompts --> M_PrV
    R_Datasets --> M_Dat
    R_Datasets --> M_DtR
    R_Exp --> M_Exp
    R_Inf --> S_AI
    R_Inf --> S_Cos
    R_Inf --> M_Exp
    R_Eval --> S_AI
    R_Eval --> S_Ret
    R_Eval --> M_EvM
```

### Diagram 14 — Data Flow Diagram Level 1
This high-level data flow diagram defines the exchange of entities between the major architectural processes and the underlying data stores.

```mermaid
graph TD
    subgraph "Major Processes"
        AuthProc(Authentication)
        PromProc(Prompt Management)
        InfProc(Inference Engine)
        EvalProc(Evaluation Engine)
    end
    
    subgraph "Data Stores"
        UsersDB[(Users DB)]
        PromptsDB[(Prompts DB)]
        ExpDB[(Experiments DB)]
        DataDB[(Datasets DB)]
    end
    
    AuthProc -->|JWT token| PromProc
    AuthProc -->|JWT token| InfProc
    AuthProc -->|JWT token| EvalProc
    
    AuthProc -->|User data| UsersDB
    PromProc -->|Prompts & versions| PromptsDB
    
    InfProc -->|Fetch prompt| PromptsDB
    InfProc -->|encrypted API key| UsersDB
    InfProc -->|experiment record| ExpDB
    
    EvalProc -->|Fetch experiment| ExpDB
    EvalProc -->|score results| ExpDB
    
    PromProc -->|Link datasets| DataDB
    InfProc -->|Fetch dataset rows| DataDB
```
