## 4\. Novelty Detection & Adaptive Schema

**Goal:** The system can dynamically extend its ontology when it encounters new concepts (“novelty”) that don’t fit the current graph schema, while keeping these schema changes controlled, versioned, and auditable. In practice, this means when an agent or user introduces a new entity type, relationship, or attribute that wasn’t anticipated, the platform will detect it, propose a schema update, vet that update (via an AI curator or human approval), apply the change (creating or updating meta-nodes to represent the new schema elements), and log the change as a versioned commit. This ensures the knowledge graph remains a **living model** that can evolve with creative productions, without chaotic growth.

### 4.1 What Counts as “Novel”?

**Novelty** refers to any data element or concept that does not cleanly map into the current ontology. Common categories include:

* **New Entity Type:** A class of object not yet represented as a node label in the graph. For example, a production might involve an “Underwater Unit” – a secondary filming unit for underwater scenes – with a specialized crew role “Underwater Safety Diver” . If our Content Ontology did not have an entity type for “Unit” or a CrewRole for “Underwater Safety Diver,” these would be novel entity types. Another example: a concept of a “RiggingTeam” as a distinct group of crew members (beyond individual CrewMember nodes) might emerge and not correspond to any existing label . New entity types typically manifest as nouns or categories that an LLM or user tries to insert which have no corresponding node label in the graph.

* **New Relationship Type:** A connection between entities that hasn’t been modeled before. For instance, imagine our schema originally doesn’t include anything about permits for shooting. If a scene requires a special filming permit, one might naturally want to model a relationship :REQUIRES\_SPECIAL\_PERMIT from a Scene node to a Permit node . If neither that relationship type nor the Permit node type exist in the ontology, this is novelty. New relationship types often surface when domain rules or workflows introduce new linkages (e.g. a “needs X” or “reports to Y” relationship that wasn’t in the initial design).

* **New Property on an Existing Entity:** An attribute that becomes relevant for an entity type but wasn’t previously captured. For example, say we have Prop nodes (props used in scenes) and later discover we need to mark whether a prop requires batteries (a boolean flag). If Prop.requires\_battery was never part of the schema, encountering this requirement means a new property needs to be added to the Prop entity definition . Similarly, a Character node might need a new property like accent if dialogue accent becomes relevant. These attribute novelties might be suggested by users or by an AI noticing patterns (e.g., “the AI attempts to record an attribute that doesn’t exist in the node’s definition”).

In short, any time the system encounters data (from an ingestion pipeline or user query) that it **cannot map into the existing graph schema** – whether it’s an unrecognized node label, an unknown relationship type, or an unexpected node property – it is treated as a **novelty event**. Rather than dropping it or forcing it into an incorrect placeholder, the system will initiate a schema adaptation process.

*Implementation Note:* The detection of novelty can occur at various points. For structured data ingestion (e.g. syncing from Supabase or a spreadsheet), the sync logic can check if an incoming record’s type or fields exist in the graph schema. For unstructured inputs processed by LLMs (e.g. script breakdown results, user natural language requests), an agent can be prompted to flag any entities or relations it “wants” to create that don’t exist yet. For example, the **LangGraph worker** that parses a screenplay could keep a list of known entity labels and relationship types; if the LLM returns an object with a category “RiggingTeam” which isn’t in that list, the code would flag it as novel instead of blindly calling neo4j\_client.upsert\_node("RiggingTeam", ...). Currently, the breakdown code simply categorizes everything into a few broad types (BreakdownScene, BreakdownCharacter, ProductionElement, etc.) and uses a generic element\_type field for sub-type classification  . There is **no check** yet for whether element\_type is from a defined list – any string (like "Underwater Equipment") would just be stored as a property . This is a **GAP:** novel categories pass through unrecognized. **FIX:** Introduce a check against a registry of allowed element\_type values or known ontology labels. If element\_type is unrecognized (e.g. "Underwater Unit"), the pipeline should create a TypeDefProposal (see below) instead of treating it as a regular ProductionElement. In general, similar validation hooks should be added wherever data enters the graph: before calling any Neo4j MERGE on a label or setting a property, ensure the schema knows about it.

#### 4.2 How Schema Adaptation Works

When a novelty event is detected, the system does **not** immediately alter the graph structure. Instead, it goes through a controlled workflow to **extend the schema**. The schema itself is modeled in Neo4j as data – we maintain meta-nodes that describe the ontology – so the adaptation is done by manipulating those meta-nodes. The workflow involves creating a proposal, having it reviewed (by an AI curator agent and/or a human), then applying the changes and versioning them. We detail each step below:

