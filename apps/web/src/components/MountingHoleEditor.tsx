import type { ModelDefinition, MountingHole } from '@climbed/contracts';
import { getMountingHoles, getMountingMethod } from '@climbed/geometry';
import { NumberField } from './Fields';

export function MountingHoleEditor({model, onChange}: {model: ModelDefinition; onChange:(model:ModelDefinition)=>void}) {
  const holes = getMountingHoles(model), method = getMountingMethod(model);
  const mounting = model.mounting ?? {method, holes};
  const allowed = !!mounting.modificationAuthorization;
  const candidates = Array.from({length: 49}, (_, i) => [((i % 7) - 3) * model.dimensions[0] / 10, (Math.floor(i / 7) - 3) * model.dimensions[1] / 10, 0] as const);
  const nextPosition = candidates.find(p => holes.every(h => Math.hypot(p[0]-h.position[0], p[1]-h.position[1]) > (h.diameter+.005)/2)) ?? [0,0,0];
  const patch = (hole: MountingHole, update: Partial<MountingHole>) => onChange({...model, mounting:{...mounting, holes:holes.map(h=>h.id===hole.id?{...h,...update}:h)}});
  return <section className="mounting-hole-editor" aria-label="Trous de la pièce">
    <h3>Trous de la pièce</h3>
    <p>Les trous restent ceux du produit tant qu’aucune autorisation de modification n’est renseignée.</p>
    <label className="text-field">Référence autorisant la modification
      <input aria-label="Référence autorisant la modification" maxLength={300}
        key={model.id} defaultValue={mounting.modificationAuthorization?.reference ?? ''}
        placeholder="Notice, référence ou lien du produit"
        onBlur={e=>{const reference=e.target.value.trim();if(reference.length>=5 || !reference)onChange({...model,mounting:{...mounting,modificationAuthorization:reference?{reference}:undefined}});}}
        onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} />
    </label>
    <p className="small-muted">Cette référence est déclarée par vous. Le logiciel vérifie la géométrie, pas l’autorisation du fabricant ni la résistance mécanique.</p>
    <fieldset disabled={!allowed}>
      {holes.map((hole, i)=><div key={hole.id} className="mounting-hole-row">
        <strong>Trou {i+1}</strong>
        <div className="field-pair">
          <NumberField label={`Trou ${i+1} X`} value={hole.position[0]} unit="m" step={.001} onChange={x=>patch(hole,{position:[x,hole.position[1],0]})}/>
          <NumberField label={`Trou ${i+1} Y`} value={hole.position[1]} unit="m" step={.001} onChange={y=>patch(hole,{position:[hole.position[0],y,0]})}/>
          <NumberField label={`Trou ${i+1} diamètre`} value={hole.diameter*1000} min={1} max={100} unit="mm" step={.1} onChange={diameter=>patch(hole,{diameter:diameter/1000})}/>
        </div>
        <label className="text-field">Rôle du trou {i+1}
          <select aria-label={`Rôle du trou ${i+1}`} value={hole.role} onChange={e=>patch(hole,{role:e.target.value as MountingHole['role']})}>
            <option value="primary">Fixation principale</option><option value="auxiliary">Vis complémentaire / antirotation</option>
          </select>
        </label>
        <button type="button" className="danger-button" disabled={holes.length<=1} aria-label={`Supprimer le trou ${i+1}`} onClick={()=>onChange({...model,mounting:{...mounting,holes:holes.filter(h=>h.id!==hole.id)}})}>Supprimer ce trou</button>
      </div>)}
      <button type="button" className="secondary" data-testid="mounting-hole-add" disabled={holes.length>=30} onClick={()=>onChange({...model,mounting:{...mounting,holes:[...holes,{id:crypto.randomUUID(),position:[...nextPosition],diameter:.005,role:method==='bolt'?'auxiliary':'primary'}]}})}>Ajouter un trou de fixation</button>
    </fieldset>
  </section>;
}
