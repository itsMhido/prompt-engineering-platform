# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Run with Docker Compose

This project now includes:

- Frontend (`web`): React + Vite
- Backend (`backend`): FastAPI REST API with JWT auth
- Database (`postgres`): PostgreSQL 16

1. Build and start all services:

   ```bash
   docker compose up --build
   ```

2. Open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

3. Stop containers:

   ```bash
   docker compose down
   ```

### API Quick Start

1. `POST /api/auth/register`
2. `POST /api/auth/login` -> copy `access_token`
3. Add header `Authorization: Bearer <token>`
4. `POST /api/prompts` to create prompt + first version
5. `GET /api/prompts` and `GET /api/prompts/{prompt_id}` to fetch prompts
