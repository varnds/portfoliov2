/** Sound controls in the left rail: a mute toggle + the theme-music variation
 *  picker. Switching a variant swaps the looping music live so you can audition
 *  them. Any click here also counts as the gesture that unlocks Web Audio. */
import React from "react";
import { useAudio, setSoundOn, setVariant, audioUnlock } from "./audio";
import { MUSIC_VARIANTS } from "./musicVariants";
import { RAIL_LABEL, RAIL_ROW, railChip } from "./railStyles";

export function SoundSwitcher({ visible }) {
  const { soundOn, variant } = useAudio();
  if (!visible) return null;
  return (
    <div>
      <div style={RAIL_LABEL}>Sound</div>
      <div style={RAIL_ROW}>
        <button
          onClick={() => {
            audioUnlock();
            setSoundOn(!soundOn);
          }}
          style={railChip(soundOn)}
        >
          {soundOn ? "🔊 On" : "🔇 Off"}
        </button>
      </div>
      {soundOn && (
        <div style={{ ...RAIL_ROW, marginTop: 4 }}>
          {MUSIC_VARIANTS.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                audioUnlock();
                setVariant(v.id);
              }}
              style={railChip(v.id === variant)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
