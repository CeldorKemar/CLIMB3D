import { test, expect, type Page } from '@playwright/test';
import type { SceneDocument } from '../../packages/contracts/src/index';
import { apiBase, csrf, confirmSave, enterWorkshop, login, room, save, type Actor } from './helpers';

function emptyRoom(source: SceneDocument): SceneDocument {
  const scene = structuredClone(source);
  scene.walls = [{ ...scene.walls[0]!, width: 5, height: 4, position: [0, 0, 0], rotation: [0, 0, 0, 1], openings: [] }];
  scene.placements = [];
  scene.boulders = [];
  return scene;
}

function supportedScene(source: SceneDocument): SceneDocument {
  const scene = emptyRoom(source);
  scene.placements = [
    { id: 'qa-shortcut-volume', modelId: 'volume-box', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [0, 1.5, 0], rotation: [0, 0, 0, 1] },
    { id: 'qa-shortcut-child', modelId: 'hold-jug', modelVersion: 1, parentType: 'volume', parentId: 'qa-shortcut-volume', position: [0, 0, 0.25], rotation: [0, 0, 0, 1] },
  ];
  scene.boulders = [
    { id: 'qa-shortcut-route-a', name: 'Voie raccourci A', grade: '5c', color: '#f07c54', placementIds: ['qa-shortcut-volume', 'qa-shortcut-child'], startIds: ['qa-shortcut-child'], finishIds: ['qa-shortcut-child'] },
    { id: 'qa-shortcut-route-b', name: 'Voie raccourci B', grade: '6a', color: '#9175d1', placementIds: ['qa-shortcut-child'], startIds: ['qa-shortcut-child'], finishIds: ['qa-shortcut-child'] },
  ];
  return scene;
}

async function focusWorkspace(page: Page) {
  await page.getByTestId('keyboard-workspace').focus();
}

