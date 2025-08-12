## 3.1 Taxonomy Profiles (Rules per Organization)

Every production company or project can have a custom **Taxonomy Profile** in the graph, representing its file organization conventions. A **`TaxonomyProfile`** is a Neo4j node grouping a set of file classification rules specific to that org or project (e.g. one studio’s naming conventions vs. another’s)[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). Each profile node has an immutable **`id`** (UUID or similar) and human-friendly \*\*`name`/`description` identifying the organization or region it applies to (e.g. `"StudioX_US_Taxonomy"`). A profile holds an **ordered list of rules** that map raw file metadata to canonical categories (“slots”). In Neo4j we represent each rule as a **`TaxonomyRule`** node (not yet implemented – *GAP*)[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c).

**TaxonomyRule Node Schema:** Each `TaxonomyRule` encapsulates one pattern. It has a unique **`id`** (for reference and upsert), plus properties encoding the matching criteria and outcome. Key properties likely include:

* **`path_regex`** – A regular expression (or glob) to match the file’s folder path. This can target folder names or partial paths (e.g. `".*/Schedules/.*"` to catch any file under a “Schedules” directory).

* **`name_regex`** – A regex for the filename itself (e.g. `(?i)CallSheet_.*_FINAL\\.pdf$` to match filenames containing “CallSheet” and ending in “FINAL.pdf”, case-insensitive).

* **`ext`** or **`mime_type`** – (Optional) A file type filter, e.g. restrict to `.pdf` or MIME type `"application/pdf"` if the rule should only apply to PDFs[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c).

* **`target_slot`** – The canonical slot that should be assigned if this rule matches. This could be stored as a string (slot name) or, more formally, as a relationship to a **`CanonicalSlot`** node (preferred for referential integrity). *CanonicalSlot* is a planned node type representing the standardized category (e.g. `SCRIPT_PRIMARY`, `BUDGET_FINAL`, `CALLSHEET_DRAFT`). (*GAP*: no such nodes in DB yet, to be added in schema migration.)

* **`weight`** – A numeric priority or confidence weight for the rule. Higher weight means the rule is more definitive. This is used to resolve conflicts when multiple rules match (see §3.2 below). In practice, weight might be a fixed priority (e.g. 1.0 for very specific rules, 0.5 for broad heuristics) or learned confidence score.

Optional hints can also be stored, like **`folder_hint`** or **`context`** (e.g. a specific parent folder name to look for) if not covered by regex, or a flag for rule status (active/inactive). All `TaxonomyRule` properties are purely data-driven (no hard-coded logic), so adding or adjusting a rule doesn’t require code changes – only updating these node properties[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). We will enforce uniqueness constraints on `TaxonomyProfile.id` and `TaxonomyRule.id` in Neo4j so each can be reliably referenced (e.g. `CREATE CONSTRAINT taxonomy_rule_id_unique IF NOT EXISTS FOR (r:TaxonomyRule) REQUIRE r.id IS UNIQUE`).

**Relationships:** A profile is linked to its rules via a **`(:TaxonomyProfile)-[:USES_RULE]->(:TaxonomyRule)`** relationship[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). This indicates the rule is part of that profile’s rule set. The `USES_RULE` relationship may have an ordering property or a numeric `order` field to preserve the rule list order (since rule evaluation will follow this sequence). In addition, each Project in the graph can point to the taxonomy profile it should use. We plan a **`(:Project)-[:USES_TAXONOMY]->(:TaxonomyProfile)`** link[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c) or a project property (e.g. `project.taxonomy_profile_id`) to denote the active profile for that project (*GAP*: not yet implemented in code or DB)[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). This way, when classifying files, the system knows which profile’s rules to apply based on the file’s project context. In future, an organization (client) node could similarly link to a profile for a default rule set across projects. For now, we assume one active profile per project or user session (one set of rules at a time, no merging of profiles) – simplifying the logic to just lookup the profile by project. If a file belongs to no specific project, a default global profile can be used as a fallback.

