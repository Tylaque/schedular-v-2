# Scheduling Platform — Booking Flow Prototype

This is a Next.js (App Router) prototype of the participant-facing booking flow
described in Section 6 of the requirements doc. It runs entirely on mock data —
no database or Microsoft Graph calls yet — so we can validate the UX before
building the backend.

## Run it

```bash
npm install
npm run dev
```

Then open:
- `http://localhost:3000` — demo project picker
- `http://localhost:3000/book/senior-pm-interview` — the booking page directly

## What's here

- `lib/mockData.ts` — mock Project/Admin data plus the slot-generation and
  admin-assignment stand-ins for the real logic in Section 4 of the requirements doc.
- `components/BookingFlow.tsx` — the actual booking UI: calendar → time slots →
  participant details → confirmation. This is the component to keep as we wire
  in real data.
- `app/book/[project]/page.tsx` — public booking route, keyed by project slug
  (stand-in for the tokenized participant link from Section 6).

## Next steps (not yet built)

1. Replace `lib/mockData.ts` with Prisma models + PostgreSQL (see Section 12.2
   of the requirements doc for the suggested schema).
2. Admin availability submission screen (Doodle-style multi-select grid).
3. Super Admin project configuration screen (Section 3).
4. Real Microsoft Graph integration for Teams meeting + calendar creation
   (Section 8 — needs an Entra ID app registration first).
5. Auth: Microsoft Entra ID for Super Admin/Admin, tokenized single-use links
   for participants (replacing the plain `/book/[project]` slug used here).
