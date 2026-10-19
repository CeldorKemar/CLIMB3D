import { test, expect } from '@playwright/test';
import type { SceneDocument, SnapshotSummary } from '../../packages/contracts/src/index';
import { apiBase, csrf, login, room, save, type Actor } from './helpers';

function emptyScene(source: SceneDocument): SceneDocument {
  const scene = structuredClone(source);
  scene.walls = [{ ...scene.walls[0]!, width: 5, height: 4, position: [0, 0, 0], rotation: [0, 0, 0, 1], openings: [] }];
  scene.placements = [];
  scene.boulders = [];
  return scene;
}

function place(scene: SceneDocument, id: string, modelId: string, x: number, y: number) {
  scene.placements.push({ id, modelId, modelVersion: 1, parentType: 'wall', parentId: scene.walls[0]!.id, position: [x, y, 0], rotation: [0, 0, 0, 1] });
}

async function snapshot(actor: Actor, kind: 'room' | 'boulder', boulderId?: string): Promise<SnapshotSummary> {
  const state = await room(actor);
  const response = await actor.api.post(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/history`, {
    headers: csrf(actor), data: { kind, label: `QA ${kind}`, boulderId, expectedRevision: state.revision, requestId: crypto.randomUUID() },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return await response.json() as SnapshotSummary;
}

async function restore(actor: Actor, snapshotId: string, revision: number, roomId = actor.bootstrap.rooms[0]!.id) {
  return actor.api.post(`${apiBase}/rooms/${roomId}/history/${snapshotId}/restore`, {
    headers: csrf(actor), data: { expectedRevision: revision, requestId: crypto.randomUUID() },
  });
}

test('une scène en collision est refusée par l’API sans effet partiel', async () => {
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = emptyScene(original.scene);
    place(scene, 'qa-collision-a', 'hold-jug', 0, 1.5);
    const before = await save(actor, scene);
    place(scene, 'qa-collision-b', 'hold-jug', 0, 1.5);
    const refused = await actor.api.put(`${apiBase}/rooms/${actor.bootstrap.rooms[0]!.id}/scene`, {
      headers: csrf(actor), data: { scene, expectedRevision: before.revision },
    });
    expect(refused.status()).toBe(400);
    expect(await refused.text()).toMatch(/collision/i);
    const after = await room(actor);
    expect(after.revision).toBe(before.revision);
    expect(after.scene).toEqual(before.scene);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.reservations).toEqual(before.reservations);
    expect(after.audit).toEqual(before.audit);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('restaurer une salle recrée sa conception sans réserver de matériel', async () => {
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = emptyScene(original.scene);
    scene.name = 'Salle sauvegardée QA';
    place(scene, 'qa-room-saved', 'hold-jug', 0, 1.5);
    const prepared = await save(actor, scene);
    const saved = await snapshot(actor, 'room');
    expect(saved.sourceRevision).toBe(prepared.revision);
    const modified = emptyScene(scene);
    modified.name = 'Salle modifiée QA';
    modified.walls[0]!.width = 5.5;
    const before = await save(actor, modified);
    const response = await restore(actor, saved.id, before.revision);
    expect(response.ok(), await response.text()).toBeTruthy();
    const after = await room(actor);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.scene).toEqual(scene);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.reservations).toEqual(before.reservations);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('restaurer une voie conserve une autre voie et leur volume partagé en un seul exemplaire', async () => {
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = emptyScene(original.scene);
    place(scene, 'qa-shared', 'volume-box', -1, 2);
    place(scene, 'qa-saved-hold', 'hold-crimp', -1, 1);
    scene.boulders = [{ id: 'qa-saved-route', name: 'Voie sauvegardée', grade: '5c', color: '#f07c54', placementIds: ['qa-shared', 'qa-saved-hold'], startIds: ['qa-saved-hold'], finishIds: [] }];
    await save(actor, scene);
    const saved = await snapshot(actor, 'boulder', 'qa-saved-route');
    const current = structuredClone(scene);
    current.placements = current.placements.filter(value => value.id !== 'qa-saved-hold');
    place(current, 'qa-other-hold', 'hold-pinch', 1, 1);
    current.boulders = [{ id: 'qa-other-route', name: 'Autre voie', grade: '6a', color: '#9175d1', placementIds: ['qa-shared', 'qa-other-hold'], startIds: [], finishIds: ['qa-other-hold'] }];
    const before = await save(actor, current);
    const response = await restore(actor, saved.id, before.revision);
    expect(response.ok(), await response.text()).toBeTruthy();
    const after = await room(actor);
    expect(after.scene.boulders.find(value => value.id === 'qa-saved-route')).toEqual(scene.boulders[0]);
    expect(after.scene.boulders.find(value => value.id === 'qa-other-route')).toEqual(current.boulders[0]);
    expect(after.scene.placements.filter(value => value.id === 'qa-shared')).toHaveLength(1);
    expect(after.scene.placements.find(value => value.id === 'qa-other-hold')).toEqual(current.placements.find(value => value.id === 'qa-other-hold'));
    expect(after.inventory).toEqual(before.inventory);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('restaurer une voie qui chevauche une pièce existante est refusé sans changement de stock', async () => {
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const scene = emptyScene(original.scene);
    place(scene, 'qa-restore-old', 'hold-jug', 0, 1.5);
    scene.boulders = [{ id: 'qa-restore-route', name: 'Voie ancienne', grade: '', color: '#f07c54', placementIds: ['qa-restore-old'], startIds: [], finishIds: [] }];
    await save(actor, scene);
    const saved = await snapshot(actor, 'boulder', 'qa-restore-route');
    const current = emptyScene(scene);
    place(current, 'qa-existing', 'hold-jug', 0, 1.5);
    current.boulders = [{ id: 'qa-existing-route', name: 'Voie existante', grade: '', color: '#f07c54', placementIds: ['qa-existing'], startIds: [], finishIds: [] }];
    const before = await save(actor, current);
    const response = await restore(actor, saved.id, before.revision);
    expect(response.status()).toBe(409);
    expect(await response.text()).toMatch(/collision/i);
    const after = await room(actor);
    expect(after.revision).toBe(before.revision);
    expect(after.scene).toEqual(current);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.audit).toEqual(before.audit);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('une conception théorique peut être sauvegardée mais sa restauration refuse un stock insuffisant', async () => {
  const actor = await login('alice@climbed.local');
  const original = await room(actor);
  try {
    const stock = original.inventory.find(value => value.modelId === 'hold-jug')!;
    expect(stock.available, 'Fixture : 12 bacs disponibles').toBe(12);
    const scene = emptyScene(original.scene);
    for (let index = 0; index < 13; index++) place(scene, `qa-shortage-${index}`, 'hold-jug', -2 + index % 5, 0.6 + Math.floor(index / 5));
    await save(actor, scene);
    const saved = await snapshot(actor, 'room');
    const before = await save(actor, emptyScene(scene));
    const response = await restore(actor, saved.id, before.revision);
    expect(response.status()).toBe(409);
    expect(await response.text()).toMatch(/stock|insuffisant/i);
    const after = await room(actor);
    expect(after.revision).toBe(before.revision);
    expect(after.scene).toEqual(before.scene);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.audit).toEqual(before.audit);
  } finally {
    await save(actor, original.scene);
    await actor.api.dispose();
  }
});

test('historique et restauration contrôlent client, salle et révision attendue', async () => {
  const alice = await login('alice@climbed.local');
  const clara = await login('clara@climbed.local');
  const original = await room(alice);
  const roomId = alice.bootstrap.rooms[0]!.id;
  try {
    await save(alice, emptyScene(original.scene));
    const saved = await snapshot(alice, 'room');
    const before = await room(alice);
    const modified = structuredClone(before.scene);
    modified.name = 'Édition concurrente conservée';
    const current = await save(alice, modified);
    const foreignHistory = await clara.api.get(`${apiBase}/rooms/${roomId}/history`);
    expect(foreignHistory.status()).toBe(404);
    expect((await restore(clara, saved.id, current.revision, roomId)).status()).toBe(404);
    const claraRoom = await room(clara);
    expect((await restore(clara, saved.id, claraRoom.revision)).status()).toBe(404);
    expect((await restore(alice, saved.id, before.revision)).status()).toBe(409);
    const after = await room(alice);
    expect(after.revision).toBe(current.revision);
    expect(after.scene).toEqual(modified);
    expect(after.inventory).toEqual(current.inventory);
    expect(after.audit).toEqual(current.audit);
  } finally {
    await save(alice, original.scene);
    await Promise.all([alice.api.dispose(), clara.api.dispose()]);
  }
});
