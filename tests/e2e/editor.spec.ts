import { test, expect, type Page } from '@playwright/test';
import { apiBase, csrf, login, password, releaseOwnReservation, room, save } from './helpers';

async function enterWorkshop(page: Page) {
  await page.goto('/');
  await page.getByLabel('Adresse e-mail').fill('alice@climbed.local');
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrer dans l’atelier' }).click();
  await expect(page.getByTestId('editor-canvas').locator('canvas')).toBeVisible();
  await page.getByTestId('view-front').click();
  await expect(page.getByTestId('view-front')).toHaveClass(/active/);
}

async function confirmSave(page: Page) {
  const saved = page.waitForResponse(value => value.url().includes('/scene') && value.request().method() === 'PUT');
  await page.getByTestId('scene-save').click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
}

test('vrais placements WebGL, rotation locale, annuler/rétablir et sauvegarde après rechargement', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  const roomId = actor.bootstrap.rooms[0]!.id;
  try {
    const scene = structuredClone(original.scene);
    scene.walls = [{ ...scene.walls[0]!, rotation: [0, 0, 0, 1], openings: [] }];
    scene.placements = [];
    scene.boulders = [];
    await save(actor, scene, roomId);
    await enterWorkshop(page);
    const canvas = page.getByTestId('editor-canvas').locator('canvas');
    const rendering = await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext('webgl2') ?? element.getContext('webgl');
      return { width: element.width, height: element.height, version: context?.getParameter(context.VERSION), lost: context?.isContextLost() };
    });
    expect(rendering.version, 'Un vrai contexte WebGL doit exister').toMatch(/WebGL/);
    expect(rendering.lost).toBe(false);
    expect(rendering.width).toBeGreaterThan(400);
    expect(rendering.height).toBeGreaterThan(300);
    const bounds = await canvas.boundingBox();
    expect(bounds).toBeTruthy();
    await page.getByTestId('catalog-hold-jug').click();
    await expect(page.getByTestId('catalog-hold-jug')).toHaveAttribute('aria-pressed', 'true');
    // The front camera faces a real wall at the canvas centre. These clicks go through WebGL picking.
    await canvas.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
    await expect(page.getByTestId('placement-count')).toHaveText(/1/);
    await canvas.click({ position: { x: bounds!.width / 2 - 65, y: bounds!.height / 2 + 65 } });
    await expect(page.getByTestId('placement-count')).toHaveText(/2/);
    await page.keyboard.press('Escape');
    await page.getByTestId('selected-rotation').fill('35');
    await page.getByTestId('selected-rotation').blur();
    await page.getByTestId('scene-undo').click();
    await expect(page.getByTestId('selected-rotation')).toHaveValue('0');
    await page.getByTestId('scene-redo').click();
    await expect(page.getByTestId('selected-rotation')).toHaveValue('35');
    await confirmSave(page);
    const persisted = await room(actor, roomId);
    expect(persisted.scene.placements).toHaveLength(2);
    expect(persisted.scene.placements.every(value => value.parentType === 'wall' && value.parentId === scene.walls[0]!.id)).toBeTruthy();
    const rotated = persisted.scene.placements[1]!;
    expect(rotated.rotation[2]).toBeCloseTo(Math.sin(35 * Math.PI / 360), 4);
    expect(rotated.rotation[3]).toBeCloseTo(Math.cos(35 * Math.PI / 360), 4);
    expect(Math.abs(rotated.position[2])).toBeLessThan(0.01);
    await page.reload();
    await expect(page.getByTestId('placement-count')).toHaveText(/2/);
    await page.getByTestId('view-front').click();
    await canvas.screenshot({ path: testInfo.outputPath('atelier-webgl.png') });
    await testInfo.attach('Atelier rendu en WebGL', { path: testInfo.outputPath('atelier-webgl.png'), contentType: 'image/png' });
    expect((await room(actor, roomId)).scene).toEqual(persisted.scene);
    await page.getByTestId('wall-add').click();
    await page.getByTestId('wall-width').fill('2.4');
    await page.getByTestId('wall-width').blur();
    await page.getByTestId('wall-height').fill('3.2');
    await page.getByTestId('wall-height').blur();
    await page.getByTestId('wall-inclination').fill('20');
    await page.getByTestId('wall-inclination').blur();
    await confirmSave(page);
    const expanded = await room(actor, roomId);
    expect(expanded.scene.walls).toHaveLength(2);
    expect(expanded.scene.walls[1]!.width).toBe(2.4);
    expect(expanded.scene.walls[1]!.height).toBe(3.2);
    expect(Math.abs(expanded.scene.walls[1]!.rotation[0])).toBeCloseTo(Math.sin(20 * Math.PI / 360), 4);
  } finally {
    await save(actor, original.scene, roomId);
    await actor.api.dispose();
  }
});

