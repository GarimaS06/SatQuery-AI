/**
 * preprocessController.js — Main controller for the /api/preprocess endpoint
 *
 * This is the "brain" of Person A's service. It orchestrates the full
 * preprocessing pipeline:
 *
 *   Step 1: Check that an image was uploaded
 *   Step 2: Validate the question text
 *   Step 3: Validate the image content (using Sharp, not just MIME type)
 *   Step 4: Preprocess the image (resize + convert to PNG)
 *   Step 5: Optionally forward to Person D's Router (disabled by default)
 *   Step 6: Clean up temporary uploaded files
 *   Step 7: Send the response back to the caller
 *
 * IMPORTANT: This controller does NOT decide which ML model to use.
 * It only validates and preprocesses. Person D's Router makes the
 * routing decision.
 */

const { validateImage } = require('../validators/imageValidator');
const { validateQuestion } = require('../validators/questionValidator');
const { processImage } = require('../processors/imageProcessor');
const { forwardToRouter } = require('../services/routerService');
const { deleteFile } = require('../utils/fileUtils');

/**
 * Handles a POST /api/preprocess request.
 *
 * Expected input (multipart/form-data):
 *   - image    (file, required)  — the satellite image
 *   - image2   (file, optional)  — second image for change detection
 *   - question (text, required)  — the user's question
 *
 * @param {object} req - Express request object (populated by Multer)
 * @param {object} res - Express response object
 */
async function handlePreprocess(req, res) {
  // Keep track of files we need to clean up, even if something goes wrong
  const filesToCleanup = [];

  try {
    // =========================================================
    // STEP 1: Check that the main image was uploaded
    // =========================================================
    // req.files is populated by Multer. It's an object where each
    // key is the field name (e.g., "image") and the value is an
    // array of file objects.
    if (!req.files || !req.files.image || req.files.image.length === 0) {
      return res.status(400).json({
        valid: false,
        error: 'No image was uploaded.',
      });
    }

    // Get the main uploaded file's info
    const mainFile = req.files.image[0];
    filesToCleanup.push(mainFile.path);

    // Check for optional second image (for future change detection)
    let secondFile = null;
    if (req.files.image2 && req.files.image2.length > 0) {
      secondFile = req.files.image2[0];
      filesToCleanup.push(secondFile.path);
    }

    // =========================================================
    // STEP 2: Validate the question
    // =========================================================
    const questionResult = validateQuestion(req.body.question);
    if (!questionResult.valid) {
      // Clean up uploaded files before returning error
      filesToCleanup.forEach(deleteFile);
      return res.status(400).json({
        valid: false,
        error: questionResult.error,
      });
    }

    // =========================================================
    // STEP 3: Validate the main image (reads actual file content)
    // =========================================================
    const imageValidation = await validateImage(mainFile.path);
    if (!imageValidation.valid) {
      filesToCleanup.forEach(deleteFile);
      return res.status(400).json({
        valid: false,
        error: imageValidation.error,
      });
    }

    // =========================================================
    // STEP 3b: Validate the second image, if provided
    // =========================================================
    let image2Validation = null;
    if (secondFile) {
      image2Validation = await validateImage(secondFile.path);
      if (!image2Validation.valid) {
        filesToCleanup.forEach(deleteFile);
        return res.status(400).json({
          valid: false,
          error: `Second image (image2): ${image2Validation.error}`,
        });
      }
    }

    // =========================================================
    // STEP 4: Preprocess the main image (resize + PNG conversion)
    // =========================================================
    const processedMain = await processImage(mainFile.path);

    // =========================================================
    // STEP 4b: Preprocess the second image, if provided
    // =========================================================
    let processedSecond = null;
    if (secondFile && image2Validation && image2Validation.valid) {
      processedSecond = await processImage(secondFile.path);
    }

    // Build structured image info objects for the router.
    // These contain all the processed image details that Person D needs.
    const mainImageInfo = {
      filename: processedMain.filename,
      path: processedMain.path,
      format: processedMain.format,
      width: processedMain.width,
      height: processedMain.height,
      sizeBytes: processedMain.sizeBytes,
    };

    const secondImageInfo = processedSecond
      ? {
          filename: processedSecond.filename,
          path: processedSecond.path,
          format: processedSecond.format,
          width: processedSecond.width,
          height: processedSecond.height,
          sizeBytes: processedSecond.sizeBytes,
        }
      : null;

    const routerResult = await forwardToRouter(
      questionResult.question,
      mainImageInfo,
      secondImageInfo,
      {
        originalFormat: imageValidation.metadata.format,
        processedWidth: processedMain.width,
        processedHeight: processedMain.height,
      }
    );

    // =========================================================
    // STEP 6: Clean up the raw uploaded files
    // =========================================================
    // We keep the PROCESSED files (Person D or the frontend may need them).
    // We delete the raw UPLOADED files (they were just temp copies).
    filesToCleanup.forEach(deleteFile);

    // =========================================================
    // STEP 7: Build and send the success response
    // =========================================================
    const response = {
      valid: true,
      message: 'Image validated and preprocessed successfully.',
      question: questionResult.question,
      processedImage: {
        filename: processedMain.filename,
        path: processedMain.path,
        format: processedMain.format,
        width: processedMain.width,
        height: processedMain.height,
        sizeBytes: processedMain.sizeBytes,
        wasResized: processedMain.wasResized,
      },
      originalImage: {
        filename: mainFile.originalname,
        format: imageValidation.metadata.format,
        width: imageValidation.metadata.width,
        height: imageValidation.metadata.height,
      },
      router: routerResult,
    };

    // Include second image info if one was provided
    if (processedSecond) {
      response.processedImage2 = {
        filename: processedSecond.filename,
        path: processedSecond.path,
        format: processedSecond.format,
        width: processedSecond.width,
        height: processedSecond.height,
        sizeBytes: processedSecond.sizeBytes,
        wasResized: processedSecond.wasResized,
      };
      response.originalImage2 = {
        filename: secondFile.originalname,
        format: image2Validation.metadata.format,
        width: image2Validation.metadata.width,
        height: image2Validation.metadata.height,
      };
    }

    return res.status(200).json(response);
  } catch (err) {
    // =========================================================
    // ERROR HANDLING: Unexpected errors
    // =========================================================
    // If anything unexpected goes wrong, we:
    //   1. Clean up any temp files
    //   2. Log the real error for debugging (server-side only)
    //   3. Return a generic message to the user (no internal details)

    filesToCleanup.forEach(deleteFile);
    console.error('[preprocessController] Unexpected error:', err);

    return res.status(500).json({
      valid: false,
      error: 'An internal error occurred during preprocessing.',
    });
  }
}

module.exports = { handlePreprocess };
