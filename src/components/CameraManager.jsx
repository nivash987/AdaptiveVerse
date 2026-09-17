import { useEffect, useRef } from "react";
import { CameraControls } from "@react-three/drei";

/**
 * CameraManager - Manages the classroom camera perspective.
 *
 * Starts the student at a natural front-classroom desk viewpoint with clear sightlines
 * to Teacher Emilian, the front Smartboard, desks, and classroom environment.
 */
export const CameraManager = () => {
  const controls = useRef();

  useEffect(() => {
    // Natural seated student viewpoint in front row looking forward at Teacher & Smartboard
    controls.current?.setLookAt(0, -1.8, 6.0, 0, -2.5, -12.0, false);
  }, []);

  return (
    <CameraControls
      ref={controls}
      minDistance={1.5}
      maxDistance={25}
      minPolarAngle={Math.PI / 12}
      maxPolarAngle={Math.PI / 2 + 0.1}
      mouseButtons={{
        left: 1, // orbit around teaching focal point
        wheel: 16, // smooth zoom
        right: 2, // pan
      }}
      touches={{
        one: 32,
        two: 512,
      }}
    />
  );
};

export default CameraManager;
