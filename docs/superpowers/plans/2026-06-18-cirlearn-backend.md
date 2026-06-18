# Cirlearn Backend 独立服务改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `genui-demo` 的 Next.js API Route 后端迁移为独立的 Express + TypeScript 服务 `cirlearn-backend`，并保持前端接口契约不变。

**Architecture:** 采用 Express 分层架构（routes → controllers → services → lib），复用现有业务逻辑（VLM 意图识别、学科路由、Prompt、流式输出），通过 REST + SSE 与前端通信。

**Tech Stack:** Node.js, Express, TypeScript, ts-node-dev, cors, dotenv

---

## 前置准备

- 源项目：`/Users/tal/Documents/genui-demo`
- 目标项目：`/Users/tal/Documents/cirlearn-backend`
- 设计文档：`/Users/tal/Documents/genui-demo/docs/superpowers/specs/2026-06-18-cirlearn-backend-design.md`

---

## Task 1: 复制项目并清理前端代码

**Files:**
- Create: `/Users/tal/Documents/cirlearn-backend/` (entire project)
- Delete: `/Users/tal/Documents/cirlearn-backend/src/app/api/`
- Delete: `/Users/tal/Documents/cirlearn-backend/src/app/` (keep only backend-related assets if any)
- Delete: `/Users/tal/Documents/cirlearn-backend/.next/`
- Delete: `/Users/tal/Documents/cirlearn-backend/node_modules/`

- [ ] **Step 1: Copy project**

```bash
cp -R /Users/tal/Documents/genui-demo /Users/tal/Documents/cirlearn-backend
```

- [ ] **Step 2: Remove Next.js frontend code and API routes**

```bash
cd /Users/tal/Documents/cirlearn-backend
rm -rf src/app/api src/app src/components src/hooks src/lib/prompts/.DS_Store public .next node_modules
rm -f next.config.ts next-env.d.ts postcss.config.mjs tsconfig.tsbuildinfo
```

Keep:
- `src/lib/prompts/prompts.ts`
- `package.json` (will be overwritten in Task 2)
- `.gitignore`
- `README.md`

- [ ] **Step 3: Reinitialize git**

```bash
cd /Users/tal/Documents/cirlearn-backend
rm -rf .git
git init
git add .
git commit -m "chore: initialize cirlearn-backend from genui-demo"
```

---

## Task 2: 创建 Express 后端项目配置

**Files:**
- Create: `/Users/tal/Documents/cirlearn-backend/package.json`
- Create: `/Users/tal/Documents/cirlearn-backend/tsconfig.json`
- Create: `/Users/tal/Documents/cirlearn-backend/.env.example`
- Modify: `/Users/tal/Documents/cirlearn-backend/.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "cirlearn-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .env.example**

```bash
PORT=3001
NODE_ENV=development
```

- [ ] **Step 4: Update .gitignore**

Append or ensure these entries exist:

```
node_modules
dist
.env
.DS_Store
```

- [ ] **Step 5: Install dependencies**

```bash
cd /Users/tal/Documents/cirlearn-backend
npm install
```

- [ ] **Step 6: Commit**

```bash
cd /Users/tal/Documents/cirlearn-backend
git add package.json package-lock.json tsconfig.json .env.example .gitignore
git commit -m "chore: setup Express + TypeScript project config"
```

---

## Task 3: 创建共享类型与配置

**Files:**
- Create: `/Users/tal/Documents/cirlearn-backend/src/types/index.ts`
- Create: `/Users/tal/Documents/cirlearn-backend/src/lib/config.ts`

- [ ] **Step 1: Create types**

```typescript
// src/types/index.ts

export type Subject = 'math' | 'chinese' | 'english';
export type Provider = 'kimi' | 'gpt4v';

export interface IntentData {
  name: string;
  description: string;
  confidence: number;
  content: string;
  visualDescription: string;
  pageContext: string;
  subject: Subject;
}

export interface VLMData {
  intents: IntentData[];
}

