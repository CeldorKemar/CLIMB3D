import {test, expect, type Page} from '@playwright/test';
import {createMountingExample, type SceneDocument} from '../../packages/contracts/src/index';
import {apiBase, csrf, login, room, save, enterWorkshop, confirmSave, type Actor} from './helpers';

function bare(source: SceneDocument) {
  const scene = structuredClone(source);
  scene.walls = [{...scene.walls[0]!, width: 5, height: 4, position: [0,0,0], rotation: [0,0,0,1], openings: []}];
  delete scene.walls[0]!.supportFixings; delete scene.walls[0]!.pilotGrid; delete scene.walls[0]!.levelId;
  delete scene.levels; delete scene.stairs;
  scene.placements = []; scene.boulders = [];
  return scene;
}
async function stock(actor: Actor, modelId: string, total: number) {
  const current = await room(actor);
  const response = await actor.api.post(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/inventory`, {
    headers: csrf(actor), data: {modelId, total, expectedRevision: current.revision, requestId: crypto.randomUUID()},
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}
async function screenPoint(page: Page, x: number, y: number, z = 0) {
  const canvas = page.getByTestId('editor-canvas').locator('canvas'), box = (await canvas.boundingBox())!;
  const ppm = box.height / (2 * (12-z) * Math.tan(21 * Math.PI / 180));
  return {canvas, x: box.width/2+(x-1)*ppm, y: box.height/2-(y-2)*ppm, screenX: box.x+box.width/2+(x-1)*ppm, screenY: box.y+box.height/2-(y-2)*ppm};
}
async function cleanup(actor: Actor, original: SceneDocument, modelId?: string) {
  if (modelId && !original.models.some(m=>m.id===modelId) && (await room(actor)).inventory.some(i=>i.modelId===modelId && i.total>0)) await stock(actor, modelId, 0);
  await save(actor, original); await actor.api.dispose();
}

test('les flèches et les six boutons déplacent pans et sols, protègent les champs et ne dessinent aucun sol sur la minimap', async ({page}) => {
  test.setTimeout(120_000);
  const actor=await login('alice@climbed.local'), original=await room(actor);
  try {
    const scene=bare(original.scene); scene.placements=[{id:'move-child',modelId:'hold-jug',modelVersion:1,parentType:'wall',parentId:scene.walls[0]!.id,position:[0,1,0],rotation:[0,0,0,1]}];
    await save(actor,scene); await enterWorkshop(page,{reuseSession:true});
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await expect(page.getByTestId('structure-move')).toBeVisible();
    await page.getByTestId('keyboard-workspace').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp');
    await page.getByRole('button',{name:'Déplacer Z+',exact:true}).click();
    await expect(page.getByTestId('selected-position-x')).toHaveValue('0.1');
    await expect(page.getByTestId('selected-position-y')).toHaveValue('0.1');
    await expect(page.getByTestId('selected-position-z')).toHaveValue('0.1');
    await page.getByLabel('Nom du pan',{exact:true}).focus(); await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('selected-position-x')).toHaveValue('0.1');
    await confirmSave(page);
    const moved=await room(actor); expect(moved.scene.placements).toEqual(scene.placements);
    expect(moved.scene.walls[0]!.position).toEqual([.1,.1,.1]);
    await page.getByTestId('nav-levels').click(); await page.getByRole('button',{name:'Sélectionner le sol Niveau 0',exact:true}).click();
    const bounds=await page.locator('.room-map-svg').getAttribute('viewBox');
    await expect(page.locator('.room-map-svg polygon')).toHaveCount(1);
    await page.getByTestId('keyboard-workspace').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Alt+ArrowUp');
    await page.keyboard.press('Control+z');
    await expect(page.getByLabel('Origine Z Niveau 0',{exact:true})).toHaveValue('-5');
    await page.keyboard.press('Control+Shift+z');
    await expect(page.getByLabel('Origine Z Niveau 0',{exact:true})).toHaveValue('-4.9');
    await page.keyboard.press('Control+z');
    await confirmSave(page);
    const floorMoved=await room(actor), level=floorMoved.scene.levels![0]!;
    expect(level.elevation).toBeCloseTo(.1);
    expect(floorMoved.scene.walls[0]!.position).toEqual([.1,.2,.1]);
    expect(floorMoved.scene.placements).toEqual(scene.placements);
    expect(await page.locator('.room-map-svg').getAttribute('viewBox')).toBe(bounds);
    expect(level.outline[0]![1]).toBeCloseTo(-5);
    await page.reload(); await page.getByTestId('nav-levels').click(); await expect(page.getByLabel('Altitude Niveau 0',{exact:true})).toHaveValue('0.1');
  } finally {await cleanup(actor,original.scene);}
});

test('un dôme exige les quatre trous pilotes : rouge hors alignement, refus API et vert sur les quatre', async ({page}) => {
  test.setTimeout(120_000);
  const actor=await login('alice@climbed.local'),original=await room(actor); const modelId=crypto.randomUUID();
  try {
    const scene=bare(original.scene), model=createMountingExample('dome',modelId);
    model.mounting={method:'screw',holes:model.mounting!.holes.map(h=>({...h,diameter:.005}))};
    scene.models.push(model);
    scene.walls[0]!.supportFixings={allowScrews:true,holes:[[-.25,-.25],[.25,-.25],[.25,.25],[-.25,.25]].map(([x,y],i)=>({id:`pilot-${i}`,kind:'pilot',position:[x!,2+y!,0],normal:[0,0,1]}))};
    await save(actor,scene); await stock(actor,modelId,1);
    await enterWorkshop(page,{reuseSession:true}); await page.getByRole('button',{name:'Volumes',exact:true}).click(); await page.getByTestId(`catalog-${modelId}`).click();
    const point=await screenPoint(page,0,2), wrong=await screenPoint(page,.12,2.12);
    await page.mouse.move(wrong.screenX,wrong.screenY);
    await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','false');
    await expect(page.getByTestId('placement-preview-status')).toContainText('trou pilote');
    await wrong.canvas.click({position:{x:wrong.x,y:wrong.y}}); await expect(page.getByTestId('placement-count')).toHaveText('0 éléments');
    const current=await room(actor), partial=structuredClone(scene);
    partial.walls[0]!.supportFixings!.holes=partial.walls[0]!.supportFixings!.holes.filter((_,i)=>i===0||i===2);
    partial.placements=[{id:'invalid-two-screws',modelId,modelVersion:1,parentType:'wall',parentId:scene.walls[0]!.id,position:[0,2,0],rotation:[0,0,0,1]}];
    const response=await actor.api.put(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/scene`,{headers:csrf(actor),data:{scene:partial,expectedRevision:current.revision}});
    expect(response.status()).toBe(400); expect((await room(actor)).revision).toBe(current.revision);
    await page.mouse.move(point.screenX,point.screenY); await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','true');
    await point.canvas.click({position:{x:point.x,y:point.y}}); await expect(page.getByTestId('placement-count')).toHaveText('1 éléments');
    await page.keyboard.press('Escape'); await confirmSave(page);
    const installed=(await room(actor)).scene.placements[0]!; expect(installed.position[0]).toBeCloseTo(0);expect(installed.position[1]).toBeCloseTo(2);
  } finally {await cleanup(actor,original.scene,modelId);}
});

