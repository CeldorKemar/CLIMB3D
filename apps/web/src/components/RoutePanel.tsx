import { Eye, Plus, Trash2, Flag, Crosshair } from "lucide-react";
import type { SceneDocument } from "@climbed/contracts";
import type { Edit } from "../domain/editor";
interface Props {
  scene: SceneDocument;
  selected: string | null;
  edit: (fn: Edit) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  hiddenIds: string[];
  setHiddenIds: (ids: string[]) => void;
}
export function RoutePanel({
  scene,
  selected,
  edit,
  activeId,
  setActiveId,
  hiddenIds,
  setHiddenIds,
}: Props) {
  const active = scene.boulders.find((b) => b.id === activeId);
  const placement = scene.placements.find((p) => p.id === selected);
  const isHold =
    scene.models.find((m) => m.id === placement?.modelId)?.kind === "hold";
  const update = (patch: object) =>
    edit((d) =>
      Object.assign(d.boulders.find((b) => b.id === activeId)!, patch),
    );
  function create() {
    const id = crypto.randomUUID();
    let index = 1;
    while (scene.boulders.some((b) => b.name === `Voie ${index}`)) index++;
    edit((d) =>
      d.boulders.push({
        id,
        name: `Voie ${index}`,
        grade: "",
        color: "#b4d77a",
        placementIds: [],
        startIds: [],
        finishIds: [],
      }),
    );
    setActiveId(id);
  }
  return (
    <div className="property-section routes-panel">
      <div className="section-title">
        <h4>
          <Eye size={14} />
          Voies & visibilité
        </h4>
        <button
          className="icon-button small"
          data-testid="route-create"
          aria-label="Créer une voie"
          onClick={create}
        >
          <Plus size={15} />
        </button>
      </div>
      <p className="small-muted">
        Choisissez une voie active pour y placer les nouveaux éléments. Chaque
        élément peut appartenir à plusieurs voies.
      </p>
      <div className="route-list">
        {scene.boulders.map((route) => (
          <div
            className={`route-row ${activeId === route.id ? "active" : ""}`}
            key={route.id}
          >
            <input
              type="checkbox"
              data-testid={`route-visible-${route.id}`}
              aria-label={`Afficher ${route.name}`}
              checked={!hiddenIds.includes(route.id)}
              onChange={(e) =>
                setHiddenIds(
                  e.target.checked
                    ? hiddenIds.filter((id) => id !== route.id)
                    : [...hiddenIds, route.id],
                )
              }
            />
            <button
              data-testid={`route-active-${route.id}`}
              onClick={() => setActiveId(route.id)}
            >
              <i style={{ background: route.color }} />
              <span>
                {route.name}
                <small>
                  {route.grade || "Sans cotation"} · {route.placementIds.length}{" "}
                  éléments
                </small>
              </span>
            </button>
          </div>
        ))}
      </div>
      {active && (
        <>
          <label className="text-field">
            Nom de la voie
            <input
              key={`${active.id}-${active.name}`}
              aria-label="Nom de la voie"
              defaultValue={active.name}
              onBlur={(e) => {
                if (e.target.value.trim())
                  update({ name: e.target.value.trim() });
              }}
            />
          </label>
          <div className="boulder-details">
            <label className="text-field">
              Cotation
              <input
                key={`${active.id}-grade`}
                aria-label="Cotation"
                defaultValue={active.grade}
                onBlur={(e) => update({ grade: e.target.value })}
              />
            </label>
            <label className="color-field">
              Couleur
              <input
                aria-label="Couleur de la voie"
                type="color"
                value={active.color}
                onChange={(e) => update({ color: e.target.value })}
              />
            </label>
          </div>
          <button
            className="danger-button"
            aria-label="Supprimer la voie"
            onClick={() => {
              edit((d) => {
                d.boulders = d.boulders.filter((b) => b.id !== active.id);
              });
              setActiveId(null);
            }}
          >
            <Trash2 size={12} />
            Supprimer la voie sans retirer ses éléments
          </button>
        </>
      )}
      {placement && (
        <div className="route-memberships">
          <h4>Associer cet élément</h4>
          {scene.boulders.map((route) => (
            <label className="checkbox-line" key={route.id}>
              <input
                data-testid={`route-member-${route.id}`}
                type="checkbox"
                checked={route.placementIds.includes(placement.id)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  edit((d) => {
                    const target = d.boulders.find((b) => b.id === route.id)!;
                    if (checked) target.placementIds.push(placement.id);
                    else {
                      target.placementIds = target.placementIds.filter(
                        (id) => id !== placement.id,
                      );
                      target.startIds = target.startIds.filter(
                        (id) => id !== placement.id,
                      );
                      target.finishIds = target.finishIds.filter(
                        (id) => id !== placement.id,
                      );
                    }
                  });
                }}
              />
              {route.name}
            </label>
          ))}
          {isHold && active?.placementIds.includes(placement.id) && (
            <div className="preset-row">
              {(["startIds", "finishIds"] as const).map((key) => (
                <button
                  key={key}
                  className={active[key].includes(placement.id) ? "active" : ""}
                  onClick={() =>
                    update({
                      [key]: active[key].includes(placement.id)
                        ? active[key].filter((id) => id !== placement.id)
                        : [...active[key], placement.id],
                    })
                  }
                >
                  {key === "startIds" ? (
                    <>
                      <Crosshair size={12} />
                      Départ
                    </>
                  ) : (
                    <>
                      <Flag size={12} />
                      Arrivée
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