#### 4.2.1 Creating a Schema Change Proposal (TypeDefProposal)

The first step is to log the novelty in the graph as a proposal for a schema change. When an agent or process encounters a new concept, it will create a **TypeDefProposal** node in Neo4j describing the suggested addition or modification to the schema . This proposal serves as a structured request for an ontology update, capturing what the novelty is and why it may be needed. The properties of a :TypeDefProposal node typically include:

* label: The name of the proposed new type or the label of the entity/relationship in question (e.g. "RiggingTeam").

* kind: What kind of schema element it is (e.g. "NodeType", "RelationshipType", or "Property"). This could also be inferred by context, such as whether label corresponds to a node label or a relationship.

* rationale: A text explanation of why this schema change is needed. This might be a generated description citing the source of the novelty. For instance, “Detected references to a ‘Rigging Team’ in project Alpha; currently no node represents a team of crew, so proposing a new entity type.” The rationale can be provided by the LLM or the code that noticed the gap.

* sample\_count: How many instances or references were found that prompted this proposal. E.g. sample\_count \= 5 if five separate mentions of “Rigging Team” were encountered in data or five Prop records had a requires\_battery field.

* Timestamps and IDs: e.g. created\_at (when the proposal was created) and perhaps a unique id or reference to the workflow that created it (to trace back to the event or dataset that triggered this proposal).

The proposal is created in the graph via a Cypher query. For example, if an LLM agent finds an unknown term “RiggingTeam”, the LangGraph worker could execute:

```
CREATE (p:TypeDefProposal {
  label: $newType, 
  kind: $kind, 
  rationale: $explanation, 
  sample_count: $count, 
  created_at: datetime()
})
RETURN p;
```

In our running example, $newType \= "RiggingTeam" and $kind \= "NodeType". The system would bind $explanation to a text explaining that *RiggingTeam* appears to be needed (the agent might generate: “The script mentions a Rigging Team which isn’t represented as a node; possibly a group of riggers working together.”). This Cypher is conceptually shown in the design doc . After running this, we’d have a node in Neo4j like:

* **(p:TypeDefProposal {label: “RiggingTeam”, rationale: “…”, sample\_count: 5, created\_at: 2025-08-10T…})**.

**Note:** *Currently, this proposal-logging mechanism is not yet implemented – a **GAP**. The Neo4j schema and code as of now do not define any TypeDefProposal nodes or related meta-structures. A search of the repository confirms no mention of TypeDef classes or nodes in code.* The intent for such dynamic schema handling is documented (e.g. the migrations README hints at “dynamic node types and their constraints” ), but no concrete code exists. **FIX:** We need to implement this. Likely, this means adding a Cypher migration to introduce a TypeDefProposal label (no special constraints needed beyond maybe an index on label or a UUID), and updating the LangGraph worker’s pipeline. Specifically, in services/langgraph/.../scene\_sync\_service\_neo4j.py, before creating nodes, insert checks: if element.element\_type (or any AI-identified label) is not recognized, call a function like neo4j\_client.execute\_write("CREATE (p:TypeDefProposal {...})", params) to insert the proposal, and *do not create* the unrecognized nodes yet. The proposal node itself can hold the raw name of the type and context for later review.

After creating the proposal node, the system should **halt or defer** the actual creation of the novel entities until the schema is updated. For instance, if the ingest process was about to create (:RiggingTeam) nodes or relationships with type REQUIRES\_SPECIAL\_PERMIT, it will instead put those on hold (e.g. accumulate them in memory or store them as pending). One approach is to create temporary placeholder nodes with a generic label like :TempEntity or :Unmapped and a property pointing to the intended label. The design doc suggests using a “holding area” or temporary storage . For example, we might do:

```
// Temporary placeholder for an unrecognized entity
CREATE (x:UnmappedEntity { temp_label: "RiggingTeam", name: "Rigging Team Alpha", project_id: "Proj123", created_at: datetime() })
```

This way, the actual data isn’t lost – we know an entity was supposed to exist – but it’s not yet a first-class RiggingTeam node. The TypeDefProposal can even have a relationship to such placeholders for context, e.g. (p)-\[:EXEMPLAR\]-\>(x) for a sample instance that motivated the proposal.

#### 4.2.2 Ontology Curator Review & Approval

Once a proposal is logged, it triggers a review process. The system design includes an **Ontology Curator Agent** – essentially an AI (or rule-based logic) that oversees schema governance . This Curator Agent is responsible for evaluating TypeDefProposal nodes and deciding what to do with them. The steps are:

