import { useState } from "react";
import type { SceneDocument } from "@climbed/contracts";
import {
  assignWallLevel,
  changeLevelElevation,
  getRoomLevels,
  getWallLevelId,
  materializeRoomLevels,
  validateRoomLayout,
  type RoomLevel,
  type RoomStair,
} from "@climbed/geometry";
import { NumberField } from "./Fields";
import "./layout.css";

export interface LevelsPanelProps {
  scene: SceneDocument;
  onChange: (scene: SceneDocument) => void;
  selectedWallId?: string;
}

function floorBounds(level: RoomLevel) {
  const xs = level.outline.map((p) => p[0]),
    zs = level.outline.map((p) => p[1]);
  const x = Math.min(...xs),
    z = Math.min(...zs);
  return { x, z, width: Math.max(...xs) - x, depth: Math.max(...zs) - z };
}

function NameInput({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (name: string) => void;
}) {
  return (
    <input
      key={value}
      type="text"
      defaultValue={value}
      aria-label={label}
      maxLength={100}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && v !== value) onChange(v);
        else e.target.value = value;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export function LevelsPanel({
  scene,
  onChange,
  selectedWallId,
}: LevelsPanelProps) {
  const levels = getRoomLevels(scene),
    stairs = scene.stairs ?? [],
    selectedWall = scene.walls.find((w) => w.id === selectedWallId);
  const [errors, setErrors] = useState<string[]>([]);
  function commit(next: SceneDocument) {
    const problems = validateRoomLayout(next);
    setErrors(problems);
    if (!problems.length) onChange(next);
  }
  function patchLevel(level: RoomLevel, update: Partial<RoomLevel>) {
    const current = materializeRoomLevels(scene);
    commit({
      ...current,
      levels: current.levels!.map((l) =>
        l.id === level.id ? { ...l, ...update } : l,
      ),
    });
  }
  function rectangle(
    level: RoomLevel,
    change: Partial<ReturnType<typeof floorBounds>>,
  ) {
    const b = { ...floorBounds(level), ...change };
    patchLevel(level, {
      outline: [
        [b.x, b.z],
        [b.x + b.width, b.z],
        [b.x + b.width, b.z + b.depth],
        [b.x, b.z + b.depth],
      ],
    });
  }
  function addLevel() {
    const current = materializeRoomLevels(scene),
      base = current.levels![current.levels!.length - 1]!;
    if (base.elevation + 3 > 100) {
      setErrors([
        "Le niveau proposé dépasserait l’altitude maximale de 100 m. Réduisez d’abord l’altitude du dernier niveau.",
      ]);
      return;
    }
    commit({
      ...current,
      levels: [
        ...current.levels!,
        {
          id: crypto.randomUUID(),
          name: `Niveau ${levels.length}`,
          elevation: base.elevation + 3,
          outline: base.outline.map((p) => [...p] as [number, number]),
        },
      ],
    });
  }
  function patchStair(stair: RoomStair, change: Partial<RoomStair>) {
    commit({
      ...materializeRoomLevels(scene),
      stairs: stairs.map((s) => (s.id === stair.id ? { ...s, ...change } : s)),
    });
  }
  function addStair() {
    const from = levels[0]!,
      to = levels.find((l) => Math.abs(l.elevation - from.elevation) >= 0.01);
    if (!to) {
      setErrors([
        "Ajoutez deux niveaux de hauteurs différentes pour créer un escalier.",
      ]);
      return;
    }
    const b = floorBounds(from),
      x = b.x + b.width / 2,
      z = b.z + b.depth / 2;
    commit({
      ...materializeRoomLevels(scene),
      stairs: [
        ...stairs,
        {
          id: crypto.randomUUID(),
          name: `Escalier ${stairs.length + 1}`,
          fromLevelId: from.id,
          toLevelId: to.id,
          start: [x, z],
          end: [x, z + 3],
          width: 1.2,
          steps: 12,
        },
      ],
    });
  }
  return (
    <section className="levels-panel" aria-label="Sols et niveaux">
      <h2>Sols et niveaux</h2>
      <p>
        Définissez les sols de la salle, leurs altitudes et les escaliers qui
        les relient. Les pans restent à leur place au-dessus du sol lorsque vous
        changez l’altitude de leur niveau.
      </p>
      {errors.length > 0 && (
        <div className="layout-error" role="alert">
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {selectedWall && (
        <label className="layout-wall-assignment">
          Niveau de « {selectedWall.name} »
          <select
            aria-label={`Niveau de ${selectedWall.name}`}
            value={getWallLevelId(scene, selectedWall)}
            onChange={(e) =>
              commit(assignWallLevel(scene, selectedWall.id, e.target.value))
            }
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} · {l.elevation} m
              </option>
            ))}
          </select>
        </label>
      )}
      {levels.map((level, index) => {
        const b = floorBounds(level),
          attached = scene.walls.filter(
            (w) => getWallLevelId(scene, w) === level.id,
          ),
          linked = stairs.some(
            (s) => s.fromLevelId === level.id || s.toLevelId === level.id,
          );
        return (
          <article
            className="level-card"
            key={level.id}
            data-level-id={level.id}
          >
            <div className="level-heading">
              <NameInput
                value={level.name}
                label={`Nom du niveau ${index}`}
                onChange={(name) => patchLevel(level, { name })}
              />
              <button
                className="layout-action layout-danger"
                type="button"
                disabled={levels.length === 1 || attached.length > 0 || linked}
                title={
                  attached.length
                    ? "Réaffectez les pans avant de supprimer ce niveau."
                    : linked
                      ? "Supprimez les escaliers reliés avant ce niveau."
                      : levels.length === 1
                        ? "La salle doit conserver au moins un sol."
                        : "Supprimer ce niveau"
                }
                onClick={() => {
                  const current = materializeRoomLevels(scene);
                  commit({
                    ...current,
                    levels: current.levels!.filter((l) => l.id !== level.id),
                  });
                }}
              >
                Supprimer
              </button>
            </div>
            <div className="level-fields">
              <NumberField
                label={`Altitude ${level.name}`}
                value={level.elevation}
                min={-100}
                max={100}
                unit="m"
                onChange={(n) =>
                  commit(changeLevelElevation(scene, level.id, n))
                }
              />
              <NumberField
                label={`Origine X ${level.name}`}
                value={b.x}
                unit="m"
                onChange={(x) => rectangle(level, { x })}
              />
              <NumberField
                label={`Origine Z ${level.name}`}
                value={b.z}
                unit="m"
                onChange={(z) => rectangle(level, { z })}
              />
              <NumberField
                label={`Largeur du sol ${level.name}`}
                value={b.width}
                min={0.2}
                max={1000}
                unit="m"
                onChange={(width) => rectangle(level, { width })}
              />
              <NumberField
                label={`Profondeur du sol ${level.name}`}
                value={b.depth}
                min={0.2}
                max={1000}
                unit="m"
                onChange={(depth) => rectangle(level, { depth })}
              />
            </div>
            <p className="layout-note">
              {attached.length} pan{attached.length > 1 ? "s" : ""} sur ce
              niveau. Sol rectangulaire fini ; ses dimensions sont indépendantes
              de celles des pans.
            </p>
            {attached.length > 0 && (
              <div className="level-fields">
                {attached.map((w) => (
                  <label className="layout-label" key={w.id}>
                    {w.name}
                    <select
                      aria-label={`Niveau du pan ${w.name}`}
                      value={level.id}
                      onChange={(e) =>
                        commit(assignWallLevel(scene, w.id, e.target.value))
                      }
                    >
                      {levels.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </article>
        );
      })}
      <div className="layout-actions">
        <button
          className="layout-action"
          type="button"
          onClick={addLevel}
          disabled={levels.length >= 20}
        >
          Ajouter un niveau
        </button>
      </div>
      <h3 className="layout-section-title">Escaliers</h3>
      <p className="layout-note">
        L’escalier est une représentation d’aménagement. Sa géométrie ne
        constitue pas une validation de sécurité ni un plan de construction.
      </p>
      {!stairs.length && (
        <p className="layout-empty">Aucun escalier dans la salle.</p>
      )}
      {stairs.map((stair, index) => (
        <article className="level-card layout-stair" key={stair.id}>
          <div className="level-heading">
            <NameInput
              value={stair.name}
              label={`Nom de l’escalier ${index + 1}`}
              onChange={(name) => patchStair(stair, { name })}
            />
            <button
              type="button"
              className="layout-action layout-danger"
              aria-label={`Supprimer ${stair.name}`}
              onClick={() =>
                commit({
                  ...materializeRoomLevels(scene),
                  stairs: stairs.filter((s) => s.id !== stair.id),
                })
              }
            >
              Supprimer
            </button>
          </div>
          <div className="level-fields">
            <label className="layout-label">
              Départ
              <select
                aria-label={`Niveau de départ ${stair.name}`}
                value={stair.fromLevelId}
                onChange={(e) =>
                  patchStair(stair, { fromLevelId: e.target.value })
                }
              >
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="layout-label">
              Arrivée
              <select
                aria-label={`Niveau d’arrivée ${stair.name}`}
                value={stair.toLevelId}
                onChange={(e) =>
                  patchStair(stair, { toLevelId: e.target.value })
                }
              >
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label={`Largeur ${stair.name}`}
              value={stair.width}
              min={0.2}
              max={20}
              unit="m"
              onChange={(width) => patchStair(stair, { width })}
            />
            <NumberField
              label={`Départ X ${stair.name}`}
              value={stair.start[0]}
              unit="m"
              onChange={(x) =>
                patchStair(stair, { start: [x, stair.start[1]] })
              }
            />
            <NumberField
              label={`Départ Z ${stair.name}`}
              value={stair.start[1]}
              unit="m"
              onChange={(z) =>
                patchStair(stair, { start: [stair.start[0], z] })
              }
            />
            <NumberField
              label={`Arrivée X ${stair.name}`}
              value={stair.end[0]}
              unit="m"
              onChange={(x) => patchStair(stair, { end: [x, stair.end[1]] })}
            />
            <NumberField
              label={`Arrivée Z ${stair.name}`}
              value={stair.end[1]}
              unit="m"
              onChange={(z) => patchStair(stair, { end: [stair.end[0], z] })}
            />
            <NumberField
              label={`Marches ${stair.name}`}
              value={stair.steps ?? 12}
              min={2}
              max={200}
              step={1}
              onChange={(steps) => {
                if (Number.isInteger(steps)) patchStair(stair, { steps });
              }}
            />
          </div>
        </article>
      ))}
      <div className="layout-actions">
        <button
          className="layout-action"
          type="button"
          onClick={addStair}
          disabled={stairs.length >= 50}
        >
          Ajouter un escalier
        </button>
      </div>
    </section>
  );
}
