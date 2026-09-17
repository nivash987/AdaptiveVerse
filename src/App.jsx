import "./App.css";
import Experience from "./components/Experience";
import { Chat } from "./components/chat/Chat";
import { orchestrator, qLearningAgent } from "./agents";
import { requestImmersiveVRSession, isWebXRAvailable } from "./utils/webxr";
import React from "react";

const subjects = ["Artificial Intelligence", "Machine Learning"];

const App = () => {
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [learningState, setLearningState] = React.useState(() =>
    orchestrator.createInitialStudentState({
      selectedSubject: "Artificial Intelligence",
      difficulty: "beginner",
      currentDifficulty: "beginner",
    }),
  );
  const [quizQuestion, setQuizQuestion] = React.useState(null);
  const [selectedOption, setSelectedOption] = React.useState("");
  const [quizFeedback, setQuizFeedback] = React.useState("");
  const [quizLoading, setQuizLoading] = React.useState(false);
  const [qTelemetry, setQTelemetry] = React.useState(() =>
    qLearningAgent.getTelemetry(),
  );
  const [vrModalMessage, setVrModalMessage] = React.useState(null);
  const glRendererRef = React.useRef(null);

  const accuracy =
    learningState.questionsAnswered === 0
      ? 0
      : Math.round(
          (learningState.correctAnswers / learningState.questionsAnswered) *
            100,
        );

  React.useEffect(() => {
    const fetchProgress = async () => {
      try {
        const result = await orchestrator.loadStudentProgress();
        if (result.success && result.rawData) {
          setLearningState((currentState) => {
            const data = result.rawData;
            const totalQuestions =
              data.totalQuestions ?? currentState.questionsAnswered ?? 0;
            const correctAnswers =
              data.correctAnswers ?? currentState.correctAnswers ?? 0;
            const calculatedAccuracy =
              totalQuestions === 0
                ? 0
                : Math.round((correctAnswers / totalQuestions) * 100);

            return {
              ...currentState,
              questionsAnswered: totalQuestions,
              correctAnswers: correctAnswers,
              accuracy: calculatedAccuracy,
              recentAttempts:
                data.recentAttempts || currentState.recentAttempts || [],
            };
          });
        }
      } catch (error) {
        console.error("App: Error fetching student progress via Orchestrator:", error);
      }
    };

    fetchProgress();
  }, []);

  const generateQuizQuestion = React.useCallback(async () => {
    setQuizLoading(true);
    setSelectedOption("");
    setQuizFeedback("");

    try {
      const result = await orchestrator.generateAssessment(learningState);

      if (!result.success || !result.question) {
        setQuizQuestion(null);
        setQuizFeedback(
          result.error || "Failed to generate quiz question. Please try again.",
        );
      } else {
        setQuizQuestion(result.question);
      }
    } catch (error) {
      console.error("App: Error generating quiz question via Orchestrator:", error);
      setQuizQuestion(null);
      setQuizFeedback(
        "Unable to connect to the quiz server. Please check your connection.",
      );
    }

    setQuizLoading(false);
  }, [learningState]);

  const submitQuizAnswer = async () => {
    if (!quizQuestion || !quizQuestion.correctAnswer) {
      return;
    }

    if (!selectedOption) {
      setQuizFeedback("Please select an answer before submitting.");
      return;
    }

    try {
      const result = await orchestrator.processAssessmentResult(
        quizQuestion,
        selectedOption,
        learningState,
      );

      setQuizFeedback(result.feedbackMessage);
      setLearningState(result.updatedState);

      if (result.decision?.qLearningMeta) {
        setQTelemetry(result.decision.qLearningMeta);
      } else {
        setQTelemetry(qLearningAgent.getTelemetry());
      }
    } catch (error) {
      console.error("App: Error processing quiz answer via Orchestrator:", error);
      setQuizFeedback("An error occurred while evaluating your answer.");
    }
  };

  const handleEnterVR = async () => {
    const sessionResult = await requestImmersiveVRSession(
      glRendererRef.current,
    );
    if (!sessionResult.success) {
      setVrModalMessage(
        sessionResult.message ||
          "Immersive VR is unavailable on this device. Desktop VR Simulation is active.",
      );
    }
  };

  // Keyboard shortcut listener
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore when user is actively typing in a text field
      if (
        e.target &&
        (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (e.key === "t" || e.key === "T") {
        setIsChatOpen((prev) => !prev);
      } else if (e.key === "q" || e.key === "Q") {
        generateQuizQuestion();
      } else if (e.key === "v" || e.key === "V") {
        handleEnterVR();
      } else if (e.key === "Escape") {
        setVrModalMessage(null);
        setIsChatOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [generateQuizQuestion]);

  const activeDifficulty =
    learningState.difficulty || learningState.currentDifficulty || "beginner";
  const formattedDifficulty =
    activeDifficulty.charAt(0).toUpperCase() + activeDifficulty.slice(1);

  return (
    <div className="app-viewport">
      {/* Primary 3D Virtual Classroom View */}
      <Experience
        learningState={learningState}
        qTelemetry={qTelemetry}
        onOpenChat={() => setIsChatOpen(true)}
        onGenerateQuiz={generateQuizQuestion}
        quizLoading={quizLoading}
        onCanvasCreated={(gl) => {
          glRendererRef.current = gl;
        }}
        quizQuestion={quizQuestion}
        selectedOption={selectedOption}
        onSelectOption={(opt) => {
          setSelectedOption(opt);
          setQuizFeedback("");
        }}
        onSubmitAnswer={submitQuizAnswer}
        quizFeedback={quizFeedback}
      />

      {/* Transparent HUD Container: z-index: 10 */}
      <main className="main-hud">
        {/* Top Glassmorphism Navigation Bar */}
        <div className="top-banner">
          <div className="top-banner-brand">
            <span>🎓</span> ADAPTIVEVERSE
          </div>
          <div className="top-banner-badges">
            <span className="top-badge badge-desktop">● Desktop 3D Mode</span>
            <span className="top-badge badge-rl">● Q-Learning Active</span>
            <span className="top-badge badge-webxr">
              ● {isWebXRAvailable() ? "WebXR Detected" : "WebXR Ready"}
            </span>
          </div>
          <div className="top-banner-actions">
            <div className="top-hotkeys-hint">
              <span><kbd>Q</kbd> Quiz</span>
              <span><kbd>T</kbd> Chat</span>
              <span><kbd>V</kbd> VR</span>
            </div>
            <button
              type="button"
              className="enter-vr-button"
              onClick={handleEnterVR}
            >
              🥽 ENTER VR (V)
            </button>
          </div>
        </div>

        {/* Left Glassmorphism Learning HUD */}
        <aside className="left-hud-panel">
          {/* Prominent Floating Ask Teacher Button */}
          <button
            type="button"
            className="ask-teacher-btn"
            onClick={() => setIsChatOpen(true)}
          >
            <span>💬</span> Ask Teacher (T)
          </button>

          {/* Subject Card */}
          <div className="hud-card subject-card">
            <p className="subject-card-title">SUBJECT</p>
            <div className="subject-options">
              {subjects.map((subject) => (
                <button
                  key={subject}
                  className={`subject-option ${
                    learningState.selectedSubject === subject ? "active" : ""
                  }`}
                  type="button"
                  onClick={() =>
                    setLearningState((currentState) => ({
                      ...currentState,
                      selectedSubject: subject,
                    }))
                  }
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>

          {/* Adaptive Quiz Card */}
          <div className="hud-card quiz-card">
            <div className="quiz-card-header">
              <span className="quiz-card-title">ADAPTIVE QUIZ</span>
              <button
                className="quiz-generate-btn"
                type="button"
                onClick={generateQuizQuestion}
                disabled={quizLoading}
              >
                {quizLoading ? "Generating..." : "⚡ Generate (Q)"}
              </button>
            </div>

            {quizQuestion && Array.isArray(quizQuestion.options) && (
              <div className="quiz-content-area">
                <p className="quiz-question-text">{quizQuestion.question}</p>
                <div className="quiz-options-grid">
                  {quizQuestion.options.slice(0, 4).map((option) => (
                    <button
                      key={option}
                      className={`quiz-opt-btn ${
                        selectedOption === option ? "active" : ""
                      }`}
                      type="button"
                      onClick={() => {
                        setSelectedOption(option);
                        setQuizFeedback("");
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <button
                  className="quiz-submit-action"
                  type="button"
                  onClick={submitQuizAnswer}
                >
                  Submit Answer
                </button>
                {quizFeedback && (
                  <div className="quiz-feedback-box">{quizFeedback}</div>
                )}
              </div>
            )}

            {!quizQuestion && quizFeedback && (
              <div className="quiz-feedback-box">{quizFeedback}</div>
            )}
          </div>

          {/* Student Progress Card */}
          <div className="hud-card progress-card">
            <p className="progress-card-title">STUDENT PROGRESS</p>
            <div className="progress-grid">
              <div className="progress-grid-item">
                <span className="progress-label">Answered:</span>
                <span className="progress-value">{learningState.questionsAnswered}</span>
              </div>
              <div className="progress-grid-item">
                <span className="progress-label">Correct:</span>
                <span className="progress-value">{learningState.correctAnswers}</span>
              </div>
              <div className="progress-grid-item">
                <span className="progress-label">Accuracy:</span>
                <span className="progress-value font-bold">{accuracy}%</span>
              </div>
              <div className="progress-grid-item">
                <span className="progress-label">Difficulty:</span>
                <span className="progress-value val-difficulty">{formattedDifficulty}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Glassmorphism Adaptive RL Telemetry Card */}
        <aside className="rl-panel">
          <p className="rl-panel-title">🤖 Adaptive RL (Q-Learning)</p>
          <div className="rl-grid">
            <div className="rl-row">
              <span className="rl-label">Mode:</span>
              <span className="rl-val">Tabular Q-Learning (Local)</span>
            </div>
            <div className="rl-row">
              <span className="rl-label">State (s):</span>
              <code className="rl-code">{qTelemetry.state || "init"}</code>
            </div>
            <div className="rl-row">
              <span className="rl-label">Last Action (a):</span>
              <code className="rl-code">{qTelemetry.action || "none"}</code>
            </div>
            <div className="rl-row">
              <span className="rl-label">Reward (r):</span>
              <span
                className={
                  (qTelemetry.reward ?? 0) >= 0
                    ? "rl-reward-pos"
                    : "rl-reward-neg"
                }
              >
                {(qTelemetry.reward ?? 0) >= 0
                  ? `+${qTelemetry.reward ?? 0}`
                  : qTelemetry.reward}
              </span>
            </div>
            <div className="rl-row">
              <span className="rl-label">Exploration (ε):</span>
              <span className="rl-val">
                {Math.round((qTelemetry.epsilon ?? 0.2) * 100)}%
              </span>
            </div>
            <div className="rl-row">
              <span className="rl-label">Q-Value Q(s,a):</span>
              <span className="rl-val">
                {Number(qTelemetry.qValue ?? 0).toFixed(4)}
              </span>
            </div>
          </div>
        </aside>
      </main>

      {/* WebXR Fallback Modal */}
      {vrModalMessage && (
        <div
          className="vr-modal-backdrop"
          onClick={() => setVrModalMessage(null)}
        >
          <div className="vr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vr-modal-icon">🥽</div>
            <h3 className="vr-modal-title">WebXR Status</h3>
            <p className="vr-modal-text">{vrModalMessage}</p>
            <button
              type="button"
              className="vr-modal-btn"
              onClick={() => setVrModalMessage(null)}
            >
              Continue in Desktop Simulation
            </button>
          </div>
        </div>
      )}

      {/* Tutor Agent Interactive Chatbox */}
      <Chat
        learningState={learningState}
        isOpen={isChatOpen}
        onToggle={(val) => setIsChatOpen(val)}
      />
    </div>
  );
};

export default App;
