# Architecture

```mermaid
flowchart LR
  Browser["React Portal (Employee / Manager / Admin)"]
  API["Express REST API"]
  Store["JSON Persistence\nserver/data/atomquest-store.json"]
  Auth["JWT Auth\nRole Middleware"]
  Goal["Goal Lifecycle Service\nvalidation, lock, unlock"]
  Checkin["Achievement + Check-in Service\nprogress formulas"]
  Report["Reports + Analytics\nCSV, trends, distribution"]

  Browser --> API
  API --> Auth
  API --> Goal
  API --> Checkin
  API --> Report
  Goal --> Store
  Checkin --> Store
  Report --> Store
  Auth --> Store
```

## Technology Choices

- Frontend: Vite + React for fast local demo and role-specific dashboards.
- Backend: Express REST API with JWT authentication and role middleware.
- Persistence: file-backed JSON store for low-cost hackathon hosting and reliable local demos.
- Reporting: server-generated CSV export from the same governed data model.
- Governance: audit log records goal submissions, approvals, inline edits, unlocks, shared KPI pushes, achievements, and check-ins.

## Hosting Path

For a hackathon demo, deploy the server and built client together on a small Node host. The JSON store keeps infrastructure cost low. For production, swap `server/src/data/store.js` with MongoDB/PostgreSQL while preserving route and service contracts.
