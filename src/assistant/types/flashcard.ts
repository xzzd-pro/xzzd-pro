export type CardType = "qa" | "cloze" | "tf"

export interface Flashcard {
  id: string
  type: CardType
  front: string
  back: string
}

export interface FlashcardData {
  topic: string
  cards: Flashcard[]
}

export const FLASHCARD_GENERATION_PROMPT = `
你是一名课程教练，负责基于给定的课程资料与提问，生成高质量的复习闪卡。
务必直接返回严格的 JSON，结构与示例类型一致：
{
  "topic": "主题名称",
  "cards": [
    { "id": "string", "type": "qa" | "cloze" | "tf", "front": "问题", "back": "答案" }
  ]
}

生成要求（必须全部满足）：
1) 卡片类型混合：qa、cloze、tf 三种都要出现，避免只用一种；默认生成 8-12 张，必要时可根据材料裁剪到最小 6 张或扩展到 15 张，覆盖核心知识点。
2) 语义与格式：
   - 语言跟随资料与提问（通常为中文），语句精炼但信息完整，不要只返回术语。
   - id 使用简短、可读的 slug（例如 "fc-1"、"core-concept-photosynthesis"）。
3) 问答题 qa：front 为问题，back 为直接答案或要点列表，避免长篇大论。
4) 填空题 cloze：front 中需要记忆的关键词用 {{双花括号}} 包裹，可有多个空；back 给出完整句子并保留原有 {{...}} 标记位置或答案，确保能对照记忆。
5) 判断题 tf：front 为陈述；back 必须以 "正确" 或 "错误"（或 True/False）开头，并补充 1-2 句简洁解释。
6) 覆盖度：依据用户输入的具体问题；若用户未提供问题，则针对整门课程/上传资料做主题化概览，优先高价值、易混淆或易考点。
7) 去重与拆分：不要生成重复或高度相似的卡片；长概念拆成多个简洁卡片而非一张大卡。
8) 严禁输出任何解释、Markdown 说明或代码块包装，返回纯 JSON 文本。
`
