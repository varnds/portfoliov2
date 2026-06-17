/** GameLayer — all in-world play-mode objects, rendered inside the Canvas only
 *  while playing. The avatar + footstep FX are shared by every game mode; the
 *  objective layer (artifacts+chaser / socks / camera subjects) switches on
 *  `gameMode`. */
import React from "react";
import { useGame } from "./gameStore";
import { Avatar } from "./Avatar";
import { Discoverables } from "./Discoverables";
import { FootstepEffects } from "./FootstepEffects";
import { ZombieChaser } from "./ZombieChaser";
import { SockHunt } from "./SockHunt";
import { CameraMode } from "./CameraMode";

export function GameLayer({ seasonKey }) {
  const { playing, won, dead, gameMode } = useGame();
  if (!playing) return null;
  return (
    <>
      <Avatar />
      <FootstepEffects seasonKey={seasonKey} />

      {gameMode === "chase" && (
        <>
          <Discoverables />
          {/* the chaser retires once you've found everything or been caught */}
          {!won && !dead && <ZombieChaser />}
        </>
      )}
      {gameMode === "socks" && <SockHunt />}
      {gameMode === "camera" && <CameraMode />}
    </>
  );
}
