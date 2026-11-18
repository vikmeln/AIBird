import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api";
import type { AdminUser, BirdAnalysis, Payment } from "../types";

interface Props {
  token: string;
  onBack: () => void;
  onLogout: () => void;
}

type Tab = "users" | "analyses" | "payments";

export default function AdminPanel({ token, onBack, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [analyses, setAnalyses] = useState<BirdAnalysis[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [usersData, analysesData, paymentsData] = await Promise.all([
        adminApi.users(token),
        adminApi.analyses(token),
        adminApi.payments(token),
      ]);
      setUsers(usersData);
      setAnalyses(analysesData);
      setPayments(paymentsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить данные",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function formatDate(date?: string) {
    return date ? new Date(date).toLocaleString("ru-RU") : "—";
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">✦</span>
          AI Bird
        </div>

        <div className="account">
          <button className="outline-button" onClick={onBack}>
            К распознаванию
          </button>
          <button className="outline-button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </header>

      <main className="content">
        <h1>Панель администратора</h1>
        <p className="muted">
          Просмотр пользователей, распознаваний и платежей.
        </p>

        <div className="stats">
          <div className="stat">
            <span>Пользователей</span>
            <strong>{users.length}</strong>
          </div>
          <div className="stat">
            <span>Анализов</span>
            <strong>{analyses.length}</strong>
          </div>
          <div className="stat">
            <span>Платежей</span>
            <strong>{payments.length}</strong>
          </div>
        </div>

        <section className="admin-content">
          <div className="admin-toolbar">
            <div className="admin-tabs">
              <button
                className={tab === "users" ? "active" : ""}
                onClick={() => setTab("users")}
              >
                Пользователи
              </button>

              <button
                className={tab === "analyses" ? "active" : ""}
                onClick={() => setTab("analyses")}
              >
                Анализы
              </button>

              <button
                className={tab === "payments" ? "active" : ""}
                onClick={() => setTab("payments")}
              >
                Платежи
              </button>
            </div>

            <button
              className="outline-button"
              onClick={() => void load()}
              disabled={loading}
            >
              Обновить
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {loading ? (
            <p className="muted">Загрузка данных...</p>
          ) : (
            <div className="table-scroll">
              {tab === "users" && (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Email</th>
                      <th>Бесплатных использовано</th>
                      <th>Платных осталось</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.email}</td>
                        <td>{user.freeAttemptsUsed}</td>
                        <td>{user.paidAttemptsLeft}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "analyses" && (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Пользователь</th>
                      <th>Файл</th>
                      <th>Статус</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.userId ?? "—"}</td>
                        <td>{item.fileName}</td>
                        <td>{item.status}</td>
                        <td>{formatDate(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "payments" && (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Пользователь</th>
                      <th>Попытки</th>
                      <th>Транзакция</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.id}</td>
                        <td>{payment.userId}</td>
                        <td>+{payment.attemptsAdded}</td>
                        <td title={payment.transactionHash}>
                          {payment.transactionHash.slice(0, 14)}...
                        </td>
                        <td>{formatDate(payment.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {!loading && !error && (
            <>
              {tab === "users" && users.length === 0 && (
                <p className="empty-text">Пользователей пока нет.</p>
              )}
              {tab === "analyses" && analyses.length === 0 && (
                <p className="empty-text">Анализов пока нет.</p>
              )}
              {tab === "payments" && payments.length === 0 && (
                <p className="empty-text">Платежей пока нет.</p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
