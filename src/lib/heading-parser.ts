/**
 * Parse assistant response into structured segments.
 * Supports:
 * - ## heading → mapped to card components
 * - ```show-widget → extracted as widget segments
 * - Plain text → fallback text card
 */

/**
 * Normalize LaTeX delimiters so remark-math can process them.
 * Converts \[...\] → $$...$$ and \(...\) → $...$
 */
export function normalizeLatex(content: string): string {
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);
}

// Strip ** that wrap an entire paragraph/sentence (model mistakenly bolds whole blocks).
// Leaves inline **word** untouched.
export function stripBlockBold(content: string): string {
  // Match ** at start of line (optionally after whitespace) wrapping till ** at end
  return content.replace(/^\s*\*\*([\s\S]+?)\*\*\s*$/gm, (_, inner) => inner.trim());
}

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
  '分步解析': 'step_by_step',
  '分步计算': 'step_by_step',   // legacy alias
  '分步解答': 'step_by_step',   // legacy alias
  '列式计算': 'step_by_step',   // legacy alias
  '代入计算': 'step_by_step',   // legacy alias
  '分步推导': 'step_by_step',   // legacy alias
  '解题步骤': 'step_by_step',   // legacy alias
  '题目分析': 'problem_context',
  '题目解析': 'problem_context',   // legacy alias
  '题目信息': 'problem_context',   // legacy alias
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
  '知识点': 'knowledge_point',
  '典型示例': 'example',
  '关键数据': 'key_data',
  '数据分析': 'data_analysis',

  // ── Chinese ───────────────────────────────────────────
  '拼音': 'pinyin',
  '释义': 'word_meaning',
  '组词': 'word_group',
  '近反义词': 'synonyms',
  '例句': 'example_sentence',
  '作者简介': 'author_intro',
  '作者': 'author_intro',
  '原诗': 'original_text',
  '译文': 'translation',
  '原文译文': 'text_pair',      // legacy alias
  '赏析': 'appreciation',
  '原文索引': 'text_quote',
  '核心要点': 'highlights',
  '要点提炼': 'highlights',     // legacy alias
  '审题分析': 'writing_analysis',
  '结构框架': 'writing_structure',
  '素材推荐': 'writing_material',
  '仿写建议': 'writing_tip',
  '润色': 'polish',
  '补写': 'completion',
  '内容简介': 'book_intro',
  '文学影响': 'book_intro',
  '背景知识': 'background',
  '字词信息': 'word_info',      // legacy alias
  '典故': 'allusion',
  '典故解析': 'allusion',

  // ── English ───────────────────────────────────────────
  '音标': 'phonetic',
  '常见搭配': 'collocation',
  '翻译': 'translation',
  '重点词汇': 'key_vocab',
  '词汇解析': 'key_vocab',      // legacy alias
  '语法分析': 'grammar',
  '考点分析': 'exam_point',
  '语法规则': 'grammar',
  '选项解析': 'option_analysis',
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
    const raw = String(parsed.data ?? parsed.char ?? '');
    // Filter to CJK characters only, deduplicate while preserving order
    const chars = [...new Set([...raw].filter(c => /\p{Script=Han}/u.test(c)))];
    if (chars.length === 0) return null;

    // Unique prefix per widget instance to avoid id/function-name collisions
    const uid = Math.random().toString(36).slice(2, 7);

    const slots = chars.map((c, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <div id="${uid}-${i}" style="width:120px;height:120px"></div>
      <span style="font-size:14px;color:#374151;font-family:serif">${c}</span>
    </div>`).join('');

    const inits = chars.map((c, i) =>
      `HanziWriter.create(document.getElementById('${uid}-${i}'),'${c}',{width:120,height:120,padding:8,strokeColor:'#2563EB',radicalColor:'#1D4ED8',delayBetweenStrokes:300,strokeAnimationSpeed:1.2,showCharacter:false,showOutline:true}).loopCharacterAnimation();`
    ).join('\n      ');

    return `<div style="font-family:sans-serif;padding:12px 8px">
  <div id="${uid}-msg" style="font-size:12px;color:#9ca3af;text-align:center;margin-bottom:8px">加载笔顺动画中…</div>
  <div id="${uid}-box" style="display:flex;flex-wrap:wrap;gap:12px">${slots}
  </div>
  <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js" onload="init_${uid}()" ><\/script>
  <script>
    function init_${uid}(){
      var msg = document.getElementById('${uid}-msg');
      var box = document.getElementById('${uid}-box');
      if(msg) msg.style.display='none';
      if(box) box.style.justifyContent = ${chars.length} <= 4 ? 'center' : 'flex-start';
      ${inits}
    }
    if(typeof HanziWriter!=='undefined') init_${uid}();
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
    writing_analysis: '审题分析',
    writing_structure: '结构框架',
    writing_material: '素材推荐',
    writing_support: '写作辅助',
    text: '',
  };
  return labels[cardType] || '';
}
