import { faker } from '@faker-js/faker/locale/zh_CN';
import {
  ChatMessage,
  Formula,
  AIResponse,
  AIRecognizedFormula,
  StreamChunk,
  ClassifiedError,
  ErrorType,
  RateLimitInfo
} from '../../types';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  avatar?: string;
  createdAt: Date;
}

interface Report {
  id: string;
  title: string;
  type: 'academic' | 'formula' | 'comparison';
  content: string;
  authorId: string;
  createdAt: Date;
  status: 'draft' | 'published' | 'archived';
}

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    username: faker.person.firstName(),
    email: faker.internet.email(),
    role: faker.helpers.arrayElement(['admin', 'user', 'viewer']),
    createdAt: faker.date.recent({ days: 30 }),
    ...overrides,
  };
}

export function createMockMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: faker.string.uuid(),
    role: faker.helpers.arrayElement(['user', 'assistant']),
    timestamp: faker.date.recent().getTime(),
    content: faker.lorem.sentence({ min: 5, max: 20 }),
    ...overrides,
  };
}

export function createMockMessages(count: number, overrides?: Partial<ChatMessage>): ChatMessage[] {
  return Array.from({ length: count }, () => createMockMessage(overrides));
}

export function createMockFormula(overrides: Partial<Formula> = {}): Formula {
  const ingredientNames = [
    '胶原蛋白肽', '透明质酸', '维生素C', '维生素E',
    '乳清蛋白肽', '海洋鱼肽', '大豆肽', '卵磷脂'
  ];
  
  const ingredientCount = faker.number.int({ min: 2, max: 6 });
  
  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      '胶原蛋白肽配方', '抗衰老复合配方', '免疫增强配方',
      '关节保健配方', '美容养颜配方'
    ]),
    category: faker.helpers.arrayElement(['功能性成分', '营养强化', '口感改良', '保鲜剂']),
    data: {
      ingredients: Array.from({ length: ingredientCount }, () => ({
        name: faker.helpers.arrayElement(ingredientNames),
        percentage: faker.number.float({ min: 1, max: 95, fractionDigits: 1 }),
        unit: '%',
      })),
      nutrition: {
        calories: faker.number.int({ min: 20, max: 200 }),
        protein: faker.number.int({ min: 10, max: 60 }),
        carbs: faker.number.int({ min: 1, max: 30 }),
        fat: faker.number.float({ min: 0.1, max: 10, fractionDigits: 1 }),
      },
      process: faker.helpers.arrayElements(
        ['酶解提取', '膜分离纯化', '喷雾干燥', '超临界萃取'],
        { min: 1, max: 3 }
      ),
    },
    ...overrides,
  };
}

export function createMockFormulas(count: number, overrides?: Partial<Formula>): Formula[] {
  return Array.from({ length: count }, () => createMockFormula(overrides));
}

export function createMockAIRecognizedFormula(overrides: Partial<AIRecognizedFormula> = {}): AIRecognizedFormula {
  return {
    name: faker.helpers.arrayElement([
      '胶原蛋白肽', '乳清蛋白肽', '海洋鱼肽', '透明质酸',
      '维生素C', '维生素E', '卵磷脂', '大豆肽'
    ]),
    value: faker.number.float({ min: 50, max: 99, fractionDigits: 1 }),
    unit: '%',
    confidence: faker.number.float({ min: 0.7, max: 0.99, fractionDigits: 2 }),
    ...overrides,
  };
}

export function createMockAIResponse(overrides: Partial<AIResponse> = {}): AIResponse {
  return {
    content: faker.lorem.paragraphs({ min: 2, max: 5 }),
    role: 'assistant',
    timestamp: faker.date.recent().getTime(),
    formulas: Array.from(
      { length: faker.number.int({ min: 0, max: 3 }) },
      () => createMockAIRecognizedFormula()
    ),
    model: faker.helpers.arrayElement(['gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus']),
    ...overrides,
  };
}

export function createMockStreamChunk(overrides: Partial<StreamChunk> = {}): StreamChunk {
  return {
    content: faker.lorem.word(),
    done: faker.datatype.boolean(),
    formula: undefined,
    ...overrides,
  };
}

