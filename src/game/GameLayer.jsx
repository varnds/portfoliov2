/** GameLayer — all in-world play-mode objects, rendered inside the Canvas only
 *  while playing. The avatar + footstep FX are shared by every game mode; the
 *  objective layer (artifacts+chaser / socks / camera subjects) switches on
 *  `gameMode`. */
import React, { useEffect } from "react";
import { useGame } from "./gameStore";
import { installUnlock, audioSetPlaying } from "./audio";
import { Avatar } from "./Avatar";
import { Discoverables } from "./Discoverables";
import { FootstepEffects } from "./FootstepEffects";
import { ZombieChaser } from "./ZombieChaser";
import { SockHunt } from "./SockHunt";
import { CameraMode } from "./CameraMode";
import { WashDay } from "./WashDay";

export function GameLayer({ seasonKey }) {
  const { playing, won, dead, gameMode } = useGame();

  // Sound lifecycle: arm the autoplay-unlock gesture once, and let the music
  // follow the playing state (starts on entry, stops on exit). Defensive engine,
  // so this never affects the visuals.
  useEffect(() => {
    installUnlock();
  }, []);
  useEffect(() => {
    audioSetPlaying(playing);
  }, [playing]);

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
      {gameMode === "wash" && <WashDay />}
    </>
  );
}
