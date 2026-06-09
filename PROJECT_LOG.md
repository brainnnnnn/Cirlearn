# 圈圈学生成式UI Demo — 项目记录

> 记录时间：2026-06-02
> 基于 `genui-demo` 项目改造

---

## 一、想要达到的 Demo 效果

### 1.1 核心场景
用户在学习机上**圈选一道题目**（MVP阶段简化为在对话框输入题目文字），系统：

1. **识别意图**（MVP固定为数学解答意图）
2. **加载对应学科 Prompt**（数学/语文/英语）
3. **大模型生成结构化回复** —— 用 Markdown `## heading` 分隔不同的原子组件
4. **前端渲染为卡片堆叠** —— 每个 heading 对应一种卡片UI，不是传统聊天文本
5. **可选交互式教具** —— 需要时输出 `` ```show-widget `` 代码围栏，iframe 渲染

### 1.2 视觉目标
```
用户：求函数 f(x) = x² - 4x + 3 在 [0,5] 上的最值

┌──────────────────────────────────┐
│ 圈圈学              AI辅导        │  ← 助手消息卡片容器
├──────────────────────────────────┤
│ 📋 题目信息                       │
│ [已知] 函数f(x)=x²-4x+3...       │
│ [所求] 区间[0,5]上的最值          │
├──────────────────────────────────┤
│ 💡 解题思路                       │
│ │ 先配方找顶点，再比较端点        │
├──────────────────────────────────┤
│ 🔢 分步推导                       │
│ ① → 配方：f(x)=(x-2)²-1         │
│ ② → 顶点(2,-1)                  │
│ ...                               │
├──────────────────────────────────┤
│ ✓ 答案                           │
│ 最小值 -1，最大值 8              │
├──────────────────────────────────┤
│ [♡] [✎]        AI生成内容仅供参考│
└──────────────────────────────────┘
```

### 1.3 关键交互特征
- **单意图时不显示意图切换 Tab** —— 只有VLM返回多意图候选时才显示
- **流式过程显示原始 Markdown 文本** —— 完成后解析为卡片
- **无需 API 也能看演示** —— Mock 数据直接注入，展示卡片效果

---

## 二、项目架构

### 2.1 整体链路

```
用户输入题目文字
    ↓
ChatInterface（前端聊天界面）
    ↓
POST /api/chat → 加载数学学科 Prompt
    ↓
调用 Kimi/OpenAI-compatible API（流式 SSE）
    ↓
模型输出 Markdown（## heading + 可选 ```show-widget）
    ↓
前端 NDJSON 流式传输（{t:'tx', v:'...'}）
    ↓
流式中：显示原始 Markdown 文本
    ↓
完成后：heading-parser 解析为结构化卡片
    ↓
MessageItem 按卡片类型分发渲染
    ↓
ProblemContextCard / ThinkingCard / StepByStepCard / AnswerCard...
```

### 2.2 与原版 Demo 的关键差异

| | 原版 Demo | 圈圈学改造 |
|--|-----------|-----------|
| **触发方式** | Tool Use（`render_widget` function call）| Markdown 代码围栏 `` ```show-widget `` |
| **模型输出** | 文本 + JSON tool 参数 | 纯 Markdown heading 分隔 |
| **前端解析** | 解析 `tool_calls` delta | 解析 `## heading` 和代码围栏 |
| **内容结构** | 自由文本 + 偶发 widget | 20个原子组件按模板组装 |
| **渲染方式** | 文本 + iframe widget | 卡片堆叠 + iframe widget |
| **学科支持** | 通用单 Prompt | 数学/语文/英语 三科 Prompt |

### 2.3 核心文件结构

```
src/
├── app/
│   ├── api/chat/route.ts          ← 后端API：加载学科Prompt，纯文本SSE流式
│   └── page.tsx                   ← 入口：ChatInterface 聊天界面
├── components/
│   ├── ChatInterface.tsx          ← 聊天界面（用户输入、消息列表、设置弹窗）
│   ├── MessageItem.tsx            ← 消息渲染（用户气泡 / 助手卡片堆叠容器）
│   ├── WidgetRenderer.tsx         ← iframe widget 渲染（复用原版，未改）
│   └── cards/                     ← 原子组件卡片
│       ├── CardContainer.tsx      ← 通用容器（浅灰背景#F5F5F7）
│       ├── ProblemContextCard.tsx ← 题目信息（已知/所求双标签）
│       ├── ThinkingCard.tsx       ← 解题思路（左侧琥珀色竖线）
│       ├── StepByStepCard.tsx     ← 分步推导（序号圆圈+连接线）
│       ├── AnswerCard.tsx         ← 答案（白色背景+绿色加粗文字）
│       ├── FormulaCard.tsx        ← 公式说明
│       └── TextCard.tsx           ← 通用文本兜底
├── hooks/
│   └── useStreamingChat.ts        ← 流式聊天 Hook（NDJSON协议）
├── lib/
│   ├── heading-parser.ts          ← Markdown → 结构化卡片段解析器
│   ├── prompts/
│   │   └── math.ts                ← 数学学科Prompt（含20组件定义）
│   ├── widget-sanitizer.ts        ← iframe 安全 sanitization（复用原版）
│   └── widget-css-bridge.ts       ← CSS变量桥接（复用原版）
```

---

## 三、关键技术决策

### 3.1 为什么不用 Tool Use，改用 Markdown heading？

