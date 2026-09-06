/**
 * server.js — Main entry point for the SatQuery AI Preprocessing Service
 *
 * This is Person A's service. It receives satellite images + questions
 * from the frontend, validates and preprocesses them, and (eventually)
 * forwards them to Person D's Router.
 *
 * To start:   npm start   (or: node server.js)
 * Default:    http://localhost:4000
 *
 * Endpoints:
 *   GET  /health          — Health check (is the server running?)
 *   POST /api/preprocess  — Upload and preprocess a satellite image
 */

// ------ Load environment variables from .env file ------
// dotenv reads the .env file and makes its values available via process.env
// This MUST be called before anything else reads process.env
require('dotenv').config();

// ------ Import dependencies ------
const express = require('express'); // Web framework
const cors = require('cors');       // Cross-Origin Resource Sharing
const path = require('path');       // File path utilities

// Import our own modules
const { ensureDirectoryExists } = require('./utils/fileUtils');
const preprocessRoute = require('./routes/preprocess');

// ------ Create the Express application ------
const app = express();
const PORT = process.env.PORT || 4000;

// ------ Global Middleware ------
// These run on EVERY request before reaching the route handlers

// CORS: Allow requests from other origins (e.g., Person E's frontend
// running on localhost:3000 needs to call our API on localhost:4000)
app.use(cors());

// Parse JSON request bodies (for non-file requests)
app.use(express.json());

// Parse URL-encoded form data (for non-file form fields)
app.use(express.urlencoded({ extended: true }));

// ------ Ensure required directories exist ------
// These directories store temporary files during processing.
// We create them on startup so Multer and Sharp don't fail
// trying to write to a directory that doesn't exist.
ensureDirectoryExists(path.join(__dirname, 'uploads'));
ensureDirectoryExists(path.join(__dirname, 'processed'));

// ------ Mount Routes ------

// Health check — a simple endpoint to verify the server is running.
// Useful for monitoring, load balancers, and Person E testing connectivity.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'preprocessing',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// Preprocessing route — handles image upload + validation + processing
app.use(preprocessRoute);

// ------ Global Error Handler ------
// This catches any errors that weren't handled by the route handlers.
// Express recognizes error-handling middleware by its 4 parameters.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({
    valid: false,
    error: 'An unexpected server error occurred.',
  });
});

// ------ Start the Server ------
app.listen(PORT, () => {
  console.log('');
  console.log('==============================================');
  console.log(' SatQuery AI — Preprocessing Service (Person A)');
  console.log('==============================================');
  console.log(`  Server running on:  http://localhost:${PORT}`);
  console.log(`  Health check:       http://localhost:${PORT}/health`);
  console.log(`  Preprocess:         POST http://localhost:${PORT}/api/preprocess`);
  console.log('');
  console.log(`  Router enabled:     ${process.env.ROUTER_ENABLED === 'true' ? 'YES' : 'NO (stubbed)'}`);
  console.log(`  Max upload size:    ${process.env.MAX_FILE_SIZE_MB || 25} MB`);
  console.log(`  Max image dims:     ${process.env.MAX_IMAGE_WIDTH || 2048} x ${process.env.MAX_IMAGE_HEIGHT || 2048}`);
  console.log('==============================================');
  console.log('');
});
