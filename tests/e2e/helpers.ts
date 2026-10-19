import { expect, request, type APIRequestContext, type Page } from '@playwright/test';
import type { BootstrapResponse, RoomState, SceneDocument } from '../../packages/contracts/src/index';

export const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';
export const password = 'climbed-local-demo';

export async function enterWorkshop(page: Page, options: { reuseSession?: boolean } = {}) {
  if (options.reuseSession) {
    const actor = await login('alice@climbed.local');
    try {
      await page.context().addCookies((await actor.api.storageState()).cookies);
    } finally { await actor.api.dispose(); }
  }
  await page.goto('/');
  if (!options.reuseSession) {
    await page.getByLabel('Adresse e-mail').fill('alice@climbed.local');
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrer dans l’atelier' }).click();
  }
  await expect(page.getByTestId('editor-canvas').locator('canvas')).toBeVisible();
  await page.getByTestId('view-front').click();
  await expect(page.getByTestId('view-front')).toHaveClass(/active/);
}

export async function confirmSave(page: Page) {
  const saved = page.waitForResponse(value => value.url().includes('/scene') && value.request().method() === 'PUT');
  await page.getByTestId('scene-save').click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
}

export interface Actor {
  api: APIRequestContext;
  bootstrap: BootstrapResponse;
}

// Reuse authentication within the single worker, while keeping a fresh HTTP context per test.
// Cookies stay in memory; browser scenarios still exercise the real login form independently.
const sessions = new Map<string, Promise<{
  bootstrap: BootstrapResponse;
  storageState: Awaited<ReturnType<APIRequestContext['storageState']>>;
}>>();

export async function login(email: string): Promise<Actor> {
  if (!sessions.has(email)) {
    sessions.set(email, (async () => {
      const context = await request.newContext({ baseURL: apiBase });
      try {
        const response = await context.post(`${apiBase}/auth/login`, { data: { email, password } });
        expect(response.ok(), await response.text()).toBeTruthy();
        return { bootstrap: await response.json() as BootstrapResponse, storageState: await context.storageState() };
      } finally { await context.dispose(); }
    })());
  }
  const session = await sessions.get(email)!;
  return { api: await request.newContext({ baseURL: apiBase, storageState: session.storageState }), bootstrap: session.bootstrap };
}

export function csrf(actor: Actor): Record<string, string> {
  return { 'x-csrf-token': actor.bootstrap.csrfToken };
}

export async function room(actor: Actor, roomId = actor.bootstrap.rooms[0]!.id): Promise<RoomState> {
  const response = await actor.api.get(`${apiBase}/rooms/${roomId}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return await response.json() as RoomState;
}

export async function save(actor: Actor, scene: SceneDocument, roomId = actor.bootstrap.rooms[0]!.id): Promise<RoomState> {
  const before = await room(actor, roomId);
  const response = await actor.api.put(`${apiBase}/rooms/${roomId}/scene`, {
    headers: csrf(actor), data: { scene, expectedRevision: before.revision },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return room(actor, roomId);
}

export async function action(actor: Actor, roomId: string, reservationId: string, name: string) {
  return actor.api.post(`${apiBase}/rooms/${roomId}/reservations/${reservationId}/actions`, {
    headers: csrf(actor), data: { action: name, requestId: crypto.randomUUID() },
  });
}

export async function releaseOwnReservation(actor: Actor, roomId: string, reservationId: string) {
  const current = (await room(actor, roomId)).reservations.find(value => value.id === reservationId);
  if (!current || current.state === 'returned' || current.state === 'cancelled') return;
  if (current.state === 'reserved' || current.state === 'taken') {
    const cancelled = await action(actor, roomId, reservationId, 'cancel');
    expect(cancelled.ok(), await cancelled.text()).toBeTruthy();
  } else if (current.state === 'installed') {
    const requested = await action(actor, roomId, reservationId, 'request_return');
    expect(requested.ok(), await requested.text()).toBeTruthy();
  }
  const pending = (await room(actor, roomId)).reservations.find(value => value.id === reservationId);
  if (pending?.state === 'return_pending') {
    const returned = await action(actor, roomId, reservationId, 'return');
    expect(returned.ok(), await returned.text()).toBeTruthy();
  }
}
