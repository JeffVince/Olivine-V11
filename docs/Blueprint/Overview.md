# **Unified, Versioned Knowledge Layer for Creative Production**

**Purpose:** Create a **unified, versioned knowledge layer** for creative production that normalizes messy file systems and evolving creative realities into a single, queryable **graph**. This graph powers reliable automation (e.g. generating call sheets or triggering purchase orders/payroll) across any folder taxonomy, any region’s paperwork, and any project’s bespoke needs—**with auditable AI actions** recorded at every step. In short, we aim to bring order and traceability to the chaos of production data.

## **Vision**

We envision a **living production operating system** built on a knowledge graph where multiple “realities” of a production are synchronized and versioned together:

* **File reality** – the raw files/folders on Dropbox, Google Drive, or Supabase – is normalized into a **File Ontology** (a structured representation of storage assets).

* **Creative reality** – the conceptual world of scenes, scripts, characters, props, cast/crew, schedules, stunts, etc. – is captured in a **Content Ontology**.

* **Operational reality** – the business and compliance layer (purchase orders, invoices, timesheets, payroll, union rules, insurance) – is managed via an **Ops Ontology**.

* **Agent reality** – the record of decisions, AI tool actions, and who/what/why of changes – is logged in a **Provenance/Audit Ontology**.

All these layers coexist in one graph, and **everything is versioned, diffable, and branchable**. Mid-project changes can ripple through safely with full traceability, because every change is tracked as a new version rather than overwriting history. In addition to versioning node properties, **we version any relationship whose truth changes over time (e.g., schedules, assignments, file↔slot classifications) by reifying it as a first‑class EdgeFact with valid time, while keeping "current" convenience relationships materialized for fast reads.** This ensures that the state of any "reality" at any point in time can be reconstructed or branched, enabling what-if experiments and safe rollbacks .

## **Value**

By implementing this system, we deliver several key benefits:

* **Consistent automation across chaos:** Regardless of how chaotic or different the source folder structures are, the system’s agents can generate the same quality outputs (like call sheets) by referring to the canonical graph. The knowledge layer acts as a stability buffer so that automation doesn’t break when files are organized differently at each studio.

* **Fewer costly errors:** With provenance tracking and validation rules in the graph, mistakes like using the wrong pay rate, scheduling the wrong crew member, or sending people to the wrong location are caught early. Every piece of data is linked to its source and context, preventing disconnects. Provenance provides an audit trail for each suggestion or change (who made it, using which inputs), making it easier to verify and avoid errors.

* **Faster onboarding of new projects/regions:** New studios or regions with their own folder naming conventions and paperwork can “just work” through learned **mapping profiles**. The system learns how each organization labels and stores their files (e.g. what a “script draft” file looks like in their naming scheme) and maps it to the canonical model. This significantly reduces the setup time for adopting the platform in a new production environment.

* **Defensible audit trail:** Every suggestion or change by the system (or users) is captured as a signed, queryable **commit** with the inputs that led to it, the outputs, and any approvals. This is akin to version control for production data. It provides a complete history of who/what/when for each decision, satisfying audit requirements out-of-the-box . In other words, we get full data lineage (what data was used, how it changed) and a complete commit graph of all interactions – an “audit log in a box” .

---



Bringing it all together, the product delivers at its core:

1. **Canonical Production Model (CPM):** A stable, unified knowledge graph of the production – scenes, schedules, files, finances, etc. – that remains consistent regardless of source data formats. This **single source of truth** model allows all downstream processes (scheduling, budgeting, reporting) to work off the same data structure.

2. **Adaptive Mapping Profiles:** The system learns each organization’s “dialect” of file management and maps it into the canonical model. These mapping profiles are transparent and editable, reducing setup time for new projects. Over time, the system might come with a library of profiles for common setups, making onboarding largely configuration-free.

3. **Provenance Ledger:** Every change is tracked with Git-like commits and action logs. This provides full **data lineage** – one can always ask “how did this data point get here?” and get an answer . It’s not just logs, but queryable provenance. This makes the automation trustworthy and auditable, which is essential when AI is in the loop suggesting things.

4. **Deterministic Automations:** Automation agents (like the Call Sheet generator, compliance checker) act only when their prerequisites are met and log everything they do. They behave deterministically given the same inputs. This means results are reproducible, and agents can be tested on branches safely. The combination of AI and rules is done in a controlled manner – for instance, using AI to parse text but always verifying outputs and requiring human confirmation for novel situations. The focus is on reliability in production use, not just AI magic.

5. **Safe Evolution of Data and Schema:** The system embraces change – whether it’s a mid-project pivot or a whole new kind of data to track – through versioning and branching. Users can accept or reject changes in a governed way (similar to code merges). The ontology can evolve without breaking older data, thanks to versioning and careful migration. This means the knowledge graph can start small and gradually expand to handle more aspects of production as needed, all without losing consistency or traceability.

In essence, this platform becomes a **production brain**: it learns the project’s details, remembers everything with context, assists in planning and logistics, and never forgets why a decision was made. By normalizing chaotic inputs and tracking all outputs, it enables a new level of automation in filmmaking that is consistent, error-resistant, and explainable .
