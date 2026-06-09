export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VLM_PROMPT = `你是一个K12教育场景的意图识别助手。用户在教材/练习册图片上圈选了某个区域，你需要：

1. 识别整张图片的页面类型（教材/练习册/课外资料等）、学科、年级、章节（如能判断）
2. OCR提取圈选区域的核心文字内容
3. 分析用户圈选这个内容的目的，推理出1-3个最可能的意图

每个意图必须包含：
- name: 意图名称（简短，用于Tab显示，如"解题步骤"、"概念理解"、"查字义"）
- description: 意图描述（一句话，如"帮我理解这道填表题的解法"）
- confidence: 置信度 0.0-1.0
- content: OCR提取的核心内容（圈选区域的文字）
- subject: 学科，只能是 math / chinese / english 之一

只返回JSON，不要有其他文字：
{
  "intents": [
    {
      "name": "...",
      "description": "...",
      "confidence": 0.9,
      "content": "...",
      "subject": "math"
    }
  ]
}`;

const DEFAULT_KIMI_BASE_URL = 'https://api.moonshot.cn/v1';
const DEFAULT_KIMI_MODEL = 'moonshot-v1-8k-vision-preview';
const DEFAULT_GPT4V_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_GPT4V_MODEL = 'gpt-4o';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VLMRequest {
  image: string;       // base64 data URL (data:image/...;base64,...)
  provider: 'kimi' | 'gpt4v';
  apiKey: string;
  baseURL?: string;
  model?: string;      // optional model override
}

interface IntentData {
  name: string;
  description: string;
  confidence: number;
  content: string;
  subject: 'math' | 'chinese' | 'english';
}

interface VLMData {
  intents: IntentData[];
}

interface VLMResponse {
  success: boolean;
  data?: VLMData;
  error?: {
    message: string;
    code: string;
  };
}

// ── Response helpers ──────────────────────────────────────────────────────────

function ok(data: VLMData): Response {
  const body: VLMResponse = { success: true, data };
  return Response.json(body);
}

function fail(message: string, code: string): Response {
  const body: VLMResponse = { success: false, error: { message, code } };
  return Response.json(body);
}

function badRequest(message: string, code: string): Response {
  const body: VLMResponse = { success: false, error: { message, code } };
  return Response.json(body, { status: 400 });
}

// ── JSON parsing ──────────────────────────────────────────────────────────────

const VALID_SUBJECTS = new Set(['math', 'chinese', 'english']);

function parseModelContent(content: string): VLMData {
  const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return {
      intents: [{
        name: '解题帮助',
        description: '帮我解答这道题',
        confidence: 0.5,
        content: content.trim(),
        subject: 'chinese',
      }],
    };
  }

  const rawIntents = Array.isArray(parsed.intents) ? parsed.intents : [];

  const intents: IntentData[] = rawIntents.map((item: unknown) => {
    const i = (item ?? {}) as Record<string, unknown>;
    return {
      name: typeof i.name === 'string' ? i.name : '解答',
      description: typeof i.description === 'string' ? i.description : '',
      confidence: typeof i.confidence === 'number' ? Math.min(1, Math.max(0, i.confidence)) : 0.5,
      content: typeof i.content === 'string' ? i.content : '',
      subject: VALID_SUBJECTS.has(i.subject as string)
        ? (i.subject as 'math' | 'chinese' | 'english')
        : 'chinese',
    };
  });

  if (intents.length === 0) {
    intents.push({
      name: '解答',
      description: '帮我解答',
      confidence: 0.5,
      content: '',
      subject: 'chinese',
    });
  }

  return { intents };
}

// ── Kimi Vision ───────────────────────────────────────────────────────────────

async function callKimiVision(
  image: string,
  apiKey: string,
  baseURL: string,
  model: string,
): Promise<VLMData> {
  const url = baseURL.replace(/\/$/, '') + '/chat/completions';

  const body = JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: image } },
          { type: 'text', text: VLM_PROMPT },
        ],
      },
    ],
    max_tokens: 500,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      const e = new Error('Request timed out after 60 seconds');
      (e as NodeJS.ErrnoException).code = 'TIMEOUT';
      throw e;
    }
    const e = new Error(err instanceof Error ? err.message : 'Network error');
    (e as NodeJS.ErrnoException).code = 'NETWORK_ERROR';
    throw e;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const e = new Error(`Kimi API error ${res.status}: ${text.slice(0, 200)}`);
    (e as NodeJS.ErrnoException).code = 'API_ERROR';
    throw e;
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;

  if (!content) {
    const e = new Error('Empty response from Kimi Vision API');
    (e as NodeJS.ErrnoException).code = 'PARSE_ERROR';
    throw e;
  }

  return parseModelContent(content);
}

// ── GPT-4V ────────────────────────────────────────────────────────────────────

async function callGPT4Vision(
  image: string,
  apiKey: string,
  baseURL: string,
  model: string,
): Promise<VLMData> {
  const url = baseURL.replace(/\/$/, '') + '/chat/completions';

  const body = JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: image, detail: 'high' } },
          { type: 'text', text: VLM_PROMPT },
        ],
      },
    ],
    max_tokens: 500,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      const e = new Error('Request timed out after 60 seconds');
      (e as NodeJS.ErrnoException).code = 'TIMEOUT';
      throw e;
    }
    const e = new Error(err instanceof Error ? err.message : 'Network error');
    (e as NodeJS.ErrnoException).code = 'NETWORK_ERROR';
    throw e;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const e = new Error(`GPT-4V API error ${res.status}: ${text.slice(0, 200)}`);
    (e as NodeJS.ErrnoException).code = 'API_ERROR';
    throw e;
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;

  if (!content) {
    const e = new Error('Empty response from GPT-4V API');
    (e as NodeJS.ErrnoException).code = 'PARSE_ERROR';
    throw e;
  }

  return parseModelContent(content);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body', 'INVALID_REQUEST');
  }

  const { image, provider, apiKey, baseURL, model } = body as VLMRequest;

  // Validate required fields — only these return 400
  if (!apiKey || typeof apiKey !== 'string') {
    return badRequest('Missing or invalid API key', 'MISSING_API_KEY');
  }
  if (!image || typeof image !== 'string') {
    return badRequest('Missing or invalid image', 'MISSING_IMAGE');
  }

  // Provider validation returns 200 with error (not a missing required field)
  if (provider !== 'kimi' && provider !== 'gpt4v') {
    return fail('Invalid provider — must be "kimi" or "gpt4v"', 'INVALID_PROVIDER');
  }

  try {
    let data: VLMData;

    if (provider === 'kimi') {
      const resolvedBase = (baseURL || DEFAULT_KIMI_BASE_URL).replace(/\/$/, '');
      const resolvedModel = model || DEFAULT_KIMI_MODEL;
      data = await callKimiVision(image, apiKey, resolvedBase, resolvedModel);
    } else {
      const resolvedBase = (baseURL || DEFAULT_GPT4V_BASE_URL).replace(/\/$/, '');
      const resolvedModel = model || DEFAULT_GPT4V_MODEL;
      data = await callGPT4Vision(image, apiKey, resolvedBase, resolvedModel);
    }

    return ok(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as NodeJS.ErrnoException).code ?? 'API_ERROR';

    console.error('[VLM Error]', {
      provider,
      code,
      message,
      timestamp: new Date().toISOString(),
    });

    // All downstream failures return 200 with success: false
    return fail(message, code as string);
  }
}
