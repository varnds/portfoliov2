import React from "react";
import { MONO } from "./editorialUtils";

export function LayoutTabBar({ tabs, activeId, onChange, ink, accent, mutedInk, className = "" }) {
  const creditColor = mutedInk || `${ink}55`;

  return (
    <div className={`layout-tab-bar ${className}`.trim()} role="tablist" aria-label="Layout style">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`layout-tab${isActive ? " is-active" : ""}`}
            style={{
              fontFamily: MONO,
              color: isActive ? accent : ink,
              borderColor: isActive ? accent : `${ink}18`,
              background: isActive ? `${accent}10` : "transparent",
            }}
            onClick={() => onChange(tab.id)}
          >
            <span className="layout-tab-label">{tab.label}</span>
            <span className="layout-tab-credit" style={{ color: creditColor }}>
              {tab.credit}
            </span>
          </button>
        );
      })}
    </div>
  );
}
