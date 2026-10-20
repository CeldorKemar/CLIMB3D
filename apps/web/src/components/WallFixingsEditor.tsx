import type {FixingMetadata,WallDefinition} from '@climbed/contracts';
import {NumberField} from './Fields';

export function WallFixingsEditor({wall,onChange}:{wall:WallDefinition;onChange:(patch:Partial<WallDefinition>)=>void}) {
  const grid=wall.fixingGrid??{pitchX:wall.fixingSpacing,pitchY:wall.fixingSpacing};
  const metadata=(patch:Partial<FixingMetadata>)=>onChange({fixing:{...wall.fixing,...patch,provenance:{...wall.fixing?.provenance,...patch.provenance,status:'user_supplied'}}});
  return <section className="property-section">
    <details key={wall.id} data-testid="wall-fixings-settings">
    <summary>Inserts du pan</summary>
    {wall.supportFixings?<p className="small-muted">Ce pan possède {wall.supportFixings.holes.length} points explicites. Une trame ne remplace pas ce relevé.</p>:<>
      <p className="small-muted">Trame déclarée du pan réel. Aucun espacement universel ni compatibilité entre marques n’est présumé.</p>
      <div className="field-pair">
        {(['pitchX','pitchY','offsetX','offsetY','rotationDegrees'] as const).map(key=><NumberField key={`${wall.id}-${key}`}
          label={{pitchX:'Pas inserts X',pitchY:'Pas inserts Y',offsetX:'Décalage inserts X',offsetY:'Décalage inserts Y',rotationDegrees:'Rotation de la trame'}[key]}
          value={grid[key]??0} unit={key==='rotationDegrees'?'°':'m'} step={key==='rotationDegrees'?1:.01}
          min={key.startsWith('pitch')?.01:undefined} max={key.startsWith('pitch')?30:undefined}
          onChange={value=>onChange({fixingGrid:{...grid,[key]:value}})}/>) }
      </div>
      <label className="text-field">Filetage des inserts du pan
        <input aria-label="Filetage des inserts du pan" key={`${wall.id}-thread`} maxLength={80} defaultValue={wall.fixing?.threadDesignation??''}
          placeholder="Désignation complète à relever" onBlur={e=>{const value=e.target.value.trim();if(value!==(wall.fixing?.threadDesignation??''))metadata({threadDesignation:value||undefined});}}/>
      </label>
      <label className="text-field">Système des inserts du pan
        <select aria-label="Système des inserts du pan" value={wall.fixing?.threadSystem??'unknown'} onChange={e=>metadata({threadSystem:e.target.value as FixingMetadata['threadSystem']})}>
          <option value="unknown">Non renseigné</option><option value="metric">Métrique</option><option value="imperial">Impérial</option>
        </select>
      </label>
      <label className="text-field">Référence de la trame
        <input aria-label="Référence de la trame" key={`${wall.id}-reference`} maxLength={300} defaultValue={wall.fixing?.provenance?.reference??''}
          onBlur={e=>{const reference=e.target.value.trim();if(reference!==(wall.fixing?.provenance?.reference??''))metadata({provenance:{status:'user_supplied',reference:reference||undefined}});}}/>
      </label>
    </>}
    </details>
  </section>;
}