**Example:** Suppose *Project A* uses a “Schedules” folder for shooting schedules and call sheets, while *Project B* uses a folder named “Plans” for the same purpose. Each project’s TaxonomyProfile will contain rules reflecting those conventions. For Project A’s profile, we might have:

* Rule 1: `path_regex: ".*/Schedules/.*", name_regex: ".*call sheet.*", ext: ".pdf", target_slot: CALLSHEET_DRAFT, weight: 0.9` – meaning any PDF under a folder “Schedules” with “call sheet” in the name is classified as a draft call sheet[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c).

* Rule 2: `name_regex: "(?i)CallSheet_.*_FINAL\\.pdf$", target_slot: CALLSHEET_FINAL, weight: 1.0` – any filename that explicitly matches the “CallSheet\_\*\_FINAL.pdf” pattern is a final call sheet (higher weight because it’s a definitive naming)[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c).

* Rule 3: `path_regex: ".*/Insurance/.*", target_slot: INSURANCE_COI, weight: 1.0` – anything in an “Insurance” folder maps to an Insurance Certificate slot.

Project B’s profile would have analogous rules with “Plans” in the path patterns instead. This illustrates how different profiles handle heterogeneous structures without changing code – the rules data is just different. The **profile approach** makes onboarding new productions faster: we can clone or create a new TaxonomyProfile node for a new client and populate it with rules (learned from their past projects or set up during onboarding), rather than writing custom logic.

**Learning and Evolution:** TaxonomyProfiles are versioned and can evolve over time. Initially, a profile may be populated with best-guess rules or industry-standard defaults. As the system ingests files and gets feedback, new rules can be added or adjusted. For example, if users repeatedly reclassify “CrewList.pdf” files from *Schedule* to *Crew Contacts*, the File Steward agent (an AI assistant in our system) will detect this pattern and suggest a new rule: *if filename contains "Crew List" then map to CREW\_CONTACTS slot*. Upon user approval, this rule is added to the profile so that future files are auto-categorized correctly. Each such change would increment a version or timestamp on the TaxonomyProfile node (to track rule set history).

**Implementation Notes:** Currently, these taxonomy nodes and relations are **not yet present in the code or DB** – this is identified as a **GAP** in the design[Google DriveGoogle Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). No `TaxonomyProfile` or `TaxonomyRule` nodes exist in the Neo4j schema (and no corresponding tables in Postgres). The **FIX** will involve extending the Neo4j migration scripts to create the new labels and constraints, and updating the sync or service code to utilize them. For example, we’ll add a migration to define `TaxonomyProfile` and `TaxonomyRule` nodes with unique `id` and perhaps indexes on rule pattern fields for quick lookup. We’ll also add a field in the Projects table (or a join table) and graph schema to link a Project to its TaxonomyProfile[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c), so that when files sync we know which profile’s rules to apply.

### 3.1.1 Neo4j Schema (Taxonomy Profiles & Rules)

Use these idempotent migrations to add taxonomy nodes and improve lookup performance.

```cypher
// Profiles
CREATE CONSTRAINT taxonomy_profile_unique IF NOT EXISTS
FOR (p:TaxonomyProfile) REQUIRE (p.tenant_id, p.id) IS UNIQUE;

CREATE CONSTRAINT taxonomy_profile_name_unique IF NOT EXISTS
FOR (p:TaxonomyProfile) REQUIRE (p.tenant_id, p.name) IS UNIQUE;

// Rules
CREATE CONSTRAINT taxonomy_rule_unique IF NOT EXISTS
FOR (r:TaxonomyRule) REQUIRE (r.tenant_id, r.id) IS UNIQUE;

CREATE INDEX taxonomy_rule_weight_idx IF NOT EXISTS
FOR (r:TaxonomyRule) ON (r.weight);

CREATE INDEX taxonomy_rule_path_regex_idx IF NOT EXISTS
FOR (r:TaxonomyRule) ON (r.path_regex);

CREATE INDEX taxonomy_rule_name_regex_idx IF NOT EXISTS
FOR (r:TaxonomyRule) ON (r.name_regex);

CREATE INDEX taxonomy_rule_target_slot_idx IF NOT EXISTS
FOR (r:TaxonomyRule) ON (r.target_slot);

// Relationship property index for ordering
CREATE INDEX uses_rule_order_idx IF NOT EXISTS
FOR ()-[ur:USES_RULE]-() ON (ur.order);
```

