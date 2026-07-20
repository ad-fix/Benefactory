import { useRef, useMemo, useLayoutEffect, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getFloorTint, getPlayerHex } from "@/constants/playerColors";
import { Line } from "@react-three/drei";


interface ParticleFloorProps {
    gridWidth?: number;
    gridHeight?: number;
    spacing?: number;
    nodeStates?: (string | null)[][];
    rippleTrigger?: number; // Increment this to trigger a ripple
    collectibles?: { x: number; y: number; color: string; type: string; id: string }[];
}

export function ParticleFloor({ gridWidth = 10, gridHeight = 8, spacing = 2.5, nodeStates, rippleTrigger = 0, collectibles = [] }: ParticleFloorProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const [tempObject] = useState(() => new THREE.Object3D());
    const rippleStartTime = useRef<number>(-10); // Start with ripple already "finished"

    const [isDragging, setIsDragging] = useState(false);
    const [startCell, setStartCell] = useState<{ x: number; z: number } | null>(null);
    const [pathPoints, setPathPoints] = useState<{ x: number; z: number }[]>([]);

    const [pathColor, setPathColor] = useState("orange");

    const [completedPaths, setCompletedPaths] = useState<
      { points: { x: number; z: number }[]; color: string }[]
    >([]);

    const [usedEndpointIds, setUsedEndpointIds] = useState<Set<string>>(new Set());

    // 1. Grid layout
    const { totalNodes, offsetX, offsetZ } = useMemo(() => ({
        totalNodes: gridWidth * gridHeight,
        offsetX: (gridWidth - 1) / 2,
        offsetZ: (gridHeight - 1) / 2
    }), [gridWidth, gridHeight]);

    // Update instance matrices (positions)
    useLayoutEffect(() => {
        if (!meshRef.current) return;


        let i = 0;
        for (let gx = 0; gx < gridWidth; gx++) {
            for (let gz = 0; gz < gridHeight; gz++) {
                const x = (gx - offsetX) * spacing;
                const z = (gz - offsetZ) * spacing;

                tempObject.position.set(x, -2.55, z);
                tempObject.rotation.x = -Math.PI / 2; // Flat on floor
                tempObject.scale.set(1, 1, 1);

                tempObject.updateMatrix();
                meshRef.current.setMatrixAt(i, tempObject.matrix);
                i++;
            }
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [gridWidth, gridHeight, spacing, offsetX, offsetZ, tempObject]);

    // 2. Colors array
    const colorArray = useMemo(() => {
        const array = new Float32Array(totalNodes * 3);
        const colorMap = {
            red: new THREE.Color(getPlayerHex("RED")),
            blue: new THREE.Color(getPlayerHex("BLUE")),
            green: new THREE.Color(getFloorTint("GREEN")),
            gray: new THREE.Color("#888888"), // Neutral (tutorial)
        };
        const defaultColor = new THREE.Color("#333333");

        let i = 0;
        for (let gx = 0; gx < gridWidth; gx++) {
            for (let gz = 0; gz < gridHeight; gz++) {
                const nodeState = nodeStates ? nodeStates[gx][gz] : null;
                const color = nodeState ? colorMap[nodeState as keyof typeof colorMap] : defaultColor;

                if (color) {
                    color.toArray(array, i * 3);
                } else {
                    defaultColor.toArray(array, i * 3);
                }
                i++;
            }
        }
        return array;
    }, [nodeStates, gridWidth, gridHeight, totalNodes]);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uRippleTime: { value: -10 },
        uGridExtent: { value: Math.max(offsetX, offsetZ) * spacing },
    }), []);

    // Trigger ripple when rippleTrigger changes
    useEffect(() => {
        if (rippleTrigger > 0) {
            rippleStartTime.current = 0;
        }
    }, [rippleTrigger]);

    // Update uniforms each frame
    useFrame((_, delta) => {
        uniforms.uTime.value += delta;
        if (rippleStartTime.current >= 0) {
            rippleStartTime.current += delta;
            uniforms.uRippleTime.value = rippleStartTime.current;
            // Stop updating after ripple completes (about 3 seconds)
            if (rippleStartTime.current > 3.0) {
                rippleStartTime.current = -10;
                uniforms.uRippleTime.value = -10;
            }
        }
    });

    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      attribute vec3 instanceColor;

      void main() {
        vUv = uv;
        vColor = instanceColor;
        // Get world position of the instance
        vec4 worldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vWorldPos = worldPos.xyz;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform float uRippleTime;
      uniform float uGridExtent;

      varying vec2 vUv;
      varying vec3 vColor;
      varying vec3 vWorldPos;

      void main() {
        vec2 center = vUv - 0.5;
        float dist = length(center);

        // Two thin concentric circles
        float r1 = 0.18;
        float r2 = 0.24;
        float thickness = 0.012;
        float blur = 0.01;

        float ring1 = 1.0 - smoothstep(thickness, thickness + blur, abs(dist - r1));
        float ring2 = 1.0 - smoothstep(thickness, thickness + blur, abs(dist - r2));

        float alpha = ring1 + ring2;

        if (alpha < 0.01) discard;

        // Calculate ripple effect
        float rippleIntensity = 0.0;
        if (uRippleTime >= 0.0 && uRippleTime < 3.0) {
          // Distance from center of grid (world space)
          float distFromCenter = length(vec2(vWorldPos.x, vWorldPos.z));

          // Ripple expands outward from center
          float rippleSpeed = 25.0; // Units per second
          float rippleRadius = uRippleTime * rippleSpeed;
          float rippleWidth = 8.0; // Width of the ripple band

          // Calculate how close this particle is to the ripple front
          float rippleDist = abs(distFromCenter - rippleRadius);

          // Smooth falloff for the ripple
          rippleIntensity = 1.0 - smoothstep(0.0, rippleWidth, rippleDist);

          // Fade out the ripple over time
          float fadeOut = 1.0 - smoothstep(1.5, 3.0, uRippleTime);
          rippleIntensity *= fadeOut;

          // Add slight pulse to the ripple
          rippleIntensity *= 0.8 + 0.2 * sin(uRippleTime * 10.0 - distFromCenter * 0.5);
        }

        // Boost color intensity during ripple
        vec3 finalColor = vColor + rippleIntensity * vec3(0.5, 0.8, 1.0);
        float finalAlpha = alpha * (0.8 + rippleIntensity * 1.2);

        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `;

    return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, totalNodes]}
        onPointerDown={(e) => {
          const offsetX = (gridWidth - 1) / 2;
          const offsetZ = (gridHeight - 1) / 2;

          const gridX = Math.round(e.point.x / spacing + offsetX);
          const gridZ = Math.round(e.point.z / spacing + offsetZ);

          const MAX_GRID = 26;
          const center = Math.floor(MAX_GRID / 2);
          const halfWidth = Math.floor(gridWidth / 2);
          const halfHeight = Math.floor(gridHeight / 2);
          const minX = center - halfWidth;
          const minY = center - halfHeight;

          const absX = gridX + minX;
          const absZ = gridZ + minY;

          console.log("Clicked local:", gridX, gridZ, "-> absolute:", absX, absZ);

          const endpoint = collectibles.find((c) => c.x === absX && c.y === absZ);
          if (!endpoint) {
            console.log("No endpoint here, ignoring drag start");
            return;
          }

          if (usedEndpointIds.has(endpoint.id)) {
            console.log("This endpoint is already connected, ignoring drag start");
            return;
          }

          const hexColor = getPlayerHex(endpoint.color);

          setPathColor(hexColor);
          setIsDragging(true);
          setStartCell({ x: gridX, z: gridZ });
          setPathPoints([{ x: gridX, z: gridZ }]);
        }}
        onPointerMove={(e) => {
          if (!isDragging) return;

          const offsetX = (gridWidth - 1) / 2;
          const offsetZ = (gridHeight - 1) / 2;

          const gridX = Math.round(e.point.x / spacing + offsetX);
          const gridZ = Math.round(e.point.z / spacing + offsetZ);

          const isCellClaimed = (x: number, z: number, excludeSelf = false) => {
            for (const path of completedPaths) {
              if (path.points.some((p) => p.x === x && p.z === z)) {
                return true;
              }
            }
            if (!excludeSelf) {
              if (pathPoints.some((p) => p.x === x && p.z === z)) {
                return true;
              }
            }
            return false;
          };

          setPathPoints((prev) => {
            const last = prev[prev.length - 1];
            if (!last) return prev;

            const dx = Math.abs(gridX - last.x);
            const dz = Math.abs(gridZ - last.z);

            if (dx === 0 && dz === 0) return prev;

            const isOrthogonalStep = (dx === 1 && dz === 0) || (dx === 0 && dz === 1);
            if (!isOrthogonalStep) return prev;

            if (isCellClaimed(gridX, gridZ)) {
              console.log("Cell already claimed, blocking move");
              return prev;
            }

            return [...prev, { x: gridX, z: gridZ }];
          });
        }}
        onPointerUp={(e) => {
          const MAX_GRID = 26;
          const center = Math.floor(MAX_GRID / 2);
          const halfWidth = Math.floor(gridWidth / 2);
          const halfHeight = Math.floor(gridHeight / 2);
          const minX = center - halfWidth;
          const minY = center - halfHeight;

          const last = pathPoints[pathPoints.length - 1];
          const first = pathPoints[0];

          let validEnd = false;
          let startEndpoint: typeof collectibles[number] | undefined;
          let endEndpoint: typeof collectibles[number] | undefined;

          if (last && first && pathPoints.length > 1) {
            const lastAbsX = last.x + minX;
            const lastAbsZ = last.z + minY;

            startEndpoint = collectibles.find(
              (c) => c.x === first.x + minX && c.y === first.z + minY
            );
            endEndpoint = collectibles.find(
              (c) => c.x === lastAbsX && c.y === lastAbsZ
            );

            if (
              startEndpoint &&
              endEndpoint &&
              endEndpoint.color === startEndpoint.color &&
              endEndpoint.id !== startEndpoint.id &&
              !usedEndpointIds.has(endEndpoint.id) &&
              !usedEndpointIds.has(startEndpoint.id)
            ) {
              validEnd = true;
            }
          }

          if (validEnd && startEndpoint && endEndpoint) {
            console.log("VALID WIRE! Connected", first, "to", last);
            setCompletedPaths((prev) => [...prev, { points: pathPoints, color: pathColor }]);
            setUsedEndpointIds((prev) => {
              const updated = new Set(prev);
              updated.add(startEndpoint!.id);
              updated.add(endEndpoint!.id);
              return updated;
            });
          } else {
            console.log("Invalid wire — didn't end on a matching endpoint. Discarding.");
          }

          setIsDragging(false);
          setStartCell(null);
          setPathPoints([]);
        }}
      >
        <planeGeometry args={[1.6, 1.6]}>
          <instancedBufferAttribute attach="attributes-instanceColor" args={[colorArray, 3]} />
        </planeGeometry>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      {completedPaths.map((path, i) => (
        <Line
          key={i}
          points={path.points.map((p) => [
            (p.x - (gridWidth - 1) / 2) * spacing,
            -2.4,
            (p.z - (gridHeight - 1) / 2) * spacing,
          ])}
          color={path.color}
          lineWidth={5}
        />
      ))}

      {pathPoints.length > 1 && (
        <Line
          points={pathPoints.map((p) => [
            (p.x - (gridWidth - 1) / 2) * spacing,
            -2.4,
            (p.z - (gridHeight - 1) / 2) * spacing,
          ])}
          color={pathColor}
          lineWidth={5}
        />
      )}
    </>
  );
}