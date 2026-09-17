/**
 * QLearningAgent - Local Reinforcement Learning Agent for Adaptive Learning.
 *
 * Implements tabular Q-learning with:
 * - Deterministic discrete state encoder
 * - Configurable educational action space
 * - Epsilon-greedy action selection
 * - Grounded reward function
 * - SQLite backend persistence with local fallback
 *
 * Bellman update rule:
 * Q(s, a) = Q(s, a) + α * [r + γ * max_a'(Q(s', a')) - Q(s, a)]
 */

export const Q_ACTIONS = {
  INCREASE_DIFFICULTY: "increase_difficulty",
  MAINTAIN_DIFFICULTY: "maintain_difficulty",
  DECREASE_DIFFICULTY: "decrease_difficulty",
  EXPLAIN: "explain",
  REVIEW: "review",
};

export const ACTION_LIST = Object.values(Q_ACTIONS);

export const DEFAULT_HYPERPARAMETERS = {
  learningRate: 0.1, // α: rate of value adjustment
  discountFactor: 0.9, // γ: value of future expected rewards
  epsilon: 0.2, // ε: exploration probability in ε-greedy
  baseUrl: "http://localhost:3001",
};

export class QLearningAgent {
  constructor(config = {}) {
    this.learningRate =
      typeof config.learningRate === "number"
        ? config.learningRate
        : DEFAULT_HYPERPARAMETERS.learningRate;
    this.discountFactor =
      typeof config.discountFactor === "number"
        ? config.discountFactor
        : DEFAULT_HYPERPARAMETERS.discountFactor;
    this.epsilon =
      typeof config.epsilon === "number"
        ? config.epsilon
        : DEFAULT_HYPERPARAMETERS.epsilon;
    this.baseUrl = config.baseUrl || DEFAULT_HYPERPARAMETERS.baseUrl;

    // In-memory Q-Table: { [stateKey: string]: { [action: string]: number } }
    this.qTable = {};
    this.isLoaded = false;
    this.lastTelemetry = {
      state: "init",
      action: "none",
      reward: 0,
      qValue: 0,
      epsilon: this.epsilon,
      timestamp: new Date().toISOString(),
    };

    // Auto-load persisted Q-table
    this.loadQTable();
  }

  /**
   * Encodes student state into a discrete, deterministic string representation.
   * State format: `${difficulty}:${performanceTier}:${recentResult}:${struggleTier}`
   *
   * @param {Object} studentState
   * @param {Object} [evaluation]
   * @returns {string}
   */
  encodeState(studentState = {}, evaluation = null) {
    const difficulty =
      studentState.currentDifficulty || studentState.difficulty || "beginner";

    // Performance tier
    const answered = studentState.questionsAnswered || 0;
    const accuracy =
      answered === 0
        ? 0
        : studentState.accuracy !== undefined
          ? studentState.accuracy
          : Math.round(((studentState.correctAnswers || 0) / answered) * 100);

    let performanceTier = "none";
    if (answered > 0) {
      if (accuracy >= 75) performanceTier = "high";
      else if (accuracy >= 50) performanceTier = "med";
      else performanceTier = "low";
    }

    // Recent result
    let recentResult = "none";
    if (evaluation && typeof evaluation.isCorrect === "boolean") {
      recentResult = evaluation.isCorrect ? "correct" : "incorrect";
    } else if (
      Array.isArray(studentState.recentAttempts) &&
      studentState.recentAttempts.length > 0
    ) {
      recentResult = studentState.recentAttempts[0].isCorrect
        ? "correct"
        : "incorrect";
    }

    // Struggle tier (calculated from consecutive incorrect answers)
    let consecutiveIncorrect = 0;
    if (Array.isArray(studentState.recentAttempts)) {
      for (const attempt of studentState.recentAttempts) {
        if (!attempt.isCorrect) consecutiveIncorrect += 1;
        else break;
      }
    }
    if (evaluation && evaluation.isCorrect === false && recentResult === "incorrect") {
      consecutiveIncorrect = Math.max(1, consecutiveIncorrect);
    }

    let struggleTier = "low";
    if (consecutiveIncorrect >= 2) struggleTier = "high";
    else if (consecutiveIncorrect === 1) struggleTier = "med";

    return `${difficulty}:${performanceTier}:${recentResult}:${struggleTier}`;
  }

