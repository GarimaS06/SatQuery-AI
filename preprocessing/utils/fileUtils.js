/**
 * fileUtils.js — Shared file-system utility functions
 *
 * These helper functions are used by several parts of the preprocessing
 * service (upload middleware, image processor, controller cleanup).
 * Keeping them in one place avoids duplicating the same logic.
 */

const fs = require('fs');    // Node.js built-in module for file system operations
const path = require('path'); // Node.js built-in module for working with file paths

/**
 * Creates a directory if it does not already exist.
 * The { recursive: true } option means it will also create any
 * missing parent directories — similar to "mkdir -p" in Linux.
 *
 * @param {string} dirPath - Absolute path to the directory to create
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[fileUtils] Created directory: ${dirPath}`);
  }
}

/**
 * Safely deletes a file. If the file doesn't exist or deletion fails,
 * it logs a warning instead of crashing the server.
 *
 * This is important for cleanup — we don't want the whole request to
 * fail just because a temp file was already deleted.
 *
 * @param {string} filePath - Absolute path to the file to delete
 */
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);  // unlinkSync = delete a file synchronously
    }
  } catch (err) {
    // Log the warning but don't throw — this is cleanup, not critical
    console.warn(`[fileUtils] Warning: Could not delete file ${filePath}: ${err.message}`);
  }
}

/**
 * Generates a unique filename using a timestamp and random string.
 * This prevents filename collisions when multiple users upload at
 * the same time.
 *
 * Example output: "1756627200000_a1b2c3.png"
 *
 * @param {string} extension - File extension without the dot (e.g., "png", "jpg")
 * @returns {string} A unique filename
 */
function generateUniqueFilename(extension) {
  const timestamp = Date.now();                            // Milliseconds since 1970
  const randomPart = Math.random().toString(36).slice(2, 8); // Random 6-char string
  return `${timestamp}_${randomPart}.${extension}`;
}

// Export all functions so other files can use them with require()
module.exports = {
  ensureDirectoryExists,
  deleteFile,
  generateUniqueFilename,
};
