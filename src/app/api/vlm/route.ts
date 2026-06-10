export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VLM_PROMPT = `你是一个K12教育场景的意图识别助手。
图片说明：第1张是整页大图（仅用于页面背景判断），第2张是用户圈选的具体区域。意图推理必须基于第2张圈选区域的内容。

【核心任务】
先判断圈选区域的内容类型，再决定意图数量和名称：

**类型A：完整题目**（有题干+明确问题，如填空/选择/计算/应用题）
- 只有1道题 → 输出 **1个意图**，name 为这道题的具体意图名称（如"比较分数大小""求函数最值"）
- 多道不同题号的独立题目 → **每道题1个意图**，name 用"第1题""第2题"区分（不带"解答"）
- 口算/速算题（≥2道简单计算）→ 为 **1个意图**
- 同一题号下的多道小题（如 1.(1)、1.(2)）→ 为 **1个意图**

**类型B：不完整内容**（公式/定义/段落/图形/例题片段，没有完整题目结构）
- **必须输出至少2个意图**，不能只有1个。模型自己根据内容推断不同的学习目的，每个意图对应完全不同的教学行为
- 常见推理方向（仅供参考，模型自己判断）：公式/定义可以从"理解概念"和"看例题应用"两个角度；图表可以从"数据分析"和"读取关键信息"两个角度；例题片段可以从"学习解法"和"归纳方法"两个角度
- 每个意图的 name 为具体的学习行为

⚠️ **关键规则**：如果圈选区域有3道不同题号的独立题目，intents 数组必须包含3个对象，每个对象的 content 只包含对应那道题的文字。

【分析要求】
- 提取每道题/每段内容的完整文字（保留原始格式）
- 描述图形、表格等视觉元素
- 判断学科、年级、章节/知识点

【输出示例】

单题（完整题目）：
{"intents":[{"name":"比较分数大小","description":"用通分的方法比较两个分数，理解分子分母的关系","confidence":0.95,"content":"比较 3/4 和 2/3 的大小","visualDescription":"","pageContext":"五年级数学，分数比较","subject":"math"}]}

多题（2道独立题）：
{"intents":[{"name":"第1题","description":"行程问题：理解速度、时间和路程的关系，学会列式计算","confidence":0.95,"content":"小明骑车速度15千米/时，骑2小时，一共多少千米？","visualDescription":"","pageContext":"四年级数学","subject":"math"},{"name":"第2题","description":"工程问题：理解工作效率和工作总量的关系","confidence":0.95,"content":"一项工程，甲队10天完成，乙队15天完成...","visualDescription":"","pageContext":"四年级数学","subject":"math"}]}

非题目内容（公式定义）：
{"intents":[{"name":"理解勾股定理","description":"帮助理解直角三角形三边的关系，知道a²+b²=c²的含义","confidence":0.9,"content":"勾股定理：直角三角形中，两条直角边的平方和等于斜边的平方","visualDescription":"","pageContext":"八年级数学","subject":"math"},{"name":"看典型例题","description":"举一个用勾股定理求斜边长度的例子，≤3步","confidence":0.85,"content":"","visualDescription":"","pageContext":"八年级数学","subject":"math"}]}

【每个意图的字段说明】
- name: 意图名称
  - 单题：分析得出的具体名称（如"比较分数大小""求函数最值"）
  - 多题："第1题""第2题"（不带"解答"）
  - 非题目内容：具体学习行为（如"理解xx定义""学习xx方法"）
- description: 题目类型+考点+需要解决什么问题
- confidence: 0.0-1.0
- content: 该意图对应的内容文字
- visualDescription: 图形描述，无则填空
- pageContext: 年级/章节，无则填空
- subject: math/chinese/english

只返回JSON，不要有其他文字。`;



