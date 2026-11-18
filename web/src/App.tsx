import { useState } from "react";
import AuthForm from "./components/AuthForm";
import BirdDashboard from "./components/BirdDashboard";
import AdminPanel from "./components/AdminPanel";

interface Session {
  token: string;
  email: string;
}

type Page = "user" | "admin";

function isAdmin(token: string): boolean {
  try {
    const encoded = token.split(".")[1];
    const payload = JSON.parse(
      atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
    );
    const role =
      payload.role ??
      payload.roles ??
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
    return Array.isArray(role) ? role.includes("Admin") : role === "Admin";
  } catch {
    return false;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const token = sessionStorage.getItem("token");
    const email = sessionStorage.getItem("email");
    return token && email ? { token, email } : null;
  });

  const [page, setPage] = useState<Page>(() => {
    const token = sessionStorage.getItem("token");
    return token && isAdmin(token) ? "admin" : "user";
  });

  function login(token: string, email: string) {
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("email", email);
    setSession({ token, email });
    setPage(isAdmin(token) ? "admin" : "user");
  }

  function logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("email");
    setSession(null);
    setPage("user");
  }

  if (!session) {
    return <AuthForm onLogin={login} />;
  }

  const admin = isAdmin(session.token);

  if (admin && page === "admin") {
    return (
      <AdminPanel
        token={session.token}
        onBack={() => setPage("user")}
        onLogout={logout}
      />
    );
  }

  return (
    <BirdDashboard
      token={session.token}
      email={session.email}
      onLogout={logout}
      onAdmin={admin ? () => setPage("admin") : undefined}
    />
  );
}
