/**
 * Parse assistant response into structured segments.
 * Supports:
 * - ## heading → mapped to card components
 * - ```show-widget → extracted as widget segments
 * - Plain text → fallback text card
 */

export interface ParsedSegment {
  type: 'card' | 'widget' | 'text';
  cardType?: string;       // e.g. 'problem_context', 'thinking', etc.
  heading?: string;        // original heading text
  content: string;         // text content (without heading line)
  widgetTitle?: string;    // for widget segments
  widgetCode?: string;     // for widget segments
}

// Heading text → card component type mapping
// Supports exact match and common variants
const HEADING_MAP: Record<string, string> = {
  // ── Math ──────────────────────────────────────────────
  '分步计算': 'step_by_step',
  '分步解答': 'step_by_step',
  '列式计算': 'step_by_step',
  '代入计算': 'step_by_step',
  '分步推导': 'step_by_step',   // legacy alias
  '解题步骤': 'step_by_step',   // legacy alias
  '题目信息': 'problem_context',
  '已知条件': 'problem_context',
  '解题思路': 'thinking',
  '思路分析': 'thinking',
  '公式说明': 'formula',
  '公式定理': 'formula',
  '答案': 'answer',
  '正确答案': 'answer',
  '最终结果': 'answer',
  '解题提示': 'hint',
  '错误分析': 'error_analysis',
  '错因分析': 'error_analysis',
  '方法归纳': 'method_summary',
  '概念解释': 'concept',
  '典型示例': 'example',
  '关键数据': 'key_data',
  '数据分析': 'data_analysis',

  // ── Chinese ───────────────────────────────────────────
  '拼音': 'pinyin',
  '释义': 'word_meaning',
  '组词': 'word_group',
  '近反义词': 'synonyms',
  '例句': 'example_sentence',
  '声调对比': 'pronunciation',
  '作者简介': 'author_intro',
  '原诗': 'original_text',
  '译文': 'translation',
  '原文译文': 'text_pair',      // legacy alias
  '赏析': 'appreciation',
  '原文索引': 'text_quote',
  '核心要点': 'highlights',
  '要点提炼': 'highlights',     // legacy alias
  '仿写建议': 'writing_tip',
  '内容简介': 'book_intro',
  '文学影响': 'book_intro',
  '图片描述': 'image_desc',
  '图文关联': 'image_relation',
  '背景知识': 'background',
  '字词信息': 'word_info',      // legacy alias

  // ── English ───────────────────────────────────────────
  '音标': 'phonetic',
  '常见搭配': 'collocation',
  '翻译': 'translation',
  '重点词汇': 'key_vocab',
  '词汇解析': 'key_vocab',      // legacy alias
  '语法分析': 'grammar',
  '考点分析': 'exam_point',
  '语法规则': 'grammar',
  '选项分析': 'option_analysis',
  '原文定位': 'text_quote',
  '解题分析': 'analysis',
  '思路引导': 'thinking',
  '高级句型': 'advanced_pattern',
  '范文参考': 'model_text',
};

/**
 * Extract show-widget code fences from text.
 * Returns [textWithoutWidgets, widgets[]]
 */
