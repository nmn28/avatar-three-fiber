import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useMemo } from "react";
import { GLTFExporter } from "three-stdlib";
import { pb, useConfiguratorStore } from "../store";
import { Asset } from "./Asset";
import * as THREE from 'three';

// Performance optimization: Create reusable objects outside component
const tempVec = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();
const tempEuler = new THREE.Euler();
const tempMatrix = new THREE.Matrix4();

// Preload models
useGLTF.preload("/models/Armature.glb");
useGLTF.preload("/models/Poses.glb");

const processAsset = (document) => {
  delete document.animations;
  delete document.asset;
  delete document.scene.userData.gltfExtensions;
  return document;
};

// Custom hook for model loading and caching
const useModelCache = () => {
  return useMemo(() => {
    const armature = useGLTF("/models/Armature.glb", true);
    const poses = useGLTF("/models/Poses.glb", true);
    return {
      nodes: armature.nodes,
      animations: poses.animations
    };
  }, []);
};

export const Avatar = ({ ...props }) => {
  const group = useRef();
  const mixerRef = useRef();
  const actionsRef = useRef();
  const frameCount = useRef(0);
  const lastUpdate = useRef(0);
  const needsUpdate = useRef(false);
  
  // Memoize store selectors with shallow equality
  const pose = useConfiguratorStore(state => state.pose);
  const customization = useConfiguratorStore(state => state.customization, (a, b) => {
    if (!a || !b) return false;
    return Object.keys(a).length === Object.keys(b).length &&
           Object.keys(a).every(key => a[key]?.asset?.id === b[key]?.asset?.id);
  });
  const setDownload = useConfiguratorStore(state => state.setDownload);

  // Use cached models
  const { nodes, animations } = useModelCache();
  const { actions, mixer } = useAnimations(animations, group);

  // Initialize refs and optimizations
  useEffect(() => {
    if (!group.current || !mixer) return;
    
    mixerRef.current = mixer;
    actionsRef.current = actions;
    
    // Optimize static meshes
    group.current.traverse(obj => {
      if (obj.isMesh) {
        obj.matrixAutoUpdate = false;
        obj.frustumCulled = true;
        if (obj.geometry) {
          obj.geometry.computeBoundingSphere();
          obj.geometry.computeBoundingBox();
        }
      }
    });

    // Set lower update rate for mixer
    mixer.timeScale = 0.8;
    
    return () => {
      mixer.stopAllAction();
      Object.values(actions).forEach(action => action?.stop());
    };
  }, [mixer, actions]);

  // Optimized animation update
  useFrame((_, delta) => {
    frameCount.current++;
    
    const now = performance.now();
    const timeSinceLastUpdate = now - lastUpdate.current;
    
    // Update at 30fps and only if needed
    if (frameCount.current % 2 === 0 && (needsUpdate.current || timeSinceLastUpdate > 33.33)) {
      if (mixerRef.current) {
        mixerRef.current.update(delta * 1.2);
      }
      
      if (group.current) {
        group.current.updateMatrix();
      }
      
      lastUpdate.current = now;
      needsUpdate.current = false;
    }
  });

  // Handle pose changes with debouncing
  useEffect(() => {
    if (!actionsRef.current || !pose) return;

    const timeout = setTimeout(() => {
      const currentActions = actionsRef.current;
      
      // Stop all current actions
      Object.values(currentActions).forEach(action => {
        if (action?.stop) action.stop();
      });

      // Play the requested pose
      const currentAction = currentActions[pose];
      if (currentAction) {
        try {
          currentAction
            .reset()
            .setEffectiveTimeScale(0.8)
            .setEffectiveWeight(1)
            .fadeIn(0.3)
            .play();
          
          needsUpdate.current = true;
        } catch (error) {
          console.warn("Animation error:", error);
        }
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [pose]);

  // Optimized model export with caching
  const downloadHandler = useMemo(() => {
    let lastExport = null;
    let lastCustomization = null;

    return async () => {
      if (!group.current) return null;

      if (lastExport && lastCustomization === JSON.stringify(customization)) {
        return lastExport;
      }

      const cacheKey = JSON.stringify(customization);
      try {
        const cachedBlob = await pb.get(cacheKey);
        if (cachedBlob) {
          lastExport = new Blob([cachedBlob], { type: "model/gltf-binary" });
          lastCustomization = cacheKey;
          return lastExport;
        }

        const exporter = new GLTFExporter();
        const result = await new Promise((resolve, reject) => {
          exporter.parse(
            group.current,
            (result) => resolve(result),
            (error) => reject(error),
            {
              binary: true,
              animations: animations,
              includeCustomExtensions: true,
              onlyVisible: true,
              truncateDrawRange: true
            }
          );
        });

        const output = processAsset(result);
        const blob = new Blob([output], { type: "model/gltf-binary" });
        await pb.set(cacheKey, blob);
        
        lastExport = blob;
        lastCustomization = cacheKey;
        return blob;
      } catch (error) {
        console.error("Export error:", error);
        return null;
      }
    };
  }, [animations, customization]);

  useEffect(() => {
    setDownload(downloadHandler);
  }, [downloadHandler, setDownload]);

  // Memoized customization elements
  const customizationElements = useMemo(() => (
    Object.keys(customization)
      .map(key => customization[key]?.asset?.url && (
        <Suspense key={customization[key].asset.id} fallback={null}>
          <Asset
            nodes={nodes}
            item={customization[key]}
            skeleton={nodes.Plane.skeleton}
          />
        </Suspense>
      ))
      .filter(Boolean)
  ), [customization, nodes?.Plane?.skeleton]);

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group 
          name="Armature" 
          rotation={[Math.PI / 2, 0, 0]} 
          scale={0.01}
          matrixAutoUpdate={false}
        >
          <primitive object={nodes.mixamorigHips} />
          {customizationElements}
        </group>
      </group>
    </group>
  );
};
