/* Create Content Ontology nodes and relationships */
/* Based on 05-Content-Ontology-Architecture.md */

/* Project constraints and indexes */
CREATE CONSTRAINT unique_project IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE;
CREATE INDEX project_org_id IF NOT EXISTS FOR (p:Project) ON (p.org_id);
CREATE INDEX project_status IF NOT EXISTS FOR (p:Project) ON (p.status);
CREATE INDEX project_type IF NOT EXISTS FOR (p:Project) ON (p.type);

/* Scene constraints and indexes */
CREATE CONSTRAINT unique_scene IF NOT EXISTS FOR (s:Scene) REQUIRE s.id IS UNIQUE;
CREATE INDEX scene_org_id IF NOT EXISTS FOR (s:Scene) ON (s.org_id);
CREATE INDEX scene_project_id IF NOT EXISTS FOR (s:Scene) ON (s.project_id);
CREATE INDEX scene_number IF NOT EXISTS FOR (s:Scene) ON (s.number);
CREATE INDEX scene_status IF NOT EXISTS FOR (s:Scene) ON (s.status);

/* Character constraints and indexes */
CREATE CONSTRAINT unique_character IF NOT EXISTS FOR (c:Character) REQUIRE c.id IS UNIQUE;
CREATE INDEX character_org_id IF NOT EXISTS FOR (c:Character) ON (c.org_id);
CREATE INDEX character_project_id IF NOT EXISTS FOR (c:Character) ON (c.project_id);
CREATE INDEX character_name IF NOT EXISTS FOR (c:Character) ON (c.name);
CREATE INDEX character_role_type IF NOT EXISTS FOR (c:Character) ON (c.role_type);

/* Talent constraints and indexes */
CREATE CONSTRAINT unique_talent IF NOT EXISTS FOR (t:Talent) REQUIRE t.id IS UNIQUE;
CREATE INDEX talent_org_id IF NOT EXISTS FOR (t:Talent) ON (t.org_id);
CREATE INDEX talent_name IF NOT EXISTS FOR (t:Talent) ON (t.name);
CREATE INDEX talent_status IF NOT EXISTS FOR (t:Talent) ON (t.status);
CREATE INDEX talent_union_status IF NOT EXISTS FOR (t:Talent) ON (t.union_status);

/* Crew constraints and indexes */
CREATE CONSTRAINT unique_crew IF NOT EXISTS FOR (cr:Crew) REQUIRE cr.id IS UNIQUE;
CREATE INDEX crew_org_id IF NOT EXISTS FOR (cr:Crew) ON (cr.org_id);
CREATE INDEX crew_name IF NOT EXISTS FOR (cr:Crew) ON (cr.name);
CREATE INDEX crew_role IF NOT EXISTS FOR (cr:Crew) ON (cr.role);
CREATE INDEX crew_department IF NOT EXISTS FOR (cr:Crew) ON (cr.department);
CREATE INDEX crew_status IF NOT EXISTS FOR (cr:Crew) ON (cr.status);

/* Prop constraints and indexes */
CREATE CONSTRAINT unique_prop IF NOT EXISTS FOR (pr:Prop) REQUIRE pr.id IS UNIQUE;
CREATE INDEX prop_org_id IF NOT EXISTS FOR (pr:Prop) ON (pr.org_id);
CREATE INDEX prop_project_id IF NOT EXISTS FOR (pr:Prop) ON (pr.project_id);
CREATE INDEX prop_name IF NOT EXISTS FOR (pr:Prop) ON (pr.name);
CREATE INDEX prop_category IF NOT EXISTS FOR (pr:Prop) ON (pr.category);

/* Location constraints and indexes */
CREATE CONSTRAINT unique_location IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE;
CREATE INDEX location_org_id IF NOT EXISTS FOR (l:Location) ON (l.org_id);
CREATE INDEX location_project_id IF NOT EXISTS FOR (l:Location) ON (l.project_id);
CREATE INDEX location_name IF NOT EXISTS FOR (l:Location) ON (l.name);
CREATE INDEX location_type IF NOT EXISTS FOR (l:Location) ON (l.type);

/* ShootDay constraints and indexes */
CREATE CONSTRAINT unique_shootday IF NOT EXISTS FOR (sd:ShootDay) REQUIRE sd.id IS UNIQUE;
CREATE INDEX shootday_org_id IF NOT EXISTS FOR (sd:ShootDay) ON (sd.org_id);
CREATE INDEX shootday_project_id IF NOT EXISTS FOR (sd:ShootDay) ON (sd.project_id);
CREATE INDEX shootday_date IF NOT EXISTS FOR (sd:ShootDay) ON (sd.date);
CREATE INDEX shootday_status IF NOT EXISTS FOR (sd:ShootDay) ON (sd.status);

/* Content relationship indexes */
CREATE INDEX scene_character_relationships IF NOT EXISTS FOR (ef:EdgeFact) 
ON (ef.type, ef.from_id, ef.valid_to) WHERE ef.type = 'FEATURES_CHARACTER';

CREATE INDEX scene_scheduling_relationships IF NOT EXISTS FOR (ef:EdgeFact) 
ON (ef.type, ef.to_id, ef.valid_to) WHERE ef.type = 'SCHEDULED_FOR';

CREATE INDEX talent_character_relationships IF NOT EXISTS FOR (ef:EdgeFact) 
ON (ef.type, ef.from_id, ef.valid_to) WHERE ef.type = 'PLAYS_CHARACTER';

CREATE INDEX scene_prop_relationships IF NOT EXISTS FOR (ef:EdgeFact) 
ON (ef.type, ef.from_id, ef.valid_to) WHERE ef.type = 'NEEDS_PROP';

CREATE INDEX scene_location_relationships IF NOT EXISTS FOR (ef:EdgeFact) 
ON (ef.type, ef.from_id, ef.valid_to) WHERE ef.type = 'SET_AT';
