## 8. Handling Mid-Project Changes Safely (Branch & Merge)

This section provides operational steps and UX for running schedule experiments and other mid-project changes using the branch and merge semantics detailed in Section 5.4.

### 8.1 Branch & Merge Workflow Overview

The branch and merge system enables safe experimentation with production schedules, budgets, and other critical data by creating isolated timelines that can be merged back deterministically.

**Core Workflow:**
1. Create branch `schedule_alt_X` at today's `main` head
2. Make changes (move Scenes between ShootDays). Generated artifacts (call sheets) remain on the branch
3. Merge back using **§5.4 Branch & Merge Semantics**. Expect auto-applies for disjoint moves; manual resolution if the same Scene was moved to different days
4. The merge commit closes superseded versions/facts and emits the resolved call sheet. The alternate PDF remains archived with full provenance

For full semantics, conflict units, and invariants, see **§5.4 Branch & Merge Semantics**.

### 8.2 Operational Steps for Schedule Changes

**Step 1: Create Experimental Branch**
```cypher
// Create new branch for schedule experiment
CREATE (b:Branch {name: 'schedule_alt_' + timestamp()})
MATCH (main:Branch {name: 'main'})-[:HEAD]->(head:Commit)
MERGE (b)-[:HEAD]->(head)
RETURN b.name AS branch_name;
```

**Step 2: Make Schedule Changes on Branch**
- Move scenes between shoot days using EdgeFacts
- Update crew assignments and call times
- Generate new call sheets and documents
- All changes tracked with full provenance on the experimental branch

**Step 3: Review Changes**
- Compare branch state with main using diff queries
- Identify conflicts where same entities were modified on both branches
- Review generated artifacts (call sheets, schedules) for accuracy

**Step 4: Merge Back to Main**
- Use merge API to create merge plan
- Resolve any conflicts through UI or API
- Execute merge commit that consolidates changes

### 8.3 API & UI Requirements (Minimum)

**Merge API Endpoints:**

* `POST /branches/:target/merge/:source` → starts merge, returns plan `{auto, conflicts[]}`
  - Analyzes changes between source and target branches
  - Identifies conflict units requiring manual resolution
  - Returns auto-resolvable changes and conflicts list

* `POST /merges/:id/resolve` → accepts per-unit decisions; emits merge commit
  - Takes conflict resolution decisions from user
  - Creates merge commit with resolved state
  - Updates branch HEAD and closes superseded versions/facts

**UI Components:**

* **Merge Preview Interface:** Three-column layout showing:
  - **Auto-applied:** Changes that can be merged automatically
  - **Conflicts:** Changes requiring manual resolution with base/left/right comparison
  - **Unchanged:** Entities not modified on either branch

* **Conflict Resolution Widgets:**
  - **Schedule conflicts:** Calendar picker for ShootDay assignments
  - **Budget conflicts:** Numeric input with validation for PO totals
  - **File conflicts:** File picker for document versions
  - **Crew conflicts:** Dropdown for crew assignments with availability checking

* **Domain Helpers:**
  - Scene scheduling: Visual timeline showing conflicts
  - Budget tracking: Running totals and variance calculations
  - Document management: Version comparison and selection

**Task Management:**

* **Conflict Tasks:** On conflict, create `:Task {type: 'merge_conflict'}` linked to conflict units
* **Assignment:** Assign tasks to role owners (e.g., AD for schedule conflicts, PM for budget conflicts)
* **Notifications:** Alert relevant team members of conflicts requiring resolution
* **Tracking:** Monitor resolution progress and merge completion status

### 8.4 Domain Examples

**Schedule Merge Scenarios:**

* **Disjoint moves:** Scene 18 moved from D3→D5 on branch A, Scene 22 moved D7→D8 on branch B → auto-merge both changes
* **Conflicting moves:** Scene 18 moved from D3→D5 on A, D3→D4 on B → manual resolution required
* **Crew conflicts:** Actor assigned to Scene 18 on D5 (branch A) but also assigned to Scene 22 on D5 (branch B) → scheduling conflict

**Document Generation Conflicts:**

* **Call sheet versions:** Two different generated PDFs on branches → keep **both** File nodes; on merge, link only the **resolved** one to `ShootDay` as `GENERATED_CALLSHEET`, archive the other (keep provenance)
* **Budget updates:** Divergent `PO.total` edits → hard stop & review task
* **Script changes:** Different scene descriptions → manual review and consolidation

**File Management:**

* **Classification changes:** File reclassified differently on each branch → use rule priority and confidence scores for auto-resolution
* **Document updates:** Same document updated on both branches → create conflict task for content review
* **New files:** Files added on both branches → auto-merge if different files, conflict if same path

### 8.5 Merge Test Checklist (Must Pass)

**Core Merge Functionality:**
- [ ] LCA (Lowest Common Ancestor) detection correct for linear and branched histories
- [ ] Property conflict detection per `(entity_id, property)` including identical value short-circuit
- [ ] Edge conflict detection for `COVERS_SCENE` "same Scene, different Day"
- [ ] Deterministic rule preference for File→Slot classification conflicts
- [ ] No historical node/edge mutated during merge (only new versions/facts created)

**Branch Management:**
- [ ] Fast-forward blocked when any conflict unit overlaps; allowed otherwise
- [ ] Merge commit includes `UPDATES` links to all new EntityVersions/EdgeFacts
- [ ] Merge commit includes durable `MERGE_PLAN` with resolution decisions
- [ ] Branch HEAD updated atomically after successful merge

**Conflict Resolution:**
- [ ] Manual conflict resolution preserves audit trail
- [ ] Conflict tasks created and assigned correctly
- [ ] UI shows accurate three-column merge preview
- [ ] Domain-specific helpers work for schedule/budget/file conflicts

**Data Integrity:**
- [ ] All merge invariants maintained (no parent rewrites, data determinism)
- [ ] Temporal consistency preserved across merge
- [ ] Org isolation maintained during merge operations
- [ ] Provenance chain unbroken through merge commits

**Performance & Scale:**
- [ ] Merge operations complete within SLA for typical branch sizes
- [ ] Conflict detection scales with number of changed entities
- [ ] UI remains responsive during large merge operations
- [ ] Background merge processing doesn't block other operations

### 8.6 Implementation Notes

**Merge Algorithm:**
- Uses three-way merge with LCA detection
- Conflict units based on `(entity_label, entity_id, property)` for entities and `(edge_type, src_id, dst_id)` for edges
- Auto-resolution rules applied in priority order with deterministic outcomes
- Manual conflicts create tasks and block merge until resolved

**Performance Considerations:**
- Merge operations run as background jobs for large branches
- Progress tracking and cancellation support for long-running merges
- Incremental conflict detection to avoid re-analyzing unchanged entities
- Caching of LCA computation for frequently merged branches

**Error Handling:**
- Atomic merge commits - either all changes apply or none
- Rollback capability for failed merges
- Detailed error reporting for debugging merge issues
- Graceful degradation when merge services are unavailable

**Security & Access Control:**
- Merge permissions based on branch ownership and project roles
- Audit logging for all merge operations and conflict resolutions
- Tenant isolation maintained throughout merge process
- Rate limiting on merge operations to prevent abuse

---

This operational guide provides the practical framework for safely managing mid-project changes through branching and merging, ensuring that schedule experiments and other modifications can be tested in isolation and merged back with full audit trails and conflict resolution.
