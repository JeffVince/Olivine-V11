## **6. Security, Privacy, and Compliance**

This section establishes the security, privacy, and compliance framework for the Olivine production knowledge graph system. It defines data classification models, authorization mechanisms, secrets management, and regulatory compliance requirements to ensure secure handling of production data, crew/talent PII, and sensitive operational information.

### **6.1 Scope of PII (what we store and what we don't)**

**In‑scope PII:** limited to **Talent/Crew contact & payroll context** required for production operations:

* **Identity & contact:** full name, role, company/union affiliation, phone(s), email(s), emergency contact.
* **Work context:** rates, availability, timesheets (dates/hours/OT), union local, call times, on‑set roles.
* **No bank account numbers, full SSNs, government IDs, or images of IDs** are stored in Olivine. If needed, those live only in an integrated payroll provider and are referenced via opaque IDs.

**Document clearly** that any PII surfacing in files (e.g., PDFs in storage) is treated as **PII content**, and access is controlled via file slot + project role (see §6.2).

**Data minimization:** collect only what is needed to run call sheets, scheduling, and payroll triggers; nothing else by default.

**Doc tie‑ins:** mark **Timesheet** and **PayrollBatch** nodes as **sensitive by default** when implementing the Ops ontology (currently a GAP in the design).

### **6.2 Data classification model (per label & edge type)**

**Classification enums:** `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `PII_BASIC`, `PII_SENSITIVE`.

**Per‑label default:** add `data_classification_default` to every **TypeDef** (schema registry meta node) and **property‑level overrides** via a `property_classification` map. This uses the TypeDef mechanism described in the novelty/schema system.

**Per‑relationship type classification:** add `edge_classification_default` to relationship TypeDefs (or a parallel RelationshipDef structure).

**On instances:** add `data_classification` to **all** nodes and optionally `edge_classification` to relationships. If not set, fall back to the TypeDef defaults.

**Recommended defaults:**

* `Project`, `Scene`, `Location`, `Prop`, `Template`: `INTERNAL`
* `Crew`/`Talent`, `Timesheet`, `PayrollBatch`: `PII_SENSITIVE`
* `Invoice`, `PO`, `Vendor`: `CONFIDENTIAL`
* File slots: `CALLSHEET_*` → `CONFIDENTIAL`; `INSURANCE_COI` → `CONFIDENTIAL`; anything with contact sheets → `PII_BASIC`.

**Migration note:** add an index on `(data_classification)` for nodes; keep classification checks cheap in the gateway.

**Neo4j Schema Migration:**
```cypher
// Add data classification constraints and indexes
CREATE CONSTRAINT data_classification_enum IF NOT EXISTS 
FOR (n) REQUIRE n.data_classification IS NOT NULL 
AND n.data_classification IN ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PII_BASIC', 'PII_SENSITIVE'];

CREATE INDEX node_data_classification IF NOT EXISTS FOR (n) ON (n.data_classification);
CREATE INDEX node_project_classification IF NOT EXISTS FOR (n) ON (n.project_id, n.data_classification);

// Add classification defaults to TypeDef nodes
MATCH (td:TypeDef) 
SET td.data_classification_default = CASE td.label
  WHEN 'Project' THEN 'INTERNAL'
  WHEN 'Scene' THEN 'INTERNAL'
  WHEN 'Location' THEN 'INTERNAL'
  WHEN 'Prop' THEN 'INTERNAL'
  WHEN 'Template' THEN 'INTERNAL'
  WHEN 'Crew' THEN 'PII_SENSITIVE'
  WHEN 'Talent' THEN 'PII_SENSITIVE'
  WHEN 'Timesheet' THEN 'PII_SENSITIVE'
  WHEN 'PayrollBatch' THEN 'PII_SENSITIVE'
  WHEN 'Invoice' THEN 'CONFIDENTIAL'
  WHEN 'PO' THEN 'CONFIDENTIAL'
  WHEN 'Vendor' THEN 'CONFIDENTIAL'
  ELSE 'INTERNAL'
