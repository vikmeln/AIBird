import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { authApi } from "../api";
import { sessionStorage } from "../storage";
import type { UserSession } from "../types";

interface Props {
  onAuthenticated: (session: UserSession) => void;
}

export default function AuthForm({ onAuthenticated }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (loading) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Заполни электронную почту и пароль.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        await authApi.register(normalizedEmail, password);
      }
      const result = await authApi.login(normalizedEmail, password);
      const session: UserSession = {
        token: result.token,
        role: result.role,
        email: normalizedEmail,
      };
      await sessionStorage.save(session);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>AI Bird</Text>
      <Text style={styles.subtitle}>Распознавание птиц с помощью ИИ</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>
          {isRegister ? "Регистрация" : "Вход"}
        </Text>
        <Text style={styles.label}>Электронная почта</Text>
        <TextInput
          style={styles.input}
          placeholder="example@email.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
        <Text style={styles.label}>Пароль</Text>
        <TextInput
          style={styles.input}
          placeholder="Введите пароль"
          placeholderTextColor="#999"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>
              {isRegister ? "Зарегистрироваться" : "Войти"}
            </Text>
          )}
        </Pressable>
        <Pressable
          disabled={loading}
          onPress={() => {
            setIsRegister(!isRegister);
            setError("");
          }}
        >
          <Text style={styles.switchText}>
            {isRegister
              ? "Уже есть аккаунт? Войти"
              : "Нет аккаунта? Зарегистрироваться"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f4f8f5",
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  icon: {
    fontSize: 54,
    textAlign: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#217346",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 30,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "#e1e8e2",
  },
  heading: {
    fontSize: 23,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 24,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d8ded9",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    color: "#222",
    backgroundColor: "#fff",
    marginBottom: 18,
  },
  error: {
    color: "#c0392b",
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#217346",
    borderRadius: 10,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  switchText: {
    color: "#217346",
    fontSize: 14,
    textAlign: "center",
    marginTop: 22,
    fontWeight: "600",
  },
});
