import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { orchestrator } from "../../agents";
import "./Chat.css";

export const Chat = ({ learningState, isOpen, onToggle }) => {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [internalShow, setInternalShow] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const activeRequestIdRef = useRef(0);

  const showInput = isOpen !== undefined ? isOpen : internalShow;

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  // Central Speech Synthesis Stop Helper
  const stopSpeech = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  };

  // voice assistance
  const startListening = () => {
    if (!SpeechRecognitionAPI) {
      setSpeechError(
        "Voice input is not available in this browser. Please use Chrome or Edge, or type your question.",
      );
      return;
    }

    setSpeechError(null);

    // Stop any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let combined = "";
        for (let i = 0; i < event.results.length; i++) {
          combined += event.results[i][0].transcript;
        }
        transcriptRef.current = combined;
        setUserInput(combined);
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition notice:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setSpeechError(
            "Microphone access blocked. Please allow microphone permissions in browser settings.",
          );
        } else if (event.error !== "no-speech") {
          setSpeechError(`Voice input: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Speech recognition start failed:", err);
      setSpeechError("Could not start voice recognition. Please try typing.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  };

  const speak = (text) => {
    if (!text) return;
    stopSpeech();
    const synthesis = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synthesis) return;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.pitch = 1;
      utterance.rate = 1;
      synthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis notice:", err);
    }
  };

  // Stop active speech and recognition when chat is closed via props
  useEffect(() => {
    if (isOpen === false) {
      activeRequestIdRef.current++;
      stopSpeech();
      stopListening();
    }
  }, [isOpen]);

  // Clean up recognition instance and TTS on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      stopListening();
    };
  }, []);

  const handleUserInput = (e) => {
    setUserInput(e.target.value);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!userInput.trim()) return;

    const currentQuestion = userInput.trim();
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);

    try {
      const result = await orchestrator.handleStudentQuestion(
        currentQuestion,
        learningState,
      );

      // Async safety check: ignore if request was cancelled or superseded
      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      const generatedText = result.response;
      setChatHistory((prev) => [
        ...prev,
        { user: currentQuestion, bot: generatedText },
      ]);
      setUserInput("");
      transcriptRef.current = "";

      // Play text-to-speech for newly arrived response
      speak(generatedText);
    } catch (error) {
      if (requestId !== activeRequestIdRef.current) return;

      console.error("Chat: Error delegating question to TutorAgent via Orchestrator:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          user: currentQuestion,
          bot: "Sorry, I encountered an error while contacting Teacher Emilian.",
        },
      ]);
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleClose = () => {
    activeRequestIdRef.current++;
    stopSpeech();
    stopListening();
    if (onToggle) {
      onToggle(false);
    } else {
      setInternalShow(false);
    }
  };

  const toggleInput = () => {
    if (showInput) {
      handleClose();
    } else {
      if (onToggle) {
        onToggle(true);
      } else {
        setInternalShow(true);
      }
    }
  };

  const handleClear = () => {
    activeRequestIdRef.current++;
    stopSpeech();
    stopListening();
    setChatHistory([]);
    setUserInput("");
    transcriptRef.current = "";
    setSpeechError(null);
  };

  return (
    <div
      className="chat-component"
      data-selected-subject={learningState.selectedSubject}
    >
      <button className="chat-button" onClick={toggleInput} type="button">
        {showInput ? "Close Chat (T)" : "💬 Ask Teacher (T)"}
      </button>
      {showInput && (
        <div className={`chat-box ${showInput ? "show" : ""}`}>
          <div id="container">
            <div className="container-inner">
              <div className="content">
                {chatHistory.length === 0 ? (
                  <p className="welcome-message">
                    Welcome to the 3D Classroom! Ask Teacher Emilian a question
                    about {learningState.selectedSubject || "AI"}.
                  </p>
                ) : (
                  chatHistory.map((chat, index) => (
                    <div key={index}>
                      <p className="user-message">
                        <strong>You:</strong> {chat.user}
                      </p>
                      <p className="teacher-response">
                        <strong>Teacher Emilian:</strong> {chat.bot}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="input-container">
                <form onSubmit={handleSubmit}>
                  <input
                    type="text"
                    value={userInput}
                    onChange={handleUserInput}
                    placeholder="Type your question..."
                    required
                  />
                  {SpeechRecognitionAPI ? (
                    <button
                      type="button"
                      className={`voice-record-btn ${isListening ? "listening" : ""}`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        startListening();
                      }}
                      onPointerUp={(e) => {
                        e.preventDefault();
                        stopListening();
                      }}
                      onPointerLeave={() => {
                        if (isListening) stopListening();
                      }}
                      onPointerCancel={() => {
                        if (isListening) stopListening();
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        startListening();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        stopListening();
                      }}
                      title="Hold to speak, release to stop"
                    >
                      {isListening ? "🔴 Listening..." : "🎙️ Hold to Speak"}
                    </button>
                  ) : (
                    <div className="voice-unsupported-badge" title="Voice recognition not supported in this browser. Please use Chrome/Edge.">
                      🎙️ Mic Unavailable
                    </div>
                  )}
                  <button type="submit" disabled={loading}>
                    <i className="send-icon">{loading ? "Sending..." : "➤"}</i>
                    <span>Send</span>
                  </button>
                </form>
              </div>
              {speechError && (
                <div
                  style={{
                    color: "#ffe4e6",
                    background: "rgba(225, 29, 72, 0.8)",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    marginTop: "8px",
                    textAlign: "center",
                  }}
                >
                  ⚠️ {speechError}
                </div>
              )}
              {chatHistory.length > 0 && (
                <div className="buttons">
                  <button
                    type="button"
                    className="stop-speech-action"
                    onClick={stopSpeech}
                    title="Stop text-to-speech immediately"
                  >
                    ⏹️ Stop Speaking
                  </button>
                  <button
                    type="button"
                    className="confirm"
                    onClick={handleClose}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="cancel"
                    onClick={handleClear}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

Chat.propTypes = {
  learningState: PropTypes.shape({
    selectedSubject: PropTypes.string.isRequired,
    difficulty: PropTypes.string,
    currentDifficulty: PropTypes.string,
  }).isRequired,
  isOpen: PropTypes.bool,
  onToggle: PropTypes.func,
};

export default Chat;