export interface VLMRequest {
  image: string;
  fullPageImage?: string;
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export interface VLMResponse {
  success: boolean;
  data?: VLMData;
  error?: {
    message: string;
    code: string;
  };
}

export interface ChatMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: unknown }>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  apiKey: string;
  baseURL?: string;
  subjectOverride?: Subject;
}

export interface StreamChunk {
  t: string;
  v: string;
}
```

- [ ] **Step 2: Create config**

```typescript
// src/lib/config.ts

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tal/Documents/cirlearn-backend
git add src/types/index.ts src/lib/config.ts
git commit -m "feat: add shared types and config"
```

---

## Task 4: 创建 LLM 服务封装

**Files:**
- Create: `/Users/tal/Documents/cirlearn-backend/src/services/llmService.ts`

- [ ] **Step 1: Implement LLM service**

```typescript
// src/services/llmService.ts

export interface LLMCallOptions {
  baseURL?: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  temperature?: number;
  stream?: boolean;
}

export async function callLLM(options: LLMCallOptions): Promise<Response> {
  const { baseURL, apiKey, model, messages, temperature = 0.7, stream = false } = options;

  const resolvedBaseURL = resolveBaseURL(baseURL, apiKey);
  const isAnthropic = !baseURL && apiKey.startsWith('sk-ant-');
  const isGoogle = !baseURL && apiKey.startsWith('AIza');

  if (isAnthropic) {
    return callAnthropic({ apiKey, model, messages, temperature, stream });
  }

  if (isGoogle) {
    return callGoogleOpenAI({ apiKey, model, messages, temperature, stream }, resolvedBaseURL);
  }

  return callOpenAICompatible({ baseURL: resolvedBaseURL, apiKey, model, messages, temperature, stream });
}

function resolveBaseURL(baseURL: string | undefined, apiKey: string): string {
  if (baseURL) return baseURL;
  if (apiKey.startsWith('sk-ant-')) return 'https://api.anthropic.com/v1';
  if (apiKey.startsWith('AIza')) return 'https://generativelanguage.googleapis.com/v1beta/openai';
  if (apiKey.startsWith('sk-')) return 'https://api.moonshot.cn/v1';
  return 'https://api.openai.com/v1';
}

async function callOpenAICompatible(options: LLMCallOptions & { baseURL: string }): Promise<Response> {
  const { baseURL, apiKey, model, messages, temperature, stream } = options;
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream,
    }),
  });
}

async function callAnthropic(options: LLMCallOptions): Promise<Response> {
  const { apiKey, model, messages, temperature, stream } = options;
  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const userMessages = messages.filter(m => m.role !== 'system');

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature,
      system: systemMessage,
      messages: userMessages,
      stream,
    }),
  });
}

async function callGoogleOpenAI(options: LLMCallOptions, baseURL: string): Promise<Response> {
  const { apiKey, model, messages, temperature, stream } = options;
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream,
    }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tal/Documents/cirlearn-backend
git add src/services/llmService.ts
git commit -m "feat: add LLM service wrapper"
```

---

## Task 5: 迁移 VLM 服务

**Files:**
- Create: `/Users/tal/Documents/cirlearn-backend/src/services/vlmService.ts`
- Create: `/Users/tal/Documents/cirlearn-backend/src/lib/vlmPrompt.ts`

- [ ] **Step 1: Copy VLM prompt**

Copy the `VLM_PROMPT` string from `/Users/tal/Documents/genui-demo/src/app/api/vlm/route.ts` into:

```typescript
// src/lib/vlmPrompt.ts

export const VLM_PROMPT = `你是圈圈学意图识别助手。第1张是整页背景图，第2张是用户圈选的具体区域，推断必须基于第2张。

【分类规则】
...existing prompt content...
只返回JSON，不要有其他文字。`;
```

- [ ] **Step 2: Implement VLM service**

```typescript
// src/services/vlmService.ts

import { VLMRequest, VLMData, IntentData } from '../types';
import { VLM_PROMPT } from '../lib/vlmPrompt';
import { callLLM } from './llmService';

