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
export declare class ContentOntologyService {
    private neo4j;
    private provenance;
    constructor();
    createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Project>;
    getProject(projectId: string, orgId: string): Promise<Project | null>;
    getProjects(orgId: string): Promise<Project[]>;
    createScene(scene: Omit<Scene, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Scene>;
    linkSceneToCharacter(sceneId: string, characterId: string, orgId: string, userId: string): Promise<void>;
    getSceneBreakdown(shootDayDate: Date, orgId: string): Promise<any>;
    createCharacter(character: Omit<Character, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Character>;
    createTalent(talent: Omit<Talent, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Talent>;
    createCrew(crew: Omit<Crew, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Crew>;
    private generateId;
}
//# sourceMappingURL=ContentOntologyService.d.ts.map