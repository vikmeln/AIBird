import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthForm from "../components/AuthForm";
import BirdDashboard from "../components/BirdDashboard";
import AdminPanel from "../components/AdminPanel";
import WalletCard from "../components/WalletCard";
import { sessionStorage } from "../storage";
import type { UserSession } from "../types";

type Screen = "birds" | "wallet" | "admin";

export default function HomeScreen() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("birds");

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      const saved = await sessionStorage.get();
      if (active) {
        setSession(saved);
        setLoading(false);
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  function handleAuthenticated(newSession: UserSession) {
    setSession(newSession);
    setScreen("birds");
  }

  async function handleLogout() {
    try {
      await sessionStorage.clear();
      setSession(null);
      setScreen("birds");
    } catch {
      Alert.alert("Ошибка", "Не удалось выйти из аккаунта.");
    }
  }

  const isAdmin = session?.role?.toLowerCase() === "admin";

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#217346" />
        </View>
      ) : !session ? (
        <AuthForm onAuthenticated={handleAuthenticated} />
      ) : (
        <View style={styles.main}>
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <Text style={styles.logo}>AI Bird</Text>
              <Text style={styles.email} numberOfLines={1}>
                {session.email}
              </Text>
            </View>
            <Pressable onPress={handleLogout} style={styles.logout}>
              <Text style={styles.logoutText}>Выйти</Text>
            </Pressable>
          </View>

          <View style={styles.navigation}>
            <Pressable
              style={[
                styles.navButton,
                screen === "birds" && styles.activeButton,
              ]}
              onPress={() => setScreen("birds")}
            >
              <Text
                style={[
                  styles.navText,
                  screen === "birds" && styles.activeText,
                ]}
              >
                Птицы
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.navButton,
                screen === "wallet" && styles.activeButton,
              ]}
              onPress={() => setScreen("wallet")}
            >
              <Text
                style={[
                  styles.navText,
                  screen === "wallet" && styles.activeText,
                ]}
              >
                Баланс
              </Text>
            </Pressable>

            {isAdmin && (
              <Pressable
                style={[
                  styles.navButton,
                  screen === "admin" && styles.activeButton,
                ]}
                onPress={() => setScreen("admin")}
              >
                <Text
                  style={[
                    styles.navText,
                    screen === "admin" && styles.activeText,
                  ]}
                >
                  Админ
                </Text>
              </Pressable>
            )}
          </View>

          {screen === "wallet" ? (
            <WalletCard token={session.token} />
          ) : isAdmin && screen === "admin" ? (
            <AdminPanel token={session.token} />
          ) : (
            <BirdDashboard token={session.token} />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f8f5",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
  },
  main: {
    flex: 1,
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e8e2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  logo: {
    fontSize: 22,
    color: "#217346",
    fontWeight: "bold",
  },
  email: {
    color: "#777",
    fontSize: 12,
    marginTop: 4,
  },
  logout: {
    borderWidth: 1,
    borderColor: "#217346",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  logoutText: {
    color: "#217346",
    fontWeight: "bold",
  },
  navigation: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 10,
    gap: 8,
  },
  navButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 9,
    backgroundColor: "#eef3ef",
  },
  activeButton: {
    backgroundColor: "#217346",
  },
  navText: {
    color: "#217346",
    fontSize: 13,
    fontWeight: "bold",
  },
  activeText: {
    color: "#fff",
  },
});