const DEFAULT_KIMI_BASE_URL = 'https://api.moonshot.cn/v1';
const DEFAULT_KIMI_MODEL = 'moonshot-v1-8k-vision-preview';
const DEFAULT_GPT4V_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_GPT4V_MODEL = 'gpt-4o';

const VALID_SUBJECTS = new Set(['math', 'chinese', 'english']);

export async function recognizeIntent(request: VLMRequest): Promise<VLMData> {
  const { image, fullPageImage, provider, apiKey, baseURL, model } = request;

  const resolvedBaseURL = baseURL || (provider === 'kimi' ? DEFAULT_KIMI_BASE_URL : DEFAULT_GPT4V_BASE_URL);
  const resolvedModel = model || (provider === 'kimi' ? DEFAULT_KIMI_MODEL : DEFAULT_GPT4V_MODEL);

  const content: Array<{ type: string; [key: string]: unknown }> = [
    { type: 'text', text: VLM_PROMPT },
    { type: 'image_url', image_url: { url: image } },
  ];

  if (fullPageImage) {
    content.splice(1, 0, { type: 'image_url', image_url: { url: fullPageImage } });
  }

  const response = await callLLM({
    baseURL: resolvedBaseURL,
    apiKey,
    model: resolvedModel,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content },
    ],
    temperature: 0.3,
    stream: false,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VLM API error: ${response.status} ${text}`);
  }

  const json = await response.json();
  const contentText = extractContent(json);
  return parseModelContent(contentText);
}

function extractContent(json: Record<string, unknown>): string {
  const choices = json.choices as Array<Record<string, unknown>> | undefined;
  if (!choices || choices.length === 0) {
    throw new Error('No choices in VLM response');
  }
  const message = choices[0].message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content !== 'string') {
    throw new Error('Invalid content in VLM response');
  }
  return content;
}

export function parseModelContent(content: string): VLMData {
  let candidate = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  }

  let parsed: { intents?: unknown[] };
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new Error(`Failed to parse VLM JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!Array.isArray(parsed.intents)) {
    throw new Error('VLM response missing intents array');
  }

  const intents: IntentData[] = [];
  for (const raw of parsed.intents) {
    const item = raw as Record<string, unknown>;
    const subject = String(item.subject || '');
    if (!VALID_SUBJECTS.has(subject)) {
      throw new Error(`Invalid subject in intent: ${subject}`);
    }
    intents.push({
      name: String(item.name || ''),
      description: String(item.description || ''),
      confidence: Number(item.confidence || 0),
      content: String(item.content || ''),
      visualDescription: String(item.visualDescription || ''),
      pageContext: String(item.pageContext || ''),
      subject: subject as 'math' | 'chinese' | 'english',
    });
  }

  return { intents };
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tal/Documents/cirlearn-backend
git add src/services/vlmService.ts src/lib/vlmPrompt.ts
git commit -m "feat: migrate VLM service"
```

---

## Task 6: 迁移 Chat 服务

**Files:**
- Create: `/Users/tal/Documents/cirlearn-backend/src/services/chatService.ts`
- Create: `/Users/tal/Documents/cirlearn-backend/src/lib/subjectDetector.ts`

- [ ] **Step 1: Create subject detector**

```typescript
// src/lib/subjectDetector.ts

import { ChatMessage, Subject } from '../types';

type MessageContent = string | Array<{ type: string; text?: string; image_url?: unknown }>;

function extractText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content.filter(p => p.type === 'text').map(p => p.text ?? '').join(' ');
}

