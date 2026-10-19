import type {
  BootstrapResponse,
  ReservationAction,
  RoomState,
  SceneDocument,
} from "@climbed/contracts";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response
    .json()
    .catch(() => ({ message: "Le serveur a renvoyé une réponse illisible." }));
  if (!response.ok)
    throw new ApiError(
      data.message || "Le serveur est momentanément indisponible.",
      response.status,
    );
  return data as T;
}
export const api = {
  session: () => request<BootstrapResponse>("/auth/session"),
  login: (email: string, password: string) =>
    request<BootstrapResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: (csrf: string) =>
    request<void>("/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": csrf },
    }),
  room: (id: string) => request<RoomState>(`/rooms/${encodeURIComponent(id)}`),
  save: (
    id: string,
    scene: SceneDocument,
    expectedRevision: number,
    csrf: string,
  ) =>
    request<RoomState>(`/rooms/${encodeURIComponent(id)}/scene`, {
      method: "PUT",
      headers: { "x-csrf-token": csrf },
      body: JSON.stringify({ scene, expectedRevision }),
    }),
  reserve: (
    id: string,
    sceneRevision: number,
    csrf: string,
    wallIds?: string[],
  ) =>
    request<RoomState>(`/rooms/${encodeURIComponent(id)}/reservations`, {
      method: "POST",
      headers: { "x-csrf-token": csrf },
      body: JSON.stringify({
        sceneRevision,
        wallIds,
        requestId: crypto.randomUUID(),
      }),
    }),
  action: (
    roomId: string,
    reservationId: string,
    action: ReservationAction,
    csrf: string,
  ) =>
    request<RoomState>(
      `/rooms/${encodeURIComponent(roomId)}/reservations/${encodeURIComponent(reservationId)}/actions`,
      {
        method: "POST",
        headers: { "x-csrf-token": csrf },
        body: JSON.stringify({ action, requestId: crypto.randomUUID() }),
      },
    ),
};
