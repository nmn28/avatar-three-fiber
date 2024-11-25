import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { useConfiguratorStore } from "../store";

// Cache for materials to avoid recreating them
const materialCache = new Map();

export const Asset = ({ url, categoryName, skeleton }) => {
  const meshRef = useRef();
  const { scene } = useGLTF(url);
  const customization = useConfiguratorStore((state) => state.customization);
  const lockedGroups = useConfiguratorStore((state) => state.lockedGroups);
  const assetColor = customization[categoryName].color;
  const skin = useConfiguratorStore((state) => state.skin);

  // Memoize material updates to avoid unnecessary scene traversals
  const updateMaterials = useMemo(() => {
    const colorMaterials = new Set();
    scene.traverse((child) => {
      if (child.isMesh && child.material?.name.includes("Color_")) {
        const cacheKey = `${child.material.name}-${assetColor}`;
        if (!materialCache.has(cacheKey)) {
          const newMaterial = child.material.clone();
          newMaterial.color.set(assetColor);
          materialCache.set(cacheKey, newMaterial);
        }
        colorMaterials.add(cacheKey);
      }
    });
    return colorMaterials;
  }, [scene, assetColor]);

  // Apply cached materials
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.traverse((child) => {
        if (child.isMesh && child.material?.name.includes("Color_")) {
          const cacheKey = `${child.material.name}-${assetColor}`;
          child.material = materialCache.get(cacheKey);
        }
      });
    }
  }, [updateMaterials]);

  // Cleanup materials on unmount
  useEffect(() => {
    return () => {
      updateMaterials.forEach(cacheKey => {
        const material = materialCache.get(cacheKey);
        if (material && !material.isDisposed) {
          material.dispose();
          materialCache.delete(cacheKey);
        }
      });
    };
  }, [updateMaterials]);

  const attachedItems = useMemo(() => {
    const items = [];
    scene.traverse((child) => {
      if (child.isMesh) {
        items.push({
          geometry: child.geometry,
          material: child.material.name.includes("Skin_") ? skin : child.material,
          morphTargetDictionary: child.morphTargetDictionary,
          morphTargetInfluences: child.morphTargetInfluences,
        });
      }
    });
    return items;
  }, [scene, skin]);

  if (lockedGroups[categoryName]) {
    return null;
  }

  return attachedItems.map((item, index) => (
    <skinnedMesh
      ref={meshRef}
      frustumCulled={true}
      key={index}
      geometry={item.geometry}
      material={item.material}
      skeleton={skeleton}
      morphTargetDictionary={item.morphTargetDictionary}
      morphTargetInfluences={item.morphTargetInfluences}
    />
  ));
};
