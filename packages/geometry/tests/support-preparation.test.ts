import {describe, expect, it} from 'vitest';
import {createDemoScene, sceneSchema, type Placement} from '@climbed/contracts';
import {commitScene, createHistory, undoHistory, redoHistory} from '@climbed/editor-core';
import {DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three';
import {canPrepareSupport, createModelGeometry, getMountingHoles, getPlacementModel, prepareSupportForPlacement, validatePlacementMounting, validateSceneChange} from '../src/index';
import {directScrewScene} from './fixtures';

function fixture() {
  const scene = directScrewScene(createDemoScene());
  scene.walls = [{...scene.walls[0]!, width:4, height:3, rotation:[0,0,0,1], openings:[], supportFixings:{allowScrews:true, holes:[]}}];
  scene.placements=[]; scene.boulders=[];
  const model=scene.models.find(m=>m.id==='volume-dome')!;
  model.mounting={method:'screw',screwPlacement:'pre_drilled',holes:getMountingHoles(model)};
  const placement:Placement={id:'planned-dome',modelId:model.id,modelVersion:1,parentType:'wall',parentId:scene.walls[0]!.id,position:[.1,1.1,0],rotation:[0,0,0,1]};
  return {scene,placement};
}
describe('préparation explicite des supports',()=>{
  it('exige une permission et un diamètre explicites, sans modifier la scène en cas de refus',()=>{
    const {scene,placement}=fixture(), original=structuredClone(scene);
    expect(()=>prepareSupportForPlacement(scene,placement,{pilotDiameter:.003})).toThrow('n’autorise pas');
    scene.walls[0]!.allowPilotDrilling=true;
    expect(()=>prepareSupportForPlacement(scene,placement)).toThrow('diamètre pilote');
    expect(scene.placements).toEqual(original.placements);
    expect(scene.walls[0]!.preparedPilotHoles).toBeUndefined();
  });
  it('prépare les quatre pilotes, les réutilise et annule placement et trous en une seule action',()=>{
    const {scene,placement}=fixture();scene.walls[0]!.allowPilotDrilling=true;
    const original=structuredClone(scene.models), result=prepareSupportForPlacement(scene,placement,{pilotDiameter:.003});
    expect(result.addedHoleCount).toBe(4);
    result.scene.placements.push(placement);
    expect(validateSceneChange(scene,result.scene)).toEqual([]);
    expect(validatePlacementMounting(result.scene,placement)).toEqual([]);
    expect(result.scene.models).toEqual(original);
    expect(scene.walls[0]!.preparedPilotHoles).toBeUndefined();
    expect(prepareSupportForPlacement(result.scene,placement).addedHoleCount).toBe(0);
    const committed=commitScene(createHistory(scene),result.scene), undone=undoHistory(committed);
    expect(undone.present).toEqual(scene);
    expect(redoHistory(undone).present).toEqual(result.scene);
    const revoked=structuredClone(result.scene);revoked.walls[0]!.allowPilotDrilling=false;
    expect(validateSceneChange(result.scene,revoked)).toEqual([]);
  });
  it('ne perce pas un insert existant et ne crée jamais un insert de boulonnage',()=>{
    const {scene,placement}=fixture();scene.walls[0]!.allowPilotDrilling=true;
    const h=getMountingHoles(scene.models.find(m=>m.id===placement.modelId)!)[0]!;
    scene.walls[0]!.supportFixings!.holes=[{id:'insert',kind:'insert',position:[h.position[0]+.1,h.position[1]+1.1,0],normal:[0,0,1]}];
    expect(()=>prepareSupportForPlacement(scene,placement,{pilotDiameter:.003})).toThrow('recouvrirait');
    placement.modelId='hold-jug';
    expect(()=>prepareSupportForPlacement(scene,placement,{pilotDiameter:.003})).toThrow('ne nécessite pas');
  });
  it('refuse les bords et ouvertures même si le centre du pilote est sur le pan',()=>{
    const {scene,placement}=fixture();scene.walls[0]!.allowPilotDrilling=true;
    const model=scene.models.find(m=>m.id===placement.modelId)!;
    model.mounting!.holes=[{id:'one',position:[0,0,0],diameter:.005,role:'primary'}];
    placement.position=[1.999,1,0];
    expect(()=>prepareSupportForPlacement(scene,placement,{pilotDiameter:.01})).toThrow('bord');
    placement.position=[.252,1,0];scene.walls[0]!.openings=[{id:'opening',x:0,y:1,width:.5,height:.5}];
    expect(()=>prepareSupportForPlacement(scene,placement,{pilotDiameter:.01})).toThrow('bord');
  });
  it('refuse la fabrication JSON de trous non autorisés ou hors surface',()=>{
    const {scene,placement}=fixture(); const allowed=structuredClone(scene);allowed.walls[0]!.allowPilotDrilling=true;
    const prepared=prepareSupportForPlacement(allowed,placement,{pilotDiameter:.003}).scene;
    prepared.walls[0]!.allowPilotDrilling=false;
    expect(validateSceneChange(scene,prepared).join(' ')).toContain('Préperçage non autorisé');
    prepared.walls[0]!.allowPilotDrilling=true;prepared.walls[0]!.preparedPilotHoles![0]!.position=[20,0,0];
    expect(validateSceneChange(scene,prepared).join(' ')).toContain('hors de la surface');
  });
  it('prépare un exemplaire de volume et creuse un vrai trou sans changer le modèle ni son voisin',()=>{
    const {scene}=fixture();
    const box:Placement={id:'box',modelId:'volume-box',modelVersion:1,parentType:'wall',parentId:scene.walls[0]!.id,position:[0,1,0],rotation:[0,0,0,1],allowPilotDrilling:true};
    scene.placements=[box,{...box,id:'other-box',position:[1.2,1,0]}];
    const hold=scene.models.find(m=>m.id==='hold-crimp')!;
    hold.mounting={method:'screw',holes:[{id:'screw',position:[0,0,0],diameter:.005,role:'primary'}]};
    const child:Placement={...box,id:'child',modelId:hold.id,parentType:'volume',parentId:box.id,position:[.12,.08,.25]};
    const original=structuredClone(scene.models),prepared=prepareSupportForPlacement(scene,child,{pilotDiameter:.003}).scene;
    prepared.placements.push(child);
    expect(validateSceneChange(scene,prepared)).toEqual([]);
    expect(prepared.models).toEqual(original);
    expect(prepared.placements[1]!.preparedPilotHoles).toBeUndefined();
    const geometry=createModelGeometry(getPlacementModel(prepared,prepared.placements[0]!)!),material=new MeshBasicMaterial({side:DoubleSide});
    const mesh=new Mesh(geometry,material);mesh.updateMatrixWorld();
    const hits=new Raycaster(new Vector3(.12,.08,1),new Vector3(0,0,-1)).intersectObject(mesh);
    expect(hits).toHaveLength(0);geometry.dispose();material.dispose();
  });
  it('respecte une interdiction produit même si l’exemplaire est marqué autorisé',()=>{
    const {scene}=fixture(), model=scene.models.find(m=>m.id==='volume-box')!;
    model.supportFixings={allowScrews:true,allowDrilling:false,holes:[]};
    scene.placements=[{id:'box',modelId:model.id,modelVersion:1,parentType:'wall',parentId:scene.walls[0]!.id,position:[0,1,0],rotation:[0,0,0,1],allowPilotDrilling:true}];
    expect(canPrepareSupport(scene,'volume','box')).toBe(false);
    model.supportFixings.allowDrilling=true;
    expect(canPrepareSupport(scene,'volume','box')).toBe(true);
    model.supportFixings.allowScrews=false;
    expect(canPrepareSupport(scene,'volume','box')).toBe(false);
  });
  it('exige une référence pour changer les trous d’une pièce existante et conserve le retour arrière',()=>{
    const {scene}=fixture(), next=structuredClone(scene), model=next.models.find(m=>m.id==='volume-dome')!;
    model.mounting!.holes[0]!.position[0]+=.01;
    expect(validateSceneChange(scene,next).join(' ')).toContain('Référence autorisant');
    model.mounting!.modificationAuthorization={reference:'Notice produit démo — modification autorisée'};
    expect(validateSceneChange(scene,next)).toEqual([]);
    expect(validateSceneChange(next,scene)).toEqual([]);
    expect(sceneSchema.parse(next)).toEqual(next);
  });
  it('refuse deux trous de pièce qui se recouvrent',()=>{
    const {scene}=fixture(),next=structuredClone(scene),model=next.models.find(m=>m.id==='volume-dome')!;
    model.mounting!.holes[1]!.position=[...model.mounting!.holes[0]!.position];
    expect(validateSceneChange(scene,next).join(' ')).toContain('se recouvrent');
  });
});
