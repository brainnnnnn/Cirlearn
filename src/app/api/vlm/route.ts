export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { recognizeIntent } from '@/services/vlmService';
import { VLMRequest, VLMResponse } from '@/types';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as VLMRequest;
    const data = await recognizeIntent(body);
    const response: VLMResponse = { success: true, data };
    return Response.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = (err as NodeJS.ErrnoException)?.code || 'INTERNAL_ERROR';
    const response: VLMResponse = {
      success: false,
      error: { message, code },
    };
    return Response.json(response, { status: 500 });
  }
}