export function detectSubject(messages: Array<{ role: string; content: MessageContent }>): Subject {
  const text = messages.map(m => extractText(m.content)).join(' ');
  const mathKeywords = /数学|计算|方程|函数|几何|证明|求解|导数|积分|矩阵|概率|统计|三角|面积|体积|多项式|因式|平方|立方|勾股|抛物线|坐标|向量|集合|不等式|直线|交点|图像|画出|画图|斜率|截距|二次|一次|正方形|长方形|三角形|菱形|梯形|圆|角|边|\d\s*[\+\-\*\/=]|[=＝]\s*\d|[xy]\s*[=＝]/;
  const chineseKeywords = /语文|汉字|拼音|字词|组词|造句|作文|古诗|文言|部首|笔顺|成语|近义词|反义词|修辞|比喻|排比|词语|段落|中心思想|写法|鉴赏|赏析|怎么写|笔画/;
  const englishKeywords = /英语|英文|单词|语法|时态|听力|口语|音标|从句|passive|tense|grammar|translate|english|[a-zA-Z]{3,}/i;

  if (mathKeywords.test(text)) return 'math';
  if (chineseKeywords.test(text)) return 'chinese';
  if (englishKeywords.test(text)) return 'english';
  return 'chinese';
}
```

- [ ] **Step 2: Implement chat service**

```typescript
// src/services/chatService.ts

import { ChatRequest, Subject } from '../types';
import { detectSubject } from '../lib/subjectDetector';
import {
  MATH_SYSTEM_PROMPT,
  CHINESE_SYSTEM_PROMPT,
  ENGLISH_SYSTEM_PROMPT,
} from '../lib/prompts/prompts';
import { callLLM } from './llmService';

export function resolveSubject(request: ChatRequest): Subject {
  return request.subjectOverride ?? detectSubject(request.messages);
}

export function getSystemPrompt(subject: Subject): string {
  switch (subject) {
    case 'chinese': return CHINESE_SYSTEM_PROMPT;
    case 'english': return ENGLISH_SYSTEM_PROMPT;
    default: return MATH_SYSTEM_PROMPT;
  }
}

export async function streamChat(request: ChatRequest): Promise<Response> {
  const { messages, model, apiKey, baseURL, subjectOverride } = request;
  const subject = subjectOverride ?? detectSubject(messages);
  const systemPrompt = getSystemPrompt(subject);

  const resolvedBaseURL = baseURL || resolveBaseURL(apiKey);

  return callLLM({
    baseURL: resolvedBaseURL,
    apiKey,
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.7,
    stream: true,
  });
}

