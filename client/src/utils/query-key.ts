export const PROFILE_QUERY_KEY = {
  userProfile: ["userProfile"] as const,
  updateUserProfile: ["updateUserProfile"] as const,
  userSettings: ["userSettings"] as const,
  updateUserSettings: ["updateUserSettings"] as const,
  userNotifications: ["userNotifications"] as const,
  updateUserNotifications: ["updateUserNotifications"] as const,
};

export const CHAT_QUERY_KEY = {
  chats: ["conversations"] as const, // Used by existing conversation queries
  createChat: ["conversations", "create"] as const, // Used by create conversation mutation
  loadConversation: ["conversations", "load"] as const,
  conversation: (id: string) => ["conversations", id] as const, // For individual chat queries
};

export const AUTH_QUERY_KEY = {
  user: ["auth", "me"] as const,
  login: ["auth", "login"] as const,
  logout: ["auth", "logout"] as const,
  register: ["auth", "register"] as const,
};

export const AI_QUERY_KEY = {
  models: ["ai", "models"] as const,
};