async function declareStock(actor: Actor, modelId: string, total: number) {
  const current = await room(actor);
  const response = await actor.api.post(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/inventory`, {
    headers: csrf(actor), data: { modelId, total, expectedRevision: current.revision, requestId: crypto.randomUUID() },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

// These scenarios reuse the authenticated HTTP session. Existing scenarios retain
// real form logins; extending the suite must not hit the intentional login limit.
test('le catalogue central filtre prises et volumes, recherche forme code couleur et taille, avec une seule entrée de navigation', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    await save(actor, emptyRoom(original.scene));
    await enterWorkshop(page, { reuseSession: true });
    await expect(page.getByTestId('nav-catalog')).toHaveCount(1);
    await expect(page.locator('.library-panel').getByRole('button', { name: /éditeur|modifier|créer.*modèle/i })).toHaveCount(0);
    await page.getByTestId('nav-catalog').click();
    await expect(page.getByTestId('catalog-tab-hold')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('catalog-edit-hold-jug')).toBeVisible();
    await expect(page.getByTestId('catalog-edit-volume-box')).toHaveCount(0);
    await page.getByTestId('catalog-search').fill('reglette #a5c94d 20cm');
    await expect(page.getByTestId('catalog-edit-hold-crimp')).toBeVisible();
    await expect(page.locator('#catalog-filtered-list button')).toHaveCount(1);
    await page.getByTestId('catalog-search').fill('absent-qa-aucun-modele');
    await expect(page.locator('#catalog-filtered-list button')).toHaveCount(0);
    await expect(page.locator('#catalog-filtered-list')).toContainText('ne correspond');
    await page.getByTestId('catalog-search').fill('');
    await page.getByTestId('catalog-tab-volume').click();
    await expect(page.getByTestId('catalog-tab-volume')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('catalog-edit-hold-jug')).toHaveCount(0);
    await page.getByTestId('catalog-search').fill('boite #657d75 75cm');
    await expect(page.getByTestId('catalog-edit-volume-box')).toBeVisible();
    await expect(page.locator('#catalog-filtered-list button')).toHaveCount(1);
    await page.getByTestId('catalog-search').fill('');
    await page.getByTestId('catalog-tab-volume').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('catalog-tab-hold')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('catalog-back').click();
    await expect(page.getByTestId('editor-canvas')).toBeVisible();
    await expect(page.getByTestId('scene-save')).toBeDisabled();
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('Suppr efface le pan et ses descendants, nettoie les voies, et Ctrl Z restitue la scène', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = supportedScene(original.scene);
    scene.walls.push({ ...structuredClone(scene.walls[0]!), id: 'qa-shortcut-other-wall', name: 'Pan conservé', position: [6, 0, 0] });
    await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await focusWorkspace(page);
    await page.keyboard.press('Delete');
    await expect(page.getByTestId(`scene-item-${scene.walls[0]!.id}`)).toHaveCount(0);
    await expect(page.getByTestId('placement-count')).toHaveText('0 éléments');
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId(`scene-item-${scene.walls[0]!.id}`)).toBeVisible();
    await expect(page.getByTestId('placement-count')).toHaveText('2 éléments');
    await expect(page.getByTestId('scene-save')).toBeDisabled();
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await focusWorkspace(page);
    await page.keyboard.press('Delete');
    await confirmSave(page);
    const after = (await room(actor)).scene;
    expect(after.walls.map(wall => wall.id)).toEqual(['qa-shortcut-other-wall']);
    expect(after.placements).toEqual([]);
    for (const route of after.boulders) {
      expect(route.placementIds).toEqual([]);
      expect(route.startIds).toEqual([]);
      expect(route.finishIds).toEqual([]);
    }
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('Retour arrière protège le dernier pan et conserve ses prises, volumes et associations', async ({ page }) => {
  test.setTimeout(90_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = supportedScene(original.scene);
    const prepared = await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await focusWorkspace(page);
    await page.keyboard.press('Backspace');
    await expect(page.getByRole('alert')).toContainText('au moins un pan');
    await expect(page.getByTestId('placement-count')).toHaveText('2 éléments');
    await expect(page.getByTestId(`scene-item-${scene.walls[0]!.id}`)).toBeVisible();
    await expect(page.getByTestId('scene-save')).toBeDisabled();
    expect((await room(actor)).revision).toBe(prepared.revision);
    expect((await room(actor)).scene).toEqual(scene);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('Ctrl C V puis Ctrl D copient les supports et voies avec de nouveaux identifiants, et refusent la quatrième copie sans stock', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  const models = ['volume-box', 'hold-jug'];
  try {
    const scene = supportedScene(original.scene);
    await save(actor, scene);
    for (const modelId of models) await declareStock(actor, modelId, 3);
    await enterWorkshop(page, { reuseSession: true });
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    await focusWorkspace(page);
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await expect(page.getByTestId('placement-count')).toHaveText('4 éléments');
    await page.keyboard.press('Control+d');
    await expect(page.getByTestId('placement-count')).toHaveText('6 éléments');
    await page.keyboard.press('Control+d');
    await expect(page.getByRole('alert')).toContainText(/stock insuffisant/i);
    await expect(page.getByTestId('placement-count')).toHaveText('6 éléments');
    await expect(page.locator('.wall-tree button')).toHaveCount(3);
    await confirmSave(page);
    const after = (await room(actor)).scene;
    expect(after.walls).toHaveLength(3);
    expect(after.placements).toHaveLength(6);
    expect(new Set([...after.walls, ...after.placements].map(item => item.id)).size).toBe(9);
    expect(after.walls.find(wall => wall.id === scene.walls[0]!.id)).toEqual(scene.walls[0]);
    for (const source of scene.placements) expect(after.placements.find(item => item.id === source.id)).toEqual(source);
    for (const wall of after.walls) {
      const roots = after.placements.filter(item => item.parentType === 'wall' && item.parentId === wall.id);
      expect(roots).toHaveLength(1);
      const child = after.placements.find(item => item.parentType === 'volume' && item.parentId === roots[0]!.id)!;
      expect(child).toBeTruthy();
      expect(child.position).toEqual([0, 0, 0.25]);
      expect(after.boulders[0]!.placementIds).toEqual(expect.arrayContaining([roots[0]!.id, child.id]));
      expect(after.boulders[0]!.startIds).toContain(child.id);
      expect(after.boulders[0]!.finishIds).toContain(child.id);
      expect(after.boulders[1]!.placementIds).toContain(child.id);
    }
    expect(after.boulders[0]!.placementIds).toHaveLength(6);
    expect(after.boulders[1]!.placementIds).toHaveLength(3);
    expect(after.walls.map(wall => wall.position[0])).toEqual([0, 5.3, 10.6]);
    expect((await room(actor)).inventory.filter(item => models.includes(item.modelId)).every(item => item.total === 3)).toBe(true);
  } finally {
    await save(actor, original.scene);
    for (const modelId of models) await declareStock(actor, modelId, original.inventory.find(item => item.modelId === modelId)?.total ?? 0);
    await actor.api.dispose();
  }
});

test('les raccourcis natifs restent dans les champs et contentEditable sans supprimer ni copier le pan sélectionné', async ({ page }) => {
  test.setTimeout(90_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = emptyRoom(original.scene);
    await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    await page.getByTestId(`scene-item-${scene.walls[0]!.id}`).click();
    const search = page.getByLabel('Rechercher un modèle', { exact: true });
    await search.fill('texte');
    await search.press('Control+a');
    await search.press('Control+c');
    await search.press('End');
    await search.press('Control+v');
    await expect(search).toHaveValue('textetexte');
    await search.press('Control+a');
    await search.press('Delete');
    await expect(search).toHaveValue('');
    // A nested editable child exercises closest()/isContentEditable handling.
    await page.evaluate(() => {
      const editable = document.createElement('div');
      editable.contentEditable = 'true';
      editable.setAttribute('role', 'textbox');
      editable.setAttribute('aria-label', 'Édition enrichie QA');
      editable.innerHTML = '<span>texte</span>';
      Object.assign(editable.style, { position: 'fixed', top: '90px', left: '400px', width: '240px', height: '40px', zIndex: '9999', background: 'white' });
      document.body.append(editable);
    });
    const editable = page.getByRole('textbox', { name: 'Édition enrichie QA' });
    await editable.locator('span').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('End');
    await page.keyboard.press('Control+v');
    await expect(editable).toHaveText('textetexte');
    await page.keyboard.press('Backspace');
    await expect(editable).toHaveText('textetext');
    await expect(page.locator('.wall-tree button')).toHaveCount(1);
    await expect(page.getByTestId('scene-save')).toBeDisabled();
    expect((await room(actor)).scene).toEqual(scene);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('le mur composé expose la limite de 100 pans localement et ajoute zéro segment en cas de dépassement', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = emptyRoom(original.scene);
    scene.walls = Array.from({ length: 99 }, (_, index) => ({ ...structuredClone(scene.walls[0]!), id: `qa-limit-wall-${index}`, name: `Pan limite ${index + 1}`, position: [index * 6, 0, 0] }));
    const prepared = await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    await page.getByTestId('wall-chain-open').click();
    await page.getByTestId('chain-apply').click();
    const problems = page.getByTestId('chain-problems');
    await expect(problems).toBeVisible();
    await expect(problems).toContainText('100');
    await expect(problems).toContainText(/pan/i);
    await expect(problems).not.toContainText(/Array must|too_big|walls :/);
    await expect(problems).toBeFocused();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer le mur composé' }).click();
    await expect(page.locator('.wall-tree button')).toHaveCount(99);
    await expect(page.getByTestId('scene-save')).toBeDisabled();
    const after = await room(actor);
    expect(after.revision).toBe(prepared.revision);
    expect(after.scene).toEqual(scene);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('le mur composé détaille chaque collision distincte dans sa fenêtre et conserve tous les éléments existants', async ({ page }) => {
  test.setTimeout(120_000);
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = emptyRoom(original.scene);
    scene.placements = [
      { id: 'qa-chain-collision-left', modelId: 'hold-jug', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [-0.8, 0.5, 0], rotation: [0, 0, 0, 1] },
      { id: 'qa-chain-collision-right', modelId: 'hold-crimp', modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [0.8, 0.5, 0], rotation: [0, 0, 0, 1] },
    ];
    const prepared = await save(actor, scene);
    await enterWorkshop(page, { reuseSession: true });
    await page.getByTestId('wall-chain-open').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Origine X', { exact: true }).fill('0');
    await dialog.getByLabel('Origine Y', { exact: true }).fill('0');
    await dialog.getByLabel('Origine Z', { exact: true }).fill('0.05');
    await page.getByTestId('chain-angle-1').fill('0');
    await page.getByTestId('chain-apply').click();
    const problems = page.getByTestId('chain-problems');
    await expect(problems).toBeVisible();
    await expect(problems.locator('li')).toHaveCount(2);
    await expect(problems).toContainText('Bac confort');
    await expect(problems).toContainText('Réglette');
    await expect(problems).toContainText('Mur composé 1');
    await expect(problems).not.toContainText('qa-chain-collision-');
    await expect(problems.locator('li').nth(0)).toContainText(/collision/i);
    await expect(problems.locator('li').nth(1)).toContainText(/collision/i);
    await page.getByRole('button', { name: 'Fermer le mur composé' }).click();
    await expect(page.locator('.wall-tree button')).toHaveCount(1);
    await expect(page.getByTestId('placement-count')).toHaveText('2 éléments');
    await expect(page.getByTestId('scene-save')).toBeDisabled();
    const after = await room(actor);
    expect(after.revision).toBe(prepared.revision);
    expect(after.scene).toEqual(scene);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});
