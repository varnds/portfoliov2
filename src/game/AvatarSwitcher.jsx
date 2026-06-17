/** Swap the player model live. Renders in-flow as a labeled row inside the
 *  left control rail. */
import React from "react";
import { useGame, setAvatarVariant } from "./gameStore";
import { AVATARS } from "./avatarConfig";
import { RAIL_LABEL, RAIL_ROW, railChip } from "./railStyles";

export function AvatarSwitcher({ visible }) {
  const { avatarVariant } = useGame();
  if (!visible) return null;
  return (
    <div>
      <div style={RAIL_LABEL}>Player</div>
      <div style={RAIL_ROW}>
        {AVATARS.map((a) => {
          const active = a.id === avatarVariant;
          return (
            <button key={a.id} onClick={() => setAvatarVariant(a.id)} title={a.label} style={railChip(active)}>
              <span style={{ fontSize: 12 }}>{a.emoji}</span> {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
