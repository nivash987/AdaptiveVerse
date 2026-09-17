import { useState, Suspense } from "react";
import PropTypes from "prop-types";
import { Environment, Html } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Emilian } from "../../public/models/Emilian";
import { Classroom } from "../../public/models/Classroom";
import { CameraManager } from "./CameraManager";
import { InteractiveBoard } from "./InteractiveBoard";

export const Experience = ({
  learningState,
  qTelemetry,
  onOpenChat,
  onGenerateQuiz,
  quizLoading,
  onCanvasCreated,
  quizQuestion,
  selectedOption,
  onSelectOption,
  onSubmitAnswer,
  quizFeedback,
}) => {
  const [teacherHovered, setTeacherHovered] = useState(false);

  const handleTeacherClick = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (onOpenChat) onOpenChat();
  };

  return (
    <Canvas
      className="canvas"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
      }}
      camera={{ position: [0, -1.8, 6.0], fov: 50 }}
      onCreated={({ gl }) => {
        if (gl && gl.xr) {
          gl.xr.enabled = true;
        }
        if (onCanvasCreated) {
          onCanvasCreated(gl);
        }
      }}
    >
      <CameraManager />

      {/* Natural Classroom Lighting System */}
      <Environment preset="city" />
      <ambientLight intensity={1.0} color="#ffffff" />
      <directionalLight
        position={[6, 14, 8]}
        intensity={1.8}
        color="#fffcf5"
        castShadow
      />
      {/* Front Classroom Teaching Zone Illumination */}
      <pointLight
        position={[0, 4.0, -10]}
        intensity={1.5}
        distance={35}
        color="#f0f9ff"
      />
      {/* Student Seating Zone Illumination */}
      <pointLight
        position={[0, 3.5, 4]}
        intensity={0.9}
        distance={25}
        color="#ffffff"
      />

      <Suspense fallback={null}>
        {/* 3D Classroom Environment */}
        <Classroom position={[0, -8, 0]} rotation={[0, Math.PI, 0]} />

        {/* 3D Classroom Interactive Smartboard */}
        <InteractiveBoard
          learningState={learningState}
          qTelemetry={qTelemetry}
          onGenerateQuiz={onGenerateQuiz}
          quizLoading={quizLoading}
          onOpenChat={onOpenChat}
          quizQuestion={quizQuestion}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
          onSubmitAnswer={onSubmitAnswer}
          quizFeedback={quizFeedback}
        />

        {/* Teacher Emilian - Scaled and Positioned at the Teaching Podium */}
        <group
          position={[-3.5, -7.95, -11.0]}
          rotation={[0, 0.45, 0]}
          onClick={handleTeacherClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            setTeacherHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setTeacherHovered(false);
            document.body.style.cursor = "auto";
          }}
        >
          {/* Teacher 3D Avatar Model */}
          <Emilian scale={[7, 7, 7]} position={[0, 0, 0]} />

          {/* Invisible raycast hit box ensuring easy clickability */}
          <mesh
            position={[0, 3.8, 0]}
            onClick={handleTeacherClick}
          >
            <boxGeometry args={[3.2, 7.6, 3.2]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Floating Interaction Tooltip above Teacher's Head */}
          <Html position={[0, 4.2, 0]} center distanceFactor={14} style={{ pointerEvents: "auto" }}>
            <div
              onClick={handleTeacherClick}
              style={{
                background: teacherHovered
                  ? "linear-gradient(135deg, #f43f5e, #e11d48)"
                  : "rgba(15, 23, 42, 0.92)",
                border: `2px solid ${teacherHovered ? "#ffffff" : "#38bdf8"}`,
                color: "#ffffff",
                padding: "7px 16px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: "800",
                whiteSpace: "nowrap",
                cursor: "pointer",
                boxShadow: teacherHovered
                  ? "0 0 25px rgba(244, 63, 94, 0.8)"
                  : "0 4px 16px rgba(0, 0, 0, 0.5)",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: teacherHovered ? "scale(1.12)" : "scale(1.0)",
                userSelect: "none",
                pointerEvents: "auto",
              }}
            >
              💬 Teacher Emilian (Click to Talk)
            </div>
          </Html>
        </group>
      </Suspense>
    </Canvas>
  );
};

Experience.propTypes = {
  learningState: PropTypes.object,
  qTelemetry: PropTypes.object,
  onOpenChat: PropTypes.func,
  onGenerateQuiz: PropTypes.func,
  quizLoading: PropTypes.bool,
  onCanvasCreated: PropTypes.func,
  quizQuestion: PropTypes.object,
  selectedOption: PropTypes.string,
  onSelectOption: PropTypes.func,
  onSubmitAnswer: PropTypes.func,
  quizFeedback: PropTypes.string,
};

export default Experience;
