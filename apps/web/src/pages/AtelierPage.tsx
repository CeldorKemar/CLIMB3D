import { useEffect, useState } from "react";
import type { BootstrapResponse, RoomState } from "@climbed/contracts";
import { api } from "../api/client";
import { Workspace } from "../components/Workspace";
import { Brand } from "../components/Brand";
export function AtelierPage({
  session,
  onLogout,
}: {
  session: BootstrapResponse;
  onLogout: () => Promise<void>;
}) {
  const [roomId, setRoomId] = useState(session.rooms[0]?.id ?? "");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRoom(null);
    setError("");
    if (roomId)
      api
        .room(roomId)
        .then((r) => {
          if (active) setRoom(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [roomId]);
  if (!room || !roomId)
    return (
      <div className="loading-page">
        <Brand />
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => window.location.reload()}>Réessayer</button>
          </>
        ) : (
          <>
            <span className="spinner" />
            <p>
              {roomId
                ? "Ouverture de la salle…"
                : "Aucune salle accessible. Contactez votre administrateur."}
            </p>
          </>
        )}
      </div>
    );
  return (
    <Workspace
      key={roomId}
      session={session}
      roomId={roomId}
      initial={room}
      changeRoom={setRoomId}
      onLogout={onLogout}
    />
  );
}
