/**
 * preprocess.js — Route definition for the preprocessing endpoint
 *
 * This file defines the API route:
 *   POST /api/preprocess
 *
 * It wires together:
 *   1. The upload middleware (handles multipart/form-data file upload)
 *   2. The preprocessing controller (validates, processes, responds)
 *
 * In Express, a "route" maps a URL path + HTTP method to the code
 * that should handle it. We keep route definitions separate from
 * the business logic (controller) for cleaner code organization.
 */

const express = require('express');

// Create a new Router instance — this is like a mini Express app
// that we can define routes on, and then "mount" into the main app
const router = express.Router();

// Import our middleware and controller
const { handleUpload } = require('../middleware/upload');
const { handlePreprocess } = require('../controllers/preprocessController');

/**
 * POST /api/preprocess
 *
 * Expects multipart/form-data with:
 *   - image    (file, required)  — satellite image to preprocess
 *   - image2   (file, optional)  — second image for change detection
 *   - question (text, required)  — user's natural-language question
 *
 * Flow: handleUpload → handlePreprocess
 *
 * handleUpload runs first:
 *   - Saves the uploaded file(s) to disk
 *   - Handles upload errors (file too large, wrong type)
 *   - If successful, calls next() to proceed to handlePreprocess
 *
 * handlePreprocess runs second:
 *   - Validates the image content and question
 *   - Resizes and converts the image
 *   - Returns the result as JSON
 */
router.post('/api/preprocess', handleUpload, handlePreprocess);

module.exports = router;
