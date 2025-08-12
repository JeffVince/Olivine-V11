Got it, Jeff. Here are the tight, “drop‑in” Cypher helpers you asked for.

---

# A) LCA / merge‑base for two commits

**Assumptions:** commits are nodes `:Commit {id, created_at, ...}` and history is `(:Commit)-[:PARENT]->(:Commit)` (newer → parent). This mirrors the V10 commit DAG design and merge model.  &#x20;

Returns the merge‑base(s). Keep `LIMIT 1` if you want a single “best” LCA (closest to both tips by min‑max distance); drop it to see all merge‑bases.

```cypher
// params: $aId, $bId
MATCH (a:Commit {id:$aId}), (b:Commit {id:$bId})

// find all common ancestors with their shortest distances
CALL {
  WITH a,b
  MATCH pa=(a)-[:PARENT*0..]->(x:Commit)
  MATCH pb=(b)-[:PARENT*0..]->(x)
  WITH x, min(length(pa)) AS dA, min(length(pb)) AS dB
  RETURN x, dA, dB
}
WITH collect({x:x, dA:dA, dB:dB}) AS common

// keep only those with no descendant that is also a common ancestor (true merge-bases)
UNWIND common AS c
WITH c, common
WITH c.x AS candidate, c.dA AS dA, c.dB AS dB, [m IN common | m.x] AS allCAs
WHERE NOT EXISTS {
  MATCH (candidate)<-[:PARENT*1..]-(desc:Commit)
  WHERE desc IN allCAs
}
RETURN candidate AS lca, dA, dB
ORDER BY CASE WHEN dA > dB THEN dA ELSE dB END ASC, (dA + dB) ASC
LIMIT 1;  // remove to return all LCAs
```

---

# B) Changed EdgeFacts between two commits

**Minimal model:** represent relationship assertions as immutable **`EdgeFact`** nodes carrying their validity interval:

```
(:EdgeFact {
  id, type, from_id, to_id,
  valid_from: datetime, valid_to: datetime|null
})
```

An EdgeFact is “active” at commit **C** iff `valid_from ≤ C.created_at < valid_to (or valid_to is null)`. This mirrors how V10 handles valid‑time on versions (we’re applying the same bitemporal idea to edge assertions). &#x20;

Below query returns the symmetric‑diff: EdgeFacts **added** in B vs A, and **removed** in B vs A. If your commit timestamp field is called `timestamp` instead of `created_at`, adjust the predicate accordingly. (V10 uses commit nodes + temporal diffing across the interval; we’re snapshotting at two commit times.) &#x20;

```cypher
// params: $aId, $bId
MATCH (a:Commit {id:$aId}), (b:Commit {id:$bId})

CALL {
  WITH a,b
  // Active in B but not in A  -> ADDED
  MATCH (ef:EdgeFact)
  WHERE ef.valid_from <= b.created_at AND (ef.valid_to IS NULL OR ef.valid_to > b.created_at)
    AND NOT (ef.valid_from <= a.created_at AND (ef.valid_to IS NULL OR ef.valid_to > a.created_at))
  RETURN 'ADDED' AS change, ef.id AS id, ef.type AS type, ef.from_id AS fromId, ef.to_id AS toId
  UNION ALL
  WITH a,b
  // Active in A but not in B  -> REMOVED
  MATCH (ef:EdgeFact)
  WHERE ef.valid_from <= a.created_at AND (ef.valid_to IS NULL OR ef.valid_to > a.created_at)
    AND NOT (ef.valid_from <= b.created_at AND (ef.valid_to IS NULL OR ef.valid_to > b.created_at))
  RETURN 'REMOVED' AS change, ef.id AS id, ef.type AS type, ef.from_id AS fromId, ef.to_id AS toId
}
RETURN change, type, fromId, toId, id
ORDER BY change, type, fromId, toId, id;
```

**Notes / options**

* If you want **branch‑aware** diffs only along each tip’s lineage since the merge‑base, chain the LCA from (A) first and filter EdgeFacts by commit time *and* branch context. (V10 models branches on commits; ontology/schema updates live on main.) &#x20;
* If you also link commits to edge facts (e.g., `(:Commit)-[:UPDATES {op:'assert'|'retract'}]->(:EdgeFact)` the same way commits link to `EntityVersion`s), you can compute the delta by traversing from the LCA to each tip and aggregating operations—useful when timestamps alone are ambiguous. This mirrors the doc’s `Commit-[:UPDATES]->EntityVersion` linkage.&#x20;

**Indexing (do once):**

```cypher
CREATE CONSTRAINT commit_id IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE;
CREATE INDEX edgefact_valid_from IF NOT EXISTS FOR (e:EdgeFact) ON (e.valid_from);
CREATE INDEX edgefact_valid_to   IF NOT EXISTS FOR (e:EdgeFact) ON (e.valid_to);
```

That’s the minimal set. Plug these in, and you’ll have a reproducible merge‑base plus stable, branch‑safe edge diffs aligned with the V10 provenance model.
