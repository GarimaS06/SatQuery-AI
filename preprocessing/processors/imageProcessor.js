/**
 * imageProcessor.js — Resizes and converts images to a standard format
 *
 * After an image passes validation, this module preprocesses it so that
 * all downstream ML models receive a consistent input:
 *
 *   1. If either dimension exceeds 2048px → resize DOWN to fit within
 *      2048×2048, preserving the original aspect ratio.
 *   2. If both dimensions are already ≤ 2048px → do NOT resize.
 *      (We never enlarge a small image — that just adds fake pixels.)
 *   3. Convert the output to PNG format (lossless, widely supported).
 *   4. Save the processed image to the "processed/" directory.
 *
 * Why PNG?
 *   - Lossless compression — no quality loss from re-encoding
 *   - Supports transparency (useful for some satellite masks)
 *   - Universally readable by all ML libraries
 */

const sharp = require('sharp');
const path = require('path');
const { generateUniqueFilename } = require('../utils/fileUtils');

// Directory where processed images are saved
const PROCESSED_DIR = path.join(__dirname, '..', 'processed');

/**
 * Preprocesses an image: resize if needed, convert to PNG, save.
 *
 * @param {string} inputFilePath - Path to the validated uploaded image
 * @returns {Promise<object>} - Information about the processed image:
 *   {
 *     filename: "1756627200000_a1b2c3.png",
 *     path: "/full/path/to/processed/1756627200000_a1b2c3.png",
 *     format: "png",
 *     width: 2048,
 *     height: 1536,
 *     sizeBytes: 1048576,
 *     wasResized: true
 *   }
 */
async function processImage(inputFilePath, targetWidth = null, targetHeight = null) {
  // Read the max dimensions from environment variables, or use defaults
  const maxWidth = parseInt(process.env.MAX_IMAGE_WIDTH) || 2048;
  const maxHeight = parseInt(process.env.MAX_IMAGE_HEIGHT) || 2048;

  // Step 1: Read original image metadata
  const originalMetadata = await sharp(inputFilePath).metadata();

  // Step 2: Decide whether resizing is needed
  let needsResize =
    originalMetadata.width > maxWidth ||
    originalMetadata.height > maxHeight;

  // If a target size was explicitly provided, this is a paired-image
  // request and the output must match that exact size.
  const hasTargetSize =
    Number.isInteger(targetWidth) &&
    Number.isInteger(targetHeight) &&
    targetWidth > 0 &&
    targetHeight > 0;

  // Step 3: Build the Sharp processing pipeline
  let pipeline = sharp(inputFilePath);

  if (hasTargetSize) {
    // Paired images must have identical dimensions for change detection.
    pipeline = pipeline.resize(targetWidth, targetHeight, {
      fit: 'fill',
    });

    needsResize =
      originalMetadata.width !== targetWidth ||
      originalMetadata.height !== targetHeight;
  } else if (needsResize) {
    // Normal single-image preprocessing
    pipeline = pipeline.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Step 4: Convert output to PNG
  pipeline = pipeline.png();

  // Step 5: Generate unique filename and save
  const outputFilename = generateUniqueFilename('png');
  const outputPath = path.join(PROCESSED_DIR, outputFilename);

  const outputInfo = await pipeline.toFile(outputPath);

  // Step 6: Return processed image information
  return {
    filename: outputFilename,
    path: outputPath,
    format: 'png',
    width: outputInfo.width,
    height: outputInfo.height,
    sizeBytes: outputInfo.size,
    wasResized: needsResize,
  };
}

module.exports = { processImage };
