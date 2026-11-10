import { NextResponse } from 'next/server';
import packageJson from '../../../../../package.json';

// Deploy-verification endpoint, same contract as the next and calendar repos' /api/public/health.
// `version` is imported from package.json so it reflects what was baked into this build.
// GET route handlers are dynamic by default in Next 16 (no caching); force it explicitly anyway.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'UP',
    version: packageJson.version
  });
}
