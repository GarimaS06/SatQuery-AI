/**
 * imageValidator.js — Validates uploaded images using their actual content
 *
 * IMPORTANT: We do NOT trust the file extension or MIME type alone.
 * A user could rename "virus.exe" to "photo.jpg" — the extension would
 * say JPEG but the actual file is not an image at all.
 *
 * Instead, we use the Sharp library to read the file's binary header
 * (the first few bytes of any image contain a "magic number" that
 * identifies the real format). If Sharp can read the file and extract
 * metadata, it's a real image. If it throws an error, the file is
 * either corrupted or not an image.
 *
 * Supported formats: JPEG, PNG, TIFF, WebP
 * These are common formats that Sharp can reliably process.
 * Specialized satellite formats (e.g., multi-band GeoTIFF with 10+ bands)
 * may need Python + rasterio on Person B/C's side.
 */

const sharp = require('sharp');

// The formats we support — these are Sharp's internal format names
const SUPPORTED_FORMATS = ['jpeg', 'png', 'tiff', 'webp'];

// Human-readable version for error messages
const SUPPORTED_FORMATS_DISPLAY = 'JPEG, PNG, TIFF, WebP';

/**
 * Validates an image file by reading its actual binary content.
 *
 * @param {string} filePath - Absolute path to the uploaded image file
 * @returns {Promise<object>} - { valid: true, metadata: {...} }
 *                            or { valid: false, error: "reason" }
 */
async function validateImage(filePath) {
  try {
    // Sharp reads the file header and extracts metadata.
    // If the file is not a valid image, this will throw an error.
    const metadata = await sharp(filePath).metadata();

    // Double-check that Sharp actually found a format
    if (!metadata || !metadata.format) {
      return {
        valid: false,
        error: 'The uploaded file is corrupted or is not a valid image.',
      };
    }

    // Check if the detected format is one we support
    if (!SUPPORTED_FORMATS.includes(metadata.format)) {
      return {
        valid: false,
        error: `Unsupported image format "${metadata.format}". Accepted formats: ${SUPPORTED_FORMATS_DISPLAY}.`,
      };
    }

    // Check that the image has valid dimensions
    // (a 0×0 image or negative dimensions would be invalid)
    if (!metadata.width || !metadata.height || metadata.width < 1 || metadata.height < 1) {
      return {
        valid: false,
        error: 'The image has invalid dimensions (width or height is zero).',
      };
    }

    // All checks passed — return the metadata for use downstream
    return {
      valid: true,
      metadata: {
        format: metadata.format,       // e.g., "jpeg", "png", "tiff"
        width: metadata.width,         // Original width in pixels
        height: metadata.height,       // Original height in pixels
        channels: metadata.channels,   // Number of color channels (3 = RGB, 4 = RGBA)
        space: metadata.space,         // Color space (e.g., "srgb", "rgb16")
      },
    };
  } catch (err) {
    // Sharp threw an error — the file is corrupted, truncated, or not an image.
    // We return a user-friendly message and do NOT expose the internal error
    // details (which could reveal server file paths or library internals).
    return {
      valid: false,
      error: 'The uploaded file is corrupted or is not a valid image.',
    };
  }
}

module.exports = { validateImage, SUPPORTED_FORMATS };
