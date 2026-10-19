import {
  Copy,
  Crosshair,
  Plus,
  Trash2,
  CircleHelp,
  BookOpen,
} from "lucide-react";
import { Quaternion, Vector3 } from "three";
import {
  getWallAngles,
  quaternionFromWallAngles,
  wallProjectedDimensions,
} from "@climbed/geometry";
import type { SceneDocument, Quat, Vec3 } from "@climbed/contracts";
import type { Edit } from "../domain/editor";
import { removePlacement } from "../domain/editor";
import { NumberField } from "./Fields";
import { RoutePanel } from "./RoutePanel";
interface Props {
  scene: SceneDocument;
  selected: string | null;
  edit: (fn: Edit) => void;
  onSelect: (id: string | null) => void;
  activeBoulderId: string | null;
  setActiveBoulderId: (id: string | null) => void;
  hiddenRouteIds: string[];
  setHiddenRouteIds: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onCatalog: () => void;
}
export function PropertiesPanel({
  scene,
  selected,
  edit,
  onSelect,
  activeBoulderId,
  setActiveBoulderId,
  hiddenRouteIds,
  setHiddenRouteIds,
  onDuplicate,
  onCatalog,
}: Props) {
  const wall = scene.walls.find((w) => w.id === selected);
  const placement = scene.placements.find((p) => p.id === selected);
  const model = scene.models.find((m) => m.id === placement?.modelId);
  function changeWall(patch: object) {
    edit((d) => Object.assign(d.walls.find((w) => w.id === selected)!, patch));
  }
  function changePlacement(patch: object) {
    edit((d) =>
      Object.assign(d.placements.find((p) => p.id === selected)!, patch),
    );
  }
  const angles = wall ? getWallAngles(wall.rotation) : undefined;
  const projection = wall ? wallProjectedDimensions(wall) : undefined;
  const roof = angles && Math.abs(Math.abs(angles.inclination) - 90) < 0.1;
  const tilted = angles && Math.abs(angles.inclination) > 0.1;
  const position = wall?.position ?? placement?.position;
  const rotationDeg = placement
    ? (2 * Math.atan2(placement.rotation[2], placement.rotation[3]) * 180) /
      Math.PI
    : 0;
  return (
    <div className="properties-content">
      <div className="inspector-title">
        <span className="eyebrow">
          {wall
            ? "STRUCTURE"
            : model
              ? model.kind === "volume"
                ? "VOLUME"
                : "PRISE"
              : "VOTRE SCÈNE"}
        </span>
        <h3>{wall?.name ?? model?.name ?? "Vue d’ensemble"}</h3>
        {(wall || model) && (
          <span className="small-muted">
            {wall ? "Support paramétrique" : "Placement · repère du support"}
          </span>
        )}
      </div>
      {!wall && !placement && (
        <div className="selection-empty">
          <Crosshair size={27} />
          <p>
            Sélectionnez un élément
            <br />
            pour ajuster ses propriétés.
          </p>
          <div className="scene-metrics">
            <span>
              <b>{scene.walls.length}</b>Pans
            </span>
            <span>
              <b>
                {
                  scene.placements.filter(
                    (p) =>
                      scene.models.find((m) => m.id === p.modelId)?.kind ===
                      "volume",
                  ).length
                }
              </b>
              Volumes
            </span>
            <span>
              <b>
                {
                  scene.placements.filter(
                    (p) =>
                      scene.models.find((m) => m.id === p.modelId)?.kind ===
                      "hold",
                  ).length
                }
              </b>
              Prises
            </span>
          </div>
        </div>
      )}
      {wall && (
        <>
          <div className="property-section">
            <h4>Géométrie du pan</h4>
            <label className="text-field">
              Nom
              <input
                key={wall.id}
                aria-label="Nom du pan"
                defaultValue={wall.name}
                onBlur={(e) => {
                  if (e.target.value.trim())
                    changeWall({ name: e.target.value });
                }}
              />
            </label>
            <div className="field-pair">
              <NumberField
                label="Largeur"
                value={wall.width}
                min={0.1}
                max={30}
                unit="m"
                testId="wall-width"
                onChange={(width) => changeWall({ width })}
              />
              <NumberField
                label={
                  roof
                    ? "Profondeur sur le toit"
                    : tilted
                      ? "Longueur sur le pan"
                      : "Hauteur"
                }
                value={wall.height}
                min={0.1}
                max={30}
                unit="m"
                testId="wall-height"
                onChange={(height) => changeWall({ height })}
              />
            </div>
            <p
              className="projected-dimensions"
              data-testid="wall-projected-height"
            >
              Hauteur verticale : {projection?.verticalHeight.toFixed(2)} m ·
              Profondeur : {projection?.horizontalDepth.toFixed(2)} m
            </p>
            <div className="preset-row">
              {[
                ["Vertical", 0],
                ["Dévers", 20],
                ["Toit", 90],
              ].map(([label, angle]) => (
                <button
                  key={label}
                  onClick={() =>
                    changeWall({
                      rotation: quaternionFromWallAngles(
                        Number(angle),
                        angles?.yaw ?? 0,
                      ),
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="field-pair">
              <NumberField
                label="Inclinaison"
                value={angles?.inclination ?? 0}
                unit="°"
                step={1}
                testId="wall-inclination"
                onChange={(v) =>
                  changeWall({
                    rotation: quaternionFromWallAngles(v, angles?.yaw ?? 0),
                  })
                }
              />
              <NumberField
                label="Orientation"
                value={angles?.yaw ?? 0}
                unit="°"
                step={1}
                testId="wall-yaw"
                onChange={(v) =>
                  changeWall({
                    rotation: quaternionFromWallAngles(
                      angles?.inclination ?? 0,
                      v,
                    ),
                  })
                }
              />
            </div>
            <label className="color-field">
              Couleur du pan
              <input
                aria-label="Couleur du pan"
                type="color"
                value={wall.color}
                onChange={(e) => changeWall({ color: e.target.value })}
              />
            </label>
          </div>
          <div className="property-section">
            <div className="section-title">
              <h4>Ouvertures traversantes</h4>
              <button
                className="icon-button small"
                title="Ajouter une ouverture"
                aria-label="Ajouter une ouverture"
                onClick={() =>
                  changeWall({
                    openings: [
                      ...wall.openings,
                      {
                        id: crypto.randomUUID(),
                        x: 0,
                        y: wall.height - 0.55,
                        width: Math.min(0.5, wall.width / 3),
                        height: 0.5,
                      },
                    ],
                  })
                }
              >
                <Plus size={15} />
              </button>
            </div>
            {!wall.openings.length && (
              <p className="small-muted">Aucune ouverture dans ce pan.</p>
            )}
            {wall.openings.map((o, i) => {
              const patch = (data: object) =>
                changeWall({
                  openings: wall.openings.map((item) =>
                    item.id === o.id ? { ...item, ...data } : item,
                  ),
                });
              return (
                <div className="opening-item" key={o.id}>
                  <div className="section-title">
                    <span>Ouverture {i + 1}</span>
                    <button
                      className="icon-button small"
                      aria-label={`Supprimer ouverture ${i + 1}`}
                      onClick={() =>
                        changeWall({
                          openings: wall.openings.filter(
                            (item) => item.id !== o.id,
                          ),
                        })
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="field-pair">
                    <NumberField
                      label="Centre X"
                      value={o.x}
                      unit="m"
                      onChange={(x) => patch({ x })}
                    />
                    <NumberField
                      label="Centre Y"
                      value={o.y}
                      unit="m"
                      onChange={(y) => patch({ y })}
                    />
                    <NumberField
                      label="Largeur ouverture"
                      value={o.width}
                      min={0.01}
                      unit="m"
                      onChange={(width) => patch({ width })}
                    />
                    <NumberField
                      label="Hauteur ouverture"
                      value={o.height}
                      min={0.01}
                      unit="m"
                      onChange={(height) => patch({ height })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {position && (
        <div className="property-section">
          <h4>Position {placement ? "sur le support" : "dans la scène"}</h4>
          <div className="field-triple">
            {(["X", "Y", "Z"] as const).map((axis, i) => (
              <NumberField
                key={`${selected}-${axis}`}
                label={axis}
                value={position[i]!}
                unit="m"
                testId={`selected-position-${axis.toLowerCase()}`}
                onChange={(value) => {
                  const next = [...position] as Vec3;
                  next[i] = value;
                  wall
                    ? changeWall({ position: next })
                    : changePlacement({ position: next });
                }}
              />
            ))}
          </div>
        </div>
      )}
      {placement && model && (
        <div className="property-section">
          <h4>Orientation du placement</h4>
          <NumberField
            label="Rotation"
            value={rotationDeg}
            unit="°"
            step={5}
            testId="selected-rotation"
            onChange={(v) => {
              const q = new Quaternion(...placement.rotation).multiply(
                new Quaternion().setFromAxisAngle(
                  new Vector3(0, 0, 1),
                  ((v - rotationDeg) * Math.PI) / 180,
                ),
              );
              changePlacement({ rotation: q.toArray() as Quat });
            }}
          />
          <div className="placement-model-details">
            <span>Dimensions du modèle</span>
            <strong>
              {model.dimensions
                .map((n) => `${Math.round(n * 1000)} mm`)
                .join(" × ")}
            </strong>
            <span className="placement-model-color">
              <i style={{ background: model.color }} />
              {model.color}
            </span>
          </div>
          <p className="field-note">
            Les dimensions et la couleur se définissent dans la bibliothèque,
            sans modifier les exemplaires déjà utilisés.
          </p>
          <button className="quiet-button" onClick={onCatalog}>
            <BookOpen size={13} />
            Ouvrir l’éditeur de modèles
          </button>
          <button
            className="secondary duplicate-placement"
            data-testid="placement-duplicate"
            onClick={() => onDuplicate(placement.id)}
          >
            <Copy size={13} />
            Dupliquer avec les pièces disponibles
          </button>
        </div>
      )}
      {(wall || placement) && (
        <div className="property-section">
          <button
            className="danger-button"
            disabled={!!wall && scene.walls.length <= 1}
            onClick={() => {
              edit((d) => {
                if (wall) {
                  d.placements
                    .filter((p) => p.parentId === wall.id)
                    .forEach((p) => removePlacement(d, p.id));
                  d.walls = d.walls.filter((w) => w.id !== wall.id);
                } else if (placement) removePlacement(d, placement.id);
              });
              onSelect(null);
            }}
          >
            <Trash2 size={14} />
            Supprimer {wall ? "le pan et ses éléments" : "l’élément"}
          </button>
        </div>
      )}
      <RoutePanel
        scene={scene}
        selected={selected}
        edit={edit}
        activeId={activeBoulderId}
        setActiveId={setActiveBoulderId}
        hiddenIds={hiddenRouteIds}
        setHiddenIds={setHiddenRouteIds}
      />
      <div className="theory-note">
        <CircleHelp size={15} />
        <p>
          Modèles génériques de conception.
          <br />
          Fixations fabricant non vérifiées.
        </p>
      </div>
    </div>
  );
}