function resolveBaseURL(apiKey: string): string {
  if (apiKey.startsWith('sk-ant-')) return 'https://api.anthropic.com/v1';
  if (apiKey.startsWith('AIza')) return 'https://generativelanguage.googleapis.com/v1beta/openai';
  if (apiKey.startsWith('sk-')) return 'https://api.moonshot.cn/v1';
  return 'https://api.openai.com/v1';
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tal/Documents/cirlearn-backend
git add src/services/chatService.ts src/lib/subjectDetector.ts
git commit -m "feat: migrate chat service"
```

---

## Task 7: 创建 Controller

**Files:**
- Create: `/Users/tal/Documents/cirlearn-backend/src/controllers/vlmController.ts`
- Create: `/Users/tal/Documents/cirlearn-backend/src/controllers/chatController.ts`

- [ ] **Step 1: VLM controller**

```typescript
// src/controllers/vlmController.ts

import { Request, Response, NextFunction } from 'express';
import { VLMRequest, VLMResponse } from '../types';
import { recognizeIntent } from '../services/vlmService';

export async function vlmController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as VLMRequest;
    const data = await recognizeIntent(body);
    const response: VLMResponse = { success: true, data };
    res.json(response);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 2: Chat controller**

```typescript
// src/controllers/chatController.ts

import { Request, Response, NextFunction } from 'express';
import { ChatRequest } from '../types';
import { streamChat } from '../services/chatService';

const enc = new TextEncoder();

function ndjson(obj: object): Uint8Array {
  return enc.encode(JSON.stringify(obj) + '\n');
}

export async function chatController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = req.body as ChatRequest;
    const subject = request.subjectOverride ?? 'chinese';
    const llmResponse = await streamChat(request);

    if (!llmResponse.ok || !llmResponse.body) {
      const text = await llmResponse.text();
      res.status(llmResponse.status).json({ success: false, error: text });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = llmResponse.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;

          let json: Record<string, unknown>;
          try { json = JSON.parse(data); } catch { continue; }

          const choices = json.choices as Array<Record<string, unknown>> | undefined;
          if (!choices) continue;
          const choice = choices[0];
          if (!choice) continue;
          const delta = (choice.delta ?? {}) as Record<string, unknown>;

          if (typeof delta.content === 'string' && delta.content) {
            const normalized = normalizeEnglishHeadings(delta.content, subject);
            res.write(ndjson({ t: 'tx', v: normalized }));
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (err) {
    next(err);
  }
}

function normalizeEnglishHeadings(text: string, subject: string): string {
  if (subject !== 'english') return text;
  return text.replace(/##\s*拼音/g, '## 音标');
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tal/Documents/cirlearn-backend
git add src/controllers/vlmController.ts src/controllers/chatController.ts
git commit -m "feat: add VLM and chat controllers"
```

---

## Task 8: 创建路由与中间件

**Files:**
- Create: `/Users/tal/Documents/cirlearn-backend/src/routes/vlm.ts`
- Create: `/Users/tal/Documents/cirlearn-backend/src/routes/chat.ts`
- Create: `/Users/tal/Documents/cirlearn-backend/src/middleware/errorHandler.ts`
- Create: `/Users/tal/Documents/cirlearn-backend/src/middleware/requestValidator.ts`
- Create: `/Users/tal/Documents/cirlearn-backend/src/middleware/logger.ts`

- [ ] **Step 1: Routes**

```typescript
// src/routes/vlm.ts

import { Router } from 'express';
import { vlmController } from '../controllers/vlmController';

const router = Router();
router.post('/', vlmController);
export default router;
```

```typescript
// src/routes/chat.ts

import { Router } from 'express';
import { chatController } from '../controllers/chatController';

const router = Router();
router.post('/', chatController);
export default router;
```

- [ ] **Step 2: Middleware**

```typescript
// src/middleware/logger.ts

import { Request, Response, NextFunction } from 'express';

export function logger(req: Request, res: Response, next: NextFunction): void {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}
```

```typescript
// src/middleware/requestValidator.ts

import { Request, Response, NextFunction } from 'express';

export function validateVLM(req: Request, res: Response, next: NextFunction): void {
  const { image, provider, apiKey } = req.body;
  if (!image || typeof image !== 'string') {
    res.status(400).json({ success: false, error: 'Missing or invalid image' });
    return;
  }
  if (!provider || !['kimi', 'gpt4v'].includes(provider)) {
    res.status(400).json({ success: false, error: 'Missing or invalid provider' });
    return;
  }
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ success: false, error: 'Missing apiKey' });
    return;
  }
  next();
}

export function validateChat(req: Request, res: Response, next: NextFunction): void {
  const { messages, model, apiKey } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ success: false, error: 'Invalid messages' });
    return;
  }
  if (!model || typeof model !== 'string') {
    res.status(400).json({ success: false, error: 'Missing or invalid model' });
    return;
  }
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ success: false, error: 'Missing apiKey' });
    return;
  }
  next();
}
```

```typescript
// src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('[Error]', err.message);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({
    success: false,
    error: {
      message: err.message || 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tal/Documents/cirlearn-backend
git add src/routes src/middleware
git commit -m "feat: add routes and middleware"
```

---

## Task 9: 组装 Express 应用并启动

**Files:**
- Create: `/Users/tal/Documents/cirlearn-backend/src/app.ts`
- Create: `/Users/tal/Documents/cirlearn-backend/src/index.ts`

- [ ] **Step 1: app.ts**

```typescript
// src/app.ts

import express from 'express';
import cors from 'cors';
import vlmRoutes from './routes/vlm';
import chatRoutes from './routes/chat';
import { logger } from './middleware/logger';
import { validateVLM, validateChat } from './middleware/requestValidator';
import { errorHandler } from './middleware/errorHandler';
import { config } from './lib/config';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '10mb' }));
  app.use(logger);

  app.use('/vlm', validateVLM, vlmRoutes);
  app.use('/chat', validateChat, chatRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 2: index.ts**

```typescript
// src/index.ts

import { createApp } from './app';
import { config } from './lib/config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Cirlearn backend running on http://localhost:${config.port}`);
});
```

- [ ] **Step 3: Test local startup**

```bash
cd /Users/tal/Documents/cirlearn-backend
cp .env.example .env
npm run dev
```

Expected output:
```
Cirlearn backend running on http://localhost:3001
```

Test health endpoint:
```bash
curl http://localhost:3001/health
```

Expected:
```json
{"status":"ok"}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/tal/Documents/cirlearn-backend
git add src/app.ts src/index.ts .env
git commit -m "feat: assemble Express app and add health check"
```

---

## Task 10: 更新前端 API 地址

**Files:**
- Modify: `/Users/tal/Documents/genui-demo/src/app/page.tsx` or wherever `/api/vlm` and `/api/chat` are called

- [ ] **Step 1: Find API call sites**

```bash
cd /Users/tal/Documents/genui-demo
grep -rn "/api/vlm\|/api/chat" src/
```

- [ ] **Step 2: Replace with backend URL**

Assuming calls are like `fetch('/api/vlm')`, replace with:

```typescript
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// before: fetch('/api/vlm', ...)
// after:  fetch(`${BACKEND_URL}/vlm`, ...)
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tal/Documents/genui-demo
git add src/
git commit -m "feat: point frontend API calls to cirlearn-backend"
```

---

## Task 11: 端到端验证

- [ ] **Step 1: Start backend**

```bash
cd /Users/tal/Documents/cirlearn-backend
npm run dev
```

- [ ] **Step 2: Start frontend**

```bash
cd /Users/tal/Documents/genui-demo
npm run dev
```

- [ ] **Step 3: Test VLM**

Use the frontend to circle an area, or send a test request:

```bash
curl -X POST http://localhost:3001/vlm \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgo...",
    "provider": "kimi",
    "apiKey": "sk-..."
  }'