export function createMockReport(overrides: Partial<Report> = {}): Report {
  return {
    id: faker.string.uuid(),
    title: `${faker.science.chemicalElement().name}配方研究报告`,
    type: faker.helpers.arrayElement(['academic', 'formula', 'comparison']),
    content: faker.lorem.paragraphs({ min: 10, max: 30 }),
    authorId: faker.string.uuid(),
    createdAt: faker.date.recent({ days: 7 }),
    status: faker.helpers.arrayElement(['draft', 'published', 'archived']),
    ...overrides,
  };
}

export function createMockReports(count: number, overrides?: Partial<Report>): Report[] {
  return Array.from({ length: count }, () => createMockReport(overrides));
}

export function createMockClassifiedError(type: ErrorType = ErrorType.Unknown): ClassifiedError {
  const errorMap: Record<ErrorType, Omit<ClassifiedError, 'type'>> = {
    [ErrorType.NetworkTimeout]: {
      originalError: new Error('网络连接超时'),
      userMessage: '网络连接超时，请检查网络后重试',
      suggestion: '请检查您的网络连接状态',
      canAutoRecover: true,
      retryAfter: 1000,
    },
    [ErrorType.Unauthorized]: {
      originalError: new Error('认证失败'),
      userMessage: '登录会话已过期',
      suggestion: '请重新登录以继续使用',
      canAutoRecover: false,
    },
    [ErrorType.RateLimited]: {
      originalError: new Error('请求过于频繁'),
      userMessage: '请求过于频繁，请等待 60 秒',
      suggestion: '请稍等片刻后再发送消息',
      canAutoRecover: false,
      countdown: 60,
    },
    [ErrorType.ServerError]: {
      originalError: new Error('服务器错误'),
      userMessage: '服务器暂时无法处理请求',
      suggestion: '我们正在努力修复，请稍后重试',
      canAutoRecover: true,
      retryAfter: 2000,
    },
    [ErrorType.StreamInterrupted]: {
      originalError: new Error('流式响应中断'),
      userMessage: 'AI 响应在传输过程中被中断',
      suggestion: '是否重新生成响应？',
      canAutoRecover: true,
      retryAfter: 500,
    },
    [ErrorType.Unknown]: {
      originalError: new Error('发生了未知错误'),
      userMessage: '发生了未知错误',
      suggestion: '请稍后重试或联系客服获取帮助',
      canAutoRecover: true,
      retryAfter: 2000,
    },
  };

  return { type, ...errorMap[type] };
}

export function createMockRateLimitInfo(overrides: Partial<RateLimitInfo> = {}): RateLimitInfo {
  return {
    remaining: faker.number.int({ min: 0, max: 100 }),
    resetAt: faker.date.future(),
    limit: faker.number.int({ min: 100, max: 1000 }),
    ...overrides,
  };
}

export function createLongConversation(messageCount: number = 20): ChatMessage[] {
  const topics = [
    '功能性食品配方的开发趋势',
    '活性肽在抗衰老中的应用',
    '植物蛋白提取技术的创新',
    '益生菌发酵工艺优化',
    '天然色素稳定性研究',
  ];

  const messages: ChatMessage[] = [];

  for (let i = 0; i < messageCount; i++) {
    const topicIndex = i % topics.length;

    messages.push(createMockMessage({
      role: 'user',
      content: `关于"${topics[topicIndex]}"，我想了解：${faker.helpers.arrayElement(['原理是什么', '有哪些应用', '如何制备', '市场前景如何'])}？`,
    }));

    messages.push(createMockMessage({
      role: 'assistant',
      content: faker.lorem.paragraphs({ min: 1, max: 3 }),
    }));
  }

  return messages;
}

export const factoryHelpers = {
  randomId: () => faker.string.uuid(),
  randomDate: () => faker.date.recent(),
  randomEmail: () => faker.internet.email(),
  randomUsername: () => faker.person.firstName(),
  randomNumber: (min: number, max: number) => faker.number.int({ min, max }),
  randomFloat: (min: number, max: number, fractionDigits = 2) =>
    faker.number.float({ min, max, fractionDigits }),
  randomElement: <T>(arr: T[]) => faker.helpers.arrayElement(arr),
  randomElements: <T>(arr: T[], count: number) => faker.helpers.arrayElements(arr, { min: 1, max: count }),
  randomSentence: (min = 5, max = 20) => faker.lorem.sentence({ min, max }),
  randomParagraph: (min = 2, max = 5) => faker.lorem.paragraphs({ min, max }),
};
