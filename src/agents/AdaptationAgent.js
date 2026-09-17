import {
  QLearningAgent,
  qLearningAgent,
  Q_ACTIONS,
} from "./QLearningAgent.js";

/**
 * AdaptationAgent - Adaptive pedagogical agent powered by local Reinforcement Learning (Q-Learning).
 *
 * Replaces deterministic difficulty rules with a trained Q-Learning policy that optimizes
 * educational actions (difficulty scaling, conceptual explanations, foundational reviews)
 * based on student state and reward feedback.
 */
export const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"];

export class AdaptationAgent {
  constructor(options = {}) {
    this.difficultyLevels = options.difficultyLevels || DIFFICULTY_LEVELS;
    this.qLearning = options.qLearning || qLearningAgent;
  }

  /**
   * Helper to clamp and shift difficulty levels.
   *
   * @param {string} currentDifficulty
   * @param {number} delta - +1 for increase, -1 for decrease, 0 for maintain
   * @returns {string}
   */
  shiftDifficulty(currentDifficulty, delta) {
    const currentIndex = this.difficultyLevels.indexOf(currentDifficulty);
    const validIndex = currentIndex >= 0 ? currentIndex : 0;
    const targetIndex = Math.min(
      Math.max(validIndex + delta, 0),
      this.difficultyLevels.length - 1,
    );
    return this.difficultyLevels[targetIndex];
  }

  /**
   * Decides the next educational action using the local Q-Learning policy,
   * computes reward feedback, updates the Q-table, and returns the decision.
   *
   * @param {Object} studentState - Centralized student state.
   * @param {Object} evaluation - { isCorrect: boolean, correctAnswer?: string }
   * @returns {Promise<{
   *   nextDifficulty: string,
   *   recommendedSubject: string,
   *   recommendedAction: string,
   *   reason: string,
   *   feedbackMessage: string,
   *   qLearningMeta: Object
   * }>}
   */
  async decideNextStep(studentState = {}, evaluation = {}) {
    const currentDifficulty =
      studentState.currentDifficulty || studentState.difficulty || "beginner";
    const selectedSubject =
      studentState.selectedSubject || "Artificial Intelligence";
    const isCorrect = Boolean(evaluation.isCorrect);
    const correctAnswer = evaluation.correctAnswer || "";

    // 1. Encode current state
    const stateKey = this.qLearning.encodeState(studentState, evaluation);

    // 2. Select action via Q-learning policy (ε-greedy)
    const selection = this.qLearning.selectAction(stateKey, true);
    const action = selection.action;

    // 3. Map Q-learning action to pedagogical application outcome
    let nextDifficulty = currentDifficulty;
    let recommendedAction = "quiz";
    let reason = "";
    let feedbackMessage = "";

    switch (action) {
      case Q_ACTIONS.INCREASE_DIFFICULTY:
        nextDifficulty = this.shiftDifficulty(currentDifficulty, 1);
        recommendedAction = "quiz";
        reason = `Q-Learning policy selected [${action}] (Q=${selection.qValue}) based on state [${stateKey}].`;
        if (isCorrect) {
          feedbackMessage =
            nextDifficulty !== currentDifficulty
              ? `Correct! Q-Learning policy advanced your challenge to ${nextDifficulty}!`
              : "Correct! Outstanding mastery at the advanced level!";
        } else {
          feedbackMessage = `Incorrect. Correct answer: ${correctAnswer}. Q-Learning is testing higher difficulty adaptation.`;
        }
        break;

      case Q_ACTIONS.DECREASE_DIFFICULTY:
        nextDifficulty = this.shiftDifficulty(currentDifficulty, -1);
        recommendedAction = "quiz";
        reason = `Q-Learning policy selected [${action}] (Q=${selection.qValue}) to relieve cognitive strain.`;
        if (isCorrect) {
          feedbackMessage = `Correct! Q-Learning consolidated learning at ${nextDifficulty} difficulty.`;
        } else {
          feedbackMessage = `Incorrect. Correct answer: ${correctAnswer}. Q-Learning stepped down difficulty to ${nextDifficulty} for core reinforcement.`;
        }
        break;

      case Q_ACTIONS.EXPLAIN:
        nextDifficulty = currentDifficulty;
        recommendedAction = "explanation";
        reason = `Q-Learning policy selected [${action}] (Q=${selection.qValue}) to provide targeted concept explanation.`;
        if (isCorrect) {
          feedbackMessage = "Correct! Q-Learning suggests asking Teacher Emilian for deeper conceptual context.";
        } else {
          feedbackMessage = `Incorrect. Correct answer: ${correctAnswer}. Let's ask Teacher Emilian to explain this concept in detail.`;
        }
        break;

      case Q_ACTIONS.REVIEW:
        nextDifficulty = this.shiftDifficulty(currentDifficulty, -1);
        recommendedAction = "review";
        reason = `Q-Learning policy selected [${action}] (Q=${selection.qValue}) for foundational review.`;
        feedbackMessage = isCorrect
          ? `Correct! Reviewing foundational concepts to reinforce retention at ${nextDifficulty}.`
          : `Incorrect. Correct answer: ${correctAnswer}. Reviewing foundational principles to eliminate misconceptions.`;
        break;

      case Q_ACTIONS.MAINTAIN_DIFFICULTY:
      default:
        nextDifficulty = currentDifficulty;
        recommendedAction = "quiz";
        reason = `Q-Learning policy selected [${action}] (Q=${selection.qValue}) to build consistency at current difficulty.`;
        feedbackMessage = isCorrect
          ? `Correct! Reinforcing proficiency at the ${currentDifficulty} level.`
          : `Incorrect. Correct answer: ${correctAnswer}. Let's try another question at ${currentDifficulty} level.`;
        break;
    }

    // 4. Calculate reward
    const reward = this.qLearning.calculateReward(studentState, evaluation, action);

    // 5. Predict next state and perform Bellman Q-value update
    const predictedNextState = {
      ...studentState,
      currentDifficulty: nextDifficulty,
      difficulty: nextDifficulty,
      questionsAnswered: (studentState.questionsAnswered || 0) + 1,
      correctAnswers: (studentState.correctAnswers || 0) + (isCorrect ? 1 : 0),
    };
    const nextStateKey = this.qLearning.encodeState(predictedNextState, null);

    const updateInfo = await this.qLearning.updateQValue(
      stateKey,
      action,
      reward,
      nextStateKey,
    );

    return {
      nextDifficulty,
      recommendedSubject: selectedSubject,
      recommendedAction,
      reason,
      feedbackMessage,
      qLearningMeta: {
        mode: "Q-Learning",
        state: stateKey,
        action,
        isExploration: selection.isExploration,
        reward,
        qValue: updateInfo.qValue,
        priorQ: updateInfo.priorQ,
        delta: updateInfo.delta,
        epsilon: this.qLearning.epsilon,
        learningRate: this.qLearning.learningRate,
        discountFactor: this.qLearning.discountFactor,
      },
    };
  }