END;
```

### **6.3 Authorization: Attribute‑Based (ABAC) — no "open Cypher"**

**Trust boundary:** Neo4j is **never** exposed directly. **All graph access is behind a Graph Gateway service** that enforces ABAC; **no open Cypher** to clients, SDKs, or agents. Agents call the gateway with scoped tokens. This aligns with the audit/provenance plan and closes a critical security gap.

**Decision function:** `allow = f(org_role, project_role, data_classification, edge_type, ownership)`

Required request context: `principal_id`, `principal_type ∈ {user, agent, service}`, `org_id`, `project_ids`, `scopes`, `purpose` (e.g., "compose_callsheet").

**Enforcement strategy:** pre‑pend predicates to every gateway query:

* **Read:** `WHERE n.project_id IN $ctx.allowed_projects AND n.data_classification IN $ctx.allowed_classifications`
* **Relationship traversal:** block edges whose `edge_classification` exceeds caller clearance.

**Role guidance:**

* **Org Admin:** full org; no implicit access to other orgs.
* **Project Producer/Coordinator:** read/write `INTERNAL|CONFIDENTIAL|PII_BASIC` within project; **no `PII_SENSITIVE` by default**.
* **Payroll role:** read `PII_SENSITIVE` **only** for Timesheet/PayrollBatch and related Crew for the project.
* **Agents (LLM/workers):** read **INTERNAL** only unless a specific tool's purpose elevates scope (e.g., "compose_callsheet" may read `PII_BASIC` for contact rows).

**Deny by default.** Elevation requires explicit `purpose` and scope mapped in policy.

**Example Policy Configuration:**
```json
{
  "roles": {
    "project_producer": {
      "allowed_classifications": ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "PII_BASIC"],
      "denied_classifications": ["PII_SENSITIVE"],
      "scope": "project"
    },
    "payroll_admin": {
      "allowed_classifications": ["PUBLIC", "INTERNAL", "PII_BASIC", "PII_SENSITIVE"],
      "allowed_labels": ["Crew", "Talent", "Timesheet", "PayrollBatch"],
      "scope": "project"
    },
    "llm_agent": {
      "allowed_classifications": ["INTERNAL"],
      "purpose_elevations": {
        "compose_callsheet": ["PII_BASIC"],
        "generate_schedule": ["CONFIDENTIAL"]
      }
    }
  }
}
```

**Doc tie‑ins:** connect this gateway to the **Commit/Action** model so the gateway injects an **auth context** (principal, purpose, scopes) on every write. The provenance section defines Commit/Action nodes but lacks principal attribution; this section adds it.

### **6.4 Secrets management**

**Replace/clarify in File Ontology → `Source.metadata`:**

**Replace** "metadata may include provider tokens" with: **"Never store secrets/tokens in graph or Postgres. `Source` stores only a `secret_ref` (opaque string) to a Vault path; the actual credentials live in Vault/KMS."**

**Secrets management requirements:**

* Secrets in **Vault** (or equivalent KMS).
* **Short‑lived tokens only** (STS/assumed roles), rotated automatically; TTL minutes‑hours.
* **No secrets in logs, commits, or Action.inputs/outputs**; store only hashes/ids.
* For third‑party APIs, store **connection IDs**; runtime resolves via Vault.

**Source Node Schema Update:**
```cypher
// Update Source nodes to use secret references instead of direct tokens
MATCH (s:Source)
WHERE s.metadata IS NOT NULL AND s.metadata CONTAINS 'token'
SET s.secret_ref = 'vault://olivine/sources/' + s.id + '/credentials',
    s.metadata = apoc.map.removeKeys(s.metadata, ['token', 'access_token', 'refresh_token']);
```

### **6.5 Provenance/Audit: principal attribution, minimal exposure**

**Extend Section 1.4 ("Provenance & Versioning")** with these properties and rules:

**On `Commit`:** `commit_id (unique)`, `principal_id`, `principal_type ∈ {user, agent, service}`, `on_behalf_of_user_id?`, `org_id`, `project_ids`, `scopes`, `purpose`, `timestamp`, `message`. The current doc describes Commit but does not carry principal fields; this is required in the FIX path.

**On `Action`:** `tool`, `inputs_ref` (opaque reference, not raw PII), `outputs_ref`, `status`, `request_id`, `session_id`, `ip_hash`, `user_agent_hash`.

**Rule:** **Do not** embed raw PII or secrets in Action inputs/outputs; link by internal IDs/hashes.

**Agent identity:** agents must have durable `agent_id` (modeled in the "Agent reality" layer) and appear as `principal_type="agent"`.

**Enhanced Provenance Schema:**
```cypher
// Add principal attribution to Commit nodes
ALTER TABLE commits ADD COLUMN IF NOT EXISTS principal_id TEXT NOT NULL;
ALTER TABLE commits ADD COLUMN IF NOT EXISTS principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'agent', 'service'));
ALTER TABLE commits ADD COLUMN IF NOT EXISTS on_behalf_of_user_id TEXT;
ALTER TABLE commits ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL;
ALTER TABLE commits ADD COLUMN IF NOT EXISTS project_ids TEXT[];
ALTER TABLE commits ADD COLUMN IF NOT EXISTS scopes TEXT[];
ALTER TABLE commits ADD COLUMN IF NOT EXISTS purpose TEXT;