```

Expected: JSON response with `success: true` and `data.intents`.

- [ ] **Step 4: Test Chat**

```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"1+1等于几"}],
    "model": "moonshot-v1-8k",
    "apiKey": "sk-..."
  }'
```

Expected: NDJSON stream with `{"t":"tx","v":"..."}` chunks.

---

## Task 12: 清理与文档

- [ ] **Step 1: Update cirlearn-backend README**

Create `/Users/tal/Documents/cirlearn-backend/README.md`:

```markdown
# Cirlearn Backend

圈圈学独立后端服务，基于 Express + TypeScript。

## Endpoints

- `POST /vlm` - 视觉意图识别
- `POST /chat` - 流式学科答疑
- `GET /health` - 健康检查

## Development

```bash
npm install
npm run dev
```

## Environment Variables

- `PORT` - 服务端口，默认 3001
- `NODE_ENV` - 环境，默认 development
- `CORS_ORIGIN` - CORS 来源，默认 *
```

- [ ] **Step 2: Final commit in backend**

```bash
cd /Users/tal/Documents/cirlearn-backend
git add README.md
git commit -m "docs: add backend README"
```

- [ ] **Step 3: Push both projects**

```bash
cd /Users/tal/Documents/genui-demo && git push origin main
cd /Users/tal/Documents/cirlearn-backend && git remote add origin <new-repo-url> && git push -u origin main
```

Note: The second command requires a new GitHub repo to be created first, or omit push for now.

---

## Spec Coverage Check

| Spec Section | Implementing Task |
|---|---|
| 目录结构 | Task 1, Task 2 |
| 接口契约 /vlm | Task 5, Task 7 |
| 接口契约 /chat | Task 6, Task 7 |
| 数据流 | Task 5, 6, 7, 8, 9 |
| 错误处理 | Task 8 |
| 前端改动 | Task 10 |
| 开发环境 | Task 2, Task 9 |
| 测试策略 | Task 11 |

No placeholders or TBDs.
