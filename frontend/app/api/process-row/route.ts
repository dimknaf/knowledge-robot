import { NextRequest, NextResponse } from 'next/server';
import { Agent } from 'undici';

/**
 * Backend API URL - server-side only (not exposed to browser)
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * API Key for backend authentication - server-side only
 */
const API_KEY = process.env.API_SECRET_KEY;

/**
 * Per-request upper bound. Longer than `headersTimeout` because the backend
 * may legitimately take 1+ min for a single row in local mode with multiple
 * page visits.
 */
const PROCESS_ROW_TIMEOUT_MS = Number(process.env.PROCESS_ROW_TIMEOUT_MS) || 300_000;

/**
 * Override Node's default 30s undici headersTimeout. Without this, requests
 * that queue behind gunicorn workers under high concurrency get aborted by
 * the proxy with `UND_ERR_HEADERS_TIMEOUT` even though the backend would
 * eventually return successfully.
 */
const dispatcher = new Agent({
  headersTimeout: 300_000, // 5 min
  bodyTimeout: 300_000,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('🔄 Proxying request to backend:', {
      url: `${BACKEND_URL}/api/process-row`,
      hasApiKey: !!API_KEY,
    });

    const response = await fetch(`${BACKEND_URL}/api/process-row`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'X-API-Key': API_KEY }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PROCESS_ROW_TIMEOUT_MS),
      // @ts-expect-error - dispatcher is a Node-only undici extension to fetch
      dispatcher,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('✅ Backend response received');
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      console.error('⏱️ Backend timeout after', PROCESS_ROW_TIMEOUT_MS, 'ms');
      return NextResponse.json(
        {
          error: 'Backend timed out',
          details: `No response from backend within ${PROCESS_ROW_TIMEOUT_MS / 1000}s. The row may still be processing — try lower concurrency or raise PROCESS_ROW_TIMEOUT_MS.`,
        },
        { status: 504 }
      );
    }
    console.error('❌ API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
