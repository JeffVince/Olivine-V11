import { Neo4jService } from './Neo4jService';
import { ProvenanceService } from './provenance/ProvenanceService';

export interface CanonicalSlot {
  key: string;
  org_id: string;
  description: string;
  category: string;
  required: boolean;
  multiple: boolean;
  validation_rules: {
    mime_types?: string[];
    max_size_mb?: number;
    naming_pattern?: string;
    min_size_bytes?: number;
    max_size_bytes?: number;
    required_keywords?: string[];
    excluded_keywords?: string[];
  };
}

export interface TaxonomyProfile {
  id: string;
  org_id: string;
  name: string;
  description: string;
  active: boolean;
  priority: number;
  created_at: Date;
  metadata: {
    auto_apply?: boolean;
    confidence_threshold?: number;
    fallback_slot?: string;
  };
}

export interface TaxonomyRule {
  id: string;
  org_id: string;
  match_pattern: string;
  slot_key: string;
  file_type?: string;
  path_pattern?: string;
  priority: number;
  enabled: boolean;
  confidence: number;
  conditions: {
    min_size_bytes?: number;
    max_size_bytes?: number;
    required_keywords?: string[];
    excluded_keywords?: string[];
  };
}

export interface Classification {
  slot: string;
  confidence: number;
  method: 'rule_based' | 'ml_based' | 'manual';
  rule_id?: string;
  metadata?: Record<string, unknown>;
}

export interface FileNode {
  id: string;
  org_id: string;
  name: string;
  path: string;
  size: number;
  mime_type: string;
  metadata?: Record<string, unknown>;
}

export class TaxonomyService {
  private neo4j: Neo4jService;
  private provenance: ProvenanceService;

  constructor() {
    this.neo4j = new Neo4jService();
    this.provenance = new ProvenanceService();
  }

  /**
   * Create a new CanonicalSlot
   */
  async createCanonicalSlot(slot: Omit<CanonicalSlot, 'key'> & { key?: string }, orgId: string): Promise<CanonicalSlot> {
    const slotKey = slot.key || this.generateSlotKey(slot.description);
    
    const query = `
      CREATE (cs:CanonicalSlot {
        key: $key,
        org_id: $org_id,
        description: $description,
        category: $category,
        required: $required,
        multiple: $multiple,
        validation_rules: $validation_rules,
        created_at: datetime()
      })
      RETURN cs
    `;

    const result = await this.neo4j.executeQuery(query, {
      key: slotKey,
      org_id: orgId,
      description: slot.description,
      category: slot.category,
      required: slot.required,
      multiple: slot.multiple,
      validation_rules: slot.validation_rules
    }, orgId);

    return result.records[0]?.get('cs').properties;
  }

  /**
   * Create a new TaxonomyProfile
   */
  async createTaxonomyProfile(profile: Omit<TaxonomyProfile, 'id' | 'created_at'>, orgId: string): Promise<TaxonomyProfile> {
    const profileId = this.generateId();
    
    const query = `
      CREATE (tp:TaxonomyProfile {
        id: $id,
        org_id: $org_id,
        name: $name,
        description: $description,
        active: $active,
        priority: $priority,
        created_at: datetime(),
        metadata: $metadata
      })
      RETURN tp
    `;

    const result = await this.neo4j.executeQuery(query, {
      id: profileId,
      org_id: orgId,
      name: profile.name,
      description: profile.description,
      active: profile.active,
      priority: profile.priority,
      metadata: profile.metadata
    }, orgId);

    return result.records[0]?.get('tp').properties;
  }

  /**
   * Create a new TaxonomyRule and link it to a profile
   */
  async createTaxonomyRule(rule: Omit<TaxonomyRule, 'id'>, profileId: string, orgId: string): Promise<TaxonomyRule> {
    const ruleId = this.generateId();
    
    const query = `
      MATCH (tp:TaxonomyProfile {id: $profile_id, org_id: $org_id})
      MATCH (cs:CanonicalSlot {key: $slot_key})
      WHERE cs.org_id = $org_id OR cs.org_id = "system"
      
      CREATE (tr:TaxonomyRule {
        id: $id,
        org_id: $org_id,
        match_pattern: $match_pattern,
        slot_key: $slot_key,
        file_type: $file_type,
        path_pattern: $path_pattern,
        priority: $priority,
        enabled: $enabled,
        confidence: $confidence,
        conditions: $conditions,
        created_at: datetime()
      })
      
      CREATE (tp)-[:CONTAINS_RULE]->(tr)
      CREATE (tr)-[:ASSIGNS_TO]->(cs)
      
      RETURN tr
    `;

    const result = await this.neo4j.executeQuery(query, {
      id: ruleId,
      profile_id: profileId,
      org_id: orgId,
      match_pattern: rule.match_pattern,
      slot_key: rule.slot_key,
      file_type: rule.file_type || null,
      path_pattern: rule.path_pattern || null,
      priority: rule.priority,
      enabled: rule.enabled,
      confidence: rule.confidence,
      conditions: rule.conditions
    }, orgId);

    return result.records[0]?.get('tr').properties;
  }

