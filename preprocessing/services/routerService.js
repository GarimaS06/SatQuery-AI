/**
 * routerService.js — Abstraction for Person D's Router integration
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  THIS SERVICE IS DELIBERATELY STUBBED / DISABLED.           ║
 * ║                                                              ║
 * ║  Person A does NOT decide which ML model to run.             ║
 * ║  Person D (Router) owns that responsibility.                 ║
 * ║                                                              ║
 * ║  When Person D confirms their API contract, update this      ║
 * ║  file and set ROUTER_ENABLED=true in .env.                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * IMAGE SUPPORT:
 *   - Always sends the main processed image (imagePath).
 *   - Optionally sends a second processed image (imagePath2) when the
 *     user uploads two images for change-detection workflows.
 *   - Person D decides whether to use one or both images.
 *
 * WHAT PERSON D NEEDS TO TELL US:
 *   1. Exact endpoint URL (currently assumed: POST /api/router/analyze on port 8000)
 *   2. Request format — how should we send the image(s)?
 *      - Option A: multipart/form-data with the image file(s)
 *      - Option B: JSON body with file path(s) on shared storage
 *      - Option C: JSON body with base64-encoded image(s)
 *   3. What other fields are needed? (question, metadata, etc.)
 *   4. Response format — what does the router send back?
 *
 * Once we know this, we update the forwardToRouter() function below.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Forwards the processed image(s) and question to Person D's Router.
 *
 * When ROUTER_ENABLED is false (default), this returns a stub response
 * indicating that the router is not yet connected. The preprocessing
 * service works perfectly fine on its own — it validates and processes
 * the image, and returns the result to the caller.
 *
 * @param {string} processedImagePath       - Full path to the processed PNG image (required)
 * @param {string} question                 - The user's validated question text
 * @param {object} metadata                 - Image metadata (format, dimensions, etc.)
 * @param {string} [processedImage2Path]    - Full path to the second processed PNG image (optional, for change detection)
 * @returns {Promise<object>} - Router response or stub response
 */
async function forwardToRouter(processedImagePath, question, metadata, processedImage2Path) {
  // Check if router integration is enabled via environment variable
  const isEnabled = process.env.ROUTER_ENABLED === 'true';
  const routerUrl =
    process.env.ROUTER_URL || 'http://localhost:8000/api/router/analyze';

  // ----- STUB MODE (default) -----
  // Return immediately without making any HTTP call
  if (!isEnabled) {
    return {
      forwarded: false,
      reason:
        'Router integration is not yet enabled. Set ROUTER_ENABLED=true in .env when Person D confirms the API contract.',
      image2Included: !!processedImage2Path,
    };
  }

  // ----- LIVE MODE (after Person D confirms) -----
  try {
    // TODO: Update the request format once Person D confirms their API.
    //
    // Current assumption: JSON body with the processed image file path
    // and the question. This assumes both services can access the same
    // file system (e.g., running on the same machine during development).
    //
    // If Person D wants multipart/form-data instead, we would need to
    // install the "form-data" npm package and send the file as a stream.
    // Example:
    //   const FormData = require('form-data');
    //   const form = new FormData();
    //   form.append('image', fs.createReadStream(processedImagePath));
    //   form.append('question', question);
    //   const response = await axios.post(routerUrl, form, {
    //     headers: form.getHeaders(),
    //   });

    const response = await axios.post(
      routerUrl,
      {
        imagePath: processedImagePath,
        imagePath2: processedImage2Path || null, // null when no second image
        question: question,
        metadata: metadata,
      },
      {
        timeout: 60000, // 60-second timeout (ML models can be slow)
        headers: { 'Content-Type': 'application/json' },
      }
    );

    return {
      forwarded: true,
      routerResponse: response.data,
    };
  } catch (err) {
    // If the router is unreachable or returns an error, we report it
    // but do NOT crash the preprocessing service.
    const errorMessage = err.response
      ? `Router returned status ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : `Could not reach router at ${routerUrl}: ${err.message}`;

    console.error(`[routerService] ${errorMessage}`);

    return {
      forwarded: false,
      reason: errorMessage,
    };
  }
}

module.exports = { forwardToRouter };
