# Cirlearn 后端独立服务改造设计

## 背景

当前 `genui-demo` 是一个 Next.js 16 + React 19 的前端项目，后端能力通过 Next.js API Route 实现：

- `POST /api/vlm`：视觉意图识别
- `POST /api/chat`：学科路由 + LLM 流式聊天

随着功能扩展，Next.js API Route 在工程化、独立部署、可测试性上存在瓶颈。因此将后端拆分为独立的 Express + TypeScript 服务。

## 目标

1. 把 `genui-demo` 的后端逻辑迁移到独立的 `cirlearn-backend` 项目。
2. 保持前端接口契约不变，前端只需改 base URL。
3. 建立清晰的分层架构：routes → controllers → services → lib。
4. 保留现有业务逻辑：VLM 意图识别、三科 Prompt、学科路由、流式输出。

## 非目标

- 不引入数据库（本次改造只关注服务拆分）。
- 不改前端框架或 UI 组件。
- 不做容器化/CI/CD（可后续补充）。

## 架构设计

### 目录结构

```
/Users/tal/Documents/cirlearn-backend/
├── src/
│   ├── routes/
│   │   ├── vlm.ts              # POST /vlm
│   │   └── chat.ts             # POST /chat
│   ├── controllers/
│   │   ├── vlmController.ts    # 处理 VLM 请求/响应
│   │   └── chatController.ts   # 处理 Chat 流式响应
│   ├── services/
│   │   ├── vlmService.ts       # 视觉意图识别逻辑
│   │   ├── chatService.ts      # 学科路由 + Prompt 选择
│   │   └── llmService.ts       # LLM/VLM client 封装
│   ├── lib/
│   │   ├── prompts.ts          # 数学/语文/英语三科 Prompts
│   │   ├── config.ts           # 环境变量与配置
│   │   └── utils.ts            # 工具函数
│   ├── middleware/
│   │   ├── errorHandler.ts     # 统一错误处理
│   │   ├── requestValidator.ts # 请求校验
│   │   └── logger.ts           # 日志中间件
│   ├── types/
│   │   └── index.ts            # 共享类型
│   ├── app.ts                  # Express 应用组装
│   └── index.ts                # 服务入口
├── tests/
│   └── *.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 数据流

```
前端 (genui-demo)
   │
   │ POST /vlm
   ▼
cirlearn-backend
   │
   ├── routes/vlm.ts ──► controllers/vlmController.ts
   │                         │
   │                         ▼
   │                   services/vlmService.ts
   │                         │
   │                         ▼
   │                   services/llmService.ts (调用 VLM 模型)
   │                         │
   │                         ▼
   │                   返回 JSON { success, data }
   │
   │ POST /chat
   ▼
   ├── routes/chat.ts ──► controllers/chatController.ts
                              │
                              ▼
                        services/chatService.ts
                              │
                              ├── detectSubject() 学科识别
                              ├── getSystemPrompt() 选择 Prompt
                              └── 调用 llmService.ts
                              │
                              ▼
                        返回 SSE/NDJSON 流
```

## 接口契约

保持与现有 Next.js API Route 一致，仅 base URL 变更。

### POST /vlm

**请求体：**

```json
{
  "image": "data:image/png;base64,...",
  "fullPageImage": "data:image/png;base64,...",
  "provider": "kimi",
  "apiKey": "sk-...",
  "baseURL": "https://api.moonshot.cn/v1",
  "model": "moonshot-v1-8k-vision-preview"
}
```

**响应体：**

```json
{
  "success": true,
  "data": {
    "intents": [
      {
        "name": "比较分数大小",
        "description": "...",
        "confidence": 0.95,
        "content": "...",
        "visualDescription": "",
        "pageContext": "...",
        "subject": "math"
      }
    ]
  }
}
```

### POST /chat

**请求体：**

```json
{
  "messages": [
    { "role": "user", "content": "..." }
  ],
  "model": "moonshot-v1-8k",
  "apiKey": "sk-...",
  "baseURL": "https://api.moonshot.cn/v1",
  "subjectOverride": "math"
}
```

**响应：** `Content-Type: text/event-stream`，保持现有 NDJSON 流式格式：

```ndjson
{"t":"tx","v":"第一步"}
{"t":"tx","v":"第二步"}
```

## 错误处理

统一错误中间件分类处理：

| 错误类型 | HTTP 状态码 | 示例 |
|---|---|---|
| 参数校验失败 | 400 | 缺少 apiKey、messages 为空 |
| 认证/密钥问题 | 401 | 模型 API key 无效 |
| 上游模型错误 | 502/504 | LLM/VLM 服务不可用或超时 |
| 内部错误 | 500 | 解析失败、未知异常 |

`/chat` 的错误在 SSE 流中以 `{"t":"error","v":"..."}` 发送，前端统一处理。

## 前端改动

`genui-demo` 中仅修改 API 调用地址：

| 原地址 | 新地址 |
|---|---|
| `/api/vlm` | `http://localhost:3001/vlm` |
| `/api/chat` | `http://localhost:3001/chat` |

生产环境通过 `NEXT_PUBLIC_BACKEND_URL` 配置后端域名。

建议删除 Next.js 的 `/api/vlm` 和 `/api/chat`，避免维护两套逻辑。

## 开发环境

```bash
# 后端
cd /Users/tal/Documents/cirlearn-backend
npm install
npm run dev        # 监听 3001

# 前端
cd /Users/tal/Documents/genui-demo
npm run dev        # 监听 3000
```

## 环境变量

```bash
PORT=3001
NODE_ENV=development
```

## 测试策略

- **单元测试**：`services/detectSubject`、`parseModelContent` 等纯函数。
- **集成测试**：启动后端服务，调用 `/vlm` 和 `/chat` 验证端到端流程。
- **手动测试**：前后端联调，验证流式输出和意图识别。

## 后续可扩展

- 增加 CORS 与 API Key 鉴权。
- 接入 Redis 缓存或限流。
- 增加请求日志与链路追踪。
- 容器化与 CI/CD。
