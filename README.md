# CoreTECH

Internal B2B operations portal for **CoreTECH Solar**, a solar equipment distribution business (inverters, batteries, and all-in-one units). CoreTECH runs the day-to-day operations of moving product from the company to distributors to sub-dealers, managing sales and tax paperwork, dispatching and verifying field installers, and handling the administrative work around all of it.

Live at [coretechsolar.com](https://coretechsolar.com).

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)

## Overview

The app is organized around role-based access, where each role sees a different dashboard and is scoped to a different set of operations:

| Role | Responsibilities |
| --- | --- |
| **Admin** | Full system access — user management, products, purchasing/inventory/warehouses, sales, Buzzcart orders, installer dispatch & verification, expenses, role management, activity logs. |
| **Country Head** | Final approval authority for installer registrations and completed installations. |
| **RSM / Retail Manager** | Sales operations, installer verification, region-scoped oversight. |
| **Distributor** | Manages inventory consignment, sub-dealers, transfers, and returns. |
| **Sub Dealer** | Inventory, sell-out, transfers, returns. |
| **Marketing Manager** | Expense management. |
| **Installer** | Field job execution via a dedicated mobile workflow. |

Fine-grained permissions (which tabs a role can see, read-only vs. read/write, and data scope — self / region / everything) are configurable per role through an admin-only Role Management screen, rather than hardcoded per feature.

## Features

- **Product catalog** — inverters, batteries, and AIO units, with per-product enable/disable control.
- **Purchase & inventory** — stock import, warehouse tracking, region-scoped visibility.
- **Sales** — ST-1 / ST-2 transaction forms, transfers, returns, and sell-out tracking with full chain-of-custody.
- **Buzzcart** — order creation and fulfillment tracking for distributors and sub-dealers.
- **Installer workflow** — job assignment, two-stage field-completion verification, incentive payment tracking, and performance logs.
- **Serial number lookup** — full transaction history for any unit, from warehouse to end customer.
- **Expense management, activity logs, and broadcast notices.**
- **Role Management** — admin-configurable, per-role permissions and data scope.

## Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org) (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js Server Actions and Edge Middleware — no separate backend service
- **Data & Auth:** [Supabase](https://supabase.com) (Postgres, Auth, Storage, Row-Level Security)
- **Hosting:** [Vercel](https://vercel.com), deploying from `master`
- **Mobile companion:** `coretech-mobile/` — a React Native (Expo) app for field installers

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- A Supabase project (Postgres + Auth)

### Setup

```bash
npm install
```

Create a `.env.local` file with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

### Run locally

```bash
npm run build
npm run start
```

Then open [http://localhost:3000](http://localhost:3000).

### Other commands

```bash
npm run dev     # development server
npm run lint    # run ESLint
```

## Project Structure

```text
app/                  # App Router pages, grouped by role/section
app/actions/          # Server Actions (the application's backend logic)
components/           # Shared UI components
lib/                  # Supabase clients, shared utilities
middleware.ts         # Auth & role-based route protection
coretech-mobile/      # React Native (Expo) app for field installers
```

## License

Proprietary — internal use only.
