import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const API_KEY = process.env.API_SECRET_KEY;

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/agent-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'X-API-Key': API_KEY }),
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('agent-status proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 502 }
    );
  }
}
