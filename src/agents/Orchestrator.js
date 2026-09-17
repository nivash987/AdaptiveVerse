import { TutorAgent } from "./TutorAgent.js";
import { AssessmentAgent } from "./AssessmentAgent.js";
import { AdaptationAgent, DIFFICULTY_LEVELS } from "./AdaptationAgent.js";

/**
 * MultiAgentOrchestrator - Central coordination layer connecting the Tutor Agent,
 * Assessment Agent, and Adaptation Agent with the application state.
 */
export class MultiAgentOrchestrator {
  constructor(options = {}) {
    const baseUrl = options.baseUrl || "http://localhost:3001";
    this.tutorAgent = new TutorAgent(baseUrl);
    this.assessmentAgent = new AssessmentAgent(baseUrl);
    this.adaptationAgent = new AdaptationAgent(
      options.difficultyLevels || DIFFICULTY_LEVELS,
    );
  }

  /**
   * Helper to create a normalized centralized student state object.
   *
   * @param {Object} [overrides]
   * @returns {Object}
   */
  createInitialStudentState(overrides = {}) {
    return {
      selectedSubject: "Artificial Intelligence",
      currentDifficulty: "beginner",
      difficulty: "beginner",
      questionsAnswered: 0,
      correctAnswers: 0,
      accuracy: 0,
      recentAttempts: [],
      strugglePoints: [],
      ...overrides,
    };
  }

  /**
   * Loads student historical progress and returns an updated student state.
   *
   * @param {Object} currentState - Current student state.
   * @returns {Promise<{ success: boolean, updatedState: Object, rawData?: Object, error?: string }>}
   */
  async loadStudentProgress(currentState = {}) {
    const progressResult = await this.assessmentAgent.fetchProgress();

    if (!progressResult.success || !progressResult.data) {
      return {
        success: false,
        updatedState: currentState,
        error: progressResult.error,
      };
    }

    const data = progressResult.data;
    const totalQuestions =
      data.totalQuestions ?? currentState.questionsAnswered ?? 0;
    const correctAnswers =
      data.correctAnswers ?? currentState.correctAnswers ?? 0;
    const accuracy =
      totalQuestions === 0
        ? 0
        : Math.round((correctAnswers / totalQuestions) * 100);

    const updatedState = {
      ...currentState,
      questionsAnswered: totalQuestions,
      correctAnswers: correctAnswers,
      accuracy,
      recentAttempts: data.recentAttempts || currentState.recentAttempts || [],
    };

    return {
      success: true,
      updatedState,
      rawData: data,
    };
  }

  /**
   * Routes a student conversational question to the TutorAgent.
   *
   * @param {string} question - Question from student.
   * @param {Object} studentState - Centralized student state.
   * @returns {Promise<{ success: boolean, response: string, error?: string }>}
   */
  async handleStudentQuestion(question, studentState = {}) {
    return await this.tutorAgent.askQuestion(question, studentState);
  }

  /**
   * Coordinates with the AssessmentAgent to generate a subject/difficulty targeted quiz question.
   *
   * @param {Object} studentState - Centralized student state.
   * @returns {Promise<{ success: boolean, question?: Object, error?: string }>}
   */
  async generateAssessment(studentState = {}) {
    return await this.assessmentAgent.generateQuestion(studentState);
  }

  /**
   * Processes a student's answer submission:
   * 1. Evaluates correctness via AssessmentAgent
   * 2. Computes adaptive difficulty and pedagogical action via AdaptationAgent
   * 3. Records attempt asynchronously in the database via AssessmentAgent
   *
   * @param {Object} quizQuestion - Active quiz question.
   * @param {string} selectedAnswer - Selected answer string.
   * @param {Object} studentState - Centralized student state before answer.
   * @returns {Promise<{
   *   isCorrect: boolean,
   *   nextDifficulty: string,
   *   decision: Object,
   *   feedbackMessage: string,
   *   attemptData: Object,
   *   updatedState: Object
   * }>}
   */
  async processAssessmentResult(
    quizQuestion,
    selectedAnswer,
    studentState = {},
  ) {
    const evaluation = this.assessmentAgent.evaluateAnswer(
      quizQuestion,
      selectedAnswer,
      studentState,
    );

    const decision = await this.adaptationAgent.decideNextStep(
      studentState,
      {
        isCorrect: evaluation.isCorrect,
        correctAnswer: quizQuestion.correctAnswer,
      },
    );

    const totalAnswered = (studentState.questionsAnswered || 0) + 1;
    const totalCorrect =
      (studentState.correctAnswers || 0) + (evaluation.isCorrect ? 1 : 0);
    const accuracy =
      totalAnswered === 0
        ? 0
        : Math.round((totalCorrect / totalAnswered) * 100);

    const updatedRecentAttempts = [
      evaluation.attemptData,
      ...(studentState.recentAttempts || []),
    ].slice(0, 15);

    const updatedState = {
      ...studentState,
      currentDifficulty: decision.nextDifficulty,
      difficulty: decision.nextDifficulty,
      questionsAnswered: totalAnswered,
      correctAnswers: totalCorrect,
      accuracy,
      recentAttempts: updatedRecentAttempts,
    };

    // Asynchronously record attempt to SQLite database
    try {
      await this.assessmentAgent.recordAttempt(evaluation.attemptData);
    } catch (err) {
      console.error("Orchestrator: Error persisting attempt:", err);
    }

    return {
      isCorrect: evaluation.isCorrect,
      nextDifficulty: decision.nextDifficulty,
      decision,
      feedbackMessage: decision.feedbackMessage,
      attemptData: evaluation.attemptData,
      updatedState,
    };
  }

  /**
   * Retrieves a learning recommendation from the AdaptationAgent.
   *
   * @param {Object} studentState - Centralized student state.
   * @returns {Object} Structured decision.
   */
  getNextLearningDecision(studentState = {}) {
    return this.adaptationAgent.recommendLearningAction(studentState);
  }
}

// Export singleton instance for app-wide use, as well as class
export const orchestrator = new MultiAgentOrchestrator();
export default orchestrator;
