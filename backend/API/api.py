"""
Flask REST API for Dynamic CSV Agent

This module provides the HTTP endpoint for the frontend to communicate with
the dynamic CSV processing agent.
"""

import asyncio
import logging
import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

from dynamic_agent import process_row, get_agent_status as _get_agent_status
from config import get_config

# Initialize Flask app
app = Flask(__name__)

# Security: Limit request size to 16MB
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Enable CORS for frontend communication
# Restrict origins in production via ALLOWED_ORIGINS environment variable
allowed_origins = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
CORS(app, resources={
    r"/api/*": {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-API-Key"]
    },
    r"/health": {
        "origins": "*",
        "methods": ["GET"]
    }
})


@app.before_request
def check_api_key():
    """
    Middleware to validate API key for /api/* endpoints.
    Skips validation if API_SECRET_KEY is not set (development mode).
    """
    # Skip for non-API routes and OPTIONS requests (CORS preflight)
    if not request.path.startswith('/api/') or request.method == 'OPTIONS':
        return None

    expected_key = os.environ.get('API_SECRET_KEY')

    # If no API key is configured, allow all requests (dev mode)
    if not expected_key:
        return None

    provided_key = request.headers.get('X-API-Key')

    if provided_key != expected_key:
        return jsonify({
            'status': 'error',
            'error': 'Unauthorized',
            'details': 'Invalid or missing API key'
        }), 401

# Load config first (needed for logging setup)
config = get_config()

# Setup logging with DEBUG_MODE support
logging.basicConfig(
    level=logging.INFO if not config.debug_mode else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Log startup configuration
config.log_config_summary(logger)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring and load balancers."""
    status = _get_agent_status()
    return jsonify({
        'status': 'healthy',
        'service': 'knowledge-robot',
        'version': '1.1.0',
        'agent_ready': status['litellm_model_initialized'],
        'model': status['model'],
    })


@app.route('/api/process-row', methods=['POST'])
def process_csv_row():
    """
    Process a single CSV row with the dynamic agent.

    Request Body (JSON):
    {
        "row_data": {
            "customer_name": "John Smith",
            "product": "Laptop X1",
            "review": "Great product! Very fast.",
            "rating": 5
        },
        "prompt": "Analyze {customer_name}'s review of {product}: '{review}'. Consider the rating of {rating}.",
        "output_schema": [
            {
                "name": "sentiment",
                "type": "text",
                "description": "Overall sentiment (positive, negative, neutral)"
            },
            {
                "name": "key_points",
                "type": "text",
                "description": "Main points from the review"
            },
            {
                "name": "matches_rating",
                "type": "boolean",
                "description": "Does the sentiment match the rating?"
            }
        ],
        "enable_search": false  // Optional: Enable firecrawl_search tool (default: false)
    }

    Response (JSON):
    {
        "output": {
            "sentiment": "positive",
            "key_points": "Fast performance, great quality",
            "matches_rating": true,
            "_processed_at": "2025-10-04T12:34:56.789Z"
        },
        "metadata": {
            "processing_time_ms": 5432,
            "row_data_received": true,
            "schema_fields_count": 3
        }
    }

    Error Response:
    {
        "status": "error",
        "error": "Error message here",
        "details": "Additional error details"
    }
    """
    start_time = time.time()

    try:
        # Parse request JSON
        data = request.get_json()

        if not data:
            logger.error("No JSON data provided in request")
            return jsonify({
                'status': 'error',
                'error': 'No JSON data provided'
            }), 400

        # Extract request parameters
        row_data = data.get('row_data', {})
        prompt = data.get('prompt', '')
        output_schema = data.get('output_schema', [])
        scrape_backend = data.get('scrape_backend', 'local')
        browser_visible = bool(data.get('browser_visible', False))
        enable_search = bool(data.get('enable_search', False))

        if scrape_backend not in ('firecrawl', 'local'):
            return jsonify({
                'status': 'error',
                'error': f'Invalid scrape_backend: {scrape_backend!r}. Must be "local" or "firecrawl".',
            }), 400

        # Validate required fields
        if not row_data:
            logger.error("row_data is required")
            return jsonify({
                'status': 'error',
                'error': 'row_data is required'
            }), 400

        if not prompt:
            logger.error("prompt is required")
            return jsonify({
                'status': 'error',
                'error': 'prompt is required'
            }), 400

        if not output_schema:
            logger.error("output_schema is required")
            return jsonify({
                'status': 'error',
                'error': 'output_schema is required'
            }), 400

        logger.info(
            "Processing CSV row: cols=%d, output_fields=%d, backend=%s, visible=%s, search=%s",
            len(row_data), len(output_schema), scrape_backend, browser_visible, enable_search,
        )

        # Process row (run async function in sync context).
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                process_row(
                    row_data, prompt, output_schema,
                    scrape_backend=scrape_backend,
                    browser_visible=browser_visible,
                    enable_search=enable_search,
                )
            )
        finally:
            loop.close()

        # Calculate processing time
        processing_time = int((time.time() - start_time) * 1000)

        logger.info(f"Successfully processed CSV row in {processing_time}ms")

        return jsonify({
            'output': result,
            'metadata': {
                'processing_time_ms': processing_time,
                'row_data_received': True,
                'schema_fields_count': len(output_schema)
            }
        })

    except ValueError as e:
        # Validation errors
        logger.error(f"Validation error: {e}", exc_info=True)
        return jsonify({
            'status': 'error',
            'error': 'Validation error',
            'details': str(e)
        }), 400

    except Exception as e:
        # General errors
        logger.error(f"Error processing request: {e}", exc_info=True)
        return jsonify({
            'status': 'error',
            'error': 'Internal server error',
            'details': str(e)
        }), 500


@app.route('/api/agent-status', methods=['GET'])
def agent_status_endpoint():
    """Get the current status of the agent (model, capabilities, etc.)."""
    try:
        return jsonify(_get_agent_status())
    except Exception as e:
        logger.error(f"Error getting agent status: {e}", exc_info=True)
        return jsonify({
            'status': 'error',
            'error': str(e),
        }), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'status': 'error',
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {error}", exc_info=True)
    return jsonify({
        'status': 'error',
        'error': 'Internal server error'
    }), 500


# Development server (not used in production with gunicorn)
if __name__ == '__main__':
    logger.info("Starting Knowledge Robot API in development mode...")
    config.log_config_summary(logger)
    app.run(
        host='0.0.0.0',
        port=8080,
        debug=config.debug_mode
    )
