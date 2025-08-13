import { PostgresService } from './PostgresService';

export interface NotificationPrefs {
  email: boolean;
  sms: boolean;
  inApp: boolean;
}

export class UserService {
  // TODO: Implementation Plan - 05-API-Implementation.md - User service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend user service tests
  private postgres: PostgresService;

  constructor() {
    this.postgres = new PostgresService();
  }

  async updateProfile(userId: string, name: string, avatar?: string) {
    const query = `
      UPDATE users
      SET name = $2,
          avatar_url = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, avatar_url as avatar
    `;
    const result = await this.postgres.executeQuery(query, [userId, name, avatar || null]);
    return result.rows[0];
  }

  async updateNotificationPrefs(userId: string, prefs: NotificationPrefs): Promise<NotificationPrefs> {
    const query = `
      UPDATE users
      SET notification_prefs = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING notification_prefs
    `;
    const result = await this.postgres.executeQuery(query, [userId, JSON.stringify(prefs)]);
    return result.rows[0]?.notification_prefs || { email: true, sms: false, inApp: true };
  }
}
