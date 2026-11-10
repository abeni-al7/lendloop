# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Neighbors on one street block in a generic English-speaking town. They own tools they rarely use (drills, ladders,
pressure washers) and want to borrow the ones they don't own. One or two residents act as admins who keep the board
clean. Secondary audience: the Fluence hiring team, who review the app in a short video and a code walkthrough.

## Product Purpose
A shared board of tools. Anyone can see what exists. Signed-in neighbors list tools, ask to borrow one for a date
range, approve or decline requests for their own tools, and mark loans returned. Automations notify owners of new
requests and remind borrowers when a loan is overdue. Success: a loan goes from request to return with no chat
thread, and nobody has to chase anyone.

## Positioning
Lending is between neighbors, not a marketplace: no prices, no ratings, no public profiles. The board shows only
what is needed to borrow (tool name, category, owner first name to signed-in users).

## Operating Context
Used on a phone or laptop for a minute at a time: check what's free, send a request, answer a request.
Loans have states: requested, approved, declined, returned; approved loans past their end date are overdue.

## Capabilities and Constraints
- Stack fixed by the brief: Next.js App Router, Clerk auth, Convex, n8n (Docker), TypeScript.
- Roles: admin and user, enforced inside Convex functions. Admin can remove any listing, see all loans, and mark a
  neighbor as Trusted Lender.
- Public visitors see a read-only list (name + category only).
- n8n workflows: request notification (webhook) and daily overdue reminders that write status back. HMAC-signed
  both ways, idempotent write-backs, retries, error workflow.
- Demo data is synthetic and must be labeled as such where it could be mistaken for real.

## Brand Commitments
Name: LendLoop. Voice: plain, short sentences, common words. Must not feel like a SaaS template, must not feel cute
or childish (the reviewer is a healthcare-training company), and must be fast to scan.

## Evidence on Hand
None. No real users, testimonials or numbers. Do not invent any.

## Product Principles
1. Show only what a person needs to act; keep personal data minimal.
2. Every loan state is visible at a glance, including what the automations did.
3. Rules live on the server; the UI only reflects them.
4. Plain words over clever ones.

## Accessibility & Inclusion
WCAG 2.2 AA: contrast, keyboard use, visible focus, reduced motion.