test('la pyramide de catalogue porte quatre inserts inclinés et reçoit une prise au centre d’un vrai perçage', async ({page},testInfo) => {
  test.setTimeout(120_000);
  const actor=await login('alice@climbed.local'),original=await room(actor); let modelId:string|undefined;
  try {
    await save(actor,bare(original.scene)); await enterWorkshop(page,{reuseSession:true});
    await page.getByTestId('nav-catalog').click(); await page.getByTestId('catalog-example-pyramid').click();
    await expect(page.getByTestId('model-name')).toHaveValue('Pyramide à inserts — démo');
    modelId=(await page.getByTestId('catalog-editor').getAttribute('data-model-id'))!;
    await confirmSave(page); const model=(await room(actor)).scene.models.find(m=>m.id===modelId)!;
    expect(model.mounting!.holes).toHaveLength(4); expect(model.supportFixings!.holes).toHaveLength(4);
    await stock(actor,modelId,1); await page.reload(); await page.getByTestId('view-front').click(); await page.getByRole('button',{name:'Volumes',exact:true}).click(); await page.getByTestId(`catalog-${modelId}`).click();
    let point=await screenPoint(page,0,2); await page.mouse.move(point.screenX,point.screenY);
    await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','true');
    await point.canvas.click({position:{x:point.x,y:point.y}});
    await page.getByRole('button',{name:'Prises',exact:true}).click(); await page.getByTestId('catalog-hold-crimp').click();
    point=await screenPoint(page,.3,2,.25); await page.mouse.move(point.screenX,point.screenY);
    await expect(page.getByTestId('placement-preview-status')).toHaveAttribute('data-valid','true');
    await point.canvas.click({position:{x:point.x,y:point.y}}); await expect(page.getByTestId('placement-count')).toHaveText('2 éléments');
    await page.keyboard.press('Escape'); await confirmSave(page);
    const saved=(await room(actor)).scene, volume=saved.placements.find(p=>p.modelId===modelId)!, child=saved.placements.find(p=>p.parentId===volume.id)!;
    expect(child.parentType).toBe('volume'); expect(child.position).toEqual([.3,0,.25]); expect(child.rotation[1]).toBeGreaterThan(.1);
    const imagePath=testInfo.outputPath('pyramide-inserts.png'); await page.screenshot({path:imagePath});
    await testInfo.attach('Pyramide à inserts avec prise',{path:imagePath,contentType:'image/png'});
  } finally {await cleanup(actor,original.scene,modelId);}
});
