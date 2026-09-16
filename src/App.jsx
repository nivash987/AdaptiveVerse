import "./App.css";
import Experience from "./components/Experience";
import { Chat } from "./components/chat/Chat";

import React from "react";

const subjects = ["Artificial Intelligence", "Machine Learning"];
const difficultyLevels = ["beginner", "intermediate", "advanced"];

const getNextDifficulty = (currentDifficulty, isCorrect) => {
  const currentIndex = difficultyLevels.indexOf(currentDifficulty);
  const nextIndex = isCorrect ? currentIndex + 1 : currentIndex - 1;
  const clampedIndex = Math.min(
    Math.max(nextIndex, 0),
    difficultyLevels.length - 1,
  );

  return difficultyLevels[clampedIndex];
};

const App = () => {
  const [learningState, setLearningState] = React.useState({
    selectedSubject: "Artificial Intelligence",
    difficulty: "beginner",
    questionsAnswered: 0,
    correctAnswers: 0,
  });
  const [quizQuestion, setQuizQuestion] = React.useState(null);
  const [selectedOption, setSelectedOption] = React.useState("");
  const [quizFeedback, setQuizFeedback] = React.useState("");
  const [quizLoading, setQuizLoading] = React.useState(false);
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
        const response = await fetch("http://localhost:3001/api/progress");
        if (response.ok) {
          const data = await response.json();
          setLearningState((currentState) => ({
            ...currentState,
            questionsAnswered:
              data.totalQuestions ?? currentState.questionsAnswered,
            correctAnswers: data.correctAnswers ?? currentState.correctAnswers,
          }));
        }
      } catch (error) {
        console.error("Error fetching student progress:", error);
      }
    };

    fetchProgress();
  }, []);

  const generateQuizQuestion = async () => {
    setQuizLoading(true);
    setSelectedOption("");
    setQuizFeedback("");

    try {
      const response = await fetch(
        "http://localhost:3001/api/generate-quiz-question",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedSubject: learningState.selectedSubject,
            difficulty: learningState.difficulty,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setQuizQuestion(null);
        setQuizFeedback(
          errorData.error || "Failed to generate quiz question. Please try again.",
        );
        setQuizLoading(false);
        return;
      }

      const question = await response.json();
      if (
        !question ||
        !question.question ||
        !Array.isArray(question.options) ||
        !question.correctAnswer
      ) {
        setQuizQuestion(null);
        setQuizFeedback("Invalid quiz format received. Please try again.");
      } else {
        setQuizQuestion(question);
      }
    } catch (error) {
      console.error("Error generating quiz question:", error);
      setQuizQuestion(null);
      setQuizFeedback(
        "Unable to connect to the quiz server. Please check your connection.",
      );
    }

    setQuizLoading(false);
  };

  const submitQuizAnswer = () => {
    if (!quizQuestion || !quizQuestion.correctAnswer) {
      return;
    }

    if (!selectedOption) {
      setQuizFeedback("Please select an answer before submitting.");
      return;
    }

    const isCorrect = selectedOption === quizQuestion.correctAnswer;
    const nextDifficulty = getNextDifficulty(
      learningState.difficulty,
      isCorrect,
    );

    let feedbackMessage = "";
    if (isCorrect) {
      if (learningState.difficulty === "beginner") {
        feedbackMessage =
          "Correct! Great work on the fundamentals. Moving up to intermediate!";
      } else if (learningState.difficulty === "intermediate") {
        feedbackMessage =
          "Correct! Excellent conceptual grasp. Advancing to advanced questions!";
      } else {
        feedbackMessage =
          "Correct! Outstanding mastery at the advanced level!";
      }
    } else {
      if (learningState.difficulty === "advanced") {
        feedbackMessage = `Incorrect. Correct answer: ${quizQuestion.correctAnswer}. Stepping down to intermediate to reinforce core principles.`;
      } else if (learningState.difficulty === "intermediate") {
        feedbackMessage = `Incorrect. Correct answer: ${quizQuestion.correctAnswer}. Reviewing foundational concepts at beginner level.`;
      } else {
        feedbackMessage = `Incorrect. Correct answer: ${quizQuestion.correctAnswer}. Let's review this concept before trying another question.`;
      }
    }

    setQuizFeedback(feedbackMessage);

    const attemptData = {
      subject: learningState.selectedSubject,
      difficulty: learningState.difficulty,
      question: quizQuestion.question,
      selectedAnswer: selectedOption,
      correctAnswer: quizQuestion.correctAnswer,
      isCorrect: isCorrect,
      timestamp: new Date().toISOString(),
    };

    setLearningState((currentState) => ({
      ...currentState,
      difficulty: nextDifficulty,
      questionsAnswered: currentState.questionsAnswered + 1,
      correctAnswers: currentState.correctAnswers + (isCorrect ? 1 : 0),
    }));

    fetch("http://localhost:3001/api/progress/attempt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(attemptData),
    }).catch((error) => {
      console.error("Error persisting quiz attempt:", error);
    });
  };

  return (
    <>
      <Experience />
      <div className="subject-panel">
        <p className="subject-panel-title">Subject</p>
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
      <div className="quiz-panel">
        <p className="quiz-panel-title">Quiz</p>
        <button
          className="quiz-generate-button"
          type="button"
          onClick={generateQuizQuestion}
          disabled={quizLoading}
        >
          {quizLoading ? "Generating..." : "Generate Question"}
        </button>
        {quizQuestion && Array.isArray(quizQuestion.options) && (
          <div className="quiz-content">
            <p className="quiz-question">{quizQuestion.question}</p>
            <div className="quiz-options">
              {quizQuestion.options.slice(0, 4).map((option) => (
                <button
                  key={option}
                  className={`quiz-option ${
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
              className="quiz-submit-button"
              type="button"
              onClick={submitQuizAnswer}
            >
              Submit
            </button>
            {quizFeedback && <p className="quiz-feedback">{quizFeedback}</p>}
          </div>
        )}
        {!quizQuestion && quizFeedback && (
          <p className="quiz-feedback">{quizFeedback}</p>
        )}
      </div>
      <div className="progress-panel">
        <p className="progress-panel-title">Progress</p>
        <p>Questions Answered: {learningState.questionsAnswered}</p>
        <p>Correct Answers: {learningState.correctAnswers}</p>
        <p>Accuracy: {accuracy}%</p>
        <p>Current Difficulty: {learningState.difficulty}</p>
        <p>Selected Subject: {learningState.selectedSubject}</p>
      </div>
      <Chat
        learningState={learningState}
        setLearningState={setLearningState}
      />
    </>
  );
};

export default App;
