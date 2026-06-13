import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Sessions are stored client-side. No server-side session lookup available.' },
    { status: 410 }
  );
}
