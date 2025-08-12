Got it, Jeff. Below is a concrete UI blueprint that fits the end‑state you outlined (canonical, versioned knowledge layer; agents; provenance) and plugs cleanly into what’s already in Olivine V10 (orchestration, Supabase/Neo4j, Dropbox integration, async tasking). Where I anchor a feature to the current system, I cite the design doc you attached.

---

# Product UI Structure (Purpose‑built for Production Teams)

## Where we fit in the producer toolchain

We will not replace Final Draft, Showbiz/Movie Magic, Google Docs/Sheets, Frame.io, or Dropbox/Drive. We sit **between** those systems as the **“Production OS”** and **automation layer**:

* **Ingest + Normalize:** Connect to Drive/Dropbox; mirror folder reality into a unified file & graph model (Supabase + Neo4j) for reliable search, mapping, and downstream automations.&#x20;
* **Reason + Generate:** Agents operate on the graph to produce consistent artifacts (e.g., call sheets), with async job control and review.&#x20;
* **Audit + Evolve:** Every material action is recorded and visible; you can compare versions, branch, and revert (UI below). (Provenance/branching from our last message; UI here makes that operable.)
* **Integrate outward:** Share artifacts back to the tools producers already use (Frame.io, Gmail/Slack, DocuSign), and round‑trip data where helpful (Sheets/CSV exports, upload watchers). Planned connectors align with the “Additional Integrations” section in the design doc.&#x20;

---

## Global navigation & mental model

Mermaid site map of core areas:

```mermaid
flowchart LR
  A[Projects] --> B[Home / Today]
  B --> C[File Explorer]
  B --> D[Shoot-Day Cockpit]
  B --> E[Agent Console]
  B --> F[Approvals & Reviews]
  B --> G[Commits & Branches]
  C --> C1[Source View]
  C --> C2[Canonical View]
  C --> C3[Entity View]
  D --> D1[Call Sheet Composer]
  D --> D2[Hazards & Compliance]
  E --> E1[Job Queue]
  E --> E2[Runbook/Playbooks]
  F --> F1[Mapping Review]
  F --> F2[Task Reviews]
  G --> G1[Commit Timeline]
  G --> G2[Diff & Revert]
  B --> H[Mapping Studio]
  B --> I[Graph Explorer (Admin)]
  B --> J[Integrations]
  B --> K[Notifications/Inbox]
  B --> L[Settings & Roles]
  B --> M[System Health (Admin)]
```

---

## Page‑by‑page: purpose, primary interactions, and exact controls

### 1) Projects & Onboarding Wizard

**Goal:** Fast path to connect sources and seed the graph.

* **Route:** `/projects`, `/projects/:id/wizard`
* **Key UI:**

  * “Create Project” button → modal to name project, choose timezone.
  * **Connect Sources**: Google Drive, Dropbox cards → “Connect” (OAuth) → “Select Root Folder” picker. (Anchors to Orchestrator webhook endpoints + Dropbox handler flow.)&#x20;
  * **Initial Sync**: Button “Start Scan” triggers full sync (calls manual sync API). Show progress bar (events processed / remaining).&#x20;
  * **Taxonomy seed**: Option to import a “Mapping Profile” from another project or start blank.
* **States & telemetry:**

  * “Waiting on provider”, “Sync running”, “Sync complete”.
  * Errors surface “Retry” and “Open Logs”.

### 2) Home / Today

**Goal:** An operational cockpit.

* **Route:** `/projects/:id/home`
* **Widgets:**

  * **Today’s Shoot(s)** (cards): date, location, scenes, weather, readiness (template/crew/slots OK?). “Open Cockpit”.
  * **Recent Commits** (timeline): last 10 changes with author (agent/human), entity, message. “View Diff”. (Commit model from the core vision; UI binds to provenance we persist.)
  * **Queue Health**: #running/#queued tasks; click opens Agent Console. Async tasks & result streaming are first‑class.&#x20;
  * **Approvals**: Pending mapping overrides + task reviews (ties to `task_reviews` mentioned in spec).&#x20;
  * **Notifications**: system and agent alerts.

