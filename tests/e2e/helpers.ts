import { expect, request, type APIRequestContext } from '@playwright/test';
import type { BootstrapResponse, RoomState, SceneDocument } from '../../packages/contracts/src/index';

export const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';
export const password = 'climbed-local-demo';

export interface Actor {
  api: APIRequestContext;
  bootstrap: BootstrapResponse;
}

export async function login(email: string): Promise<Actor> {
  const api = await request.newContext({ baseURL: apiBase });
  const response = await api.post(`${apiBase}/auth/login`, { data: { email, password } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return { api, bootstrap: await response.json() as BootstrapResponse };
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
