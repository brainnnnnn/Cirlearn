export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { streamChat } from '@/services/chatService';
import { ChatRequest } from '@/types';

const enc = new TextEncoder();

function ndjson(obj: object): Uint8Array {
  return enc.encode(JSON.stringify(obj) + '\n');
}

export async function POST(req: Request): Promise<Response> {
  const request = (await req.json()) as ChatRequest;
  const subject = request.subjectOverride ?? 'chinese';

  try {
    const llmResponse = await streamChat(request);

    if (!llmResponse.ok || !llmResponse.body) {
      const text = await llmResponse.text().catch(() => `API error ${llmResponse.status}`);
      console.error('[chat upstream error]', llmResponse.status, text.slice(0, 1000));
      return Response.json({ success: false, error: text }, { status: llmResponse.status });
    }

    const isAnthropic = !request.baseURL && request.apiKey.startsWith('sk-ant-');
    const reader = llmResponse.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    const stream = new ReadableStream({
      start(controller) {
        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (data === '[DONE]') continue;

              let json: Record<string, unknown>;
              try {
                json = JSON.parse(data);
              } catch {
                continue;
              }

              const text = extractTextFromChunk(json, isAnthropic);
              if (text) {
                const normalized = normalizeEnglishHeadings(text, subject);
                controller.enqueue(ndjson({ t: 'tx', v: normalized }));
              }
            }

            return pump();
          }).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            controller.enqueue(ndjson({ t: 'err', v: msg }));
            controller.close();
          });
        }

        pump();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
}

function extractTextFromChunk(json: Record<string, unknown>, isAnthropic: boolean): string | undefined {
  if (isAnthropic) {
    if (json.type === 'content_block_delta') {
      const delta = json.delta as Record<string, unknown> | undefined;
      if (delta?.type === 'text_delta') {
        return String(delta.text ?? '');
      }
    }
    return undefined;
  }

  const choices = json.choices as Array<Record<string, unknown>> | undefined;
  if (!choices) return undefined;
  const choice = choices[0];
  if (!choice) return undefined;
  const delta = (choice.delta ?? {}) as Record<string, unknown>;
  return typeof delta.content === 'string' ? delta.content : undefined;
}

function normalizeEnglishHeadings(text: string, subject: string): string {
  if (subject !== 'english') return text;
  return text.replace(/##\s*拼音/g, '## 音标');
}
