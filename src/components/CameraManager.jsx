import { useEffect, useRef } from "react";
import { CameraControls } from "@react-three/drei";

export const CameraManager = () => {
  const controls = useRef();

  useEffect(() => {
    controls.current?.setLookAt(0, 2, 24, -4, -6, -8, false);
  }, []);

  return (
    <CameraControls
      ref={controls}
      minZoom={1}
      maxZoom={3}
      mouseButtons={{
        left: 1,
        wheel: 16,
      }}
      touches={{
        one: 32,
        two: 512,
      }}
    />
  );
};
