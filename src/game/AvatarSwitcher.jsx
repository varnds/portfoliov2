/** Floating switcher to swap the player model live (8 low-poly avatars). */
import React from "react";
import { useGame, setAvatarVariant } from "./gameStore";
import { AVATARS } from "./avatarConfig";

export function AvatarSwitcher({ visible }) {
  const { avatarVariant } = useGame();
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 20,
        top: 92,
        zIndex: 9000,
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        maxWidth: 220,
        padding: 8,
        borderRadius: 16,
        background: "rgba(255,253,247,0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
      }}
    >
      {AVATARS.map((a) => {
        const active = a.id === avatarVariant;
        return (
          <button
            key={a.id}
            onClick={() => setAvatarVariant(a.id)}
            title={a.label}
            style={{
              border: active ? "1px solid #E2725B" : "1px solid transparent",
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 9px",
              borderRadius: 999,
              color: active ? "#fff" : "#5A463A",
              background: active ? "#E2725B" : "rgba(0,0,0,0.04)",
              transition: "background 0.2s ease, color 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 13 }}>{a.emoji}</span> {a.label}
          </button>
        );
      })}
    </div>
  );
}