  /**
   * Initializes default Q-values (0.0) for unseen state.
   *
   * @param {string} stateKey
   */
  ensureStateInitialized(stateKey) {
    if (!this.qTable[stateKey]) {
      this.qTable[stateKey] = {};
      for (const action of ACTION_LIST) {
        this.qTable[stateKey][action] = 0.0;
      }
    }
  }

  /**
   * Returns the Q-value for a given state-action pair.
   *
   * @param {string} stateKey
   * @param {string} action
   * @returns {number}
   */
  getQValue(stateKey, action) {
    this.ensureStateInitialized(stateKey);
    return this.qTable[stateKey][action] ?? 0.0;
  }

  /**
   * Returns all Q-values for a given state.
   *
   * @param {string} stateKey
   * @returns {Object}
   */
  getQValuesForState(stateKey) {
    this.ensureStateInitialized(stateKey);
    return { ...this.qTable[stateKey] };
  }

  /**
   * Finds max_a' Q(state', a') for the next state.
   *
   * @param {string} nextStateKey
   * @returns {number}
   */
  getMaxQ(nextStateKey) {
    this.ensureStateInitialized(nextStateKey);
    const values = Object.values(this.qTable[nextStateKey]);
    return values.length > 0 ? Math.max(...values) : 0.0;
  }

  /**
   * Selects an action using ε-greedy strategy.
   *
   * @param {string} stateKey
   * @param {boolean} [explore=true] - Whether to allow exploration
   * @returns {{ action: string, isExploration: boolean, qValue: number }}
   */
  selectAction(stateKey, explore = true) {
    this.ensureStateInitialized(stateKey);

    const isExploration = explore && Math.random() < this.epsilon;

    if (isExploration) {
      const randomIndex = Math.floor(Math.random() * ACTION_LIST.length);
      const action = ACTION_LIST[randomIndex];
      const qValue = this.getQValue(stateKey, action);

      return {
        action,
        isExploration: true,
        qValue,
      };
    }

    // Exploitation: Pick action with highest Q-value
    const stateActions = this.qTable[stateKey];
    let bestAction = ACTION_LIST[0];
    let maxQ = -Infinity;

    for (const action of ACTION_LIST) {
      const qVal = stateActions[action] ?? 0.0;
      if (qVal > maxQ) {
        maxQ = qVal;
        bestAction = action;
      }
    }

    return {
      action: bestAction,
      isExploration: false,
      qValue: maxQ === -Infinity ? 0.0 : maxQ,
    };
  }

  /**
   * Calculates the pedagogical reward function based on student performance and action suitability.
   *
   * Reward Structure:
   * - Base correctness: +5.0 (correct) / -5.0 (incorrect)
   * - High mastery streak: +5.0 bonus (total +10.0)
   * - Repeated struggle: -3.0 penalty (total -8.0)
   * - Policy alignment:
   *    * Advancing when mastery is shown: +2.0
   *    * Remediation (review/explain/decrease) when struggling: +2.0
   *    * Advancing while struggling: -4.0 penalty
   *
   * @param {Object} studentState
   * @param {Object} evaluation - { isCorrect: boolean }
   * @param {string} selectedAction
   * @returns {number}
   */
  calculateReward(studentState = {}, evaluation = {}, selectedAction = "") {
    const isCorrect = Boolean(evaluation.isCorrect);
    let reward = 0;

    if (isCorrect) {
      reward += 5.0;

      // Bonus for consecutive correct answers
      const answered = studentState.questionsAnswered || 0;
      const correct = studentState.correctAnswers || 0;
      if (answered >= 2 && correct / answered >= 0.75) {
        reward += 5.0; // Strong learning improvement
      }

      // Action alignment
      if (selectedAction === Q_ACTIONS.INCREASE_DIFFICULTY) {
        reward += 2.0;
      }
    } else {
      reward -= 5.0;

      // Repeated struggle penalty
      const recentAttempts = studentState.recentAttempts || [];
      const consecutiveMisses = recentAttempts.filter((a) => !a.isCorrect).length;
      if (consecutiveMisses >= 2) {
        reward -= 3.0; // Repeated struggle (-8 total)
      }

      // Action alignment when struggling
      if (
        selectedAction === Q_ACTIONS.DECREASE_DIFFICULTY ||
        selectedAction === Q_ACTIONS.EXPLAIN ||
        selectedAction === Q_ACTIONS.REVIEW
      ) {
        reward += 2.0; // Proper pedagogical remediation
      } else if (selectedAction === Q_ACTIONS.INCREASE_DIFFICULTY) {
        reward -= 4.0; // Inappropriate difficulty increase during struggle
      }
    }

    return Math.round(reward * 100) / 100;
  }

