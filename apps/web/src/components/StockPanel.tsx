import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Package,
  RotateCcw,
  Warehouse,
  Clock3,
} from "lucide-react";
import type {
  ReservationAction,
  ReservationState,
  RoomState,
  SceneDocument,
} from "@climbed/contracts";
const stateLabels: Record<ReservationState, string> = {
  reserved: "Réservé",
  taken: "Retiré de la réserve",
  installed: "Installé",
  return_pending: "Retour à confirmer",
  returned: "Retourné",
  cancelled: "Annulé",
};
const nextActions: Partial<
  Record<ReservationState, { action: ReservationAction; label: string }[]>
> = {
  reserved: [
    { action: "withdraw", label: "Pièces récupérées" },
    { action: "cancel", label: "Annuler la réservation" },
  ],
  taken: [
    { action: "install", label: "Confirmer l’installation" },
    { action: "cancel", label: "Annuler et préparer le retour" },
  ],
  installed: [{ action: "request_return", label: "Préparer le démontage" }],
  return_pending: [
    { action: "return", label: "Confirmer démontage et retour" },
  ],
};
export function StockPanel({
  room,
  scene,
  dirty,
  busy,
  reserve,
  action,
}: {
  room: RoomState;
  scene: SceneDocument;
  dirty: boolean;
  busy: boolean;
  reserve: (wallIds?: string[]) => void;
  action: (id: string, action: ReservationAction) => void;
}) {
  const [scope, setScope] = useState(scene.walls[0]?.id ?? "all");
  const [available, reserved, installed] = room.inventory.reduce(
    (sum, i) => [
      sum[0]! + i.available,
      sum[1]! + i.reserved,
      sum[2]! + i.installed,
    ],
    [0, 0, 0],
  );
  return (
    <div className="stock-content">
      <div className="inspector-title">
        <span className="eyebrow">MATÉRIEL DE CETTE SALLE</span>
        <h3>Du projet au terrain.</h3>
        <p className="small-muted">
          Concevez librement. Réservez avant de vous servir.
        </p>
      </div>
      <div className="stock-metrics">
        <span>
          <b>{available}</b>Disponibles
        </span>
        <span>
          <b>{reserved}</b>Réservés
        </span>
        <span>
          <b>{installed}</b>Installés
        </span>
      </div>
      <div className="reservation-callout">
        <Package size={21} />
        <h4>Prêt à ouvrir ?</h4>
        <p>
          Le check-in réserve les pièces de cette version pour votre
          intervention.
        </p>
        <label className="reservation-scope">
          Pan à préparer
          <select
            aria-label="Pan à réserver"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="all">Tous les pans du projet</option>
            {scene.walls.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          data-testid="reserve-scene"
          disabled={dirty || busy}
          onClick={() => reserve(scope === "all" ? undefined : [scope])}
        >
          <Check size={15} />
          Réserver les pièces
        </button>
        {dirty && (
          <small>Sauvegardez vos modifications avant de réserver.</small>
        )}
      </div>
      <section className="property-section">
        <h4>Interventions</h4>
        {!room.reservations.length && (
          <p className="empty-copy">
            Vos réservations et installations apparaîtront ici.
          </p>
        )}
        {room.reservations.map((r) => (
          <article className={`operation-card state-${r.state}`} key={r.id}>
            <div className="section-title">
              <span className={`operation-state ${r.state}`}>
                {stateLabels[r.state]}
              </span>
              <span className="small-muted">v{r.sceneRevision}</span>
            </div>
            <strong>
              {r.pieceCount} pièces · {r.actorName}
            </strong>
            <p className="small-muted">
              {r.wallIds
                ?.map((id) => scene.walls.find((w) => w.id === id)?.name ?? id)
                .join(", ") ?? "Tous les pans"}
            </p>
            <small>
              {new Date(r.createdAt).toLocaleString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
            {(r.addedCount > 0 || r.removedCount > 0) && (
              <p className="small-muted">
                +{r.addedCount} à ajouter · {r.retainedCount} conservées · −
                {r.removedCount} à retirer
              </p>
            )}
            {nextActions[r.state]?.map(({ action: a, label }) => (
              <button
                key={a}
                disabled={busy}
                onClick={() => action(r.id, a)}
                className={a === "cancel" ? "quiet-button" : "operation-action"}
              >
                {label}
                {a !== "cancel" && <ArrowRight size={13} />}
              </button>
            ))}
          </article>
        ))}
      </section>
      <section className="property-section">
        <h4>Stock physique</h4>
        <p className="small-muted">
          Les modèles servent à concevoir. Les quantités appartiennent à cette
          salle.
        </p>
        <div className="inventory-table">
          <div className="inventory-header">
            <span>Modèle</span>
            <span>Dispo / total</span>
          </div>
          {room.inventory.map((i) => {
            const model = scene.models.find((m) => m.id === i.modelId);
            return (
              <div className="inventory-row" key={i.modelId}>
                <span>
                  <i style={{ background: model?.color ?? "#cbd0c3" }} />
                  {model?.name ?? i.modelId}
                </span>
                <b className={!i.available ? "no-stock" : ""}>
                  {i.available}
                  <small> / {i.total}</small>
                </b>
              </div>
            );
          })}
        </div>
      </section>
      <section className="property-section">
        <h4>
          <Clock3 size={13} />
          Historique
        </h4>
        {!room.audit.length && <p className="small-muted">Aucune opération.</p>}
        {room.audit.slice(0, 15).map((entry) => (
          <div className="audit-entry" key={entry.id}>
            <span className="audit-dot" />
            <div>
              <p>{entry.detail}</p>
              <small>
                {entry.actorName} ·{" "}
                {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
              </small>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
