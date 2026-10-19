import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { createModelGeometry } from "@climbed/geometry";
import type { ModelDefinition } from "@climbed/contracts";
function Model({ model }: { model: ModelDefinition }) {
  const geometry = useMemo(() => createModelGeometry(model), [model]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={model.color} roughness={0.78} />
    </mesh>
  );
}
export function ModelPreview({ model }: { model: ModelDefinition }) {
  const size = Math.max(...model.dimensions);
  return (
    <div className="catalog-model-preview" data-testid="catalog-model-preview">
      <Canvas
        key={`${model.id}-${size}`}
        camera={{
          position: [size * 1.7, size * 1.2, size * 2.4],
          fov: 40,
          near: 0.001,
          far: 200,
        }}
        shadows
        dpr={[1, 1.5]}
      >
        <color attach="background" args={["#edf0e7"]} />
        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#ffffff", "#a2b38b", 1]} />
        <directionalLight position={[3, 5, 8]} intensity={2} castShadow />
        <Model model={model} />
        <OrbitControls
          makeDefault
          target={[0, 0, model.dimensions[2] / 2]}
          minDistance={size * 0.8}
          maxDistance={size * 10}
        />
      </Canvas>
      <span className="preview-instruction">
        Glisser pour tourner · Molette pour zoomer
      </span>
    </div>
  );
}
