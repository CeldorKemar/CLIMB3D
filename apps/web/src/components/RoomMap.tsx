import { useEffect, useMemo, useRef, useState } from "react";
import type { SceneDocument } from "@climbed/contracts";
import {
  getRoomLevels,
  getWallLevelId,
  projectWallBase,
  getPlanWalls,
} from "@climbed/geometry";
import { ChevronDown, ChevronUp, Expand, Map, Minimize2 } from "lucide-react";
import "./layout.css";

export interface RoomMapProps {
  scene: SceneDocument;
  onFocusWall: (wallId: string) => void;
  selectedWallId?: string;
}

/** X right, Z down: the map preserves world positions and a single common scale. */
export function RoomMap({ scene, onFocusWall, selectedWallId }: RoomMapProps) {
  const [open, setOpen] = useState(true),
    [full, setFull] = useState(false),
    [levelId, setLevelId] = useState("all");
  const mapRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!full) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const root = mapRef.current;
    root
      ?.querySelector<HTMLButtonElement>('button[aria-label="Réduire le plan"]')
      ?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setFull(false);
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const targets = [
        ...root.querySelectorAll<HTMLElement>('button, select, [tabindex="0"]'),
      ];
      const first = targets[0],
        last = targets[targets.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === root)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [full]);
  const levels = getRoomLevels(scene);
  const activeLevelId = levels.some((l) => l.id === levelId) ? levelId : "all";
  const walls = getPlanWalls(scene).filter(
    (w) =>
      activeLevelId === "all" || getWallLevelId(scene, w) === activeLevelId,
  );
  const bounds = useMemo(() => {
    const projected = walls.flatMap(projectWallBase);
    const points: [number, number][] = projected.length ? projected : [[-.5, -.5], [.5, .5]];
    const xs = points.map((p) => p[0]),
      zs = points.map((p) => p[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minZ = Math.min(...zs),
      maxZ = Math.max(...zs);
    const pad = Math.max(maxX - minX, maxZ - minZ) * 0.08;
    return {
      x: minX - pad,
      z: minZ - pad,
      w: maxX - minX + pad * 2,
      h: maxZ - minZ + pad * 2,
    };
  }, [scene, levelId]);
  const unit = Math.max(bounds.w, bounds.h) / 100;
  const chooseWall = (id: string) => {
    onFocusWall(id);
    setFull(false);
  };
  return (
    <aside
      ref={mapRef}
      tabIndex={-1}
      role={full ? "dialog" : undefined}
      aria-modal={full ? true : undefined}
      className={`room-map ${full ? "room-map-full" : ""} ${!open ? "room-map-collapsed" : ""}`}
      aria-label="Plan de la salle"
      onKeyDown={(event) => {
        if (full) event.stopPropagation();
      }}
    >
      <div className="room-map-toolbar">
        <button
          type="button"
          className="room-map-toggle"
          onClick={() => {
            setOpen(!open);
            setFull(false);
          }}
          aria-expanded={open}
          title={open ? "Masquer la minimap" : "Afficher la minimap"}
        >
          <Map size={15} />
          <span>Plan de la salle</span>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {open && (
          <button
            type="button"
            onClick={() => setFull(!full)}
            aria-label={full ? "Réduire le plan" : "Agrandir le plan"}
          >
            {full ? <Minimize2 size={15} /> : <Expand size={15} />}
          </button>
        )}
      </div>
      {open && (
        <>
          <div className="room-map-controls">
            <select
              aria-label="Niveau du plan"
              value={activeLevelId}
              onChange={(e) => setLevelId(e.target.value)}
            >
              <option value="all">Tous les niveaux</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.elevation} m
                </option>
              ))}
            </select>
            <span>Vue du dessus · X/Z</span>
          </div>
          <svg
            className="room-map-svg"
            viewBox={`${bounds.x} ${bounds.z} ${bounds.w} ${bounds.h}`}
            role="group"
            aria-label="Vue du dessus des pans de la salle"
            preserveAspectRatio="xMidYMid meet"
          >
            {walls.map((w) => {
              const p = projectWallBase(w),
                selected = w.id === selectedWallId;
              return (
                <g
                  key={w.id}
                  data-wall-id={w.id}
                  className="room-map-wall"
                  role="button"
                  tabIndex={0}
                  aria-label={`Ouvrir ${w.name} en 3D`}
                  onClick={() => chooseWall(w.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      chooseWall(w.id);
                    }
                  }}
                >
                  <title>{w.name} · cliquer pour ouvrir ce pan</title>
                  <polygon
                    points={p.map((v) => v.join(",")).join(" ")}
                    fill={selected ? "#5a927877" : `${w.color}66`}
                    stroke={selected ? "#1d6b50" : "#485d53"}
                    strokeWidth={unit * (selected ? 1.1 : 0.65)}
                    strokeLinejoin="round"
                  />
                  <line
                    x1={p[0]![0]}
                    y1={p[0]![1]}
                    x2={p[1]![0]}
                    y2={p[1]![1]}
                    stroke="transparent"
                    strokeWidth={unit * 5}
                  />
                </g>
              );
            })}
          </svg>
          {!walls.length && <p className="room-map-hint">Aucun pied de mur à afficher à ce niveau.</p>}
          <p className="room-map-hint">
            Pieds de murs uniquement · cliquer pour cadrer. Toits masqués.
          </p>
        </>
      )}
    </aside>
  );
}
