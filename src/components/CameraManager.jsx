import { CameraControls } from "@react-three/drei";
import { button, useControls } from "leva";
import { useEffect, useRef, useMemo } from "react";
import { UI_MODES, useConfiguratorStore } from "../store";
import { Vector3 } from "three";

export const START_CAMERA_POSITION = [500, 10, 1000];
export const DEFAULT_CAMERA_POSITION = [-1, 1, 5];
export const DEFAULT_CAMERA_TARGET = [0, 0, 0];

// Pre-create vectors to avoid garbage collection
const startPosition = new Vector3(...START_CAMERA_POSITION);
const defaultPosition = new Vector3(...DEFAULT_CAMERA_POSITION);
const defaultTarget = new Vector3(...DEFAULT_CAMERA_TARGET);

export const CameraManager = ({ loading }) => {
  const controls = useRef();
  const currentCategory = useConfiguratorStore(
    (state) => state.currentCategory
  );
  const initialLoading = useConfiguratorStore((state) => state.loading);
  const mode = useConfiguratorStore((state) => state.mode);
  const lastUpdate = useRef(0);

  // Debug controls
  useControls({
    getCameraPosition: button(() => {
      if (!controls.current) return;
      const pos = controls.current.getPosition();
      console.log("Camera Position", [pos.x, pos.y, pos.z]);
    }),
    getCameraTarget: button(() => {
      if (!controls.current) return;
      const target = controls.current.getTarget();
      console.log("Camera Target", [target.x, target.y, target.z]);
    }),
  });

  // Memoize camera placement calculations
  const cameraPlacement = useMemo(() => {
    if (!currentCategory?.expand?.cameraPlacement) return null;
    
    const { position, target } = currentCategory.expand.cameraPlacement;
    return {
      position: new Vector3(...position),
      target: new Vector3(...target)
    };
  }, [currentCategory]);

  // Throttled camera updates
  useEffect(() => {
    if (!controls.current) return;

    const currentTime = performance.now();
    if (currentTime - lastUpdate.current < 16.67) return; // Limit to ~60fps

    if (initialLoading) {
      controls.current.setLookAt(
        startPosition.x, startPosition.y, startPosition.z,
        defaultTarget.x, defaultTarget.y, defaultTarget.z,
        false
      );
    } else if (
      !loading &&
      mode === UI_MODES.CUSTOMIZE &&
      cameraPlacement
    ) {
      const { position, target } = cameraPlacement;
      controls.current.setLookAt(
        position.x, position.y, position.z,
        target.x, target.y, target.z,
        true
      );
    } else {
      controls.current.setLookAt(
        defaultPosition.x, defaultPosition.y, defaultPosition.z,
        defaultTarget.x, defaultTarget.y, defaultTarget.z,
        true
      );
    }

    lastUpdate.current = currentTime;
  }, [currentCategory, mode, initialLoading, loading, cameraPlacement]);

  return (
    <CameraControls
      ref={controls}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 2}
      minDistance={2}
      maxDistance={8}
      smoothTime={0.25}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
    />
  );
};
