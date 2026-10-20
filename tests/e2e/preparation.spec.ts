import {test,expect,type Page} from '@playwright/test';
import {createMountingExample,type SceneDocument} from '../../packages/contracts/src/index';
import {apiBase,csrf,login,room,save,enterWorkshop,confirmSave,type Actor} from './helpers';

function bare(source:SceneDocument) {
  const scene=structuredClone(source);
  scene.walls=[{...scene.walls[0]!,width:5,height:4,position:[0,0,0],rotation:[0,0,0,1],openings:[],supportFixings:{allowScrews:true,holes:[]}}];
  delete scene.walls[0]!.pilotGrid;delete scene.walls[0]!.preparedPilotHoles;delete scene.walls[0]!.allowPilotDrilling;delete scene.walls[0]!.levelId;
  delete scene.levels;delete scene.stairs;scene.placements=[];scene.boulders=[];return scene;
}
async function stock(actor:Actor,id:string,total:number) {
  const current=await room(actor),response=await actor.api.post(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/inventory`,{headers:csrf(actor),data:{modelId:id,total,expectedRevision:current.revision,requestId:crypto.randomUUID()}});
  expect(response.ok(),await response.text()).toBeTruthy();
}
async function point(page:Page,x:number,y:number,z=0) {
  const canvas=page.getByTestId('editor-canvas').locator('canvas'),box=(await canvas.boundingBox())!;
  const ppm=box.height/(2*(12-z)*Math.tan(21*Math.PI/180)),cx=box.width/2+(x-1)*ppm,cy=box.height/2-(y-2)*ppm;
  return {canvas,cx,cy,x:box.x+cx,y:box.y+cy};
}
async function cleanup(actor:Actor,original:SceneDocument,id?:string) {
  if(id&&!original.models.some(m=>m.id===id)&&(await room(actor)).inventory.some(i=>i.modelId===id&&i.total>0))await stock(actor,id,0);
  await save(actor,original);await actor.api.dispose();
}

test('le catalogue protège le stock, propose les trois modes et permet les trous de pièce avec référence',async({page})=>{
  test.setTimeout(120_000);const actor=await login('alice@climbed.local'),original=await room(actor);
  try {
    await save(actor,bare(original.scene));await enterWorkshop(page,{reuseSession:true});await page.getByTestId('nav-catalog').click();
    await page.getByTestId('catalog-tab-volume').click();await page.getByTestId('catalog-edit-volume-box').click();
    await expect(page.getByLabel('Mode de fixation',{exact:true})).toBeDisabled();
    await page.getByTestId('catalog-duplicate-volume-box').click();
    const id=(await page.getByTestId('catalog-editor').getAttribute('data-model-id'))!;
    await page.getByLabel('Mode de fixation',{exact:true}).selectOption('pre_drilled');
    await expect(page.getByTestId('mounting-hole-add')).toBeDisabled();
    await page.getByLabel('Référence autorisant la modification',{exact:true}).fill('Notice de démonstration autorisant la modification');
    await page.getByLabel('Référence autorisant la modification',{exact:true}).press('Enter');
    await expect(page.getByTestId('mounting-hole-add')).toBeEnabled();
    await page.getByTestId('mounting-hole-add').click();await page.getByLabel('Trou 1 X',{exact:true}).fill('-0.2');await page.getByLabel('Trou 1 X',{exact:true}).press('Enter');
    await page.getByTestId('model-apply').click();await confirmSave(page);
    const saved=await room(actor),model=saved.scene.models.find(m=>m.id===id)!;
    expect(model.mounting!.holes).toHaveLength(5);expect(model.mounting!.holes[0]!.position[0]).toBe(-.2);
    expect(model.mounting!.modificationAuthorization!.reference).toContain('démonstration');
    expect(saved.scene.models.find(m=>m.id==='volume-box')).toEqual(original.scene.models.find(m=>m.id==='volume-box'));
    expect(saved.inventory).toEqual(original.inventory);
    await page.getByTestId('catalog-create-hold').click();
    const holdId=(await page.getByTestId('catalog-editor').getAttribute('data-model-id'))!;
    for(const mode of ['bolt','pre_drilled','direct']) {await page.getByLabel('Mode de fixation',{exact:true}).selectOption(mode);await expect(page.getByLabel('Mode de fixation',{exact:true})).toHaveValue(mode);}
    await page.getByTestId('model-apply').click();await confirmSave(page);
    expect((await room(actor)).scene.models.find(m=>m.id===holdId)!.mounting!.screwPlacement).toBe('direct');
  }finally{await cleanup(actor,original.scene);}
});

test('préparer puis poser un dôme crée quatre pilotes atomiques, annulables et persistants',async({page})=>{
  test.setTimeout(120_000);const actor=await login('alice@climbed.local'),original=await room(actor),id=crypto.randomUUID();
  try {
    const scene=bare(original.scene),model=createMountingExample('dome',id);
    model.mounting={method:'screw',holes:model.mounting!.holes.map(h=>({...h,diameter:.005}))};scene.models.push(model);
    await save(actor,scene);await stock(actor,id,1);await enterWorkshop(page,{reuseSession:true});
    await page.getByRole('button',{name:'Volumes',exact:true}).click();await page.getByTestId(`catalog-${id}`).click();
    await page.getByLabel('Préparer les trous pilotes puis placer',{exact:true}).check();await page.getByLabel('Diamètre pilote à préparer',{exact:true}).fill('3');
    let target=await point(page,0,2);await page.mouse.move(target.x,target.y);
    await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','false');await expect(page.getByTestId('placement-preview-status')).toContainText('n’autorise pas');
    await page.keyboard.press('Escape');await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await page.getByLabel('Autoriser le préperçage de ce support',{exact:true}).check();
    await page.getByTestId(`catalog-${id}`).click();await page.getByLabel('Préparer les trous pilotes puis placer',{exact:true}).check();
    target=await point(page,0,2);await page.mouse.move(target.x,target.y);await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','true');
    await expect(page.getByTestId('placement-preview-status')).toContainText('4 trous pilotes');await target.canvas.click({position:{x:target.cx,y:target.cy}});
    await page.keyboard.press('Escape');await expect(page.getByTestId('placement-count')).toHaveText('1 éléments');
    await page.getByTestId('scene-undo').click();await expect(page.getByTestId('placement-count')).toHaveText('0 éléments');
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();await expect(page.getByText('0 trous pilotes préparés.',{exact:true})).toBeVisible();
    await page.getByTestId('scene-redo').click();await confirmSave(page);await page.reload();
    const saved=(await room(actor)).scene;expect(saved.walls[0]!.preparedPilotHoles).toHaveLength(4);expect(saved.placements).toHaveLength(1);expect(saved.models).toEqual(scene.models);
  }finally{await cleanup(actor,original.scene,id);}
});

test('préparer la face d’un volume pour une prise ne modifie pas son modèle du catalogue',async({page})=>{
  test.setTimeout(120_000);const actor=await login('alice@climbed.local'),original=await room(actor),id=crypto.randomUUID();
  try {
    const scene=bare(original.scene),source=scene.models.find(m=>m.id==='hold-crimp')!;
    scene.models.push({...source,id,mounting:{method:'screw',holes:[{id:'screw',position:[0,0,0],diameter:.005,role:'primary'}]}});
    scene.placements=[{id:'receiving-box',modelId:'volume-box',modelVersion:1,parentType:'wall',parentId:scene.walls[0]!.id,position:[0,2,0],rotation:[0,0,0,1]}];
    await save(actor,scene);await stock(actor,id,1);await enterWorkshop(page,{reuseSession:true});
    await page.getByTestId('scene-item-receiving-box').click();await page.getByLabel('Autoriser le préperçage de ce support',{exact:true}).check();
    await page.getByTestId(`catalog-${id}`).click();await page.getByLabel('Préparer les trous pilotes puis placer',{exact:true}).check();await page.getByLabel('Diamètre pilote à préparer',{exact:true}).fill('3');
    const target=await point(page,.12,2.08,.25);await page.mouse.move(target.x,target.y);await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','true');
    await target.canvas.click({position:{x:target.cx,y:target.cy}});await page.keyboard.press('Escape');await expect(page.getByTestId('placement-count')).toHaveText('2 éléments');await confirmSave(page);
    const saved=(await room(actor)).scene;expect(saved.placements.find(p=>p.id==='receiving-box')!.preparedPilotHoles).toHaveLength(1);
    expect(saved.placements.find(p=>p.modelId===id)!.parentId).toBe('receiving-box');expect(saved.models).toEqual(scene.models);
  }finally{await cleanup(actor,original.scene,id);}
});
