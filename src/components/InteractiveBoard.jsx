import { useState } from "react";
import PropTypes from "prop-types";
import { Html } from "@react-three/drei";

/**
 * InteractiveBoard - 3D Classroom Smartboard
 *
 * Sized and positioned on the front teaching wall above the teacher podium.
 * Displays live curriculum context, Q-learning telemetry, and supports interactive quiz participation.
 */
export const InteractiveBoard = ({
  learningState,
  qTelemetry,
  onGenerateQuiz,
  quizLoading,
  onOpenChat,
  quizQuestion,
  selectedOption,
  onSelectOption,
  onSubmitAnswer,
  quizFeedback,
}) => {
  const [hovered, setHovered] = useState(false);

  const subject = learningState?.selectedSubject || "Artificial Intelligence";
  const difficulty =
    learningState?.difficulty || learningState?.currentDifficulty || "beginner";
  const accuracy = learningState?.accuracy ?? 0;
  const questionsAnswered = learningState?.questionsAnswered ?? 0;
  const correctAnswers = learningState?.correctAnswers ?? 0;
  const qState = qTelemetry?.state || "init";
  const qAction = qTelemetry?.action || "none";
  const qReward = qTelemetry?.reward ?? 0;

  return (
    <group position={[3.5, 0.5, -14.5]} rotation={[0, -0.22, 0]}>
      {/* 3D Smartboard Outer Metallic Frame */}
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[6.2, 4.2, 0.14]} />
        <meshStandardMaterial
          color={hovered ? "#0284c7" : "#0f172a"}
          roughness={0.25}
          metalness={0.7}
        />
      </mesh>

      {/* 3D Smartboard Screen Display Surface */}
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[6.0, 4.0]} />
        <meshBasicMaterial color="#0b1329" />
      </mesh>

      {/* Interactive 3D Digital Screen Interface */}
      <Html
        transform
        distanceFactor={5.2}
        position={[0, 0, 0.1]}
        className="interactive-3d-board"
        style={{ pointerEvents: "auto" }}
      >
        <div
          style={{
            width: "480px",
            padding: "20px",
            background: "rgba(11, 19, 41, 0.95)",
            border: `2px solid ${hovered ? "#38bdf8" : "#0284c7"}`,
            borderRadius: "18px",
            color: "#ffffff",
            fontFamily: "system-ui, -apple-system, sans-serif",
            boxShadow: "0 0 35px rgba(2, 132, 199, 0.35)",
            userSelect: "none",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #1e293b",
              paddingBottom: "10px",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>🖥️</span>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: "800",
                  letterSpacing: "0.5px",
                  color: "#38bdf8",
                }}
              >
                CLASSROOM SMARTBOARD
              </span>
            </div>
            <span
              style={{
                fontSize: "11px",
                background: "#0284c7",
                color: "#ffffff",
                padding: "3px 8px",
                borderRadius: "12px",
                fontWeight: "700",
              }}
            >
              VR ACTIVE
            </span>
          </div>

          {/* Curriculum & Reinforcement Learning Telemetry */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              fontSize: "13px",
              lineHeight: "1.5",
              color: "#cbd5e1",
              background: "rgba(15, 23, 42, 0.6)",
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid #1e293b",
            }}
          >
            <div>
              <strong style={{ color: "#94a3b8" }}>Subject:</strong>
              <div style={{ color: "#f8fafc", fontWeight: "700" }}>{subject}</div>
            </div>
            <div>
              <strong style={{ color: "#94a3b8" }}>Difficulty:</strong>
              <div
                style={{
                  color:
                    difficulty === "advanced"
                      ? "#f43f5e"
                      : difficulty === "intermediate"
                        ? "#fbbf24"
                        : "#34d399",
                  fontWeight: "800",
                  textTransform: "capitalize",
                }}
              >
                {difficulty}
              </div>
            </div>
            <div>
              <strong style={{ color: "#94a3b8" }}>Performance:</strong>
              <div style={{ color: "#f8fafc", fontWeight: "700" }}>
                {accuracy}% ({correctAnswers}/{questionsAnswered})
              </div>
            </div>
            <div>
              <strong style={{ color: "#94a3b8" }}>RL Policy Action:</strong>
              <div style={{ color: "#38bdf8", fontWeight: "700" }}>{qAction}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              color: "#94a3b8",
              display: "flex",
              justifyContent: "space-between",
              padding: "4px 8px",
            }}
          >
            <span>
              <strong>State:</strong> <code>{qState}</code>
            </span>
            <span>
              <strong>Reward:</strong>{" "}
              <span
                style={{
                  color: qReward >= 0 ? "#34d399" : "#f43f5e",
                  fontWeight: "800",
                }}
              >
                {qReward >= 0 ? `+${qReward}` : qReward}
              </span>
            </span>
          </div>

          {/* Active 3D Quiz Display on Board */}
          {quizQuestion && (
            <div
              style={{
                marginTop: "12px",
                background: "rgba(15, 23, 42, 0.9)",
                border: "1px solid #0284c7",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "800",
                  color: "#38bdf8",
                  marginBottom: "6px",
                }}
              >
                📝 Active Quiz Question ({difficulty}):
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#f8fafc",
                  marginBottom: "10px",
                  lineHeight: "1.4",
                }}
              >
                {quizQuestion.question}
              </div>

              {Array.isArray(quizQuestion.options) && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "6px",
                    marginBottom: "10px",
                  }}
                >
                  {quizQuestion.options.slice(0, 4).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onSelectOption && onSelectOption(option)}
                      style={{
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: "600",
                        textAlign: "left",
                        background:
                          selectedOption === option
                            ? "#0284c7"
                            : "rgba(30, 41, 59, 0.8)",
                        border: `1px solid ${selectedOption === option ? "#38bdf8" : "#334155"}`,
                        borderRadius: "8px",
                        color: "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {onSubmitAnswer && (
                <button
                  type="button"
                  onClick={onSubmitAnswer}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#ffffff",
                    fontWeight: "800",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Submit Answer
                </button>
              )}

              {quizFeedback && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: quizFeedback.includes("Correct")
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(244, 63, 94, 0.2)",
                    border: `1px solid ${quizFeedback.includes("Correct") ? "#10b981" : "#f43f5e"}`,
                    color: "#ffffff",
                    fontWeight: "600",
                  }}
                >
                  {quizFeedback}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onGenerateQuiz) onGenerateQuiz();
              }}
              disabled={quizLoading}
              style={{
                flex: 1,
                padding: "10px",
                background: quizLoading
                  ? "#475569"
                  : "linear-gradient(135deg, #f43f5e, #e11d48)",
                border: "none",
                borderRadius: "10px",
                color: "#ffffff",
                fontWeight: "800",
                fontSize: "13px",
                cursor: quizLoading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(244, 63, 94, 0.4)",
                transition: "all 0.2s ease",
              }}
            >
              {quizLoading ? "⚡ Generating..." : "⚡ Generate 3D Quiz"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenChat) onOpenChat();
              }}
              style={{
                flex: 1,
                padding: "10px",
                background: "linear-gradient(135deg, #0284c7, #2563eb)",
                border: "none",
                borderRadius: "10px",
                color: "#ffffff",
                fontWeight: "800",
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.4)",
                transition: "all 0.2s ease",
              }}
            >
              💬 Ask Teacher
            </button>
          </div>
        </div>
      </Html>
    </group>
  );
};

InteractiveBoard.propTypes = {
  learningState: PropTypes.object,
  qTelemetry: PropTypes.object,
  onGenerateQuiz: PropTypes.func,
  quizLoading: PropTypes.bool,
  onOpenChat: PropTypes.func,
  quizQuestion: PropTypes.object,
  selectedOption: PropTypes.string,
  onSelectOption: PropTypes.func,
  onSubmitAnswer: PropTypes.func,
  quizFeedback: PropTypes.string,
};

export default InteractiveBoard;