// Add audit fields to Action nodes
ALTER TABLE actions ADD COLUMN IF NOT EXISTS inputs_ref TEXT; -- replaces raw inputs
ALTER TABLE actions ADD COLUMN IF NOT EXISTS outputs_ref TEXT; -- replaces raw outputs
ALTER TABLE actions ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS ip_hash TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;

// Neo4j constraints for enhanced provenance
CREATE CONSTRAINT commit_principal_required IF NOT EXISTS FOR (c:Commit) REQUIRE c.principal_id IS NOT NULL;
CREATE CONSTRAINT commit_principal_type_enum IF NOT EXISTS FOR (c:Commit) REQUIRE c.principal_type IN ['user', 'agent', 'service'];
CREATE INDEX commit_principal_lookup IF NOT EXISTS FOR (c:Commit) ON (c.principal_id, c.principal_type);
CREATE INDEX commit_org_project_lookup IF NOT EXISTS FOR (c:Commit) ON (c.org_id, c.project_ids);
```

### **6.6 Right‑to‑erasure (GDPR/CCPA): tombstones + chain‑of‑custody**

**Erasure strategy:** **tombstone + hash chain** to preserve audit integrity while removing PII.

**On erasure request:**
1. **Replace PII fields** with cryptographic hashes (irreversible).
2. **Set `deleted_at`** timestamp and `status = 'erased'`.
3. **Preserve graph structure** and non-PII relationships.
4. **Update provenance chain** with erasure commit.

**Erasure implementation:**
```cypher
// Erasure procedure for PII nodes
CALL {
  WITH $entity_id, $erasure_request_id
  MATCH (n) WHERE n.id = $entity_id AND n.data_classification IN ['PII_BASIC', 'PII_SENSITIVE']
  
  // Create erasure hashes for audit trail
  SET n.erasure_hashes = {
    name_hash: apoc.util.sha256([n.name]),
    email_hash: apoc.util.sha256([n.email]),
    phone_hash: apoc.util.sha256([n.phone])
  }
  
  // Remove PII fields
  REMOVE n.name, n.email, n.phone, n.address, n.emergency_contact
  
  // Mark as erased
  SET n.deleted_at = datetime(),
      n.status = 'erased',
      n.erasure_request_id = $erasure_request_id
      
  // Create erasure commit for audit trail
  CREATE (c:Commit {
    id: randomUUID(),
    dedupe_key: 'erasure_' + $erasure_request_id + '_' + $entity_id,
    principal_type: 'service',
    principal_id: 'privacy_service',
    purpose: 'gdpr_erasure',
    message: 'PII erasure for entity ' + $entity_id,
    ts: datetime(),
    branch: 'main'
  })
  
  CREATE (a:Action {
    id: randomUUID(),
    tool: 'privacy.erase_pii',
    inputs_ref: 'erasure_request:' + $erasure_request_id,
    outputs_ref: 'erasure_hashes:' + n.id,
    status: 'success',
    ts: datetime()
  })
  
  MERGE (c)-[:INCLUDES]->(a)
  MERGE (a)-[:TOUCHED {mode: 'write'}]->(n)
}
```

**Chain‑of‑custody:** maintain **erasure commits** in the provenance graph to show when/why/who requested erasure, without storing the original PII.

### **6.7 Implementation Requirements**

**Schema/Migrations:**

* Add `data_classification` to core labels; update TypeDef with `data_classification_default` and `property_classification` map.
* Add Commit/Action properties above; unique constraint on `Commit.id`.
* Add `deleted_at`, `status`, `erasure_hashes` on PII nodes; ensure only one active version (`valid_to IS NULL`) still holds.

**Gateway Service:**
* Implement ABAC enforcement layer between clients and Neo4j.
* Inject auth context into all Provenance Write Path transactions.
* Block direct Cypher access; provide scoped query APIs only.

**Secrets Management:**
* Integrate with Vault/KMS for credential storage.
* Implement token rotation for external API connections.
* Remove all hardcoded secrets from configuration and code.

**Privacy Controls:**
* Implement erasure procedures for GDPR/CCPA compliance.
* Add data retention policies with automatic expiration.
* Provide data export capabilities for subject access requests.

This security framework ensures that the Olivine production knowledge graph system meets enterprise security standards while maintaining the flexibility and auditability required for complex film production workflows.
