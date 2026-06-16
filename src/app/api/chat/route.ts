import { MATH_SYSTEM_PROMPT, CHINESE_SYSTEM_PROMPT, ENGLISH_SYSTEM_PROMPT } from '@/lib/prompts/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const enc = new TextEncoder();
const DEFAULT_MODEL = 'moonshot-v1-8k';
const FETCH_TIMEOUT_MS = 180_000;

function ndjson(obj: object) {
  return enc.encode(JSON.stringify(obj) + '\n');
}

type Controller = ReadableStreamDefaultController<Uint8Array>;

// ── Simple text-only SSE parser (no tool calls) ─────────────────────────────

function normalizeEnglishHeadings(text: string, subject: string): string {
  if (subject !== 'english') return text;
  return text.replace(/##\s*拼音/g, '## 音标');
}

async function streamText(
  res: Response,
  ctrl: Controller,
  subject: string,
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let assistantText = '';
  let chunkCount = 0;
  let firstChunk = true;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const decoded = decoder.decode(value, { stream: true });
    buf += decoded;
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let json: Record<string, unknown>;
      try { json = JSON.parse(data); } catch { continue; }

      if (firstChunk) {
        console.log('[streamText first chunk]', JSON.stringify(json).slice(0, 300));
        firstChunk = false;
      }

      const choice = (json.choices as Array<Record<string, unknown>>)?.[0];
      if (!choice) {
        console.log('[streamText no choice]', JSON.stringify(json).slice(0, 200));
        continue;
      }
      const delta = (choice.delta ?? {}) as Record<string, unknown>;

      if (typeof delta.content === 'string' && delta.content) {
        chunkCount++;
        const normalized = normalizeEnglishHeadings(delta.content, subject);
        assistantText += normalized;
        ctrl.enqueue(ndjson({ t: 'tx', v: normalized }));
      }
    }
  }

  console.log('[streamText done] chunks:', chunkCount, 'text length:', assistantText.length);
  return assistantText;
}

// ── Main handler ─────────────────────────────────────────────────────────────

type MessageContent = string | Array<{ type: string; text?: string; image_url?: unknown }>;

function extractText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content.filter(p => p.type === 'text').map(p => p.text ?? '').join(' ');
}

function detectSubject(messages: Array<{ role: string; content: MessageContent }>): string {
  const text = messages.map(m => extractText(m.content)).join(' ');
  const mathKeywords = /数学|计算|方程|函数|几何|证明|求解|导数|积分|矩阵|概率|统计|三角|面积|体积|多项式|因式|平方|立方|勾股|抛物线|坐标|向量|集合|不等式|直线|交点|图像|画出|画图|斜率|截距|二次|一次|正方形|长方形|三角形|菱形|梯形|圆|角|边|\d\s*[\+\-\*\/=]|[=＝]\s*\d|[xy]\s*[=＝]/;
  const chineseKeywords = /语文|汉字|拼音|字词|组词|造句|作文|古诗|文言|部首|笔顺|成语|近义词|反义词|修辞|比喻|排比|词语|段落|中心思想|写法|鉴赏|赏析|怎么写|笔画/;
  const englishKeywords = /英语|英文|单词|语法|时态|听力|口语|音标|从句|passive|tense|grammar|translate|english|[a-zA-Z]{3,}/i;
  if (mathKeywords.test(text)) return 'math';
  if (chineseKeywords.test(text)) return 'chinese';
  if (englishKeywords.test(text)) return 'english';
  return 'chinese';
}

function getSystemPrompt(subject: string): string {
  switch (subject) {
    case 'chinese': return CHINESE_SYSTEM_PROMPT;
    case 'english': return ENGLISH_SYSTEM_PROMPT;
    default: return MATH_SYSTEM_PROMPT;
  }
}