Notes

* __Tenancy__: enforce `(tenant_id, id)` uniqueness for multi-tenant isolation.
* __Profiles__ can be referenced by human-friendly unique `(tenant_id, name)`.
* __Rule lookups__ benefit from indexes on regex fields and `weight`.

### 3.1.2 Classification Write Path (Rule/ML + Provenance)

This transaction applies a classification to a `:File`, annotates it with metadata, and logs provenance. If `$rule_id` or `$profile_id` are provided, the action links to those nodes for auditability.

Parameters

* __tenant_id__: string
* __file_id__: string
* __slot_key__: string
* __confidence__: float | null
* __classified_by__: 'rule' | 'ml' | 'user' | null
* __rule_id__: string | null
* __profile_id__: string | null
* __commit_id__: string (UUID)
* __parent_commit_id__: string | null
* __author_id__: string
* __commit_message__: string
* __now__: ISO-8601 datetime

Cypher

```cypher
WITH $tenant_id AS tenant_id, datetime($now) AS now
MATCH (f:File {tenant_id: tenant_id, id: $file_id})

// Ensure target slot exists
MERGE (slot:CanonicalSlot {tenant_id: tenant_id, key: $slot_key})
  ON CREATE SET slot.created_at = now

// Link File -> Slot with classification metadata
MERGE (f)-[r:CANONICAL_SLOT {tenant_id: tenant_id}]->(slot)
  ON CREATE SET r.at = now
SET r.classified_by = coalesce($classified_by, 'rule'),
    r.confidence    = coalesce($confidence, 1.0),
    r.at            = now

// Commit and Action
MERGE (cm:Commit {tenant_id: tenant_id, id: $commit_id})
  ON CREATE SET cm.message    = $commit_message,
                cm.author_id  = $author_id,
                cm.kind       = 'CLASSIFICATION',
                cm.created_at = now

FOREACH (_ IN CASE WHEN $parent_commit_id IS NULL THEN [] ELSE [1] END |
  MATCH (prev:Commit {tenant_id: tenant_id, id: $parent_commit_id})
  MERGE (prev)-[:NEXT {tenant_id: tenant_id}]->(cm)
)

CREATE (a:Action {tenant_id: tenant_id, id: randomUUID(), type: 'CLASSIFY_FILE', ts: now, confidence: $confidence})
MERGE (cm)-[:HAS_ACTION {tenant_id: tenant_id}]->(a)
MERGE (a)-[:TOUCHED {tenant_id: tenant_id}]->(f)
MERGE (a)-[:LINKED_TO {tenant_id: tenant_id}]->(slot)

// Optional links to Rule/Profile for auditability
FOREACH (_ IN CASE WHEN $rule_id IS NULL THEN [] ELSE [1] END |
  MATCH (rule:TaxonomyRule {tenant_id: tenant_id, id: $rule_id})
  MERGE (a)-[:LINKED_TO {tenant_id: tenant_id}]->(rule)
)

FOREACH (_ IN CASE WHEN $profile_id IS NULL THEN [] ELSE [1] END |
  MATCH (p:TaxonomyProfile {tenant_id: tenant_id, id: $profile_id})
  MERGE (a)-[:LINKED_TO {tenant_id: tenant_id}]->(p)
);
```

Operational Notes

* __Idempotency__: reuse `$commit_id` on retries; `MERGE` prevents duplicate edges.
* __Confidence threshold__: upstream code should gate low-confidence results and trigger human review.

