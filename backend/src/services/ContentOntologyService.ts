import { Neo4jService } from './Neo4jService';
import { ProvenanceService } from './provenance/ProvenanceService';

export interface Project {
  id: string;
  org_id: string;
  title: string;
  type: 'feature_film' | 'tv_series' | 'commercial' | 'documentary' | 'short_film';
  status: 'development' | 'pre_production' | 'production' | 'post_production' | 'completed' | 'cancelled';
  start_date?: Date;
  budget?: number;
  metadata?: {
    genre?: string;
    director?: string;
    producer?: string;
    [key: string]: any;
  };
  created_at?: Date;
  updated_at?: Date;
}

export interface Scene {
  id: string;
  org_id: string;
  project_id: string;
  number: string;
  title: string;
  location?: string;
  time_of_day?: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
  page_count?: number;
  status: 'draft' | 'approved' | 'scheduled' | 'shot' | 'completed';
  description?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Character {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  role_type: 'lead' | 'supporting' | 'background' | 'extra';
  description?: string;
  age_range?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Talent {
  id: string;
  org_id: string;
  name: string;
  agent_contact?: string;
  union_status?: string;
  rate_amount?: number;
  status: 'potential' | 'contacted' | 'auditioned' | 'offered' | 'confirmed' | 'declined';
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Crew {
  id: string;
  org_id: string;
  name: string;
  role: string;
  department: string;
  rate_amount?: number;
  status: 'potential' | 'contacted' | 'offered' | 'confirmed' | 'declined';
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Prop {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  category: string;
  description?: string;
  source?: 'rental' | 'purchase' | 'provided' | 'build';
  status: 'needed' | 'sourced' | 'acquired' | 'ready';
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Location {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  type: 'interior' | 'exterior' | 'studio' | 'practical';
  address?: string;
  contact_info?: string;
  availability?: string;
  cost?: number;
  status: 'scouted' | 'contacted' | 'permitted' | 'confirmed';
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShootDay {
  id: string;
  org_id: string;
  project_id: string;
  date: Date;
  call_time?: string;
  wrap_time?: string;
  location_id?: string;
  status: 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export class ContentOntologyService {
  private neo4j: Neo4jService;
  private provenance: ProvenanceService;

  constructor() {
    this.neo4j = new Neo4jService();
    this.provenance = new ProvenanceService();
  }

  // ===== PROJECT OPERATIONS =====

  async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Project> {
    const projectId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created project: " + $title,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "content_ontology_service",
        action_type: "CREATE_PROJECT",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      WITH c,a
      
      // Create project
      CREATE (p:Project {
        id: $project_id,
        org_id: $org_id,
        title: $title,
        type: $type,
        status: $status,
        start_date: $start_date,
        budget: $budget,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to project for provenance
      CREATE (a)-[:TOUCHED]->(p)
      
      RETURN p
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      project_id: projectId,
      org_id: project.org_id,
      user_id: userId,
      title: project.title,
      type: project.type,
      status: project.status,
      start_date: project.start_date || null,
      budget: project.budget || null,
      metadata: JSON.stringify(project.metadata || {}),
      inputs: { title: project.title, type: project.type },
      outputs: { project_id: projectId }
    }, project.org_id);

    return result.records[0]?.get('p').properties;
  }

  async getProject(projectId: string, orgId: string): Promise<Project | null> {
    const query = `
      MATCH (p:Project {id: $project_id, org_id: $org_id})
      RETURN p
    `;

    const result = await this.neo4j.executeQuery(query, { project_id: projectId, org_id: orgId }, orgId);
    return result.records[0]?.get('p').properties || null;
  }

  async getProjects(orgId: string): Promise<Project[]> {
    const query = `
      MATCH (p:Project {org_id: $org_id})
      RETURN p
      ORDER BY p.created_at DESC
    `;

    const result = await this.neo4j.executeQuery(query, { org_id: orgId }, orgId);
    return result.records.map((record: any) => record.get('p').properties);
  }

  // ===== SCENE OPERATIONS =====

  async createScene(scene: Omit<Scene, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Scene> {
    const sceneId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created scene: " + $number + " - " + $title,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "content_ontology_service",
        action_type: "CREATE_SCENE",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      WITH c,a
      
      // Create scene
      CREATE (s:Scene {
        id: $scene_id,
        org_id: $org_id,
        project_id: $project_id,
        number: $number,
        title: $title,
        location: $location,
        time_of_day: $time_of_day,
        page_count: $page_count,
        status: $status,
        description: $description,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      // Link scene to project for verification queries
      WITH a, s
      MATCH (p:Project {id: $project_id, org_id: $org_id})
      CREATE (s)-[:BELONGS_TO]->(p)
      
      // Link action to scene for provenance
      CREATE (a)-[:TOUCHED]->(s)
      
      RETURN s
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      scene_id: sceneId,
      org_id: scene.org_id,
      user_id: userId,
      project_id: scene.project_id,
      number: scene.number,
      title: scene.title,
      location: scene.location || null,
      time_of_day: scene.time_of_day || null,
      page_count: scene.page_count || null,
      status: scene.status,
      description: scene.description || null,
      metadata: JSON.stringify(scene.metadata || {}),
      inputs: { project_id: scene.project_id, number: scene.number, title: scene.title },
      outputs: { scene_id: sceneId }
    }, scene.org_id);

    return result.records[0]?.get('s').properties;
  }

  async linkSceneToCharacter(sceneId: string, characterId: string, orgId: string, userId: string): Promise<void> {
    const commitId = this.generateId();
    const actionId = this.generateId();
    const edgeFactId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Linked scene to character",
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "content_ontology_service",
        action_type: "LINK_SCENE_CHARACTER",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      WITH c,a
      
      // Create EdgeFact for temporal relationship
      MATCH (s:Scene {id: $scene_id, org_id: $org_id})
      MATCH (ch:Character {id: $character_id, org_id: $org_id})
      
      CREATE (ef:EdgeFact {
        id: $edge_fact_id,
        type: 'FEATURES_CHARACTER',
        from_id: $scene_id,
        to_id: $character_id,
        valid_from: datetime(),
        valid_to: null,
        created_by_commit: $commit_id,
        org_id: $org_id
      })
      
      CREATE (ef)-[:FROM]->(s)
      CREATE (ef)-[:TO]->(ch)
      
      // Link action to entities for provenance
      CREATE (a)-[:TOUCHED]->(s)
      CREATE (a)-[:TOUCHED]->(ch)
    `;

    await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      edge_fact_id: edgeFactId,
      scene_id: sceneId,
      character_id: characterId,
      org_id: orgId,
      user_id: userId,
      inputs: { scene_id: sceneId, character_id: characterId },
      outputs: { relationship_created: true }
    }, orgId);
  }

  async getSceneBreakdown(shootDayDate: Date, orgId: string): Promise<any> {
    const query = `
      MATCH (sd:ShootDay {date: $date, org_id: $org_id})
      MATCH (sd)<-[:TO]-(ef:EdgeFact {type: 'SCHEDULED_FOR', valid_to: null})-[:FROM]->(scene:Scene)
      OPTIONAL MATCH (scene)<-[:FROM]-(ef_char:EdgeFact {type: 'FEATURES_CHARACTER', valid_to: null})-[:TO]->(char:Character)
      OPTIONAL MATCH (char)<-[:TO]-(ef_talent:EdgeFact {type: 'PLAYS_CHARACTER', valid_to: null})-[:FROM]->(talent:Talent)
      
      RETURN 
        sd.date as shoot_date,
        collect({
          scene_number: scene.number,
          scene_title: scene.title,
          characters: collect(DISTINCT char.name),
          talent: collect(DISTINCT talent.name)
        }) as breakdown
    `;

    const result = await this.neo4j.executeQuery(query, { date: shootDayDate, org_id: orgId }, orgId);
    return result.records[0]?.get('breakdown') || [];
  }

  // ===== CHARACTER OPERATIONS =====

  async createCharacter(character: Omit<Character, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Character> {
    const characterId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created character: " + $name,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "content_ontology_service",
        action_type: "CREATE_CHARACTER",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create character
      CREATE (ch:Character {
        id: $character_id,
        org_id: $org_id,
        project_id: $project_id,
        name: $name,
        role_type: $role_type,
        description: $description,
        age_range: $age_range,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to character for provenance
      CREATE (a)-[:TOUCHED]->(ch)
      
      RETURN ch
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      character_id: characterId,
      org_id: character.org_id,
      user_id: userId,
      project_id: character.project_id,
      name: character.name,
      role_type: character.role_type,
      description: character.description || null,
      age_range: character.age_range || null,
      metadata: character.metadata || {},
      inputs: { project_id: character.project_id, name: character.name },
      outputs: { character_id: characterId }
    }, character.org_id);

    return result.records[0]?.get('ch').properties;
  }

  // ===== TALENT OPERATIONS =====

  async createTalent(talent: Omit<Talent, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Talent> {
    const talentId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created talent: " + $name,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "content_ontology_service",
        action_type: "CREATE_TALENT",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create talent
      CREATE (t:Talent {
        id: $talent_id,
        org_id: $org_id,
        name: $name,
        agent_contact: $agent_contact,
        union_status: $union_status,
        rate_amount: $rate_amount,
        status: $status,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to talent for provenance
      CREATE (a)-[:TOUCHED]->(t)
      
      RETURN t
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      talent_id: talentId,
      org_id: talent.org_id,
      user_id: userId,
      name: talent.name,
      agent_contact: talent.agent_contact || null,
      union_status: talent.union_status || null,
      rate_amount: talent.rate_amount || null,
      status: talent.status,
      metadata: talent.metadata || {},
      inputs: { name: talent.name, status: talent.status },
      outputs: { talent_id: talentId }
    }, talent.org_id);

    return result.records[0]?.get('t').properties;
  }

  // ===== CREW OPERATIONS =====

  async createCrew(crew: Omit<Crew, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Crew> {
    const crewId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created crew member: " + $name + " (" + $role + ")",
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "content_ontology_service",
        action_type: "CREATE_CREW",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create crew
      CREATE (cr:Crew {
        id: $crew_id,
        org_id: $org_id,
        name: $name,
        role: $role,
        department: $department,
        rate_amount: $rate_amount,
        status: $status,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to crew for provenance
      CREATE (a)-[:TOUCHED]->(cr)
      
      RETURN cr
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      crew_id: crewId,
      org_id: crew.org_id,
      user_id: userId,
      name: crew.name,
      role: crew.role,
      department: crew.department,
      rate_amount: crew.rate_amount || null,
      status: crew.status,
      metadata: crew.metadata || {},
      inputs: { name: crew.name, role: crew.role, department: crew.department },
      outputs: { crew_id: crewId }
    }, crew.org_id);

    return result.records[0]?.get('cr').properties;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
