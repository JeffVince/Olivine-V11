
## **2\. Data Ingestion & Normalization**

This section details how raw data from external file storage enters the system and is transformed into the canonical graph format.

### **2.1 Sources and Capture**

We integrate with multiple storage providers – **Dropbox**, **Google Drive**, and **Supabase Storage** – as primary file sources. Each integration is event-driven (avoiding heavy polling) and feeds our system events whenever files are added, modified, moved, or deleted[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). For example, Dropbox sends webhook callbacks on file changes (we use their `/files/list_folder/continue` delta API to fetch details, so constant polling isn’t needed), and **Supabase** (our app’s own storage, backed by Postgres) can emit row change events via DB triggers. **Google Drive** is planned as a future integration (GAP: not yet implemented in code) – we would use Drive’s push notifications (change **watch** API) rather than polling[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c).

For each source, we maintain a **staging log** table in Supabase to record raw incoming events. For example, Dropbox events are recorded in a `dropbox_events` table with details like event type, file path, file ID, timestamp, etc. Every time a Dropbox webhook or delta is processed, a new row is inserted (append-only) capturing what the storage told us happened[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/services/dropbox_event_handler/app/api/v1/webhooks.py#L520-L528). This durable log acts as a ledger of changes in the source. If our downstream graph ingestion pipeline falls behind or goes down, the log ensures we don’t lose events – the pipeline can catch up by replaying any unprocessed entries. (For Google Drive, we would set up a similar `gdrive_events` log – *GAP*: this table and integration are not present yet, to be designed in the future **FIX**: create `gdrive_events` table and webhook handler for Drive change notifications).

**Ingestion Pipeline (per event):** For each file event (e.g. “file *X* was created/updated at path *Y*”), an ingestion agent (the **“File Steward”** in our design) executes a series of steps to normalize the change into our graph:

1. **Capture the event:** The raw event is captured and persisted in the staging table. For example, when a Dropbox webhook indicates changes, we insert a record into `dropbox_events` with details like `event_type` (e.g. "file\_created", "file\_deleted"), the file’s provider ID, name, path, size, timestamps, and JSON metadata[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/services/dropbox_event_handler/app/api/v1/webhooks.py#L520-L528). This gives us a durable audit trail of every change and serves as the input queue for processing.

2. **Resolve to canonical File node:** The ingestion process then ensures the file is reflected in the **File Ontology** of our Neo4j graph. We determine if this file is already known in the graph by a stable identifier – in practice, we use the file’s internal UUID from our database (or the provider’s unique ID) as the primary key for the File node. For a new file (not seen before), we create a new `:File` node with its properties (name, path, size, last-modified time, etc.). If the file already exists (same UUID), we **update** the existing node’s properties instead of creating a duplicate. The sync worker’s file handler uses an UPSERT logic: it calls `neo4j_client.upsert_node("File", id, properties)` with the file’s ID and metadata[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). This design (using the file’s DB UUID as the Neo4j node key) guarantees idempotency – even if a file is moved or renamed, as long as it retains the same UUID, the graph node is updated rather than duplicated[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). *(In the current implementation, the system relies on the file’s stable ID for uniqueness. A content hash could further deduplicate copies, but that is not implemented yet – moving a file currently results in the same node being updated, whereas copying a file (new UUID) creates a new node.)*

3. **Classify the file (slot mapping):** Next, we attempt to classify the file into one of our known **Canonical Slots** (the standardized categories like `SCRIPT_PRIMARY`, `CALLSHEET_FINAL`, `BUDGET_MASTER`, etc.). This step normalizes "messy" filenames/paths into a structured category that the rest of the system understands. The classification uses a combination of static rules and machine learning: we would check the active **TaxonomyProfile** (a set of naming rules for the project/org) for any pattern match, and if none apply or confidence is low, fall back to an ML model to predict the slot. For example, a rule might specify that "any PDF in a folder named 'Schedules' with 'final' in the filename" should be classified as a `CALLSHEET_FINAL` slot[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). If such a rule matches, we tag the file accordingly. If no rule fires, an ML classifier might examine the filename and even file content for clues (e.g. does the PDF text contain the word "Call Sheet" or a date?) to suggest a slot. **CRITICAL - EdgeFact Implementation:** When classifying a file into a CanonicalSlot, the **File Steward** must write the `(:File)-[:FILLS_SLOT {classified_by, rule_id, profile_id, created_at}]->(:CanonicalSlot)` relationship directly as an **EdgeFact**, not as a convenience edge in MVP. The classification creates an EdgeFact with `type='FILLS_SLOT'`, enabling reclassification with full provenance. Keep provenance metadata on the `FILLS_SLOT` relationship properties. Do **not** write any `[:CANONICAL_SLOT]` convenience edge in MVP. This ensures all file classifications are temporalized and auditable.

*GAP:* Currently, this classification step is **not automatic** in the code – no CanonicalSlot tagging is applied yet[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). In the current state, files aren't being auto-tagged with slots (it may be done manually or not at all). **FIX:** Implement the TaxonomyProfile rules engine and ML inference so that whenever a File node is created or updated, the system evaluates the rules and creates EdgeFacts for `FILLS_SLOT` relationships via the Provenance Write Path, not direct relationships[Google DriveGoogle Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). This will normalize files into categories in real-time as they arrive with full temporal tracking.

4. **Link to Content/Ops entities if recognizable:** If the ingested file can be linked to a specific entity in the **Content Ontology** (creative domain) or **Ops Ontology** (operational domain), the pipeline creates those relationships **via EdgeFacts**. For instance, suppose a new file `call_sheet_2025-08-09.pdf` comes in and through the above classification we recognize it as a Call Sheet for shoot date Aug 9, 2025\. The system would either find or create a node `(:ShootDay {date: 2025-08-09})` in the graph, and then create an **EdgeFact** with `type='GENERATED_CALLSHEET'` linking the ShootDay to the File node, with a convenience relationship `(:ShootDay)-[:GENERATED_CALLSHEET]->(f)` materialized for fast queries[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). This way the file is contextually linked with full temporal tracking: a query for the ShootDay of 2025-08-09 can traverse to find its associated call sheet file, and historical queries can show when the callsheet was generated or replaced. Similarly, if a file named `Scene_42_Storyboard.png` is ingested and identified as a storyboard for Scene 42, the system would ensure there's a `(:Scene {id: 42})` node and create an EdgeFact with `type='HAS_CONTENT'` linking Scene to File, enabling queries like "what storyboards existed for Scene 42 on date X?" These semantic links enrich the graph with temporal awareness, enabling both current and historical content-driven queries.

*GAP:* This contextual linking is only conceptual at this stage – the current implementation does not automatically create `ShootDay` or `Scene` nodes from filenames. No code in the system yet parses filenames for domain entities or establishes those EdgeFact links. **FIX:** Extend the ingestion pipeline to include content recognition (perhaps using regex or NLP on filenames and file content) so that when a pattern like a date or scene number is detected, the corresponding Content/Ops node is `MERGE`d (if not present) and linked to the File via EdgeFacts through the Provenance Write Path. (E.g. integrate with the rules from TaxonomyProfile: a rule could specify that a filename matching `call_sheet_<DATE>.pdf` should create an EdgeFact linking to a ShootDay of that date.)

5. **Emit a commit entry:** All graph writes MUST use the **Provenance Write Path API** (detailed in Section 5), including ingestion, LangGraph agents, and user API writes. The ingestion pipeline records a complete provenance trail by invoking the atomic Cypher transaction that creates commits, versions entities, versions temporal edges (EdgeFacts), and logs actions with precise lineage. For example, if the file *X* was mapped to slot *Y* and linked to scene *Z*, the system would call the Provenance Write Path with parameters including the File entity update, any EdgeFact relationships created, and Action nodes detailing each atomic operation (e.g. an Action for the classification rule applied, another for the link created to ShootDay). The transaction ensures idempotency via the Supabase outbox `event_id` as the `dedupe_key`, creates immutable EntityVersion and EdgeFact nodes, maintains TOUCHED relationships to both old and new states, and advances the branch HEAD atomically. This provides a complete audit log in the graph itself – one can query "who/what caused this File node to be in this slot" and trace it to a commit with full lineage to both the previous and new states. **REQUIREMENT:** The sync worker and all other writers must be refactored to use the canonical Provenance Write Path transaction instead of direct node/relationship mutations. This ensures every change is versioned, auditable, and idempotent.

**TELEMETRY:** The ingestion pipeline emits comprehensive metrics for observability (detailed in Section 7): `olivine_ingest_latency_seconds{source, org_id}` tracks end-to-end processing time from webhook receipt to Neo4j commit completion, `olivine_classification_accuracy{org_id, rule_id}` measures taxonomy rule confidence scores, and `olivine_ingestion_events_total{source, org_id, event_type}` counts successful and failed processing events. These metrics enable SLO monitoring and alerting for the 95th percentile latency target of 30 seconds and classification accuracy target of 90% with confidence ≥ 0.8.

By running this pipeline, any file that “hits” our system (e.g. a user drops a PDF into a “Daily Callsheets” folder on Dropbox) gets captured and normalized into the graph, with full traceability. The end result is that a new `:File` node appears in Neo4j, categorized with a canonical slot (e.g. CALLSHEET), linked to any relevant domain context (e.g. the specific ShootDay), and accompanied by a commit log entry describing the ingestion. All of this happens behind the scenes without user intervention[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c) – from the user’s perspective, they simply added a file to their cloud drive, and the system “understood” what it was and where it fits in the production knowledge graph.

### **2.4 Multi-Tenancy Backfill & Rollout Plan**

**Low-risk migration strategy for existing single-tenant deployments:**

1. **Introduce `Org`**: Create `Org` rows and set each existing `Project.org_id`. If you have a single-tenant legacy dataset, create one `Org` and assign all projects to it.

2. **Stamp `org_id`** on all existing nodes:
   - Determine each node's `org_id` via its owning `Project` (or `Source`→`Project`), then run batch updates to set `org_id`.
   - Add smoke checks: for every relationship, `startNode.org_id == endNode.org_id`.

3. **Add graph constraints** (from §2.3) and **SQL constraints** (from §2.3).

4. **Migrate IDs**:
   - Generate and set graph-native `id` (ULID/UUIDv7) on all nodes that don't have it yet.
   - Move previous "graph id == Supabase UUID" into `db_id` (for every SQL-backed node). Adjust ingestion to MERGE by `db_id`.

5. **Cutover ingestion**: Deploy the new MERGE-on-`db_id` logic, org stamping, and Vault usage for sources.

6. **Kill residual secrets**: Run a scan: if any `Source.metadata` still contains tokens, purge and replace with `token_ref`.

7. **Gate queries**: Roll out API middleware that injects/verifies `org_id`, and reject any request lacking it.

8. **Add tests**:
   - Multi-tenant isolation: queries from Org A must return zero nodes from Org B.
   - Path uniqueness enforced in SQL.
   - File dedup via `db_id` is idempotent across renames/moves.

### **2.5 Documentation Update Cheatsheet**

**Critical find & replace operations for multi-tenancy and security:**

* **Find:** "`Source.metadata (JSON for extra info like provider tokens …)`" → **Replace with:** "`Source.token_ref` (opaque), `provider_account_id`; secrets live in Vault/KMS; no tokens stored in graph."

* **Find:** "`File.id` corresponds to the Supabase file record UUID …`" → **Replace with:** "`File.db_id` corresponds to the Supabase UUID; `File.id` is a graph-native ULID/UUIDv7; ingestion MERGEs on `db_id`."

* **Find:** any Cypher that doesn't scope by org → **Add:** `WHERE <node>.org_id = $org_id` to every MATCH/MERGE pattern and relationship creation.

* **Find:** uniqueness language on paths in the graph → **Replace with:** "Uniqueness of `(org_id, source_id, path)` is enforced in SQL; graph deduplicates by `db_id`."

* **Add:** new subsection "Multi-tenancy & Org boundary" in 1.1 or 2.1 explaining `:Org`, `org_id` stamping, and API-only access.

* **Add:** constraint snippet for `CanonicalSlot.key` and org scoping notes where CanonicalSlot is discussed (currently marked as *planned* in doc).

**Conflicts with current write-up to fix:**
* The doc **explicitly** suggests storing provider tokens in `Source.metadata` — **remove that** and replace with `token_ref` + Vault/KMS flow.
* The doc **ties `File.id` to the Supabase UUID** and uses it for dedup/upsert; change to **graph ULID `id` + `db_id` for MERGE**.
* `CanonicalSlot` is **planned**; when you formalize it, add a **unique `key`** constraint and **org scoping**.

### **2.3 Multi-Tenancy: SQL Constraints & Neo4j Schema**

**SQL Constraints (Files & Folders table):**

Apply these constraints to enforce multi-tenant path uniqueness at the relational layer:

```sql
-- Make path unique within source and org
ALTER TABLE files
  ADD CONSTRAINT files_org_source_path_unique
  UNIQUE (org_id, source_id, path);

ALTER TABLE folders
  ADD CONSTRAINT folders_org_source_path_unique
  UNIQUE (org_id, source_id, path);
```

This encodes "Path uniqueness" at the **relational** layer; the graph then deduplicates on `db_id`.

**Neo4j Schema (Constraints & Indexes) for Ingestion and Provenance:**

Use these idempotent migrations to enforce uniqueness, tenancy scoping, and query performance.

```cypher
// Files (scoped by org_id)
CREATE CONSTRAINT file_org_db_id_unique IF NOT EXISTS
FOR (f:File) REQUIRE (f.org_id, f.db_id) IS UNIQUE;

CREATE INDEX file_modified_idx IF NOT EXISTS
FOR (f:File) ON (f.modified);

CREATE INDEX file_org_id IF NOT EXISTS 
FOR (f:File) ON (f.org_id);

// Canonical slots (scoped by org_id)
CREATE CONSTRAINT canonicalslot_key_unique IF NOT EXISTS
FOR (c:CanonicalSlot) REQUIRE c.key IS UNIQUE;

CREATE INDEX canonicalslot_org_id IF NOT EXISTS 
FOR (c:CanonicalSlot) ON (c.org_id);

// Sources (scoped by org_id)
CREATE CONSTRAINT source_provider_account_org_unique IF NOT EXISTS
FOR (s:Source) REQUIRE (s.provider_account_id, s.org_id) IS UNIQUE;

// Provenance (scoped by org_id)
CREATE CONSTRAINT commit_dedupe_key_unique IF NOT EXISTS
FOR (c:Commit) REQUIRE (c.dedupe_key) IS UNIQUE;

CREATE INDEX commit_org_id IF NOT EXISTS
FOR (c:Commit) ON (c.org_id);

// Guard rails to ensure org_id is present
// Neo4j can't enforce non-null in all editions; 
// enforce at API/service layer and tests.

// Actions (scoped by org_id)
CREATE CONSTRAINT action_unique IF NOT EXISTS
FOR (a:Action) REQUIRE (a.id) IS UNIQUE;

CREATE INDEX action_org_id IF NOT EXISTS
FOR (a:Action) ON (a.org_id);

// Immutable entity snapshots
CREATE CONSTRAINT entity_version_unique IF NOT EXISTS
FOR (ev:EntityVersion)
REQUIRE (ev.tenant_id, ev.entity_label, ev.entity_id, ev.version) IS UNIQUE;

// EdgeFacts (temporal relationships)
CREATE CONSTRAINT edgefact_id_unique IF NOT EXISTS
FOR (e:EdgeFact) REQUIRE e.id IS UNIQUE;

CREATE INDEX edgefact_type_from IF NOT EXISTS
FOR (e:EdgeFact) ON (e.type, e.from_id, e.branch);

CREATE INDEX edgefact_type_to IF NOT EXISTS
FOR (e:EdgeFact) ON (e.type, e.to_id, e.branch);

CREATE INDEX edgefact_open IF NOT EXISTS
FOR (e:EdgeFact) ON (e.type, e.from_id, e.to_id, e.branch, e.valid_to);

// Helpful indexes
CREATE INDEX commit_created_at_idx IF NOT EXISTS
FOR (c:Commit) ON (c.created_at);

CREATE INDEX action_type_idx IF NOT EXISTS
FOR (a:Action) ON (a.type);
```

Notes

* __Tenancy__: every node/relationship created by the ingestion/provenance path carries `tenant_id`.
* __Idempotency__: all writes use `MERGE` with composite keys to avoid duplicates.

### **2.4 Provenance Write Path (Atomic Transaction Template)**

This template wraps the file upsert, optional classification, commit/action logging, and a snapshot into a single transaction. Omit blocks by passing `null` params.

Parameters

* __tenant_id__: string
* __file__: { id, name, path, size, mime_type, modified }
* __slot_key__: string | null
* __confidence__: float | null
* __classified_by__: 'rule' | 'ml' | 'user' | null
* __rule_id__: string | null
* __commit_id__: string (UUID)
* __parent_commit_id__: string | null
* __author_id__: string
* __commit_message__: string
* __now__: ISO-8601 datetime string (server time)

Cypher

```cypher
// 1) Upsert File state using db_id with org_id stamping (per Guide 3)
WITH $org_id AS org_id, datetime($now) AS now
MERGE (f:File {db_id: $file.db_id, org_id: org_id})
  ON CREATE SET
    f.id         = $file.id,        // UUID for graph-native operations
    f.name       = $file.name,
    f.path       = $file.path,
    f.size       = $file.size,
    f.mime_type  = $file.mime_type,
    f.created_at = now,
    f.modified   = datetime($file.modified)
  ON MATCH SET
    f.name       = $file.name,
    f.path       = $file.path,
    f.size       = $file.size,
    f.mime_type  = $file.mime_type,
    f.modified   = datetime($file.modified),
    f.updated_at = now

// 2) Optional classification (File -> CanonicalSlot) with org_id scoping
WITH f, org_id, now
FOREACH (_ IN CASE WHEN $slot_key IS NULL THEN [] ELSE [1] END |
  MERGE (slot:CanonicalSlot {key: $slot_key, org_id: org_id})
    ON CREATE SET slot.created_at = now, slot.description = $slot_description
  MERGE (f)-[r:CANONICAL_SLOT]->(slot)
    ON CREATE SET r.at = now
  SET r.classified_by = coalesce($classified_by, 'rule'),
      r.confidence    = coalesce($confidence, 1.0),
      r.at            = now
)

// 3) Commit + Actions with org_id scoping
WITH f, org_id, now
MERGE (cm:Commit {id: $commit_id, org_id: org_id})
  ON CREATE SET cm.message    = $commit_message,
                cm.author_id  = $author_id,
                cm.kind       = 'INGEST',
                cm.created_at = now,
                cm.branch     = 'main'

FOREACH (_ IN CASE WHEN $parent_commit_id IS NULL THEN [] ELSE [1] END |
  MATCH (prev:Commit {id: $parent_commit_id, org_id: org_id})
  MERGE (prev)-[:NEXT]->(cm)
)

CREATE (a1:Action {id: randomUUID(), org_id: org_id, type: 'UPSERT_FILE', ts: now})
MERGE (cm)-[:INCLUDES]->(a1)
MERGE (a1)-[:TOUCHED]->(f)

WITH f, cm, org_id, now
FOREACH (_ IN CASE WHEN $slot_key IS NULL THEN [] ELSE [1] END |
  CREATE (a2:Action {id: randomUUID(), org_id: org_id, type: 'CLASSIFY_FILE', ts: now, rule_id: $rule_id, confidence: $confidence})
  MERGE (cm)-[:INCLUDES]->(a2)
  MERGE (a2)-[:TOUCHED]->(f)
  WITH a2, f, org_id
  MATCH (f)-[:CANONICAL_SLOT]->(slot:CanonicalSlot {key: $slot_key, org_id: org_id})
  MERGE (a2)-[:TOUCHED]->(slot)
)

// 4) Snapshot current File state as immutable EntityVersion
WITH f, cm, org_id, now
OPTIONAL MATCH (f)-[:HAS_VERSION]->(evPrev:EntityVersion)
WITH f, cm, org_id, now, max(evPrev.version) AS latest
WITH f, cm, org_id, now, coalesce(latest, 0) + 1 AS nextVersion
CREATE (ev:EntityVersion {
  org_id:       org_id,
  entity_label: 'File',
  entity_id:    f.id,
  version:      nextVersion,
  at:           now
})
MERGE (f)-[:HAS_VERSION {tenant_id: tenant_id}]->(ev)
CREATE (a3:Action {tenant_id: tenant_id, id: randomUUID(), type: 'SNAPSHOT', ts: now})
MERGE (cm)-[:HAS_ACTION {tenant_id: tenant_id}]->(a3)
MERGE (a3)-[:SNAPSHOT_OF {tenant_id: tenant_id}]->(ev);
```

Operational Notes

* __Atomicity__: run the above as a single transaction per event.
* __Idempotent replays__: reuse the same `$commit_id` for retried events to avoid duplicate commits.
* __Optional APOC__: if available, you may copy a property snapshot into `ev.snapshot`.

### **2.2 Canonical Slots**

**Canonical Slots** are a core concept for normalizing files. A CanonicalSlot represents a standard role or category that a file can fulfill in a film/production project. By assigning each ingested file to a slot, we decouple *what* the file represents from *where* or *how* it is stored/named. In essence, slots act as tags or labels in the graph that categorize files in a consistent, queryable way.

We maintain a predefined (but extensible) list of slot categories that cover common production documents. For example, some of the canonical slots include[Google DriveGoogle Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c):

* **SCRIPT\_PRIMARY** – the main script/screenplay for the project.

* **SCHEDULE\_MASTER** – the master shooting schedule.

* **CALLSHEET\_DRAFT** and **CALLSHEET\_FINAL** – draft and final versions of call sheets for each shoot day.

* **BUDGET\_MASTER** – the primary budget file.

* **INSURANCE\_COI** – an insurance Certificate of Insurance document.

* **RATE\_CARD** – a union or crew rate card document.

* **STORYBOARD**, **LOOKBOOK**, **LOCATION\_RELEASE**, etc. – other common production artifacts (concept art, location permits, etc.).

These slots are not hard-coded in one place; they are data-driven and we can add new ones as new types of files appear (for instance, if a project has a novel document type, we can introduce a new CanonicalSlot for it). The system is designed to handle such **extensibility** – new slot nodes can be created on the fly, and our classification logic (rules/ML) can be trained or configured to recognize them (this relates to novelty detection, discussed later)[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c).

Crucially, canonical slots allow downstream automation agents and queries to refer to files by *role* rather than by name or path. For example, our Call Sheet generator agent does not need to know the exact folder or filename of the latest shooting schedule; it can simply query the graph for `(:File)-[:CANONICAL_SLOT]->(:CanonicalSlot {key: "SCHEDULE_MASTER"})` to retrieve the current schedule file. Likewise, it can find the template for call sheets by looking for the file tagged `CALLSHEET_TEMPLATE` (assuming we have a slot for template files). By using slots, automation remains stable even if a studio uses different naming conventions or folder structures – the mapping to slots abstracts those differences[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c).

Under the hood, a CanonicalSlot is represented (or will be represented) as a node in Neo4j with a unique key (name) and perhaps a description. Assigning a file to a slot means creating a relationship in Neo4j: `(:File)-[:CANONICAL_SLOT]->(:CanonicalSlot)`. For instance, when classifying an ingested file as a final call sheet, the system would ensure a `CanonicalSlot` node with key “CALLSHEET\_FINAL” exists, and then link the File node to that slot. Below is a Cypher example that illustrates this operation:

cypher

Copy

`MERGE (slot:CanonicalSlot {key: 'CALLSHEET_FINAL'})    // ensure the slot exists (create if needed)`

`MATCH (f:File {checksum: $checksum})                   // find the file by a stable identifier (e.g. its UUID or checksum)`

`MERGE (f)-[:CANONICAL_SLOT]->(slot);                   // assign the file to the slot`

In this pseudo-code, `$checksum` (or an equivalent unique ID) identifies the file just ingested. We first `MERGE` the slot node so that a node for “CALLSHEET\_FINAL” is in the graph (if it wasn’t already). Then we `MATCH` the file by its ID and create the `CANONICAL_SLOT` relationship from that file to the slot. The result is that a query like `MATCH (f:File)-[:CANONICAL_SLOT]->(:CanonicalSlot {key: "SCRIPT_PRIMARY"}) RETURN f` will yield the current script file for the project[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). In other words, no matter what the script file is named or where it lives, as long as it’s tagged as SCRIPT\_PRIMARY, any part of the system can find it through the graph.

It’s important to note that **CanonicalSlot nodes and relationships are part of the planned schema but not yet fully realized in the code**. The design calls for creating these slot nodes and links during ingestion/classification, but as of now there is no `CanonicalSlot` node in the Neo4j database (no such nodes are created by the sync/ingestion process – this is a known gap)【37†L115 \- L123】[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). **GAP:** The current implementation does not automatically tag files with CanonicalSlot relationships. **FIX:** Introduce `CanonicalSlot` nodes in the graph schema and modify the file ingestion pipeline (or a post-processing step) to apply the taxonomy rules and ML classifier outcomes: when a file is determined to fit a slot, create the `(:File)-[:CANONICAL_SLOT]->(:CanonicalSlot)` link as shown above. Additionally, we will maintain the list of allowed slot keys (perhaps as an enum in code or a reference data table) to ensure consistency (e.g. avoid typos in slot names). This way, as soon as a file is ingested, any agent or query can reliably retrieve it by asking for the slot, decoupling automation logic from raw filenames.

In summary, canonical slots provide the **authoritative categorization** for files in the knowledge graph. They act as the interface between unstructured storage and structured data: once a file is linked to a slot, other components know exactly what role that file plays (script, schedule, budget, etc.) without needing to parse its name or location. This enables robust automation and data integrity across varying storage conventions.

### **Write path: File → CanonicalSlot classification (transaction)**

The following is the complete atomic transaction that implements the file classification flow, creating EdgeFacts for temporal relationship tracking and maintaining full provenance:

```cypher
// Inputs (parameters): $file_id, $slot_key, $org_id, $project_id, $author, $now, $commit_id, $action_id, $edgefact_id
// $now should be a timezone-aware timestamp (e.g., datetime()).

// 1) Resolve project/org and upsert live File state
MERGE (o:Org {id: $org_id})
MERGE (p:Project {id: $project_id})-[:BELONGS_TO_ORG]->(o)
MERGE (f:File {id: $file_id})
  ON CREATE SET f.created_at = $now
SET f.updated_at = $now

// 2) Ensure CanonicalSlot exists
MERGE (slot:CanonicalSlot {key: $slot_key})

// 3) Close any prior open FILLS_SLOT EdgeFact for this file
CALL {
  WITH $file_id AS fid, $now AS now
  MATCH (e:EdgeFact)
   WHERE e.type = 'FILLS_SLOT' AND e.from_id = fid AND e.valid_to IS NULL
  SET e.valid_to = now
  RETURN count(e) AS closed_count
}

// 4) Create new EdgeFact row (open interval)
CREATE (ef:EdgeFact {
  id: $edgefact_id,
  type: 'FILLS_SLOT',
  from_id: $file_id,
  to_id: $slot_key,    // using CanonicalSlot.key as the stable to_id
  valid_from: $now,
  valid_to: NULL
})

// 5) (Re)create live convenience edge :CANONICAL_SLOT
OPTIONAL MATCH (f)-[old:CANONICAL_SLOT]->(:CanonicalSlot)
DELETE old
MERGE (f)-[:CANONICAL_SLOT]->(slot)

// 6) Commit + Action provenance, attach TOUCHED to File, EdgeFact, Slot; update Branch:main HEAD
MERGE (c:Commit {id: $commit_id})
  ON CREATE SET c.message = 'taxonomy.classify', c.author = $author, c.created_at = $now, c.branch = 'main'
MERGE (a:Action {id: $action_id})
  ON CREATE SET a.type = 'taxonomy.classify', a.inputs = {file_id:$file_id, slot_key:$slot_key}, a.created_at = $now
MERGE (c)-[:INCLUDES]->(a)
MERGE (a)-[:TOUCHED]->(f)
MERGE (a)-[:TOUCHED]->(slot)
MERGE (a)-[:TOUCHED]->(ef)

// Update Branch HEAD pointer
MERGE (b:Branch {name:'main'})
OPTIONAL MATCH (b)-[old:HEAD]->(:Commit)
DELETE old
MERGE (b)-[:HEAD]->(c);
```

**Key features of this transaction:**

1. **Idempotent file/org/project resolution** - Uses MERGE to ensure entities exist
2. **Temporal edge management** - Closes previous FILLS_SLOT EdgeFacts and creates new ones with proper validity intervals
3. **Convenience relationship maintenance** - Updates the live CANONICAL_SLOT relationship for fast queries
4. **Complete provenance tracking** - Creates Commit and Action nodes with TOUCHED relationships to all affected entities
5. **Branch management** - Updates the main branch HEAD pointer atomically

This transaction can be called from the taxonomy classification engine, ML inference pipeline, or manual classification workflows, ensuring consistent behavior and full auditability across all classification paths.

---
