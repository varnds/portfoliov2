import React, { useMemo } from "react";
import * as THREE from "three";
import { TERRAIN_HALF_D, TERRAIN_HALF_W, terrainHeight } from "./coords";

function heightToColor(y, palette, target) {
  const t = THREE.MathUtils.clamp((y + 0.6) / 4.4, 0, 1);
  const low = new THREE.Color(palette.hill3);
  const mid = new THREE.Color(palette.hill2);
  const high = new THREE.Color(palette.hill1);
  if (t < 0.45) target.copy(low).lerp(mid, t / 0.45);
  else target.copy(mid).lerp(high, (t - 0.45) / 0.55);
  return target;
}

export function Terrain({
  palette,
  width = TERRAIN_HALF_W * 2,
  depth = TERRAIN_HALF_D * 2,
  segments = 160,
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = terrainHeight(x, z);
      pos.setY(i, y);

      heightToColor(y, palette, col);
      const grain = (Math.sin(x * 1.7) * Math.cos(z * 1.3)) * 0.012;
      colors[i * 3] = col.r + grain;
      colors[i * 3 + 1] = col.g + grain;
      colors[i * 3 + 2] = col.b + grain;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [palette, width, depth, segments]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
