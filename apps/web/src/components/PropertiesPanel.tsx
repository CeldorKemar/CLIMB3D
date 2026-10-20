import { Copy, Crosshair, Plus, Trash2, CircleHelp } from "lucide-react";
import { Quaternion, Vector3 } from "three";
import { removeSelection } from "@climbed/editor-core";
import {
  getWallAngles,
  quaternionFromWallAngles,
  wallProjectedDimensions,
  getMountingHoles,
  getMountingMethod,
  validatePlacementMounting,
  getSupportFixings,
  prepareSupportForPlacement,
  requiredPilotHoles,
} from "@climbed/geometry";
import type { SceneDocument, Quat, Vec3 } from "@climbed/contracts";
import type { Edit } from "../domain/editor";
import { removePlacement } from "../domain/editor";
import { NumberField } from "./Fields";
import { RoutePanel } from "./RoutePanel";
import {WallFixingsEditor} from './WallFixingsEditor';
interface Props {
  scene: SceneDocument;
  selected: string | null;
  selectedIds?: string[];
  onDeleteSelection?: () => void;
  edit: (fn: Edit) => void;
  onSelect: (id: string | null) => void;
  activeBoulderId: string | null;
  setActiveBoulderId: (id: string | null) => void;
  hiddenRouteIds: string[];
  setHiddenRouteIds: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  pilotDiameterMm: string;
  setPilotDiameterMm: (value: string) => void;
}
export function PropertiesPanel({
  scene,
  selected,
  selectedIds = [],
  onDeleteSelection,
  edit,
  onSelect,
  activeBoulderId,
  setActiveBoulderId,
  hiddenRouteIds,
  setHiddenRouteIds,
  onDuplicate,
  pilotDiameterMm,
  setPilotDiameterMm,
}: Props) {
  const wall = scene.walls.find((w) => w.id === selected);
  const placement = scene.placements.find((p) => p.id === selected);
  const model = scene.models.find((m) => m.id === placement?.modelId);
  const receivingSupport = wall ?? (model?.kind === 'volume' ? model : undefined);
  const receivingOwner = wall ?? (model?.kind === 'volume' ? placement : undefined);
  const receivingFixings = receivingSupport ? getSupportFixings(receivingSupport) : undefined;
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
  if (selectedIds.length > 1) {
    const placements = scene.placements.filter((item) =>
      selectedIds.includes(item.id),
    );
    return (
      <div className="properties-content" data-testid="multi-selection-panel">
        <div className="inspector-title">
          <span className="eyebrow">SÉLECTION MULTIPLE</span>
          <h3>{selectedIds.length} éléments sélectionnés</h3>
        </div>
        <div className="property-section">
          <p className="small-muted">
            Ctrl + clic pour ajouter ou retirer une pièce de la sélection. Suppr
            ou Retour arrière pour supprimer la sélection en une seule action.
          </p>
          <p className="small-muted">
            Les prises fixées sur un volume supprimé sont également retirées.
            Annuler restaure toute la sélection.
          </p>
          <ul>
            {placements.map((item) => (
              <li key={item.id}>
                {scene.models.find((model) => model.id === item.modelId)
                  ?.name ?? item.id}
              </li>
            ))}
          </ul>
          <button
            className="danger-button"
            data-testid="delete-selection"
            onClick={() => {
              if (onDeleteSelection) onDeleteSelection();
              else {
                edit((draft) =>
                  Object.assign(draft, removeSelection(draft, selectedIds)),
                );
                onSelect(null);
              }
            }}
          >
            <Trash2 size={14} />
            Supprimer les {selectedIds.length} éléments
          </button>
        </div>
      </div>
    );
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
          <WallFixingsEditor wall={wall} onChange={changeWall}/>
          <div className="property-section">
            <h4>Préperçage pour les vis</h4>
            <label><input type="checkbox" aria-label="Activer la trame de trous pilotes" checked={!!wall.pilotGrid}
              onChange={event => changeWall({ pilotGrid: event.target.checked ? { pitchX: .25, pitchY: .25, offsetX: .125, offsetY: .125 } : undefined })} /> Trame de trous pilotes (orange)</label>
            <p className="small-muted">Distincts des inserts filetés. À renseigner selon le pan réel. La préparation de nouveaux trous nécessite une action explicite.</p>
            {wall.pilotGrid && <div className="field-pair">
              {(['pitchX', 'pitchY', 'offsetX', 'offsetY'] as const).map(key => <NumberField key={key}
                label={{ pitchX: 'Pas pilote X', pitchY: 'Pas pilote Y', offsetX: 'Décalage pilote X', offsetY: 'Décalage pilote Y' }[key]}
                value={wall.pilotGrid![key] ?? 0} min={key.startsWith('pitch') ? .01 : undefined} unit="m"
                onChange={n => changeWall({ pilotGrid: { ...wall.pilotGrid, [key]: n } })} />)}
            </div>}
          </div>
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
      {receivingOwner && receivingFixings && <div className="property-section">
        <h4>Préparer ce support</h4>
        <label><input type="checkbox" aria-label="Autoriser le préperçage de ce support"
          disabled={!receivingFixings.allowScrews || receivingFixings.allowDrilling === false || receivingFixings.allowDrilling === true}
          checked={receivingFixings.allowDrilling === true || !!receivingOwner.allowPilotDrilling}
          onChange={e => wall ? changeWall({allowPilotDrilling:e.target.checked}) : changePlacement({allowPilotDrilling:e.target.checked})}/>
          Autoriser le préperçage de ce support</label>
        <p className="small-muted">{receivingFixings.allowDrilling === false ? 'Le profil produit interdit le préperçage.' : receivingFixings.allowDrilling === true ? 'Le profil produit déclare le préperçage autorisé.' : 'À activer uniquement si le matériau et les instructions du produit le permettent.'} Les trous sont planifiés sur ce support uniquement.</p>
        <p className="small-muted">{receivingOwner.preparedPilotHoles?.length ?? 0} trous pilotes préparés.</p>
      </div>}
      {model && <div className="property-section"><p className="small-muted">{getMountingHoles(model).length} fixations requises · {getMountingMethod(model) === 'bolt' ? 'sur inserts compatibles' : model.mounting?.screwPlacement === 'direct' ? 'vissage direct autorisé' : 'sur trous pilotes compatibles'}. Aucun montage partiel n’est accepté.</p>
        {placement && validatePlacementMounting(scene, placement).length > 0 && <p className="error-banner" role="status">Placement hérité à corriger : {validatePlacementMounting(scene, placement).join(' · ')}</p>}
        {placement && requiredPilotHoles(model).length > 0 && <>
          <label className="text-field">Diamètre pilote à préparer (mm)
            <input type="number" aria-label="Diamètre pilote du support sélectionné" min={1} max={50} step={.1} value={pilotDiameterMm} onChange={e=>setPilotDiameterMm(e.target.value)}/>
          </label>
          <button className="secondary" onClick={()=>edit(d=>Object.assign(d,prepareSupportForPlacement(d,d.placements.find(p=>p.id===placement.id)!,{pilotDiameter:Number(pilotDiameterMm)/1000}).scene))}>Préparer les trous pilotes du support</button>
        </>}
      </div>}
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
