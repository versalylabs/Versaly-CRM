# Phase 18 — AI Deal Copilot & Intelligence

Phase 18 introduces an enterprise-grade, zero-lockin AI Deal Intelligence and autonomous copilot engine to Versaly CRM. It works 100% out-of-the-box using local heuristic NLP algorithms without requiring external API keys, while fully supporting optional OpenAI/Gemini keys when configured.

---

## Capabilities & Architecture

### 1. Multi-Tenant Prisma Data Models
- **`AiDealInsight`**:
  - Attached 1-to-1 to each deal (`Lead`), scoped to `Organization`.
  - Real-time sentiment score (`sentimentScore`: 0–100) & categorical classification (`sentimentLabel`: `POSITIVE`, `NEUTRAL`, `CONCERN`).
  - Predictive win probability (`winProbability`: 0–100%).
  - Churn and stall risk level (`churnRisk`: `LOW`, `MEDIUM`, `HIGH`).
  - Extracted buying signals (`buyingSignals`), deal objections (`objections`), suggested strategic next actions (`suggestedActions`), and executive summary notes (`summaryNotes`).
- **`AiMeetingSummary`**:
  - Attached to `Lead` & `Organization` (optional `calendarEventId`).
  - Preserves raw transcripts and produces structured AI summaries, detected objections with counter-strategies, and action items.

### 2. High-Performance Core Engine (`lib/aiCopilot.ts`)
- **Deterministic Heuristic NLP Pipeline**:
  - `analyzeLeadSentimentAndRisk(lead)`: Dynamically weighs pipeline stage progression, proposal velocity, activity recency, overdue tasks, and engagement frequency.
  - `summarizeMeetingTranscript(text, leadContext)`: Extracts key decisions, detects client objections, pairs them with actionable counter-strategies, and pinpoints follow-up action items with priorities.
  - `generateAiOutreachDraft(params)`: Crafts contextual, persuasive email and WhatsApp outreach copies calibrated across 4 tones (Professional, Warm, Direct, Urgent) and 4 strategic objectives (Follow-Up, Close Deal, Re-engage, Meeting Request).

### 3. Backend API Route Handlers
- **`GET /api/copilot/overview`**: Aggregates organization-level deal intelligence, KPI counts (high-intent vs. at-risk), win probability averages, and recent meeting summaries.
- **`POST /api/copilot/analyze`**: Runs real-time evaluation for a given deal (`leadId`), updates/persists `AiDealInsight`, and logs activity events.
- **`POST /api/copilot/summarize`**: Processes meeting notes/transcripts, extracts objections with counter-moves, and can automatically schedule CRM tasks from action items.
- **`POST /api/copilot/draft`**: Generates customized outreach messages for Email or WhatsApp with dynamic tokens and customizable context.

### 4. Interactive Command Center (`/copilot`)
- **React Bits Liquid Glass Design**:
  - KPI cards with subtle glass borders, backdrop blur (`backdrop-blur-xl`), and dark ocean styling (`#053048`).
  - 100% vector SVG outline icons throughout (monochrome, zero emojis).
- **Tab 1: Pipeline Intelligence Matrix**:
  - Filterable by risk level (Low, Medium, High) and sentiment (Positive, Neutral, Concern).
  - Live win probability gauges, sentiment badges, churn risk pills, and prescribed actions.
  - "Signals" modal displaying the complete intelligence dossier for each deal.
- **Tab 2: Meeting Summarizer**:
  - Paste any meeting transcript or call notes.
  - Generates executive summary, action items, objections with counter-strategies, and key decisions.
  - 1-click option to auto-convert action items into assigned CRM tasks.
- **Tab 3: Smart Outreach Drafter**:
  - Target prospect selector, channel toggle (Email / WhatsApp), tone picker, and strategic goal.
  - Instant generated copy with 1-click clipboard copy and direct launch buttons into Email / WhatsApp modules.

### 5. Lead Detail Integration (`/leads/[id]`)
- Added **AI Copilot** tab directly into the lead workspace with sentiment metrics, win probability progress bars, buying signals list, objections, and suggested next moves.
- Header intelligence pill showing real-time win probability and sentiment verdict.

### 6. Sidebar Navigation
- Added **AI Deal Copilot** to `src/components/sidebar.tsx` under the `Sales & Pipeline` collapsible group with an outline sparkle/copilot icon.

---

## Verification & QA
- **Structural QA**: `npm run qa:final` passing 112/112 checks.
- **Type Safety**: `npx tsc --noEmit` cleanly verified.
- **Zero-Lockin Performance**: All functions execute synchronously with zero latency even without external API keys.
