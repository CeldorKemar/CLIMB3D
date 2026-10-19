import { test, expect } from '@playwright/test';
import { apiBase, csrf, confirmSave, enterWorkshop, login, room, save } from './helpers';
import type { SceneDocument, SnapshotSummary } from '../../packages/contracts/src/index';

function bareScene(source: SceneDocument): SceneDocument {
  const scene = structuredClone(source);
  scene.walls = [{ ...scene.walls[0]!, width: 5, height: 4, position: [0, 0, 0], rotation: [0, 0, 0, 1], openings: [] }];
  scene.placements = [];
  scene.boulders = [];
  return scene;
}

test('le catalogue conserve le brouillon de salle et distingue les modèles sans stock', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const prepared = await save(actor, bareScene(original.scene));
    await enterWorkshop(page);
    await expect(page.getByRole('button', { name: /stock/i })).toHaveCount(1);
    const canvas = page.getByTestId('editor-canvas').locator('canvas');
    const bounds = (await canvas.boundingBox())!;
    await page.getByTestId('catalog-hold-jug').click();
    await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await expect(page.getByTestId('placement-count')).toHaveText(/^1 éléments?$/);
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Couleur de l’élément', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Relief', { exact: true })).toHaveCount(0);

    await page.getByTestId('nav-catalog').click();
    await expect(page.getByTestId('editor-canvas')).toBeHidden();
    await page.getByTestId('catalog-create-hold').click();
    const form = page.getByTestId('catalog-editor');
    await expect(form).toHaveAttribute('data-model-id', /^[0-9a-f-]{36}$/);
    const newId = (await form.getAttribute('data-model-id'))!;
    expect(newId).toBeTruthy();
    await page.getByTestId('model-name').fill('Prise de contrôle QA');
    await page.getByTestId('model-width').fill('0.18');
    await page.getByTestId('model-height').fill('0.12');
    await page.getByTestId('model-depth').fill('0.08');
    await page.getByTestId('model-apply').click();
    await expect(page.getByTestId(`catalog-edit-${newId}`)).toBeVisible();
    await page.getByTestId(`catalog-edit-${newId}`).click();
    await expect(page.getByTestId('model-name')).toHaveValue('Prise de contrôle QA');
    await page.getByTestId('model-name').fill('Prise de contrôle QA révisée');
    await page.getByTestId('model-apply').click();
    await page.getByTestId(`catalog-duplicate-${newId}`).click();
    await expect(form).not.toHaveAttribute('data-model-id', newId);
    const copyId = (await form.getAttribute('data-model-id'))!;
    expect(copyId).not.toBe(newId);
    await page.getByTestId('model-delete').click();
    await expect(page.getByTestId(`catalog-edit-${copyId}`)).toHaveCount(0);
    await expect(page.getByTestId(`catalog-edit-${newId}`)).toBeVisible();

    await page.getByTestId('nav-design').click();
    await expect(page.getByTestId('placement-count')).toHaveText(/^1 éléments?$/);
    await expect(page.getByTestId(`catalog-${newId}`)).toBeDisabled();
    await expect(page.getByTestId(`model-remaining-${newId}`)).toContainText('0');
    await expect(page.getByTestId('catalog-hold-jug')).toBeEnabled();
    const untouchedServer = await room(actor);
    expect(untouchedServer.revision).toBe(prepared.revision);
    expect(untouchedServer.scene.placements).toHaveLength(0);
    await confirmSave(page);
    const persisted = await room(actor);
    expect(persisted.scene.placements).toHaveLength(1);
    expect(persisted.scene.models.find(model => model.id === newId)?.name).toBe('Prise de contrôle QA révisée');
    await page.reload();
    await expect(page.getByTestId('placement-count')).toHaveText(/^1 éléments?$/);
    await expect(page.getByTestId(`catalog-${newId}`)).toBeDisabled();
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('un assemblage 0°, 30°, 0° raccorde ses trois pans et un toit affiche sa profondeur', async ({ page }) => {
  test.setTimeout(90_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    await save(actor, bareScene(original.scene));
    await enterWorkshop(page);
    await page.getByTestId('wall-chain-open').click();
    for (let index = 0; index < 3; index++) {
      await page.getByTestId(`chain-length-${index}`).fill('1');
      await page.getByTestId(`chain-angle-${index}`).fill(index === 1 ? '30' : '0');
    }
    await page.getByTestId('chain-apply').click();
    await confirmSave(page);
    const assembled = await room(actor);
    expect(assembled.scene.walls).toHaveLength(4);
    const chain = assembled.scene.walls.slice(-3);
    for (const [index, wall] of chain.entries()) {
      expect(wall.height).toBe(1);
      expect(wall.rotation[0]).toBeCloseTo(index === 1 ? Math.sin(Math.PI / 12) : 0, 5);
    }
    // Independent trigonometry checks the common edges, rather than calling the production chain builder.
    for (let index = 1; index < chain.length; index++) {
      const previous = chain[index - 1]!;
      const next = chain[index]!;
      const angle = index === 2 ? Math.PI / 6 : 0;
      expect(next.position[0]).toBeCloseTo(previous.position[0], 5);
      expect(next.position[1]).toBeCloseTo(previous.position[1] + Math.cos(angle), 5);
      expect(next.position[2]).toBeCloseTo(previous.position[2] + Math.sin(angle), 5);
    }
    await page.getByTestId(`scene-item-${chain[2]!.id}`).click();
    await page.getByTestId('wall-inclination').fill('90');
    await page.getByTestId('wall-inclination').blur();
    await expect(page.getByTestId('wall-height')).toHaveAccessibleName(/profondeur/i);
    await page.getByTestId('wall-height').fill('1.4');
    await page.getByTestId('wall-height').blur();
    await confirmSave(page);
    const roof = (await room(actor)).scene.walls.find(wall => wall.id === chain[2]!.id)!;
    expect(roof.height).toBe(1.4);
    expect(roof.rotation[0]).toBeCloseTo(Math.SQRT1_2, 5);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('un volume appartient à plusieurs voies et reste visible tant qu’une de ses voies est visible', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = bareScene(original.scene);
    scene.placements = [
      { id: 'qa-shared-volume', modelId: 'volume-box', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [-0.8, 2, 0], rotation: [0, 0, 0, 1] },
      { id: 'qa-route-a-hold', modelId: 'hold-crimp', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [-1.5, 1, 0], rotation: [0, 0, 0, 1] },
      { id: 'qa-route-b-hold', modelId: 'hold-pinch', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [1.25, 1, 0], rotation: [0, 0, 0, 1] },
    ];
    scene.boulders = [
      { id: 'qa-route-a', name: 'Voie 1', grade: '5c', color: '#f07c54', placementIds: ['qa-shared-volume', 'qa-route-a-hold'], startIds: [], finishIds: [] },
      { id: 'qa-route-b', name: 'Voie 2', grade: '6a', color: '#9175d1', placementIds: ['qa-shared-volume', 'qa-route-b-hold'], startIds: [], finishIds: [] },
    ];
    await save(actor, scene);
    await enterWorkshop(page);
    await page.getByTestId('scene-item-qa-shared-volume').click();
    await expect(page.getByTestId('route-member-qa-route-a')).toBeChecked();
    await expect(page.getByTestId('route-member-qa-route-b')).toBeChecked();
    await page.getByTestId('route-member-qa-route-a').uncheck();
    await confirmSave(page);
    const changed = await room(actor);
    expect(changed.scene.boulders.find(route => route.id === 'qa-route-a')!.placementIds).not.toContain('qa-shared-volume');
    expect(changed.scene.boulders.find(route => route.id === 'qa-route-b')!.placementIds).toContain('qa-shared-volume');
    expect(changed.scene.placements.filter(placement => placement.id === 'qa-shared-volume')).toHaveLength(1);
    await page.getByTestId('route-member-qa-route-a').check();
    await confirmSave(page);
    const canvas = page.getByTestId('editor-canvas').locator('canvas');
    const bounds = (await canvas.boundingBox())!;
    const scale = bounds.height / (2 * 11.75 * Math.tan(21 * Math.PI / 180));
    const crop = { x: Math.round(bounds.x + bounds.width / 2 - 1.8 * scale - 38), y: Math.round(bounds.y + bounds.height / 2 - 0.04 * scale - 30), width: 76, height: 60 };
    await page.getByTestId('route-visible-qa-route-a').uncheck();
    const visibleWithB = await page.screenshot({ clip: crop });
    await page.getByTestId('route-visible-qa-route-b').uncheck();
    const hidden = await page.screenshot({ clip: crop });
    expect(hidden.equals(visibleWithB), 'Le crop WebGL du volume doit changer lorsque toutes ses voies sont masquées').toBe(false);
    await page.getByTestId('route-visible-qa-route-a').check();
    const visibleWithA = await page.screenshot({ clip: crop });
    expect(visibleWithA.equals(hidden), 'La voie A doit rendre à nouveau son volume partagé visible').toBe(false);
    await testInfo.attach('Volume partagé visible', { body: visibleWithA, contentType: 'image/png' });
    await testInfo.attach('Volume masqué', { body: hidden, contentType: 'image/png' });
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('un déplacement en collision est refusé et laisse les prises séparées', async ({ page }) => {
  test.setTimeout(90_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    await save(actor, bareScene(original.scene));
    await enterWorkshop(page);
    const canvas = page.getByTestId('editor-canvas').locator('canvas');
    const bounds = (await canvas.boundingBox())!;
    await page.getByTestId('catalog-hold-jug').click();
    await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    const metre = bounds.height / (24 * Math.tan(21 * Math.PI / 180));
    await canvas.click({ position: { x: bounds.width / 2 - metre, y: bounds.height / 2 + metre } });
    await expect(page.getByTestId('placement-count')).toHaveText('2 éléments');
    await page.keyboard.press('Escape');
    await confirmSave(page);
    const before = await room(actor);
    const first = before.scene.placements[0]!;
    const second = before.scene.placements[1]!;
    await page.getByTestId('selected-position-x').fill(String(first.position[0]));
    await page.getByTestId('selected-position-x').blur();
    await page.getByTestId('selected-position-y').fill(String(first.position[1]));
    await page.getByTestId('selected-position-y').blur();
    await expect(page.getByRole('alert')).toContainText(/collision/i);
    await confirmSave(page);
    const after = await room(actor);
    expect(after.scene.placements).toHaveLength(2);
    expect(after.scene.placements[1]!.position[1]).toBeCloseTo(second.position[1], 5);
    expect(Math.abs(after.scene.placements[1]!.position[1] - first.position[1])).toBeGreaterThan(0.2);
    expect(after.inventory).toEqual(before.inventory);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('la déclaration de stock du catalogue active le modèle dans la salle et persiste après rechargement', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  let modelId: string | undefined;
  try {
    await save(actor, bareScene(original.scene));
    await enterWorkshop(page);
    await page.getByTestId('nav-catalog').click();
    await page.getByTestId('catalog-create-hold').click();
    await expect(page.getByTestId('catalog-editor')).toHaveAttribute('data-model-id', /^[0-9a-f-]{36}$/);
    modelId = (await page.getByTestId('catalog-editor').getAttribute('data-model-id'))!;
    await page.getByTestId('model-name').fill('Prise inventoriée QA');
    await page.getByTestId('model-apply').click();
    await expect(page.getByTestId('model-stock-apply')).toBeDisabled();
    await confirmSave(page);
    await page.getByTestId('model-stock-total').fill('2');
    await page.getByTestId('model-stock-total').blur();
    await expect(page.getByTestId('model-stock-apply')).toBeEnabled();
    const declared = page.waitForResponse(value => value.url().endsWith('/inventory') && value.request().method() === 'POST');
    await page.getByTestId('model-stock-apply').click();
    expect((await declared).ok()).toBeTruthy();
    const stocked = await room(actor);
    expect(stocked.inventory.find(value => value.modelId === modelId)).toMatchObject({ total: 2, available: 2, reserved: 0, installed: 0 });
    await page.getByTestId('nav-design').click();
    await expect(page.getByTestId(`catalog-${modelId}`)).toBeEnabled();
    await expect(page.getByTestId(`model-remaining-${modelId}`)).toContainText('2');
    await page.reload();
    await expect(page.getByTestId(`catalog-${modelId}`)).toBeEnabled();
    expect((await room(actor)).inventory.find(value => value.modelId === modelId)).toMatchObject({ total: 2, available: 2 });
  } finally {
    if (modelId) {
      const current = await room(actor);
      if ((current.inventory.find(value => value.modelId === modelId)?.total ?? 0) > 0) {
        const retired = await actor.api.post(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/inventory`, {
          headers: csrf(actor), data: { modelId, total: 0, expectedRevision: current.revision, requestId: crypto.randomUUID() },
        });
        expect(retired.ok(), await retired.text()).toBeTruthy();
      }
    }
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('l’historique de la salle restaure une version depuis l’interface sans modifier le stock', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = bareScene(original.scene);
    scene.placements = [{ id: 'qa-history-ui-hold', modelId: 'hold-jug', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [0, 1.5, 0], rotation: [0, 0, 0, 1] }];
    const prepared = await save(actor, scene);
    await enterWorkshop(page);
    await page.getByTestId('nav-history').click();
    await page.getByTestId('snapshot-scope').selectOption('room');
    await page.getByTestId('snapshot-label').fill('Version de contrôle UI');
    const saved = page.waitForResponse(value => value.url().endsWith('/history') && value.request().method() === 'POST');
    await page.getByTestId('snapshot-create').click();
    const snapshotResponse = await saved;
    expect(snapshotResponse.ok()).toBeTruthy();
    const snapshot = await snapshotResponse.json() as SnapshotSummary;
    expect(snapshot.sourceRevision).toBe(prepared.revision);
    await page.getByTestId('nav-design').click();
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await page.getByTestId('wall-width').fill('4.6');
    await page.getByTestId('wall-width').blur();
    await confirmSave(page);
    expect((await room(actor)).scene.walls[0]!.width).toBe(4.6);
    await page.getByTestId('nav-history').click();
    const restored = page.waitForResponse(value => value.url().endsWith(`/history/${snapshot.id}/restore`) && value.request().method() === 'POST');
    await page.getByTestId(`snapshot-restore-${snapshot.id}`).click();
    const response = await restored;
    expect(response.ok(), await response.text()).toBeTruthy();
    const after = await room(actor);
    expect(after.scene).toEqual(scene);
    expect(after.inventory).toEqual(prepared.inventory);
    expect(after.reservations).toEqual(prepared.reservations);
    await page.reload();
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await expect(page.getByTestId('wall-width')).toHaveValue('5');
    expect((await room(actor)).scene).toEqual(scene);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('consulter un champ numérique ne modifie pas une position conservée avec toute sa précision', async ({ page }) => {
  test.setTimeout(90_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = bareScene(original.scene);
    scene.placements = [{
      id: 'qa-precise-volume', modelId: 'volume-box', modelVersion: 1,
      parentType: 'wall', parentId: scene.walls[0]!.id,
      position: [0.123456, 1.654321, 0], rotation: [0, 0, 0, 1],
    }];
    const prepared = await save(actor, scene);
    await enterWorkshop(page);
    await page.getByTestId('scene-item-qa-precise-volume').click();
    await expect(page.getByTestId('scene-save')).toBeDisabled();
    await page.getByTestId('selected-position-x').focus();
    await page.getByTestId('selected-position-x').blur();
    await page.getByTestId('selected-position-y').focus();
    await page.getByTestId('selected-position-y').blur();
    await expect(page.getByTestId('scene-save')).toBeDisabled();
    const after = await room(actor);
    expect(after.revision).toBe(prepared.revision);
    expect(after.scene).toEqual(scene);
    expect(after.scene.placements[0]!.position).toEqual([0.123456, 1.654321, 0]);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});