1. **Notification:** The creation of a TypeDefProposal should send an event or message to the Curator Agent. Implementation-wise, this could be a Pub/Sub message (if using something like RabbitMQ or a Neo4j event subscription). For example, the LangGraph worker could publish a message like "ontology\_proposal\_created" with the proposal details, which the Curator listens for. (Currently, there is no such event bus message defined – **GAP** – we will need to add a RabbitMQ topic or a direct call to the curator logic whenever a proposal node is created. A simple approach is polling Neo4j for new :TypeDefProposal nodes, but real-time messaging is preferable.)

2. **Automated Evaluation:** The Curator Agent fetches the proposal node and applies a set of ontology governance rules to it . These rules might include:

   * **Duplication check:** Ensure the proposed label or relationship isn’t essentially a duplicate of something we already have, perhaps just named differently. The agent might do a similarity check between "RiggingTeam" and existing labels (maybe we already have “RiggingCrew” or some such). If it’s a close match, the agent might decide no new type is needed, but rather suggest using the existing one.

   * **Fit-within-model:** Determine if the concept could be represented with existing constructs. For example, the curator might recognize that a *Rigging Team* is not fundamentally a new entity type but could be represented as a group of CrewMembers with role “Rigging”. The design doc explicitly gives this example – maybe *RiggingTeam* should be modeled not as a new label but as a grouping of crew roles . The curator’s logic (possibly powered by an LLM with knowledge of the ontology) would update or adjust the proposal accordingly. It might change the proposal’s recommended action from “Add label RiggingTeam” to “Use existing CrewMember/CrewRole and perhaps add a relationship or attribute to denote team membership”. This could be captured by adding an alternative field in the proposal or creating a new proposal for a different change.

   * **Completeness of definition:** If it is indeed a new type, ensure the proposal defines the basics: what properties should instances of this type have? What other entities will it connect to? The proposal might initially only have label and rationale. The Curator agent can enrich it. For a new node label, it could suggest a set of properties (maybe none beyond an id and name if not obvious) and what existing types it links with. E.g., for "Permit" relationship proposal, the agent might note: “Proposing new node type Permit with properties (permit\_id, type, expiration\_date) and new relationship type REQUIRES\_SPECIAL\_PERMIT from Scene to Permit.” This turns one proposal into effectively two schema changes (new node and new rel). The curator could handle it as a combined proposal or split it into multiple linked proposals.

   * **Business rules:** Some schema changes might violate domain rules. For instance, if a proposal tries to add a property that should be modeled differently. Or perhaps the company has decided not to track certain data for privacy or scope reasons. The Curator could flag those. (In practice, this could involve a static ruleset or even an AI prompt: “The system doesn’t allow adding properties that store raw personal data – if the proposal is to add CrewMember.ssn, reject or escalate.”)

   * **Safety / Performance:** The curator might also assess if the change could cause performance issues (probably not applicable unless it’s something like “every Scene links to every other Scene” kind of relationship which would be weird and likely flagged in design, not by the AI automatically).

3. **Decision (Auto-Approve or Escalate):** Based on the above evaluation, the Curator has a few options :

   * **Auto-approve:** If the proposal is straightforward, low-risk, and clearly beneficial, the agent can approve it immediately. The design guidelines say minor property additions might be auto-approved . For example, adding Prop.requires\_battery (a boolean) could be considered low impact: it doesn’t introduce new nodes or relationships, just extends an existing type with an optional field. The agent might verify the field name and type (ensuring it’s not conflicting with existing property names) and then mark it approved.

   * **Modify and approve:** In cases where the initial proposal wasn’t ideal but the Curator can fix it automatically, it might adjust the proposal and then approve. For instance, if the user asked for a new type “BackgroundActor” but we already have a concept of “Extra” in the ontology, the agent might decide no new label is needed; instead, perhaps mark it as an alias. The Curator could attach a note or transform the proposal into “add alias or attribute indicating Extra of subtype BackgroundActor” – though representing that in the schema might be complex. More commonly, the Curator might, say, change the label to a singular form or conforming naming convention (e.g., ensure labels are CapitalCase). After modification, it would proceed to approve.

   * **Escalate to Human:** If the proposal is non-trivial, or the Curator is not confident (e.g., a brand-new entity type that could significantly alter the data model, or an ambiguous case where domain expertise is needed), it will pause and request human review . This could involve creating a task in an admin UI or sending a notification/email to a designated “Ontology Manager” role. For example, the agent might produce a summary: “**New Ontology Proposal:** A node type VirtualScene is suggested (the AI found references to virtual reality scenes). This could be a major schema extension. Please approve or reject.” The human can then decide and maybe input their decision via an admin interface or CLI.

