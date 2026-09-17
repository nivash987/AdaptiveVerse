/**
 * TutorAgent - Responsible for pedagogical interaction, instructional dialogue,
 * and personalizing explanations using student learning state and context.
 *
 * Communicates with the backend proxy without exposing API keys to the frontend.
 */
export class TutorAgent {
  constructor(baseUrl = "http://localhost:3001") {
    this.baseUrl = baseUrl;
    this.sessionHistory = [];
  }

  /**
   * Generates a personalized tutoring response for the student.
   *
   * @param {string} studentQuestion - The question or message from the student.
   * @param {Object} studentState - The centralized student state.
   * @returns {Promise<{ success: boolean, response: string, error?: string }>}
   */
  async askQuestion(studentQuestion, studentState = {}) {
    if (!studentQuestion || typeof studentQuestion !== "string" || !studentQuestion.trim()) {
      return {
        success: false,
        response: "Please enter a valid question or message.",
        error: "Empty question",
      };
    }

    const payload = {
      message: studentQuestion.trim(),
      selectedSubject: studentState.selectedSubject || "Artificial Intelligence",
      difficulty: studentState.currentDifficulty || studentState.difficulty || "beginner",
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chatgpt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error ||
          "Teacher AI is temporarily unavailable. Check the Gemini API configuration or model availability.";
        console.error("TutorAgent API Error:", errorMessage);

        return {
          success: false,
          response: errorMessage,
          error: errorMessage,
        };
      }

      const data = await response.json();
      const tutorText =
        data.response || "I'm sorry, I could not generate an explanation at this time.";

      this.sessionHistory.push({
        user: studentQuestion.trim(),
        bot: tutorText,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        response: tutorText,
      };
    } catch (error) {
      console.error("TutorAgent Network Error:", error);
      return {
        success: false,
        response:
          "Unable to connect to the AdaptiveVerse backend. Make sure the backend is running on port 3001.",
        error: error.message || "Network error",
      };
    }
  }

  /**
   * Retrieves conversation history recorded by this agent in the current session.
   */
  getHistory() {
    return [...this.sessionHistory];
  }

  /**
   * Clears the current session history.
   */
  clearHistory() {
    this.sessionHistory = [];
  }
}

export default TutorAgent;
