import { useEffect, useState } from "react";
import { History, Save, RotateCcw } from "lucide-react";
import type { SceneDocument, SnapshotSummary } from "@climbed/contracts";
import { api } from "../api/client";
interface Props {
  roomId: string;
  csrf: string;
  revision: number;
  scene: SceneDocument;
  dirty: boolean;
  busy: boolean;
  restore: (id: string) => void;
}
export function HistoryPanel({
  roomId,
  csrf,
  revision,
  scene,
  dirty,
  busy,
  restore,
}: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("room");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .history(roomId)
      .then((result) => {
        if (active) setSnapshots(result.snapshots);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [roomId, revision]);
  async function create() {
    setSaving(true);
    setError("");
    try {
      const snapshot = await api.createSnapshot(
        roomId,
        {
          kind: scope === "room" ? "room" : "boulder",
          label: label.trim() || `Version ${revision}`,
          boulderId: scope === "room" ? undefined : scope,
          expectedRevision: revision,
          requestId: crypto.randomUUID(),
        },
        csrf,
      );
      setSnapshots((items) => [snapshot, ...items]);
      setLabel("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="history-content">
      <div className="inspector-title">
        <span className="eyebrow">VERSIONS DE CONCEPTION</span>
        <h3>Retrouver un état précis.</h3>
        <p className="small-muted">
          Conservez une salle complète ou une voie, puis restaurez sa
          conception. Le stock physique reste géré par les interventions.
        </p>
      </div>
      <section className="property-section">
        <h4>
          <Save size={14} />
          Conserver une version
        </h4>
        <label className="text-field">
          Périmètre
          <select
            data-testid="snapshot-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="room">Toute la salle</option>
            {scene.boulders.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-field">
          Nom de la version
          <input
            data-testid="snapshot-label"
            value={label}
            maxLength={120}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Version ${revision}`}
          />
        </label>
        <button
          className="primary"
          data-testid="snapshot-create"
          disabled={dirty || busy || saving}
          onClick={create}
        >
          {saving ? "Création…" : "Conserver cette version"}
        </button>
        {dirty && (
          <p className="field-note">
            Sauvegardez le projet avant de créer ou restaurer une version.
          </p>
        )}
      </section>
      <section className="property-section">
        <h4>
          <History size={14} />
          Versions conservées
        </h4>
        {!snapshots.length && (
          <p className="empty-copy">
            Les versions que vous conservez apparaîtront ici.
          </p>
        )}
        {snapshots.map((item) => (
          <article className="snapshot-card" key={item.id}>
            <span className="eyebrow">
              {item.kind === "room" ? "SALLE COMPLÈTE" : "VOIE"}
            </span>
            <strong>{item.label}</strong>
            <small>
              {item.actorName} ·{" "}
              {new Date(item.createdAt).toLocaleString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · v{item.sourceRevision}
            </small>
            <button
              className="secondary"
              data-testid={`snapshot-restore-${item.id}`}
              disabled={dirty || busy}
              onClick={() => restore(item.id)}
            >
              <RotateCcw size={12} />
              Restaurer la conception
            </button>
          </article>
        ))}
      </section>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
