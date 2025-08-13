Jeff, here’s a master, future‑proof TODO you can execute now—so extraction can be added later without a rewrite. It’s organized by area, prioritized, and written as checkable work items with “Done when…” criteria.

⸻

A) Graph/Ontology – make clusters a first‑class concept (no parsing required yet)

A1. Core node/edge types
	•	Add ContentCluster node (placeholder per file).
	•	Done when: Every File has (:File)-[:HAS_CLUSTER]->(:ContentCluster) created at ingest time.
	•	Allow multi‑slot classification for files via multiple EdgeFact entries (e.g., FILLS_SLOT).
	•	Done when: A file can hold 0..N canonical slot facts, each time‑bounded.
	•	Predefine cross‑layer edge types you’ll need later (even if unused now):
	•	(:Scene)-[:SCHEDULED_ON]->(:ShootDay)
	•	(:Character)-[:PORTRAYED_BY]->(:Talent)
	•	(:Scene)-[:HAS_LOCATION]->(:Location)
	•	(:PurchaseOrder)-[:FOR_SCENE]->(:Scene) / [:FOR_CREW]->(:Crew)
	•	Done when: Types exist in schema, documented, and migration scripts create constraints.

A2. Constraints & indexes (Neo4j)
	•	Uniqueness: File.id, ContentCluster.id, Scene.id, ShootDay.id, etc.
	•	Indexes for frequent lookups: File.projectId, File.hash, EdgeFact.type, EdgeFact.from_id, EdgeFact.to_id.
	•	Done when: Cypher constraints/indexes are created and validated in CI.

A3. Provenance patterns
	•	Standardize commit/action shapes for: file.ingested, cluster.created, slot.classified, slot.reclassified.
	•	Done when: Event names + payload schemas are documented and emitted by ingestion.

A4. Documentation
	•	Layer map (IRL / Idea / Ops / Provenance): list node labels per layer and allowed cross‑layer edges.
	•	Done when: One page in repo clearly defines the ontology with examples.

⸻

B) Staging & Promotion – build the rails for extraction (without ML)

B1. Staging tables (SQL / Supabase)
	•	extraction_job(id, file_id, status, parser_name, parser_version, method, confidence, dedupe_key, created_at, completed_at)
	•	extracted_entity_temp(id, job_id, kind, raw_json, hash, confidence, source_offset?)
	•	extracted_link_temp(id, job_id, from_hash, to_hash, rel_type, raw_json, confidence)
	•	Done when: DDL applied, owners set, RLS/ACL set, and basic CRUD tested.

B2. Registry & policy
	•	parser_registry(slot, mime, ext, parser_name, parser_version, min_confidence, feature_flag)
	•	Done when: Admin can enable/disable parsing per (slot,mime) without code changes.

B3. Promotion audit
	•	promotion_audit(id, job_id, actor, action {promote|rollback|edit}, before_json, after_json, timestamp)
	•	Done when: Every promotion/rollback is recorded and queryable.

B4. Idempotency
	•	Enforce dedupe_key (e.g., file_id + parser_name + parser_version + file_hash) to avoid duplicate jobs.
	•	Done when: Duplicate submissions return “no‑op” and metrics reflect de‑duped counts.

⸻

C) Orchestration & Events – wire up future workflows

C1. Event emission (at ingest)
	•	Emit file.ingested with {file_id, project_id, slots[], mime, ext, file_hash}.
	•	Done when: Visible in logs and consumed by a test subscriber.

C2. Job types
	•	Define queue jobs: extraction.parse, extraction.promote, extraction.rollback.
	•	Done when: Workers accept payloads, validate schema, and ack/nack with retry policy.

C3. Feature flags
	•	Global flag: extraction.enabled=false (default off).
	•	Per (slot,mime) flag via parser_registry.feature_flag.
	•	Done when: Toggling changes behavior without deploy.

