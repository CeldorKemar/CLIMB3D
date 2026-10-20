import type { Vec3 } from "@climbed/contracts";

export function MoveControls({ name, step, onStep, onMove }: {
  name: string; step: number; onStep: (step: number) => void; onMove: (delta: Vec3) => void;
}) {
  return <section className="structure-move" aria-label={`Déplacer ${name}`} data-testid="structure-move">
    <strong>{name}</strong>
    <label>Pas <select aria-label="Pas de déplacement" value={step} onChange={e => onStep(Number(e.target.value))}>
      {[.01, .1, .5, 1].map(n => <option key={n} value={n}>{n} m</option>)}
    </select></label>
    <div className="structure-move-axes">
      {([['X−', [-step, 0, 0]], ['X+', [step, 0, 0]], ['Y−', [0, -step, 0]], ['Y+', [0, step, 0]], ['Z−', [0, 0, -step]], ['Z+', [0, 0, step]]] as [string, Vec3][]).map(([label, delta]) =>
        <button key={label} type="button" aria-label={`Déplacer ${label}`} onClick={() => onMove(delta)}>{label}</button>)}
    </div>
    <small>Flèches : X / Y · Alt + ↑ / ↓ : Z<br />Maj : pas × 10 · Y : hauteur</small>
  </section>;
}
