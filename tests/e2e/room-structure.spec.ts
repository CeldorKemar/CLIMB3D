import { test, expect, type Page } from '@playwright/test';
import type { SceneDocument } from '../../packages/contracts/src/index';
import { apiBase, csrf, confirmSave, enterWorkshop, login, room, save } from './helpers';

async function declareJugStock(actor: Awaited<ReturnType<typeof login>>, total: number) {
  const current = await room(actor);
  const response = await actor.api.post(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/inventory`, {
    headers: csrf(actor), data: { modelId: 'hold-jug', total, expectedRevision: current.revision, requestId: crypto.randomUUID() },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

function plainRoom(source: SceneDocument): SceneDocument {
  const scene = structuredClone(source);
  scene.walls = [{ ...scene.walls[0]!, width: 5, height: 4, position: [0, 0, 0], rotation: [0, 0, 0, 1], openings: [], fixingSpacing: 0.25 }];
  delete scene.walls[0]!.fixingGrid;
  delete scene.walls[0]!.supportFixings;
  delete scene.walls[0]!.levelId;
  scene.placements = [];
  scene.boulders = [];
  delete scene.levels;
  delete scene.stairs;
  return scene;
}

// Independent perspective projection for the existing "face" camera: camera (1,2,12),
// target (1,2,0), vertical field of view 42°. Clicks still go through real WebGL picking.
async function frontPoint(page: Page, x: number, y: number, z = 0) {
  const box = await page.getByTestId('editor-canvas').locator('canvas').boundingBox();
  expect(box).toBeTruthy();
  const pixelsPerMetre = box!.height / (2 * (12 - z) * Math.tan(21 * Math.PI / 180));
  return { x: box!.width / 2 + (x - 1) * pixelsPerMetre, y: box!.height / 2 - (y - 2) * pixelsPerMetre };
}

test('Ctrl clic sur de vrais meshes sélectionne plusieurs prises, masque les transformations et supprime en une opération annulable', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = plainRoom(original.scene);
    scene.placements = [
      { id: 'qa-batch-a', modelId: 'hold-jug', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [-0.75, 1.5, 0], rotation: [0, 0, 0, 1] },
      { id: 'qa-batch-b', modelId: 'hold-pinch', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [0.75, 1.5, 0], rotation: [0, 0, 0, 1] },
      { id: 'qa-batch-kept', modelId: 'hold-crimp', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [0, 3, 0], rotation: [0, 0, 0, 1] },
    ];
    scene.boulders = [{ id: 'qa-batch-route', name: 'Voie sélection groupée', grade: '5c', color: '#f07c54', placementIds: scene.placements.map(p => p.id), startIds: ['qa-batch-a'], finishIds: ['qa-batch-kept'] }];
    await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    const canvas = page.getByTestId('editor-canvas').locator('canvas');
    await canvas.click({ position: await frontPoint(page, -0.71, 1.54, 0.07) });
    await expect(page.getByTestId('selected-rotation')).toBeVisible();
    await canvas.click({ position: await frontPoint(page, 0.77, 1.55, 0.05), modifiers: ['Control'] });
    await expect(page.getByTestId('multi-selection-panel')).toContainText('2 éléments sélectionnés');
    await expect(page.getByTestId('selected-rotation')).toHaveCount(0);
    await expect(page.getByTestId('selected-position-x')).toHaveCount(0);
    await canvas.click({ position: await frontPoint(page, -0.71, 1.54, 0.07), modifiers: ['Control'] });
    await expect(page.getByTestId('multi-selection-panel')).toHaveCount(0);
    await expect(page.getByTestId('selected-rotation')).toBeVisible();
    await canvas.click({ position: await frontPoint(page, -0.71, 1.54, 0.07), modifiers: ['Control'] });
    await expect(page.getByTestId('multi-selection-panel')).toContainText('2 éléments sélectionnés');
    await page.getByTestId('keyboard-workspace').focus();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('placement-count')).toHaveText('1 éléments');
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('placement-count')).toHaveText('3 éléments');
    await expect(page.getByTestId('scene-save')).toBeDisabled();
    await page.keyboard.press('Control+Shift+z');
    await expect(page.getByTestId('placement-count')).toHaveText('1 éléments');
    await confirmSave(page);
    const after = (await room(actor)).scene;
    expect(after.placements.map(p => p.id)).toEqual(['qa-batch-kept']);
    expect(after.boulders[0]).toMatchObject({ placementIds: ['qa-batch-kept'], startIds: [], finishIds: ['qa-batch-kept'] });
  } finally { await save(actor, original.scene); await actor.api.dispose(); }
});

test('supprimer une voie avec ses pièces conserve les éléments partagés et le volume requis par une autre voie', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = plainRoom(original.scene);
    scene.placements = [
      { id: 'qa-route-support', modelId: 'volume-box', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [-1, 2, 0], rotation: [0, 0, 0, 1] },
      { id: 'qa-route-child-kept', modelId: 'hold-jug', modelVersion: 1, parentType: 'volume', parentId: 'qa-route-support', position: [0, 0, 0.25], rotation: [0, 0, 0, 1] },
      { id: 'qa-route-shared', modelId: 'hold-pinch', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [0, 1, 0], rotation: [0, 0, 0, 1] },
      { id: 'qa-route-exclusive', modelId: 'hold-crimp', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [1, 2, 0], rotation: [0, 0, 0, 1] },
    ];
    scene.boulders = [
      { id: 'qa-route-delete', name: 'Voie à retirer', grade: '5c', color: '#f07c54', placementIds: ['qa-route-support', 'qa-route-shared', 'qa-route-exclusive'], startIds: ['qa-route-exclusive'], finishIds: [] },
      { id: 'qa-route-keep', name: 'Voie à conserver', grade: '6a', color: '#9175d1', placementIds: ['qa-route-shared', 'qa-route-child-kept'], startIds: ['qa-route-child-kept'], finishIds: ['qa-route-shared'] },
    ];
    const prepared = await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    await page.getByTestId('route-active-qa-route-delete').click();
    await page.getByTestId('route-delete-with-pieces').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId('route-removal-shared')).toContainText('Pince');
    await expect(page.getByTestId('route-removal-supports')).toContainText('Boîte');
    await page.getByTestId('route-delete-confirm').click();
    await expect(page.getByTestId('placement-count')).toHaveText('3 éléments');
    await expect(page.getByTestId('route-active-qa-route-delete')).toHaveCount(0);
    await confirmSave(page);
    const after = await room(actor);
    expect(after.scene.boulders).toEqual([scene.boulders[1]]);
    expect(after.scene.placements.map(p => p.id)).toEqual(['qa-route-support', 'qa-route-child-kept', 'qa-route-shared']);
    expect(after.inventory).toEqual(prepared.inventory);
    expect(after.reservations).toEqual(prepared.reservations);
  } finally { await save(actor, original.scene); await actor.api.dispose(); }
});

test('la minimap projette exactement cinq pans en U sur XZ, se masque, s’agrandit et cadre le pan choisi', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = plainRoom(original.scene), wall = scene.walls[0]!;
    const definitions = [
      { id: 'qa-u-left-near', name: 'U gauche bas', x: -2, z: 1, width: 2, angle: Math.PI / 2 },
      { id: 'qa-u-left-far', name: 'U gauche haut', x: -2, z: 3, width: 2, angle: Math.PI / 2 },
      { id: 'qa-u-back', name: 'U fond', x: 0, z: 0, width: 4, angle: 0 },
      { id: 'qa-u-right-near', name: 'U droite bas', x: 2, z: 1, width: 2, angle: -Math.PI / 2 },
      { id: 'qa-u-right-far', name: 'U droite haut', x: 2, z: 3, width: 2, angle: -Math.PI / 2 },
    ];
    scene.walls = definitions.map(d => ({ ...structuredClone(wall), id: d.id, name: d.name, width: d.width, height: 3, position: [d.x, 0, d.z], rotation: [0, Math.sin(d.angle / 2), 0, Math.cos(d.angle / 2)] }));
    await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    const map = page.locator('.room-map-svg');
    await expect(map).toBeVisible();
    await expect(map.getByRole('button')).toHaveCount(5);
    for (const d of definitions) {
      const points = (await map.getByRole('button', { name: `Ouvrir ${d.name} en 3D`, exact: true }).locator('polygon').getAttribute('points'))!.trim().split(/\s+/).map(p => p.split(',').map(Number));
      // Four corners, including panel thickness, checked with independent Y-axis rotation.
      for (const [localX, localZ] of [[-d.width / 2, 0], [d.width / 2, 0], [-d.width / 2, -wall.thickness], [d.width / 2, -wall.thickness]]) {
        const x = d.x + localX! * Math.cos(d.angle) + localZ! * Math.sin(d.angle);
        const z = d.z - localX! * Math.sin(d.angle) + localZ! * Math.cos(d.angle);
        expect(points.some(p => Math.abs(p[0]! - x) < 1e-6 && Math.abs(p[1]! - z) < 1e-6), `${d.name} doit contenir le coin réel ${x},${z}`).toBe(true);
      }
    }
    await page.getByTitle('Masquer la minimap', { exact: true }).click();
    await expect(map).toHaveCount(0);
    await page.getByTitle('Afficher la minimap', { exact: true }).click();
    const compact = await map.boundingBox();
    await page.getByRole('button', { name: 'Agrandir le plan', exact: true }).click();
    const expanded = await map.boundingBox();
    expect(expanded!.width).toBeGreaterThan(compact!.width * 1.5);
    await page.getByRole('button', { name: 'Réduire le plan', exact: true }).click();
    const canvas = page.getByTestId('editor-canvas').locator('canvas');
    const before = await canvas.screenshot();
    await map.getByRole('button', { name: 'Ouvrir U droite haut en 3D', exact: true }).click();
    await expect(page.getByTestId('wall-width')).toHaveValue('2');
    expect((await canvas.screenshot()).equals(before), 'Le clic sur le plan doit réellement changer le cadrage WebGL').toBe(false);
    await testInfo.attach('Plan réel en U', { body: await map.screenshot(), contentType: 'image/png' });
    await expect(page.getByTestId('scene-save')).toBeDisabled();
  } finally { await save(actor, original.scene); await actor.api.dispose(); }
});

test('deux sols à des altitudes distinctes et un escalier persistent, et déplacer un niveau transporte ses pans', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = plainRoom(original.scene);
    scene.placements = [{ id: 'qa-floor-attached', modelId: 'hold-jug', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [0, 1, 0], rotation: [0, 0, 0, 1] }];
    await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    await page.getByTestId('nav-levels').click();
    await expect(page.getByRole('heading', { name: 'Sols et niveaux', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter un niveau', exact: true }).click();
    await page.getByLabel('Altitude Niveau 1', { exact: true }).fill('3.5');
    await page.getByLabel('Altitude Niveau 1', { exact: true }).blur();
    await page.getByLabel(`Niveau du pan ${scene.walls[0]!.name}`, { exact: true }).selectOption({ label: 'Niveau 1' });
    await page.getByRole('button', { name: 'Ajouter un escalier', exact: true }).click();
    await page.getByLabel('Largeur Escalier 1', { exact: true }).fill('1.4');
    await page.getByLabel('Largeur Escalier 1', { exact: true }).blur();
    await confirmSave(page);
    const first = await room(actor);
    expect(first.scene.levels).toHaveLength(2);
    const upper = first.scene.levels!.find(l => l.name === 'Niveau 1')!;
    expect(upper.elevation).toBe(3.5);
    expect(first.scene.walls[0]).toMatchObject({ levelId: upper.id, position: [0, 3.5, 0] });
    expect(first.scene.placements).toEqual(scene.placements);
    expect(first.scene.stairs).toHaveLength(1);
    expect(first.scene.stairs![0]).toMatchObject({ toLevelId: upper.id, width: 1.4 });
    await page.getByLabel('Altitude Niveau 1', { exact: true }).fill('4');
    await page.getByLabel('Altitude Niveau 1', { exact: true }).blur();
    await confirmSave(page);
    const second = await room(actor);
    expect(second.scene.walls[0]!.position).toEqual([0, 4, 0]);
    expect(second.scene.placements).toEqual(scene.placements);
    await page.reload();
    await page.getByTestId('nav-levels').click();
    await expect(page.getByLabel('Altitude Niveau 1', { exact: true })).toHaveValue('4');
    await expect(page.getByLabel('Largeur Escalier 1', { exact: true })).toHaveValue('1.4');
    expect((await room(actor)).scene).toEqual(second.scene);
  } finally { await save(actor, original.scene); await actor.api.dispose(); }
});

test('le fantôme WebGL est vert sur un insert, rouge hors trame, en collision ou sans stock, et refuse les clics invalides', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = plainRoom(original.scene);
    await save(actor, scene);
    await declareJugStock(actor, 1);
    await enterWorkshop(page, { reuseSession: true });
    await page.getByTestId('catalog-hold-jug').click();
    const canvas = page.getByTestId('editor-canvas').locator('canvas');
    const box = (await canvas.boundingBox())!;
    const status = page.getByTestId('placement-preview-status');
    const aligned = await frontPoint(page, 1, 2);
    await page.mouse.move(box.x + aligned.x, box.y + aligned.y);
    await expect(status).toHaveAttribute('data-valid', 'true');
    const acceptedPoint = JSON.parse((await status.getAttribute('data-position'))!) as number[];
    expect(acceptedPoint).toEqual([1, 2, 0]);
    await testInfo.attach('Fixation alignée autorisée', { body: await canvas.screenshot(), contentType: 'image/png' });
    const unaligned = await frontPoint(page, 1.125, 2.125);
    await page.mouse.move(box.x + unaligned.x, box.y + unaligned.y);
    await expect(status).toHaveAttribute('data-valid', 'false');
    await expect(status).toContainText(/align|insert/i);
    await testInfo.attach('Fixation hors insert refusée', { body: await canvas.screenshot(), contentType: 'image/png' });
    await canvas.click({ position: unaligned });
    await expect(page.getByTestId('placement-count')).toHaveText('0 éléments');
    await page.mouse.move(box.x + aligned.x, box.y + aligned.y);
    await expect(status).toHaveAttribute('data-valid', 'true');
    await canvas.click({ position: aligned });
    await expect(page.getByTestId('placement-count')).toHaveText('1 éléments');
    // Slightly off the drilled centre, still within the existing hold's material.
    const collision = await frontPoint(page, 1.04, 2.04, 0.06);
    await page.mouse.move(box.x + collision.x, box.y + collision.y);
    await expect(status).toHaveAttribute('data-valid', 'false');
    await expect(status).toContainText(/collision/i);
    await canvas.click({ position: collision });
    await expect(page.getByTestId('placement-count')).toHaveText('1 éléments');
    const emptyStock = await frontPoint(page, -1, 2);
    await page.mouse.move(box.x + emptyStock.x, box.y + emptyStock.y);
    await expect(status).toHaveAttribute('data-valid', 'false');
    await expect(status).toContainText(/stock/i);
    await canvas.click({ position: emptyStock });
    await expect(page.getByTestId('placement-count')).toHaveText('1 éléments');
    await page.keyboard.press('Escape');
    await confirmSave(page);
    expect((await room(actor)).scene.placements).toHaveLength(1);
  } finally {
    await declareJugStock(actor, original.inventory.find(item => item.modelId === 'hold-jug')!.total);
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('l’API refuse un boulonnage hors insert et un étage inexistant sans écrire de version partielle', async () => {
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = plainRoom(original.scene);
    const prepared = await save(actor, scene);
    scene.placements = [{ id: 'qa-api-off-grid', modelId: 'hold-jug', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [0.125, 1.125, 0], rotation: [0, 0, 0, 1] }];
    const response = await actor.api.put(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/scene`, { headers: csrf(actor), data: { scene, expectedRevision: prepared.revision } });
    expect(response.status()).toBe(400);
    expect(await response.text()).toMatch(/align|insert/i);
    expect((await room(actor)).revision).toBe(prepared.revision);
    expect((await room(actor)).scene).toEqual(prepared.scene);
    scene.placements = [];
    scene.levels = [{ id: 'qa-api-real-level', name: 'Niveau 0', elevation: 0, outline: [[-3, -1], [3, -1], [3, 4], [-3, 4]] }];
    scene.walls[0]!.levelId = 'qa-api-missing-level';
    const invalidLevel = await actor.api.put(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/scene`, { headers: csrf(actor), data: { scene, expectedRevision: prepared.revision } });
    expect(invalidLevel.status()).toBe(400);
    expect(await invalidLevel.text()).toMatch(/niveau/i);
    expect((await room(actor)).scene).toEqual(prepared.scene);
  } finally { await save(actor, original.scene); await actor.api.dispose(); }
});

test('cliquer au centre du véritable trou d’un volume place la prise sur son insert même si la grille est masquée', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = plainRoom(original.scene);
    scene.placements = [{ id: 'qa-real-bore-support', modelId: 'volume-box', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [0, 2, 0], rotation: [0, 0, 0, 1] }];
    await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    const toggle = page.getByRole('button', { name: 'Afficher les fixations et la grille', exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('catalog-hold-jug').click();
    const canvas = page.getByTestId('editor-canvas').locator('canvas');
    const box = (await canvas.boundingBox())!;
    const point = await frontPoint(page, 0, 2, 0.25);
    await page.mouse.move(box.x + point.x, box.y + point.y);
    const status = page.getByTestId('placement-preview-status');
    await expect(status).toHaveAttribute('data-parent-id', 'qa-real-bore-support');
    await expect(status).toHaveAttribute('data-valid', 'true');
    await canvas.click({ position: point });
    await expect(page.getByTestId('placement-count')).toHaveText('2 éléments');
    await page.keyboard.press('Escape');
    await confirmSave(page);
    expect((await room(actor)).scene.placements.find(p => p.id !== 'qa-real-bore-support')).toMatchObject({ parentType: 'volume', parentId: 'qa-real-bore-support', position: [0, 0, 0.25] });
  } finally { await save(actor, original.scene); await actor.api.dispose(); }
});
