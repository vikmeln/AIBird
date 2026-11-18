import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import BirdInfoCard from "./BirdInfoCard";
import { birdsApi } from "../api";
import type { Attempts, BirdAnalysis } from "../types";

interface Props {
  token: string;
}

function getField(item: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (item[name] !== undefined && item[name] !== null) {
      return item[name];
    }
  }
  return undefined;
}

function predictionName(prediction: Record<string, unknown>): string {
  const value = getField(prediction, [
    "birdName",
    "BirdName",
    "speciesName",
    "SpeciesName",
    "species",
    "Species",
    "label",
    "Label",
    "name",
    "Name",
    "className",
    "ClassName",
  ]);
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  const nested = getField(prediction, ["birdInfo", "BirdInfo"]);
  if (nested && typeof nested === "object") {
    return predictionName(nested as Record<string, unknown>);
  }
  return "Название вида не указано";
}

function predictionPercent(prediction: Record<string, unknown>): string {
  const value = getField(prediction, [
    "confidence",
    "Confidence",
    "probability",
    "Probability",
    "score",
    "Score",
  ]);
  if (typeof value !== "number") return "";
  const percent = value <= 1 ? value * 100 : value;
  return `${percent.toFixed(1)}%`;
}

function getPredictions(analysis: BirdAnalysis): Record<string, unknown>[] {
  const value = getField(analysis, ["predictions", "Predictions"]);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === "object",
  );
}

function statusText(status: unknown): string {
  const value = String(status ?? "").toLowerCase();
  if (value === "completed" || value === "done") {
    return "Завершено";
  }
  if (value === "pending" || value === "queued") {
    return "В очереди";
  }
  if (value === "processing") {
    return "Обрабатывается";
  }
  if (value === "failed" || value === "error") {
    return "Ошибка обработки";
  }
  return String(status ?? "Неизвестен");
}

export default function BirdDashboard({ token }: Props) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempts | null>(null);
  const [history, setHistory] = useState<BirdAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setRefreshing(true);
    try {
      const [attemptsData, historyData] = await Promise.all([
        birdsApi.attempts(token),
        birdsApi.history(token),
      ]);
      setAttempts(attemptsData);
      setHistory(historyData);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось получить данные.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    if (watchId === null) return;
    let checks = 0;
    const timer = setInterval(async () => {
      checks += 1;
      try {
        const [newAttempts, newHistory] = await Promise.all([
          birdsApi.attempts(token),
          birdsApi.history(token),
        ]);
        setAttempts(newAttempts);
        setHistory(newHistory);
        const analysis = newHistory.find((item) => Number(item.id) === watchId);
        if (analysis) {
          const status = String(
            analysis.status ?? analysis.Status ?? "",
          ).toLowerCase();
          if (["completed", "done", "failed", "error"].includes(status)) {
            setWatchId(null);
            setMessage(
              status === "completed" || status === "done"
                ? "Распознавание завершено!"
                : "Не удалось распознать фотографию.",
            );
          }
        }
      } catch {}
      if (checks >= 20) {
        setWatchId(null);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [watchId, token]);

  async function choosePhoto() {
    setError("");
    setMessage("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled || !result.assets.length) {
        return;
      }
      const photo = result.assets[0];
      const context = ImageManipulator.manipulate(photo.uri);
      if (photo.width > 1600) {
        context.resize({
          width: 1600,
          height: null,
        });
      }
      const rendered = await context.renderAsync();
      const jpeg = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.8,
      });
      setPhotoUri(jpeg.uri);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось выбрать фотографию.",
      );
    }
  }

  async function analyzePhoto() {
    if (!photoUri || sending || watchId !== null) {
      return;
    }
    setSending(true);
    setError("");
    setMessage("");
    try {
      const result = await birdsApi.analyze(token, photoUri);
      setMessage("Фотография отправлена на анализ.");
      await loadData();
      if (typeof result.id === "number") {
        setWatchId(result.id);
      }
      setPhotoUri(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось отправить фотографию.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Распознавание птиц</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Мои попытки</Text>
        <Text style={styles.counter}>
          Бесплатные: {attempts?.freeAttemptsLeft ?? "—"}
        </Text>
        <Text style={styles.counter}>
          Оплаченные: {attempts?.paidAttemptsLeft ?? "—"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Загрузить фотографию</Text>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Выберите фотографию птицы
            </Text>
          </View>
        )}
        <Pressable
          style={styles.secondaryButton}
          onPress={choosePhoto}
          disabled={sending}
        >
          <Text style={styles.secondaryText}>Выбрать из галереи</Text>
        </Pressable>
        <Pressable
          style={[
            styles.primaryButton,
            (!photoUri || sending || watchId !== null) && styles.disabled,
          ]}
          onPress={analyzePhoto}
          disabled={!photoUri || sending || watchId !== null}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Распознать птицу</Text>
          )}
        </Pressable>
        {watchId !== null && (
          <View style={styles.processing}>
            <ActivityIndicator color="#217346" />
            <Text style={styles.processingText}>Ожидаем результат AI...</Text>
          </View>
        )}
        {!!message && <Text style={styles.success}>{message}</Text>}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.heading}>История анализов</Text>
        <Pressable onPress={() => void loadData()} disabled={refreshing}>
          <Text style={styles.refresh}>
            {refreshing ? "Загрузка..." : "Обновить"}
          </Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator color="#217346" size="large" />}
      {!loading && history.length === 0 && (
        <Text style={styles.empty}>Анализов пока нет.</Text>
      )}
      {history.slice(0, 20).map((analysis, index) => {
        const predictions = getPredictions(analysis);
        const status = analysis.status ?? analysis.Status;

        return (
          <View key={`${analysis.id ?? index}-${index}`} style={styles.card}>
            <Text style={styles.cardTitle}>Анализ №{analysis.id ?? "?"}</Text>
            <Text style={styles.status}>Статус: {statusText(status)}</Text>
            {predictions.slice(0, 3).map((prediction, position) => (
              <View key={position} style={styles.prediction}>
                <Text style={styles.predictionName}>
                  {position + 1}. {predictionName(prediction)}
                </Text>
                <Text style={styles.percent}>
                  {predictionPercent(prediction)}
                </Text>
              </View>
            ))}
            <BirdInfoCard
              birdInfo={
                (analysis.birdInfo ?? analysis.BirdInfo ?? null) as Record<
                  string,
                  unknown
                > | null
              }
            />
          </View>
        );
      })}
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
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2eae4",
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 12,
  },
  counter: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  preview: {
    width: "100%",
    height: 210,
    borderRadius: 12,
    resizeMode: "contain",
    backgroundColor: "#eef3ee",
    marginBottom: 14,
  },
  placeholder: {
    height: 150,
    backgroundColor: "#f0f5f0",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  placeholderText: {
    color: "#68756b",
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#217346",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#217346",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryText: {
    color: "#217346",
    fontWeight: "bold",
  },
  disabled: {
    opacity: 0.5,
  },
  processing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 15,
  },
  processingText: {
    color: "#217346",
  },
  success: {
    color: "#217346",
    marginTop: 14,
  },
  error: {
    color: "#bb3333",
    marginTop: 14,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refresh: {
    color: "#217346",
    fontWeight: "bold",
    marginBottom: 16,
  },
  empty: {
    textAlign: "center",
    color: "#777",
    padding: 25,
  },
  status: {
    color: "#666",
    marginBottom: 10,
  },
  prediction: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  predictionName: {
    flex: 1,
    color: "#333",
    fontSize: 14,
  },
  percent: {
    color: "#217346",
    fontWeight: "bold",
  },
});
