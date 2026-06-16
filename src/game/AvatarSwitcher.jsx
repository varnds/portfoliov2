/** Floating switcher to swap the player model live (robot ↔ chicken). */
import React from "react";
import { useGame, setAvatarVariant } from "./gameStore";

const OPTIONS = [
  { key: "robot", label: "🤖 Robot" },
  { key: "chicken", label: "🐔 Chicken" },
];

export function AvatarSwitcher({ visible }) {
  const { avatarVariant } = useGame();
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 20,
        bottom: 74,
        zIndex: 9000,
        display: "flex",
        gap: 6,
        padding: 5,
        borderRadius: 999,
        background: "rgba(255,253,247,0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
      }}
    >
      {OPTIONS.map((o) => {
        const active = o.key === avatarVariant;
        return (
          <button
            key={o.key}
            onClick={() => setAvatarVariant(o.key)}
            style={{
              border: "none",
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 14px",
              borderRadius: 999,
              color: active ? "#fff" : "#5A463A",
              background: active ? "#E2725B" : "transparent",
              transition: "background 0.2s ease, color 0.2s ease",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
