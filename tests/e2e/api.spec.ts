import { test, expect } from '@playwright/test';
import type { SceneDocument } from '../../packages/contracts/src/index';
import { action, apiBase, csrf, login, releaseOwnReservation, room, save, type Actor } from './helpers';

test.describe('API : cloisonnement et matériel réel', () => {
  test('sessions, isolation client/salle, CSRF et sauvegarde périmée', async () => {
    const alice = await login('alice@climbed.local');
    const bob = await login('bob@climbed.local');
    const clara = await login('clara@climbed.local');
    try {
      const session = await alice.api.get(`${apiBase}/auth/session`);
      expect(session.status()).toBe(200);
      expect((await session.json()).user.email).toBe('alice@climbed.local');
      const sharedId = bob.bootstrap.rooms[0]!.id;
      expect(alice.bootstrap.rooms.some(value => value.id === sharedId)).toBeTruthy();
      expect((await alice.api.get(`${apiBase}/rooms/${sharedId}`)).status()).toBe(200);
      const restrictedRoom = alice.bootstrap.rooms.find(value => !bob.bootstrap.rooms.some(allowed => allowed.id === value.id));
      expect(restrictedRoom, 'La fixture doit inclure une deuxième salle Alpine inaccessible à Bob').toBeTruthy();
      expect([403, 404]).toContain((await bob.api.get(`${apiBase}/rooms/${restrictedRoom!.id}`)).status());
      const otherId = clara.bootstrap.rooms[0]!.id;
      expect([403, 404]).toContain((await alice.api.get(`${apiBase}/rooms/${otherId}`)).status());
      expect([403, 404]).toContain((await clara.api.get(`${apiBase}/rooms/${sharedId}`)).status());

      const before = await room(alice, sharedId);
      const deniedCsrf = await alice.api.put(`${apiBase}/rooms/${sharedId}/scene`, {
        data: { scene: before.scene, expectedRevision: before.revision },
      });
      expect(deniedCsrf.status()).toBe(403);
      expect((await room(alice, sharedId)).revision).toBe(before.revision);
      const current = await save(alice, before.scene, sharedId);
      const stale = await alice.api.put(`${apiBase}/rooms/${sharedId}/scene`, {
        headers: csrf(alice), data: { scene: before.scene, expectedRevision: before.revision },
      });
      expect(stale.status()).toBe(409);
      const after = await room(alice, sharedId);
      expect(after.revision).toBe(current.revision);
      expect(after.scene).toEqual(before.scene);
      expect(after.inventory).toEqual(before.inventory);
    } finally {
      await Promise.all([alice.api.dispose(), bob.api.dispose(), clara.api.dispose()]);
    }
  });

  test('le dernier exemplaire ne peut être réservé deux fois, les répétitions sont idempotentes', async () => {
    const alice = await login('alice@climbed.local');
    const bob = await login('bob@climbed.local');
    const roomId = bob.bootstrap.rooms[0]!.id;
    const original = await room(alice, roomId);
    const created = new Set<string>();
    let winningActor: Actor | undefined;
    try {
      const scarce = original.inventory.find(value => value.available === 1);
      expect(scarce, 'La fixture doit fournir un modèle possédant un seul exemplaire disponible').toBeTruthy();
      const model = original.scene.models.find(value => value.id === scarce!.modelId)!;
      expect(model).toBeTruthy();
      const scene: SceneDocument = structuredClone(original.scene);
      expect(scene.walls.length).toBeGreaterThanOrEqual(2);
      scene.placements = scene.walls.slice(0, 2).map((wall, index) => ({
        id: `e2e-last-item-${index}`, modelId: model.id, modelVersion: model.version,
        parentType: 'wall', parentId: wall.id, position: [0, 1.5, 0], rotation: [0, 0, 0, 1],
      }));
      scene.boulders = [];
      const prepared = await save(alice, scene, roomId);
      const aliceKey = crypto.randomUUID();
      const bobKey = crypto.randomUUID();
      const results = await Promise.all([
        alice.api.post(`${apiBase}/rooms/${roomId}/reservations`, { headers: csrf(alice), data: { sceneRevision: prepared.revision, requestId: aliceKey, wallIds: [scene.walls[0]!.id] } }),
        bob.api.post(`${apiBase}/rooms/${roomId}/reservations`, { headers: csrf(bob), data: { sceneRevision: prepared.revision, requestId: bobKey, wallIds: [scene.walls[1]!.id] } }),
      ]);
      const allocated = await room(alice, roomId);
      const newReservations = allocated.reservations.filter(value => !original.reservations.some(previous => previous.id === value.id));
      newReservations.forEach(value => created.add(value.id));
      expect(results.filter(value => value.ok())).toHaveLength(1);
      expect(results.filter(value => value.status() === 409)).toHaveLength(1);
      const refused = results.find(value => value.status() === 409)!;
      expect((await refused.json()).message, 'Le conflit doit concerner le stock partagé, pas le chevauchement des pans').toMatch(/stock.*insuffisant/i);
      expect(newReservations).toHaveLength(1);
      const inventory = allocated.inventory.find(value => value.modelId === scarce!.modelId)!;
      expect(inventory.available).toBe(0);
      expect(inventory.reserved).toBe(1);
      expect(inventory.total).toBe(scarce!.total);
      expect(allocated.inventory.filter(value => value.modelId !== scarce!.modelId)).toEqual(original.inventory.filter(value => value.modelId !== scarce!.modelId));
      const winnerIndex = results.findIndex(value => value.ok());
      winningActor = winnerIndex === 0 ? alice : bob;
      const replay = await winningActor.api.post(`${apiBase}/rooms/${roomId}/reservations`, {
        headers: csrf(winningActor), data: { sceneRevision: prepared.revision, requestId: winnerIndex === 0 ? aliceKey : bobKey, wallIds: [scene.walls[winnerIndex]!.id] },
      });
      expect(replay.ok(), await replay.text()).toBeTruthy();
      const replayed = await room(alice, roomId);
      expect(replayed.reservations.filter(value => created.has(value.id))).toHaveLength(1);
      expect(replayed.inventory).toEqual(allocated.inventory);
    } finally {
      // Only reservations created by this test are compensated; no global database reset.
      for (const id of created) await releaseOwnReservation(winningActor ?? alice, roomId, id);
      await save(alice, original.scene, roomId);
      await Promise.all([alice.api.dispose(), bob.api.dispose()]);
    }
  });

  test('deux ouvreurs réservent simultanément deux pans distincts lorsque leurs pièces sont disponibles', async () => {
    const alice = await login('alice@climbed.local');
    const bob = await login('bob@climbed.local');
    const roomId = bob.bootstrap.rooms[0]!.id;
    const original = await room(alice, roomId);
    const created: { id: string; actor: Actor }[] = [];
    try {
      const candidates = original.inventory.filter(value => value.available > 0).slice(0, 2);
      expect(candidates).toHaveLength(2);
      const scene = structuredClone(original.scene);
      expect(scene.walls.length).toBeGreaterThanOrEqual(2);
      scene.placements = candidates.map((item, index) => ({
        id: `e2e-independent-${index}`, modelId: item.modelId, modelVersion: 1,
        parentType: 'wall', parentId: scene.walls[index]!.id,
        position: [0, 1.5, 0], rotation: [0, 0, 0, 1],
      }));
      scene.boulders = [];
      const prepared = await save(alice, scene, roomId);
      const actors = [alice, bob];
      const results = await Promise.all(actors.map((actor, index) => actor.api.post(`${apiBase}/rooms/${roomId}/reservations`, {
        headers: csrf(actor), data: { sceneRevision: prepared.revision, requestId: crypto.randomUUID(), wallIds: [scene.walls[index]!.id] },
      })));
      const reserved = await room(alice, roomId);
      reserved.reservations.filter(value => !original.reservations.some(previous => previous.id === value.id)).forEach(value => {
        created.push({ id: value.id, actor: value.actorName === bob.bootstrap.user.name ? bob : alice });
      });
      for (const response of results) expect(response.ok(), await response.text()).toBeTruthy();
      expect(created).toHaveLength(2);
      for (const candidate of candidates) {
        const count = reserved.inventory.find(value => value.modelId === candidate.modelId)!;
        expect(count.available).toBe(candidate.available - 1);
        expect(count.reserved).toBe(1);
      }
    } finally {
      for (const value of created) await releaseOwnReservation(value.actor, roomId, value.id);
      await save(alice, original.scene, roomId);
      await Promise.all([alice.api.dispose(), bob.api.dispose()]);
    }
  });

  for (const path of ['annulation après retrait', 'installation puis démontage'] as const) {
  test(`${path} : les pièces restent indisponibles jusqu’au retour confirmé`, async () => {
    const alice = await login('alice@climbed.local');
    const roomId = alice.bootstrap.rooms[0]!.id;
    const original = await room(alice, roomId);
    let reservationId: string | undefined;
    try {
      const candidate = original.inventory.find(value => value.available > 0)!;
      expect(candidate).toBeTruthy();
      const model = original.scene.models.find(value => value.id === candidate.modelId)!;
      const scene = structuredClone(original.scene);
      scene.placements = [{ id: 'e2e-taken-piece', modelId: model.id, modelVersion: 1, parentType: 'wall',
        parentId: scene.walls[0]!.id, position: [0, 1.5, 0], rotation: [0, 0, 0, 1] }];
      scene.boulders = [];
      const prepared = await save(alice, scene, roomId);
      const response = await alice.api.post(`${apiBase}/rooms/${roomId}/reservations`, {
        headers: csrf(alice), data: { sceneRevision: prepared.revision, requestId: crypto.randomUUID() },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      reservationId = (await room(alice, roomId)).reservations.find(value => !original.reservations.some(previous => previous.id === value.id))!.id;
      const withdraw = await action(alice, roomId, reservationId, 'withdraw');
      expect(withdraw.ok(), await withdraw.text()).toBeTruthy();
      if (path === 'installation puis démontage') {
        const installed = await action(alice, roomId, reservationId, 'install');
        expect(installed.ok(), await installed.text()).toBeTruthy();
        const onWall = await room(alice, roomId);
        expect(onWall.reservations.find(value => value.id === reservationId)?.state).toBe('installed');
        expect(onWall.inventory.find(value => value.modelId === model.id)?.installed).toBe(1);
        expect(onWall.inventory.find(value => value.modelId === model.id)?.available).toBe(candidate.available - 1);
        const requested = await action(alice, roomId, reservationId, 'request_return');
        expect(requested.ok(), await requested.text()).toBeTruthy();
      } else {
        const cancelled = await action(alice, roomId, reservationId, 'cancel');
        expect(cancelled.ok(), await cancelled.text()).toBeTruthy();
      }
      const pending = await room(alice, roomId);
      expect(pending.reservations.find(value => value.id === reservationId)?.state).toBe('return_pending');
      expect(pending.inventory.find(value => value.modelId === model.id)?.available).toBe(candidate.available - 1);
      expect(pending.inventory.find(value => value.modelId === model.id)?.returnPending).toBe(1);
      const returned = await action(alice, roomId, reservationId, 'return');
      expect(returned.ok(), await returned.text()).toBeTruthy();
      expect((await room(alice, roomId)).inventory.find(value => value.modelId === model.id)?.available).toBe(candidate.available);
    } finally {
      if (reservationId) await releaseOwnReservation(alice, roomId, reservationId);
      await save(alice, original.scene, roomId);
      await alice.api.dispose();
    }
  });
  }
});