On the API side, we will expose endpoints to manage taxonomy profiles and rules (likely under an admin or project settings module). For instance:

* `GET /api/taxonomy/profiles`: list available profiles (with their names, org, and rule count).

* `POST /api/taxonomy/profiles`: create a new profile (specifying name, org or project association).

* `GET /api/taxonomy/profiles/{profile_id}/rules`: retrieve the rules in a profile (ordered by priority).

* `POST /api/taxonomy/profiles/{profile_id}/rules`: add a new rule to a profile (client provides `path_regex`, `name_regex`, etc. in JSON). The server will create a `TaxonomyRule` node and a `USES_RULE` link to the profile.

* `PUT/PATCH /api/taxonomy/rules/{rule_id}`: update an existing rule (e.g. adjust its regex or weight if a mapping was refined).

* Possibly, `DELETE /api/taxonomy/rules/{rule_id}` to retire a bad rule (or an `active` flag toggle).

These would interact with the Neo4j client layer to upsert or modify the corresponding nodes. (In our codebase, we might add methods in `neo4j_client.py` to create nodes/relationships for taxonomy rules, similar to the existing `upsert_node` and `upsert_relationship` functions[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/services/sync_worker/services/neo4j_client.py#L141-L150)[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/services/sync_worker/services/neo4j_client.py#L233-L242).) Until Neo4j has these nodes, the profile data could alternatively live in a JSON config or SQL table, but the target state is to have them **in Neo4j only** for unified querying. Storing rules in the graph allows us to use graph queries to find, say, all rules that map to a given CanonicalSlot or to trace which profile classified a file. It also aligns with our versioned knowledge graph approach – rules can be considered part of the “knowledge” that can be evolved and audited.

**Integration with File Ontology:** Once implemented, taxonomy rules will connect the File layer to CanonicalSlots automatically. Currently, files are ingested as `:File` nodes linked to their Folder and Project (the sync worker creates `(:Folder)-[:CONTAINS]->(:File)` and `(:Project)-[:HAS_FILE]->(:File)` edges)[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/services/sync_worker/handlers/file_handler.py#L57-L65)[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/services/sync_worker/handlers/file_handler.py#L101-L109). No `CANONICAL_SLOT` tagging happens yet (*GAP*)[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). After adding taxonomy processing, when a file node is created or updated, the system will determine its slot and create a `(:File)-[:CANONICAL_SLOT]->(:CanonicalSlot)` relationship on the fly[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). This edge is what lets the rest of the system query “the primary script file” or “all call sheet files” in a project by slot, instead of by brittle name or path matching. The next section details the algorithm that will perform this classification step.

### **3.2 Resolution Algorithm (Deterministic \+ ML Hybrid)**

When a new file arrives or an existing file is moved/renamed, the system classifies it in two stages: first using deterministic rules (from the active TaxonomyProfile), then (if needed) a probabilistic/ML approach. This hybrid resolution algorithm ensures high precision when rules clearly apply, but also handles edge cases with learned intelligence[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). The classification process will be triggered during the sync event handling for files. Specifically, after the file node and its basic relationships are upserted (and after we know the file’s project to pick the profile), the sync worker will invoke the classifier. (*FIX:* insert call in `FileHandler._handle_upsert` right after linking the File to its Folder/Project[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/services/sync_worker/handlers/file_handler.py#L57-L65).) We may implement this as a method `classify_file(file_id)` or an async job. Below is pseudocode for the core logic, inspired by the design document:

python

Copy

`# Determine which profile’s rules to use (based on project or default)`

`profile = get_profile_for_file(file)`

`candidates = apply_rules(profile, file.path, file.name)`

`if not candidates or low_confidence(candidates):`

    `# No clear rule match, use ML/heuristics to predict`

    `candidates = ml_slot_predict(file.features)`  

`slot, conf = select_top(candidates)`

`if conf < CONFIDENCE_THRESHOLD:`

    `request_human_review(file.id, candidates[:3])  # flag for human confirmation`

`else:`

    `link_file_to_slot(file.id, slot)  # create File->CanonicalSlot edge`

[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c)

**Rule Application:** `apply_rules(profile, path, name)` iterates through the `TaxonomyRule` nodes linked to the active profile (in their defined order or by descending weight). For each rule, it evaluates the match conditions against the file’s attributes. In practice, this means applying the regex patterns to the file’s full path and/or name. We will likely use Python’s `re` library for regex; each rule’s patterns can be pre-compiled for efficiency. If a rule’s conditions are met, it produces a classification candidate: basically a tuple (slot, confidence). The candidate’s *slot* comes from the rule’s `target_slot` (we find or create the corresponding CanonicalSlot node if not already in graph), and *confidence* could initially just equal the rule’s weight. For example, using the rules from Project A above: a file at `/ProjA/Schedules/CallSheet_09_15.pdf` would match Rule 1 (`Schedules` in path \+ name contains “CallSheet”) yielding candidate (CALLSHEET\_DRAFT, 0.9). If a single rule yields a sufficiently high confidence match with no close competitors, we accept it outright[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). In our design, **“high-confidence”** could be defined as any rule match with weight ≥ e.g. 0.8 and at least 0.2 higher than the next-best match. So if one rule scores 0.9 and no other rule exceeds 0.7, that’s a clear winner. The file is then classified into that slot immediately by creating the `CANONICAL_SLOT` relationship in Neo4j[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). The classification result can also be stored back in Postgres (e.g. a `files.canonical_slot` field) if we want to reflect it in the relational DB for easy filtering there – but the graph link is the primary source of truth.

**Conflict & Ambiguity Handling:** If multiple rules match or none do, the deterministic step is inconclusive. For instance, a file named `CrewList.pdf` might not match any rule (if we hadn’t defined one for “Crew List”), or a file `CallSheet_CrewList.pdf` might inadvertently match two rules (one looking for “CallSheet” and another for “Crew List”) with similar weights. In these cases, the algorithm falls back to ML. We log which rules fired and their scores; this data can later help refine the rules (e.g. identifying that we need a more specific rule to disambiguate *Crew List* from *Call Sheet*).

**ML Classification:** The `ml_slot_predict(file.features)` step uses a trained model or AI heuristic to predict the best slot based on the file’s characteristics. Rather than rigid rules, it considers a broader set of features:

* **Filename tokens:** We tokenize the filename on underscores, spaces, capitalization changes, etc., to extract words and numbers. These tokens (e.g. “Budget”, “v5”, “2023”) feed into the model, which can learn that certain words strongly indicate certain slots (like “budget” → Budget slot). We might use TF-IDF or embedding techniques to assess token importance[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c).

* **Folder context:** The names of the parent and ancestor folders are additional features. E.g., a file in an “Art” folder might lean towards a Concept Art slot.

* **File type:** The extension or MIME type helps narrow possibilities (a `.pdf` could be many document types, an `.mp4` might be a video asset slot, etc.).

* **File content:** If textual content is available (for PDFs, Word docs, etc., we often extract text to an indexed field in Supabase), we scan for domain keywords. For example, if the OCR’d text of a PDF contains scene headers like “INT. LOCATION – DAY”, that’s a strong clue it’s a Script. Or if a spreadsheet contains money-related terms, it might be a budget or cost report. In implementation, we can use a lightweight content scan: e.g., check if certain keywords from a slot’s definition appear in the text. The existing `FileSearchHandler` already does a simple version of this kind of scoring: it checks filename and content for keywords like "budget", "schedule", "invoice", etc., and assigns a category[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/services/langgraph/src/orchestrator/routers/meta_handlers/specialized/file_search_handler.py#L276-L285)[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/services/langgraph/src/orchestrator/routers/meta_handlers/specialized/file_search_handler.py#L291-L300). We will build on that idea with a more robust model.

* **Neighbor context:** We can consider sibling files: if many files in the same folder have been classified as a certain slot, a new file in that folder likely belongs to that same category (a form of clustering confidence).

We have flexibility in the ML approach. A straightforward implementation is a Python classification model (e.g. logistic regression or random forest) trained on known file names from past projects. It would output a score for each possible slot. Alternatively (and especially for new, unseen naming patterns), we can leverage a large language model. For example, we could prompt an LLM with: *“Here are the possible file categories (with definitions)... and here is a filename (and snippet of content)... which category does it best fit?”*. This would yield a scored recommendation for each slot using the LLM’s knowledge of language[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). Using an LLM in the loop is appealing because it can understand subtle variations (like abbreviations or synonyms that a simple regex might miss). However, it may be slower and costlier, so we might reserve it for cases where deterministic rules fail.

The output of ML prediction is a set of candidate slots with confidence scores (e.g., {`Budget`: 0.55, `Schedule`: 0.40, `Script`: 0.05} for a file named “Budget\_v5.xlsx”). We take the top candidate (`Budget` in this example). If the top score is above a chosen **threshold** (say 0.7) and sufficiently higher than the runner-up (to ensure no tie), we accept it. The sync worker would then automatically create the File→CanonicalSlot link for that slot, and mark the file as classified. The user might see the category in the UI (e.g., a tag “Budget Document” on the file).

**Human-in-the-Loop for Low Confidence:** If the ML is unsure – e.g., the best score is 0.4 vs second best 0.3, or absolute confidence is below threshold – the system **pauses automation for this file** and seeks human input[Google DriveGoogle Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). In practice, this will generate a **review task** or notification for a user. We can leverage the existing Task system (the graph has a `Task` node for to-do items[GitHub](https://github.com/JeffVince/olivine-V10/blob/48e3ca5b913508684047a319c996733b8ad44dab/infra/neo4j/migrations/V1/V1__01_core_nodes.cypher#L83-L91)). The system would create a new Task like “**Classify File**: The file *Budget\_v5.xlsx* could not be confidently categorized. Options: Budget or Cost Report?” and assign it to an appropriate user (e.g. the project’s production coordinator). This Task can be created via our backend (e.g., `POST /api/tasks` with details, or directly via Neo4j `CREATE (t:Task {type:'classification_review', ...})`). The user, through the UI, would then choose the correct slot from the suggestions (or even a new category if our options were incomplete). Once the user confirms, the system will: (a) create the File→CanonicalSlot link for the chosen slot (thus completing the classification), and (b) treat this feedback as a learning signal. The task gets marked completed.

**Profile Update from Feedback:** Every ambiguous case resolved by a human is an opportunity to improve the rules. We track these interventions: if a pattern emerges (e.g. the file name “Budget\_v5” was not caught by any rule, but the user classified it as a Budget document), the File Steward agent can propose a new rule to automate this next time. For instance, noticing “\*\_v\#” (v plus number) in many budget file names, we might add a rule: `name_regex: "budget_v\\d+" → BUDGET_DRAFT slot` with a moderate weight. Similarly, if two rules were firing on the same files (like our earlier *CallSheet* vs *CrewList* conflict) and a human consistently chooses one category, we adjust the rules: maybe narrow the regex of the incorrect rule or lower its weight, and/or create a new rule specifically for the other case. These changes are presented for approval (perhaps as suggestions in an admin UI). Upon approval, the **TaxonomyProfile is updated**: behind the scenes, that means updating the properties of the `TaxonomyRule` nodes or adding new ones, and possibly deactivating the problematic rule. Because the taxonomy is data-driven, such updates take effect immediately for subsequent file ingests. Over time, with each feedback loop, the profile “learns” the organization’s quirks – reducing future ambiguities. The goal is that after a sufficient learning period, **most files get auto-classified with no human intervention**.

**Audit and Traceability:** We ensure each classification action is logged. When a rule auto-tags a file, we could annotate the File→Slot relationship with metadata like `classified_by: "rule123"` and confidence. Likewise, manual classifications can be tagged with `classified_by: "user"` and the user’s ID. Additionally, we plan to log an event in the Provenance/Audit layer for each automatic action[Google DriveGoogle Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c) – e.g., a “ClassificationCommit” that records *File X was linked to Slot Y by Rule Z at time T by Agent A*. This provides a trail to review why a file was categorized a certain way, which is important if a mistake is discovered later. Because all changes in the graph are versioned, the state of file classifications at any point in time can be reconstructed (for example, if rules evolve, we can see how a file might have been classified under an older profile vs the new one).

**Performance Considerations:** The deterministic step is very fast – just iterating through a list of regexes. We will optimize by short-circuiting when a definite match is found. Also, rules can be arranged by descending weight or specificity, so the most likely ones are tried first. The ML step is heavier. If using a local model, it involves computing features (which is quick) and running a prediction (fractions of a second). If using an LLM API, that could introduce a 1-2 second latency per file and some cost. To mitigate impact on the sync pipeline, we might not want to block the main file sync transaction on an LLM call. Instead, we could enqueue low-confidence files for asynchronous processing. For example, the sync worker could tag the File node with `pending_classification=True` and let a background worker or the AI Orchestrator pick it up. In the initial implementation, however, a simpler route is to do it inline for each file event, since most rule-based matches will resolve quickly, and only a subset will hit the ML path. We will also batch or rate-limit classification if a large number of files arrive at once (to avoid storming the ML service).

**Example Walk-through:** Let’s apply the algorithm to a concrete scenario. A new file is added: `/ProjectX/Finance/Cost Report Q2.xlsx`. The ProjectX profile has no explicit rule for “Cost Report” (gap in rules). Rule scan: maybe a rule for “Finance” folder exists that guesses Budget category with weight 0.7 – but assume none matches confidently. ML step: the model sees tokens `["Cost", "Report", "Q2"]`, file extension `.xlsx`, and folder “Finance”. It predicts this file is likely a **Budget** slot with 60% confidence or a **Financial Report** slot with 30%. 60% is below our threshold, so the system defers to human. A task “Classify file ‘Cost Report Q2’” is raised with options (Budget vs Financial Report). The user responds that it’s a **Budget** document. The system then links the file to the **Budget** CanonicalSlot (creating `(:File)-[:CANONICAL_SLOT]->(:CanonicalSlot {name:"BUDGET"})`). It also notes that a lot of “Cost Report” files are being marked as Budget. The File Steward agent recommends a new rule: *if filename contains “Cost Report” → Budget slot, weight 0.9*. The admin accepts, so we add a TaxonomyRule node with `name_regex: "cost report"` to ProjectX’s profile. Now, similar files in the “Finance” folder will be auto-classified as Budget going forward.

By combining deterministic rules with an ML fallback and human review, the system achieves both **precision** (when patterns are known) and **recall** (when encountering novel patterns). Over time the deterministic coverage grows, pushing more files into the fully automated path. This approach is also resilient to change: if a production starts introducing a new document type or naming style, the ML will catch it and flag it for incorporation into the taxonomy. In real deployments, such a blend of rules and AI is proven effective – e.g., Dropbox found that a purely rule-based approach to file naming was insufficient at scale due to the endless variations of user filenames, so they augmented it with machine learning to recognize patterns like dates that rules struggled with[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c)[dropbox.tech](https://dropbox.tech/machine-learning/using-ml-to-identify-date-formats-in-file-names#:~:text=At%20first%2C%20we%20tried%20a,based%20approach%20were%20used). Likewise, modern document classification systems use content analysis and AI to outperform simple manual tagging[Google Drive](https://docs.google.com/document/d/1fQ9L_L8-qHWffY3_CDh0InZlXEK_EPTCZit3l7yd12c). We leverage these insights to ensure our file mapping is robust, accurate, and continuously improving.

---