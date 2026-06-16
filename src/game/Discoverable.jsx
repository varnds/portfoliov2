/**
 * Discoverable — the contract every set-piece wraps its visual in.
 *
 * Handles ALL shared discovery behavior so set-piece authors only build visuals:
 *   • registers itself with the gameStore (for the bird guide + progress count)
 *   • detects avatar proximity each frame
 *   • shows an interact prompt when you're close + undiscovered
 *   • triggers the reveal (the 2D card) on click-when-near
 *   • for buried items: shows a dirt mound, then rises the visual out of the soil
 *
 * Usage (set-piece author):
 *   <Discoverable id="ethos" position={[x,0,z]} radius={5}
 *      reveal={{ title: "How I think", body: "(placeholder)" }}>
 *     <MyMesh />          // rendered at LOCAL origin; group handles placement
 *   </Discoverable>
 *
 * For buried items add `buried` (mound appears; visual starts `riseFrom` below
 * ground and rises on uncover).
 */
import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  avatarPos,
  avatarActive,
  registerDiscoverable,
  unregisterDiscoverable,
  discover,
  enterNear,
  leaveNear,
  useGame,
  themeAccent,
} from "./gameStore";
import { terrainHeight } from "../scene3d/coords";

/** A low, irregular mound of disturbed/cracked earth marking a buried find. */
const DirtMound = forwardRef(function DirtMound({ size = 0.8 }, ref) {
  const moundGeo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i);
      // lumpy displacement so it reads as turned soil, not a smooth dome
      const n =
        Math.sin(v.x * 5.0 + v.z * 3.0) * 0.5 +
        Math.sin(v.x * 11.0) * Math.cos(v.z * 9.0) * 0.5;
      v.multiplyScalar(1 + n * 0.16);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  // scattered soil clods around the rim + dark crack slabs across the top
  const { clods, cracks } = useMemo(() => {
    const clods = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + (i % 3) * 0.4;
      const r = 0.78 + (i % 4) * 0.12;
      clods.push({
        pos: [Math.cos(a) * r, 0.04 + (i % 2) * 0.04, Math.sin(a) * r],
        s: 0.1 + (i % 3) * 0.05,
        rot: [a, a * 1.6, i],
      });
    }
    const cracks = [];
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + 0.35;
      cracks.push({ a, len: 0.55 + (i % 2) * 0.22 });
    }
    return { clods, cracks };
  }, []);

  const topY = size * 0.4;
  return (
    <group ref={ref}>
      {/* low irregular mound (flattened sphere; bottom half sits below ground) */}
      <mesh geometry={moundGeo} scale={[size, size * 0.42, size]} castShadow receiveShadow>
        <meshStandardMaterial color="#6E4429" roughness={1} flatShading />
      </mesh>
      {/* darker disturbed-soil collar around the base */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 0.82, size * 1.18, 18]} />
        <meshStandardMaterial color="#523521" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* scattered soil clods */}
      {clods.map((c, i) => (
        <mesh key={i} position={c.pos} rotation={c.rot} scale={c.s} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={i % 2 ? "#5E3A23" : "#79502F"} roughness={1} flatShading />
        </mesh>
      ))}
      {/* dark cracks radiating across the top */}
      {cracks.map((c, i) => (
        <mesh
          key={`cr-${i}`}
          position={[Math.cos(c.a) * size * 0.18, topY, Math.sin(c.a) * size * 0.18]}
          rotation={[0, -c.a, 0]}
        >
          <boxGeometry args={[c.len * size, 0.02, 0.05 * size]} />
          <meshStandardMaterial color="#3A2414" roughness={1} />
        </mesh>
      ))}
    </group>
  );
});

/** A bobbing downward arrow that glows in the current season's accent colour. */
function InteractPrompt() {
  const ref = useRef();
  const headMat = useRef();
  const stemMat = useRef();
  const halo = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = 2.7 + Math.sin(t * 2.6) * 0.18;
    ref.current.rotation.y = t * 1.1;
    // pull the live season accent each frame so the cue stays on-theme
    if (headMat.current) {
      headMat.current.color.set(themeAccent);
      headMat.current.emissive.set(themeAccent);
    }
    if (stemMat.current) {
      stemMat.current.color.set(themeAccent);
      stemMat.current.emissive.set(themeAccent);
    }
    if (halo.current) {
      halo.current.material.color.set(themeAccent);
      const s = 1 + Math.sin(t * 2.6) * 0.12;
      halo.current.scale.setScalar(s);
    }
  });
  return (
    <group ref={ref} position={[0, 2.7, 0]}>
      {/* arrowhead pointing down */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.26, 0.42, 5]} />
        <meshStandardMaterial
          ref={headMat}
          color="#FFE08A"
          emissive="#FFE08A"
          emissiveIntensity={1.5}
          roughness={0.4}
          flatShading
          toneMapped={false}
        />
      </mesh>
      {/* short stem above the head */}
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[0.11, 0.32, 0.11]} />
        <meshStandardMaterial
          ref={stemMat}
          color="#FFE08A"
          emissive="#FFE08A"
          emissiveIntensity={1.3}
          roughness={0.4}
          flatShading
          toneMapped={false}
        />
      </mesh>
      {/* soft glow */}
      <mesh ref={halo}>
        <sphereGeometry args={[0.5, 14, 14]} />
        <meshBasicMaterial
          color="#FFE08A"
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

export function Discoverable({
  id,
  position,
  buried = false,
  radius = 5,
  reveal,
  riseFrom = -3,
  children,
}) {
  const group = useRef();
  const inner = useRef();
  const moundRef = useRef();
  const { discovered } = useGame();
  const isFound = discovered.has(id);
  const [near, setNear] = useState(false);
  const wantHint = useRef(false);
  const rise = useRef(buried ? 0 : 1); // reveal animation progress

  // Sit on the actual terrain surface (where the avatar walks) so pieces don't
  // sink into dunes — placement supplies x/z; ground supplies y.
  const grounded = useMemo(
    () => [position[0], terrainHeight(position[0], position[2]), position[2]],
    [position],
  );

  useEffect(() => {
    registerDiscoverable(id, grounded, buried);
    return () => unregisterDiscoverable(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    if (!group.current) return;
    const d = Math.min(dt, 0.05);
    const within =
      avatarActive && avatarPos.distanceTo(group.current.position) < radius;
    if (within !== near) setNear(within);
    // tell the store when we're the active nearby target (drives the context hint)
    const want = within && !isFound;
    if (want !== wantHint.current) {
      wantHint.current = want;
      if (want) enterNear(id, buried);
      else leaveNear(id);
    }

    if (buried && inner.current) {
      const target = isFound ? 1 : 0;
      rise.current += (target - rise.current) * Math.min(1, d * 3);
      inner.current.position.y = riseFrom * (1 - rise.current);
      inner.current.visible = rise.current > 0.001;
      if (moundRef.current) moundRef.current.visible = rise.current < 0.6;
    }
  });

  const onActivate = (e) => {
    e?.stopPropagation?.();
    if (isFound || !near) return;
    discover(id, reveal ? { id, ...reveal } : { id });
  };

  return (
    <group ref={group} position={grounded} onClick={onActivate}>
      {buried && <DirtMound ref={moundRef} size={Math.max(radius * 0.2, 0.7)} />}
      <group ref={inner} position={[0, buried ? riseFrom : 0, 0]} visible={!buried || isFound}>
        {children}
      </group>
      {near && !isFound && <InteractPrompt />}
    </group>
  );
}
