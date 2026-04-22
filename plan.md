# Prompt Engineering Platform Implementation Plan

## Overview
This plan outlines the implementation of two core feature modules for the Prompt Engineering Platform: **Model Management** and **Prompt Studio**. Both modules will be fully functional, adhering to the existing design system (warm dark theme, amber accents, IBM Plex fonts, no neon), and built using React with localStorage for persistence and direct API calls for model inference. No backend is required.

## Module 1: Model Management
### Features
- **Card Grid UI**: Displays models in a grid with provider chips, parameter sliders, status badges, and actions (edit/duplicate/delete).
- **Add/Edit Model Modal**: Includes fields for Model Name, Provider (dropdown with pre-fills), Model ID, Base URL, API Key (password input, toggleable visibility, masked after save), Temperature, Max Tokens, Top P, Stop Sequences, and Status toggle.
- **API Key Management**: Keys stored in localStorage per model; never displayed after saving. Keys Overview popover in top bar shows saved status without values.
- **Pre-seeding**: On first load, seed localStorage with 4 models (no API keys pre-filled).
- **CRUD Operations**: All changes persist immediately to localStorage under `pe_models`.
- **UI Interactions**: Modals close on Escape/outside click; focus trapping; 150ms ease transitions.

### Implementation Steps
1. Create `ModelManagement.jsx` component with card grid layout.
2. Implement Add/Edit modal with form validation and provider-specific defaults.
3. Add localStorage persistence for models and keys.
4. Build Keys Overview popover with gear icon in top bar.
5. Integrate status toggle and action buttons (edit/duplicate/delete).
6. Test CRUD operations and UI responsiveness.

## Module 2: Prompt Studio
### Features
- **Version History**: LocalStorage-backed history of prompts.
- **Editor Panel**: With variable highlighting ({variable} overlay) and auto-synced variables panel.
- **Model Selector**: Dropdown of active models from localStorage, with provider chips; disabled models (no key) greyed out with lock icon and tooltip.
- **Run Prompt**: Provider-aware API dispatcher for OpenAI, Anthropic, Google, Mistral, and Custom. Interpolates variables; handles errors with dismissible banners.
- **Output Preview Panel**: Shows spinner during fetch, success with response text + metadata (time, tokens, cost estimate), or error details.
- **Variable Interpolation**: Replaces {variables} in user template; leaves as-is if empty.

### Implementation Steps
1. Create `PromptStudio.jsx` component with editor, variables panel, and output preview.
2. Implement version history with localStorage.
3. Build model selector dropdown with status indicators.
4. Develop `callModel` function with provider-specific request formats and error handling.
5. Add variable highlighting and interpolation logic.
6. Integrate output display with metadata and cost estimation.
7. Test API calls, error handling, and UI interactions.

## Shared Requirements
- **Persistence**: All data in localStorage (`pe_models` for models/keys; separate for prompt history).
- **State Management**: React useState/useEffect/useContext only.
- **Security**: API keys never logged or rendered in plain text.
- **UI/UX**: Consistent with design system; modals with proper closing; transitions.
- **Error Handling**: Try/catch for localStorage; parse provider-specific API errors.
- **Cost Estimation**: Client-side calculation with hardcoded rates (approximate).

## Timeline
- **Phase 1**: Model Management (2-3 days) - UI, forms, persistence.
- **Phase 2**: Prompt Studio (3-4 days) - Editor, API integration, testing.
- **Integration & Testing**: 1 day - Ensure modules work together, handle edge cases.

## Dependencies
- Existing React setup, Tailwind CSS, IBM Plex fonts.
- No new libraries; use fetch for API calls.

This plan ensures a modular, maintainable implementation. Let me know if you'd like adjustments before proceeding.