// Recovered "photo frame → Polaroid" discoverable: a low-poly standing photo
// frame on a little easel that gently bobs near the pond shore.
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Discoverable } from "../Discoverable";

const WOOD = "#9c6b3f";
const PHOTO = "#f3ece0";

export function PhotoFrame() {
  const bobRef = useRef();

  // Build the thin frame border from four boxes around an inset photo panel.
  const { borderGeo, photoGeo, legGeo, baseGeo } = useMemo(() => {
    const w = 0.9;
    const h = 1.1;
    const t = 0.06; // border thickness
    const d = 0.06; // frame depth

    return {
      borderGeo: {
        topBottom: new THREE.BoxGeometry(w, t, d),
        leftRight: new THREE.BoxGeometry(t, h, d),
        w,
        h,
        t,
        d,
      },
      photoGeo: new THREE.BoxGeometry(w - t * 2, h - t * 2, d * 0.5),
      legGeo: new THREE.BoxGeometry(0.05, h * 0.95, 0.05),
      baseGeo: new THREE.BoxGeometry(0.5, 0.05, 0.35),
    };
  }, []);

  useFrame((state) => {
    if (!bobRef.current) return;
    const e = state.clock.elapsedTime;
    bobRef.current.position.y = 0.75 + Math.sin(e * 1.4) * 0.03;
    bobRef.current.rotation.z = Math.sin(e * 0.9) * 0.015;
  });

  const { topBottom, leftRight, w, h, t, d } = borderGeo;

  return (
    <Discoverable
      id="photo"
      position={[-2, 0, 10]}
      radius={5}
      reveal={{
        title: "A picture I keep",
        body:
          "A Polaroid that didn't make it into any portfolio — proof that the best work usually starts as something you made just for yourself.",
      }}
    >
      {/* little base so the easel stands on the terrain */}
      <mesh geometry={baseGeo} position={[0, 0.025, 0.05]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} />
      </mesh>

      {/* back support leg, tilted to act as an easel prop */}
      <mesh
        geometry={legGeo}
        position={[0, h * 0.5, -0.15]}
        rotation={[0.28, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={WOOD} />
      </mesh>

      {/* the frame itself, gently bobbing */}
      <group ref={bobRef} position={[0, 0.75, 0]}>
        {/* photo panel (inset, lighter) */}
        <mesh geometry={photoGeo} position={[0, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={PHOTO} />
        </mesh>

        {/* border: top, bottom, left, right */}
        <mesh geometry={topBottom} position={[0, h / 2 - t / 2, d * 0.25]} castShadow receiveShadow>
          <meshStandardMaterial color={WOOD} />
        </mesh>
        <mesh geometry={topBottom} position={[0, -h / 2 + t / 2, d * 0.25]} castShadow receiveShadow>
          <meshStandardMaterial color={WOOD} />
        </mesh>
        <mesh geometry={leftRight} position={[-w / 2 + t / 2, 0, d * 0.25]} castShadow receiveShadow>
          <meshStandardMaterial color={WOOD} />
        </mesh>
        <mesh geometry={leftRight} position={[w / 2 - t / 2, 0, d * 0.25]} castShadow receiveShadow>
          <meshStandardMaterial color={WOOD} />
        </mesh>
      </group>
    </Discoverable>
  );
}
