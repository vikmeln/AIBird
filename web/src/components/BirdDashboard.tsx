import { useCallback, useEffect, useState } from "react";
import { birdsApi } from "../api";
import type { Attempts, BirdAnalysis } from "../types";
import WalletCard from "./WalletCard";

interface Props {
  token: string;
  email: string;
  onLogout: () => void;
  onAdmin?: () => void;
}

export default function BirdDashboard({
  token,
  email,
  onLogout,
  onAdmin,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [history, setHistory] = useState<BirdAnalysis[]>([]);
  const [attempts, setAttempts] = useState<Attempts | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const items = await birdsApi.history(token);
      setHistory(items);
      try {
        setAttempts(await birdsApi.attempts(token));
      } catch {
        setAttempts(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить историю",
      );
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const pending = history.some(
      (item) => item.status.toLowerCase() === "pending",
    );
    if (!pending) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [history, refresh]);

  async function analyze() {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Максимальный размер фотографии — 10 МБ");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await birdsApi.analyze(file, token);
      setMessage("Фотография отправлена на распознавание.");
      setFile(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось отправить фото",
      );
    } finally {
      setLoading(false);
    }
  }

  const freeLeft =
    typeof attempts?.freeAttemptsLeft === "number"
      ? attempts.freeAttemptsLeft
      : typeof attempts?.freeAttemptsUsed === "number"
        ? Math.max(0, 5 - attempts.freeAttemptsUsed)
        : null;

  function formatConfidence(value: number) {
    return `${(value * 100).toFixed(1)}%`;
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">✦</span>
          AI Bird
        </div>
        <div className="account">
          <span>{email}</span>
          {onAdmin && (
            <button className="outline-button" onClick={onAdmin}>
              Админ-панель
            </button>
          )}
          <button className="outline-button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </header>
      <main className="content">
        <div className="page-heading">
          <div>
            <h1>Распознавание птиц</h1>
            <p className="muted">
              Загрузи фотографию, чтобы определить вид птицы.
            </p>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span>Бесплатные попытки</span>
            <strong>{freeLeft ?? "—"}</strong>
          </div>
          <div className="stat">
            <span>Оплаченные попытки</span>
            <strong>{attempts?.paidAttemptsLeft ?? "—"}</strong>
          </div>
          <div className="stat">
            <span>Всего анализов</span>
            <strong>{history.length}</strong>
          </div>
        </div>
        <WalletCard token={token} onPaid={() => void refresh()} />
        <section className="upload-card">
          <div>
            <span className="eyebrow">НОВЫЙ АНАЛИЗ</span>
            <h2>Загрузить фотографию</h2>
            <p className="muted">Поддерживаются JPG, JPEG и PNG, до 10 МБ.</p>
          </div>
          <label className="upload-area">
            {preview ? (
              <img src={preview} alt="Выбранная фотография" />
            ) : (
              <div className="upload-placeholder">
                <span className="upload-symbol">↑</span>
                <strong>Выбрать фотографию птицы</strong>
                <small>Нажми, чтобы открыть файлы</small>
              </div>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="primary-button analyze-button"
            disabled={!file || loading}
            onClick={() => void analyze()}
          >
            {loading ? "Отправка..." : "Распознать птицу"}
          </button>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </section>
        <section className="history-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">МОЯ КОЛЛЕКЦИЯ</span>
              <h2>История распознаваний</h2>
            </div>
            <button className="outline-button" onClick={() => void refresh()}>
              Обновить
            </button>
          </div>
          {history.length === 0 ? (
            <div className="empty-state">
              Здесь появятся результаты после первого распознавания.
            </div>
          ) : (
            <div className="analysis-list">
              {history.map((item) => {
                const predictions = [...(item.predictions ?? [])].sort(
                  (a, b) => a.rank - b.rank,
                );
                return (
                  <article className="analysis-card" key={item.id}>
                    <div className="analysis-top">
                      <div>
                        <h3>{item.fileName}</h3>
                        <small>
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString()
                            : `Анализ №${item.id}`}
                        </small>
                      </div>
                      <span
                        className={
                          item.status.toLowerCase() === "completed"
                            ? "status done"
                            : "status"
                        }
                      >
                        {item.status === "Completed"
                          ? "Готово"
                          : item.status === "Pending"
                            ? "Обрабатывается"
                            : item.status === "Failed"
                              ? "Ошибка обработки"
                              : item.status}
                      </span>
                    </div>
                    {predictions.length > 0 && (
                      <div className="predictions">
                        {predictions.map((prediction) => (
                          <div className="prediction" key={prediction.rank}>
                            <span>
                              {prediction.rank}. {prediction.birdName}
                            </span>
                            <strong>
                              {formatConfidence(prediction.confidence)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.birdInfo && (
                      <div className="bird-description">
                        <strong>
                          {item.birdInfo.ukrainianName ||
                            item.birdInfo.englishName}
                        </strong>
                        {item.birdInfo.description && (
                          <p>{item.birdInfo.description}</p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
