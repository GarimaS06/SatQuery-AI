/**
 * upload.js — Multer middleware for handling file uploads
 *
 * When the frontend sends an image to our API, it arrives as
 * "multipart/form-data" (this is the standard way browsers send files).
 * Express cannot parse file uploads on its own — we need the Multer
 * library to handle it.
 *
 * This middleware:
 *   1. Saves uploaded files to the "uploads/" temp directory
 *   2. Gives each file a unique name (to avoid collisions)
 *   3. Rejects files that are too large (> 25 MB)
 *   4. Does a first-pass check on the MIME type
 *
 * NOTE ON MIME TYPES VS. REAL VALIDATION:
 *   The MIME type comes from the browser/client and CAN be faked.
 *   For example, someone could rename "malware.exe" to "photo.jpg"
 *   and the browser would send it with MIME type "image/jpeg".
 *
 *   The Multer fileFilter is just a quick first check. The REAL
 *   validation happens in imageValidator.js, which uses Sharp to
 *   read the actual file bytes and confirm it's a genuine image.
 */

const multer = require('multer');
const path = require('path');
const { generateUniqueFilename } = require('../utils/fileUtils');

// Directory where Multer saves raw uploaded files (before processing)
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// MIME types we accept as a first-pass filter
// (Real validation happens later with Sharp)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
];

// ------ Storage Configuration ------
// Tells Multer WHERE to save files and WHAT to name them
const storage = multer.diskStorage({
  // destination: which folder to save the file in
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },

  // filename: what to name the saved file
  filename: function (req, file, cb) {
    // Get the original file extension (e.g., ".jpg", ".png")
    const originalExt = path.extname(file.originalname).replace('.', '') || 'tmp';
    // Generate a unique name so files don't overwrite each other
    const uniqueName = generateUniqueFilename(originalExt);
    cb(null, uniqueName);
  },
});

// ------ File Filter ------
// First-pass check: reject files with obviously wrong MIME types
const fileFilter = function (req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    // MIME type looks correct — accept the file (Sharp will verify later)
    cb(null, true);
  } else {
    // MIME type is not in our allowed list — reject immediately
    // We create a custom error that our wrapper can catch
    const error = new Error(
      'Unsupported file type. Accepted formats: JPEG, PNG, TIFF, WebP.'
    );
    error.code = 'UNSUPPORTED_FILE_TYPE';
    cb(error, false);
  }
};

// ------ Size Limit ------
const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB) || 25;
const maxSizeBytes = maxSizeMB * 1024 * 1024; // Convert MB to bytes

// ------ Create the Multer instance ------
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxSizeBytes, // Reject files larger than this
  },
});

/**
 * handleUpload — Express middleware that wraps Multer and handles its errors.
 *
 * Instead of letting Multer errors bubble up as raw 500 errors, we
 * catch them here and return clean, user-friendly JSON error messages.
 *
 * We accept two file fields:
 *   - "image"  (required) — the main satellite image
 *   - "image2" (optional) — a second image for change detection workflows
 *
 * Person A does NOT decide what to do with image2. We just accept it,
 * validate it, and pass it along. Person D's Router decides what it means.
 */
function handleUpload(req, res, next) {
  // upload.fields() accepts multiple named file fields
  const uploadFields = upload.fields([
    { name: 'image', maxCount: 1 },   // Main image — required (checked in controller)
    { name: 'image2', maxCount: 1 },  // Second image — optional (for change detection)
  ]);

  // Call Multer and handle any errors it produces
  uploadFields(req, res, function (err) {
    if (err) {
      // --- Multer-specific errors ---
      if (err instanceof multer.MulterError) {
        // File too large
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            valid: false,
            error: `File too large. Maximum allowed size is ${maxSizeMB} MB.`,
          });
        }
        // Any other Multer error
        return res.status(400).json({
          valid: false,
          error: `Upload error: ${err.message}`,
        });
      }

      // --- Our custom file-filter error ---
      if (err.code === 'UNSUPPORTED_FILE_TYPE') {
        return res.status(400).json({
          valid: false,
          error: err.message,
        });
      }

      // --- Unknown error ---
      console.error('[upload] Unexpected upload error:', err);
      return res.status(500).json({
        valid: false,
        error: 'An unexpected error occurred during file upload.',
      });
    }

    // No errors — proceed to the next middleware (the controller)
    next();
  });
}

module.exports = { handleUpload };