### 3) File Explorer

**Goal:** See file reality vs canonical reality, side‑by‑side.

* **Route:** `/projects/:id/files`
* **Layout:** 3‑pane

  * **Left:** Tree (Source View): actual provider structure with provider badges; search; “Sync now”. (Supabase files/folders lists; realtime updates).&#x20;
  * **Center:** Table (current folder): name, type, size, modified, **Slot** (if mapped), Confidence, Issues.
  * **Right Inspector:** Tabs:

    * **Details** (metadata, path, provider).
    * **Canonical** (slot assignment with confidence—accept/override, “Propose rule”). (Mapping Studio link.)
    * **References** (linked Scenes/ShootDays/Artifacts).
    * **Provenance** (who/what touched this file).
    * **Preview**: inline viewer (pdf.js), text preview, media thumb.
* **Actions:**

  * “Open in Provider”, “Rename” (with policy check), “Move”, “Set Slot”, “Request Review”.
  * “Re‑ingest metadata” (quick fix button).
* **Modes (tabs above table):**

  * **Source View** (default).
  * **Canonical View** (folders by canonical slots: SCRIPT\_PRIMARY, SCHEDULE\_MASTER, etc.).
  * **Entity View** (files grouped by Scenes, Shoot Days, Departments).

### 4) Mapping Studio

**Goal:** Learn & enforce each org’s dialect.

* **Route:** `/projects/:id/mapping`
* **Panels:**

  * **Profile YAML** (editable—rules with regex builders & placeholders).
  * **Rules Table**: Pattern | Slot | Weight | Hints | Last hit | Status (learned/manual).
  * **Suggestions**: auto‑learned candidates awaiting approval (from File Steward agent).
  * **Testbench**: drop a filename/path to see matching rule & confidence.
* **Buttons:** “Add rule”, “Promote suggestion”, “Reorder weights”, “Validate profile”, “Save new version”.
* **Why here:** The attached design already positions naming/policy enforcement and human overrides; we formalize it in UI. (General frontend remit & mapping/approvals are implied in doc; suggestions + approvals tie into the reviews concept.)&#x20;

### 5) Shoot‑Day Cockpit

**Goal:** One page to run a day.

* **Route:** `/projects/:id/days/:date`
* **Sections:**

  * **Header**: date, day x of y, location(s), weather (fetched + cached by agent).
  * **Scenes** table: #, slugline, pages, set/location, key props; links to source assets.
  * **Cast & Crew**: call times, travel notes, contact buttons.
  * **Hazards/Compliance**: rule checks; missing COIs; action “Create Violation Ticket”.
  * **Artifacts**: list rendered docs (call sheet draft/final, sides).
* **Primary CTA:** “Generate Call Sheet” → drawer to choose template & branch; kick off agent job (async job flow).&#x20;
* **Post‑run:** “Preview”, “Request Changes”, “Finalize (lock + mark FINAL)”, “Distribute” (Gmail, Slack, Frame.io share).

### 6) Call Sheet Composer

**Goal:** Deterministic doc generation & light editing.

* **Route:** `/projects/:id/callsheets/:id`
* **UI:**

  * **Template preview** (HTML render); fields mapped from graph.
  * **Editable blocks** (notes, special instructions) with change tracking.
  * **Export**: “Save Draft PDF”, “Publish Final (PDF)”, “Duplicate to branch”.
* **Rationale:** Our spec emphasizes deterministic, template‑based generation; HTML→PDF path keeps edits tractable while preserving auditability. (Front‑end has SSR bundle; HTML rendering is in scope.)&#x20;

### 7) Agent Console

**Goal:** Kick off and monitor AI work.

