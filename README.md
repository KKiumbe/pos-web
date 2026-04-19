# TableFlow Web

Next.js frontend for the TableFlow restaurant POS.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Ensure `NEXT_PUBLIC_API_BASE_URL` points to the running API.
3. Run:

```bash
npm install
npm run dev
```

The app starts on `http://localhost:3000`.

## Scope

This app is the tenant-facing restaurant POS only.

Platform super admin work now runs in the separate control app:

- `../tableflow-control-web`
- `http://localhost:3001`

## Current MVP Workspace

- Login with seeded demo staff accounts
- Dashboard summary cards
- Order creation
- Kitchen status updates
- Payment recording
- M-Pesa transaction activity
- Mock SMS dispatch logging
- Menu visibility
- Manager setup for categories, menu items, tables, stock items, and recipes
- Inventory watchlist
- Daily report snapshot

## Demo Login

- `manager@demo.tableflow.app` / `Admin@1234`
- `cashier@demo.tableflow.app` / `Admin@1234`
- `kitchen@demo.tableflow.app` / `Admin@1234`
