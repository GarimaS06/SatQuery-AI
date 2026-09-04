/**
 * questionValidator.js — Validates the user's text question
 *
 * Before we spend time processing an image, we check that the user
 * actually provided a valid question. This catches mistakes early
 * and returns a clear error message.
 *
 * Person A's responsibility: validate that the question EXISTS and
 * is well-formed. We do NOT interpret the question or decide which
 * ML model to run — that is Person D's job (Router).
 */

// ----- Configuration -----
const MIN_QUESTION_LENGTH = 3;    // Minimum characters (e.g., "map" is OK)
const MAX_QUESTION_LENGTH = 1000; // Maximum characters (prevents abuse)

/**
 * Validates the question string from the user's request.
 *
 * @param {*} question - The question value from req.body.question
 * @returns {object} - { valid: true, question: "trimmed question" }
 *                   or { valid: false, error: "reason" }
 */
function validateQuestion(question) {
  // Check 1: Was a question provided at all?
  if (question === undefined || question === null) {
    return {
      valid: false,
      error: 'The question field is required.',
    };
  }

  // Check 2: Is it a string? (could be a number or object if sent wrong)
  if (typeof question !== 'string') {
    return {
      valid: false,
      error: 'The question must be a text string.',
    };
  }

  // Trim whitespace from both ends (e.g., "  hello  " → "hello")
  const trimmed = question.trim();

  // Check 3: Is it empty after trimming?
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'The question cannot be empty.',
    };
  }

  // Check 4: Is it too short?
  if (trimmed.length < MIN_QUESTION_LENGTH) {
    return {
      valid: false,
      error: `The question must be at least ${MIN_QUESTION_LENGTH} characters long.`,
    };
  }

  // Check 5: Is it too long?
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return {
      valid: false,
      error: `The question must be no more than ${MAX_QUESTION_LENGTH} characters long.`,
    };
  }

  // All checks passed — return the trimmed question
  return {
    valid: true,
    question: trimmed,
  };
}

module.exports = { validateQuestion };
