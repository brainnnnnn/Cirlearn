import { ChatMessage, Subject } from '@/types';

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