function buildWidgetCode(parsed: Record<string, unknown>): string | null {
  if (parsed.widget_code) return String(parsed.widget_code);
  if (parsed.code) return String(parsed.code);

  // Built-in widget types the model can request by name
  if (parsed.type === 'stroke-order') {
    const char = String(parsed.data ?? parsed.char ?? '');
    if (!char) return null;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;font-family:sans-serif">
  <div id="stroke-msg" style="font-size:13px;color:#666">加载笔顺动画中…</div>
  <div id="stroke-container"></div>
  <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"><\/script>
  <script>
    (function() {
      var container = document.getElementById('stroke-container');
      var msg = document.getElementById('stroke-msg');
      if (typeof HanziWriter === 'undefined') {
        msg.textContent = '笔顺库加载失败，请检查网络';
        return;
      }
      msg.textContent = '';
      var writer = HanziWriter.create(container, '${char}', {
        width: 200, height: 200,
        padding: 10,
        strokeColor: '#2563EB',
        radicalColor: '#1D4ED8',
        delayBetweenStrokes: 300,
        strokeAnimationSpeed: 1.2,
        showCharacter: false,
        showOutline: true,
      });
      writer.loopCharacterAnimation();
    })();
  <\/script>
</div>`;
  }

  return null;
}

function extractWidgets(text: string): [string, Array<{ title: string; code: string }>] {
  const widgets: Array<{ title: string; code: string }> = [];
  const pattern = /```show-widget\s*\n([\s\S]*?)```/g;

  let match;
  const positions: Array<{ start: number; end: number; widget: { title: string; code: string } }> = [];

  while ((match = pattern.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;
      const code = buildWidgetCode(parsed);
      if (code) {
        positions.push({
          start: match.index,
          end: match.index + match[0].length,
          widget: { title: String(parsed.title ?? ''), code },
        });
      }
    } catch {
      // Invalid JSON in code fence, skip
    }
  }

  // Check for an unclosed show-widget fence (streaming, JSON not yet complete).
  // Preserve the text before the fence so it doesn't disappear during streaming.
  const unclosedMatch = /```show-widget\s*\n[\s\S]*$/.exec(text);
  const textBeforeUnclosed = unclosedMatch ? text.slice(0, unclosedMatch.index) : null;

  if (positions.length === 0) {
    return [textBeforeUnclosed !== null ? textBeforeUnclosed : text, []];
  }

  // Build text without widgets, and collect widgets
  let cleaned = '';
  let lastEnd = 0;

  for (const pos of positions) {
    cleaned += text.slice(lastEnd, pos.start);
    widgets.push(pos.widget);
    lastEnd = pos.end;
  }
  // After all closed widgets, preserve text up to any unclosed fence
  const tail = text.slice(lastEnd);
  const unclosedInTail = /```show-widget\s*\n[\s\S]*$/.exec(tail);
  cleaned += unclosedInTail ? tail.slice(0, unclosedInTail.index) : tail;

  return [cleaned.trim(), widgets];
}

/**
 * Parse heading line like "## 题目信息" or "## 题目信息 \n"
 */
function parseHeading(line: string): string | null {
  const match = line.match(/^##\s+(.+?)(?:\s*\n|$)/);
  return match ? match[1].trim() : null;
}

/**
 * Main parser: splits content by ## headings and extracts widgets.
 */
export function parseContent(content: string): ParsedSegment[] {
  if (!content.trim()) return [];
  
  const segments: ParsedSegment[] = [];
  
  // Split by ## headings, keeping the delimiter
  // Use positive lookahead to keep the ##
  const parts = content.split(/(?=^##\s+)/m).filter(p => p.trim());
  
  for (const part of parts) {
    const lines = part.split('\n');
    const firstLine = lines[0];
    const heading = parseHeading(firstLine);
    
    if (!heading) {
      // No heading - treat as plain text
      const [cleaned, widgets] = extractWidgets(part.trim());
      if (cleaned) {
        segments.push({ type: 'text', content: cleaned });
      }
      for (const w of widgets) {
        segments.push({ type: 'widget', content: '', widgetTitle: w.title, widgetCode: w.code });
      }
      continue;
    }
    
    // Has heading
    const body = lines.slice(1).join('\n').trim();
    const [cleanedBody, widgets] = extractWidgets(body);
    
    const cardType = HEADING_MAP[heading] || 'text';
    
    segments.push({
      type: 'card',
      cardType,
      heading,
      content: cleanedBody,
    });
    
    for (const w of widgets) {
      segments.push({
        type: 'widget',
        content: '',
        widgetTitle: w.title,
        widgetCode: w.code,
      });
    }
  }
  
  return segments;
}

/**
 * Get a user-friendly label for a card type.
 */
export function getCardLabel(cardType: string): string {
  const labels: Record<string, string> = {
    problem_context: '题目信息',
    thinking: '解题思路',
    step_by_step: '分步推导',
    formula: '公式说明',
    answer: '答案',
    error_analysis: '错误分析',
    concept: '概念解释',
    principle: '原理说明',
    example: '示例',
    word_info: '字词信息',
    text_pair: '原文译文',
    appreciation: '赏析',
    background: '背景知识',
    highlights: '要点提炼',
    analysis: '题目分析',
    grammar: '语法分析',
    pronunciation: '发音指导',
    writing_support: '写作辅助',
    text: '',
  };
  return labels[cardType] || '';
}