In the current implementation, there is **no Ontology Curator agent yet** – this is a conceptual component (another **GAP**). We have to implement an asynchronous process or service that can handle these proposals. A practical plan is to integrate it into the **LangGraph worker** or a dedicated **ontology-worker**:

* We could treat the Curator as a specialized LangChain agent (if we’re using LLMs) that runs a prompt when triggered. For instance, feed the proposal node’s data into an LLM prompt like: *“You are an ontology curator. The current schema has X, Y, Z. We got a proposal to add type ‘RiggingTeam’. Evaluate if it’s valid or if it overlaps with existing types… Respond with approve/reject and any adjustments.”* The response could then be parsed and applied.

* Alternatively, implement some deterministic rules in code (for simple cases like property additions and known duplicates).

* The system should mark the proposal node with the outcome: perhaps add a property status: "approved" | "rejected" | "modified" and maybe approved\_by: "auto" | "human" and a timestamp. If modified, it might link to a new TypeDefProposal or update the existing one’s fields.

For the scope of this design, we assume the Curator’s logic does its job and we end up with an **approved schema change** (possibly after human intervention). Only after approval do we proceed to actually change the schema.

#### 4.2.3 Applying Schema Changes and Migrating Instances

Upon approval, the system **executes the schema change** in the graph. Since Neo4j is schema-optional, “executing a schema change” really means updating our **ontology metadata** (the TypeDef nodes, Schema version, constraints, etc.) and then creating any real nodes/relationships that were pending.

**Schema Registry and TypeDef Nodes:** We represent the **current schema version** in the graph via a special node or nodes often referred to as a **Schema Registry**. In our design, each node label in the ontology has a corresponding **:TypeDef node** describing that label . Think of TypeDef nodes as **meta-nodes**: they are nodes whose instances describe the *types* of other nodes. For example, we might have:

* (td\_scene:TypeDef { label: "Scene", version: 1, properties: \["scene\_number","location", ...\], relationships: \["COVERS"-\>"ShootDay", "HAS\_CHARACTER"-\>"Character", ...\] })

* (td\_prop:TypeDef { label: "Prop", version: 1, properties: \["name","requires\_battery", ...\], relationships: \["USED\_IN\_SCENE"-\>"Scene"\] })

The exact data model for TypeDef is up to us. We could store allowed property names and relationship types as list properties on the TypeDef node, or we could create sub-nodes or relationships for them:

* **Property definitions:** We might create nodes like (:PropertyDef {name:"requires\_battery", type:"Boolean", required:false}) and connect them via (td\_prop)-\[:ALLOWS\_PROPERTY\]-\>(propDef). However, that might be overkill unless we want to enforce types strictly. Neo4j itself doesn’t enforce property types beyond constraints we set. A simpler approach is to have an array property: td\_prop.property\_keys \= \["name","requires\_battery", ...\]. This is more lightweight and can be updated in one query when we add a new property.

* **Relationship definitions:** We definitely need to capture what relationships are allowed from a given type (and possibly to a given type). One elegant way: use relationships between TypeDef nodes to represent allowed edges. For example, (td\_scene)-\[:ALLOWED\_OUT {type:"REQUIRES\_SPECIAL\_PERMIT"}\]-\>(td\_permit) could indicate that Scene nodes may have an outgoing REQUIRES\_SPECIAL\_PERMIT relationship to Permit nodes. Similarly, one could add ALLOWED\_IN in reverse, or just infer the inverse from the existence of ALLOWED\_OUT on the source type. Alternatively, store on one side: e.g. td\_scene.outgoing\_rels \= \["REQUIRES\_SPECIAL\_PERMIT:Permit", "COVERS:ShootDay", ...\]. We will need to choose an approach and remain consistent.

Now, when a proposal is approved:

* **If it’s a new Node Label:** We create a new :TypeDef node for that label. For example, approval of “RiggingTeam” means executing something like:

```
MERGE (t:TypeDef { label: "RiggingTeam" }) 
ON CREATE SET t.version = $newVersion, t.created_at = datetime(), t.properties = [], t.outgoing_rels = []
```

*   
  We then might connect it to a central (:Schema {current\_version: $newVersion}) node via (t)-\[:SCHEMA\_VERSION\]-\>(schemaNode) or attach it to a versioned schema node. In our design, we could simply update a singleton schema node’s version property to $newVersion (indicating the schema as a whole has advanced) . The design doc suggests connecting the new TypeDef to a Schema node , which implies possibly a structure like (schema:Schema)-\[:HAS\_TYPE\]-\>(t) and the schema node has an updated version property.

   Additionally, we likely want to add a **unique constraint** for instances of the new label. In practice, most node types have an id field we use as a primary key. For example, in our Neo4j setup, File.id and Folder.id have unique constraints . For a new label, we should decide on its primary key. Often it’s just id as well (perhaps a UUID or composite key). For consistency, we might enforce that *every* node has an id property unique within its label. So as part of adding RiggingTeam, we’d run:

