/**
 * AssessmentAgent - Responsible for quiz question generation, rubric scoring,
 * answer evaluation, and tracking assessment attempts with the backend store.
 */
export class AssessmentAgent {
  constructor(baseUrl = "http://localhost:3001") {
    this.baseUrl = baseUrl;
  }

  /**
   * Validates whether a generated quiz question meets expected shape and constraints.
   *
   * @param {Object} question - The raw question object.
   * @returns {boolean}
   */
  isValidQuestion(question) {
    return (
      Boolean(question) &&
      typeof question.question === "string" &&
      question.question.trim().length > 0 &&
      Array.isArray(question.options) &&
      question.options.length === 4 &&
      typeof question.correctAnswer === "string" &&
      question.options.includes(question.correctAnswer)
    );
  }

  /**
   * Requests a new adaptive quiz question from the backend.
   *
   * @param {Object} studentState - The student's current learning state.
   * @returns {Promise<{ success: boolean, question?: Object, error?: string }>}
   */
  async generateQuestion(studentState = {}) {
    const subject = studentState.selectedSubject || "Artificial Intelligence";
    const difficulty =
      studentState.currentDifficulty || studentState.difficulty || "beginner";

    try {
      const response = await fetch(`${this.baseUrl}/api/generate-quiz-question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedSubject: subject,
          difficulty: difficulty,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || "Gemini quiz generation is temporarily unavailable.";
        console.error("AssessmentAgent generateQuestion error:", errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      const questionData = await response.json();

      if (!this.isValidQuestion(questionData)) {
        console.error(
          "AssessmentAgent: Received malformed question structure:",
          questionData,
        );
        return {
          success: false,
          error: "Quiz response could not be parsed. Please try again.",
        };
      }

      return {
        success: true,
        question: questionData,
      };
    } catch (error) {
      console.error("AssessmentAgent Network Error:", error);
      return {
        success: false,
        error:
          "Quiz service is unavailable. Check the AdaptiveVerse backend.",
      };
    }
  }

  /**
   * Evaluates a submitted answer against the active quiz question.
   *
   * @param {Object} quizQuestion - The active quiz question object.
   * @param {string} selectedAnswer - The option selected by the student.
   * @param {Object} studentState - The student state context.
   * @returns {{ isCorrect: boolean, attemptData: Object }}
   */
  evaluateAnswer(quizQuestion, selectedAnswer, studentState = {}) {
    if (!quizQuestion || !quizQuestion.correctAnswer) {
      throw new Error("No active quiz question available for evaluation.");
    }

    const isCorrect = selectedAnswer === quizQuestion.correctAnswer;
    const subject =
      studentState.selectedSubject || quizQuestion.subject || "Artificial Intelligence";
    const difficulty =
      studentState.currentDifficulty ||
      studentState.difficulty ||
      quizQuestion.difficulty ||
      "beginner";

    const attemptData = {
      subject,
      difficulty,
      question: quizQuestion.question,
      selectedAnswer: selectedAnswer || "",
      correctAnswer: quizQuestion.correctAnswer,
      isCorrect,
      timestamp: new Date().toISOString(),
    };

    return {
      isCorrect,
      attemptData,
    };
  }

  /**
   * Persists an assessment attempt to the backend SQLite database.
   *
   * @param {Object} attemptData - The evaluated attempt record.
   * @returns {Promise<{ success: boolean, attemptId?: number, error?: string }>}
   */
  async recordAttempt(attemptData) {
    try {
      const response = await fetch(`${this.baseUrl}/api/progress/attempt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attemptData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        attemptId: result.attemptId,
      };
    } catch (error) {
      console.error("AssessmentAgent recordAttempt error:", error);
      return {
        success: false,
        error: error.message || "Network error while saving attempt",
      };
    }
  }

  /**
   * Fetches the student's historical progress and performance metrics from the backend.
   *
   * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
   */
  async fetchProgress() {
    try {
      const response = await fetch(`${this.baseUrl}/api/progress`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("AssessmentAgent fetchProgress error:", error);
      return {
        success: false,
        error: error.message || "Failed to load progress",
      };
    }
  }
}

export default AssessmentAgent;
