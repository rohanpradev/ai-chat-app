export const PROFILE_QUERY_KEY = {
  userProfile: ["userProfile"],
  updateUserProfile: ["updateUserProfile"],
  userSettings: ["userSettings"],
  updateUserSettings: ["updateUserSettings"],
  userNotifications: ["userNotifications"],
  updateUserNotifications: ["updateUserNotifications"],
};

export const CHAT_QUERY_KEY = {
  chats: ["conversations"], // Used by existing conversation queries
  createChat: ["createChat"], // Used by create conversation mutation
  conversation: (id: string) => ["conversations", id], // For individual chat queries
};

export const AUTH_QUERY_KEY = {
  user: ["auth", "me"],
  login: ["auth", "login"],
  logout: ["auth", "logout"],
};
