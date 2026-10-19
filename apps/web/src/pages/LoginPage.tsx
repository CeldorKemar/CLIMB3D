import { useState, type FormEvent } from "react";
import { ArrowRight, Layers3, LockKeyhole, Check } from "lucide-react";
import type { BootstrapResponse } from "@climbed/contracts";
import { api } from "../api/client";
import { Brand } from "../components/Brand";
export function LoginPage({
  onLogin,
  initialError,
}: {
  onLogin: (session: BootstrapResponse) => void;
  initialError: string;
}) {
  const localDemo =
    import.meta.env.DEV &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const [email, setEmail] = useState(localDemo ? "alice@climbed.local" : "");
  const [password, setPassword] = useState(
    localDemo ? "climbed-local-demo" : "",
  );
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await api.login(email, password));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow">L’ATELIER DES OUVREURS</span>
          <h1>
            Les prochains
            <br />
            mouvements
            <br />
            <em>commencent ici.</em>
          </h1>
          <p>
            Imaginez vos murs. Composez vos blocs.
            <br />
            Préparez le terrain, ensemble.
          </p>
          <div className="story-points">
            <span>
              <Check size={16} />
              Conception 3D
            </span>
            <span>
              <Check size={16} />
              Matériel partagé
            </span>
          </div>
        </div>
        <div className="abstract-wall">
          <i />
          <i />
          <i />
          <b />
          <b />
          <b />
          <b />
          <b />
        </div>
        <span className="story-footer">CLIMBED · PROTOTYPE D’ATELIER</span>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="login-icon">
            <Layers3 size={27} />
          </div>
          <span className="eyebrow">VOTRE ESPACE DE CRÉATION</span>
          <h2>Bienvenue à l’atelier.</h2>
          <p>
            Connectez-vous pour retrouver votre salle
            <br />
            et donner forme à vos idées.
          </p>
          {error && (
            <div role="alert" className="error-banner">
              {error}
            </div>
          )}
          <label>
            Adresse e-mail
            <input
              data-testid="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@votre-salle.fr"
            />
          </label>
          <label>
            Mot de passe
            <input
              data-testid="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            data-testid="login-submit"
            className="primary login-submit"
            disabled={busy}
          >
            {busy ? "Connexion…" : "Entrer dans l’atelier"}
            <ArrowRight size={18} />
          </button>
          {localDemo && (
            <div className="local-demo">
              <LockKeyhole size={16} />
              <span>
                Démo locale : <strong>alice@climbed.local</strong>
                <br />
                Mot de passe : climbed-local-demo
              </span>
            </div>
          )}
          <p className="login-footnote">
            L’accès aux salles est attribué par votre administrateur.
          </p>
        </form>
      </section>
    </main>
  );
}