const DEFAULT_KIMI_BASE_URL = 'https://api.moonshot.cn/v1';
const DEFAULT_KIMI_MODEL = 'moonshot-v1-8k-vision-preview';
const DEFAULT_GPT4V_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_GPT4V_MODEL = 'gpt-4o';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VLMRequest {
  image: string;            // cropped region data URL
  fullPageImage?: string;   // full page data URL for context
  provider: 'kimi' | 'gpt4v';
  apiKey: string;
  baseURL?: string;
  model?: string;
}

interface IntentData {
  name: string;
  description: string;
  confidence: number;
  content: string;
  visualDescription: string;
  pageContext: string;
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
  // Strip markdown code fences if present
  let candidate = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // Find the first { and last } — handles leading/trailing prose
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  }

  // Fix invalid JSON escape sequences produced by LaTeX in VLM output.
  // Strategy: replace every backslash that is NOT followed by a valid JSON
  // escape character OR is followed by a letter that forms a LaTeX command
  // (e.g. \frac, \text, \times, \sqrt, \cdot, \leq, \geq, \neq, \pm …)
  // We do this by replacing all backslashes, then putting back the valid ones.
  // Simpler: just double every backslash, then un-double the ones that were
  // already doubled (i.e. \\\\  →  \\).
  const fixedCandidate = candidate
    .replace(/\\\\/g, '\x00')          // temporarily hide existing \\
    .replace(/\\/g, '\\\\')            // escape all lone backslashes
    .replace(/\x00/g, '\\\\');         // restore \\ (now \\\\, correct in JSON)

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fixedCandidate);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const pos = parseInt(msg.match(/position (\d+)/)?.[1] ?? '-1');
    console.error('[VLM parse error]', msg);
    console.error('[VLM around error pos]', JSON.stringify(fixedCandidate.slice(Math.max(0, pos - 50), pos + 50)));
    console.error('[VLM raw content]', content.slice(0, 2000));
    return {
      intents: [{
        name: '解题帮助',
        description: '帮我解答这道题',
  
        confidence: 0.5,
        content: content.trim(),
        visualDescription: '',
        pageContext: '',
        subject: 'math',
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
      visualDescription: typeof i.visualDescription === 'string' ? i.visualDescription : '',
      pageContext: typeof i.pageContext === 'string' ? i.pageContext : '',
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
      visualDescription: '',
      pageContext: '',
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
  fullPageImage?: string,
): Promise<VLMData> {
  const url = baseURL.replace(/\/$/, '') + '/chat/completions';

  const imageContent = fullPageImage
    ? [
        { type: 'image_url', image_url: { url: fullPageImage } },
        { type: 'image_url', image_url: { url: image } },
        { type: 'text', text: VLM_PROMPT },
      ]
    : [
        { type: 'image_url', image_url: { url: image } },
        { type: 'text', text: VLM_PROMPT },
      ];

  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: imageContent }],
    max_tokens: 2000,
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
  fullPageImage?: string,
): Promise<VLMData> {
  const url = baseURL.replace(/\/$/, '') + '/chat/completions';

  const imageContent = fullPageImage
    ? [
        { type: 'image_url', image_url: { url: fullPageImage, detail: 'low' } },
        { type: 'image_url', image_url: { url: image, detail: 'high' } },
        { type: 'text', text: VLM_PROMPT },
      ]
    : [
        { type: 'image_url', image_url: { url: image, detail: 'high' } },
        { type: 'text', text: VLM_PROMPT },
      ];

  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: imageContent }],
    max_tokens: 2000,
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

  const { image, fullPageImage, provider, apiKey, baseURL, model } = body as VLMRequest;

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
      data = await callKimiVision(image, apiKey, resolvedBase, resolvedModel, fullPageImage);
    } else {
      const resolvedBase = (baseURL || DEFAULT_GPT4V_BASE_URL).replace(/\/$/, '');
      const resolvedModel = model || DEFAULT_GPT4V_MODEL;
      data = await callGPT4Vision(image, apiKey, resolvedBase, resolvedModel, fullPageImage);
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
