import { PostgresService } from '../services/PostgresService';
import { Project } from '../types/project';

export class ProjectRepository {
  constructor(private postgres: PostgresService) {}

  async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const query = `
      INSERT INTO projects (
        org_id, 
        title, 
        type, 
        status, 
        start_date, 
        budget, 
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      project.org_id,
      project.title,
      project.type,
      project.status,
      project.start_date || null,
      project.budget || null,
      JSON.stringify(project.metadata || {})
    ];

    const result = await this.postgres.query<Project>(query, values);
    return result.rows[0];
  }

  async getById(id: string, orgId: string): Promise<Project | null> {
    const query = 'SELECT * FROM projects WHERE id = $1 AND org_id = $2';
    const result = await this.postgres.query<Project>(query, [id, orgId]);
    return result.rows[0] || null;
  }

  async getByOrg(orgId: string): Promise<Project[]> {
    const query = 'SELECT * FROM projects WHERE org_id = $1 ORDER BY created_at DESC';
    const result = await this.postgres.query<Project>(query, [orgId]);
    return result.rows;
  }
}
