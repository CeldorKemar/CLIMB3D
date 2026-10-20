import type {ModelDefinition,SceneDocument} from '@climbed/contracts';
import {canPrepareSupport,getMountingHoles,getMountingMethod,getPlacementModel,getSupportFixings,requiredPilotHoles} from '@climbed/geometry';
import type {Edit} from '../domain/editor';

export interface PreparationTarget {parentType:'wall'|'volume';parentId:string}
interface Props {
  scene:SceneDocument;
  model:ModelDefinition;
  target:PreparationTarget;
  onTarget:(target:PreparationTarget)=>void;
  prepare:boolean;
  onPrepare:(value:boolean)=>void;
  diameter:string;
  onDiameter:(value:string)=>void;
  edit:(fn:Edit)=>void;
}
export function PlacementControls({scene,model,target,onTarget,prepare,onPrepare,diameter,onDiameter,edit}:Props) {
  const volume=target.parentType==='volume'?scene.placements.find(p=>p.id===target.parentId):undefined;
  const support=target.parentType==='wall'?scene.walls.find(w=>w.id===target.parentId):volume&&getPlacementModel(scene,volume);
  const fixings=support&&getSupportFixings(support),pilots=fixings?.holes.filter(h=>h.kind==='pilot').length??0;
  const pilotCount=requiredPilotHoles(model).length,method=getMountingMethod(model);
  const permitted=canPrepareSupport(scene,target.parentType,target.parentId);
  return <div className="properties-content placement-controls" data-testid="placement-controls">
    <div className="inspector-title"><span className="eyebrow">RÉGLAGES DE POSE</span><h3>{model.name}</h3></div>
    <p>{getMountingHoles(model).length} fixations obligatoires. {method==='bolt'?'Les boulons utilisent les inserts existants.':model.mounting?.screwPlacement==='direct'?'Le profil déclare le vissage direct sur un support autorisé.':'Les vis utilisent des trous pilotes, distincts des inserts filetés.'}</p>
    {pilotCount>0&&<>
      <label className="placement-check"><input type="checkbox" aria-label="Préparer les trous pilotes puis placer" checked={prepare} onChange={e=>onPrepare(e.target.checked)}/>Préparer le support puis poser</label>
      <label className="text-field">Support à préparer
        <select aria-label="Support de préparation" value={`${target.parentType}:${target.parentId}`} onChange={e=>{const index=e.target.value.indexOf(':');onTarget({parentType:e.target.value.slice(0,index) as PreparationTarget['parentType'],parentId:e.target.value.slice(index+1)});}}>
          {scene.walls.map(w=><option key={w.id} value={`wall:${w.id}`}>{w.name}</option>)}
          {model.kind==='hold'&&scene.placements.filter(p=>scene.models.some(m=>m.id===p.modelId&&m.kind==='volume')).map(p=><option key={p.id} value={`volume:${p.id}`}>{scene.models.find(m=>m.id===p.modelId)!.name} · exemplaire</option>)}
        </select>
      </label>
      <p className="small-muted">{pilots} trous pilotes sur ce support. Le support survolé dans la scène devient le support à préparer.</p>
      {!prepare&&pilots===0&&<p className="placement-help" role="status">Aucun trou pilote : déplacer la pièce ne permettra pas de la fixer. Activez « Préparer le support puis poser », ou renseignez les trous existants du support.</p>}
      {prepare&&<>
        <label className="placement-check"><input type="checkbox" aria-label="Autoriser le préperçage du support visé" checked={permitted} disabled={!fixings?.allowScrews||fixings.allowDrilling!==undefined} onChange={e=>edit(d=>{
          const owner=target.parentType==='wall'?d.walls.find(w=>w.id===target.parentId):d.placements.find(p=>p.id===target.parentId);
          if(owner)owner.allowPilotDrilling=e.target.checked;
        })}/>Le produit et le matériau autorisent le préperçage</label>
        {fixings?.allowDrilling===false||!fixings?.allowScrews?<p className="placement-help">Le profil de ce support interdit cette préparation.</p>:<p className="small-muted">Autorisation déclarée pour {support?.name}. Elle ne vaut pas validation du fabricant.</p>}
        <label className="text-field">Diamètre pilote (mm)
          <input type="number" min={1} max={50} step={.1} aria-label="Diamètre pilote à préparer" value={diameter} onChange={e=>onDiameter(e.target.value)} placeholder="À renseigner"/>
        </label>
        <p className="small-muted">À renseigner selon le produit et le support. Le trou de passage de la pièce peut avoir un autre diamètre.</p>
        <p className="placement-help">Survolez une zone libre : l’aperçu devient vert si tous les trous peuvent être préparés. Le clic prépare les trous et pose la pièce en une action annulable.</p>
      </>}
    </>}
    <p className="small-muted">Profils du POC non certifiés. Une pose acceptée géométriquement ne valide pas la résistance mécanique.</p>
  </div>;
}
