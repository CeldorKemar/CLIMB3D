import {test,expect,type Page} from '@playwright/test';
import {demoModels,type SceneDocument} from '../../packages/contracts/src/index';
import {createWallChain} from '../../packages/geometry/src/index';
import {apiBase,csrf,login,room,save,enterWorkshop,confirmSave,type Actor} from './helpers';

function plain(source:SceneDocument) {
  const scene=structuredClone(source);
  scene.walls=[{...scene.walls[0]!,width:5,height:4,position:[0,0,0],rotation:[0,0,0,1],openings:[]}];
  const wall=scene.walls[0]!;
  delete wall.supportFixings;delete wall.pilotGrid;delete wall.preparedPilotHoles;delete wall.allowPilotDrilling;delete wall.levelId;delete wall.fixing;delete wall.fixingGrid;
  delete scene.levels;delete scene.stairs;scene.placements=[];scene.boulders=[];return scene;
}
async function stock(actor:Actor,id:string,total:number) {
  const current=await room(actor),response=await actor.api.post(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/inventory`,{headers:csrf(actor),data:{modelId:id,total,expectedRevision:current.revision,requestId:crypto.randomUUID()}});
  expect(response.ok(),await response.text()).toBeTruthy();
}
async function at(page:Page,x:number,y:number) {
  const canvas=page.getByTestId('editor-canvas').locator('canvas'),box=(await canvas.boundingBox())!;
  const ppm=box.height/(24*Math.tan(21*Math.PI/180)),cx=box.width/2+(x-1)*ppm,cy=box.height/2-(y-2)*ppm;
  return {canvas,cx,cy,x:box.x+cx,y:box.y+cy};
}
async function restore(actor:Actor,original:SceneDocument,ids:string[]=[]) {
  for(const id of ids)if(!original.models.some(m=>m.id===id)&&(await room(actor)).inventory.some(i=>i.modelId===id&&i.total>0))await stock(actor,id,0);
  await save(actor,original);await actor.api.dispose();
}

test('les cinq volumes génériques se posent depuis les réglages visibles sans changer les modèles ni contourner les quatre fixations',async({page},testInfo)=>{
  test.setTimeout(180_000);const actor=await login('alice@climbed.local'),original=await room(actor),ids:string[]=[];
  try {
    const scene=plain(original.scene),models=demoModels.filter(m=>m.kind==='volume').map(m=>({...structuredClone(m),id:crypto.randomUUID()}));
    ids.push(...models.map(m=>m.id));scene.models.push(...models);
    await save(actor,scene);for(const id of ids)await stock(actor,id,1);
    await enterWorkshop(page,{reuseSession:true});await page.getByRole('button',{name:'Volumes',exact:true}).click();
    for(const [index,model] of models.entries()) {
      await page.getByTestId(`catalog-${model.id}`).click();await expect(page.getByTestId('placement-controls')).toBeVisible();
      await expect(page.getByTestId('placement-controls')).toContainText('Aucun trou pilote');
      let target=await at(page,.1,2.11);await page.mouse.move(target.x,target.y);
      await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','false');
      await page.getByLabel('Préparer les trous pilotes puis placer',{exact:true}).check();
      await page.getByLabel('Autoriser le préperçage du support visé',{exact:true}).check();
      await page.getByLabel('Diamètre pilote à préparer',{exact:true}).fill('3');
      target=await at(page,.1,2.11);await page.mouse.move(target.x,target.y);
      await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','true');
      await expect(page.getByTestId('placement-preview-status')).toContainText('4 trous pilotes');
      if(index===models.length-1)await testInfo.attach('Réglages visibles et volume posable',{body:await page.screenshot(),contentType:'image/png'});
      await target.canvas.click({position:{x:target.cx,y:target.cy}});await page.keyboard.press('Escape');
      await expect(page.getByTestId('placement-count')).toHaveText('1 éléments');
      if(index<models.length-1) {await page.getByTestId('scene-undo').click();await expect(page.getByTestId('placement-count')).toHaveText('0 éléments');}
    }
    await confirmSave(page);const after=await room(actor);
    expect(after.scene.walls[0]!.preparedPilotHoles).toHaveLength(4);expect(after.scene.models).toEqual(scene.models);
    expect(after.occupations).toEqual(original.occupations);
  }finally{await restore(actor,original.scene,ids);}
});

test('la minimap garde les pieds de murs, exclut toits et pans supérieurs du rendu et des bornes, et permet de cadrer puis orbiter',async({page},testInfo)=>{
  test.setTimeout(120_000);const actor=await login('alice@climbed.local'),original=await room(actor);
  try {
    const scene=plain(original.scene),chain=createWallChain({origin:[0,0,0],width:4,thickness:.18,segments:[{length:1,inclination:15},{length:1,inclination:30},{length:1,inclination:0},{length:.8,inclination:90}],fixingSpacing:.25,color:'#d4dcd3',idPrefix:'regression-profile'});
    scene.walls=[...chain,{...scene.walls[0]!,id:'independent-wall',name:'Mur indépendant',width:1.5,position:[5,0,0]},{...chain[3]!,id:'remote-roof',name:'Toit distant',position:[100,10,100]}];
    await save(actor,scene);await enterWorkshop(page,{reuseSession:true});
    const map=page.locator('.room-map-svg');await expect(map.getByRole('button')).toHaveCount(2);
    for(const id of [chain[1]!.id,chain[2]!.id,chain[3]!.id,'remote-roof'])await expect(map.locator(`[data-wall-id="${id}"]`)).toHaveCount(0);
    const bounds=(await map.getAttribute('viewBox'))!;expect(bounds.split(' ').map(Number).every(n=>Math.abs(n)<20)).toBe(true);
    await page.getByTestId('scene-item-remote-roof').click();await page.getByTestId('wall-height').fill('9');await page.getByTestId('wall-height').press('Enter');
    await expect(map).toHaveAttribute('viewBox',bounds);
    await map.locator(`[data-wall-id="${chain[0]!.id}"]`).click();await expect(page.getByTestId('wall-height')).toHaveValue('1');
    const canvas=page.getByTestId('editor-canvas').locator('canvas'),before=await canvas.screenshot(),box=(await canvas.boundingBox())!;
    await page.mouse.move(box.x+box.width*.6,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5,{steps:12});await page.mouse.up();
    expect((await canvas.screenshot()).equals(before)).toBe(false);
    await testInfo.attach('Plan sans toit et caméra après rotation',{body:await page.screenshot(),contentType:'image/png'});
  }finally{await restore(actor,original.scene);}
});

test('trame et filetages déclarés persistent ; système incompatible refusé dans le navigateur et par l’API',async({page})=>{
  test.setTimeout(120_000);const actor=await login('alice@climbed.local'),original=await room(actor),id=crypto.randomUUID();
  try {
    const scene=plain(original.scene),source=demoModels.find(m=>m.id==='hold-crimp')!;
    scene.models.push({...structuredClone(source),id,mounting:{method:'bolt',holes:[{id:'bolt',position:[0,0,0],diameter:.012,role:'primary'}],threadDesignation:'EXAMPLE X 1',threadSystem:'metric'}});
    await save(actor,scene);await stock(actor,id,1);await enterWorkshop(page,{reuseSession:true});
    await page.getByTestId(`catalog-${id}`).click();let target=await at(page,0,2);await page.mouse.move(target.x,target.y);
    await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','false');await expect(page.getByTestId('placement-preview-status')).toContainText('Filetage');
    await page.keyboard.press('Escape');await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await page.getByTestId('wall-fixings-settings').locator('summary').click();
    for(const [label,value] of [['Pas inserts X','.2'],['Pas inserts Y','.3'],['Décalage inserts X','.05'],['Décalage inserts Y','.1']]) {
      await page.getByLabel(label!,{exact:true}).fill(value!);await page.getByLabel(label!,{exact:true}).press('Enter');
    }
    await page.getByLabel('Filetage des inserts du pan',{exact:true}).fill('example × 1');await page.getByLabel('Filetage des inserts du pan',{exact:true}).press('Tab');
    await page.getByLabel('Système des inserts du pan',{exact:true}).selectOption('imperial');
    await page.getByLabel('Référence de la trame',{exact:true}).fill('Notice synthétique du scénario');await page.getByLabel('Référence de la trame',{exact:true}).press('Tab');
    await confirmSave(page);expect((await room(actor)).scene.walls[0]!.fixing!.provenance).toMatchObject({status:'user_supplied',reference:'Notice synthétique du scénario'});
    await page.getByTestId(`catalog-${id}`).click();target=await at(page,.05,1.9);await page.mouse.move(target.x,target.y);
    await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','false');await expect(page.getByTestId('placement-preview-status')).toContainText('Filetage');
    await page.keyboard.press('Escape');await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();await page.getByTestId('wall-fixings-settings').locator('summary').click();await page.getByLabel('Système des inserts du pan',{exact:true}).selectOption('metric');
    await page.getByTestId(`catalog-${id}`).click();target=await at(page,.05,1.9);await page.mouse.move(target.x,target.y);
    await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','true');await target.canvas.click({position:{x:target.cx,y:target.cy}});await page.keyboard.press('Escape');await confirmSave(page);
    const saved=await room(actor),invalid=structuredClone(saved.scene);invalid.walls[0]!.fixing!.threadSystem='imperial';
    const response=await actor.api.put(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/scene`,{headers:csrf(actor),data:{scene:invalid,expectedRevision:saved.revision}});
    expect(response.status()).toBe(400);expect((await room(actor)).revision).toBe(saved.revision);
  }finally{await restore(actor,original.scene,[id]);}
});