  /**
   * Updates the Q-value using Bellman Equation and persists the update.
   *
   * Q(s, a) = Q(s, a) + α * [r + γ * max_a'(Q(s', a')) - Q(s, a)]
   *
   * @param {string} stateKey - Current state
   * @param {string} action - Action executed
   * @param {number} reward - Calculated reward
   * @param {string} nextStateKey - Subsequent state
   * @returns {Promise<{ qValue: number, priorQ: number, delta: number }>}
   */
  async updateQValue(stateKey, action, reward, nextStateKey) {
    this.ensureStateInitialized(stateKey);
    this.ensureStateInitialized(nextStateKey);

    const priorQ = this.getQValue(stateKey, action);
    const maxNextQ = this.getMaxQ(nextStateKey);

    const target = reward + this.discountFactor * maxNextQ;
    const delta = this.learningRate * (target - priorQ);
    const newQ = Math.round((priorQ + delta) * 10000) / 10000;

    this.qTable[stateKey][action] = newQ;

    // Update telemetry
    this.lastTelemetry = {
      state: stateKey,
      action,
      reward,
      qValue: newQ,
      epsilon: this.epsilon,
      timestamp: new Date().toISOString(),
    };

    // Asynchronously persist to SQLite
    this.persistQValue(stateKey, action, newQ).catch((err) => {
      console.warn("QLearningAgent: Async Q-table sync notice:", err.message);
    });

    return {
      qValue: newQ,
      priorQ,
      delta,
    };
  }

  /**
   * Asynchronously saves an updated Q-value to the backend SQLite table.
   *
   * @param {string} stateKey
   * @param {string} action
   * @param {number} qValue
   */
  async persistQValue(stateKey, action, qValue) {
    try {
      const response = await fetch(`${this.baseUrl}/api/qlearning/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stateKey,
          action,
          qValue,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      // Fallback to local storage if available in browser context
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          const cacheKey = `ql_${stateKey}_${action}`;
          window.localStorage.setItem(cacheKey, String(qValue));
        } catch {
          // ignore localstorage errors
        }
      }
    }
  }

  /**
   * Loads the full Q-table from the backend SQLite store.
   *
   * @returns {Promise<boolean>}
   */
  async loadQTable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/qlearning/table`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.table && typeof data.table === "object") {
          for (const [sKey, actions] of Object.entries(data.table)) {
            this.ensureStateInitialized(sKey);
            for (const [aKey, val] of Object.entries(actions)) {
              this.qTable[sKey][aKey] = Number(val);
            }
          }
          this.isLoaded = true;
          return true;
        }
      }
    } catch (error) {
      console.info("QLearningAgent: Starting with initialized in-memory Q-table.");
    }
    return false;
  }

  /**
   * Retrieves the latest learning telemetry for presentation/UI display.
   */
  getTelemetry() {
    return { ...this.lastTelemetry };
  }
}

export const qLearningAgent = new QLearningAgent();
export default qLearningAgent;
