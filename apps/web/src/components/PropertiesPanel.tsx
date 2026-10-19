import { useState } from "react";
import {
  Box,
  Crosshair,
  Flag,
  Layers,
  Plus,
  Trash2,
  CircleHelp,
  Mountain,
} from "lucide-react";
import { Quaternion, Vector3 } from "three";
import { getWallAngles, quaternionFromWallAngles } from "@climbed/geometry";
import type {
  SceneDocument,
  Quat,
  Vec3,
  ModelDefinition,
} from "@climbed/contracts";
import type { Edit } from "../domain/editor";
import { removePlacement } from "../domain/editor";
import { NumberField } from "./Fields";
interface Props {
  scene: SceneDocument;
  selected: string | null;
  edit: (fn: Edit) => void;
  onSelect: (id: string | null) => void;
  activeBoulderId: string | null;
  setActiveBoulderId: (id: string | null) => void;
  focusBoulder: boolean;
  setFocusBoulder: (v: boolean) => void;
}
export function PropertiesPanel({
  scene,
  selected,
  edit,
  onSelect,
  activeBoulderId,
  setActiveBoulderId,
  focusBoulder,
  setFocusBoulder,
}: Props) {
  const wall = scene.walls.find((w) => w.id === selected);
  const placement = scene.placements.find((p) => p.id === selected);
  const model = scene.models.find((m) => m.id === placement?.modelId);
  const activeBoulder = scene.boulders.find((b) => b.id === activeBoulderId);
  function changeWall(patch: object) {
    edit((d) => {
      Object.assign(d.walls.find((w) => w.id === selected)!, patch);
    });
  }
  function changePlacement(patch: object) {
    edit((d) => {
      Object.assign(d.placements.find((p) => p.id === selected)!, patch);
    });
  }
  function changeModel(patch: Partial<ModelDefinition>) {
    if (!model || !placement) return;
    edit((d) => {
      const next = {
        ...structuredClone(model),
        ...patch,
        id: crypto.randomUUID(),
        name: model.name.includes("personnalisé")
          ? model.name
          : `${model.name} · personnalisé`,
      };
      d.models.push(next);
      d.placements.find((p) => p.id === placement.id)!.modelId = next.id;
    });
  }
  const angles = wall ? getWallAngles(wall.rotation) : undefined;
  const position = wall?.position ?? placement?.position;
  const rotationDeg = placement
    ? (2 * Math.atan2(placement.rotation[2], placement.rotation[3]) * 180) /
      Math.PI
    : 0;
  function boulderUpdate(patch: object) {
    edit((d) => {
      Object.assign(d.boulders.find((b) => b.id === activeBoulderId)!, patch);
    });
  }
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
                label="Hauteur"
                value={wall.height}
                min={0.1}
                max={30}
                unit="m"
                testId="wall-height"
                onChange={(height) => changeWall({ height })}
              />
            </div>
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
        <>
          <div className="property-section">
            <h4>Orientation & dimensions</h4>
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
            <div className="field-triple">
              {["Largeur", "Hauteur", "Relief"].map((label, i) => (
                <NumberField
                  key={`${model.id}-${i}`}
                  label={label}
                  value={model.dimensions[i]!}
                  unit="m"
                  step={0.01}
                  min={0.005}
                  max={30}
                  onChange={(v) => {
                    const dimensions = [...model.dimensions] as Vec3;
                    dimensions[i] = v;
                    changeModel({ dimensions });
                  }}
                />
              ))}
            </div>
            <label className="color-field">
              Couleur
              <input
                aria-label="Couleur de l’élément"
                type="color"
                value={model.color}
                onChange={(e) => changeModel({ color: e.target.value })}
              />
            </label>
            <p className="field-note">
              Dimensions et couleur créent un modèle personnalisé, sans stock
              physique associé.
            </p>
          </div>
          {model.kind === "hold" && activeBoulder && (
            <div className="property-section">
              <h4>Cette prise dans le bloc actif</h4>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={activeBoulder.placementIds.includes(placement.id)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    edit((d) => {
                      const b = d.boulders.find(
                        (b) => b.id === activeBoulder.id,
                      )!;
                      if (checked) b.placementIds.push(placement.id);
                      else {
                        b.placementIds = b.placementIds.filter(
                          (id) => id !== placement.id,
                        );
                        b.startIds = b.startIds.filter(
                          (id) => id !== placement.id,
                        );
                        b.finishIds = b.finishIds.filter(
                          (id) => id !== placement.id,
                        );
                      }
                    });
                  }}
                />
                Inclure dans {activeBoulder.name}
              </label>
              {activeBoulder.placementIds.includes(placement.id) && (
                <div className="preset-row">
                  {(["startIds", "finishIds"] as const).map((key) => (
                    <button
                      className={
                        activeBoulder[key].includes(placement.id)
                          ? "active"
                          : ""
                      }
                      key={key}
                      onClick={() =>
                        boulderUpdate({
                          [key]: activeBoulder[key].includes(placement.id)
                            ? activeBoulder[key].filter(
                                (id) => id !== placement.id,
                              )
                            : [...activeBoulder[key], placement.id],
                        })
                      }
                    >
                      {key === "startIds" ? (
                        <>
                          <Crosshair size={13} />
                          Départ
                        </>
                      ) : (
                        <>
                          <Flag size={13} />
                          Arrivée
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
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
      <div className="property-section boulder-section">
        <div className="section-title">
          <h4>
            <Mountain size={14} />
            Blocs
          </h4>
          <button
            className="icon-button small"
            title="Créer un bloc"
            aria-label="Créer un bloc"
            onClick={() => {
              const id = crypto.randomUUID();
              edit((d) =>
                d.boulders.push({
                  id,
                  name: `Bloc ${d.boulders.length + 1}`,
                  grade: "",
                  color: "#b4d77a",
                  placementIds: [],
                  startIds: [],
                  finishIds: [],
                }),
              );
              setActiveBoulderId(id);
            }}
          >
            <Plus size={15} />
          </button>
        </div>
        <select
          aria-label="Bloc actif"
          value={activeBoulderId ?? ""}
          onChange={(e) => setActiveBoulderId(e.target.value || null)}
        >
          <option value="">Aucun bloc actif</option>
          {scene.boulders.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.grade && `· ${b.grade}`}
            </option>
          ))}
        </select>
        {activeBoulder && (
          <>
            <label className="text-field">
              Nom du bloc
              <input
                key={activeBoulder.id}
                aria-label="Nom du bloc"
                defaultValue={activeBoulder.name}
                onBlur={(e) => {
                  if (e.target.value.trim())
                    boulderUpdate({ name: e.target.value });
                }}
              />
            </label>
            <div className="boulder-details">
              <label className="text-field">
                Cotation
                <input
                  key={`${activeBoulder.id}-grade`}
                  aria-label="Cotation"
                  defaultValue={activeBoulder.grade}
                  placeholder="6a"
                  onBlur={(e) => boulderUpdate({ grade: e.target.value })}
                />
              </label>
              <label className="color-field">
                Couleur
                <input
                  aria-label="Couleur du bloc"
                  type="color"
                  value={activeBoulder.color}
                  onChange={(e) => boulderUpdate({ color: e.target.value })}
                />
              </label>
            </div>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={focusBoulder}
                onChange={(e) => setFocusBoulder(e.target.checked)}
              />
              Isoler visuellement ce bloc
            </label>
            <span className="small-muted">
              {activeBoulder.placementIds.length} prises ·{" "}
              {activeBoulder.startIds.length} départs ·{" "}
              {activeBoulder.finishIds.length} arrivées
            </span>
          </>
        )}
      </div>
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
