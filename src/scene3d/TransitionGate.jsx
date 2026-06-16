import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** Fires once per entry after the first frame — parent starts the cross-fade
 * only when WebGL has actually drawn at the entry camera pose. */
export function TransitionGate({ entryKey, onReady }) {
  const sent = useRef(false);

  useEffect(() => {
    sent.current = false;
  }, [entryKey]);

  useFrame(() => {
    if (sent.current) return;
    sent.current = true;
    onReady?.();
  });

  return null;
}
