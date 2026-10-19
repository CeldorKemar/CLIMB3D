import { useState } from "react";
import {
  Search,
  Plus,
  ChevronDown,
  Layers,
  Box,
  MousePointer2,
  Check,
  Triangle,
} from "lucide-react";
import type { ModelDefinition, SceneDocument } from "@climbed/contracts";
export function ShapeThumbnail({ model }: { model: ModelDefinition }) {
  return (
    <span
      className={`shape-thumb shape-${model.shape}`}
      style={{ "--shape-color": model.color } as React.CSSProperties}
    >
      <i />
      <b />
    </span>
  );
}
interface Props {
  scene: SceneDocument;
  selected: string | null;
  activeModel: ModelDefinition | undefined;
  onSelect: (id: string) => void;
  onModel: (model: ModelDefinition | undefined) => void;
  onAddWall: () => void;
}
export function LibraryPanel({
  scene,
  selected,
  activeModel,
  onSelect,
  onModel,
  onAddWall,
}: Props) {
  const [kind, setKind] = useState<"hold" | "volume">("hold");
  const [search, setSearch] = useState("");
  const models = scene.models.filter(
    (m) =>
      m.kind === kind &&
      m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <aside className="library-panel">
      <div className="panel-heading">
        <span className="eyebrow">CONSTRUIRE & COMPOSER</span>
        <h2>Votre atelier</h2>
      </div>
      <div className="library-content">
        <div className="section-label">
          <span>
            <Layers size={14} />
            STRUCTURE
          </span>
          <span className="count-badge">{scene.walls.length}</span>
        </div>
        <div className="wall-tree">
          {scene.walls.map((wall, i) => (
            <button
              key={wall.id}
              data-testid={`scene-item-${wall.id}`}
              className={`wall-row ${selected === wall.id ? "active" : ""}`}
              onClick={() => {
                onModel(undefined);
                onSelect(wall.id);
              }}
            >
              <span className="wall-mini" style={{ background: wall.color }} />
              <span>
                {wall.name}
                <small>
                  {wall.width.toFixed(1)} × {wall.height.toFixed(1)} m
                </small>
              </span>
              <span className="wall-number">
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
          ))}
        </div>
        <div className="scene-items">
          {scene.placements
            .filter(
              (p) =>
                scene.models.find((m) => m.id === p.modelId)?.kind === "volume",
            )
            .map((p) => {
              const m = scene.models.find((m) => m.id === p.modelId)!;
              return (
                <button
                  key={p.id}
                  data-testid={`scene-item-${p.id}`}
                  className={selected === p.id ? "active" : ""}
                  onClick={() => {
                    onModel(undefined);
                    onSelect(p.id);
                  }}
                >
                  <Box size={11} />
                  <i style={{ background: m.color }} />
                  {m.name}
                </button>
              );
            })}
        </div>
        <button className="add-wall" data-testid="wall-add" onClick={onAddWall}>
          <Plus size={15} />
          Ajouter un pan
        </button>
        <div className="section-label library-label">
          <span>
            <Box size={14} />
            BIBLIOTHÈQUE
          </span>
          <span className="shared-badge">Client</span>
        </div>
        <div className="segmented">
          <button
            className={kind === "hold" ? "active" : ""}
            onClick={() => setKind("hold")}
          >
            Prises
          </button>
          <button
            className={kind === "volume" ? "active" : ""}
            onClick={() => setKind("volume")}
          >
            Volumes
          </button>
        </div>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Rechercher un modèle"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un modèle…"
          />
        </label>
        <div className="model-grid">
          {models.map((model) => (
            <button
              key={model.id}
              data-testid={`catalog-${model.id}`}
              aria-pressed={activeModel?.id === model.id}
              className={`model-card ${activeModel?.id === model.id ? "active" : ""}`}
              onClick={() =>
                onModel(activeModel?.id === model.id ? undefined : model)
              }
            >
              <div className="model-preview">
                <ShapeThumbnail model={model} />
                {activeModel?.id === model.id && (
                  <span className="model-selected">
                    <Check size={11} />
                  </span>
                )}
              </div>
              <strong>{model.name}</strong>
              <span>
                {Math.round(model.dimensions[0] * 100)} ×{" "}
                {Math.round(model.dimensions[1] * 100)} cm
              </span>
            </button>
          ))}
        </div>
        {!models.length && <p className="empty-copy">Aucun modèle trouvé.</p>}
        <div className="library-help">
          <MousePointer2 size={17} />
          <p>
            Choisissez un modèle, puis cliquez sur le mur pour le poser.
            <span>Échap pour revenir à la sélection.</span>
          </p>
        </div>
      </div>
      <div className="library-footer">
        <span className="status-dot" />
        Modèles paramétriques · POC
      </div>
    </aside>
  );
}