  /**
   * Classify a file using taxonomy rules
   */
  async classifyFile(fileId: string, orgId: string): Promise<Classification[]> {
    const query = `
      MATCH (f:File {id: $file_id, org_id: $org_id})
      MATCH (tp:TaxonomyProfile {org_id: $org_id, active: true})
      MATCH (tp)-[:CONTAINS_RULE]->(tr:TaxonomyRule {enabled: true})
      MATCH (tr)-[:ASSIGNS_TO]->(cs:CanonicalSlot)
      
      WHERE f.name =~ tr.match_pattern
        AND (tr.file_type IS NULL OR f.mime_type = tr.file_type)
        AND (tr.path_pattern IS NULL OR f.path =~ tr.path_pattern)
      
      WITH f, cs, tr, 
           CASE 
             WHEN f.size >= coalesce(tr.conditions.min_size_bytes, 0)
              AND f.size <= coalesce(tr.conditions.max_size_bytes, 999999999)
             THEN tr.confidence
             ELSE 0.0
           END as confidence
      
      WHERE confidence > 0.5
      
      WITH f, cs, tr, confidence,
           CASE 
             WHEN tr.conditions.required_keywords IS NOT NULL
             THEN size([kw IN tr.conditions.required_keywords WHERE f.name CONTAINS kw]) = size(tr.conditions.required_keywords)
             ELSE true
           END as keywords_match,
           CASE 
             WHEN tr.conditions.excluded_keywords IS NOT NULL
             THEN size([kw IN tr.conditions.excluded_keywords WHERE f.name CONTAINS kw]) = 0
             ELSE true
           END as no_excluded_keywords
      
      WHERE keywords_match AND no_excluded_keywords
      
      RETURN cs.key as slot, confidence, tr.id as rule_id, tr.priority as priority
      ORDER BY confidence DESC, tr.priority ASC
    `;

    const result = await this.neo4j.executeQuery(query, { file_id: fileId, org_id: orgId }, orgId);

    return result.records.map((record) => ({
      slot: record.get('slot'),
      confidence: record.get('confidence'),
      method: 'rule_based' as const,
      rule_id: record.get('rule_id')
    }));
  }

  /**
   * Apply classification to a file by creating EdgeFact
   */
  async applyClassification(fileId: string, classification: Classification, orgId: string, userId: string): Promise<void> {
    const commitId = this.generateId();
    const actionId = this.generateId();
    const edgeFactId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Classified file as " + $slot,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "taxonomy_service",
        action_type: "CLASSIFY_FILE",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // End any existing classification for this file
      MATCH (f:File {id: $file_id, org_id: $org_id})
      OPTIONAL MATCH (f)<-[:FROM]-(existing:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})
      SET existing.valid_to = datetime(),
          existing.ended_by_commit = $commit_id
      
      // Create new classification EdgeFact
      CREATE (ef:EdgeFact {
        id: $edge_fact_id,
        type: 'CLASSIFIED_AS',
        from_id: $file_id,
        to_id: $slot,
        valid_from: datetime(),
        valid_to: null,
        created_by_commit: $commit_id,
        org_id: $org_id,
        props: $props
      })
      
      // Link EdgeFact to file and slot
      MATCH (cs:CanonicalSlot {key: $slot})
      WHERE cs.org_id = $org_id OR cs.org_id = "system"
      CREATE (ef)-[:FROM]->(f)
      CREATE (ef)-[:TO]->(cs)
      
      // Link action to file for provenance
      CREATE (a)-[:TOUCHED]->(f)
    `;

    await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      edge_fact_id: edgeFactId,
      file_id: fileId,
      org_id: orgId,
      user_id: userId,
      slot: classification.slot,
      inputs: {
        file_id: fileId,
        classification_method: classification.method,
        rule_id: classification.rule_id
      },
      outputs: {
        slot: classification.slot,
        confidence: classification.confidence
      },
      props: {
        confidence: classification.confidence,
        method: classification.method,
        rule_id: classification.rule_id,
        metadata: classification.metadata || {}
      }
    }, orgId);
  }

  /**
   * Get all CanonicalSlots for an organization
   */
  async getCanonicalSlots(orgId: string): Promise<CanonicalSlot[]> {
    const query = `
      MATCH (cs:CanonicalSlot)
      WHERE cs.org_id = $org_id OR cs.org_id = "system"
      RETURN cs
      ORDER BY cs.category, cs.key
    `;

    const result = await this.neo4j.executeQuery(query, { org_id: orgId }, orgId);
    return result.records.map((record) => record.get('cs').properties);
  }

  /**
   * Get taxonomy profiles for an organization
   */
  async getTaxonomyProfiles(orgId: string): Promise<TaxonomyProfile[]> {
    const query = `
      MATCH (tp:TaxonomyProfile {org_id: $org_id})
      RETURN tp
      ORDER BY tp.priority DESC, tp.name
    `;

    const result = await this.neo4j.executeQuery(query, { org_id: orgId }, orgId);
    return result.records.map((record) => record.get('tp').properties);
  }

  /**
   * Get taxonomy rules for a profile
   */
  async getTaxonomyRules(profileId: string, orgId: string): Promise<TaxonomyRule[]> {
    const query = `
      MATCH (tp:TaxonomyProfile {id: $profile_id, org_id: $org_id})
      MATCH (tp)-[:CONTAINS_RULE]->(tr:TaxonomyRule)
      RETURN tr
      ORDER BY tr.priority, tr.confidence DESC
    `;

    const result = await this.neo4j.executeQuery(query, { profile_id: profileId, org_id: orgId }, orgId);
    return result.records.map((record) => record.get('tr').properties);
  }

  /**
   * Get file classification status
   */
  async getFileClassification(fileId: string, orgId: string): Promise<Classification | null> {
    const query = `
      MATCH (f:File {id: $file_id, org_id: $org_id})
      MATCH (f)<-[:FROM]-(ef:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})-[:TO]->(cs:CanonicalSlot)
      RETURN cs.key as slot, ef.props.confidence as confidence, ef.props.method as method, ef.props.rule_id as rule_id
    `;

    const result = await this.neo4j.executeQuery(query, { file_id: fileId, org_id: orgId }, orgId);
    
    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      slot: record.get('slot'),
      confidence: record.get('confidence'),
      method: record.get('method'),
      rule_id: record.get('rule_id')
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSlotKey(description: string): string {
    return description.toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }
}
