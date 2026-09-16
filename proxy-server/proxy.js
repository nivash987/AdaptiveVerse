const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "adaptiveverse.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question TEXT NOT NULL,
    selected_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    timestamp TEXT NOT NULL
  );
`);

const supportedSubjects = ["Artificial Intelligence", "Machine Learning"];

function getStudentLearningContext(selectedSubject) {
  try {
    const totalRow = db
      .prepare("SELECT COUNT(*) as count FROM quiz_attempts")
      .get();
    const correctRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM quiz_attempts WHERE is_correct = 1",
      )
      .get();

    const totalQuestions = totalRow ? Number(totalRow.count) : 0;
    const correctAnswers = correctRow ? Number(correctRow.count) : 0;
    const overallAccuracy =
      totalQuestions === 0
        ? 0
        : Math.round((correctAnswers / totalQuestions) * 100);

    const subjectTotalRow = db
      .prepare("SELECT COUNT(*) as count FROM quiz_attempts WHERE subject = ?")
      .get(selectedSubject);
    const subjectCorrectRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM quiz_attempts WHERE subject = ? AND is_correct = 1",
      )
      .get(selectedSubject);

    const subjectAttempts = subjectTotalRow ? Number(subjectTotalRow.count) : 0;
    const subjectCorrect = subjectCorrectRow
      ? Number(subjectCorrectRow.count)
      : 0;
    const subjectAccuracy =
      subjectAttempts === 0
        ? 0
        : Math.round((subjectCorrect / subjectAttempts) * 100);

    const recentAttempts = db
      .prepare(
        `
        SELECT subject, difficulty, question, selected_answer, correct_answer, is_correct
        FROM quiz_attempts
        ORDER BY id DESC
        LIMIT 6
      `,
      )
      .all();

    const recentIncorrect = db
      .prepare(
        `
        SELECT subject, difficulty, question, selected_answer, correct_answer
        FROM quiz_attempts
        WHERE is_correct = 0
        ORDER BY id DESC
        LIMIT 4
      `,
      )
      .all();

    let contextSummary = `STUDENT LEARNING CONTEXT (from past quiz history):
- Overall performance: ${totalQuestions} questions attempted, ${correctAnswers} correct, overall accuracy ${overallAccuracy}%.
- Subject performance for "${selectedSubject}": ${subjectAttempts} questions attempted, ${subjectCorrect} correct, accuracy ${subjectAccuracy}%.`;

    if (recentAttempts.length > 0) {
      contextSummary +=
        `\n- Recent quiz attempts:\n` +
        recentAttempts
          .map(
            (a, i) =>
              `  ${i + 1}. [${a.subject} - ${a.difficulty}] Q: "${a.question}" -> Result: ${
                a.is_correct
                  ? "CORRECT"
                  : `INCORRECT (student selected "${a.selected_answer}", correct was "${a.correct_answer}")`
              }`,
          )
          .join("\n");
    }

    if (recentIncorrect.length > 0) {
      contextSummary +=
        `\n- Recent struggle points / concepts missed:\n` +
        recentIncorrect
          .map(
            (a) =>
              `  * [${a.subject} (${a.difficulty})] "${a.question}" -> Student missed answer: "${a.selected_answer}", correct answer: "${a.correct_answer}"`,
          )
          .join("\n");
    } else if (totalQuestions > 0 && correctAnswers === totalQuestions) {
      contextSummary += `\n- The student has answered all recent questions correctly, exhibiting high mastery.`;
    }

    return {
      totalQuestions,
      correctAnswers,
      overallAccuracy,
      subjectAttempts,
      subjectCorrect,
      subjectAccuracy,
      recentAttempts,
      recentIncorrect,
      contextSummary,
    };
  } catch (error) {
    console.error("Error generating learning context:", error);
    return {
      totalQuestions: 0,
      correctAnswers: 0,
      overallAccuracy: 0,
      subjectAttempts: 0,
      subjectCorrect: 0,
      subjectAccuracy: 0,
      recentAttempts: [],
      recentIncorrect: [],
      contextSummary: "No previous quiz history available.",
    };
  }
}

app.post("/api/chatgpt", async (req, res) => {
  try {
    console.log("Chat Request Body:", req.body);

    const selectedSubject =
      req.body.selectedSubject || "Artificial Intelligence";
    const difficulty = req.body.difficulty || "beginner";
    const studentQuestion = req.body.message;

    const learning = getStudentLearningContext(selectedSubject);

    const systemPrompt = `You are Teacher Emilian, a helpful, encouraging, and friendly AI teacher inside a 3D virtual classroom in AdaptiveVerse.
The student has selected "${selectedSubject}" and their current learning difficulty is "${difficulty}".

${learning.contextSummary}

TEACHING & PERSONALIZATION INSTRUCTIONS:
- Tailor your explanations to the student's difficulty level (${difficulty}) and their learning history.
- If the student is struggling or missed questions on specific concepts in recent quiz history:
  * Explain concepts more simply and intuitively.
  * Use vivid analogies or concrete real-world examples.
  * Avoid overwhelming technical jargon.
  * Provide warm, patient encouragement.
- If the student is performing well with high accuracy:
  * Provide richer explanations and deeper technical intuition.
  * Introduce practical real-world nuances or slightly more advanced context.
- For "${selectedSubject}":
  * If Artificial Intelligence: teach AI principles, intelligent agents, search algorithms, knowledge representation, neural networks, ethics, and fundamentals.
  * If Machine Learning: teach ML paradigms (supervised, unsupervised, reinforcement), training workflows, loss functions, evaluation metrics, and algorithms.
