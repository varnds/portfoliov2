/** GameLayer — all in-world play-mode objects (avatar + discoverable set-pieces),
 *  rendered inside the Canvas only while playing. */
import React from "react";
import { useGame } from "./gameStore";
import { Avatar } from "./Avatar";
import { Discoverables } from "./Discoverables";
import { FootstepEffects } from "./FootstepEffects";

export function GameLayer({ seasonKey }) {
  const { playing } = useGame();
  if (!playing) return null;
  return (
    <>
      <Avatar />
      <Discoverables />
      <FootstepEffects seasonKey={seasonKey} />
    </>
  );
}