* **Route:** `/projects/:id/agents`
* **Tabs:**

  * **Jobs**: table of tasks (id, type, target, status, started, duration, worker, retries). Streaming logs panel. “Cancel”, “Retry”, “View Output”.
  * **Runbooks**: saved “playbooks” (e.g., “Re‑index project”, “Draft call sheet for next 3 days”).
  * **Chat**: conversational agent with tool use; show referenced files and context. (The spec already supports a chat endpoint & async flow.) &#x20;
* **Under the hood:** Matches the queue/worker model (RabbitMQ) with 202‑Accepted + task ID and streamed result events back to UI.&#x20;

### 8) Approvals & Reviews

**Goal:** Human‑in‑the‑loop gates.

* **Route:** `/projects/:id/reviews`
* **Queues:**

  * **Mapping Overrides** (file→slot, rename/move suggestions).
  * **Task Reviews** (outputs requiring sign‑off; e.g., call‑sheet draft). Backed by `task_reviews`.&#x20;
* **Actions:** “Approve”, “Reject with comment”, “Promote to Mapping Rule”.

### 9) Commits & Branches

**Goal:** Git‑like safety for production data.

* **Route:** `/projects/:id/history`
* **Views:**

  * **Timeline**: commits (agent/human), message, changed entities, linked artifacts.
  * **Diff**: before/after for Scenes, Shoot Days, Files/Slots, Templates.
  * **Branches**: list; create, switch, merge; conflict UI (choose branch value).
* **Actions:** “Revert this commit”, “Create branch from here”, “Compare with main”.
* **Note:** This UI operationalizes the provenance & branching model we defined in the last message; it complements outbox→graph consistency from the existing system.&#x20;

### 10) Graph Explorer (Admin)

**Goal:** Transparency for power users.

* **Route:** `/projects/:id/graph`
* **Features:**

  * Visual node‑link graph; filter by label (Scene, ShootDay, File, Slot, Template).
  * Click node → inspector (properties, relationships, provenance).
  * “Open in context” jumps to File Explorer or Shoot‑Day Cockpit.
* **Why now:** The doc calls out an admin memory/graph viewer concept; we surface it cleanly.&#x20;

### 11) Integrations

**Goal:** Manage connections and publishing.

