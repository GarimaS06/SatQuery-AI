/**
 * runTests.js — Automated test script for the Preprocessing Service
 *
 * This script tests all 13 cases from the requirements:
 *   1.  Health check
 *   2.  Valid JPEG upload
 *   3.  Valid PNG upload
 *   4.  Valid TIFF upload
 *   5.  Missing image
 *   6.  Missing question
 *   7.  Empty question
 *   8.  Unsupported file type (plain text file with .txt extension)
 *   9.  Fake image (text file renamed as .jpg)
 *   10. Corrupted image (truncated data)
 *   11. File larger than 25 MB
 *   12. Large-dimension image that needs resizing
 *   13. Small image that should NOT be enlarged
 *
 * USAGE:
 *   1. Start the server in one terminal:  npm start
 *   2. Run tests in another terminal:     npm test
 *
 * The script creates test images programmatically using Sharp
 * (no need to download external test files).
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Base URL of the preprocessing service
const BASE_URL = 'http://localhost:4000';

// Directory for temporary test files
const TEST_DIR = path.join(__dirname, 'test_files');

// Track test results
let passed = 0;
let failed = 0;
const results = [];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Creates a test image of the specified size and format using Sharp.
 */
async function createTestImage(filename, width, height, format = 'jpeg') {
  const filepath = path.join(TEST_DIR, filename);

  // Create a solid-color image of the requested size
  // (3 channels = RGB, values 0-255)
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels, 0);

  // Fill with some color so it's not all black
  for (let i = 0; i < pixels.length; i += channels) {
    pixels[i] = 34;       // Red
    pixels[i + 1] = 139;  // Green  (forest green-ish — fitting for satellites!)
    pixels[i + 2] = 34;   // Blue
  }

  let pipeline = sharp(pixels, {
    raw: { width, height, channels },
  });

  if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 90 });
  else if (format === 'png') pipeline = pipeline.png();
  else if (format === 'tiff') pipeline = pipeline.tiff();
  else if (format === 'webp') pipeline = pipeline.webp();

  await pipeline.toFile(filepath);
  return filepath;
}

/**
 * Maps file extensions to MIME types.
 * When we send a file via fetch + FormData, we need to tell the server
 * what type of file it is (the MIME type). Without this, the server
 * sees "application/octet-stream" and rejects the file.
 */
const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
};

/**
 * Sends a multipart/form-data POST request using Node.js native fetch.
 * Node.js 18+ has a built-in fetch and FormData.
 */