- NEVER mention internal database names, SQL queries, or backend tables (e.g. never say "According to your SQLite database"). Act naturally and supportively as an observant, thoughtful teacher.`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: systemPrompt,
              },
            ],
          },
          contents: [
            {
              parts: [
                {
                  text: studentQuestion,
                },
              ],
            },
          ],
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return res.status(response.status).json({
        error: "Gemini API request failed",
      });
    }

    const answer =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I could not generate a response.";

    res.json({ response: answer });
  } catch (error) {
    console.error("Error Details:", error.message);
    res.status(500).json({
      error: "An error occurred while contacting Gemini",
    });
  }
});

app.post("/api/generate-quiz-question", async (req, res) => {
  try {
    console.log("Quiz Request Body:", req.body);

    const { selectedSubject, difficulty } = req.body;

    if (!supportedSubjects.includes(selectedSubject)) {
      return res.status(400).json({
        error: "Unsupported subject",
      });
    }

    const learning = getStudentLearningContext(selectedSubject);

    const quizSystemPrompt = `You are the AI adaptive quiz generator for AdaptiveVerse.
Generate exactly one ${difficulty} multiple-choice quiz question for the subject "${selectedSubject}".

${learning.contextSummary}

PEDAGOGICAL ADAPTATION GUIDELINES:
- Respect the difficulty level: ${difficulty.toUpperCase()}
  * beginner: Focus on fundamental concepts, definitions, and intuitive explanations. Avoid advanced math or obscure implementation details.
  * intermediate: Focus on understanding, applying concepts, comparing techniques, and practical examples with moderate complexity.
  * advanced: Focus on deeper technical mechanisms, architecture, edge cases, or algorithmic reasoning.
- Adaptation based on student history:
  * If the student recently answered questions incorrectly on a concept, provide targeted practice or reinforce understanding on that foundational concept.
  * If the student shows high accuracy and mastery, generate questions that test deeper conceptual application appropriate for ${difficulty}.
  * Ensure the question remains strictly relevant to "${selectedSubject}".

RESPONSE FORMAT:
Return ONLY valid JSON with this exact shape:
{"question":"...","options":["...","...","...","..."],"correctAnswer":"..."}

CRITICAL RULES:
- The "options" array MUST contain exactly 4 options.
- The "correctAnswer" MUST exactly match one of the options in the "options" array.
- Do NOT wrap in markdown or backticks. Return raw JSON.`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: quizSystemPrompt,
              },
            ],
          },
          contents: [
            {
              parts: [
                {
                  text: `Generate one ${difficulty} adaptive quiz question for ${selectedSubject}.`,
                },
              ],
            },
          ],
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Quiz API Error:", data);
      return res.status(response.status).json({
        error: "Gemini quiz request failed",
      });
    }

    let quizText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    quizText = quizText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const quizQuestion = JSON.parse(quizText);

    if (
      !quizQuestion ||
      !quizQuestion.question ||
      !Array.isArray(quizQuestion.options) ||
      !quizQuestion.correctAnswer
    ) {
      throw new Error("Invalid quiz question format received from Gemini");
    }

    res.json(quizQuestion);
  } catch (error) {
    console.error("Quiz Error Details:", error.message);
    res.status(500).json({
      error: "An error occurred while generating a quiz question",
    });
  }
});

app.post("/api/progress/attempt", (req, res) => {
  try {
    const {
      subject,
      difficulty,
      question,
      selectedAnswer,
      correctAnswer,
      isCorrect,
      timestamp,
    } = req.body;

    if (
      !subject ||
      !difficulty ||
      !question ||
      selectedAnswer === undefined ||
      correctAnswer === undefined ||
      typeof isCorrect !== "boolean"
    ) {
      return res.status(400).json({
        error: "Missing or invalid required attempt fields",
      });
    }

    const attemptTimestamp = timestamp || new Date().toISOString();
    const isCorrectInt = isCorrect ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO quiz_attempts (
        subject,
        difficulty,
        question,
        selected_answer,
        correct_answer,
        is_correct,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      subject,
      difficulty,
      question,
      selectedAnswer,
      correctAnswer,
      isCorrectInt,
      attemptTimestamp,
    );

    res.status(201).json({
      success: true,
      attemptId: Number(info.lastInsertRowid),
    });
  } catch (error) {
    console.error("Error saving quiz attempt:", error);
    res.status(500).json({
      error: "An error occurred while saving quiz attempt",
    });
  }
});

app.get("/api/progress", (req, res) => {
  try {
    const totalRow = db
      .prepare("SELECT COUNT(*) as count FROM quiz_attempts")
      .get();
    const correctRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM quiz_attempts WHERE is_correct = 1",
      )
      .get();

    const totalQuestions = totalRow ? Number(totalRow.count) : 0;
    const correctAnswers = correctRow ? Number(correctRow.count) : 0;
    const incorrectAnswers = totalQuestions - correctAnswers;
    const accuracy =
      totalQuestions === 0
        ? 0
        : Math.round((correctAnswers / totalQuestions) * 100);

    const recentAttemptsRows = db
      .prepare(
        `
        SELECT
          id,
          subject,
          difficulty,
          question,
          selected_answer AS selectedAnswer,
          correct_answer AS correctAnswer,
          is_correct AS isCorrect,
          timestamp
        FROM quiz_attempts
        ORDER BY id DESC
        LIMIT 10
      `,
      )
      .all();

    const recentAttempts = recentAttemptsRows.map((row) => ({
      ...row,
      isCorrect: Boolean(row.isCorrect),
    }));

    res.json({
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      accuracy,
      recentAttempts,
    });
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({
      error: "An error occurred while fetching progress",
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Gemini proxy server is running on port ${PORT}`);
});
