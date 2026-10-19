import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { createWallChain } from "@climbed/geometry";
import type { SceneDocument, Vec3, WallDefinition } from "@climbed/contracts";
import { NumberField } from "./Fields";
interface Props {
  scene: SceneDocument;
  onClose: () => void;
  onApply: (walls: WallDefinition[]) => boolean;
}
export function MultiWallBuilder({ scene, onClose, onApply }: Props) {
  const last = scene.walls.at(-1)!;
  const [width, setWidth] = useState(3);
  const [name, setName] = useState("Mur composé");
  const [yaw, setYaw] = useState(0);
  const [origin, setOrigin] = useState<Vec3>([
    last.position[0] + last.width / 2 + 1.5,
    0,
    0,
  ]);
  const [segments, setSegments] = useState([
    { length: 1, inclination: 0 },
    { length: 1, inclination: 30 },
    { length: 1, inclination: 0 },
  ]);
  const [error, setError] = useState("");
  const profile = useMemo(() => {
    let y = 0,
      z = 0;
    const points: [[number, number], ...[number, number][]] = [[z, y]];
    for (const s of segments) {
      y += s.length * Math.cos((s.inclination * Math.PI) / 180);
      z += s.length * Math.sin((s.inclination * Math.PI) / 180);
      points.push([z, y]);
    }
    const minZ = Math.min(...points.map((p) => p[0])),
      maxZ = Math.max(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1])),
      maxY = Math.max(...points.map((p) => p[1]));
    const scale = Math.min(
      180 / Math.max(maxZ - minZ, 0.5),
      180 / Math.max(maxY - minY, 0.5),
    );
    return points
      .map(([x, y]) => `${25 + (x - minZ) * scale},${210 - (y - minY) * scale}`)
      .join(" ");
  }, [segments]);
  return (
    <div className="modal-backdrop">
      <section
        className="modal chain-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chain-title"
      >
        <button
          className="modal-close icon-button"
          aria-label="Fermer le mur composé"
          onClick={onClose}
        >
          <X size={17} />
        </button>
        <span className="eyebrow">ASSEMBLAGE CONTINU</span>
        <h2 id="chain-title">Un mur, plusieurs inclinaisons.</h2>
        <p>
          Les segments se raccordent de bas en haut. Chaque angle est absolu :
          0° vertical, 90° toit.
        </p>
        <div className="chain-layout">
          <div>
            <label className="text-field">
              Nom de l’ensemble
              <input
                aria-label="Nom de l’ensemble"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="field-pair">
              <NumberField
                label="Largeur commune"
                value={width}
                min={0.1}
                max={30}
                unit="m"
                onChange={setWidth}
              />
              <NumberField
                label="Orientation"
                value={yaw}
                step={1}
                unit="°"
                onChange={setYaw}
              />
            </div>
            <div className="field-triple">
              {["X", "Y", "Z"].map((axis, i) => (
                <NumberField
                  key={axis}
                  label={`Origine ${axis}`}
                  value={origin[i]!}
                  unit="m"
                  onChange={(n) => {
                    const next = [...origin] as Vec3;
                    next[i] = n;
                    setOrigin(next);
                  }}
                />
              ))}
            </div>
            {segments.map((segment, i) => (
              <div className="chain-segment" key={i}>
                <span>{i + 1}</span>
                <NumberField
                  label="Longueur sur le pan"
                  testId={`chain-length-${i}`}
                  value={segment.length}
                  min={0.1}
                  max={30}
                  unit="m"
                  onChange={(length) =>
                    setSegments(
                      segments.map((s, index) =>
                        index === i ? { ...s, length } : s,
                      ),
                    )
                  }
                />
                <NumberField
                  label="Angle absolu"
                  testId={`chain-angle-${i}`}
                  value={segment.inclination}
                  min={-60}
                  max={120}
                  step={1}
                  unit="°"
                  onChange={(inclination) =>
                    setSegments(
                      segments.map((s, index) =>
                        index === i ? { ...s, inclination } : s,
                      ),
                    )
                  }
                />
                <button
                  className="icon-button small"
                  aria-label={`Retirer segment ${i + 1}`}
                  disabled={segments.length <= 1}
                  onClick={() =>
                    setSegments(segments.filter((_, index) => index !== i))
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              className="add-wall"
              data-testid="chain-add-segment"
              disabled={segments.length >= 20}
              onClick={() =>
                setSegments([...segments, { length: 1, inclination: 0 }])
              }
            >
              <Plus size={14} />
              Ajouter un segment
            </button>
          </div>
          <aside className="chain-preview">
            <svg viewBox="0 0 250 240" aria-label="Profil des segments">
              <path d="M15 211H235" stroke="#ccd7bf" strokeDasharray="3 4" />
              <polyline
                points={profile}
                fill="none"
                stroke="#75985a"
                strokeWidth="7"
                strokeLinejoin="round"
              />
              {profile.split(" ").map((point, i) => {
                const [cx, cy] = point.split(",");
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="#f1f7e9"
                    stroke="#50773a"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
            <span>Profil de côté · angles absolus</span>
            <p>Les prises et volumes se placent ensuite sur chaque segment.</p>
          </aside>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <div className="chain-actions">
          <button className="secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className="primary"
            data-testid="chain-apply"
            onClick={() => {
              try {
                if (!name.trim()) throw new Error("Nommez cet ensemble.");
                const accepted = onApply(
                  createWallChain({
                    origin,
                    width,
                    thickness: 0.18,
                    yaw,
                    segments,
                    color: "#b8c4ad",
                    fixingSpacing: 0.25,
                    name: name.trim(),
                    idPrefix: crypto.randomUUID(),
                    angleMode: "absolute",
                  }),
                );
                if (accepted) onClose();
                else
                  setError(
                    "Les segments ne peuvent pas être ajoutés. Vérifiez les contraintes indiquées.",
                  );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Créer les {segments.length} segments
          </button>
        </div>
      </section>
    </div>
  );
}
