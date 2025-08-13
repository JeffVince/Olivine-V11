export interface Profile {
  name: string
  avatar: string
}

export interface NotificationSettings {
  email: boolean
  sms: boolean
  inApp: boolean
}

export interface ProjectOptions {
  name: string
  templates: string[]
  autoApprove: boolean
}

export interface SettingsState {
  profile: Profile
  notif: NotificationSettings
  projectOptions: ProjectOptions
  tab: string
}

export interface SettingsRules {
  nameRules: Array<(v: string) => boolean | string>
  urlRules: Array<(v: string) => boolean | string>
}
