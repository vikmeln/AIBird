import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { adminApi } from "../api";

interface Props {
  token: string;
}

type Section = "users" | "analyses" | "payments";
type Item = Record<string, unknown>;

function field(item: Item, ...names: string[]): unknown {
  for (const name of names) {
    if (item[name] !== undefined && item[name] !== null) {
      return item[name];
    }
  }
  return undefined;
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return "—";
}

function normalizeItems(data: unknown): Item[] {
  let values: unknown = data;
  if (data && !Array.isArray(data) && typeof data === "object") {
    const obj = data as Item;
    values =
      obj.items ?? obj.users ?? obj.analyses ?? obj.payments ?? obj.data ?? [];
  }
  if (!Array.isArray(values)) return [];
  return values.filter(
    (item): item is Item =>
      item !== null && typeof item === "object" && !Array.isArray(item),
  );
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{valueText(value)}</Text>
    </View>
  );
}

function UserItem({ item }: { item: Item }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {valueText(field(item, "email", "Email"))}
      </Text>
      <Detail label="ID пользователя" value={field(item, "id", "Id")} />
      <Detail
        label="Бесплатных использовано"
        value={field(item, "freeAttemptsUsed", "FreeAttemptsUsed")}
      />
      <Detail
        label="Оплаченных осталось"
        value={field(item, "paidAttemptsLeft", "PaidAttemptsLeft")}
      />
    </View>
  );
}

function AnalysisItem({ item }: { item: Item }) {
  const predictions = field(item, "predictions", "Predictions");

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        Анализ №{valueText(field(item, "id", "Id"))}
      </Text>

      <Detail
        label="Пользователь"
        value={
          field(item, "userEmail", "UserEmail") ??
          field(item, "userId", "UserId")
        }
      />

      <Detail label="Статус" value={field(item, "status", "Status")} />

      <Detail
        label="Дата"
        value={field(
          item,
          "createdAt",
          "CreatedAt",
          "analysisDate",
          "AnalysisDate",
        )}
      />

      {Array.isArray(predictions) &&
        predictions.map((prediction, index) => {
          if (!prediction || typeof prediction !== "object") {
            return null;
          }
          const p = prediction as Item;
          const confidence = field(p, "confidence", "Confidence");
          const percentage =
            typeof confidence === "number"
              ? `${
                  confidence <= 1
                    ? (confidence * 100).toFixed(1)
                    : confidence.toFixed(1)
                }%`
              : "—";

          return (
            <Text key={index} style={styles.prediction}>
              {index + 1}.{" "}
              {valueText(
                field(p, "birdName", "BirdName", "species", "Species"),
              )}{" "}
              — {percentage}
            </Text>
          );
        })}
    </View>
  );
}

function PaymentItem({ item }: { item: Item }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        Платёж №{valueText(field(item, "id", "Id"))}
      </Text>

      <Detail
        label="Пользователь"
        value={
          field(item, "userEmail", "UserEmail") ??
          field(item, "userId", "UserId")
        }
      />

      <Detail
        label="Попытки"
        value={field(
          item,
          "attempts",
          "Attempts",
          "attemptsAdded",
          "AttemptsAdded",
          "attemptsPurchased",
          "AttemptsPurchased",
        )}
      />

      <Text style={styles.hashLabel}>Хеш транзакции:</Text>

      <Text selectable style={styles.hash}>
        {valueText(
          field(item, "transactionHash", "TransactionHash", "txHash", "TxHash"),
        )}
      </Text>
    </View>
  );
}

export default function AdminPanel({ token }: Props) {
  const [section, setSection] = useState<Section>("users");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      setItems([]);
      try {
        let result: unknown;
        if (section === "users") {
          result = await adminApi.users(token);
        } else if (section === "analyses") {
          result = await adminApi.analyses(token);
        } else {
          result = await adminApi.payments(token);
        }
        if (active) {
          setItems(normalizeItems(result));
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Не удалось загрузить данные.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [section, token]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Панель администратора</Text>
      <View style={styles.tabs}>
        {(
          [
            ["users", "Пользователи"],
            ["analyses", "Анализы"],
            ["payments", "Платежи"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setSection(key)}
            style={[styles.tab, section === key && styles.activeTab]}
          >
            <Text
              style={[styles.tabText, section === key && styles.activeTabText]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#217346" />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>Нет данных для отображения.</Text>
        ) : (
          <>
            <Text style={styles.count}>Всего записей: {items.length}</Text>
            {items.map((item, index) => (
              <View key={index}>
                {section === "users" ? (
                  <UserItem item={item} />
                ) : section === "analyses" ? (
                  <AnalysisItem item={item} />
                ) : (
                  <PaymentItem item={item} />
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f8f5",
  },
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#217346",
    margin: 18,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#e5ebe6",
  },
  activeTab: {
    backgroundColor: "#217346",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#445448",
  },
  activeTabText: {
    color: "#fff",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 35,
  },
  count: {
    color: "#666",
    fontSize: 13,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1e8e2",
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#222",
    marginBottom: 10,
  },
  detail: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginVertical: 5,
  },
  detailLabel: {
    flex: 1,
    color: "#777",
    fontSize: 13,
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    color: "#333",
    fontSize: 13,
  },
  prediction: {
    color: "#333",
    paddingVertical: 5,
    fontSize: 13,
  },
  hashLabel: {
    marginTop: 10,
    color: "#777",
    fontSize: 13,
  },
  hash: {
    fontSize: 12,
    color: "#217346",
    marginTop: 5,
  },
  error: {
    color: "#c0392b",
    padding: 15,
  },
  empty: {
    color: "#777",
    textAlign: "center",
    marginTop: 25,
  },
});
