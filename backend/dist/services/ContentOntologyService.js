"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentOntologyService = void 0;
const Neo4jService_1 = require("./Neo4jService");
const ProvenanceService_1 = require("./provenance/ProvenanceService");
class ContentOntologyService {
    constructor() {
        this.neo4j = new Neo4jService_1.Neo4jService();
        this.provenance = new ProvenanceService_1.ProvenanceService();
    }
    async createProject(project, userId) {
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
    async getProject(projectId, orgId) {
        const query = `
      MATCH (p:Project {id: $project_id, org_id: $org_id})
      RETURN p
    `;
        const result = await this.neo4j.executeQuery(query, { project_id: projectId, org_id: orgId }, orgId);
        return result.records[0]?.get('p').properties || null;
    }
    async getProjects(orgId) {
        const query = `
      MATCH (p:Project {org_id: $org_id})
      RETURN p
      ORDER BY p.created_at DESC
    `;
        const result = await this.neo4j.executeQuery(query, { org_id: orgId }, orgId);
        return result.records.map((record) => record.get('p').properties);
    }
    async createScene(scene, userId) {
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
    async linkSceneToCharacter(sceneId, characterId, orgId, userId) {
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
    async getSceneBreakdown(shootDayDate, orgId) {
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
    async createCharacter(character, userId) {
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
    async createTalent(talent, userId) {
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
    async createCrew(crew, userId) {
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
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ContentOntologyService = ContentOntologyService;
//# sourceMappingURL=ContentOntologyService.js.map