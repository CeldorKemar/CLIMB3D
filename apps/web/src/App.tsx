import { lazy, Suspense, useEffect, useState } from "react";
import type { BootstrapResponse } from "@climbed/contracts";
import { api, ApiError } from "./api/client";
import { LoginPage } from "./pages/LoginPage";
import { Brand } from "./components/Brand";
const AtelierPage = lazy(() =>
  import("./pages/AtelierPage").then((module) => ({
    default: module.AtelierPage,
  })),
);

export function App() {
  const [session, setSession] = useState<BootstrapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .session()
      .then(setSession)
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return (
      <div className="loading-page">
        <Brand />
        <span className="spinner" />
        <p>Préparation de votre atelier…</p>
      </div>
    );
  if (!session) return <LoginPage onLogin={setSession} initialError={error} />;
  return (
    <Suspense
      fallback={
        <div className="loading-page">
          <Brand />
          <span className="spinner" />
          <p>Ouverture de l’atelier 3D…</p>
        </div>
      }
    >
      <AtelierPage
        session={session}
        onLogout={async () => {
          await api.logout(session.csrfToken);
          setSession(null);
        }}
      />
    </Suspense>
  );
}
