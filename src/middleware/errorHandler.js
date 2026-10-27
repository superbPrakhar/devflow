/**
 * Standardized API Error Handler
 */
class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details = null) {
    return new ApiError(400, message, details);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static internal(message = 'An unexpected server error occurred') {
    return new ApiError(500, message);
  }
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  if (status >= 500) {
    console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);
  }

  res.status(status).json({
    success: false,
    error: {
      status,
      message,
      details: err.details || null
    }
  });
}

module.exports = {
  ApiError,
  errorHandler
};
