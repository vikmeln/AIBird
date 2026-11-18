import * as SecureStore from "expo-secure-store";
import type { UserSession } from "./types";

const SESSION_KEY = "birdlab_session";

export const sessionStorage = {
  async save(session: UserSession): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  },
  async get(): Promise<UserSession | null> {
    try {
      const value = await SecureStore.getItemAsync(SESSION_KEY);
      if (!value) return null;
      const session = JSON.parse(value) as UserSession;
      return session.token && session.email ? session : null;
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },
};
