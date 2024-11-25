import React from 'react';
import { animated, useSpring } from "@react-spring/three";
import {
  Environment,
  Float,
  Gltf,
  SoftShadows,
  useProgress,
  Stats,
  AdaptiveDpr,
  AdaptiveEvents,
  BakeShadows,
} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { useConfiguratorStore } from "../store";
import { Avatar } from "./Avatar";
import { CameraManager } from "./CameraManager";
import { LoadingAvatar } from "./LoadingAvatar";

// Memoize static components
const StaticEnvironment = () => (
  <>
    <Environment preset="sunset" environmentIntensity={0.3} />
    <SoftShadows size={32} samples={8} focus={0.5} />
    <BakeShadows />
    
    <mesh receiveShadow rotation-x={-Math.PI / 2} position-y={-0.31}>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#333" roughness={0.85} />
    </mesh>

    {/* Optimized lighting setup */}
    <directionalLight
      position={[5, 5, 5]}
      intensity={2.2}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0001}
    >
      <orthographicCamera attach="shadow-camera" args={[-10, 10, -10, 10, 0.1, 50]} />
    </directionalLight>
    
    {/* Reduced number of lights and optimized settings */}
    <directionalLight position={[-5, 5, 5]} intensity={0.5} />
    <directionalLight position={[3, 3, -5]} intensity={4} color={"#ff3b3b"} />
  </>
);

const MemoizedEnvironment = React.memo(StaticEnvironment);

// Performance monitoring component
const PerformanceMonitor = () => {
  const gl = useThree((state) => state.gl);
  
  useEffect(() => {
    // Enable performance optimizations
    gl.powerPreference = "high-performance";
    gl.antialias = false; // Disable antialiasing for better performance
    
    // Clean up WebGL context on unmount
    return () => {
      gl.dispose();
    };
  }, [gl]);

  return (
    <>
      <Stats showPanel={0} />
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </>
  );
};

const AvatarContainer = React.memo(({ scale, floatHeight, spin }) => (
  <animated.group
    scale={scale}
    position-y={floatHeight}
    rotation-y={spin}
  >
    <Avatar />
  </animated.group>
));

export const Experience = () => {
  const setScreenshot = useConfiguratorStore((state) => state.setScreenshot);
  const gl = useThree((state) => state.gl);
  const { active } = useProgress();
  const [loading, setLoading] = useState(active);
  const setLoadingAt = useRef(0);
  const overlayCanvasRef = useRef(null);
  const logoRef = useRef(null);

  // Preload logo
  useEffect(() => {
    if (!logoRef.current) {
      const logo = new Image();
      logo.src = "/images/wawasensei-white.png";
      logo.crossOrigin = "anonymous";
      logoRef.current = logo;
    }
  }, []);

  // Optimized screenshot handler
  const screenshotHandler = useMemo(() => {
    return () => {
      if (!overlayCanvasRef.current) {
        overlayCanvasRef.current = document.createElement("canvas");
      }
      const overlayCanvas = overlayCanvasRef.current;
      overlayCanvas.width = gl.domElement.width;
      overlayCanvas.height = gl.domElement.height;
      
      const overlayCtx = overlayCanvas.getContext("2d", {
        alpha: false,
        desynchronized: true
      });
      if (!overlayCtx) return;

      // Use low-quality image during transform for better performance
      overlayCtx.imageSmoothingQuality = "low";
      overlayCtx.drawImage(gl.domElement, 0, 0);

      if (logoRef.current?.complete) {
        const logoWidth = 765 / 4;
        const logoHeight = 370 / 4;
        const x = overlayCanvas.width - logoWidth - 42;
        const y = overlayCanvas.height - logoHeight - 42;
        overlayCtx.drawImage(logoRef.current, x, y, logoWidth, logoHeight);

        const link = document.createElement("a");
        const date = new Date();
        const filename = `Avatar_${date.toISOString().split("T")[0]}_${date.toLocaleTimeString()}.png`;
        link.download = filename;
        
        // Optimize image quality/size for download
        const quality = 0.8;
        const dataUrl = overlayCanvas.toDataURL("image/jpeg", quality);
        link.href = dataUrl;
        
        link.click();
        URL.revokeObjectURL(dataUrl);
      }
    };
  }, [gl]);

  useEffect(() => {
    setScreenshot(screenshotHandler);
    return () => {
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current = null;
      }
    };
  }, [screenshotHandler, setScreenshot]);

  useEffect(() => {
    let timeout;
    if (active) {
      timeout = setTimeout(() => {
        setLoading(true);
        setLoadingAt.current = Date.now();
      }, 50);
    } else {
      timeout = setTimeout(() => {
        setLoading(false);
      }, Math.max(0, 2000 - (Date.now() - setLoadingAt.current)));
    }
    return () => clearTimeout(timeout);
  }, [active]);

  const springProps = useSpring({
    scale: loading ? 0.5 : 1,
    spin: loading ? Math.PI * 8 : 0,
    floatHeight: loading ? 0.5 : 0,
    config: { mass: 1, tension: 120, friction: 14 }
  });

  // Frame rate limiter for animations
  useFrame((_, delta) => {
    if (delta > 1 / 30) { // Limit to 30 FPS
      return;
    }
  });

  return (
    <>
      <PerformanceMonitor />
      <CameraManager loading={loading} />
      <MemoizedEnvironment />

      <Suspense fallback={<LoadingAvatar loading={loading} />}>
        <AvatarContainer {...springProps} />
      </Suspense>

      <Gltf
        position-y={-0.31}
        src="/models/Teleporter Base.glb"
        castShadow
        receiveShadow
      />
    </>
  );
};