* **Route:** `/projects/:id/integrations`
* **Cards:**

  * **Dropbox**/**Drive**: connect, set project root, **Manual Sync** (uses Orchestrator endpoint); show webhook/last event time, and “Resubscribe webhook” action.&#x20;
  * **Frame.io**: connect account; “Publish artifact to Frame.io” from artifact pages.
  * **Gmail/Slack**: connect; default distribution lists.
  * **DocuSign**: connect; designate templates; “Send for signature”.
* **Status lines:** token freshness, error reasons; test buttons.

### 12) Notifications & Inbox

**Goal:** One place to catch up.

* **Route:** `/projects/:id/inbox`
* **Feed types:** “Mapping required”, “Generation complete”, “Compliance failed”, “Commit merged”.
* **Filters:** critical/warnings/info; by agent or entity.
* **Real‑time:** via Supabase realtime or WS from Orchestrator.&#x20;

### 13) Settings & Roles

**Goal:** Access control and defaults.

* **Route:** `/projects/:id/settings`
* **Tabs:** Team (roles: Producer, Coordinator, Accounting, Admin), Templates, Branch policy, Call‑sheet defaults, Departments/Rate cards (links to Ops pages).

### 14) System Health (Admin)

**Goal:** First‑line ops visibility.

* **Route:** `/admin/health`
* **Panels:** Service health pings, queue depth, sync backlog (outbox size), Neo4j connectivity, error log sampler; links to full logs. (Lines up with the observability/reliability section: retries, dead‑lettering, health checks.)&#x20;

---

## End‑to‑end user flows (with concrete triggers and surfaces)

### A. Plug in project files (Dropbox/Drive) → see files in UI

1. **Connect** provider from Integrations. OAuth completes; Orchestrator stores source credentials in Supabase; webhook challenge verified on GET, events posted to POST handler.&#x20;
2. **Initial scan**: Click “Manual Sync”. Orchestrator calls Dropbox Handler to enumerate and write `files`/`folders` rows; outbox trigger inserts a `sync_event`. &#x20;
3. **Sync Worker** upserts Neo4j nodes, marks `sync_event` processed. The File Explorer updates in realtime.&#x20;

### B. Kick off AI agent tasks (async)

1. **Run** from Shoot‑Day Cockpit (“Generate Call Sheet”) or Agent Console.
2. **API** receives request and publishes job to RabbitMQ; returns **202 Accepted** + task id instantly. UI navigates to job detail and begins streaming logs.&#x20;
3. **LangGraph** consumes job, queries Supabase/Neo4j, calls LLM, writes output; Orchestrator streams result back to the client. &#x20;

### C. Monitor & approve

* **Agent Console → Jobs** shows live status; **Approvals & Reviews** shows pending human gates (e.g., review call sheet draft). `task_reviews` is the store of record.&#x20;

### D. Track changes like Git & revert

* **Commits & Branches** shows a DAG timeline; select two commits to view entity diffs (scenes/day, file slot changes).
* **Revert** creates a new commit restoring prior versions; **Create Branch** lets you explore alternatives; **Merge** applies to main with audit trail. (Provenance/branching model from our last message; UI pairs with graph updates and outbox/Sync consistency in the current stack.)&#x20;

---

## Editing model (what’s editable in‑app vs routed out)

* **In‑app editors (native):**

  * **HTML‑templated artifacts** (e.g., call sheets, day reports): structured fields + rich‑text blocks → export to PDF; deterministic and fully auditable. (Frontend HTML/SSR stack makes this natural.)&#x20;
  * **Lightweight PDF annotation** (pdf.js): comments, stamps, signature placeholders; we keep original file intact and store annotations/provenance separately.
  * **Tables/rosters**: AG‑Grid‑style spreadsheet for rosters/rate cards; export CSV/XLSX for Showbiz/Movie Magic round‑trip.
* **Hand‑off editors (deep authoring):**

  * **Script writing** (Final Draft), **heavy budgeting** (Showbiz/Movie Magic), and **video review** (Frame.io) remain external; we sync in/out as files and map them to canonical slots.
* **Share & sign:** “Distribute” integrates with Gmail/Slack (send with watermark) and DocuSign (send selected PDF for signatures). Integrations page manages tokens. Planned connectors are consistent with the doc’s “Additional Integrations.”&#x20;

---

## Cross‑cutting UI patterns

* **Right‑hand Inspector** everywhere (Files, Scenes, Shoot Days, Commits) with tabs: Details | Relations | Provenance | Actions.
* **Command Palette** (`⌘K`): “Generate call sheet”, “Open Mapping Studio”, “Sync Dropbox”, “New Branch”.
* **Contextual provenance**: every row has a “…” → “View commit that created/changed this”.
* **Realtime by default**: job progress, new files, and sync status use WS/real‑time updates (documented frontend approach).&#x20;
* **Roles & guardrails**: producer/coordinator/accounting/admin govern which actions appear; approvals require elevated roles.

---

## Why these pages—and why this is the right fit

* **Tight coupling to current architecture:**

  * The **Integrations** and **Manual Sync** controls map directly to Orchestrator + Dropbox‑handler endpoints defined in the doc (challenge endpoint, webhook POST, manual sync).&#x20;
  * The **Agent Console** mirrors the **RabbitMQ 202‑Accepted → worker → streamed result** pattern with `task_status` for UI tracking.&#x20;
  * The **File Explorer** consumes Supabase tables with real‑time updates and reflects graph consistency post‑outbox processing. &#x20;
  * **Approvals & Reviews** formalize the human QA described (e.g., `task_reviews`), preserving accountability.&#x20;
* **Agent‑first, deterministic outputs:** Shoot‑Day Cockpit + Composer make agent runs explicit, reproducible, and reviewable—matching the async, tool‑driven agent service already defined.&#x20;
* **Operational transparency:** System Health reflects the observability and reliability plan (retries, dead‑lettering, health checks, chaos drills).&#x20;
* **Future‑proof integrations:** Drive/OneDrive/Calendar/Slack/Email/Graph viewer are called out in the doc’s roadmap; we’ve positioned them as first‑class UI concepts so they drop in cleanly.&#x20;

---

## MVP vs. Phase‑2 (so we ship the right thing first)

**MVP (weeks 1–6):**
Projects & Wizard; File Explorer (Source/Canonical); Mapping Studio (rules + suggestions); Shoot‑Day Cockpit; Call Sheet Composer (HTML→PDF); Agent Console (Jobs + Runbooks); Approvals & Reviews; Integrations (Dropbox/Drive, Gmail/Slack minimal send); Notifications; Settings/Roles.

**Phase‑2:**
Commits & Branches (full diff + revert UI), Graph Explorer (admin), Frame.io/DocuSign connectors, deep Ops views (rate cards, PO/timesheet linking), conflict resolution during merges, budget round‑trip helpers.

---

## Concrete UI element inventory (for design + build)

* **Buttons/CTAs:** Connect, Start Scan, Manual Sync, Set Slot, Propose Rule, Approve/Reject, Generate Call Sheet, Preview, Finalize, Distribute, Create Branch, Merge, Revert, Retry, Cancel.
* **Drawers/Modals:** Run Agent (pick target + branch), Template Picker, Approve Mapping Change (with diffs), Share/Distribution.
* **Tables:** Files, Scenes, Jobs, Approvals, Commits, Branches, Rules.
* **Viewers/Editors:** pdf.js preview, HTML artifact editor, grid editor (rosters), code editor for mapping YAML (with linting).
* **Toasts/Badges:** Slot confidence (high/low), Source status (connected/stale), Job state (queued/running/succeeded/failed).
* **Empty‑states:** “No mapping rule matched—open Mapping Studio”; “No call‑sheet template—upload or select”.

---

## Example: “Connect Dropbox → Draft & Send Call Sheet”

1. Integrations: **Connect Dropbox** → select root → **Start Scan** (Manual Sync).&#x20;
2. Watch files populate in **File Explorer**; fix any low‑confidence slot with **Set Slot**; promote a rule in **Mapping Studio**.&#x20;
3. Go to **Shoot‑Day Cockpit** for Friday → **Generate Call Sheet** (Run Agent) → task appears in **Agent Console**; logs stream.&#x20;
4. Open **Composer** → tweak a note → **Save Draft PDF** → **Send via Slack/Gmail**. (Distribution connectors as per “Additional Integrations”.)&#x20;
5. Approvals: Producer **Approves** → call sheet marked FINAL; **Commit** appears in **History**. (Commit UI binds to graph provenance from our core architecture; outbox/Sync ensure graph/data consistency.)&#x20;

---

## Design system & accessibility (succinct)

* **Shell:** left rail + topbar; 3‑pane content on heavy pages (Files).
* **Components:** MUI or Radix primitives + Tailwind; WCAG AA; keyboardable (tab order), high‑contrast mode; `⌘K` palette; real‑time indicators with aria‑live.
* **Latency handling:** optimistic UI for rule changes; job streams backpressure handled with incremental logs.

---

### Final note on scope alignment

Everything above is either (a) already supported by your runtime architecture (frontend app, Orchestrator/handlers, async agents, outbox→Neo4j sync) or (b) an explicit UI for capabilities we agreed to add (provenance, branches, mapping intelligence). Frontend behaviors (auth, realtime, REST/WS) and backend flows (webhooks, manual sync, async chat/jobs) are all documented in the attached design and are reflected here as user‑facing, testable features.   &#x20;

If you want, I can turn this into a clickable wireframe map (Figma spec) or generate a Markdown “UI Acceptance Checklist” for engineering kickoff.
