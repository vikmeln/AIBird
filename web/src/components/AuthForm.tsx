import { useState, type FormEvent } from "react";
import { authApi } from "../api";

interface Props {
  onLogin: (token: string, email: string) => void;
}

export default function AuthForm({ onLogin }: Props) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (register) {
        await authApi.register(email, password);
      }
      const result = await authApi.login(email, password);
      const token = result.token || result.accessToken || result.jwtToken;
      if (!token) {
        throw new Error("Сервер не вернул JWT-токен");
      }
      onLogin(token, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-intro">
        <div className="brand">
          <span className="brand-icon">✦</span>
          AI Bird
        </div>

        <h1>Открой мир птиц с помощью AI</h1>
        <p>
          Загрузи фотографию, узнай вид птицы и сохрани результат распознавания
          в своей коллекции.
        </p>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</span>
          <h2>{register ? "Создать аккаунт" : "Войти в аккаунт"}</h2>
          <p className="muted">
            {register
              ? "Создай аккаунт и получи 5 бесплатных распознаваний."
              : "Продолжи исследовать мир птиц."}
          </p>

          <label>
            Электронная почта
            <input
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading
              ? "Подключение..."
              : register
                ? "Зарегистрироваться"
                : "Войти"}
          </button>

          <p className="auth-switch">
            {register ? "Уже есть аккаунт?" : "Нет аккаунта?"}
            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Войти" : "Регистрация"}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
