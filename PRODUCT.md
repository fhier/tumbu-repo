# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Established: Next.js 14.2, React 18, Dexie (local DB), NestJS (API), Prisma

## Users
Primary users: Indonesian local aquaculture farmers ("petambak lokal") within small and medium enterprises (SMEs).
Situation: Working outdoors on-site at fish/shrimp ponds, often in high-sunlight conditions, with wet or dirty hands, using standard mobile devices, facing intermittent or completely absent cellular connectivity.
Job to do: Track daily pond cycles (feeding logs, water quality change/checks, shrimp/fish sampling weights, mortality counts, health treatments, and harvests), calculate key performance metrics (FCR, SR, ADG), and manage pre-cycle modal projections (BOP calculations) and ongoing cost burn-rates so they can prevent crop failure, avoid running out of operational cash mid-cycle, and optimize profitability.

## Product Purpose
Tumbu is a mobile-first, offline-first Business Operating System for Indonesian aquaculture SMEs. It exists to turn unstable, traditional fish/shrimp farming into predictable, high-yield, and financially sound operations. Success means that a farmer can manage their daily operations completely without cellular service, get early preventative warnings (about water quality or cost overruns), and obtain clear, honest, and deterministic data to continuously improve successive cycles.

## Positioning
"Honest Data over Fancy Features." Tumbu focuses on boring, deterministic, and highly reliable technology. Unlike competitors offering hype-filled AI predictions or requiring expensive IoT sensors, Tumbu delivers immediate, actionable utility through local offline database resilience (Dexie), robust rule-based alerts, clear deterministic aquaculture metrics, and absolute reliability under real-world field constraints.

## Operating Context
- Physical pond sites (ponds/kolam, often remote) with intense outdoor glare and glare-induced low visibility.
- Mobile-first, handheld device usage with wet or muddy fingers (demanding robust UI components like massive 48px touch targets, direct-entry numeric keypads, and high visual contrast).
- Unreliable or completely offline networks where cellular dropouts are the norm.
- Daily/weekly farm rituals: daily feeding, periodic weight samplings, immediate mortality recording, weekly water changes/checks, and periodic partial or full harvests.

## Capabilities and Constraints
- **Multi-Domain Operations:** Pond Management (dimensions, lining types), Cycle Operations (stocking, biological tracking), Health & Water Monitoring (mortality, water changes/checks), Money & Trading (pre-cycle BOP estimation, expense allocations, burn-rate warnings, and sales).
- **Offline-First Guarantee:** Zero waiting on networks for write transactions. Safe, persistent client-side Dexie DB, appending to local immutable events, enqueuing to a persistent outbox, and reconciling with a NestJS backend via idempotent, safe sync.
- **Architectural Constraints:** "1 Route = 1 File < 400 lines" to prevent god files; central deterministic aquaculture calculations strictly encapsulated in `formula.ts` without client/server duplication.
- **No Predictive AI:** Strict policy against unverified AI diagnoses or predictive analytics. References are static and rule-based warnings are deterministic.

## Brand Commitments
- **Name:** TUMBU / Tumbu Business OS
- **Tone & Voice:** Boring, honest, robust, supportive, and practical.
- **Colors & Palette:** High-contrast modern dark-mode aesthetic with cyan accents (`#06B6D4` for primary actions) and mint accents (`#10B981` for success, profit, and high SR).
- **Visual Materials:** Glassmorphic card system (`bg-white/[0.05] border-white/[0.08] backdrop-blur-xl`), 16px rounded card radii, and clean high-contrast layouts.

## Evidence on Hand
- **UI Design System:** Kitab Tumbu UI v1.0 (Locked).
- **Core Addendum:** Tumbu Foundation Addendum v1.1 (Approved/Locked).
- **Technical Roadmap:** Phase 5, Phase 6, Phase 7 implementation specifications.
- **Screen Specifications:** Screen hierarchies and flow rules (R-C07, R-H05, R-H06, R-M06).

## Product Principles
1. **Honest Data over Fancy Features:** Deliver deterministic, reliable calculations rather than volatile, predictive AI models.
2. **Internet is a Capability, Not a Prerequisite:** Baseline field work must be fully executable offline; network synchronization is a background progressive enhancement.
3. **Wet Hands, High Glare Interface:** Ensure absolute scanability, high contrast, simplified form inputs, and 48px touch targets to suit real pond-side outdoor conditions.
4. **Single Source of Formulas:** All key metrics (SR, FCR, ADG, BOP) must be computed in a single shared file (`formula.ts`) to avoid duplicate or diverging business logic.
5. **No God Files:** Maintain clean folder-based route structures where any single UI route or feature file contains less than 400 lines of code.

## Accessibility & Inclusion
- Massive, fat-finger-friendly touch zones (48px target standard) for mobile entry.
- Strong color-contrast ratios and bright accents (cyan and mint) on dark backgrounds to combat outdoor sunlight glare.
- Simple, clear Indonesian vocabulary (e.g. "Tebat", "Siklus", "Kolam" / "Pond") aligned with petambak usage.
