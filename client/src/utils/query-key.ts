export const PROFILE_QUERY_KEY = {
  userProfile: ["userProfile"],
  updateUserProfile: ["updateUserProfile"],
  userSettings: ["userSettings"],
  updateUserSettings: ["updateUserSettings"],
  userNotifications: ["userNotifications"],
  updateUserNotifications: ["updateUserNotifications"],
};

export const AUTH_QUERY_KEY = {
  user: ["auth", "me"],
  login: ["auth", "login"],
  logout: ["auth", "logout"],
};

export const CHAT_QUERY_KEY = {
  conversations: ["chat", "conversations"],
  createConversation: ["chat", "create-conversation"],
};
