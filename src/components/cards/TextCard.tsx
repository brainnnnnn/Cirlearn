'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';
import { normalizeLatex, stripBlockBold } from '@/lib/heading-parser';

const LABEL_ICONS: Record<string, string> = {
  // Math
  '概念解释': '📘', '解题思路': '💡', '公式说明': '📐', '题目分析': '📋', '题目解析': '📋', '题目信息': '📋',
  '分步解析': '🔢', '分步计算': '🔢', '列式计算': '🔢', '代入计算': '🔢', '分步推导': '🔢',
  '解题提示': '👉', '正确答案': '✅', '答案': '✅', '错误分析': '❌',
  '错因分析': '❌', '方法归纳': '📝', '典型示例': '📐', '例题': '📐', '关键数据': '📊', '数据分析': '📈',
  // Chinese
  '拼音': '🔤', '释义': '📖', '组词': '✏️', '近反义词': '↔️',
  '例句': '💬', '声调对比': '🎵', '作者简介': '👤', '作者': '👤', '原诗': '📜',
  '译文': '🔄', '赏析': '🎨', '原文索引': '🔍', '核心要点': '⭐',
  '审题分析': '🎯', '结构框架': '🏗️', '素材推荐': '📌', '仿写建议': '✍️',
  '润色': '✨',
  '补写': '✍️',
  '知识点': '📚', '典故': '📜', '笔顺动画': '✍️',
  // English
  '音标': '🔊', '常见搭配': '🔗', '翻译': '🔄', '重点词汇': '📌',
  '语法分析': '🧩', '考点分析': '🎯', '语法规则': '📏', '选项分析': '🔎',
  '原文定位': '🔍', '解题分析': '🧠', '思路引导': '💡',
  '高级句型': '⬆️', '范文参考': '📄',
};

interface TextCardProps {
  content: string;
  label?: string;
}

export function TextCard({ content, label }: TextCardProps) {
  const icon = label ? LABEL_ICONS[label] : undefined;
  return (
    <CardContainer label={label} icon={icon}>
      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
        [&_p]:my-0.5 [&_p]:text-foreground/85
        [&_strong]:text-foreground [&_strong]:font-semibold
        [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:text-foreground/85
        [&_ol]:mt-1 [&_ol]:space-y-0.5">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{stripBlockBold(normalizeLatex(content))}</ReactMarkdown>
      </div>
    </CardContainer>
  );
}