C4. Event→workflow mapping
	•	Router rule: on file.ingested, if registry+flags allow, enqueue extraction.parse.
	•	Done when: Dry‑run creates a job for whitelisted types only.

C5. Dead‑letter & retries
	•	DLQ for each job type; exponential backoff; max retry count surfaced in metrics.
	•	Done when: Poison job demonstrates DLQ path and alert triggers.

⸻

D) Contracts & Schemas – lock interfaces before building parsers

D1. JSON Schemas (versioned)
	•	ExtractedEntity kinds you expect (start with Scene, Character, ShootDay, BudgetLineItem, CrewRole).
	•	Required fields, IDs, foreign key strategy (by hash, by anchor text), confidence, provenance.
	•	ExtractedLink schema (rel_type, endpoints by entity hash or provisional ID).
	•	Done when: Schemas live in repo, validated in CI, and used by workers.

D2. Promotion rules
	•	Deterministic mapping: e.g., Scene(number) unique per project → upsert (:Scene {number}).
	•	Conflict policy (on duplicates / low confidence → send to review queue).
	•	Done when: A dry‑run promotion on sample JSON produces expected Cypher/MUTATION preview.

D3. Rollback contract
	•	Store reverse ops for every promotion (created nodes, created edges, previous values).
	•	Done when: One‑click rollback removes promoted artifacts and writes audit event.

⸻

E) API & SDK – stable surfaces for agents and UI

E1. Service endpoints
	•	POST /extraction/jobs (create), GET /extraction/jobs/:id, POST /extraction/jobs/:id/promote, POST /extraction/jobs/:id/rollback
	•	Done when: OpenAPI spec committed; auth scopes defined; 200/4xx/5xx mapped.

E2. GraphQL extensions
	•	Add contentCluster to File type; add clusterState { entitiesCount, parser, version, confidence }.
	•	Mutations: requestExtraction(fileId, parserName?), promoteExtraction(jobId), rollbackPromotion(auditId).
	•	Done when: GraphQL schema compiles, resolvers stubbed, permissions enforced.

E3. Client SDK
	•	Minimal TS/py helpers: requestExtraction, pollJob, listEntities, promote, rollback.
	•	Done when: Used by a smoke test and the admin tool.

⸻

F) UI – make clusters visible and controllable (even when empty)

F1. File detail panel
	•	“Cluster” section: count of extracted entities (may be 0), parser/version, confidence, last promoted time.
	•	Done when: For any file, UI shows “Extraction disabled / 0 entities” clearly.

F2. Controls
	•	Toggle “Enable extraction” (per file), select parser/version (if multiple), enqueue job.
	•	Preview diff view (staging vs. graph) before promotion.
	•	Done when: User can dry‑run and view proposed nodes/edges.

F3. Review queue
	•	Paginated list of pending promotions (low confidence or conflicts), approve/edit/reject.
	•	Done when: Reviewer can edit JSON before promotion with validation.

F4. History
	•	Timeline of promotions/rollbacks with links to audit records and commits.
	•	Done when: Clicking an audit entry reconstructs the promoted payload.

F5. Admin – Parser Registry
	•	CRUD UI for registry entries; feature flags; per‑type thresholds.
	•	Done when: Non‑dev can enable parsing for a type from UI.

⸻

G) Observability & SLOs – know when it breaks

G1. Metrics
	•	Counters: jobs queued/succeeded/failed; promotions/rollbacks; human‑review rate; duplicate‑job drop rate.
	•	Histograms: parse time, promote time, queue latency.
	•	Done when: Dashboards in Grafana (or equivalent) show live data.

G2. Tracing & logs
	•	Trace id flow: from file.ingested → job → DB writes → commit id.
	•	Done when: One click traces a file through the pipeline.

G3. Alerts
	•	Pager alerts for: DLQ growth, failure rate > X%, latency p95 > Y s.
	•	Done when: Synthetic test trips an alert in a sandbox channel.

⸻

H) Security, Access & Compliance

