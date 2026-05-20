# Cheat Sheets — Claude Instructions

At the start of every session, read RUNBOOK.md in this folder. It contains all services, costs, account logins, API keys, Stripe IDs, Supabase details, and everything else needed to work on this project. Always refer to it before making decisions about infrastructure, credentials, or costs.

## Project

Next.js 14.2 SaaS — cheatsheets.co.uk
Football lineup cheat sheets with Clerk auth, Stripe subscriptions, Supabase database, Vercel hosting.

## Stack

- Framework: Next.js 14.2 (App Router), TypeScript
- Auth: Clerk (production instance ins_3DzqRHW8qTzrMATI6eoGcWVOmmW)
- Payments: Stripe live mode (acct_1TZCpm2Ly6cgjatR)
- Database: Supabase (project znvgalucggakvaphfgri)
- Hosting: Vercel Pro (project football-cheatsheet, team cheatsheets)
- Data: api-sports.io for live football data

## Key Rules

- Never use em dashes in any user-facing text. Use colons, commas, or periods instead.
- Never commit RUNBOOK.md — it contains live secrets.
- Never commit .env files.
- Deploy with: `vercel --prod` from the project folder.
- Domain is cheatsheets.co.uk — never reference football-cheatsheet.vercel.app in any user-facing code.