  /**
   * Generates a proactive learning recommendation using the Q-learning policy.
   *
   * @param {Object} studentState
   * @returns {Object}
   */
  recommendLearningAction(studentState = {}) {
    const stateKey = this.qLearning.encodeState(studentState);
    const selection = this.qLearning.selectAction(stateKey, false); // greedy exploitation
    const currentDifficulty =
      studentState.currentDifficulty || studentState.difficulty || "beginner";

    let nextDifficulty = currentDifficulty;
    let recommendedAction = "quiz";

    if (selection.action === Q_ACTIONS.INCREASE_DIFFICULTY) {
      nextDifficulty = this.shiftDifficulty(currentDifficulty, 1);
    } else if (
      selection.action === Q_ACTIONS.DECREASE_DIFFICULTY ||
      selection.action === Q_ACTIONS.REVIEW
    ) {
      nextDifficulty = this.shiftDifficulty(currentDifficulty, -1);
      if (selection.action === Q_ACTIONS.REVIEW) recommendedAction = "review";
    } else if (selection.action === Q_ACTIONS.EXPLAIN) {
      recommendedAction = "explanation";
    }

    return {
      nextDifficulty,
      recommendedSubject: studentState.selectedSubject || "Artificial Intelligence",
      recommendedAction,
      reason: `Q-Learning policy recommendation (State=${stateKey}, Action=${selection.action}, Q=${selection.qValue})`,
      qLearningMeta: {
        mode: "Q-Learning",
        state: stateKey,
        action: selection.action,
        qValue: selection.qValue,
        epsilon: this.qLearning.epsilon,
      },
    };
  }
}

export default AdaptationAgent;