async function postPreprocess(fields = {}) {
  const formData = new FormData();

  // Add file fields — include the correct MIME type for each file
  if (fields.image) {
    const fileBuffer = fs.readFileSync(fields.image);
    const fileName = path.basename(fields.image);
    const ext = path.extname(fields.image).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'application/octet-stream';
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('image', blob, fileName);
  }
  if (fields.image2) {
    const fileBuffer = fs.readFileSync(fields.image2);
    const fileName = path.basename(fields.image2);
    const ext = path.extname(fields.image2).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'application/octet-stream';
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('image2', blob, fileName);
  }

  // Add text fields
  if (fields.question !== undefined) {
    formData.append('question', fields.question);
  }

  const response = await fetch(`${BASE_URL}/api/preprocess`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Runs a single test case and records the result.
 */
async function runTest(name, testFn) {
  try {
    await testFn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`          ${err.message}`);
  }
}

/**
 * Simple assertion helper.
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ============================================================
// TEST CASES
// ============================================================

async function runAllTests() {
  console.log('\n========================================');
  console.log(' SatQuery AI — Preprocessing Tests');
  console.log('========================================\n');

  // Setup: create the test files directory
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }

  // ------ Test 1: Health Check ------
  await runTest('1. Health check', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    assert(data.status === 'ok', `Expected status "ok", got "${data.status}"`);
    assert(data.service === 'preprocessing', `Expected service "preprocessing"`);
  });

  // ------ Test 2: Valid JPEG Upload ------
  await runTest('2. Valid JPEG upload', async () => {
    const imgPath = await createTestImage('test_valid.jpg', 800, 600, 'jpeg');
    const { status, data } = await postPreprocess({
      image: imgPath,
      question: 'Is there vegetation in this area?',
    });
    assert(status === 200, `Expected status 200, got ${status}`);
    assert(data.valid === true, `Expected valid=true, got ${data.valid}`);
    assert(data.processedImage.format === 'png', `Expected PNG output, got ${data.processedImage.format}`);
    assert(data.processedImage.wasResized === false, 'Image should NOT have been resized');
  });

  // ------ Test 3: Valid PNG Upload ------
  await runTest('3. Valid PNG upload', async () => {
    const imgPath = await createTestImage('test_valid.png', 1024, 768, 'png');
    const { status, data } = await postPreprocess({
      image: imgPath,
      question: 'What is the water level?',
    });
    assert(status === 200, `Expected status 200, got ${status}`);
    assert(data.valid === true, `Expected valid=true`);
    assert(data.originalImage.format === 'png', `Expected original format "png"`);
  });

  // ------ Test 4: Valid TIFF Upload ------
  await runTest('4. Valid TIFF upload', async () => {
    const imgPath = await createTestImage('test_valid.tif', 512, 512, 'tiff');
    const { status, data } = await postPreprocess({
      image: imgPath,
      question: 'Show me changes in land use.',
    });
    assert(status === 200, `Expected status 200, got ${status}`);
    assert(data.valid === true, `Expected valid=true`);
    assert(data.originalImage.format === 'tiff', `Expected original format "tiff"`);
  });

  // ------ Test 5: Missing Image ------
  await runTest('5. Missing image', async () => {
    // Send only a question, no image
    const formData = new FormData();
    formData.append('question', 'Where is the forest?');
    const res = await fetch(`${BASE_URL}/api/preprocess`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(data.valid === false, `Expected valid=false`);
    assert(data.error.toLowerCase().includes('no image'), `Expected error about missing image, got: ${data.error}`);
  });

  // ------ Test 6: Missing Question ------
  await runTest('6. Missing question', async () => {
    const imgPath = await createTestImage('test_no_question.jpg', 200, 200, 'jpeg');
    const { status, data } = await postPreprocess({
      image: imgPath,
      // No question field at all
    });
    assert(status === 400, `Expected status 400, got ${status}`);
    assert(data.valid === false, `Expected valid=false`);
    assert(data.error.toLowerCase().includes('question'), `Expected error about question, got: ${data.error}`);
  });

  // ------ Test 7: Empty Question ------
  await runTest('7. Empty question', async () => {
    const imgPath = await createTestImage('test_empty_q.jpg', 200, 200, 'jpeg');
    const { status, data } = await postPreprocess({
      image: imgPath,
      question: '   ',  // Whitespace only
    });
    assert(status === 400, `Expected status 400, got ${status}`);
    assert(data.valid === false, `Expected valid=false`);
    assert(data.error.toLowerCase().includes('empty'), `Expected error about empty question, got: ${data.error}`);
  });

  // ------ Test 8: Unsupported File Type ------
  await runTest('8. Unsupported file type (.txt)', async () => {
    const txtPath = path.join(TEST_DIR, 'document.txt');
    fs.writeFileSync(txtPath, 'This is a plain text file, not an image.');

    const formData = new FormData();
    const fileBuffer = fs.readFileSync(txtPath);
    formData.append('image', new Blob([fileBuffer]), 'document.txt');
    formData.append('question', 'Analyze this');

    const res = await fetch(`${BASE_URL}/api/preprocess`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(data.valid === false, `Expected valid=false`);
  });

  // ------ Test 9: Fake Image (text renamed to .jpg) ------
  await runTest('9. Fake image (text file renamed as .jpg)', async () => {
    const fakePath = path.join(TEST_DIR, 'fake_image.jpg');
    fs.writeFileSync(fakePath, 'This is actually a text file pretending to be a JPEG.');

    // Send with image/jpeg MIME type to bypass the Multer filter
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(fakePath);
    formData.append('image', new Blob([fileBuffer], { type: 'image/jpeg' }), 'fake_image.jpg');
    formData.append('question', 'What is in this image?');

    const res = await fetch(`${BASE_URL}/api/preprocess`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(data.valid === false, `Expected valid=false`);
    assert(
      data.error.toLowerCase().includes('corrupted') || data.error.toLowerCase().includes('not a valid image'),
      `Expected error about corrupted/invalid image, got: ${data.error}`
    );
  });

  // ------ Test 10: Corrupted Image ------
  await runTest('10. Corrupted image', async () => {
    // Create a valid JPEG, then truncate it to corrupt the data
    const validPath = await createTestImage('pre_corrupt.jpg', 400, 400, 'jpeg');
    const validData = fs.readFileSync(validPath);

    const corruptPath = path.join(TEST_DIR, 'corrupted.jpg');
    // Keep only the first 100 bytes — this is a valid JPEG header but
    // the image data is missing, making it corrupted
    fs.writeFileSync(corruptPath, validData.slice(0, 100));

    const formData = new FormData();
    const fileBuffer = fs.readFileSync(corruptPath);
    formData.append('image', new Blob([fileBuffer], { type: 'image/jpeg' }), 'corrupted.jpg');
    formData.append('question', 'Check this image');

    const res = await fetch(`${BASE_URL}/api/preprocess`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    // Corrupted images may either fail at validation (400) or processing (500)
    // Both are acceptable — the important thing is valid=false
    assert(data.valid === false, `Expected valid=false for corrupted image`);
  });

  // ------ Test 11: File Larger Than 25 MB ------
  await runTest('11. File larger than 25 MB', async () => {
    // Create a file that's just over the 25 MB limit
    // We'll write raw bytes, not a real image, because creating a
    // real 25MB+ image would be slow. The size check happens in Multer
    // BEFORE image validation.
    const largePath = path.join(TEST_DIR, 'too_large.jpg');
    const size = 26 * 1024 * 1024; // 26 MB
    const buf = Buffer.alloc(size, 0xFF);
    fs.writeFileSync(largePath, buf);

    const formData = new FormData();
    const fileBuffer = fs.readFileSync(largePath);
    formData.append('image', new Blob([fileBuffer], { type: 'image/jpeg' }), 'too_large.jpg');
    formData.append('question', 'Analyze this large image');

    const res = await fetch(`${BASE_URL}/api/preprocess`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(data.valid === false, `Expected valid=false`);
    assert(
      data.error.toLowerCase().includes('large') || data.error.toLowerCase().includes('size'),
      `Expected error about file size, got: ${data.error}`
    );
  });

  // ------ Test 12: Large-Dimension Image (Needs Resizing) ------
  await runTest('12. Large-dimension image (needs resizing)', async () => {
    // Create a 3000×2500 image — both dimensions exceed 2048
    const imgPath = await createTestImage('test_large_dims.jpg', 3000, 2500, 'jpeg');
    const { status, data } = await postPreprocess({
      image: imgPath,
      question: 'Is there deforestation?',
    });
    assert(status === 200, `Expected status 200, got ${status}`);
    assert(data.valid === true, `Expected valid=true`);
    assert(data.processedImage.wasResized === true, 'Image SHOULD have been resized');
    assert(data.processedImage.width <= 2048, `Width should be ≤ 2048, got ${data.processedImage.width}`);
    assert(data.processedImage.height <= 2048, `Height should be ≤ 2048, got ${data.processedImage.height}`);
    // Check aspect ratio is preserved (original is 3000/2500 = 1.2)
    const originalRatio = 3000 / 2500;
    const processedRatio = data.processedImage.width / data.processedImage.height;
    const ratioDiff = Math.abs(originalRatio - processedRatio);
    assert(ratioDiff < 0.02, `Aspect ratio not preserved. Original: ${originalRatio.toFixed(3)}, Processed: ${processedRatio.toFixed(3)}`);
  });

  // ------ Test 13: Small Image (Should NOT Be Enlarged) ------
  await runTest('13. Small image (should NOT be enlarged)', async () => {
    // Create a 200×150 image — well below the 2048 limit
    const imgPath = await createTestImage('test_small.jpg', 200, 150, 'jpeg');
    const { status, data } = await postPreprocess({
      image: imgPath,
      question: 'What do you see?',
    });
    assert(status === 200, `Expected status 200, got ${status}`);
    assert(data.valid === true, `Expected valid=true`);
    assert(data.processedImage.wasResized === false, 'Small image should NOT be resized');
    assert(data.processedImage.width === 200, `Width should be 200, got ${data.processedImage.width}`);
    assert(data.processedImage.height === 150, `Height should be 150, got ${data.processedImage.height}`);
  });

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n========================================');
  console.log(` Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('========================================\n');

  // Print summary table
  results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon}  ${r.name}`);
    if (r.error) console.log(`       ↳ ${r.error}`);
  });

  console.log('');

  // Cleanup: remove test files
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    console.log('  🧹 Cleaned up test files.\n');
  } catch (e) {
    console.log(`  ⚠️  Could not clean up test files: ${e.message}\n`);
  }

  // Exit with non-zero code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================
// RUN
// ============================================================
runAllTests().catch((err) => {
  console.error('\n💥 Test runner crashed:', err);
  process.exit(1);
});