| 对比维度 | Tool Use | Markdown heading |
|---------|---------|-----------------|
| **流式体验** | 等 JSON 拼完才能渲染 widget | heading 一到就能渲染对应卡片 |
| **模型兼容性** | 强依赖 function calling | 纯文本，任何模型都支持 |
| **国产模型** | Kimi/DeepSeek 支持不稳定 | 100%兼容 |
| **调试可读性** | 一团转义 JSON | 直接看 Markdown 就懂 |
| **前端复杂度** | 前后端都要处理 tool 协议 | 后端简单，复杂度集中在前端 parser |

**结论**：圈圈学是 K12 短链路场景，流式体验优先，且需要对接多家国产模型，Markdown heading 更合适。

### 3.2 heading 解析的稳定性如何保证？

**Prompt 层严格约束**：
```markdown
必须用标准 ## heading 分隔组件：
## 题目信息 / ## 解题思路 / ## 分步推导 / ## 答案
严禁使用变体如"已知条件"、"解题步骤"
```

**前端层容错映射**：
```typescript
const HEADING_MAP: Record<string, string> = {
  '题目信息': 'problem_context',
  '已知条件': 'problem_context',  // 别名
  '解题思路': 'thinking',
  '思路分析': 'thinking',          // 别名
  // ...
};
```

### 3.3 widget 用什么方案？

**复用原版 Demo 的全套 iframe 基础设施**：
- `sandbox="allow-scripts"` iframe 隔离
- `postMessage` 通信：`widget:update`（流式预览）→ `widget:finalize`（最终渲染）
- ResizeObserver 高度自适应 + 模块级高度缓存
- MutationObserver 主题同步
- 120ms debounce
- 两阶段 sanitization（streaming 剥离脚本，finalize 保留执行）

**唯一改动**：触发方式从 tool call 改为代码围栏解析。

---

## 四、学科 Prompt 设计（数学示例）

```markdown
你是圈圈学的数学辅导老师...

## 可用原子组件（按场景选择1-5个）
| 组件 | heading | 用途 |
|------|---------|------|
| 题目信息 | ## 题目信息 | 已知条件 + 所求 |
| 解题思路 | ## 解题思路 | 点破关键思路 |
| 分步推导 | ## 分步推导 | 详细计算过程 |
| 公式说明 | ## 公式说明 | 公式/定理解释 |
| 答案 | ## 答案 | 最终结果 |

## 输出规则
1. heading 必须从表格选取，严禁变体
2. 常规解答题：题目信息 → 解题思路 → 分步推导 → 答案
3. 需要教具时输出 ```show-widget 代码围栏
4. 所有数学公式用 $...$ 包裹
```

---

## 五、现在遇到的问题

### 5.1 🔴 真实 API 调用报错 "Failed to fetch"

**现象**：
- Mock 演示（点击"查看卡片演示"按钮）**正常**
- 配置 API Key + Base URL + 模型后，输入框发送消息 → 前端显示红色 "Failed to fetch"
- Next.js 终端日志显示 `POST /api/chat 200 in 449ms`

**已排查**：
- ✅ API Key 已配置
- ✅ Base URL 已配置（`https://api.moonshot.cn/v1`）
- ✅ 模型已配置（`kimi-k2.5`）
- ✅ 后端自动检测：未填 Base URL 时自动补全 Kimi 默认地址
- ✅ 后端加了详细日志（URL、状态码、SSE解析过程）

**待确认**：
- 449ms 响应时间过短（正常流式响应应持续数秒），可能后端到 Kimi 的连接/解析有问题
- 需要查看终端日志定位：是请求没发出去、API 返回错误、还是 SSE 解析格式不对

**可能原因**：
1. Kimi API 返回了错误响应（模型不存在、Key 无效等），但错误信息未正确传递到前端
2. SSE 流解析问题（Kimi 的 SSE 格式与标准 OpenAI 有差异）
3. ReadableStream 在传输过程中异常关闭
4. 前端 fetch 读取流时出错

### 5.2 🟡 已修复的问题

| 问题 | 修复方式 |
|------|---------|
| 弹窗被卡片遮挡（z-index） | 弹窗容器加 `z-50`，弹窗内容加 `z-[100]` |
| 单意图也显示 Tab 切换 | `intents.length > 1` 时才渲染 Tab |
| 没填 API Key 点击 Send 报错 | 改为自动打开设置弹窗提示 |
| 没填 Base URL 无法调用 | 自动检测 `sk-` 开头 Key，补全 Kimi 默认地址 |

### 5.3 🟢 已实现但未完整测试的功能

- [x] 数学学科 Prompt
- [ ] 语文学科 Prompt（字词解析、原文译文、赏析等）
- [ ] 英语学科 Prompt（翻译、词汇、语法等）
- [ ] 更多卡片组件（概念解释、错误分析、诗词赏析等）
- [ ] `show-widget` 代码围栏的流式实时渲染（当前只在 finalize 后解析）
- [ ] VLM 意图识别接入（当前 MVP 固定数学意图）

---

## 六、如何运行

```bash
cd /Users/tal/Documents/genui-demo
npm run dev
```

访问 http://localhost:3000

**Mock 演示**：点击"🎬 查看卡片演示（无需API）"直接看卡片效果
**真实调用**：填入 Kimi API Key + Base URL（`https://api.moonshot.cn/v1`）+ 模型ID

---

## 七、下一步

1. **定位并修复 "Failed to fetch"** —— 查看终端日志确认根因
2. **补齐语文/英语 Prompt** —— 按数学 Prompt 格式扩展
3. **接入真实 VLM 意图识别** —— 不再固定数学意图
4. **优化流式 widget 渲染** —— 边生成边预览 iframe
