/**
 * routerService.js — Abstraction for Person D's Router integration
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Person A does NOT decide which ML model to run.             ║
 * ║  Person D (Router) owns that responsibility.                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * CONFIRMED API CONTRACT (Person D):
 *   Endpoint: POST http://localhost:8000/api/router/analyze
 *   Content-Type: application/json
 *
 *   Request body:
 *   {
 *     question: "...",
 *     image: {                    ← always required
 *       filename, path, format,
 *       width, height, size_bytes
 *     },
 *     image2: {                   ← null when not provided
 *       filename, path, format,
 *       width, height, size_bytes
 *     },
 *     metadata: { ... }
 *   }
 *
 * FIELD MAPPING:
 *   Person A internally uses "sizeBytes" (camelCase).
 *   Person D expects "size_bytes" (snake_case).
 *   The conversion happens in this file at the A → D boundary.
 *
 * IMAGE SUPPORT:
 *   - Always sends the main processed image (image).
 *   - Optionally sends a second processed image (image2) when the
 *     user uploads two images for change-detection workflows.
 *   - Person D decides whether to use one or both images.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Builds a Person-D-compatible image object from Person A's image info.
 *
 * This is where the field-name mapping happens:
 *   Person A uses "sizeBytes" (camelCase, JavaScript convention)
 *   Person D expects "size_bytes" (snake_case, Python convention)
 *
 * @param {object} imageInfo - Processed image info from imageProcessor
 *   { filename, path, format, width, height, sizeBytes }
 * @returns {object} - Image object matching Person D's contract
 *   { filename, path, format, width, height, size_bytes }
 */
function buildRouterImageObject(imageInfo) {
  return {
    filename: imageInfo.filename,
    path: imageInfo.path,
    format: imageInfo.format,
    width: imageInfo.width,
    height: imageInfo.height,
    size_bytes: imageInfo.sizeBytes,  // ← camelCase → snake_case
  };
}

/**
 * Forwards the processed image(s) and question to Person D's Router.
 *
 * When ROUTER_ENABLED is false (default), this returns a stub response
 * that includes the payload that WOULD be sent to Person D. This lets
 * tests verify the exact structure without needing Person D's server.
 *
 * When ROUTER_ENABLED is true, the payload is sent via HTTP POST to
 * Person D's router at ROUTER_URL.
 *
 * @param {string} question     - The user's validated question text
 * @param {object} imageInfo    - Main processed image info (required)
 *   { filename, path, format, width, height, sizeBytes }
 * @param {object|null} image2Info - Second processed image info (optional, for change detection)
 *   Same shape as imageInfo, or null when no second image was uploaded
 * @param {object} metadata     - Additional metadata (original format, etc.)
 * @returns {Promise<object>}   - Router response or stub response
 */
async function forwardToRouter(question, imageInfo, image2Info, metadata) {
  // Check if router integration is enabled via environment variable
  const isEnabled = process.env.ROUTER_ENABLED === 'true';
  const routerUrl =
    process.env.ROUTER_URL || 'http://localhost:8000/api/router/analyze';

  // Build the payload that matches Person D's confirmed API contract.
  // We build it in both stub and live mode so the stub can echo it for testing.
  const payload = {
    question: question,
    image: buildRouterImageObject(imageInfo),
    image2: image2Info ? buildRouterImageObject(image2Info) : null,
    metadata: metadata,
  };

  // ----- STUB MODE (default) -----
  // Return immediately without making any HTTP call.
  // The "payload" field lets tests verify the exact data structure
  // that would be sent to Person D.
  if (!isEnabled) {
    return {
      forwarded: false,
      reason:
        'Router integration is not yet enabled. Set ROUTER_ENABLED=true in .env when ready.',
      image2Included: !!image2Info,
      payload: payload,
    };
  }

  // ----- LIVE MODE -----
  // Send the payload to Person D's router via HTTP POST.
  try {
    const response = await axios.post(routerUrl, payload, {
      timeout: 60000, // 60-second timeout (ML models can be slow)
      headers: { 'Content-Type': 'application/json' },
    });

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