H1. RBAC
	•	Roles: Viewer (read cluster), Operator (request extraction), Reviewer (promote/rollback), Admin (registry).
	•	Done when: Protected endpoints enforce scopes; UI hides forbidden controls.

H2. PII/PHI handling
	•	Optional redaction pass in staging; redact before logs/metrics.
	•	Done when: Redaction toggled via config; test payload with PII is masked.

H3. Data retention
	•	Policy: staging rows TTL (e.g., 30–90 days), audit logs retained N months/years.
	•	Done when: Cron or DB policy enforces retention and is documented.

⸻

I) Testing & DevX

I1. Seed corpus
	•	Sample files (FDX/Fountain, call sheet PDFs, budgets CSV/XLSX) with golden expected entities/links (JSON).
	•	Done when: Repo contains fixtures and golden outputs.

I2. CI
	•	Contract tests validate JSON Schemas; promotion dry‑runs match goldens; rollback restores prior state.
	•	Done when: PRs fail on contract drift.

I3. Local dev story
	•	make up starts Neo4j + DB + queue + services with seed project; mock parser that emits deterministic staging entities.
	•	Done when: New dev can run the pipeline end‑to‑end in <15 minutes.

I4. Load & soak
	•	Synthetic run: 10k files; measure queue throughput, DB contention, graph write rates; tune indexes.
	•	Done when: Target p95 latencies are documented and met.

⸻

J) Migrations & Backfill

J1. Backfill cluster placeholders
	•	Create ContentCluster for all historical files; link HAS_CLUSTER.
	•	Done when: 100% coverage reported.

J2. Multi‑slot retrofits
	•	Convert legacy single classification to EdgeFact; support multiple facts going forward.
	•	Done when: Legacy reads continue to work; new writes use EdgeFacts only.

J3. Cross‑layer edge stubs
	•	If legacy data uses text fields (e.g., scene_id strings), add nullable relationship fields and migration scripts to map when possible.
	•	Done when: Mapping report shows % linked; unresolved items logged for manual curation later.

⸻

K) Governance & Change Management

K1. ADRs (Architecture Decision Records)
	•	Record decisions: multi‑slot strategy, cluster placeholder, staging/promotion model, idempotency keys, schema for links.
	•	Done when: ADRs merged with status “Accepted” and owners.

K2. Ontology Curator workflow
	•	Add checks that reject promotions creating disallowed edges or violating layer rules.
	•	Done when: A bad promotion attempt is blocked with a clear error.

K3. Versioning
	•	Semantic version for schemas (v1), parsers (parser_name@vX.Y), and promotion rules (ruleset@vZ).
	•	Done when: All audit records carry versions; rollbacks know which ruleset to reverse.

⸻

L) Integration Readiness (A2A/MCP)

L1. Tool facade
	•	Expose safe, coarse operations as tools: CreateScene, LinkSceneToShootDay, AttachTalentToCharacter.
	•	Done when: Tools callable internally and by an MCP adapter (mock).

L2. A2A envelope
	•	Define simple JSON‑RPC or HTTP envelope for agent‑to‑agent calls (invokeTool, submitJob, getStatus).
	•	Done when: Another internal service can request an extraction & receive status without touching DB.

⸻

M) Rollout Plan & SLOs

M1. Phased enablement
	•	Default off globally; enable per (slot,mime) for test projects; expand by cohort.
	•	Done when: A toggle matrix exists and can be changed without deploy.

M2. SLOs
	•	Stage SLAs: job enqueue < 1s, parse p95 < 30s, promotion p95 < 10s, failure rate < 2%.
	•	Done when: Dashboards compute and report compliance weekly.

⸻

What this unlocks later
	•	You can plug in rule‑based or LLM/ML parsers to fill staging, preview diffs, promote to the graph, and rollback safely—without touching ingestion, IDs, or user‑facing APIs.

If you want, I can generate:
	•	SQL DDL for the staging tables,
	•	a Neo4j constraint/index script,
	•	and an OpenAPI stub for the extraction endpoints.