test('une prise sur un volume reste attachée lorsque le support est déplacé', async ({ page }) => {
  test.setTimeout(90_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  const roomId = actor.bootstrap.rooms[0]!.id;
  try {
    const scene = structuredClone(original.scene);
    scene.walls = [{ ...scene.walls[0]!, rotation: [0, 0, 0, 1], openings: [] }];
    scene.placements = [];
    scene.boulders = [];
    await save(actor, scene, roomId);
    await enterWorkshop(page);
    const canvas = page.getByTestId('editor-canvas').locator('canvas');
    const bounds = (await canvas.boundingBox())!;
    const point = { x: bounds.width / 2 - 65, y: bounds.height / 2 };
    await page.getByRole('button', { name: 'Volumes', exact: true }).click();
    await page.getByTestId('catalog-volume-box').click();
    await expect(page.getByTestId('catalog-volume-box')).toHaveAttribute('aria-pressed', 'true');
    await canvas.click({ position: point });
    await expect(page.getByTestId('placement-count')).toHaveText(/1/);
    await page.getByRole('button', { name: 'Prises', exact: true }).click();
    await page.getByTestId('catalog-hold-jug').click();
    await canvas.click({ position: point });
    await expect(page.getByTestId('placement-count')).toHaveText(/2/);
    await page.keyboard.press('Escape');
    await confirmSave(page);
    const before = await room(actor, roomId);
    const volume = before.scene.placements.find(value => value.modelId === 'volume-box')!;
    const child = before.scene.placements.find(value => value.parentId === volume.id)!;
    expect(child, 'Le picking doit rattacher la prise au volume et non au mur situé derrière').toBeTruthy();
    expect(child.parentType).toBe('volume');
    await page.getByTestId(`scene-item-${volume.id}`).click();
    const changedX = Number((volume.position[0] + 0.4).toFixed(3));
    await page.getByTestId('selected-position-x').fill(String(changedX));
    await page.getByTestId('selected-position-x').blur();
    await confirmSave(page);
    const after = await room(actor, roomId);
    expect(after.scene.placements.find(value => value.id === volume.id)!.position[0]).toBeCloseTo(changedX, 3);
    expect(after.scene.placements.find(value => value.id === child.id)).toEqual(child);
    await page.reload();
    await expect(page.getByTestId('placement-count')).toHaveText(/2/);
  } finally {
    await save(actor, original.scene, roomId);
    await actor.api.dispose();
  }
});

test('une action de stock ne permet pas d’écraser une sauvegarde concurrente du projet', async ({ page }) => {
  test.setTimeout(90_000);
  const actor = await login('alice@climbed.local');
  const roomId = actor.bootstrap.rooms[0]!.id;
  const original = await room(actor, roomId);
  let reservationId: string | undefined;
  try {
    const scene = structuredClone(original.scene);
    scene.walls = [{ ...scene.walls[0]!, rotation: [0, 0, 0, 1], openings: [] }];
    scene.placements = [{ id: 'e2e-stale-piece', modelId: 'hold-jug', modelVersion: 1,
      parentType: 'wall', parentId: scene.walls[0]!.id, position: [0, 1.5, 0], rotation: [0, 0, 0, 1] }];
    scene.boulders = [];
    const prepared = await save(actor, scene, roomId);
    const reserved = await actor.api.post(`${apiBase}/rooms/${roomId}/reservations`, {
      headers: csrf(actor), data: { sceneRevision: prepared.revision, requestId: crypto.randomUUID() },
    });
    expect(reserved.ok(), await reserved.text()).toBeTruthy();
    reservationId = (await room(actor, roomId)).reservations.find(value => !original.reservations.some(previous => previous.id === value.id))!.id;
    await enterWorkshop(page);

    const remoteScene = structuredClone(prepared.scene);
    remoteScene.name = 'Projet modifié à distance par un autre ouvreur';
    const remote = await save(actor, remoteScene, roomId);
    await page.getByRole('button', { name: 'Stock & suivi', exact: true }).click();
    const withdrew = page.waitForResponse(value => value.url().endsWith(`/reservations/${reservationId}/actions`) && value.request().method() === 'POST');
    await page.getByRole('button', { name: 'Pièces récupérées', exact: true }).click();
    expect((await withdrew).ok()).toBeTruthy();
    expect((await room(actor, roomId)).reservations.find(value => value.id === reservationId)?.state).toBe('taken');

    await page.getByRole('button', { name: 'Propriétés', exact: true }).click();
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await page.getByTestId('wall-width').fill('4.5');
    await page.getByTestId('wall-width').blur();
    const rejected = page.waitForResponse(value => value.url().endsWith('/scene') && value.request().method() === 'PUT');
    await page.getByTestId('scene-save').click();
    expect((await rejected).status()).toBe(409);
    await expect(page.getByRole('alert')).toContainText('Le plan a changé');
    const retained = await room(actor, roomId);
    expect(retained.revision).toBe(remote.revision);
    expect(retained.scene).toEqual(remoteScene);
    await expect(page.getByTestId('wall-width')).toHaveValue('4.5');
  } finally {
    if (reservationId) await releaseOwnReservation(actor, roomId, reservationId);
    await save(actor, original.scene, roomId);
    await actor.api.dispose();
  }
});