```
CREATE CONSTRAINT ON (n:RiggingTeam) ASSERT n.id IS UNIQUE;
```

*   
  (In Neo4j 4+ this syntax is slightly different, but conceptually that.) This could be done via our migration system or dynamically via the Neo4j driver. Our Neo4jClient can execute arbitrary Cypher, so the system could call an admin function to add such a constraint. In code, we might incorporate it in the **migrations** process. Since migrations in infra/neo4j are typically run at startup, a dynamic schema change could either (a) run an ad-hoc migration script or (b) use Neo4j’s built-in transaction to create the constraint. Creating constraints at runtime is possible as long as the executing user is admin.

   **GAP:** Right now, there is no code path for adding new constraints or TypeDef nodes dynamically. **FIX:** Implement an **OntologyService** (could be part of the sync or a new service) that, given an approved schema change, uses neo4j\_client.execute\_write to run the needed Cypher (MERGE the TypeDef node, set properties, and call CREATE CONSTRAINT ...). This service would be invoked by the Curator agent upon approval. We must ensure proper error handling (if constraint creation fails or if label already existed, etc.). Note that adding a label on the fly in Neo4j doesn’t require server restart or anything – it’s immediate.

* **If it’s a new Relationship Type:** We don’t have a separate RelationshipType entity in the graph; the relationship type is identified by name. To “add” a relationship type in Neo4j, we don’t need to declare it beforehand (it’s created on first use). However, our ontology metadata should record it. If the proposal was for :REQUIRES\_SPECIAL\_PERMIT relationship from Scene to Permit, upon approval we must update the TypeDef of Scene to include that allowed outgoing relationship, and possibly update Permit’s TypeDef to include it as an allowed incoming relationship. For example:

```
MATCH (td_scene:TypeDef { label: "Scene" })
MATCH (td_permit:TypeDef { label: "Permit" })
SET td_scene.outgoing_rels = td_scene.outgoing_rels + "REQUIRES_SPECIAL_PERMIT:Permit",
    td_permit.incoming_rels = td_permit.incoming_rels + "REQUIRES_SPECIAL_PERMIT:Scene"
```

*   
  (If we choose a structure where we explicitly store incoming/outgoing relationships. Alternatively, we could create a (:RelationshipDef {type:"REQUIRES\_SPECIAL\_PERMIT"}) node and do (td\_scene)-\[:ALLOWS\_REL\]-\>(relDef)-\[:TARGET\]-\>(td\_permit). This is more normalized but more complex to query. Storing strings might be simpler.)

   The system then also needs to **instantiate any pending relationships** of that type. For instance, if we had delayed linking Scene 5 to a Permit node “LA City Film Permit \#123” because the rel type didn’t exist, now we can create that relationship. Likely, we had created the Permit node itself as a placeholder or actual node (if Permit node was also new, that would have been another part of the proposal – in this case, Permit is a new entity type too, which would have its own TypeDef created as above). Now that both the Scene TypeDef and Permit TypeDef are updated, we can safely do:

```
MATCH (s:Scene { id: $sceneId }), (p:Permit { id: $permitId })
MERGE (s)-[:REQUIRES_SPECIAL_PERMIT]->(p);
```

*   
  for each pending relationship that was waiting.

* **If it’s a new Property on an Existing Type:** We update the TypeDef for that type to include the property. For example, adding requires\_battery to Prop:

```
MATCH (td_prop:TypeDef { label: "Prop" })
SET td_prop.properties = td_prop.properties + "requires_battery";
```

*   
  Additionally, we might want to add a **default value** or update existing nodes. If requires\_battery is meant to be a boolean with default false, we should consider updating all existing Prop nodes in the graph to set a value (to avoid NULL vs false confusion). Neo4j doesn’t have true NULLs (absence of a property is akin to null). We could decide that absence means false in this case and not actually add the property to all, to save storage. But if we prefer explicit consistency, we could run:

```
MATCH (n:Prop) WHERE n.requires_battery IS NULL
SET n.requires_battery = false;
```

