import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Plus,
  Save,
  Trash2,
  Package,
  LockKeyhole,
} from "lucide-react";
import type {
  ModelDefinition,
  RoomState,
  SceneDocument,
  ShapeKind,
  Vec3,
} from "@climbed/contracts";
import { modelSchema } from "@climbed/contracts";
import type { Edit } from "../domain/editor";
import { NumberField } from "./Fields";
import { ShapeThumbnail } from "./LibraryPanel";
import { ModelPreview } from "./ModelPreview";
const shapeNames: Record<ShapeKind, string> = {
  jug: "Bac à cavité",
  crimp: "Réglette",
  pinch: "Pince",
  dome: "Dôme",
  pyramid: "Pyramide",
  prism: "Prisme",
  box: "Boîte",
  scoop: "Coupelle creuse",
};
interface Props {
  scene: SceneDocument;
  room: RoomState;
  edit: (fn: Edit) => void;
  onBack: () => void;
  dirty: boolean;
  busy: boolean;
  canManageStock: boolean;
  declareStock: (modelId: string, total: number) => Promise<void>;
}
export function CatalogEditor({
  scene,
  room,
  edit,
  onBack,
  dirty,
  busy,
  canManageStock,
  declareStock,
}: Props) {
  const [selectedId, setSelectedId] = useState(scene.models[0]?.id ?? "");
  const [draft, setDraft] = useState<ModelDefinition | null>(
    scene.models[0] ?? null,
  );
  const [issue, setIssue] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [stockBusy, setStockBusy] = useState(false);
  const current = scene.models.find((m) => m.id === selectedId);
  const inventory = room.inventory.find((i) => i.modelId === selectedId);
  const formChanged =
    !!draft && JSON.stringify(draft) !== JSON.stringify(current);
  const locked =
    !!current &&
    (room.lockedModelIds?.includes(current.id) ||
      scene.placements.some((p) => p.modelId === current.id) ||
      (inventory?.total ?? 0) > 0 ||
      !!room.occupations?.some((o) => o.model.id === current.id));
  useEffect(() => {
    setDraft(current ? structuredClone(current) : null);
    setQuantity(inventory?.total ?? 0);
    setIssue("");
  }, [selectedId, current, inventory?.total]);
  function create(kind: "hold" | "volume") {
    const model: ModelDefinition = {
      id: crypto.randomUUID(),
      version: 1,
      name: kind === "hold" ? "Nouvelle prise" : "Nouveau volume",
      kind,
      shape: kind === "hold" ? "jug" : "pyramid",
      dimensions: kind === "hold" ? [0.22, 0.16, 0.11] : [1, 0.8, 0.4],
      color: kind === "hold" ? "#f07c54" : "#657d75",
      source: { type: "parametric", generatorVersion: 1 },
    };
    edit((d) => d.models.push(model));
    setSelectedId(model.id);
  }
  function duplicate() {
    if (!draft) return;
    const next = {
      ...structuredClone(draft),
      id: crypto.randomUUID(),
      name: `${draft.name} · variante`,
    };
    edit((d) => d.models.push(next));
    setSelectedId(next.id);
  }
  function apply() {
    if (!draft || locked) return;
    const checked = modelSchema.safeParse(draft);
    if (!checked.success) {
      setIssue(
        "Renseignez un nom et des dimensions comprises entre 0,005 et 30 m.",
      );
      return;
    }
    edit((d) => {
      const index = d.models.findIndex((m) => m.id === draft.id);
      if (index >= 0) d.models[index] = structuredClone(draft);
    });
    setIssue("");
  }
  return (
    <section
      className="catalog-editor"
      data-testid="catalog-editor"
      data-model-id={draft?.id}
    >
      <header className="catalog-heading">
        <div>
          <span className="eyebrow">MODÈLES PARAMÉTRIQUES</span>
          <h1>La bibliothèque de votre projet</h1>
          <p>
            Créez un modèle, déclarez vos exemplaires, puis retrouvez-le dans la
            salle.
          </p>
        </div>
        <button
          className="secondary"
          data-testid="catalog-back"
          onClick={onBack}
        >
          <ArrowLeft size={14} />
          Retour à la salle
        </button>
      </header>
      <div className="catalog-layout">
        <aside className="catalog-list">
          <div className="catalog-create-buttons">
            <button
              className="secondary"
              data-testid="catalog-create-hold"
              onClick={() => create("hold")}
            >
              <Plus size={14} />
              Prise
            </button>
            <button
              className="secondary"
              data-testid="catalog-create-volume"
              onClick={() => create("volume")}
            >
              <Plus size={14} />
              Volume
            </button>
          </div>
          {scene.models.map((m) => (
            <button
              className={`catalog-list-item ${selectedId === m.id ? "active" : ""}`}
              key={m.id}
              data-testid={`catalog-edit-${m.id}`}
              onClick={() => setSelectedId(m.id)}
            >
              <ShapeThumbnail model={m} />
              <span>
                <strong>{m.name}</strong>
                <small>
                  {m.kind === "hold" ? "Prise" : "Volume"} ·{" "}
                  {shapeNames[m.shape]}
                </small>
              </span>
            </button>
          ))}
        </aside>
        {draft ? (
          <>
            <div className="catalog-stage">
              <ModelPreview model={draft} />
              <div className="model-dimensions-summary">
                <span>
                  <b>{draft.dimensions[0].toFixed(3)}</b>Largeur · m
                </span>
                <span>
                  <b>{draft.dimensions[1].toFixed(3)}</b>Hauteur · m
                </span>
                <span>
                  <b>{draft.dimensions[2].toFixed(3)}</b>Profondeur · m
                </span>
              </div>
              <div className="catalog-info">
                Ces formes génériques servent à la conception. Le scan et
                l’import de modèles 3D rejoindront ce catalogue dans une version
                ultérieure.
              </div>
            </div>
            <aside className="catalog-properties">
              <span className="eyebrow">
                {draft.kind === "hold" ? "PRISE" : "VOLUME"}
              </span>
              <h2>Définition du modèle</h2>
              {locked && (
                <div className="catalog-locked">
                  <LockKeyhole size={15} />
                  <p>
                    Ce modèle possède des exemplaires ou des placements.
                    Dupliquez-le pour créer une variante sans modifier le
                    matériel existant.
                  </p>
                </div>
              )}
              <fieldset disabled={locked}>
                <label className="text-field">
                  Nom
                  <input
                    data-testid="model-name"
                    aria-label="Nom du modèle"
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </label>
                <label className="text-field">
                  Forme
                  <select
                    data-testid="model-shape"
                    aria-label="Forme du modèle"
                    value={draft.shape}
                    onChange={(e) =>
                      setDraft({ ...draft, shape: e.target.value as ShapeKind })
                    }
                  >
                    {Object.entries(shapeNames)
                      .filter(([shape]) =>
                        draft.kind === "volume"
                          ? [
                              "box",
                              "pyramid",
                              "prism",
                              "dome",
                              "scoop",
                            ].includes(shape)
                          : ["jug", "crimp", "pinch", "dome", "scoop"].includes(
                              shape,
                            ),
                      )
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="catalog-dimension-fields">
                  {["Largeur", "Hauteur", "Profondeur"].map((label, i) => (
                    <NumberField
                      key={i}
                      label={label}
                      value={draft.dimensions[i]!}
                      unit="m"
                      min={0.005}
                      max={30}
                      step={0.01}
                      testId={["model-width", "model-height", "model-depth"][i]}
                      onChange={(n) => {
                        const dimensions = [...draft.dimensions] as Vec3;
                        dimensions[i] = n;
                        setDraft({ ...draft, dimensions });
                      }}
                    />
                  ))}
                </div>
                <label className="color-field">
                  Couleur
                  <input
                    data-testid="model-color"
                    aria-label="Couleur du modèle"
                    type="color"
                    value={draft.color}
                    onChange={(e) =>
                      setDraft({ ...draft, color: e.target.value })
                    }
                  />
                </label>
                <button
                  className="primary"
                  data-testid="model-apply"
                  onClick={apply}
                  disabled={busy}
                >
                  <Save size={14} />
                  Appliquer au projet
                </button>
              </fieldset>
              <div className="catalog-model-actions">
                <button
                  className="secondary"
                  data-testid={`catalog-duplicate-${draft.id}`}
                  onClick={duplicate}
                >
                  <Copy size={13} />
                  Créer une variante
                </button>
                <button
                  className="danger-button"
                  data-testid="model-delete"
                  disabled={locked}
                  onClick={() => {
                    edit((d) => {
                      d.models = d.models.filter((m) => m.id !== selectedId);
                    });
                    setSelectedId(
                      scene.models.find((m) => m.id !== selectedId)?.id ?? "",
                    );
                  }}
                >
                  <Trash2 size={13} />
                  Supprimer ce modèle
                </button>
              </div>
              <section className="catalog-inventory">
                <h3>
                  <Package size={15} />
                  Exemplaires de cette salle
                </h3>
                <p>
                  Une déclaration explicite crée ou retire des exemplaires
                  disponibles. Les pièces occupées restent protégées.
                </p>
                <NumberField
                  label="Quantité totale possédée"
                  value={quantity}
                  min={0}
                  step={1}
                  testId="model-stock-total"
                  onChange={setQuantity}
                />
                <button
                  className="secondary"
                  data-testid="model-stock-apply"
                  disabled={
                    dirty ||
                    formChanged ||
                    busy ||
                    stockBusy ||
                    !canManageStock ||
                    !Number.isInteger(quantity)
                  }
                  onClick={async () => {
                    setStockBusy(true);
                    setIssue("");
                    try {
                      await declareStock(draft.id, quantity);
                    } catch (e) {
                      setIssue((e as Error).message);
                    } finally {
                      setStockBusy(false);
                    }
                  }}
                >
                  {stockBusy ? "Mise à jour…" : "Déclarer cette quantité"}
                </button>
                {(dirty || formChanged) && (
                  <small>
                    Appliquez le modèle puis sauvegardez le projet avant de
                    déclarer le stock.
                  </small>
                )}
                {!canManageStock && (
                  <small>
                    La déclaration du stock est réservée aux responsables.
                  </small>
                )}
                <span className="small-muted">
                  {inventory?.available ?? 0} disponibles ·{" "}
                  {inventory?.reserved ?? 0} réservés ·{" "}
                  {inventory?.installed ?? 0} installés
                </span>
              </section>
              {issue && (
                <div className="error-banner" role="alert">
                  {issue}
                </div>
              )}
            </aside>
          </>
        ) : (
          <p className="empty-copy">Créez votre premier modèle.</p>
        )}
      </div>
    </section>
  );
}
