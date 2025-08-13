export interface NotificationPrefs {
    email: boolean;
    sms: boolean;
    inApp: boolean;
}
export declare class UserService {
    private postgres;
    constructor();
    updateProfile(userId: string, name: string, avatar?: string): Promise<any>;
    updateNotificationPrefs(userId: string, prefs: NotificationPrefs): Promise<NotificationPrefs>;
}
//# sourceMappingURL=UserService.d.ts.map