*   
  This can be done in the same transaction as schema update, or separately as a data migration. Because such a bulk update might be expensive on many nodes, the curator might have threshold criteria (e.g. if there are fewer than N existing nodes, just set the default; if many, perhaps leave it lazy). For audit, it might be better to treat setting default values as part of the schema-change commit as well (discussed below).

   If the property addition is something like an **enumeration extension** (e.g., a new valid value for an enum field), that might not reflect in TypeDef node unless we choose to store allowed value domains in the schema. In our current approach, we haven’t explicitly modeled value domains in Neo4j (except via constraints possibly). If crew roles were an enum and we add a new role, if we were storing roles as free-text properties, the schema change might simply be adding a note in documentation. But since we plan to eventually have CrewRole nodes or at least a controlled list, we would likely model roles as either TypeDef or as a static lookup list. In any case, adding an enum value could be handled by, say, updating a constraint or list in code rather than in graph. (This highlights that some schema changes might also necessitate code changes; more on that in integration considerations).

After updating the ontology metadata (TypeDef nodes and related constraints), the system **instantiates any pending instances** that were held back . Using our earlier examples:

* If new RiggingTeam nodes were needed (say the script had references to two distinct rigging teams), we now create those nodes with the proper label. The placeholders (if we made any) can be transformed. In Neo4j, one can add labels to an existing node and remove old ones. If we created an UnmappedEntity node, we could do:

```
MATCH (x:UnmappedEntity { temp_label: "RiggingTeam" })
REMOVE x:UnmappedEntity
SET x:RiggingTeam  // add the new label
SET x.id = apoc.create.uuid()  // give it an ID if it didn’t have
```

*   
  and perhaps set any additional properties defined in the TypeDef (if the proposal suggested some properties structure, those might need initialization). Alternatively, we might drop the placeholder and create a fresh node:

```
CREATE (new:RiggingTeam { id: ..., name: x.name, project_id: x.project_id, created_at: x.created_at })
DETACH DELETE x
```

*   
  and then re-connect any relationships that x had to the new node. The method depends on complexity; using REMOVE/SET to relabel the node in place is efficient if the placeholder didn’t accumulate too many unrelated properties.

* If new relationships were pending (like Scene→Permit), we create them now as shown.

* If new property values were provided but we held off setting them (e.g., some ingest might have had requires\_battery=true on a particular prop but we didn’t store it since property didn’t exist), we can now update those specific nodes. If placeholders stored those values (maybe in a map or separate node), apply them to the real nodes.

This **migration of pending instances** ensures that none of the actual user data is lost; it was just delayed until the schema caught up. We should wrap the schema update and instance migration in a single atomic transaction if possible, or in a controlled sequence such that the system doesn’t see an intermediate state where the schema is updated but instances still missing (or vice versa). However, given that our operations might involve creating constraints (which in Neo4j autocommit outside of the typical transaction scope), we might do it in two phases:

1. Schema metadata changes (TypeDef nodes, constraints) – commit.

2. Instance migrations – commit.

    It’s not catastrophic if there’s a slight delay between them, as long as proposals are marked approved only after both phases.

#### 4.2.4 Logging the Schema Change (Versioning & Audit Trail)

Every schema modification must be **audited**. The system treats schema evolution similarly to code migrations or version control commits. In fact, our knowledge graph has the concept of a **Commit** node that logs changes (both data and schema) over time .

After applying a schema change, we create a **:Commit** node that represents that change event. For example, we might do:

```
CREATE (c:Commit {
  id: $commitId,
  message: "Ontology Update: Added RiggingTeam type",
  timestamp: datetime(),
  author: $userOrAgent,
  branch: "main",
  schema_version: $newVersion
})
```

Here, $commitId could be an auto-generated unique ID (our design might use a hash or sequence). We tag it as an ontology update in the message. We also include the new schema version number for reference. The author might be something like "OntologyCuratorAgent" or a user’s name if a human approved it.

We then link this commit to the changes:

* **Link to the Proposal:**

```
MATCH (p:TypeDefProposal { label: "RiggingTeam", status: "approved" })
MERGE (c)-[:ADDRESSED]->(p);
```

*   
  This indicates commit c addressed that proposal. We might also update the proposal node to status:"implemented" or similar.

* **Link to Schema Elements:** We connect the commit to the TypeDef nodes that were added or changed. For example:

```
MATCH (t:TypeDef { label: "RiggingTeam" })
MERGE (c)-[:CREATED_TYPE]->(t);
```

*   
  If it was an update to an existing type (like added a property to Prop), we could do (c)-\[:UPDATED\_TYPE\]-\>(td\_prop). Similarly for relationships, perhaps link to a RelationshipDef if we had one, or to both involved TypeDefs.