export async function POST(req: Request) {
  const { messages, model, apiKey, baseURL, subjectOverride } = await req.json() as {
    messages: Array<{ role: string; content: MessageContent }>;
    model: string;
    apiKey: string;
    baseURL?: string;
    subjectOverride?: 'math' | 'chinese' | 'english';
  };

  if (!apiKey || typeof apiKey !== 'string') {
    return new Response('Missing API key', { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('Invalid messages', { status: 400 });
  }
  if (model !== undefined && typeof model !== 'string') {
    return new Response('Invalid model', { status: 400 });
  }

  const isAnthropic = !baseURL && apiKey.startsWith('sk-ant-');
  const isGoogle = !baseURL && apiKey.startsWith('AIza');
  
  // Auto-detect common providers when baseURL is not provided
  let resolvedBaseURL = baseURL;
  if (!resolvedBaseURL && !isAnthropic && !isGoogle) {
    if (apiKey.startsWith('sk-')) {
      resolvedBaseURL = 'https://api.moonshot.cn/v1'; // Kimi default
    }
  }

  const subject = subjectOverride ?? detectSubject(messages);
  const systemPrompt = getSystemPrompt(subject);

  // Debug: log what the generation model receives
  console.log('[chat input] subject:', subject);
  console.log('[chat input] system prompt (first 100):', systemPrompt.slice(0, 100));
  for (const m of messages) {
    if (typeof m.content === 'string') {
      console.log(`[chat input] ${m.role}:`, m.content.slice(0, 300));
    } else {
      const parts = m.content.map(p => p.type === 'image_url' ? '[IMAGE]' : p.text?.slice(0, 200));
      console.log(`[chat input] ${m.role} (multimodal):`, parts);
    }
  }

  // Google: use OpenAI-compatible endpoint
  if (isGoogle) {
    const googleBase = 'https://generativelanguage.googleapis.com/v1beta/openai';
    const googleModel = (model as string).replace(/^google\//, '') || 'gemini-2.0-flash';
    const readable = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        try { await runOpenAI(googleBase, apiKey, googleModel, messages, systemPrompt, ctrl, subject); }
        catch (err) { ctrl.enqueue(ndjson({ t: 'err', v: err instanceof Error ? err.message : String(err) })); }
        finally { ctrl.close(); }
      },
    });
    return new Response(readable, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } });
  }

  const readable = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      try {
        if (isAnthropic) {
          await runAnthropic(apiKey, model, messages, systemPrompt, ctrl, subject);
        } else {
          await runOpenAI(resolvedBaseURL, apiKey, model, messages, systemPrompt, ctrl, subject);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctrl.enqueue(ndjson({ t: 'err', v: msg }));
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(readable, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } });
}

// ── OpenAI-compatible runner (text-only, no tool calls) ──────────────────────

async function runOpenAI(
  baseURL: string | undefined,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: MessageContent }>,
  systemPrompt: string,
  ctrl: Controller,
  subject: string,
) {
  if (!baseURL) throw new Error('baseURL is required。请填入API Base URL，例如：https://api.moonshot.cn/v1');
  const url = baseURL.replace(/\/$/, '') + '/chat/completions';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  const resolvedModel = model || DEFAULT_MODEL;
  // Kimi context window limits: 8k→8192 total, 32k→32768 total.
  // Use prefix match to handle model variants like moonshot-v1-8k-vision-preview.
  const maxTokens = resolvedModel.includes('8k') ? 2000 : resolvedModel.includes('32k') ? 4000 : 4000;

  const bodyObj = {
    model: resolvedModel,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
    max_tokens: maxTokens,
  };

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(bodyObj), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  await streamText(res, ctrl, subject);
}

// ── Anthropic runner (text-only, no tool calls) ──────────────────────────────

async function runAnthropic(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: MessageContent }>,
  systemPrompt: string,
  ctrl: Controller,
  subject: string,
) {
  const url = 'https://api.anthropic.com/v1/messages';
  const id = model.replace(/^anthropic\//, '') || 'claude-sonnet-4-5';
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  const body = JSON.stringify({
    model: id,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    stream: true,
  });

  const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  await streamAnthropicText(res, ctrl, subject);
}

// ── Anthropic text-only SSE parser ───────────────────────────────────────────

async function streamAnthropicText(
  res: Response,
  ctrl: Controller,
  subject: string,
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let assistantText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      let json: Record<string, unknown>;
      try { json = JSON.parse(line.slice(5).trim()); } catch { continue; }

      if (json.type === 'content_block_delta') {
        const delta = json.delta as Record<string, unknown>;
        if (delta.type === 'text_delta') {
          const text = String(delta.text ?? '');
          const normalized = normalizeEnglishHeadings(text, subject);
          assistantText += normalized;
          ctrl.enqueue(ndjson({ t: 'tx', v: normalized }));
        }
      }
    }
  }

  return assistantText;
}
