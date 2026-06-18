import { VLMRequest, VLMData, IntentData, Subject } from '@/types';
import { VLM_PROMPT } from '@/lib/vlmPrompt';

const DEFAULT_KIMI_BASE_URL = 'https://api.moonshot.cn/v1';
const DEFAULT_KIMI_MODEL = 'moonshot-v1-8k-vision-preview';
const DEFAULT_GPT4V_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_GPT4V_MODEL = 'gpt-4o';

const VALID_SUBJECTS = new Set(['math', 'chinese', 'english']);

export async function recognizeIntent(request: VLMRequest): Promise<VLMData> {
  const { image, fullPageImage, provider, apiKey, baseURL, model } = request;

  const resolvedBaseURL = (baseURL || (provider === 'kimi' ? DEFAULT_KIMI_BASE_URL : DEFAULT_GPT4V_BASE_URL)).replace(
    /\/$/,
    '',
  );
  const resolvedModel = model || (provider === 'kimi' ? DEFAULT_KIMI_MODEL : DEFAULT_GPT4V_MODEL);

  if (provider === 'kimi') {
    return callKimiVision(image, apiKey, resolvedBaseURL, resolvedModel, fullPageImage);
  }

  return callGPT4Vision(image, apiKey, resolvedBaseURL, resolvedModel, fullPageImage);
}

async function callKimiVision(
  image: string,
  apiKey: string,
  baseURL: string,
  model: string,
  fullPageImage?: string,
): Promise<VLMData> {
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

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

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;

  if (!content) {
    const e = new Error('Empty response from Kimi Vision API');
    (e as NodeJS.ErrnoException).code = 'PARSE_ERROR';
    throw e;
  }

  return parseModelContent(content);
}

async function callGPT4Vision(
  image: string,
  apiKey: string,
  baseURL: string,
  model: string,
  fullPageImage?: string,
): Promise<VLMData> {
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

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

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;

  if (!content) {
    const e = new Error('Empty response from GPT-4V API');
    (e as NodeJS.ErrnoException).code = 'PARSE_ERROR';
    throw e;
  }

  return parseModelContent(content);
}

export function parseModelContent(content: string): VLMData {
  // Strip markdown code fences if present
  let candidate = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // Find the first { and last } — handles leading/trailing prose
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  }

  // Fix invalid JSON escape sequences produced by LaTeX in VLM output.
  const fixedCandidate = candidate
    .replace(/\\\\/g, '\x00')
    .replace(/\\/g, '\\\\')
    .replace(/\x00/g, '\\\\');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fixedCandidate);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const pos = parseInt(msg.match(/position (\d+)/)?.[1] ?? '-1', 10);
    console.error('[VLM parse error]', msg);
    console.error('[VLM around error pos]', JSON.stringify(fixedCandidate.slice(Math.max(0, pos - 50), pos + 50)));
    console.error('[VLM raw content]', content.slice(0, 2000));
    return {
      intents: [
        {
          name: '解题帮助',
          description: '帮我解答这道题',
          confidence: 0.5,
          content: content.trim(),
          visualDescription: '',
          pageContext: '',
          subject: 'math',
        },
      ],
    };
  }

  const rawIntents = Array.isArray(parsed.intents) ? parsed.intents : [];

  const intents: IntentData[] = rawIntents.map((item: unknown) => {
    const i = (item ?? {}) as Record<string, unknown>;
    const subject = VALID_SUBJECTS.has(i.subject as string) ? (i.subject as Subject) : 'chinese';
    const intent: IntentData = {
      name: typeof i.name === 'string' ? i.name : '解答',
      description: typeof i.description === 'string' ? i.description : '',
      confidence: typeof i.confidence === 'number' ? Math.min(1, Math.max(0, i.confidence)) : 0.5,
      content: typeof i.content === 'string' ? i.content : '',
      visualDescription: typeof i.visualDescription === 'string' ? i.visualDescription : '',
      pageContext: typeof i.pageContext === 'string' ? i.pageContext : '',
      subject,
    };

    // Parse optional questionType for math question intents
    const qt = i.questionType as Record<string, unknown> | undefined;
    if (qt && typeof qt.type === 'number' && typeof qt.type_16 === 'string' && typeof qt.type_all === 'string') {
      intent.questionType = {
        type: qt.type,
        type_16: qt.type_16,
        type_all: qt.type_all,
      };
    }

    // Parse optional knowledgePoint for 查知识点 intent
    if (typeof i.knowledgePoint === 'string' && i.knowledgePoint) {
      intent.knowledgePoint = i.knowledgePoint;
    }

    return intent;
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