* **Link to Instances (if any created):** If as part of this commit we instantiated new nodes that were pending, we might log those as well. However, in our model we typically track data changes with separate EntityVersion nodes in commits. Schema commits might not need to list instance creations unless needed for debugging. But consider that if an agent had held off creating some actual nodes, when it creates them now, those creations themselves could be recorded as part of this commit. For example, adding two RiggingTeam nodes could either be part of this schema commit or be separate commits right after. A clean way: treat the schema commit as purely the ontology change, and have a subsequent commit (maybe in the same sequence) for “Added 2 RiggingTeam entities”. But that’s an implementation detail. For simplicity, we can include them in one commit if it’s easier: e.g. commit message “Added RiggingTeam type and instantiated 2 RiggingTeam nodes in project Alpha”.

By logging a commit, we ensure **auditability**: anyone can later query “when was the schema last changed, and why?” The commit will have the message and link to the proposal (which contains the rationale and references) . This satisfies the requirement that schema changes themselves are tracked just like data changes . In a sense, our system’s commit history is like a **migration history**.

The design calls for the commit graph to be a DAG, like git, with possible branching . In terms of schema, we likely keep schema changes on the main branch (since having diverging schema on different branches would complicate merges massively). We increment a global schema version (e.g., an integer). The Schema node’s current\_version property is updated to this new number. The Commit node might also carry schema\_version: 7 (meaning after this commit, we’re at schema version 7). Previous commits would have older version numbers.

**Important:** All of this is presently not implemented – our codebase doesn’t yet have Commit nodes or version tracking for schema (the commit concept is described in the research doc but the actual Neo4j setup has no :Commit nodes as of V1). We will need to implement the commit logging mechanism. Possibly, we can reuse the idea of an *audit log* that might already exist for data changes. (For example, if Supabase outbox pattern is used, maybe they intended to make commit nodes for those changes. But nothing in the migrations suggests commit nodes, so likely not done yet.) **FIX:** Add a Neo4j migration to introduce a Commit node and related constraints (like Commit.id unique). Then ensure that every schema change operation we perform also creates a Commit node and relationships. This could be done by the same OntologyService or Curator after applying changes. We might encapsulate it in a single Cypher transaction that creates the commit and links, along with the actual TypeDef changes – or do it right after in code.

After the commit is logged, the system can mark the proposal as **closed**. Possibly, move the TypeDefProposal node to a different label (:TypeDefProposal:Approved or set a status property). We keep it for audit, but it’s not “open” anymore.

Finally, the system should notify relevant parties that the schema has changed. For instance, if the front-end or other services maintain caches of the schema (or if they rely on generated TypeScript types or Pydantic models), those might need update. In a fully dynamic system, one could imagine hot-reloading a GraphQL schema or informing the client that a new entity type exists. Right now, our application is not that dynamic – e.g., our front-end likely has no notion of a “RiggingTeam” unless explicitly programmed. So a schema change might not immediately reflect in UI features. However, since much of the querying is done via the graph, an LLM agent could start using the new type in its Cypher queries (if it has the context). There is a potential need to sync the updated ontology to any AI prompt context or type systems:

* **Documentation Update:** We might regenerate the ontology documentation that agents use. Perhaps the LLM is given a summary of ontology types. After a schema change, the system should update that summary (this could be a prompt template that reads the TypeDef nodes and produces a text snippet for the AI).

* **TypeScript/Pydantic:** If we maintain parallel classes for each node type, adding a new type would require code generation or developer action. Given this is meant to be adaptive at runtime, we might lean towards not having a hard-coded class for every type. Instead use generic structures (like graph queries that don’t need a typed model). In our case, the Neo4jClient upsert functions are generic by label and don’t require a schema class . This is good – it means our back-end can handle a new label in storage without code change (the MERGE query will just create it ). But the application logic may not know how to interpret it unless it was designed to be generic. This is a limitation to be aware of: **GAP:** No runtime reflection of new types in the business logic. **Potential FIX:** Provide a generic UI view for “other nodes” or an admin console where devs can map new types to UI components later. This is outside scope here but worth noting as a future enhancement or manual step.

* **Branching Consideration:** If the production is using branching for data (e.g., alternate schedules), schema changes likely apply to all branches (ontology is global). We do not attempt to branch the ontology. Thus, commit nodes for schema updates probably go on the main branch (or all branches simultaneously). The commit DAG can still include them as normal commits (with no conflict since other branches would eventually incorporate them because you can’t merge data that uses a type unknown to another branch – that implies schema must merge first, which is complex). We might enforce that schema commits always have either no parent (if first) or are single-parent sequential in main.

To summarize, after a novelty event, the system will have:

* A new/updated **TypeDef** node in the graph (or multiple, for each type changed).

