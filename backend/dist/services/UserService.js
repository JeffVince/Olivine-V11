"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const PostgresService_1 = require("./PostgresService");
class UserService {
    constructor() {
        this.postgres = new PostgresService_1.PostgresService();
    }
    async updateProfile(userId, name, avatar) {
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
    async updateNotificationPrefs(userId, prefs) {
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
exports.UserService = UserService;
//# sourceMappingURL=UserService.js.map