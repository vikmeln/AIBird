import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { birdsApi } from "../api";
import type { Attempts } from "../types";

interface Props {
  token: string;
}

export default function WalletCard({ token }: Props) {
  const [attempts, setAttempts] = useState<Attempts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Получение актуального баланса с Central Server
  const loadData = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const data = await birdsApi.attempts(token);
      setAttempts(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось загрузить баланс попыток.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void loadData();
      }
    });
    return () => subscription.remove();
  }, [loadData]);

  const totalAttempts = attempts
    ? attempts.freeAttemptsLeft + attempts.paidAttemptsLeft
    : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Баланс попыток</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#217346" />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>Мой баланс</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Бесплатные попытки</Text>
              <Text style={styles.balanceValue}>
                {attempts?.freeAttemptsLeft ?? "—"}
              </Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Оплаченные попытки</Text>
              <Text style={styles.balanceValue}>
                {attempts?.paidAttemptsLeft ?? "—"}
              </Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.totalLabel}>Всего доступно попыток</Text>
            <Text style={styles.totalValue}>{totalAttempts ?? "—"}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>Пополнение баланса</Text>
            <Text style={styles.description}>
              Для покупки дополнительных попыток воспользуйтесь веб-версией AI
              Bird.
            </Text>
            <Text style={styles.description}>
              Оплата производится через кошелёк MetaMask с использованием
              смарт-контракта.
            </Text>
            <View style={styles.divider} />
            <Text style={styles.package}>20 попыток</Text>
            <Text style={styles.price}>0.001 тестового ETH</Text>
            <Text style={styles.note}>
              Приобретённые попытки доступны как в веб-версии, так и в мобильном
              приложении. Войдите в один и тот же аккаунт.
            </Text>
          </View>
          {totalAttempts === 0 && (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Попытки закончились</Text>
              <Text style={styles.warningText}>
                Приобретите дополнительные попытки в веб-версии AI Bird, чтобы
                продолжить распознавание птиц.
              </Text>
            </View>
          )}
          <Pressable
            style={[styles.refreshButton, refreshing && styles.disabled]}
            onPress={() => void loadData()}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator color="#217346" />
            ) : (
              <Text style={styles.refreshText}>Обновить баланс</Text>
            )}
          </Pressable>
        </>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f4f8f5",
  },
  content: {
    padding: 20,
    paddingBottom: 45,
  },
  heading: {
    fontSize: 23,
    fontWeight: "bold",
    color: "#217346",
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e1e8e2",
  },
  title: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 15,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  balanceLabel: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#217346",
    marginLeft: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#e1e8e2",
    marginVertical: 15,
  },
  totalLabel: {
    fontSize: 16,
    color: "#555",
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 35,
    fontWeight: "bold",
    color: "#217346",
  },
  description: {
    fontSize: 15,
    color: "#444",
    lineHeight: 23,
    marginBottom: 10,
  },
  package: {
    fontSize: 27,
    fontWeight: "bold",
    color: "#217346",
    marginBottom: 7,
  },
  price: {
    fontSize: 19,
    fontWeight: "600",
    color: "#333",
    marginBottom: 15,
  },
  note: {
    fontSize: 14,
    color: "#666",
    lineHeight: 21,
  },
  warningCard: {
    backgroundColor: "#fff5e8",
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#ead4b5",
  },
  warningTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#946122",
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: "#946122",
    lineHeight: 21,
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: "#217346",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  refreshText: {
    color: "#217346",
    fontWeight: "bold",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: "#c0392b",
    marginTop: 12,
    lineHeight: 21,
  },
});
