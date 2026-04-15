# EtherWatch Redesign Roadmap (Simulation -> Exceptional Product)

This dashboard is currently a React + Vite JavaScript app (`src/App.jsx`, `src/styles.css`).
To support premium UI patterns and reusable components, we should migrate to a **shadcn-style structure**, **Tailwind CSS**, and **TypeScript**.

## 1) Current state (April 15, 2026)
- Frontend stack: React 18 + Vite 5 + custom CSS.
- No Tailwind config in repo.
- No TypeScript config in repo.
- No canonical `/components/ui` component library folder.

## 2) Why create `src/components/ui`
Even if the app works today, `src/components/ui` is important because:
1. It creates a single, predictable source of truth for reusable design primitives.
2. It keeps feature code (`DeviceCard`, `TimelineChart`) separate from foundational UI.
3. It aligns with shadcn ecosystem conventions, making future imports and upgrades easier.

## 3) Recommended migration commands (run in `web-dashboard/`)
> Note: In this environment, external package installs may be blocked by registry policy. Use these in your normal dev machine/CI.

```bash
npm install -D tailwindcss postcss autoprefixer typescript @types/react @types/react-dom
npx tailwindcss init -p
npx shadcn@latest init
npm install remotion @remotion/player lucide-react class-variance-authority clsx tailwind-merge
```

## 4) Component integration notes
- Place constellation UI component at: `src/components/ui/ecosystem-constellation.tsx`.
- Place demo wrapper at: `src/components/ui/demo.tsx`.
- If using path aliases, configure `@/* -> ./src/*` in Vite + `tsconfig.json`.

## 5) Product direction (what will make this exceptional)
Build for a concrete user segment first:
- Primary target: SRE/NetOps teams that need fast incident triage.
- Job to be done: detect device degradation quickly, find the failing hop, route alert.

### MVP that feels premium
1. Clean overview page (health + active incidents + blast radius).
2. Device details with timeline + packet loss/latency outliers.
3. Alert center with acknowledge/assign/snooze.
4. Guided onboarding: connect first agent in under 5 minutes.

## 6) Deployment opinion
If you want minimal ops overhead:
- Frontend on Vercel is excellent.
- For backend/controller, Vercel serverless can work for HTTP-only use cases, but long-running websocket/UDP telemetry ingest is often better on Fly.io/Render/Kubernetes.

## 7) Big-CS-problem framing
This can solve a real, large problem: reducing Mean Time To Detect (MTTD) and Mean Time To Resolve (MTTR) in network incidents by combining telemetry + anomaly detection + clear operator UX.