* Possibly new constraints/indexes on Neo4j for new labels or properties.

* The actual data nodes/relationships introduced (if any were pending).

* A **Commit** node logging the schema version bump and linking to the proposal and new TypeDef(s).

All these together make the graph’s ontology extendable in a controlled fashion. Over time, the ontology grows in a **versioned, auditable manner** . This is analogous to applying schema migrations in a relational database, except here the migrations can be proposed by AI observations and are executed on the live graph with history kept. The result is a knowledge graph that can keep up with emerging concepts – if tomorrow a production starts involving *virtual reality scenes*, the system can detect terms like “VRScene” or new file types, and extend the ontology to accommodate them .

It’s important to enforce a **policy of controlled growth**: we do **not** want to automatically add every odd term the AI sees. That would lead to a chaotic schema full of one-off or redundant types. That’s why the curator/human-in-loop step is critical . In practice, we might also implement thresholds (e.g., don’t even create a TypeDefProposal unless the concept appears several times or is confirmed by user input, to avoid noise from a single hallucination or typo). Our sample\_count property helps in making that decision – e.g., if sample\_count is 1 and rationale is weak, maybe queue for human review by default.

Finally, all schema changes are delivered as part of the system’s version history. This integrates with the overall **versioning, diff, and rollback** framework (see Section 5). Schema commits being in the history means if we diff a commit from before the schema change to after, we’d see the introduction of new TypeDef nodes or new properties on TypeDef nodes. Rolling back a schema change would be non-trivial (since you’d have to possibly remove or ignore data of that new type). Typically, we would *not* allow automatic rollback of schema changes via the UI – that likely requires developer intervention or a new migration to remove a type if it was mistakenly added. But the system’s audit log would at least let us trace when and how a type was added if something goes awry.

### 4.3 Example Scenario

*(To illustrate the above end-to-end, consider how a novelty would be handled in practice):*

Suppose our system is running and has an ontology for production files and content. A user uploads a new spreadsheet that lists “Underwater Unit Schedule” with crew assignments including an **Underwater Safety Diver**. The File Steward agent ingests the file and extracts that there’s a shooting unit called “Underwater Unit”. It tries to map “Underwater Unit” to an existing concept. Finding none (we only have Main Unit and Second Unit in our ontology, say), it creates a TypeDefProposal for a new node label UnderwaterUnit (with rationale “New production unit type detected from file X”). It also notices “Underwater Safety Diver” as a crew role in that unit. Our ontology didn’t list this role (perhaps roles were free text, but let’s assume we had an enum of known roles). It then creates a second proposal: maybe not a whole new label, but a proposal to extend allowed CrewRole values or to add a CrewRole node if we model roles as nodes. Both proposals go to the Ontology Curator agent.

The Curator agent reviews them:

* For UnderwaterUnit, it knows we have a concept of Units (maybe we had a generic ProductionUnit label we weren’t using explicitly). It decides this is a valid new subtype. Maybe it chooses to approve it as a new label UnderwaterUnit (subclass of ProductionUnit) or as just an instance of a generic Unit type. If it chooses a new label, it approves the proposal.

* For Underwater Safety Diver, the curator might realize this is just a specific kind of stunt diver. If roles are free text, maybe no schema change needed (just allow the string). But if we enforce roles, it might auto-approve adding this role to the enum list. Let’s say it approves adding a CrewRole node.

The system then:

* Creates a TypeDef for UnderwaterUnit (with whatever properties units have, e.g. name, location, etc., maybe inherited).

* Possibly creates a TypeDef for CrewRole if we decided to formalize roles, or just logs an update if roles are enumerated elsewhere.

* It then goes back and labels the data: the file that was ingested can now be linked properly. We create an UnderwaterUnit node representing that unit (with its name, etc.), and link crew members or scenes to it appropriately (e.g., scenes SHOT\_BY \-\> UnderwaterUnit). The Underwater Safety Diver might be added as a Crew member node with a role property \= “Underwater Safety Diver” (which is no longer novel since schema allows it now).

* Two Commit nodes are logged: one for adding UnderwaterUnit type (maybe schema version \+1), one for adding the new CrewRole (if treated as separate update). Each commit references its proposals and has messages like “Added UnderwaterUnit type to ontology” and “Extended CrewRole domain with Underwater Safety Diver”.

Now the knowledge graph has grown to include these concepts. If another project later has an Underwater Unit, the schema is ready – no novelty triggered (reusability). If a crazy new concept comes (say “Zero-G Unit” for space training), the cycle repeats, keeping the ontology evolving alongside new creative demands.

