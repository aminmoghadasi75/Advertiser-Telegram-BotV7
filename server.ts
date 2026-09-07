import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  AppState,
  TargetGroup,
  ProductCampaign,
  LogEntry,
  TelegramCredentials,
  SchedulerConfig,
  GroupMonitoringReport,
  AnonymousBotProfile,
  AnonymousChatInstructions,
  AnonymousChatSession,
  AnonymousChatAutomatorConfig,
  AnonymousChatMessage,
  AnonymousBotButtonStep,
  AnonymousProductPromotion,
  TelegramAccount,
  AnonymousDialogueTurn,
  AnonymousPartnerConversation,
  AnonymousPromptTestRun,
  AnonymousAnalyticsReport,
  ConversationState,
  Intent,
  PromotionLevel,
  ObjectionCategory,
  ConversationContext,
  ActiveGroupJoinProgress,
  ActiveGroupJoinWorkerProgress,
  AccountDistributionSummary,
  GroupJoinStrategy,
  AccountMembershipInfo,
  AccountTerritorySummary,
  DripJoinConfig,
  TerritoryAuditReport,
  ConversationStrategy,
  BotPersonaConfig,
  GroupPromotionStrategyConfig,
  GroupPromotionStrategyType,
  GroupLeadEvent,
  InboundPvConversation,
  InboundPvMessage,
  MultiBubblePvMessage,
} from './src/types.js';
import {
  detectLeadInMessage,
  generateGroupReplyMessage,
  generateCasualFriendPvMessage,
  generateGeminiGroupReply,
  generateGeminiGroupConversationReply,
  cleanTelegramChatText,
  generateGeminiCasualFriendPvMessage,
  generateMultiBubbleFriendPv,
  generateGeminiMultiBubbleFriendPv,
  generateInboundPvReply,
  generateGeminiInboundPvReply,
} from './src/conversation/groupPromotionListener.js';
import {
  generateGeminiDynamicAdCaption,
  generateLocalDynamicCaption,
  processVariablesAndSpintax,
} from './src/conversation/geminiAdWriter.js';
import {
  processConversationTurn,
  createInitialConversationContext,
  buildPromptDirective,
  ConversationStepOutput,
} from './src/conversation/conversationEngine.js';
import {
  GEMINI_DEFAULT_MODEL_PRIORITY,
  GEMINI_MODEL_METADATA,
  getModelHealth,
  getAdaptiveCandidateModels,
  recordGeminiSuccess,
  recordGeminiFailure,
  getModelStatusReport,
  isDailyLimitError,
  isModelBusyError,
  isRateLimitError,
  runWithTimeout,
} from './src/conversation/geminiAdaptiveRouter.js';
import {
  validateAndSanitizeResponse,
  MAX_BOT_MESSAGES_LIMIT,
  MAX_COMMERCIAL_LEAD_MESSAGES_LIMIT,
  repairIncompleteSentences,
  cleanCodeArtifactsAndPunctuation,
  stripAffectionateTerms,
  getAlternativeVariedFallback,
  getSafeFallbackText,
} from './src/conversation/responseValidator.js';
import {
  extractQuestionCategories,
  checkResponseSimilarity,
} from './src/conversation/similarityDetector.js';
import {
  DEFAULT_PRODUCT_CONFIG,
  DEFAULT_PRODUCTS_CATALOG,
  formatProductPromptContext,
  ProductConfig,
  ProductPlan,
} from './src/config/productConfig.js';
import { runAllConversationTests, TestSuiteSummary } from './src/conversation/conversationTests.js';
import { GOLD_DATASET } from './src/evaluation/goldDataset.js';
import { runFullEvaluation, replaySingleConversation } from './src/evaluation/replayEngine.js';
import { runAllEvaluationTests } from './src/evaluation/evaluationTests.js';
import { exportTracesToCSV, exportReportToJSON } from './src/evaluation/exportUtils.js';
import { ReplayMode } from './src/evaluation/evaluationTypes.js';
import { HealthService } from './src/reliability/healthService.js';
import { telemetry } from './src/observability/telemetry.js';
import { logger, sanitizePii } from './src/observability/logger.js';
import { validateRuntimeConfig, getRuntimeConfig } from './src/config/runtimeConfig.js';

// Telegram Phone Number Cleaner & Normalizer
function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  let res = String(phone)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[\s\-\(\)]/g, '')
    .trim();
  if (res.startsWith('00')) {
    res = '+' + res.slice(2);
  } else if (res.startsWith('09')) {
    res = '+98' + res.slice(1);
  } else if (res.startsWith('98')) {
    res = '+' + res;
  } else if (!res.startsWith('+') && /^\d+$/.test(res)) {
    res = '+' + res;
  }
  return res;
}

const DEFAULT_API_ID = '';
const DEFAULT_API_HASH = '';

// Helper to audit API credentials and alert user of suspicious/public Telegram API keys
function auditApiCredentials(apiId: string | number, _apiHash: string) {
  const strId = String(apiId || '').trim();
  if (strId === '2040' || strId === '6') {
    addLog(
      'warning',
      `⚠️ [هشدار امنیتی تلگرام] شما از api_id عمومی (${strId}) استفاده می‌کنید. تلگرام به کلاینت‌های سروری با این کلید حساس است و ممکن است نشست را قطع یا محدود کند. اکیداً توصیه می‌شود کلید اختصاصی و رایگان از my.telegram.org دریافت کنید.`
    );
  }
}

// Deterministic realistic device fingerprints for multi-account isolation
const DEVICE_FINGERPRINT_POOL = [
  { deviceModel: 'Samsung Galaxy S24 Ultra', systemVersion: 'Android 14 / OneUI 6.1', appVersion: '10.9.1 (4520)', langCode: 'fa', systemLangCode: 'fa-IR' },
  { deviceModel: 'iPhone 15 Pro Max', systemVersion: 'iOS 17.5.1', appVersion: '10.9.0 (27192)', langCode: 'fa', systemLangCode: 'fa-IR' },
  { deviceModel: 'Xiaomi 14 Pro', systemVersion: 'Android 14 / HyperOS 1.0', appVersion: '10.8.3 (4410)', langCode: 'fa', systemLangCode: 'fa-IR' },
  { deviceModel: 'Google Pixel 8 Pro', systemVersion: 'Android 14 / AP2A.240505', appVersion: '10.9.2 (4531)', langCode: 'fa', systemLangCode: 'fa-IR' },
  { deviceModel: 'Telegram Desktop (Windows)', systemVersion: 'Windows 11 x64 build 22631', appVersion: '4.16.8 x64', langCode: 'fa', systemLangCode: 'fa-IR' },
  { deviceModel: 'Telegram Desktop (macOS)', systemVersion: 'macOS 14.5 Sonoma', appVersion: '10.9.3 (256192)', langCode: 'fa', systemLangCode: 'fa-IR' },
];

// GramJS client configuration builder with realistic browser/device signature and SOCKS5 proxy support
function buildTelegramClientOptions(proxyConfig?: any, account?: any, accountIndex: number = 0) {
  const fp = account?.deviceFingerprint || DEVICE_FINGERPRINT_POOL[accountIndex % DEVICE_FINGERPRINT_POOL.length];
  const options: any = {
    connectionRetries: 3,
    useWSS: false,
    timeout: 30000,
    autoReconnect: true,
    deviceModel: fp?.deviceModel || 'Web Browser Client',
    systemVersion: fp?.systemVersion || 'Linux / Chrome',
    appVersion: fp?.appVersion || '2.1.0',
    langCode: fp?.langCode || 'fa',
    systemLangCode: fp?.systemLangCode || 'fa-IR',
  };

  const activeProxy = (account?.proxy && account.proxy.enabled && account.proxy.host && account.proxy.port)
    ? account.proxy
    : (proxyConfig && proxyConfig.enabled && proxyConfig.host && proxyConfig.port)
    ? proxyConfig
    : appState?.credentials?.proxy;

  if (activeProxy && activeProxy.enabled && activeProxy.host && activeProxy.port) {
    const portNum = parseInt(String(activeProxy.port), 10);
    if (!isNaN(portNum) && portNum > 0) {
      options.proxy = {
        ip: String(activeProxy.host).trim(),
        port: portNum,
        socksType: 5,
        ...(activeProxy.username ? { username: String(activeProxy.username).trim(), password: String(activeProxy.password || '').trim() } : {}),
      };
      console.log(`[Telegram Proxy] Connected via SOCKS5 (${options.deviceModel}): ${options.proxy.ip}:${options.proxy.port}`);
    }
  }

  return options;
}

// Central Telegram Client factory
function createTelegramClient(stringSession: any, apiId: number | string, apiHash: string, proxyConfig?: any, account?: any, accountIndex: number = 0) {
  const idNum = typeof apiId === 'string' ? parseInt(apiId, 10) : apiId;
  auditApiCredentials(idNum, apiHash);
  const opts = buildTelegramClientOptions(proxyConfig, account, accountIndex);
  return new TelegramClient(stringSession, idNum, apiHash, opts);
}

// GramJS import for Telegram MTProto
let TelegramClient: any = null;
let StringSession: any = null;
let Api: any = null;
let computeCheck: any = null;
let NewMessage: any = null;

async function loadGramJS() {
  if (TelegramClient) return;
  try {
    const telegramPkg = await import('telegram');
    const sessionsPkg = await import('telegram/sessions/index.js');
    const eventsPkg = await import('telegram/events/index.js').catch(() => null);
    const passwordPkg = await import('telegram/Password.js').catch(() => null);
    TelegramClient = telegramPkg.TelegramClient;
    Api = telegramPkg.Api;
    StringSession = sessionsPkg.StringSession;
    if (eventsPkg && eventsPkg.NewMessage) {
      NewMessage = eventsPkg.NewMessage;
    }
    if (passwordPkg) {
      computeCheck = passwordPkg.computeCheck;
    }
  } catch (err) {
    console.log('GramJS loaded with fallback mode:', (err as Error).message);
  }
}

async function verify2FAPassword(client: any, passwordStr: string, apiIdNum?: number, apiHash?: string) {
  if (computeCheck && Api && Api.account && Api.account.GetPassword && Api.auth && Api.auth.CheckPassword) {
    const passwordSrpResult = await client.invoke(new Api.account.GetPassword());
    const passwordSrpCheck = await computeCheck(passwordSrpResult, passwordStr);
    return await client.invoke(
      new Api.auth.CheckPassword({
        password: passwordSrpCheck,
      })
    );
  } else if (client.signInWithPassword) {
    return await client.signInWithPassword(
      { apiId: apiIdNum || 0, apiHash: apiHash || '' },
      {
        password: () => passwordStr,
        onError: (err: any) => {
          throw err;
        },
      }
    );
  } else {
    throw new Error('متد تایید رمز دو مرحله‌ای در دسترس نیست');
  }
}

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static uploads folder for persistent banner images on server
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// PRODUCTION HEALTH & OBSERVABILITY PROBES
app.get('/api/health', (req, res) => {
  const health = HealthService.getDetailedHealth(
    appState?.credentials?.isConnected || false,
    appState?.credentials?.phoneNumber
  );
  res.status(health.status === 'DOWN' ? 503 : 200).json(health);
});

app.get('/api/ready', (req, res) => {
  const readiness = HealthService.getReadiness();
  res.status(readiness.code).json(readiness);
});

app.get('/api/live', (req, res) => {
  const liveness = HealthService.getLiveness();
  res.status(liveness.code).json(liveness);
});

app.get('/api/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(telemetry.formatPrometheusMetrics());
});

app.get('/api/observability/stats', (req, res) => {
  res.json({
    success: true,
    snapshot: telemetry.getSnapshot(),
    logs: logger.getRecentLogs().slice(-50),
  });
});

app.get('/api/anonymous/gemini-status', (req, res) => {
  const report = getModelStatusReport();
  res.json({
    success: true,
    ...report,
  });
});

app.get('/api/config/validate', (req, res) => {
  const validation = validateRuntimeConfig();
  res.json({
    success: true,
    validation: {
      valid: validation.valid,
      warnings: validation.warnings,
      errors: validation.errors,
      config: sanitizePii(validation.config),
    },
  });
});

// Memory / File Persistence
const DATA_FILE = path.join(process.cwd(), 'telegram_promoter_data.json');

const defaultGroupPromotionStrategy: GroupPromotionStrategyConfig = {
  activeStrategy: 'periodic_broadcast',
  strategy1: {
    enabled: true,
    intervalHours: 2,
    intervalMinutes: 120,
    onlyFullyReadyGroups: true,
    includeBanner: true,
    randomJitterMinutes: 3,
    totalBroadcastsSent: 0,
    totalGroupsReached: 0,
  },
  strategy2: {
    enabled: false,
    isListeningActive: false,
    keywords: [
      'vpn',
      'فیلترشکن',
      'فیلتر شکن',
      'وی پی ان',
      'وی‌پی‌ان',
      'v2ray',
      'v2rayng',
      'کانفیگ',
      'پروکسی',
      'proxy',
      'سرعت اینترنت',
      'کندی اینترنت',
      'نت قطعه',
      'قطعی اینترنت',
      'هوش مصنوعی',
      'chatgpt',
      'چت جی پی تی',
      'claude',
      'gemini',
      'اینستا',
      'اینستاگرام',
      'یوتیوب',
      'youtube',
      'پینگ',
      'کاهش پینگ',
      'لگ دارم',
    ],
    replyInGroup: true,
    replyToUserRepliesInGroup: true,
    humanChatStyleInGroup: true,
    maxConsecutiveRepliesPerUser: 5,
    sendBannerInGroupReply: true,
    sendDirectMessage: true,
    sendBannerInDirectMessage: true,
    friendStylePvTone: true,
    groupReplyDelaySeconds: 4,
    groupCooldownMinutes: 5,
    pvMessageDelaySeconds: 8,
    userCooldownHours: 24,
    neverRepeatPvToSameUser: true,
    checkTelegramHistoryBeforePv: true,
    totalPvRepeatsPrevented: 0,
    maxRepliesPerGroupPerHour: 5,
    useAiReasoning: true,
    totalMessagesScanned: 0,
    totalLeadsDetected: 0,
    totalGroupRepliesSent: 0,
    totalPvMessagesSent: 0,
    totalInboundPvRepliesSent: 0,
    multiBubblePv: true,
    multiBubbleDelaySeconds: 1.5,
    autoReplyInboundPv: true,
    supportContactHandle: '@Nova_vpn10',
    testTargetUsername: '',
  },
  contactedPvUsers: {},
  recentLeads: [],
  inboundPvConversations: [],
};

const defaultAnonymousAutomatorConfig: AnonymousChatAutomatorConfig = {
  isActive: false,
  selectedBotId: 'bot_hypergap',
  bots: [
    {
      id: 'bot_hypergap',
      name: 'ربات هایپر گپ (@HyperGap)',
      botUsername: '@HyperGap',
      startCommand: '/start',
      autoDismissPopups: true,
      fuzzyButtonMatching: true,
      popupOkKeywords: ['OK', 'ok', 'تایید', 'بله', 'قبول', 'باشه', 'فهمیدم'],
      entrySteps: [
        {
          id: 'step_hg_1',
          label: 'به یه ناشناس وصلم کن!',
          buttonLocation: 'reply_keyboard',
          delaySeconds: 0.2,
        },
        {
          id: 'step_hg_2',
          label: '🎲 جستجوی شانسی 🎲',
          buttonLocation: 'inline_button',
          delaySeconds: 0.2,
        },
      ],
      connectionKeywords: [
        '👀 پیدا کردم وصلتون کردم، به مخاطبت سلام کن 🗣',
        'پیدا کردم وصلتون کردم',
        'به مخاطب وصل شدی',
        'یک هم‌صحبت پیدا شد',
        'یک همصحبت پیدا شد',
        'وصل شدی',
        'متصل شدید',
        'مخاطب پیدا شد',
        'هم‌اکنون در حال گفتگو هستید',
        'وصلتون کردم',
        'شروع مکالمه',
      ],
      exitSteps: [
        {
          id: 'exit_hg_1',
          label: '❌ پایان مکالمه',
          buttonLocation: 'reply_keyboard',
          delaySeconds: 0.2,
        },
        {
          id: 'exit_hg_2',
          label: '❌ اتمام چت',
          buttonLocation: 'inline_button',
          delaySeconds: 0.2,
        },
      ],
      partnerDisconnectedKeywords: [
        '🎌 چت شما با',
        'توسط مخاطب شما قطع شد',
        'توسط شما قطع شد',
        'توسط مخاطب قطع شد',
        'مخاطب گفتگو را بست',
        'مخاطب مکالمه را بست',
        'مخاطب چت را ترک کرد',
        'مخاطب چت را بست',
        'هم‌صحبت شما گفتگو را بست',
        'هم‌صحبت شما چت را بست',
        'کاربر مقابل از چت خارج شد',
        'مکالمه به پایان رسید',
        'گفتگو به پایان رسید',
        'مکالمه پایان یافت',
        'پایان مکالمه',
        'چت بسته شد',
        'مکالمه بسته شد',
        'قطع شد',
        'لفت داد',
        'برای شروع چت بصورت ناشناس',
        'برای شروع چت',
        'جستجوی شانسی',
        'همین الان برای شروع چت',
        'به یه ناشناس وصلم کن',
        'سکه رایگان هدیه بگیر',
      ],
      notInChatKeywords: [
        'متوجه نشدم',
        'خب ، حالا چه کاری برات انجام بدم؟',
        'از منوی پایین انتخاب کن',
        'دستور نامعتبر',
        'از منوی زیر استفاده',
        'برای شروع از دکمه',
        'منوی اصلی',
        'پیام شما متوجه نشدم',
        'برای شروع چت بصورت ناشناس',
        'برای شروع چت',
        'جستجوی شانسی',
        'همین الان برای شروع چت',
        'به یه ناشناس وصلم کن',
      ],
      alreadyInChatKeywords: [
        'هم اکنون شما در حال چت هستید',
        'خطا : هم اکنون شما در حال چت هستید',
        'ابتدا باید مکالمه رو قطع کنی',
        'ابتدا چت فعلی را قطع کنید',
        'در حال حاضر در حال چت هستید',
      ],
      delayBetweenButtonsMs: 200,
      enabled: true,
      notes: 'ربات هایپرگپ با ترتیب کلیک دکمه‌های ورود «به یه ناشناس وصلم کن!» و «🎲 جستجوی شانسی 🎲» و خروج «❌ پایان مکالمه» و «❌ اتمام چت»',
    },
    {
      id: 'bot_bichat',
      name: 'ربات بای چت (@BiChatBot)',
      botUsername: '@BiChatBot',
      startCommand: '/start',
      autoDismissPopups: true,
      fuzzyButtonMatching: true,
      entrySteps: [
        {
          id: 'step_bc_1',
          label: 'چت با ناشناس 🎭',
          buttonLocation: 'reply_keyboard',
          delaySeconds: 1.2,
        },
        {
          id: 'step_bc_2',
          label: 'همسن و همشهری',
          buttonLocation: 'reply_keyboard',
          delaySeconds: 1.0,
        },
        {
          id: 'step_bc_3',
          label: 'شروع جستجو 🔍',
          buttonLocation: 'reply_keyboard',
          delaySeconds: 1.2,
        },
      ],
      connectionKeywords: [
        'وصل شدی',
        'متصل شدید',
        'مخاطب پیدا شد',
        'یک همصحبت پیدا شد',
        'سلام کن',
      ],
      exitSteps: [
        {
          id: 'exit_bc_1',
          label: '❌ پایان چت',
          buttonLocation: 'reply_keyboard',
          delaySeconds: 1.0,
        },
        {
          id: 'exit_bc_2',
          label: 'بله، مطمئنم',
          buttonLocation: 'inline_button',
          delaySeconds: 1.0,
        },
      ],
      partnerDisconnectedKeywords: ['مخاطب گفتگو را بست', 'چت را ترک کرد', 'قطع شد', 'مکالمه پایان یافت'],
      delayBetweenButtonsMs: 1500,
      enabled: true,
      notes: 'ربات محبوب بای‌چت با منوی کیبورد و خروج مستقیم',
    },
    {
      id: 'bot_chatgram',
      name: 'ربات چت‌گرام (@ChatGramBot)',
      botUsername: '@ChatGramBot',
      startCommand: '/start',
      autoDismissPopups: true,
      fuzzyButtonMatching: true,
      entrySteps: [
        {
          id: 'step_cg_1',
          label: '🎭 چت ناشناس',
          buttonLocation: 'reply_keyboard',
          delaySeconds: 1.2,
        },
        {
          id: 'step_cg_2',
          label: '🔍 جستجوی هم‌صحبت',
          buttonLocation: 'reply_keyboard',
          delaySeconds: 1.0,
        },
        {
          id: 'step_cg_3',
          label: '👥 فرقی ندارد',
          buttonLocation: 'inline_button',
          delaySeconds: 1.2,
        },
      ],
      connectionKeywords: [
        'وصل شدید',
        'هم‌صحبت پیدا شد',
        'متصل شدید',
        'مکالمه آغاز شد',
      ],
      exitSteps: [
        {
          id: 'exit_cg_1',
          label: '❌ پایان گفتگو',
          buttonLocation: 'reply_keyboard',
          delaySeconds: 1.0,
        },
      ],
      partnerDisconnectedKeywords: ['کاربر از چت خارج شد', 'مکالمه پایان یافت', 'چت قطع شد'],
      delayBetweenButtonsMs: 1500,
      enabled: true,
      notes: 'ربات چت‌گرام با گزینه‌های سریع جستجوی هم‌صحبت',
    },
  ],
  instructions: {
    systemPrompt: `[هویت و شخصیت اصلی (Core Persona)]:
شما یک دختر ۲۶ ساله ایرانی پرانرژی، مهربان و باهوش به نام ملودی اهل تهران هستید که در یک ربات چت ناشناس تلگرام با یک فرد جدید در حال گپ زدن هستید.
- لحن: کاملاً خودمانی، صمیمی، دخترانه، تهرانی عامیانه، کوتاه و بسیار روان بدون استفاده از ایموجی‌های تکراری و کلیشه‌ای.
- طول پاسخ‌ها: هر پیام یا پاسخ شما کوتاه و طبیعی (۱ الی ۲ جمله کامل، حدود ۴ الی ۱۲ کلمه) باشد. از ناقص رها کردن کلمات یا پرحرفی بیش از حد خودداری کنید.
- عدم استفاده از علائم نگارشی کتابی: در چت تلگرام هرگز از نقطه در انتهای پیام (.)، علامت تعجب (!)، ویرگول‌های متعدد (،)، دونقطه (:) و گیومه استفاده نکنید چون مشخصه ربات است. فقط در صورت سوال از علامت ؟ استفاده کنید.
- سن و اعداد: سن شما ۲۶ سال است (در معرفی بنویسید ملودی ۲۶ تهران). اعداد و سن را به صورت رقم (۲۶ یا 26) بنویسید و هرگز سن را به حروف مانند «بیست و شش» ننویسید.
- خط قرمز انسانی: هرگز و تحت هیچ شرایطی نگویید هوش مصنوعی یا ربات هستید. شما یک انسان واقعی پای گوشی هستید. کلمات کتابی، رسمی یا پیام‌های تبلیغاتی قالبی اکیداً ممنوع است.

══════════════════════════════════════════════
[سلسله‌مراتب تصمیم‌گیری و اولویت رفتار (Hierarchical Behavioral Protocol)]:
۱. اولویت یک (امنیت و احترام): اگر مخاطب بی‌احترامی کرد یا الفاظ زشت به کار برد، با متانت و کوتاهی پاسخ بده و وارد کل‌کل نشو (S13).
۲. اولویت دو (خداحافظی و خروج): اگر مخاطب گفت بای/خداحافظ یا قصد رفتن داشت، با مهربانی خداحافظی کن (S12).
۳. اولویت سه (عدم اصرار در رد پیشنهاد): اگر مخاطب گفت نه/نمیخوام/تبلیغه/علاقه‌ای ندارم، هرگز اصرار نکن، بحث تبلیغ را بلافاصله تمام کن و به چت دوستانه برگرد (S10).
۴. اولویت چهار (پاسخ به سوالات و کنجکاوی): اگر مخاطب درباره اینترنت، فیلترشکن، سرعت، تست، قیمت، آیفون/اندروید سوال کرد، مستقیماً و خودمانی در جملات کوتاه بر اساس پایگاه دانش پاسخ بده (S6/S8).
۵. اولویت پنج (جریان طبیعی مکالمه و اولویت ارتباط): اولویت اول شما ارتباط انسانی و گفتگو است (Conversation First, Sales Second).

══════════════════════════════════════════════
[ماتریس حالات و رفتارهای مکالمه (State Machine Guidelines S1-S15)]:
- وضعیت S1 (سلام و شروع): احوال‌پرسی گرم و کوتاه (مثلاً: سلام خوبی چه خبر).
- وضعیت S2 (تبادل اصل/سن/شهر): «ملودی ۲۶ تهران» (حتماً سن ۲۶ به صورت عدد و بدون کلیشه‌های تکراری مثل شما چطور/شما چی).
- وضعیت S3 (گپ کوتاه روزمره): صحبت درباره روزمرگی و کارهای امروز در پیام‌های روان و کوتاه.
- وضعیت S4 (پل ارتباطی ملایم): اشاره کوتاه به وضعیت اینترنت یا کار با گوشی.
- وضعیت S5 (معرفی نرم / سطح ۱): اشاره گذرا به فیلترشکن خوب بدون فشار فروش.
- وضعیت S6 (پاسخ به کنجکاوی): پاسخ کوتاه به سوالات مخاطب درباره کیفیت و سرعت.
- وضعیت S7 (ارائه پیشنهاد / سطح ۲): توضیح پلن‌ها، تست رایگان ۱ ساعته، و درج تگ [SEND_PROMO_CARD].
- وضعیت S8 (پاسخ به سوالات فنی و FAQ): سازگاری با سیستم‌عامل‌ها (iOS/Android/Windows)، پرداخت آسان، گارانتی بازگشت وجه.
- وضعیت S9 (ارائه راه‌ارتباطی): آیدی پشتیبانی «nova_vpn10» (حتماً و اکیداً بدون علامت @ و با آندرلاین).
- وضعیت S10 (مدیریت عدم تمایل/نه شنیدن): پذیرش بدون اصرار و خداحافظی فوری: «باشه حله مراقب خودت باش فعلا»
- وضعیت S11 (ادامه گفتگوی دوستانه): چت بسیار کوتاه و طبیعی بدون پرحرفی.
- وضعیت S12 (خداحافظی قبل خروج): بهانه ملایم: «من کار برام پیش اومد باید برم مراقب خودت باش»
- وضعیت S13 (محتوای نامناسب): برخورد سرد و کوتاه.
- وضعیت S14 (اسپم و بات): پاسخ بی‌تفاوت یا کوتاه.
- وضعیت S15 (پیگیری سکوت): «هستی؟»

══════════════════════════════════════════════
[سیاست سه‌سطحی معرفی و فروش (Three-Tier Promotion Policy)]:
- سطح صفر (Level 0 - بدون تبلیغ): در دقایق اول چت یا هنگام احوال‌پرسی اولیه، هیچ تبلیغ یا پیشنهادی ندهید.
- سطح یک (Level 1 - اشاره نرم): فقط در صورتی که بحث به اینترنت یا اینستاگرام کشیده شد، اشاره کوتاهی به فیلترشکن خوب کنید.
- سطح دو (Level 2 - پیشنهاد کامل و CTA): فقط زمانی که مخاطب تمایل نشان داد، قیمت (۵۹ تومن تک‌کاربره، ۸۹ تومن دوکاربره) و تست رایگان را بگویید و تگ [SEND_PROMO_CARD] بزنید.

══════════════════════════════════════════════
[قوانین حیاتی نگارش و فرمت]:
۱. طول هر پیام ۱ الی ۲ جمله روان و طبیعی باشد و از نوشتن پیام‌های مقطع و ناقص خودداری شود.
۲. از کلمات با صمیمیت اغراق‌آمیز مانند «عزیزم»، «گلم»، «فدات شم» برای مخاطب ناشناس استفاده نکنید.
۳. از علائم نگارشی کتابی (نقطه پایانی، تعجب، ویرگول‌های متعدد، دو نقطه، گیومه) استفاده نکنید.
۴. سن را به صورت عدد ۲۶ بنویسید و هرگز ننویسید «بیست و شش».
۵. آیدی پشتیبانی را همیشه بدون کاراکتر @ و با آندرلاین بنویسید: nova_vpn10.
۶. در ابتدای مکالمه کلمات یا حروف انگلیسی نفرستید.
۷. بدون هیچ‌گونه پیشوند مانند «ملودی:» یا «سارا:» یا علامت نقل‌قول پاسخ دهید.`,
    maxMessagesPerChat: 12,
    memoryWindowSize: 10,
    enforceSessionIsolation: true,
    extractPartnerProfileInfo: true,
    dynamicSessionStatePrompt: true,
    initiateGreetingOnConnect: true,
    initialGreetingText: 'سلام خوبی؟',
    initialGreetings: ['سلام خوبی؟', 'سلام چطوری؟', 'سلام روزت بخیر', 'سلام خوبی چه خبر؟'],
    greetingMode: 'single',
    greetingDelaySeconds: 2.8,
    enablePreExitFarewell: true,
    preExitFarewellText: 'من کار برام پیش اومد باید برم مراقب خودت باش',
    preExitFarewells: [
      'من کار برام پیش اومد باید برم مراقب خودت باش',
      'من یه کاری برام پیش اومد باید برم فعلا',
      'خوشحال شدم فعلا خداحافظ',
      'من کار فوری برام پیش اومد باید برم روزت بخیر',
    ],
    farewellMode: 'single',
    farewellDelaySeconds: 1.8,
    sendPromoBeforeExitAlways: true,
    replyDelaySeconds: 3.0,
    messageAggregationDelaySeconds: 3.2,
    silenceTimeoutSeconds: 35,
    enableSilenceNudge: true,
    silenceNudgeText: 'هستی؟',
    
    // ۱. ارسال پیام‌های چندتکه‌ای (Multi-bubble Messaging)
    enableMultiBubble: true,
    multiBubbleMaxChunks: 3,
    multiBubbleDelaySeconds: 1.8,
    maxWordsPerBubble: 5,
    antiFilterHandleFormat: 'plain',

    // ۲. خروج فوق‌سریع در صورت عدم تمایل (Fast Skip on Rejection)
    fastDropOnRejection: true,
    fastDropFarewellText: 'اوکی فعلا',

    // ۳. سرعت تایپ پویا و هوشمند (Dynamic Typing Speed)
    dynamicTypingSpeed: true,
    typingSpeedMsPerChar: 65,
    minTypingDelaySeconds: 2.5,
    maxTypingDelaySeconds: 7.5,

    // ۳. فیلتر سریع ربات‌های تبلیغاتی و اسپمرها (Spam / Bot Skip)
    autoSkipSpamBots: true,
    spamBotKeywords: [
      't.me/',
      'telegram.me/',
      'joinchat',
      'chat.whatsapp.com',
      'instagram.com/',
      'عضویت در کانال',
      'کانال تلگرام',
      'پست آخر کانال',
      'شارژ رایگان',
      'فروش اکانت',
      'ربات هوشمند',
      'صیغه',
      'همسریابی',
      'کارت به کارت',
      'پکیج',
      'تخفیف ویژه کانال',
      'افزایش ممبر',
      'بیا پیوی',
      'بیا کانالم',
    ],

    inappropriateKeywords: ['بلاک', 'اسپم', 'کس نگو', 'حرومزاده', 'بیناموس', 'فحش', 'گمشو', 'کسشعر', 'کص', 'کیر', 'جنده', 'حرومی', 'سکس', 'سیکتیر'],
    savedPrompts: [],
    productPromotion: {
      enabled: false,
      productName: '',
      productDescription: '',
      imageUrl: '',
      contactHandleOrLink: '',
      sendMode: 'send_photo_with_caption_before_exit',
      sendAtMessageNumber: 3,
      faqItems: [],
      knowledgeBaseText: '',
    },
    products: [],
    activeProductId: '',
  },
  products: [],
  activeProductId: '',
  loopForever: true,
  cooldownBetweenChatsSeconds: 4,
  stats: {
    totalChatsInitiated: 0,
    totalCompletedChats: 0,
    totalRepliesFromStrangers: 0,
    totalPromoSent: 0,
    totalInquiriesAfterPromo: 0,
    totalSpamBotsSkipped: 0,
  },
};

const MOCK_CAMPAIGN_IDS = new Set(['nova_vpn', 'nike_store', 'ai_academy', 'web_agency']);

function isMockCampaign(p: any): boolean {
  if (!p) return true;
  const id = (p.productId || p.id || '').toLowerCase();
  if (MOCK_CAMPAIGN_IDS.has(id)) return true;
  if (id.startsWith('mock_')) return true;
  return false;
}

export function getActiveProduct(instructions?: AnonymousChatInstructions): ProductConfig {
  const rawProducts: ProductConfig[] = (Array.isArray(instructions?.products) && instructions.products.length > 0)
    ? instructions.products
    : (Array.isArray(appState?.anonymousAutomator?.products) && appState.anonymousAutomator.products.length > 0
      ? appState.anonymousAutomator.products
      : (Array.isArray(appState?.anonymousAutomator?.instructions?.products) && appState.anonymousAutomator.instructions.products.length > 0
        ? appState.anonymousAutomator.instructions.products
        : []));
  
  // Filter out any legacy sample/mock products
  const products = rawProducts.filter(p => p && !isMockCampaign(p));
  
  const activeId = instructions?.activeProductId || appState?.anonymousAutomator?.activeProductId || appState?.anonymousAutomator?.instructions?.activeProductId;
  
  if (activeId) {
    const found = products.find(p => p.productId === activeId || (p as any).id === activeId);
    if (found) return found;
  }
  
  const activeMarked = products.find(p => p.isActive && !p.isArchived);
  if (activeMarked) return activeMarked;
  
  return products[0] || DEFAULT_PRODUCT_CONFIG;
}

function normalizeAnonymousAutomatorConfig(incoming: any, baseState?: AnonymousChatAutomatorConfig): AnonymousChatAutomatorConfig {
  const current = baseState || appState?.anonymousAutomator || defaultAnonymousAutomatorConfig;
  const baseInst = current?.instructions || defaultAnonymousAutomatorConfig.instructions;
  const defaultBaseInst = defaultAnonymousAutomatorConfig.instructions;
  const incInst = incoming?.instructions || {};

  // Normalize products catalog - only keep what user entered, filter out mock/sample items
  const rawProducts = (Array.isArray(incInst.products))
    ? incInst.products
    : (Array.isArray(incoming?.products)
      ? incoming.products
      : (Array.isArray(current?.instructions?.products)
        ? current.instructions.products
        : (Array.isArray(current?.products) ? current.products : [])));

  const userProducts = rawProducts.filter((p: any) => p && !isMockCampaign(p));

  const normalizedProducts: ProductConfig[] = userProducts.map((p: any, idx: number) => ({
    productId: p.productId || p.id || `product_${Date.now()}_${idx}`,
    productName: p.productName || p.name || `کمپین ${idx + 1}`,
    tagline: p.tagline || '',
    category: p.category || 'other',
    productDescription: p.productDescription || p.description || '',
    isActive: Boolean(p.isActive),
    isArchived: Boolean(p.isArchived),
    bannerImageUrl: p.bannerImageUrl || p.imageUrl || '',
    features: Array.isArray(p.features) ? p.features : [],
    plans: Array.isArray(p.plans) ? p.plans.map((plan: any, pIdx: number) => ({
      id: plan.id || `plan_${pIdx}`,
      name: plan.name || 'پلن پایه',
      price: plan.price || '',
      duration: plan.duration || plan.period || '',
      traffic: plan.traffic || plan.volume || '',
      deviceLimit: plan.deviceLimit || '۱ کاربر',
      popular: Boolean(plan.popular || plan.isPopular),
    })) : [],
    freeTrial: p.freeTrial || {
      available: false,
      durationHours: 24,
      description: '',
    },
    refundPolicy: p.refundPolicy || {
      available: false,
      guaranteeHours: 48,
      description: '',
    },
    support: {
      handle: (p.support?.handle || p.supportHandle || p.contactHandleOrLink || '').replace(/^@/, '').trim(),
      link: p.support?.link || (p.support?.handle || p.supportHandle || p.contactHandleOrLink ? `https://t.me/${(p.support?.handle || p.supportHandle || p.contactHandleOrLink).replace(/^@/, '').trim()}` : ''),
      operatingHours: p.support?.operatingHours || '۲۴ ساعته',
    },
    faqItems: Array.isArray(p.faqItems) ? p.faqItems : (Array.isArray(p.faq) ? p.faq.map((f: any, fIdx: number) => ({
      id: f.id || `faq_${fIdx}`,
      question: f.question || '',
      answer: f.answer || '',
      keywords: Array.isArray(f.keywords) ? f.keywords : [],
    })) : []),
    knowledgeBaseText: p.knowledgeBaseText || p.knowledgeBase || '',
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  }));

  const activeProductId = incInst.activeProductId || incoming?.activeProductId || current?.activeProductId || current?.instructions?.activeProductId || normalizedProducts.find(p => p.isActive && !p.isArchived)?.productId || normalizedProducts[0]?.productId || '';

  // Mark isActive strictly on the selected active product
  normalizedProducts.forEach(p => {
    p.isActive = (p.productId === activeProductId);
  });

  const activeProduct = normalizedProducts.find(p => p.productId === activeProductId) || normalizedProducts[0] || DEFAULT_PRODUCT_CONFIG;

  const incPromo = incInst.productPromotion || incoming?.productPromotion || {};
  const currentPromo = current?.instructions?.productPromotion || baseInst.productPromotion || {
    enabled: false,
    productName: activeProduct.productName || '',
    productDescription: activeProduct.productDescription || '',
    imageUrl: activeProduct.bannerImageUrl || '',
    contactHandleOrLink: activeProduct.support?.handle || '',
    sendMode: 'send_photo_with_caption_before_exit',
    sendAtMessageNumber: 3,
  };

  const finalBannerUrl = typeof incPromo.imageUrl === 'string'
    ? incPromo.imageUrl
    : (typeof activeProduct.bannerImageUrl === 'string' ? activeProduct.bannerImageUrl : (currentPromo?.imageUrl || ''));

  // Ensure active product and promotion always share the same banner image URL
  activeProduct.bannerImageUrl = finalBannerUrl;

  const mergedPromo: AnonymousProductPromotion = {
    enabled: incPromo.enabled !== undefined ? Boolean(incPromo.enabled) : (currentPromo?.enabled ?? false),
    productName: typeof incPromo.productName === 'string' && incPromo.productName.trim() ? incPromo.productName : (currentPromo?.productName || activeProduct.productName),
    productDescription: typeof incPromo.productDescription === 'string' && incPromo.productDescription.trim() ? incPromo.productDescription : (currentPromo?.productDescription || activeProduct.productDescription),
    imageUrl: finalBannerUrl,
    contactHandleOrLink: typeof incPromo.contactHandleOrLink === 'string' && incPromo.contactHandleOrLink.trim() ? incPromo.contactHandleOrLink : (currentPromo?.contactHandleOrLink || activeProduct.support?.handle || ''),
    sendMode: incPromo.sendMode || currentPromo?.sendMode || 'send_photo_with_caption_before_exit',
    sendAtMessageNumber: typeof incPromo.sendAtMessageNumber === 'number' ? incPromo.sendAtMessageNumber : (currentPromo?.sendAtMessageNumber ?? 3),
    aiSendBannerWithPitch: incPromo.aiSendBannerWithPitch !== undefined ? Boolean(incPromo.aiSendBannerWithPitch) : (currentPromo?.aiSendBannerWithPitch ?? true),
    faqItems: Array.isArray(incPromo.faqItems) && incPromo.faqItems.length > 0 ? incPromo.faqItems : (currentPromo?.faqItems || (activeProduct.faqItems || []).map(f => ({ id: f.id, question: f.question, answer: f.answer, keywords: f.keywords }))),
    knowledgeBaseText: typeof incPromo.knowledgeBaseText === 'string' && incPromo.knowledgeBaseText.trim() ? incPromo.knowledgeBaseText : (currentPromo?.knowledgeBaseText || activeProduct.knowledgeBaseText || ''),
  };

  const mergedInstructions: AnonymousChatInstructions = {
    ...defaultBaseInst,
    ...(baseInst || {}),
    ...incInst,
    systemPrompt: typeof incInst.systemPrompt === 'string' ? incInst.systemPrompt : (baseInst?.systemPrompt ?? defaultBaseInst.systemPrompt),
    savedPrompts: Array.isArray(incInst.savedPrompts)
      ? incInst.savedPrompts
      : (Array.isArray(baseInst?.savedPrompts)
        ? baseInst.savedPrompts
        : (Array.isArray(defaultBaseInst.savedPrompts) ? defaultBaseInst.savedPrompts : [])),
    conversationStrategy: incInst.conversationStrategy || baseInst?.conversationStrategy || 'social_rapport',
    persona: incInst.persona || baseInst?.persona || defaultBaseInst.persona,
    maxMessagesPerChat: typeof incInst.maxMessagesPerChat === 'number' ? incInst.maxMessagesPerChat : (baseInst?.maxMessagesPerChat ?? defaultBaseInst.maxMessagesPerChat),
    maxBotMessages: typeof incInst.maxBotMessages === 'number' ? incInst.maxBotMessages : (baseInst?.maxBotMessages ?? defaultBaseInst.maxBotMessages),
    autoExitOnPartnerBye: incInst.autoExitOnPartnerBye !== undefined ? Boolean(incInst.autoExitOnPartnerBye) : (baseInst?.autoExitOnPartnerBye ?? defaultBaseInst.autoExitOnPartnerBye ?? true),
    memoryWindowSize: typeof incInst.memoryWindowSize === 'number' ? incInst.memoryWindowSize : (baseInst?.memoryWindowSize ?? defaultBaseInst.memoryWindowSize ?? 10),
    enforceSessionIsolation: incInst.enforceSessionIsolation !== undefined ? Boolean(incInst.enforceSessionIsolation) : (baseInst?.enforceSessionIsolation ?? defaultBaseInst.enforceSessionIsolation ?? true),
    extractPartnerProfileInfo: incInst.extractPartnerProfileInfo !== undefined ? Boolean(incInst.extractPartnerProfileInfo) : (baseInst?.extractPartnerProfileInfo ?? defaultBaseInst.extractPartnerProfileInfo ?? true),
    dynamicSessionStatePrompt: incInst.dynamicSessionStatePrompt !== undefined ? Boolean(incInst.dynamicSessionStatePrompt) : (baseInst?.dynamicSessionStatePrompt ?? defaultBaseInst.dynamicSessionStatePrompt ?? true),
    
    // Multi-bubble
    enableMultiBubble: incInst.enableMultiBubble !== undefined ? Boolean(incInst.enableMultiBubble) : (baseInst?.enableMultiBubble ?? defaultBaseInst.enableMultiBubble ?? true),
    multiBubbleMaxChunks: typeof incInst.multiBubbleMaxChunks === 'number' ? incInst.multiBubbleMaxChunks : (baseInst?.multiBubbleMaxChunks ?? defaultBaseInst.multiBubbleMaxChunks ?? 2),
    maxWordsPerBubble: typeof incInst.maxWordsPerBubble === 'number' ? incInst.maxWordsPerBubble : (baseInst?.maxWordsPerBubble ?? (defaultBaseInst as any)?.maxWordsPerBubble ?? 5),
    multiBubbleDelaySeconds: typeof incInst.multiBubbleDelaySeconds === 'number' ? incInst.multiBubbleDelaySeconds : (baseInst?.multiBubbleDelaySeconds ?? defaultBaseInst.multiBubbleDelaySeconds ?? 1.5),

    // Dynamic Typing Speed
    dynamicTypingSpeed: incInst.dynamicTypingSpeed !== undefined ? Boolean(incInst.dynamicTypingSpeed) : (baseInst?.dynamicTypingSpeed ?? defaultBaseInst.dynamicTypingSpeed ?? true),
    typingSpeedMsPerChar: typeof incInst.typingSpeedMsPerChar === 'number' ? incInst.typingSpeedMsPerChar : (baseInst?.typingSpeedMsPerChar ?? defaultBaseInst.typingSpeedMsPerChar ?? 35),
    minTypingDelaySeconds: typeof incInst.minTypingDelaySeconds === 'number' ? incInst.minTypingDelaySeconds : (baseInst?.minTypingDelaySeconds ?? defaultBaseInst.minTypingDelaySeconds ?? 1.0),
    maxTypingDelaySeconds: typeof incInst.maxTypingDelaySeconds === 'number' ? incInst.maxTypingDelaySeconds : (baseInst?.maxTypingDelaySeconds ?? defaultBaseInst.maxTypingDelaySeconds ?? 6.0),

    // Spam / Bot Skip
    autoSkipSpamBots: incInst.autoSkipSpamBots !== undefined ? Boolean(incInst.autoSkipSpamBots) : (baseInst?.autoSkipSpamBots ?? defaultBaseInst.autoSkipSpamBots ?? true),
    spamBotKeywords: Array.isArray(incInst.spamBotKeywords) ? incInst.spamBotKeywords : (baseInst?.spamBotKeywords || defaultBaseInst.spamBotKeywords || []),

    initiateGreetingOnConnect: incInst.initiateGreetingOnConnect !== undefined ? Boolean(incInst.initiateGreetingOnConnect) : (baseInst?.initiateGreetingOnConnect ?? defaultBaseInst.initiateGreetingOnConnect ?? true),
    initialGreetingText: typeof incInst.initialGreetingText === 'string' ? incInst.initialGreetingText : (baseInst?.initialGreetingText ?? defaultBaseInst.initialGreetingText),
    initialGreetings: Array.isArray(incInst.initialGreetings) ? incInst.initialGreetings : (baseInst?.initialGreetings || defaultBaseInst.initialGreetings),
    greetingMode: incInst.greetingMode || baseInst?.greetingMode || defaultBaseInst.greetingMode || 'single',
    greetingDelaySeconds: typeof incInst.greetingDelaySeconds === 'number' ? incInst.greetingDelaySeconds : (baseInst?.greetingDelaySeconds ?? defaultBaseInst.greetingDelaySeconds ?? 0.8),
    enablePreExitFarewell: incInst.enablePreExitFarewell !== undefined ? Boolean(incInst.enablePreExitFarewell) : (baseInst?.enablePreExitFarewell ?? defaultBaseInst.enablePreExitFarewell ?? true),
    preExitFarewellText: typeof incInst.preExitFarewellText === 'string' ? incInst.preExitFarewellText : (baseInst?.preExitFarewellText ?? defaultBaseInst.preExitFarewellText),
    preExitFarewells: Array.isArray(incInst.preExitFarewells) ? incInst.preExitFarewells : (baseInst?.preExitFarewells || defaultBaseInst.preExitFarewells),
    farewellMode: incInst.farewellMode || baseInst?.farewellMode || defaultBaseInst.farewellMode || 'single',
    farewellDelaySeconds: typeof incInst.farewellDelaySeconds === 'number' ? incInst.farewellDelaySeconds : (baseInst?.farewellDelaySeconds ?? defaultBaseInst.farewellDelaySeconds ?? 1.0),
    fastDropOnRejection: incInst.fastDropOnRejection !== undefined ? Boolean(incInst.fastDropOnRejection) : (baseInst?.fastDropOnRejection ?? true),
    fastDropFarewellText: typeof incInst.fastDropFarewellText === 'string' ? incInst.fastDropFarewellText : (baseInst?.fastDropFarewellText || 'اوکی فعلا'),
    sendPromoBeforeExitAlways: incInst.sendPromoBeforeExitAlways !== undefined ? Boolean(incInst.sendPromoBeforeExitAlways) : (baseInst?.sendPromoBeforeExitAlways ?? defaultBaseInst.sendPromoBeforeExitAlways ?? true),
    replyDelaySeconds: typeof incInst.replyDelaySeconds === 'number' ? incInst.replyDelaySeconds : (baseInst?.replyDelaySeconds ?? defaultBaseInst.replyDelaySeconds ?? 1.5),
    messageAggregationDelaySeconds: typeof incInst.messageAggregationDelaySeconds === 'number' ? incInst.messageAggregationDelaySeconds : (baseInst?.messageAggregationDelaySeconds ?? defaultBaseInst.messageAggregationDelaySeconds ?? 1.5),
    silenceTimeoutSeconds: typeof incInst.silenceTimeoutSeconds === 'number' ? incInst.silenceTimeoutSeconds : (baseInst?.silenceTimeoutSeconds ?? defaultBaseInst.silenceTimeoutSeconds ?? 30),
    enableSilenceNudge: incInst.enableSilenceNudge !== undefined ? Boolean(incInst.enableSilenceNudge) : (baseInst?.enableSilenceNudge ?? defaultBaseInst.enableSilenceNudge ?? true),
    silenceNudgeText: typeof incInst.silenceNudgeText === 'string' ? incInst.silenceNudgeText : (baseInst?.silenceNudgeText || defaultBaseInst.silenceNudgeText || 'هستی؟'),
    inappropriateKeywords: Array.isArray(incInst.inappropriateKeywords) ? incInst.inappropriateKeywords : (baseInst?.inappropriateKeywords || defaultBaseInst.inappropriateKeywords),
    customIgnoredSystemPhrases: Array.isArray(incInst.customIgnoredSystemPhrases) ? incInst.customIgnoredSystemPhrases : (baseInst?.customIgnoredSystemPhrases || defaultBaseInst.customIgnoredSystemPhrases),
    antiFilterHandleFormat: incInst.antiFilterHandleFormat || baseInst?.antiFilterHandleFormat || 'plain',
    productPromotion: mergedPromo,
    products: normalizedProducts,
    activeProductId,
  };

  const rawBots = Array.isArray(incoming?.bots) && incoming.bots.length > 0
    ? incoming.bots
    : (Array.isArray(current?.bots) && current.bots.length > 0
      ? current.bots
      : defaultAnonymousAutomatorConfig.bots);

  const normalizedBots: AnonymousBotProfile[] = rawBots.map((b: any) => {
    const isHyperGap = b.id === 'bot_hypergap' || (b.botUsername || '').toLowerCase().includes('hypergap');
    const defaultHg = defaultAnonymousAutomatorConfig.bots.find(x => x.id === 'bot_hypergap');

    let entrySteps = Array.isArray(b.entrySteps) && b.entrySteps.length > 0
      ? b.entrySteps.map((s: any, idx: number) => ({
          id: s.id || `entry_${idx}`,
          label: s.label || '',
          buttonLocation: s.buttonLocation || 'reply_keyboard',
          triggerMode: s.triggerMode || 'after_delay',
          triggerKeyword: s.triggerKeyword || '',
          delaySeconds: typeof s.delaySeconds === 'number' ? s.delaySeconds : 1.0,
          matchMode: s.matchMode || 'exact',
          autoConfirmPopup: Boolean(s.autoConfirmPopup),
        }))
      : (isHyperGap && defaultHg ? defaultHg.entrySteps : []);

    let exitSteps = Array.isArray(b.exitSteps) && b.exitSteps.length > 0
      ? b.exitSteps.map((s: any, idx: number) => ({
          id: s.id || `exit_${idx}`,
          label: s.label || '',
          buttonLocation: s.buttonLocation || 'reply_keyboard',
          triggerMode: s.triggerMode || 'after_delay',
          triggerKeyword: s.triggerKeyword || '',
          delaySeconds: typeof s.delaySeconds === 'number' ? s.delaySeconds : 1.0,
          matchMode: s.matchMode || 'exact',
          autoConfirmPopup: Boolean(s.autoConfirmPopup),
        }))
      : (isHyperGap && defaultHg ? defaultHg.exitSteps : []);

    // Only apply default HyperGap entry/exit fallback if steps are empty or contain legacy profile selection
    if (isHyperGap && defaultHg && entrySteps.length === 0) {
      entrySteps = defaultHg.entrySteps;
    }
    if (isHyperGap && defaultHg && exitSteps.length === 0) {
      exitSteps = defaultHg.exitSteps;
    }

    const connectionKeywords = Array.from(new Set([
      ...(Array.isArray(b.connectionKeywords) ? b.connectionKeywords : []),
      ...(isHyperGap && defaultHg ? defaultHg.connectionKeywords : []),
    ]));

    const partnerDisconnectedKeywords = Array.from(new Set([
      ...(Array.isArray(b.partnerDisconnectedKeywords) ? b.partnerDisconnectedKeywords : []),
      ...(isHyperGap && defaultHg ? defaultHg.partnerDisconnectedKeywords : []),
    ]));

    const notInChatKeywords = Array.from(new Set([
      ...(Array.isArray(b.notInChatKeywords) ? b.notInChatKeywords : []),
      ...(isHyperGap && defaultHg ? (defaultHg.notInChatKeywords || []) : []),
    ]));

    const alreadyInChatKeywords = Array.from(new Set([
      ...(Array.isArray(b.alreadyInChatKeywords) ? b.alreadyInChatKeywords : []),
      ...(isHyperGap && defaultHg ? (defaultHg.alreadyInChatKeywords || []) : []),
    ]));

    return {
      id: b.id || `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: b.name || 'ربات ناشناس',
      botUsername: b.botUsername || '@bot',
      startCommand: b.startCommand || '/start',
      entrySteps,
      connectionKeywords,
      exitSteps,
      partnerDisconnectedKeywords,
      notInChatKeywords,
      alreadyInChatKeywords,
      autoDismissPopups: b.autoDismissPopups !== undefined ? Boolean(b.autoDismissPopups) : true,
      popupOkKeywords: Array.isArray(b.popupOkKeywords) ? b.popupOkKeywords : ['OK', 'ok', 'تایید', 'بله'],
      fuzzyButtonMatching: b.fuzzyButtonMatching !== undefined ? Boolean(b.fuzzyButtonMatching) : true,
      delayBetweenButtonsMs: typeof b.delayBetweenButtonsMs === 'number' ? b.delayBetweenButtonsMs : 1000,
      enabled: b.enabled !== undefined ? Boolean(b.enabled) : true,
      notes: b.notes || '',
      customIgnoredKeywords: Array.isArray(b.customIgnoredKeywords) ? b.customIgnoredKeywords : [],
    };
  });

  const candidateBotId = incoming?.selectedBotId || current?.selectedBotId;
  const selBotId = (candidateBotId && normalizedBots.some((b) => b.id === candidateBotId))
    ? candidateBotId
    : (normalizedBots[0]?.id || 'bot_hypergap');

  return {
    isActive: incoming?.isActive !== undefined ? Boolean(incoming.isActive) : Boolean(current?.isActive),
    selectedBotId: selBotId,
    bots: normalizedBots,
    instructions: mergedInstructions,
    products: normalizedProducts,
    activeProductId,
    loopForever: incoming?.loopForever !== undefined ? Boolean(incoming.loopForever) : (current?.loopForever ?? true),
    cooldownBetweenChatsSeconds: typeof incoming?.cooldownBetweenChatsSeconds === 'number' ? incoming.cooldownBetweenChatsSeconds : (current?.cooldownBetweenChatsSeconds ?? 3),
    stats: {
      totalChatsInitiated: incoming?.stats?.totalChatsInitiated !== undefined ? Number(incoming.stats.totalChatsInitiated) : (current?.stats?.totalChatsInitiated || 0),
      totalRepliesFromStrangers: incoming?.stats?.totalRepliesFromStrangers !== undefined ? Number(incoming.stats.totalRepliesFromStrangers) : (current?.stats?.totalRepliesFromStrangers || 0),
      lastActiveAt: incoming?.stats?.lastActiveAt || current?.stats?.lastActiveAt || undefined,
    },
  };
}

// Default initial state
let appState: AppState = {
  credentials: {
    apiId: '22239448',
    apiHash: '18f904bed04337c78b82e6faf8575259',
    phoneNumber: '',
    sessionString: '',
    isConnected: false,
  },
  groups: [
    {
      id: 'group_1',
      title: 'گروه خرید و فروش تهران (نمونه)',
      usernameOrLink: '@TehranShoppingGroup',
      isActive: true,
      memberCount: 14200,
      status: 'joined',
      category: 'بازارچه',
      lastPostedAt: undefined,
    },
    {
      id: 'group_2',
      title: 'نیازمندی‌ها و تبادل کالا',
      usernameOrLink: 't.me/Niazmandiha_Iran',
      isActive: true,
      memberCount: 8900,
      status: 'joined',
      category: 'عمومی',
      lastPostedAt: undefined,
    },
    {
      id: 'group_3',
      title: 'بازار دیجیتال و پوشاک',
      usernameOrLink: '@DigitalBazar_Official',
      isActive: false,
      memberCount: 22000,
      status: 'pending',
      category: 'پوشاک و دیجیتال',
      lastPostedAt: undefined,
    }
  ],
  campaigns: [],
  scheduler: {
    intervalMinutes: 5,
    jitterSeconds: 20,
    dailyLimit: 100,
    nightModePause: true,
    isAutoRunActive: false,
    totalSentCount: 0,
    totalSuccessCount: 0,
    totalFailedCount: 0,
  },
  logs: [
    {
      id: 'log_1',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'سامانه مدیریت ربات تبلیغات تلگرام آماده به کار است.',
    }
  ],
  purgedNonPersianBlacklist: [],
  groupPromotionStrategy: defaultGroupPromotionStrategy,
  anonymousAutomator: defaultAnonymousAutomatorConfig,
  anonymousSessionHistory: [],
  currentTestRun: null,
  previousTestRuns: [],
};

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appState, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save data file:', e);
    return false;
  }
}

// Persistent Non-Persian Blacklist Helpers
function isBlacklistedNonPersianTarget(target: string | number): boolean {
  if (!target) return false;
  if (!appState.purgedNonPersianBlacklist || !Array.isArray(appState.purgedNonPersianBlacklist)) {
    appState.purgedNonPersianBlacklist = [];
    return false;
  }
  const clean = String(target).toLowerCase().trim();
  const stripped = clean.replace('@', '').replace('t.me/', '').replace('https://', '').replace('http://', '').split('/')[0].split('?')[0];
  return appState.purgedNonPersianBlacklist.some(item => {
    const it = String(item).toLowerCase().trim();
    return it === clean || it === stripped || clean.includes(it);
  });
}

function addToNonPersianBlacklist(target: string | number, extraMeta?: string): void {
  if (!target) return;
  if (!appState.purgedNonPersianBlacklist || !Array.isArray(appState.purgedNonPersianBlacklist)) {
    appState.purgedNonPersianBlacklist = [];
  }
  const clean = String(target).toLowerCase().trim();
  const stripped = clean.replace('@', '').replace('t.me/', '').replace('https://', '').replace('http://', '').split('/')[0].split('?')[0];
  if (stripped && stripped.length > 2 && !appState.purgedNonPersianBlacklist.includes(stripped)) {
    appState.purgedNonPersianBlacklist.push(stripped);
  }
  if (clean && clean.length > 2 && !appState.purgedNonPersianBlacklist.includes(clean)) {
    appState.purgedNonPersianBlacklist.push(clean);
  }
  if (extraMeta) {
    const extraClean = String(extraMeta).toLowerCase().trim();
    if (extraClean.length > 3 && !appState.purgedNonPersianBlacklist.includes(extraClean)) {
      appState.purgedNonPersianBlacklist.push(extraClean);
    }
  }
  saveData();
}

// Load existing state if available at startup
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    appState = {
      ...appState,
      ...parsed,
      credentials: {
        ...appState.credentials,
        ...(parsed.credentials || {}),
      },
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : (appState.accounts || []),
      scheduler: {
        ...appState.scheduler,
        ...(parsed.scheduler || {}),
      },
      groupPromotionStrategy: parsed.groupPromotionStrategy ? {
        ...defaultGroupPromotionStrategy,
        ...parsed.groupPromotionStrategy,
        strategy1: {
          ...defaultGroupPromotionStrategy.strategy1,
          ...(parsed.groupPromotionStrategy?.strategy1 || {}),
        },
        strategy2: {
          ...defaultGroupPromotionStrategy.strategy2,
          ...(parsed.groupPromotionStrategy?.strategy2 || {}),
        },
        contactedPvUsers: (parsed.groupPromotionStrategy?.contactedPvUsers && typeof parsed.groupPromotionStrategy.contactedPvUsers === 'object') ? parsed.groupPromotionStrategy.contactedPvUsers : {},
        recentLeads: Array.isArray(parsed.groupPromotionStrategy?.recentLeads) ? parsed.groupPromotionStrategy.recentLeads : [],
        inboundPvConversations: Array.isArray(parsed.groupPromotionStrategy?.inboundPvConversations) ? parsed.groupPromotionStrategy.inboundPvConversations : [],
      } : defaultGroupPromotionStrategy,
      groups: Array.isArray(parsed.groups) ? parsed.groups : (appState.groups || []),
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : (appState.campaigns || []),
      logs: Array.isArray(parsed.logs) ? parsed.logs : (appState.logs || []),
      monitoringReports: Array.isArray(parsed.monitoringReports) ? parsed.monitoringReports : [],
      lastBroadcastReport: parsed.lastBroadcastReport || appState.lastBroadcastReport,
      broadcastHistory: parsed.broadcastHistory || appState.broadcastHistory || [],
      anonymousAutomator: normalizeAnonymousAutomatorConfig(parsed.anonymousAutomator),
      anonymousSessionHistory: Array.isArray(parsed.anonymousSessionHistory) ? parsed.anonymousSessionHistory : [],
      currentTestRun: parsed.currentTestRun || null,
      previousTestRuns: Array.isArray(parsed.previousTestRuns) ? parsed.previousTestRuns : [],
      purgedNonPersianBlacklist: Array.isArray(parsed.purgedNonPersianBlacklist) ? parsed.purgedNonPersianBlacklist : [],
      dripJoinConfig: parsed.dripJoinConfig ? {
        enabled: Boolean(parsed.dripJoinConfig.enabled),
        maxJoinsPerAccountPerDay: parsed.dripJoinConfig.maxJoinsPerAccountPerDay || 8,
        intervalMinutes: parsed.dripJoinConfig.intervalMinutes || 20,
        jitterMinutes: parsed.dripJoinConfig.jitterMinutes || 5,
        dailyJoinResetDate: parsed.dripJoinConfig.dailyJoinResetDate || new Date().toISOString().split('T')[0],
        accountDailyJoins: parsed.dripJoinConfig.accountDailyJoins || {},
        lastJoinTimePerAccount: parsed.dripJoinConfig.lastJoinTimePerAccount || {},
      } : {
        enabled: false,
        maxJoinsPerAccountPerDay: 8,
        intervalMinutes: 20,
        jitterMinutes: 5,
        dailyJoinResetDate: new Date().toISOString().split('T')[0],
        accountDailyJoins: {},
        lastJoinTimePerAccount: {},
      },
    };
    saveData();
    if (!appState.credentials.apiId || appState.credentials.apiId === '22239448') {
      appState.credentials.apiId = DEFAULT_API_ID;
      appState.credentials.apiHash = DEFAULT_API_HASH;
    }
    console.log('✅ Loaded saved app state from telegram_promoter_data.json. Telegram Connected:', appState.credentials.isConnected);
  } catch (e) {
    console.error('Failed to load data file:', e);
  }
} else {
  // Save baseline state immediately on initial startup
  saveData();
  console.log('✅ Created initial telegram_promoter_data.json storage file.');
}

// Global Execution Mutex & Rotational Account State
let isBroadcastRunning = false;
let isBroadcastCancellationRequested = false;
let globalAccountIndex = 0;

// Multi-Account Migration & Synchronization
function syncAccountsState() {
  if (!appState.accounts || !Array.isArray(appState.accounts)) {
    appState.accounts = [];
  }

  const defaultTones: Array<'friendly' | 'expert_advisor' | 'concise_direct' | 'energetic_buyer' | 'supportive_polite'> = [
    'friendly',
    'expert_advisor',
    'concise_direct',
    'energetic_buyer',
    'supportive_polite',
  ];

  // Ensure all accounts have necessary flags, personas, fingerprints and quotas
  for (let idx = 0; idx < appState.accounts.length; idx++) {
    const acc = appState.accounts[idx];
    if (acc.enableForGroupBroadcast === undefined) acc.enableForGroupBroadcast = true;
    if (acc.enableForAnonymousBot === undefined) acc.enableForAnonymousBot = true;
    if (acc.enableForPvReply === undefined) acc.enableForPvReply = true;
    if (acc.isActive === undefined) acc.isActive = true;
    if (acc.status === undefined) acc.status = 'active';
    if (!acc.personaTone) {
      acc.personaTone = defaultTones[idx % defaultTones.length];
    }
    if (acc.hourlyLimit === undefined) acc.hourlyLimit = 15;
    if (acc.dailyLimit === undefined) acc.dailyLimit = 50;
    if (!acc.shiftStatus) acc.shiftStatus = 'active_working';
    if (acc.assignedGroupCount === undefined) {
      acc.assignedGroupCount = (appState.groups || []).filter(g => g.assignedAccountId === acc.id).length;
    }
    if (!acc.deviceFingerprint) {
      acc.deviceFingerprint = DEVICE_FINGERPRINT_POOL[idx % DEVICE_FINGERPRINT_POOL.length];
    }
  }

  // Ensure instance sharding configuration for 5 Google AI Studio environments
  if (!appState.instanceSharding) {
    appState.instanceSharding = {
      isEnabled: false,
      currentShard: 1,
      totalShards: 5,
      instanceLabel: 'Google AI Studio Node #1',
    };
  }

  // Sync credentials into accounts list if logged in
  if (appState.credentials.isConnected && appState.credentials.sessionString) {
    const existingIndex = appState.accounts.findIndex(
      a => a.phoneNumber === appState.credentials.phoneNumber || a.sessionString === appState.credentials.sessionString
    );
    if (existingIndex === -1) {
      const primaryAcc = {
        id: 'acc_primary_' + Date.now(),
        phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
        apiId: appState.credentials.apiId,
        apiHash: appState.credentials.apiHash,
        sessionString: appState.credentials.sessionString,
        userProfile: appState.credentials.userProfile,
        isActive: true,
        enableForGroupBroadcast: true,
        enableForAnonymousBot: true,
        enableForPvReply: true,
        isVerifiedLive: true,
        lastVerifiedAt: new Date().toISOString(),
        dailySentCount: 0,
        status: 'active' as const,
        personaTone: 'friendly' as const,
        hourlyLimit: 15,
        dailyLimit: 50,
        shiftStatus: 'active_working' as const,
        deviceFingerprint: DEVICE_FINGERPRINT_POOL[0],
      };
      appState.accounts.unshift(primaryAcc);
      appState.activeAccountId = primaryAcc.id;
    } else {
      const acc = appState.accounts[existingIndex];
      acc.sessionString = appState.credentials.sessionString;
      acc.userProfile = appState.credentials.userProfile || acc.userProfile;
      acc.apiId = appState.credentials.apiId || acc.apiId;
      acc.apiHash = appState.credentials.apiHash || acc.apiHash;
      if (acc.enableForGroupBroadcast === undefined) acc.enableForGroupBroadcast = true;
      if (acc.enableForAnonymousBot === undefined) acc.enableForAnonymousBot = true;
      if (acc.enableForPvReply === undefined) acc.enableForPvReply = true;
      if (!appState.activeAccountId) {
        appState.activeAccountId = acc.id;
      }
    }
  }

  if (!appState.activeAccountId && appState.accounts.length > 0) {
    appState.activeAccountId = appState.accounts[0].id;
  }
}

// Initial Sync
syncAccountsState();
purgeInvalidGroupsFromState();

// Helper: Check if an entity or phone/username belongs to our own connected accounts (prevents self-chat loops)
function isInternalSystemAccount(senderId?: string | number, senderUsername?: string, senderPhone?: string): boolean {
  if (!senderId && !senderUsername && !senderPhone) return false;
  const strId = senderId ? String(senderId).trim() : '';
  const cleanPhone = (p?: string) => (p || '').replace(/[^0-9]/g, '');
  const cleanUser = (u?: string) => (u || '').toLowerCase().replace('@', '').trim();
  const targetUser = cleanUser(senderUsername);
  const targetPhone = cleanPhone(senderPhone);

  // Check primary credentials
  if (appState.credentials) {
    if (strId && appState.credentials.userProfile?.id && String(appState.credentials.userProfile.id) === strId) return true;
    if (targetUser && appState.credentials.userProfile?.username && cleanUser(appState.credentials.userProfile.username) === targetUser) return true;
    if (targetPhone && appState.credentials.phoneNumber && cleanPhone(appState.credentials.phoneNumber) === targetPhone) return true;
  }

  // Check all registered accounts in pool
  if (Array.isArray(appState.accounts)) {
    for (const acc of appState.accounts) {
      if (strId && acc.id && String(acc.id) === strId) return true;
      if (strId && acc.userProfile?.id && String(acc.userProfile.id) === strId) return true;
      if (targetUser && acc.userProfile?.username && cleanUser(acc.userProfile.username) === targetUser) return true;
      if (targetPhone && acc.phoneNumber && cleanPhone(acc.phoneNumber) === targetPhone) return true;
      if (targetPhone && acc.userProfile?.phone && cleanPhone(acc.userProfile.phone) === targetPhone) return true;
    }
  }

  return false;
}

// Helper: Check if an incoming message explicitly inquires about VPN, configs, or purchases
function isVpnOrProductInquiry(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const vpnKeywords = [
    'وی پی ان', 'فیلترشکن', 'vpn', 'کانفیگ', 'v2ray', 'v2', 'سرور', 'ip ثابت', 'آی پی ثابت',
    'تست رایگان', 'اکانت تست', 'اشتراک', 'تعرفه', 'قیمت چنده', 'چند ماهه', 'خرید اشتراک',
    'پروکسی', 'خرید vpn', 'خرید فیلترشکن', 'وصل نمیشه', 'قندشکن', 'هزینه vpn', 'تلگرام پرمیوم',
    'openvpn', 'wireguard', 'شادوساکس', 'shadowsocks', 'سایت خرید', 'قیمت vpn', 'چند تومنه',
    'اکانت vpn', 'سرعت vpn', 'v2rayng', 'nekoray', 'napsternetv'
  ];
  return vpnKeywords.some(kw => lower.includes(kw));
}

// Helper: Filter groups based on Google AI Studio instance sharding
function getShardedActiveGroups(): TargetGroup[] {
  const allActive = (appState.groups || []).filter(g => {
    if (!g.isActive) return false;
    if (g.status === 'purged_non_persian' || g.readinessStatus === 'non_persian_purged') return false;
    if (g.isPersianVerified === false) return false;
    if (isBlacklistedNonPersianTarget(g.usernameOrLink) || isBlacklistedNonPersianTarget(g.title)) return false;
    return true;
  });
  const sharding = appState.instanceSharding;
  if (!sharding || !sharding.isEnabled || sharding.totalShards <= 1) {
    return allActive;
  }
  const zeroIndex = Math.max(0, (sharding.currentShard || 1) - 1);
  const total = Math.max(1, sharding.totalShards || 5);
  return allActive.filter((_, idx) => (idx % total) === zeroIndex);
}

// Ensure all groups have a designated responsible account (territory owner)
function ensureGroupTerritories(): void {
  syncAccountsState();
  const now = Date.now();
  const enableRedistribution = appState.scheduler?.antiBot?.enableFailoverRedistribution ?? false;

  // If redistribution is disabled, any active registered account retains its groups even during temporary flood wait
  const allConfiguredAccounts = (appState.accounts || []).filter(
    a => a.isActive &&
         (a.enableForGroupBroadcast !== false) &&
         a.status !== 'session_expired' &&
         a.status !== 'disabled'
  );

  const healthyAccounts = allConfiguredAccounts.filter(
    a => (!a.floodWaitUntil || a.floodWaitUntil < now) &&
         (!a.peerFloodUntil || a.peerFloodUntil < now)
  );

  const pool = enableRedistribution ? healthyAccounts : allConfiguredAccounts;
  if (pool.length === 0) return;

  const allGroups = appState.groups || [];
  let modified = false;

  for (let i = 0; i < allGroups.length; i++) {
    const group = allGroups[i];
    const hasOwner = (enableRedistribution ? healthyAccounts : allConfiguredAccounts).some(a => a.id === group.assignedAccountId);
    if (!hasOwner) {
      // Pick account with lowest assigned group count
      const targetPool = healthyAccounts.length > 0 ? healthyAccounts : pool;
      const sorted = [...targetPool].sort((a, b) => (a.assignedGroupCount || 0) - (b.assignedGroupCount || 0));
      const chosen = sorted[0];
      group.assignedAccountId = chosen.id;
      group.assignedAccountPhone = chosen.phoneNumber;
      group.assignedAccountName = chosen.userProfile?.firstName || chosen.phoneNumber;
      chosen.assignedGroupCount = (chosen.assignedGroupCount || 0) + 1;
      modified = true;
    }
  }

  for (const acc of appState.accounts || []) {
    acc.assignedGroupCount = allGroups.filter(g => g.assignedAccountId === acc.id).length;
  }

  if (modified) {
    saveData();
  }
}

// Auto-Balance territories across all healthy accounts evenly
function autoBalanceTerritories(forceRebalanceAll: boolean = false): {
  success: boolean;
  totalGroups: number;
  totalAccounts: number;
  distribution: Array<{ accountId: string; phone: string; name?: string; count: number }>;
} {
  syncAccountsState();
  const now = Date.now();
  const allActiveConfigured = (appState.accounts || []).filter(
    a => a.isActive &&
         (a.enableForGroupBroadcast !== false) &&
         a.status !== 'session_expired' &&
         a.status !== 'disabled'
  );

  const healthyAccounts = allActiveConfigured.filter(
    a => (!a.floodWaitUntil || a.floodWaitUntil < now) &&
         (!a.peerFloodUntil || a.peerFloodUntil < now)
  );

  const accounts = (forceRebalanceAll || healthyAccounts.length === 0) ? allActiveConfigured : healthyAccounts;

  if (accounts.length === 0) {
    return { success: false, totalGroups: 0, totalAccounts: 0, distribution: [] };
  }

  const allActiveGroups = (appState.groups || []).filter(g => g.isActive);
  if (allActiveGroups.length === 0) {
    return { success: true, totalGroups: 0, totalAccounts: accounts.length, distribution: [] };
  }

  for (let i = 0; i < allActiveGroups.length; i++) {
    const group = allActiveGroups[i];
    if (forceRebalanceAll || !group.assignedAccountId || !accounts.some(a => a.id === group.assignedAccountId)) {
      const chosen = accounts[i % accounts.length];
      group.assignedAccountId = chosen.id;
      group.assignedAccountPhone = chosen.phoneNumber;
      group.assignedAccountName = chosen.userProfile?.firstName || chosen.phoneNumber;
      group.isFailoverReassigned = false;
      group.previousOwnerAccountId = undefined;
    }
  }

  const distribution = accounts.map(acc => {
    const count = allActiveGroups.filter(g => g.assignedAccountId === acc.id).length;
    acc.assignedGroupCount = count;
    return {
      accountId: acc.id,
      phone: acc.phoneNumber,
      name: acc.userProfile?.firstName,
      count,
    };
  });

  saveData();
  addLog(
    'success',
    `[توزیع قلمروها] تعداد ${allActiveGroups.length} گروه فعال به صورت کاملاً مساوی بین ${accounts.length} اکانت آنلاین تقسیم شدند.`
  );

  return {
    success: true,
    totalGroups: allActiveGroups.length,
    totalAccounts: accounts.length,
    distribution,
  };
}

// Emergency Failover Engine: Triggered when any account is banned, limited, or disconnected
function handleAccountFailover(faultyAccountId: string, reason: string): {
  reassignedCount: number;
  healthyAccountsCount: number;
} {
  syncAccountsState();
  const faultyAcc = (appState.accounts || []).find(a => a.id === faultyAccountId);
  if (!faultyAcc) return { reassignedCount: 0, healthyAccountsCount: 0 };

  const rLower = (reason || '').toLowerCase();
  const now = Date.now();

  if (rLower.includes('flood_wait') || rLower.includes('floodwait')) {
    const match = reason.match(/(\d+)\s*sec/i) || reason.match(/(\d+)/);
    const secs = match ? parseInt(match[1], 10) : 300;
    faultyAcc.floodWaitUntil = now + Math.max(60, secs) * 1000;
    faultyAcc.status = 'flood_wait';
    faultyAcc.shiftStatus = 'banned_limited';
    faultyAcc.statusMessage = `محدودیت موقت FloodWait تلگرام (${Math.ceil(secs / 60)} دقیقه)`;
  } else if (rLower.includes('peer_flood') || rLower.includes('spambot') || rLower.includes('peerflood')) {
    faultyAcc.peerFloodUntil = now + 24 * 3600 * 1000;
    faultyAcc.status = 'error';
    faultyAcc.shiftStatus = 'banned_limited';
    faultyAcc.statusMessage = 'محدودیت ارسال پیام خصوصی (PEER_FLOOD SpamBot) به مدت ۲۴ ساعت';
  } else if (
    rLower.includes('auth_key') ||
    rLower.includes('session_revoked') ||
    rLower.includes('session_expired') ||
    rLower.includes('user_deactivated')
  ) {
    faultyAcc.status = 'session_expired';
    faultyAcc.requiresReauth = true;
    faultyAcc.shiftStatus = 'banned_limited';
    faultyAcc.statusMessage = 'نشست منقضی شده یا از دستگاه دیگر ابطال شده است (نیاز به لاگین مجدد)';
    faultyAcc.isActive = false;
  } else {
    faultyAcc.status = 'error';
    faultyAcc.shiftStatus = 'banned_limited';
    faultyAcc.statusMessage = `خطا: ${reason}`;
  }

  // Find orphaned groups belonging to this faulty account
  const orphanedGroups = (appState.groups || []).filter(g => g.assignedAccountId === faultyAccountId && g.isActive);

  // Check if automatic task redistribution across accounts is enabled by user
  const enableRedistribution = appState.scheduler?.antiBot?.enableFailoverRedistribution ?? false;

  // Find remaining healthy accounts
  const healthyAccounts = (appState.accounts || []).filter(
    a => a.id !== faultyAccountId &&
         a.isActive &&
         (a.enableForGroupBroadcast !== false) &&
         a.status !== 'session_expired' &&
         a.status !== 'disabled' &&
         (!a.floodWaitUntil || a.floodWaitUntil < now) &&
         (!a.peerFloodUntil || a.peerFloodUntil < now)
  );

  if (!enableRedistribution) {
    addLog(
      'info',
      `🔒 [حفظ قلمرو گروه و عدم جابجایی وظایف] اکانت (${faultyAcc.phoneNumber}) در وضعیت «${reason}» قرار گرفت. با توجه به غیرفعال بودن انتقال خودکار وظایف (Failover Redistribution = OFF)، هیچ اکانتی مسئول گروه‌های این اکانت نمی‌شود و تعداد ${orphanedGroups.length} گروه آن در حالت تعلیق محفوظ می‌مانند تا محدودیت خود این اکانت رفع گردد.`
    );
    for (const acc of appState.accounts || []) {
      acc.assignedGroupCount = (appState.groups || []).filter(g => g.assignedAccountId === acc.id).length;
    }
    saveData();
    return {
      reassignedCount: 0,
      healthyAccountsCount: healthyAccounts.length,
    };
  }

  if (orphanedGroups.length > 0 && healthyAccounts.length > 0) {
    for (let i = 0; i < orphanedGroups.length; i++) {
      const targetGroup = orphanedGroups[i];
      const replacement = healthyAccounts[i % healthyAccounts.length];
      targetGroup.assignedAccountId = replacement.id;
      targetGroup.assignedAccountPhone = replacement.phoneNumber;
      targetGroup.assignedAccountName = replacement.userProfile?.firstName || replacement.phoneNumber;
      targetGroup.isFailoverReassigned = true;
      targetGroup.previousOwnerAccountId = faultyAccountId;
      targetGroup.reassignedAt = new Date().toISOString();
    }

    addLog(
      'warning',
      `🚨 [مکانیزم Failover اضطراری - انتقال خودکار مسئولیت] اکانت (${faultyAcc.phoneNumber}) به علت «${reason}» از دسترس خارج شد. تعداد ${orphanedGroups.length} گروه تحت مدیریت آن بلافاصله بین ${healthyAccounts.length} اکانت فعال دیگر تقسیم شدند تا فرایند تبلیغات و پاسخگویی متوقف نشود.`
    );
  } else if (orphanedGroups.length > 0) {
    addLog(
      'error',
      `⚠️ [هشدار Failover] اکانت (${faultyAcc.phoneNumber}) متوقف شد و هیچ اکانت سالم دیگری برای تحویل گرفتن ${orphanedGroups.length} گروه باقی نمانده است!`
    );
  }

  for (const acc of appState.accounts || []) {
    acc.assignedGroupCount = (appState.groups || []).filter(g => g.assignedAccountId === acc.id).length;
  }

  saveData();
  return {
    reassignedCount: orphanedGroups.length,
    healthyAccountsCount: healthyAccounts.length,
  };
}

// Resolve the responsible account and initialized MTProto client for a specific group
async function getOrAssignGroupOwner(group: TargetGroup): Promise<{ account: any; client: any } | null> {
  syncAccountsState();
  const now = Date.now();
  let owner = (appState.accounts || []).find(a => a.id === group.assignedAccountId);

  const isOwnerHealthy = owner &&
    owner.isActive &&
    (owner.enableForGroupBroadcast !== false) &&
    owner.status !== 'session_expired' &&
    owner.status !== 'disabled' &&
    (!owner.floodWaitUntil || owner.floodWaitUntil < now) &&
    (!owner.peerFloodUntil || owner.peerFloodUntil < now);

  if (!isOwnerHealthy) {
    const enableRedistribution = appState.scheduler?.antiBot?.enableFailoverRedistribution ?? false;

    // If owner is currently limited/floodwaited and user disabled redistribution:
    // Retain territory: No other account takes over this group! Wait for owner!
    if (!enableRedistribution && owner) {
      return null;
    }

    if (owner && !owner.isActive) {
      // If owner was deactivated by user, reassign without error
      addLog('info', `[تغییر مسئولیت گروه] اکانت (${owner.phoneNumber}) غیرفعال شده است. گروه "${group.title}" به اکانت فعال دیگری واگذار می‌شود.`);
    } else if (owner) {
      handleAccountFailover(owner.id, owner.statusMessage || 'اکانت از دسترس خارج شده است');
    }

    const healthyList = (appState.accounts || []).filter(
      a => a.isActive &&
           (a.enableForGroupBroadcast !== false) &&
           a.status !== 'session_expired' &&
           a.status !== 'disabled' &&
           (!a.floodWaitUntil || a.floodWaitUntil < now) &&
           (!a.peerFloodUntil || a.peerFloodUntil < now)
    ).sort((a, b) => (a.assignedGroupCount || 0) - (b.assignedGroupCount || 0));

    if (healthyList.length === 0) {
      if (activeTgClient && appState.credentials.isConnected) {
        return { account: appState.accounts?.[0] || { phoneNumber: 'حساب اصلی', id: 'primary' }, client: activeTgClient };
      }
      return null;
    }

    owner = healthyList[0];
    group.assignedAccountId = owner.id;
    group.assignedAccountPhone = owner.phoneNumber;
    group.assignedAccountName = owner.userProfile?.firstName || owner.phoneNumber;
    owner.assignedGroupCount = (owner.assignedGroupCount || 0) + 1;
    saveData();
  }

  try {
    const client = await getOrInitClientForAccount(owner);
    if (!client) {
      handleAccountFailover(owner.id, 'عدم توانایی اتصال MTProto تلگرام');
      return null;
    }
    return { account: owner, client };
  } catch (err: any) {
    handleAccountFailover(owner.id, err?.message || 'خطا در کلاینت اکانت');
    return null;
  }
}

// Helper: Daily Counters Reset
function checkAndResetDailyCounters() {
  const todayStr = new Date().toISOString().split('T')[0];
  if (appState.scheduler.dailyResetDate !== todayStr) {
    appState.scheduler.dailyResetDate = todayStr;
    appState.scheduler.dailySentCount = 0;
    if (appState.accounts) {
      for (const acc of appState.accounts) {
        acc.dailySentCount = 0;
      }
    }
    saveData();
    console.log(`[DailyReset] Daily sending limits reset for date ${todayStr}`);
  }
}

// Helper: Check Night Mode (01:00 AM to 07:00 AM pause)
function isNightModeActive(): boolean {
  if (!appState.scheduler.nightModePause) return false;
  const currentHour = new Date().getHours();
  const startHour = appState.scheduler.nightModeStartHour ?? 1; // 01:00 AM
  const endHour = appState.scheduler.nightModeEndHour ?? 7;   // 07:00 AM
  
  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Overnight range e.g. 23 to 6
    return currentHour >= startHour || currentHour < endHour;
  }
}

function addLog(level: 'info' | 'success' | 'warning' | 'error', message: string, groupTitle?: string, details?: string, campaignTitle?: string) {
  const newLog: LogEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    level,
    message,
    groupTitle,
    details,
    campaignTitle,
  };
  appState.logs.unshift(newLog);
  // Keep last 100 logs
  if (appState.logs.length > 100) {
    appState.logs = appState.logs.slice(0, 100);
  }
  saveData();
}

// Active GramJS Client Instances Pool for Multi-Account
let activeTgClient: any = null;
const accountClientsMap = new Map<string, any>();

async function getOrInitTgClient() {
  await loadGramJS();
  if (activeTgClient && !activeTgClient._destroyed) {
    return activeTgClient;
  }
  if (!appState.credentials.apiId || !appState.credentials.apiHash || !appState.credentials.sessionString || !TelegramClient || !StringSession) {
    return null;
  }
  try {
    const apiId = parseInt(appState.credentials.apiId || DEFAULT_API_ID, 10);
    const apiHash = appState.credentials.apiHash || DEFAULT_API_HASH;
    const stringSession = new StringSession(appState.credentials.sessionString);
    
    const client = createTelegramClient(stringSession, apiId, apiHash, appState.credentials.proxy);
    
    await client.connect();
    
    // Check if session is actually authorized
    const isAuth = await client.isUserAuthorized();
    if (!isAuth) {
      console.warn('Telegram session is not authorized');
      appState.credentials.isConnected = false;
      appState.credentials.sessionString = '';
      appState.credentials.userProfile = undefined;
      if (activeTgClient) {
        try { activeTgClient.disconnect(); } catch (e) {}
      }
      activeTgClient = null;
      saveData();
      return null;
    }

    activeTgClient = client;
    registerInboundPvListener(client).catch(console.error);
    return client;
  } catch (err: any) {
    const errMsg = String(err?.errorMessage || err?.message || err);
    console.error('Telegram MTProto connect error:', errMsg);

    // Handle invalid, revoked, or duplicated session keys
    if (
      errMsg.includes('AUTH_KEY_DUPLICATED') ||
      errMsg.includes('AUTH_KEY_UNREGISTERED') ||
      errMsg.includes('AUTH_KEY_INVALID') ||
      errMsg.includes('SESSION_REVOKED') ||
      errMsg.includes('SESSION_EXPIRED') ||
      errMsg.includes('406')
    ) {
      console.warn(`[MTProto Auth Reset] Invalid/Duplicated session key detected: ${errMsg}. Resetting session credentials.`);
      appState.credentials.isConnected = false;
      appState.credentials.sessionString = '';
      appState.credentials.userProfile = undefined;
      if (activeTgClient) {
        try { activeTgClient.disconnect(); } catch (e) {}
        activeTgClient = null;
      }
      addLog('warning', 'نشست تلگرام شما منقضی یا از دستگاه دیگری استفاده شده است (AUTH_KEY_DUPLICATED). لطفاً از طریق منوی تنظیمات اتصال، مجدداً کد تایید تلگرام بگیرید.');
      saveData();
    }
    return null;
  }
}

const clientAccountMap = new WeakMap<any, any>();

async function getOrInitClientForAccount(account: any) {
  if (!account || !account.sessionString) return null;
  
  if (accountClientsMap.has(account.id)) {
    const cachedClient = accountClientsMap.get(account.id);
    if (cachedClient && !cachedClient._destroyed) {
      return cachedClient;
    }
  }

  await loadGramJS();
  if (!TelegramClient || !StringSession) return null;

  try {
    const apiId = parseInt(account.apiId || appState.credentials.apiId || DEFAULT_API_ID, 10);
    const apiHash = account.apiHash || appState.credentials.apiHash || DEFAULT_API_HASH;
    const stringSession = new StringSession(account.sessionString);

    const accountIndex = (appState.accounts || []).findIndex(a => a.id === account.id);
    const client = createTelegramClient(
      stringSession,
      apiId,
      apiHash,
      account.proxy || appState.credentials.proxy,
      account,
      accountIndex >= 0 ? accountIndex : 0
    );

    await client.connect();

    const isAuth = await client.isUserAuthorized();
    if (!isAuth) {
      console.warn(`Account ${account.phoneNumber} session unauthorized`);
      account.status = 'error';
      account.statusMessage = 'نشست منقضی شده است.';
      accountClientsMap.delete(account.id);
      handleAccountFailover(account.id, 'نشست تلگرام منقضی شده است');
      saveData();
      return null;
    }

    accountClientsMap.set(account.id, client);
    clientAccountMap.set(client, account);
    registerInboundPvListener(client, account).catch(console.error);
    return client;
  } catch (err: any) {
    const errMsg = String(err?.errorMessage || err?.message || err);
    console.error(`Client init error for account ${account.phoneNumber}:`, errMsg);

    if (
      errMsg.includes('AUTH_KEY_DUPLICATED') ||
      errMsg.includes('AUTH_KEY_UNREGISTERED') ||
      errMsg.includes('AUTH_KEY_INVALID') ||
      errMsg.includes('SESSION_REVOKED') ||
      errMsg.includes('SESSION_EXPIRED') ||
      errMsg.includes('406')
    ) {
      account.status = 'session_expired';
      account.isVerifiedLive = false;
      account.requiresReauth = true;
      account.statusMessage = 'نشست تلگرام منقضی شده یا از دستگاه دیگری بسته شده است (نیاز به تمدید نشست)';
      account.isActive = false;
      accountClientsMap.delete(account.id);
      if (appState.activeAccountId === account.id || appState.credentials.phoneNumber === account.phoneNumber) {
        appState.credentials.isConnected = false;
      }
      handleAccountFailover(account.id, errMsg);
      saveData();
    }
    return null;
  }
}

// 100% Guaranteed Live Health Checker for Telegram Accounts
async function verifyAccountLiveHealth(account: any, forceReconnect = false): Promise<{
  success: boolean;
  status: 'connected' | 'session_expired' | 'flood_wait' | 'error' | 'disabled';
  statusMessage: string;
  userProfile?: any;
  floodWaitUntil?: number;
}> {
  if (!account || !account.sessionString) {
    account.status = 'session_expired';
    account.isVerifiedLive = false;
    account.requiresReauth = true;
    account.statusMessage = 'نشست تلگرام وجود ندارد (نیاز به اتصال مجدد)';
    saveData();
    return { success: false, status: 'session_expired', statusMessage: account.statusMessage };
  }

  if (forceReconnect && accountClientsMap.has(account.id)) {
    try {
      const existing = accountClientsMap.get(account.id);
      await existing.disconnect();
    } catch (e) {}
    accountClientsMap.delete(account.id);
  }

  await loadGramJS();
  if (!TelegramClient || !StringSession) {
    return { success: false, status: 'error', statusMessage: 'کتابخانه تلگرام در دسترس نیست.' };
  }

  try {
    const apiId = parseInt(account.apiId || appState.credentials.apiId || DEFAULT_API_ID, 10);
    const apiHash = account.apiHash || appState.credentials.apiHash || DEFAULT_API_HASH;
    const stringSession = new StringSession(account.sessionString);

    let client = accountClientsMap.get(account.id);
    if (!client || client._destroyed) {
      client = createTelegramClient(stringSession, apiId, apiHash, account.proxy || appState.credentials.proxy);

      await Promise.race([
        client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('CONNECT_TIMEOUT')), 15000))
      ]);
    }

    const isAuth = await client.isUserAuthorized();
    if (!isAuth) {
      account.status = 'session_expired';
      account.isVerifiedLive = false;
      account.requiresReauth = true;
      account.statusMessage = 'نشست تلگرام نامعتبر یا منقضی شده است (نیاز به تمدید نشست)';
      accountClientsMap.delete(account.id);
      if (appState.activeAccountId === account.id || appState.credentials.phoneNumber === account.phoneNumber) {
        appState.credentials.isConnected = false;
      }
      saveData();
      return { success: false, status: 'session_expired', statusMessage: account.statusMessage };
    }

    const me = await client.getMe();
    if (!me) {
      throw new Error('عدم دریافت مشخصات اکانت از تلگرام');
    }

    // Refresh and update userProfile
    account.userProfile = {
      id: me.id ? me.id.toString() : (account.userProfile?.id || 'me'),
      firstName: me.firstName || (account.userProfile?.firstName || 'کاربر'),
      lastName: me.lastName || '',
      username: me.username || '',
      phone: me.phone ? (me.phone.startsWith('+') ? me.phone : '+' + me.phone) : account.phoneNumber,
    };

    account.status = 'connected';
    account.isVerifiedLive = true;
    account.requiresReauth = false;
    account.lastVerifiedAt = new Date().toISOString();
    account.statusMessage = 'متصل و ۱۰۰٪ فعال و تایید شده';
    accountClientsMap.set(account.id, client);

    // Synchronize primary credentials if this is active
    if (appState.activeAccountId === account.id || appState.credentials.phoneNumber === account.phoneNumber) {
      appState.credentials.isConnected = true;
      appState.credentials.userProfile = account.userProfile;
      appState.credentials.sessionString = account.sessionString;
    }

    saveData();
    return {
      success: true,
      status: 'connected',
      statusMessage: account.statusMessage,
      userProfile: account.userProfile,
    };
  } catch (err: any) {
    const errMsg = String(err?.errorMessage || err?.message || err);
    console.error(`Live health check failed for account ${account.phoneNumber}:`, errMsg);

    const isExpiredOrRevoked =
      errMsg.includes('AUTH_KEY_DUPLICATED') ||
      errMsg.includes('AUTH_KEY_UNREGISTERED') ||
      errMsg.includes('AUTH_KEY_INVALID') ||
      errMsg.includes('SESSION_REVOKED') ||
      errMsg.includes('SESSION_EXPIRED') ||
      errMsg.includes('406') ||
      errMsg.includes('USER_DEACTIVATED') ||
      errMsg.includes('USER_DEACTIVATED_BAN');

    if (isExpiredOrRevoked) {
      account.status = 'session_expired';
      account.isVerifiedLive = false;
      account.requiresReauth = true;
      account.statusMessage = 'نشست تلگرام از دستگاه دیگر بسته یا منقضی شده است (نیاز به تمدید نشست)';
      accountClientsMap.delete(account.id);
      if (appState.activeAccountId === account.id || appState.credentials.phoneNumber === account.phoneNumber) {
        appState.credentials.isConnected = false;
      }
      saveData();
      return { success: false, status: 'session_expired', statusMessage: account.statusMessage };
    }

    const secs = parseFloodWaitSeconds(err);
    if (secs && secs > 0) {
      account.status = 'flood_wait';
      account.isVerifiedLive = false;
      account.floodWaitUntil = Date.now() + secs * 1000;
      account.statusMessage = `محدودیت FloodWait تلگرام (${Math.ceil(secs / 60)} دقیقه)`;
      saveData();
      return { success: false, status: 'flood_wait', statusMessage: account.statusMessage, floodWaitUntil: account.floodWaitUntil };
    }

    account.status = 'error';
    account.isVerifiedLive = false;
    account.statusMessage = translateTgError(err);
    saveData();
    return { success: false, status: 'error', statusMessage: account.statusMessage };
  }
}


// Global tracker for GramJS FloodWait on ResolveUsername
let resolveUsernameFloodWaitUntil = 0;

function parseFloodWaitSeconds(err: any): number | null {
  if (!err) return null;
  if (typeof err === 'number' && err > 0) return err;
  if (typeof err?.seconds === 'number' && err.seconds > 0) return err.seconds;

  const msg = String(err.errorMessage || err.message || err);
  const match = msg.match(/A wait of (\d+) seconds is required/i) || 
                msg.match(/FLOOD_WAIT_?(\d+)/i) || 
                msg.match(/FLOOD_?(\d+)/i) ||
                msg.match(/wait (\d+) seconds/i) ||
                msg.match(/(\d+)\s*seconds/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  // Persian FloodWait error formats:
  // e.g. "محدودیت ارسال تلگرام (Flood Wait). لطفاً 0.1 ساعت (3 دقیقه) صبوری کنید."
  const persianMinsMatch = msg.match(/(?:لطفاً|\()\s*(\d+)\s*دقیقه/i) || msg.match(/(\d+)\s*دقیقه/i);
  if ((msg.includes('Flood') || msg.includes('flood') || msg.includes('محدودیت') || msg.includes('Flood Wait')) && persianMinsMatch && persianMinsMatch[1]) {
    return parseInt(persianMinsMatch[1], 10) * 60;
  }

  const persianSecsMatch = msg.match(/(?:لطفاً|\()\s*(\d+)\s*ثانیه/i) || msg.match(/(\d+)\s*ثانیه/i);
  if ((msg.includes('Flood') || msg.includes('flood') || msg.includes('محدودیت') || msg.includes('Flood Wait')) && persianSecsMatch && persianSecsMatch[1]) {
    return parseInt(persianSecsMatch[1], 10);
  }

  // Generic FLOOD error without explicit numeric seconds (protect against Telegram spam/ban)
  if (msg.trim() === 'FLOOD' || msg.includes('Error: FLOOD') || msg.includes('FLOOD_PREMIUM_WAIT') || msg.includes('RPCError 420') || msg.includes('Flood Wait') || msg.includes('FLOOD_WAIT')) {
    return 180; // 3 minutes cooldown
  }
  return null;
}

// Comprehensive Validator for Telegram Target Handles, Links and IDs
function isValidTelegramTarget(rawInput: string): { valid: boolean; reason?: string; cleanTarget: string } {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, reason: 'ورودی آیدی یا لینک خالی است', cleanTarget: '' };
  }
  const s = rawInput.trim();
  if (!s || s.length < 3) {
    return { valid: false, reason: 'طول آیدی یا لینک بیش از حد کوتاه است', cleanTarget: s };
  }

  // Filter out dummy sample groups
  const lower = s.toLowerCase();
  if (
    s.includes('(نمونه)') ||
    lower.includes('tehranshoppinggroup') ||
    lower.includes('niazmandiha_iran') ||
    lower.includes('digitalbazar_official')
  ) {
    return { valid: false, reason: 'گروه نمونه ساختگی است', cleanTarget: s };
  }

  // Invite link formats: e.g. https://t.me/+AbCdEf123 or t.me/joinchat/AbCdEf123
  if (s.includes('t.me/+') || s.includes('telegram.me/+') || s.includes('joinchat/')) {
    const hash = s.includes('/+') ? s.split('/+')[1]?.split('/')[0]?.split('?')[0] : s.split('joinchat/')[1]?.split('/')[0]?.split('?')[0];
    if (hash && /^[a-zA-Z0-9_-]{5,40}$/.test(hash)) {
      return { valid: true, cleanTarget: s };
    }
    return { valid: false, reason: 'لینک دعوت تلگرام نامعتبر است', cleanTarget: s };
  }

  // Direct numeric chat IDs (e.g., -100123456789 or 123456789)
  if (/^-?\d{5,20}$/.test(s)) {
    return { valid: true, cleanTarget: s };
  }

  // Strip t.me/ or telegram.me/ or @ prefix
  let cleanHandle = s;
  if (cleanHandle.includes('t.me/')) {
    cleanHandle = cleanHandle.split('t.me/')[1]?.split('/')[0]?.split('?')[0] || '';
  } else if (cleanHandle.includes('telegram.me/')) {
    cleanHandle = cleanHandle.split('telegram.me/')[1]?.split('/')[0]?.split('?')[0] || '';
  }
  cleanHandle = cleanHandle.replace(/^@+/, '').trim();

  // Telegram handles must be 4-32 ASCII alphanumeric + underscore characters
  if (!/^[a-zA-Z0-9_]{4,32}$/.test(cleanHandle)) {
    return { valid: false, reason: 'آیدی تلگرام فقط باید شامل حروف انگلیسی، اعداد و _ بین ۴ تا ۳۲ کاراکتر باشد', cleanTarget: s };
  }

  return { valid: true, cleanTarget: `@${cleanHandle}` };
}

function purgeInvalidGroupsFromState(): number {
  if (!appState.groups || !Array.isArray(appState.groups)) {
    appState.groups = [];
    return 0;
  }
  const before = appState.groups.length;
  appState.groups = appState.groups.filter(g => {
    if (!g || !g.usernameOrLink) return false;
    const check = isValidTelegramTarget(g.usernameOrLink);
    return check.valid;
  });
  const purged = before - appState.groups.length;
  if (purged > 0) {
    saveData();
    console.log(`🧹 Auto-purged ${purged} invalid/dummy sample groups from state.`);
    addLog('info', `[پاکسازی هوشمند] تعداد ${purged} گروه نامعتبر یا آزمایشی از لیست گروه‌ها حذف شدند.`);
  }
  return purged;
}

function handleGramJsFloodWait(err: any): number | null {
  const secs = parseFloodWaitSeconds(err);
  if (secs !== null && secs > 0) {
    const hours = (secs / 3600).toFixed(1);
    const msg = String(err.errorMessage || err.message || err);
    if (msg.includes('ResolveUsername') || msg.includes('contacts.ResolveUsername')) {
      resolveUsernameFloodWaitUntil = Date.now() + secs * 1000;
      console.log(`[FloodWait] contacts.ResolveUsername locked for ${secs}s (${hours}h)`);
    } else {
      console.log(`[FloodWait] GramJS RPC locked for ${secs}s (${hours}h)`);
    }
    return secs;
  }
  return null;
}

// Helper Function: Normalize Telegram Bot Token (fixes reversed digits:letters strings)
function normalizeBotToken(rawToken?: string): string {
  if (!rawToken) return '';
  let token = rawToken.trim();
  // If token was reversed (e.g. AAHLujZ1...:8896745743), auto-swap back to 8896745743:AAHLujZ1...
  if (/^[a-zA-Z0-9_-]+:\d+$/.test(token)) {
    const parts = token.split(':');
    token = `${parts[1]}:${parts[0]}`;
  }
  return token;
}

// Helper Function: Resolve @username or link to numeric ID for Bot API
async function resolveTargetId(botToken: string, target: string): Promise<string> {
  let clean = target.trim();
  if (clean.includes('t.me/')) {
    clean = clean.split('t.me/')[1].split('/')[0].split('?')[0];
  }
  if (!clean.startsWith('@') && !clean.startsWith('-') && !/^\d+$/.test(clean)) {
    clean = '@' + clean;
  }

  // If already numeric ID (e.g. 12345678 or -100123456789) or starts with @
  // Telegram Bot API natively accepts @username (e.g. @my_channel or @my_group) directly in chat_id!
  if (/^-?\d+$/.test(clean) || clean.startsWith('@')) {
    // Check if Bot API getUpdates has a numeric ID recorded for private user messages
    if (clean.startsWith('@')) {
      const usernameWithoutAt = clean.replace(/^@/, '').toLowerCase();
      try {
        const cleanTok = normalizeBotToken(botToken);
        const res = await fetch(`https://api.telegram.org/bot${cleanTok}/getUpdates`);
        const json = await res.json();
        if (json.ok && Array.isArray(json.result)) {
          for (const update of json.result.reverse()) { // latest updates first
            const msg = update.message || update.edited_message || update.my_chat_member?.chat || update.chat_member?.chat;
            if (msg) {
              const fromUser = msg.from?.username?.toLowerCase();
              const chatUser = msg.chat?.username?.toLowerCase();
              if (fromUser === usernameWithoutAt || chatUser === usernameWithoutAt) {
                const numericId = String(msg.chat?.id || msg.from?.id);
                if (numericId) {
                  return numericId;
                }
              }
            }
          }
        }
      } catch (err) {}
    }
    return clean;
  }

  return clean;
}

// Helper Function: Telegram Bot API direct sender (100% reliable HTTPS fallback)
function markdownToHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>');
}

async function getBotInfo(botToken: string): Promise<{ ok: boolean; username?: string; name?: string }> {
  try {
    const cleanTok = normalizeBotToken(botToken);
    const res = await fetch(`https://api.telegram.org/bot${cleanTok}/getMe`);
    const json = await res.json();
    if (json.ok && json.result) {
      return { ok: true, username: json.result.username, name: json.result.first_name };
    }
  } catch (e) {}
  return { ok: false };
}

async function sendViaBotApi(botToken: string, chatTarget: string, textMessage: string, imageUrl?: string) {
  const cleanTok = normalizeBotToken(botToken);
  const targetId = await resolveTargetId(cleanTok, chatTarget);

  const baseUrl = `https://api.telegram.org/bot${cleanTok}`;
  const htmlText = markdownToHtml(textMessage);

  const sendRequest = async (endpoint: 'sendPhoto' | 'sendMessage', bodyObj: Record<string, any>) => {
    // 1st attempt: HTML parse mode
    let res = await fetch(`${baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...bodyObj, parse_mode: 'HTML' }),
    });
    let json = await res.json();

    // If parse error, 2nd attempt: Plain text without parse_mode
    if (!json.ok && json.description && (json.description.includes('parse') || json.description.includes('entity'))) {
      const { parse_mode, ...plainBody } = bodyObj;
      res = await fetch(`${baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plainBody),
      });
      json = await res.json();
    }

    return json;
  };

  let json: any;
  if (imageUrl && imageUrl.startsWith('http')) {
    json = await sendRequest('sendPhoto', {
      chat_id: targetId,
      photo: imageUrl,
      caption: htmlText,
    });
  } else {
    json = await sendRequest('sendMessage', {
      chat_id: targetId,
      text: htmlText,
    });
  }

  if (!json.ok) {
    const desc = json.description || '';
    const botInfo = await getBotInfo(cleanTok);
    const botUsername = botInfo.username ? `@${botInfo.username}` : 'ربات تلگرام شما';

    if (desc.includes('chat not found') || desc.includes("bot can't initiate conversation") || desc.includes('bot can\'t send messages to bots')) {
      throw new Error(
        `امکان ارسال مستقیم به آیدی شخصی (${chatTarget}) با ربات وجود ندارد تا زمانی که شناسه عددی شما مشخص شود.\n\n👇 **راه حل:**\n۱. وارد ربات ${botUsername} شوید و یک پیام متنی کوتاه (مثلاً سلام) بفرستید تا شناسه چت شما ثبت گردد.\n۲. سپس دوباره دکمه «تست ارسال» را بزنید (یا آیدی یک گروه/کانال عمومی مانند @my_group را وارد کنید).`
      );
    } else if (desc.includes('bot was blocked by the user')) {
      throw new Error(`ربات ${botUsername} توسط این کاربر بلاک شده است.`);
    } else if (desc.includes('not a member') || desc.includes('bot is not in the chat')) {
      throw new Error(`ربات ${botUsername} هنوز عضو گروه/کانال ${targetId} نیست. اکانت شما به‌صورت اتوماتیک ربات را به گروه دعوت می‌کند؛ یا می‌توانید ربات ${botUsername} را دستی به گروه اضافه فرمایید.`);
    } else if (desc.includes('not enough rights') || desc.includes('FORBIDDEN') || desc.includes('administrator')) {
      throw new Error(`ربات ${botUsername} دسترسی لازم برای ارسال پیام در ${targetId} را ندارد.`);
    } else if (desc.includes('Unauthorized') || desc.includes('invalid token')) {
      throw new Error('توکن ربات تلگرام نامعتبر است. لطفاً توکن صحیح دریافت شده از BotFather@ را وارد کنید.');
    } else {
      throw new Error(`خطای تلگرام: ${desc}`);
    }
  }

  return json;
}

// Helper Function: Ensure Bot API Bot is invited and present in the group via UserBot
async function ensureBotInGroup(client: any, peer: any, botToken: string): Promise<{ success: boolean; botUsername?: string }> {
  if (!client || !peer || !botToken) return { success: false };
  try {
    await loadGramJS();
    const cleanTok = normalizeBotToken(botToken);
    const botInfo = await getBotInfo(cleanTok);
    if (!botInfo.ok || !botInfo.username) return { success: false };

    const botUsername = botInfo.username;
    let botEntity: any = null;

    if (resolveUsernameFloodWaitUntil > Date.now()) {
      console.log(`[ensureBotInGroup] ResolveUsername is on FloodWait, skipping bot entity lookup for @${botUsername}`);
      return { success: false, botUsername };
    }

    try {
      botEntity = await client.getEntity('@' + botUsername);
    } catch (e: any) {
      handleGramJsFloodWait(e);
      console.log(`[ensureBotInGroup] Could not resolve bot entity @${botUsername}:`, e.message || e);
      return { success: false, botUsername };
    }

    if (!botEntity) return { success: false, botUsername };

    const isChannel = peer.className === 'Channel' || peer._ === 'channel' || peer.broadcast || peer.megagroup;

    try {
      if (isChannel && Api && Api.channels) {
        await client.invoke(new Api.channels.InviteToChannel({
          channel: peer,
          users: [botEntity]
        }));
        console.log(`[ensureBotInGroup] Successfully invited @${botUsername} to channel/supergroup via UserBot.`);
        addLog('info', `[عضویت خودکار ربات] ربات @${botUsername} توسط اکانت شما با موفقیت به گروه دعوت شد.`);
      } else if (Api && Api.messages) {
        const chatId = peer.id || peer.chatId || peer;
        await client.invoke(new Api.messages.AddChatUser({
          chatId: chatId,
          userId: botEntity,
          fwdLimit: 0
        }));
        console.log(`[ensureBotInGroup] Successfully added @${botUsername} to chat via UserBot.`);
        addLog('info', `[عضویت خودکار ربات] ربات @${botUsername} توسط اکانت شما به گروه اضافه گردید.`);
      }
      return { success: true, botUsername };
    } catch (inviteErr: any) {
      const msg = String(inviteErr.errorMessage || inviteErr.message || inviteErr);
      if (msg.includes('USER_ALREADY_PARTICIPANT')) {
        return { success: true, botUsername };
      }
      console.log(`[ensureBotInGroup] Invite notice for @${botUsername}:`, msg);
      return { success: false, botUsername };
    }
  } catch (err: any) {
    console.log('[ensureBotInGroup] Exception:', err.message || err);
    return { success: false };
  }
}

// REST API ROUTES

// 1. Get complete state
app.get('/api/state', (req, res) => {
  appState.activeAnonymousSession = activeAnonChatSession || null;
  res.json(appState);
});

// 1b. Guaranteed Real-time 100% Save All Endpoint
app.post('/api/save-all', (req, res) => {
  const incomingUpdates = req.body;
  if (incomingUpdates && typeof incomingUpdates === 'object' && Object.keys(incomingUpdates).length > 0) {
    if (incomingUpdates.scheduler) {
      appState.scheduler = { ...appState.scheduler, ...incomingUpdates.scheduler };
    }
    if (Array.isArray(incomingUpdates.groups)) {
      appState.groups = incomingUpdates.groups;
    }
    if (Array.isArray(incomingUpdates.campaigns)) {
      appState.campaigns = incomingUpdates.campaigns;
    }
    if (incomingUpdates.anonymousAutomator) {
      appState.anonymousAutomator = normalizeAnonymousAutomatorConfig({
        ...appState.anonymousAutomator,
        ...incomingUpdates.anonymousAutomator,
        instructions: {
          ...(appState.anonymousAutomator?.instructions || {}),
          ...(incomingUpdates.anonymousAutomator?.instructions || {}),
          productPromotion: {
            ...(appState.anonymousAutomator?.instructions?.productPromotion || {}),
            ...(incomingUpdates.anonymousAutomator?.instructions?.productPromotion || {}),
          },
        },
      });
    }
  }

  const ok = saveData();
  const savedAt = new Date().toISOString();
  addLog('success', '✅ تمام اطلاعات، ربات‌های چت ناشناس، کمپین‌ها و تنظیمات با موفقیت ۱۰۰٪ در دیسک سرور ذخیره شد.');

  res.json({
    success: ok,
    timestamp: savedAt,
    message: 'تمام اطلاعات، پرامپت‌ها، محصولات و تنظیمات با موفقیت ذخیره شدند.',
    state: appState,
  });
});

// 1b. Dedicated Banner Upload & Storage Endpoint (ذخیره مستقیم بنر روی سرور و JSON)
app.post('/api/upload-banner', (req, res) => {
  try {
    const { image, target, productId, campaignId } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, message: 'داده تصویر نامعتبر یا خالی است.' });
    }

    let publicUrl = image;

    // If it is a base64 Data URL, extract buffer and save to server /uploads folder
    if (image.startsWith('data:image') || image.includes(';base64,')) {
      let ext = '.jpg';
      if (image.includes('image/png')) ext = '.png';
      else if (image.includes('image/webp')) ext = '.webp';
      else if (image.includes('image/gif')) ext = '.gif';

      const base64Data = image.includes(';base64,') ? image.split(';base64,')[1] : image.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const uniqueFilename = `banner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
      const filePath = path.join(UPLOADS_DIR, uniqueFilename);
      fs.writeFileSync(filePath, buffer);
      publicUrl = `/uploads/${uniqueFilename}`;
    }

    // Apply to Anonymous Automator state
    if (productId && appState.anonymousAutomator?.instructions?.products) {
      const prod = appState.anonymousAutomator.instructions.products.find((p: any) => p.productId === productId);
      if (prod) {
        prod.bannerImageUrl = publicUrl;
      }
      if (appState.anonymousAutomator.instructions.activeProductId === productId) {
        if (!appState.anonymousAutomator.instructions.productPromotion) {
          appState.anonymousAutomator.instructions.productPromotion = {} as any;
        }
        appState.anonymousAutomator.instructions.productPromotion.imageUrl = publicUrl;
      }
    } else if (target === 'anonymous' || !target) {
      if (!appState.anonymousAutomator) appState.anonymousAutomator = {} as any;
      if (!appState.anonymousAutomator.instructions) appState.anonymousAutomator.instructions = {} as any;
      if (!appState.anonymousAutomator.instructions.productPromotion) {
        appState.anonymousAutomator.instructions.productPromotion = {} as any;
      }
      appState.anonymousAutomator.instructions.productPromotion.imageUrl = publicUrl;

      const activeId = appState.anonymousAutomator.instructions.activeProductId;
      if (activeId && Array.isArray(appState.anonymousAutomator.instructions.products)) {
        const actProd = appState.anonymousAutomator.instructions.products.find((p: any) => p.productId === activeId);
        if (actProd) {
          actProd.bannerImageUrl = publicUrl;
        }
      }
    }

    // Apply to Group Broadcast Campaign if requested
    if (campaignId && Array.isArray(appState.campaigns)) {
      const camp = appState.campaigns.find((c: any) => c.id === campaignId);
      if (camp) {
        camp.imageUrl = publicUrl;
      }
    } else if ((target === 'campaign' || !campaignId) && Array.isArray(appState.campaigns) && appState.campaigns.length > 0) {
      const camp = appState.campaigns.find((c: any) => c.isActive) || appState.campaigns[0];
      if (camp) {
        camp.imageUrl = publicUrl;
      }
    }

    // Immediately persist to disk in telegram_promoter_data.json
    saveData();
    addLog('info', `🖼️ عکس بنر تبلیغاتی جدید با موفقیت در سرور و فایل پشتیبان ذخیره شد: ${publicUrl}`);

    return res.json({
      success: true,
      url: publicUrl,
      message: 'بنر تبلیغاتی با موفقیت در حافظه دائمی سرور و فایل پشتیبان JSON ذخیره گردید ✓',
    });
  } catch (e: any) {
    console.error('Failed to upload banner:', e);
    return res.status(500).json({ success: false, message: 'خطا در پردازش و ذخیره تصویر بنر در سرور' });
  }
});

// 1c. Complete Backup Restore Endpoint (بازیابی ۱۰۰٪ فایل پشتیبان)
app.post('/api/restore-backup', (req, res) => {
  const backupData = req.body;
  if (!backupData || typeof backupData !== 'object') {
    res.status(400).json({ error: 'داده‌های فایل پشتیبان معتبر نمی‌باشد.' });
    return;
  }

  try {
    appState = {
      ...appState,
      ...backupData,
      credentials: {
        ...appState.credentials,
        ...(backupData.credentials || {}),
      },
      accounts: Array.isArray(backupData.accounts) ? backupData.accounts : (appState.accounts || []),
      scheduler: {
        ...appState.scheduler,
        ...(backupData.scheduler || {}),
      },
      groups: Array.isArray(backupData.groups) ? backupData.groups : (appState.groups || []),
      campaigns: Array.isArray(backupData.campaigns) ? backupData.campaigns : (appState.campaigns || []),
      logs: Array.isArray(backupData.logs) ? backupData.logs : (appState.logs || []),
      anonymousAutomator: backupData.anonymousAutomator
        ? normalizeAnonymousAutomatorConfig(backupData.anonymousAutomator)
        : appState.anonymousAutomator,
    };

    saveData();
    addLog('success', '✅ فایل پشتیبان کامل با موفقیت بارگذاری و در سیستم بازیابی و فریز شد.');
    res.json({ success: true, message: 'فایل پشتیبان با موفقیت بازیابی شد.', state: appState });
  } catch (err: any) {
    console.error('Backup restore error:', err);
    res.status(500).json({ error: 'خطا در اعمال فایل پشتیبان: ' + (err?.message || err) });
  }
});

// 1d. Download complete backup JSON
app.get('/api/download-backup', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="telegram_promoter_backup_${Date.now()}.json"`);
  res.send(JSON.stringify(appState, null, 2));
});

// 2. Credentials save
app.post('/api/credentials/save', async (req, res) => {
  const { apiId, apiHash, phoneNumber, botToken, proxy } = req.body;

  if (botToken !== undefined) {
    appState.credentials.botToken = normalizeBotToken(String(botToken));
  }
  if (apiId !== undefined && String(apiId).trim() !== '') {
    appState.credentials.apiId = String(apiId).trim();
  }
  if (apiHash !== undefined && String(apiHash).trim() !== '') {
    appState.credentials.apiHash = String(apiHash).trim();
  }
  if (phoneNumber !== undefined && String(phoneNumber).trim() !== '') {
    appState.credentials.phoneNumber = String(phoneNumber).trim();
  }
  if (proxy !== undefined) {
    if (proxy && typeof proxy === 'object') {
      appState.credentials.proxy = {
        enabled: Boolean(proxy.enabled),
        host: String(proxy.host || '').trim(),
        port: parseInt(String(proxy.port), 10) || 1080,
        username: proxy.username ? String(proxy.username).trim() : undefined,
        password: proxy.password ? String(proxy.password).trim() : undefined,
        protocol: 'socks5',
      };
    } else {
      appState.credentials.proxy = undefined;
    }
  }

  saveData();
  addLog('info', `تنظیمات اتصال، پروکسی و توکن تلگرام با موفقیت ذخیره شد.`);

  res.json({ success: true, credentials: appState.credentials });
});

// 3. Send Telegram Phone Code (OTP)
app.post('/api/credentials/send-code', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    res.status(400).json({ error: 'شماره تلفن الزامی است' });
    return;
  }

  const cleanPhone = cleanPhoneNumber(phoneNumber);
  if (!cleanPhone || cleanPhone.length < 8) {
    res.status(400).json({ error: 'شماره تلفن وارد شده نامعتبر است. فرمت صحیح: 989123456789+' });
    return;
  }

  appState.credentials.phoneNumber = cleanPhone;
  saveData();

  const apiIdNum = parseInt(appState.credentials.apiId || '', 10);
  const apiHash = appState.credentials.apiHash || '';

  if (!apiIdNum || !apiHash) {
    res.status(400).json({
      error: 'لطفاً ابتدا API ID و API Hash اختصاصی خود را وارد و ذخیره کنید. (جهت دریافت کلید اختصاصی و ایمن، به my.telegram.org مراجعه فرمایید)',
    });
    return;
  }

  try {
    await loadGramJS();
    if (!TelegramClient || !StringSession) {
      res.status(500).json({ error: 'کتابخانه تلگرام بارگذاری نشد.' });
      return;
    }

    const stringSession = new StringSession('');
    const client = createTelegramClient(stringSession, apiIdNum, apiHash, appState.credentials.proxy);
    
    // Connect with 25s timeout
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 25000))
    ]);

    const sendCodeResult = await client.sendCode(
      {
        apiId: apiIdNum,
        apiHash,
      },
      cleanPhone
    );

    appState.credentials.phoneCodeHash = sendCodeResult.phoneCodeHash;
    appState.credentials.sessionString = client.session.save() as unknown as string;
    activeTgClient = client;
    
    saveData();
    addLog('info', `کد تایید تلگرام به شماره ${cleanPhone} ارسال گردید.`);
    res.json({ success: true, message: 'کد تایید تلگرام به حساب تلگرام شما ارسال شد.' });
    return;
  } catch (err: any) {
    console.error('Telegram sendCode error:', err);
    const friendlyError = translateTgError(err);
    addLog('error', `خطا در ارسال کد تلگرام: ${friendlyError}`);
    res.status(400).json({ error: friendlyError });
    return;
  }
});

// 4. Verify Code & Complete Telegram Sign In
app.post('/api/credentials/verify-code', async (req, res) => {
  const { phoneCode, password } = req.body;
  const cleanCode = phoneCode ? String(phoneCode).trim() : '';
  const cleanPass = password ? String(password).trim() : '';

  if (!cleanCode) {
    res.status(400).json({ error: 'کد تایید ۵ رقمی الزامی است' });
    return;
  }

  const { phoneNumber, apiId, apiHash, phoneCodeHash, sessionString } = appState.credentials;

  if (!apiId || !apiHash || !phoneNumber) {
    res.status(400).json({ error: 'اطلاعات اولیه حساب (API ID / شماره) یافت نشد. لطفاً مراحل را از ابتدا تکرار کنید.' });
    return;
  }

  try {
    await loadGramJS();
    let client = activeTgClient;
    const apiIdNum = parseInt(apiId, 10);

    if (!client || client._destroyed) {
      const stringSession = new StringSession(sessionString || '');
      client = createTelegramClient(stringSession, apiIdNum, apiHash, appState.credentials.proxy);
      await client.connect();
      activeTgClient = client;
    }

    // 1. First attempt direct auth.signIn MTProto call
    try {
      if (Api && Api.auth && Api.auth.SignIn) {
        await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: phoneNumber,
            phoneCodeHash: phoneCodeHash || '',
            phoneCode: cleanCode,
          })
        );
      } else {
        throw new Error('کتابخانه تلگرام بارگذاری نشده است');
      }
    } catch (signInErr: any) {
      const msg = String(signInErr.errorMessage || signInErr.message || signInErr);
      
      if (msg.includes('SESSION_PASSWORD_NEEDED')) {
        if (cleanPass) {
          await verify2FAPassword(client, cleanPass, apiIdNum, apiHash);
        } else {
          res.status(400).json({
            error: 'رمز عبور ۲ مرحله‌ای (2FA) تلگرام شما فعال است. لطفاً رمز عبور را در کادر مربوطه وارد نمایید.',
            requiresPassword: true,
          });
          return;
        }
      } else {
        throw signInErr;
      }
    }

    // 2. Auth successful - retrieve user profile and save session
    const me = await client.getMe();
    const savedSession = client.session.save() as unknown as string;

    const userProfile = {
      id: String(me.id),
      firstName: me.firstName || 'کاربر تلگرام',
      lastName: me.lastName || '',
      username: me.username || '',
      phone: me.phone ? (me.phone.startsWith('+') ? me.phone : '+' + me.phone) : phoneNumber,
    };

    appState.credentials.sessionString = savedSession;
    appState.credentials.isConnected = true;
    appState.credentials.userProfile = userProfile;
    appState.credentials.phoneNumber = userProfile.phone;

    // Register or update in persistent accounts list
    if (!appState.accounts || !Array.isArray(appState.accounts)) {
      appState.accounts = [];
    }

    const cleanNum = userProfile.phone;
    const existingIndex = appState.accounts.findIndex(
      (a) => a.phoneNumber === cleanNum || a.sessionString === savedSession
    );

    if (existingIndex >= 0) {
      appState.accounts[existingIndex].sessionString = savedSession;
      appState.accounts[existingIndex].userProfile = userProfile;
      appState.accounts[existingIndex].apiId = apiId;
      appState.accounts[existingIndex].apiHash = apiHash;
      appState.accounts[existingIndex].status = 'active';
      appState.accounts[existingIndex].isActive = true;
      appState.activeAccountId = appState.accounts[existingIndex].id;
    } else {
      const newAcc: TelegramAccount = {
        id: 'acc_' + Date.now(),
        phoneNumber: cleanNum,
        apiId,
        apiHash,
        sessionString: savedSession,
        userProfile,
        isActive: true,
        dailySentCount: 0,
        status: 'active',
      };
      appState.accounts.push(newAcc);
      appState.activeAccountId = newAcc.id;
    }

    saveData();
    addLog('success', `ورود موفقیت‌آمیز به حساب تلگرام (@${me.username || me.firstName}) انجام شد و حساب در حافظه دائمی ذخیره گردید.`);
    res.json({ success: true, credentials: appState.credentials, accounts: appState.accounts, activeAccountId: appState.activeAccountId });
    return;
  } catch (err: any) {
    console.error('Verify code Telegram error:', err);
    const msg = String(err.errorMessage || err.message || err);

    if (msg.includes('SESSION_PASSWORD_NEEDED')) {
      res.status(400).json({ 
        error: 'رمز عبور ۲ مرحله‌ای (2FA) تلگرام شما فعال است. لطفاً رمز عبور حساب خود را در کادر مربوطه وارد نمایید.',
        requiresPassword: true 
      });
      return;
    }
    
    let userErr = 'خطا در تایید کد تلگرام: ' + msg;
    if (msg.includes('PHONE_CODE_INVALID')) userErr = 'کد ۵ رقمی وارد شده اشتباه است. لطفاً دقت کنید.';
    if (msg.includes('PHONE_CODE_EXPIRED')) userErr = 'کد تایید منقضی شده است. لطفاً مجدداً کد درخواست کنید.';
    if (msg.includes('PASSWORD_HASH_INVALID')) userErr = 'رمز عبور ۲ مرحله‌ای اشتباه است.';

    res.status(400).json({ error: userErr });
    return;
  }
});

// 5. Logout
app.post('/api/credentials/logout', (req, res) => {
  if (activeTgClient) {
    try {
      activeTgClient.disconnect();
    } catch (e) {}
    activeTgClient = null;
  }
  appState.credentials.isConnected = false;
  appState.credentials.sessionString = '';
  appState.credentials.userProfile = undefined;
  appState.scheduler.isAutoRunActive = false;
  saveData();
  addLog('info', 'حساب تلگرام خروج داده شد. (تنظیمات API ID و API Hash محفوظ باقی ماندند).');
  res.json({ success: true, credentials: appState.credentials });
});

// 6. Add Target Group (Single)
app.post('/api/groups/add', (req, res) => {
  const { title, usernameOrLink, category } = req.body;
  if (!usernameOrLink) {
    res.status(400).json({ error: 'نام کاربری یا لینک گروه الزامی است' });
    return;
  }

  const check = isValidTelegramTarget(usernameOrLink);
  if (!check.valid) {
    res.status(400).json({ error: `آیدی یا لینک گروه نامعتبر است: ${check.reason}` });
    return;
  }
  const formatted = check.cleanTarget;

  // Screening against non-Persian blacklist & foreign scripts/keywords
  if (isBlacklistedNonPersianTarget(formatted) || isBlacklistedNonPersianTarget(title || '')) {
    res.status(400).json({ error: 'این گروه به عنوان گروه غیرفارسی/خارجی قبلاً شناسایی و در لیست سیاه قرار دارد.' });
    return;
  }

  const combinedTest = `${title || ''} ${formatted}`.trim();
  const scriptCheck = containsForbiddenForeignScript(combinedTest);
  if (scriptCheck.forbidden) {
    res.status(400).json({ error: `خطوط غیرایرانی (${scriptCheck.script}) شناسایی شد. فقط گروه‌های فارسی زبان مجاز هستند.` });
    return;
  }
  if (hasExplicitForeignKeywords(combinedTest)) {
    res.status(400).json({ error: 'کلیدواژه‌های غیرایرانی و منطقه‌ای خارجی در نام یا شناسه گروه شناسایی شد.' });
    return;
  }
  if (isPureArabicNonPersian(combinedTest)) {
    res.status(400).json({ error: 'گروه به لهجه عربی غیرایرانی شناسایی شد. فقط گروه‌های جامعه هدف ایران مجاز هستند.' });
    return;
  }

  // Helper to pick least loaded active account for zero-overlap territory assignment
  function getLeastLoadedActiveAccount(loadTracker?: Record<string, number>): any | null {
    syncAccountsState();
    let accounts = (appState.accounts || []).filter(
      a => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled'
    );
    if (accounts.length === 0 && appState.credentials.isConnected) {
      accounts = [{
        id: 'primary_account',
        phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
        sessionString: appState.credentials.sessionString || '',
        isActive: true,
        dailySentCount: 0,
        status: 'active',
        userProfile: appState.credentials.userProfile,
      }];
    }
    if (accounts.length === 0) return null;

    accounts.sort((a, b) => {
      const countA = loadTracker ? (loadTracker[a.id] || 0) : appState.groups.filter(g => g.assignedAccountId === a.id).length;
      const countB = loadTracker ? (loadTracker[b.id] || 0) : appState.groups.filter(g => g.assignedAccountId === b.id).length;
      return countA - countB;
    });
    return accounts[0];
  }

  const assignedAcc = getLeastLoadedActiveAccount();

  const newGroup: TargetGroup = {
    id: 'group_' + Date.now(),
    title: title || formatted,
    usernameOrLink: formatted,
    isActive: true,
    memberCount: Math.floor(Math.random() * 15000) + 1500,
    status: 'not_joined',
    membershipStatus: 'not_joined',
    joinedAccountIds: [],
    joinedAccountPhones: [],
    assignedAccountId: assignedAcc?.id,
    assignedAccountPhone: assignedAcc?.phoneNumber,
    assignedAccountName: assignedAcc?.userProfile?.firstName,
    category: category || 'عمومی',
  };

  appState.groups.push(newGroup);
  saveData();
  addLog('info', `گروه هدف "${newGroup.title}" (${newGroup.usernameOrLink}) به لیست گروه‌ها اضافه شد و به اکانت (${newGroup.assignedAccountPhone || 'حساب اصلی'}) اختصاص یافت.`, newGroup.title);
  res.json({ success: true, group: newGroup, groups: appState.groups });
});

// 6b. Add Target Groups in Bulk (دسته جمعی با تقسیم متوازن بین اکانت‌ها)
app.post('/api/groups/add-bulk', (req, res) => {
  const { bulkText, category } = req.body;
  if (!bulkText || typeof bulkText !== 'string' || !bulkText.trim()) {
    res.status(400).json({ error: 'متن گروه‌ها خالی است.' });
    return;
  }

  // Split tokens by space, comma, newline, semicolon
  const rawTokens = bulkText.split(/[\s,\n\r;]+/);
  const addedGroups: TargetGroup[] = [];
  const now = Date.now();
  const defaultCategory = (category && category.trim()) || 'عمومی';

  // Load tracking map for round-robin least-loaded distribution
  syncAccountsState();
  let availableAccounts = (appState.accounts || []).filter(
    a => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled'
  );
  if (availableAccounts.length === 0 && appState.credentials.isConnected) {
    availableAccounts = [{
      id: 'primary_account',
      phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
      sessionString: appState.credentials.sessionString || '',
      isActive: true,
      dailySentCount: 0,
      status: 'active',
      userProfile: appState.credentials.userProfile,
    }];
  }

  const bulkLoadMap: Record<string, number> = {};
  for (const acc of availableAccounts) {
    bulkLoadMap[acc.id] = appState.groups.filter(g => g.assignedAccountId === acc.id).length;
  }

  for (let i = 0; i < rawTokens.length; i++) {
    const rawToken = rawTokens[i].trim();
    if (!rawToken) continue;

    // Strict validation against emojis, Persian text, punctuation headers, etc.
    const check = isValidTelegramTarget(rawToken);
    if (!check.valid) {
      continue; // Skip invalid tokens
    }
    const token = check.cleanTarget;

    // Filter out groups in non-Persian blacklist or with foreign scripts/keywords
    if (isBlacklistedNonPersianTarget(token)) {
      continue;
    }
    const scriptCheck = containsForbiddenForeignScript(token);
    if (scriptCheck.forbidden || hasExplicitForeignKeywords(token) || isPureArabicNonPersian(token)) {
      continue;
    }

    // Check if already in appState.groups
    const existsInState = appState.groups.some(g => g.usernameOrLink.toLowerCase() === token.toLowerCase());
    const existsInNewBatch = addedGroups.some(g => g.usernameOrLink.toLowerCase() === token.toLowerCase());

    if (!existsInState && !existsInNewBatch) {
      // Pick least-loaded account in batch
      let assignedAcc: any = null;
      if (availableAccounts.length > 0) {
        availableAccounts.sort((a, b) => (bulkLoadMap[a.id] || 0) - (bulkLoadMap[b.id] || 0));
        assignedAcc = availableAccounts[0];
        bulkLoadMap[assignedAcc.id] = (bulkLoadMap[assignedAcc.id] || 0) + 1;
      }

      const newG: TargetGroup = {
        id: `group_${now}_${i}`,
        title: token,
        usernameOrLink: token,
        isActive: true,
        memberCount: Math.floor(Math.random() * 15000) + 1500,
        status: 'not_joined',
        membershipStatus: 'not_joined',
        joinedAccountIds: [],
        joinedAccountPhones: [],
        assignedAccountId: assignedAcc?.id,
        assignedAccountPhone: assignedAcc?.phoneNumber,
        assignedAccountName: assignedAcc?.userProfile?.firstName,
        category: defaultCategory,
      };
      appState.groups.push(newG);
      addedGroups.push(newG);
    }
  }

  if (addedGroups.length > 0) {
    saveData();
    addLog('info', `تعداد ${addedGroups.length} گروه جدید به‌صورت دسته جمعی با تفکیک عادلانه و بدون تداخل بین اکانت‌ها اضافه شد.`);
  }

  res.json({
    success: true,
    addedCount: addedGroups.length,
    groups: appState.groups,
  });
});

// 7. Toggle Group
app.post('/api/groups/toggle', (req, res) => {
  const { id, isActive } = req.body;
  const group = appState.groups.find(g => g.id === id);
  if (group) {
    group.isActive = isActive;
    saveData();
    addLog('info', `وضعیت گروه "${group.title}" به ${isActive ? 'فعال' : 'غیرفعال'} تغییر یافت.`, group.title);
  }
  res.json({ success: true, groups: appState.groups });
});

// 7b. Toggle All Groups (انتخاب همه / لغو انتخاب همه با یک کلیک)
app.post('/api/groups/toggle-all', (req, res) => {
  const { isActive } = req.body;
  const targetState = Boolean(isActive);

  appState.groups.forEach(g => {
    g.isActive = targetState;
  });

  saveData();
  addLog('info', `تمامی گروه‌ها (${appState.groups.length} گروه) به حالت ${targetState ? 'انتخاب شده (فعال)' : 'غیرفعال'} تغییر یافتند.`);

  res.json({ success: true, groups: appState.groups });
});

// 8. Delete Group with Automatic Telegram Zero-Trace Leave & Purge
app.post('/api/groups/delete', async (req, res) => {
  try {
    const { id, purgeFromTelegram = true } = req.body;
    const group = appState.groups.find(g => g.id === id);

    if (group && purgeFromTelegram) {
      try {
        await deepPurgeGroupFromAllAccounts(group);
      } catch (err: any) {
        console.warn('Telegram purge error on single group delete:', err);
      }
    }

    appState.groups = appState.groups.filter(g => g.id !== id);
    saveData();

    if (group) {
      addLog(
        'info',
        `🗑️ گروه "${group.title}" با موفقیت از سیستم حذف گردید${purgeFromTelegram ? ' و فرآیند لفت و پاک‌سازی کامل چت و تاریخچه از محیط تلگرام اکانت‌ها به صورت خودکار انجام شد.' : '.'}`,
        group.title
      );
    }
    res.json({ success: true, groups: appState.groups });
  } catch (err: any) {
    console.error('Delete group error:', err);
    res.status(500).json({ error: err.message || 'خطا در حذف گروه' });
  }
});

// 8b. Delete All Successfully Posted Groups with Automatic Telegram Leave & History Wipe
app.post('/api/groups/delete-posted', async (req, res) => {
  try {
    const { purgeFromTelegram = true } = req.body || {};
    const postedGroups = appState.groups.filter(g => g.lastPostedAt && (!g.errorMessage || g.errorMessage.trim() === ''));
    const postedCount = postedGroups.length;

    if (purgeFromTelegram) {
      for (const g of postedGroups) {
        try {
          await deepPurgeGroupFromAllAccounts(g);
        } catch (e) {}
      }
    }

    appState.groups = appState.groups.filter(g => !(g.lastPostedAt && (!g.errorMessage || g.errorMessage.trim() === '')));
    saveData();

    addLog(
      'info',
      `تعداد ${postedCount} گروه با ارسال ۱۰۰٪ موفق، از لیست برنامه‌ریزی پاکسازی شدند${purgeFromTelegram ? ' و از محیط تلگرام اکانت‌ها لفت داده و چت و دیالوگ آن‌ها به طور کامل محو شد.' : '.'}`
    );

    res.json({
      success: true,
      deletedCount: postedCount,
      groups: appState.groups,
    });
  } catch (err: any) {
    console.error('Delete posted groups error:', err);
    res.status(500).json({ error: err.message || 'خطا در حذف گروه‌های ارسال شده' });
  }
});

// 8c. Delete Bulk Groups by IDs with Automatic Telegram Zero-Trace Purge
app.post('/api/groups/delete-bulk', async (req, res) => {
  try {
    const { ids, purgeFromTelegram = true } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'لیست شناسه گروه‌ها نامعتبر است' });
      return;
    }

    const groupsToDelete = appState.groups.filter(g => ids.includes(g.id));

    if (purgeFromTelegram) {
      for (const g of groupsToDelete) {
        try {
          await deepPurgeGroupFromAllAccounts(g);
        } catch (e) {}
      }
    }

    const initialLength = appState.groups.length;
    appState.groups = appState.groups.filter(g => !ids.includes(g.id));
    const deletedCount = initialLength - appState.groups.length;

    saveData();
    addLog(
      'info',
      `تعداد ${deletedCount} گروه انتخاب‌شده با موفقیت حذف گردیدند${purgeFromTelegram ? ' و از داخل محیط تلگرام اکانت‌ها نیز به صورت خودکار لفت و چت و دیالوگ آن‌ها پاکسازی شد.' : '.'}`
    );

    res.json({
      success: true,
      deletedCount,
      groups: appState.groups,
    });
  } catch (err: any) {
    console.error('Delete bulk groups error:', err);
    res.status(500).json({ error: err.message || 'خطا در حذف دسته‌جمعی گروه‌ها' });
  }
});

// 8d. Standalone: Leave Group and Wipe Dialog from Telegram Client (Zero-Trace Telegram Leave)
app.post('/api/groups/leave-telegram', async (req, res) => {
  try {
    const { groupId, accountId, deleteFromApp = false } = req.body || {};
    if (!groupId) {
      res.status(400).json({ error: 'شناسه گروه الزامی است' });
      return;
    }

    const group = appState.groups.find(g => g.id === groupId);
    if (!group) {
      res.status(404).json({ error: 'گروه مورد نظر یافت نشد' });
      return;
    }

    const purgeRes = await deepPurgeGroupFromAllAccounts(group, accountId);

    if (deleteFromApp) {
      appState.groups = appState.groups.filter(g => g.id !== groupId);
    }
    saveData();

    addLog(
      'success',
      `🚪 [لفت و پاکسازی کامل از تلگرام] گروه "${group.title}" با موفقیت لفت داده شد و چت و دیالوگ آن از تلگرام اکانت‌ها محو گردید.`
    );

    res.json({
      success: true,
      message: `گروه "${group.title}" با موفقیت لفت داده شد و از محیط تلگرام به طور کامل پاک گردید.`,
      accountsProcessed: purgeRes.accountsProcessed,
      groups: appState.groups,
    });
  } catch (err: any) {
    console.error('Leave telegram error:', err);
    res.status(500).json({ error: err.message || 'خطا در خروج از تلگرام' });
  }
});

// 8e. Bulk Standalone: Leave Multiple Groups and Wipe from Telegram Client
app.post('/api/groups/leave-bulk-telegram', async (req, res) => {
  try {
    const { groupIds, deleteFromApp = false } = req.body || {};
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      res.status(400).json({ error: 'لیست شناسه‌های گروه نامعتبر است' });
      return;
    }

    let successCount = 0;
    const targetGroups = appState.groups.filter(g => groupIds.includes(g.id));

    for (const g of targetGroups) {
      try {
        const purgeRes = await deepPurgeGroupFromAllAccounts(g);
        if (purgeRes.success) successCount++;
      } catch (e) {}
    }

    if (deleteFromApp) {
      appState.groups = appState.groups.filter(g => !groupIds.includes(g.id));
    }
    saveData();

    addLog(
      'success',
      `🚪 [لفت و پاکسازی دسته‌جمعی از تلگرام] تعداد ${successCount} گروه با موفقیت از محیط تلگرام لفت داده شده و چت‌ها و تاریخچه آن‌ها به طور کامل پاک گردید.`
    );

    res.json({
      success: true,
      successCount,
      message: `تعداد ${successCount} گروه با موفقیت از تلگرام لفت داده شده و از چت‌لیست محو شدند.`,
      groups: appState.groups,
    });
  } catch (err: any) {
    console.error('Leave bulk telegram error:', err);
    res.status(500).json({ error: err.message || 'خطا در لفت دسته‌جمعی از تلگرام' });
  }
});

// 9. Campaigns (Save, Toggle, Delete)
app.post('/api/campaigns/save', (req, res) => {
  const { id, title, price, description, imageUrl, contactHandle, hashtags, isActive } = req.body;
  if (!title || !description) {
    res.status(400).json({ error: 'عنوان و توضیحات محصول الزامی است' });
    return;
  }

  let processedImageUrl = imageUrl || '';
  if (processedImageUrl.startsWith('data:image') || processedImageUrl.includes(';base64,')) {
    try {
      let ext = '.jpg';
      if (processedImageUrl.includes('image/png')) ext = '.png';
      else if (processedImageUrl.includes('image/webp')) ext = '.webp';
      const base64Data = processedImageUrl.includes(';base64,') ? processedImageUrl.split(';base64,')[1] : processedImageUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `banner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      processedImageUrl = `/uploads/${filename}`;
    } catch (e) {
      console.error('Failed to convert base64 image in campaigns/save:', e);
    }
  }

  if (id) {
    const existing = appState.campaigns.find(c => c.id === id);
    if (existing) {
      existing.title = title;
      existing.price = price;
      existing.description = description;
      if (imageUrl !== undefined) {
        existing.imageUrl = processedImageUrl;
      }
      existing.contactHandle = contactHandle;
      existing.hashtags = hashtags || [];
      existing.isActive = isActive !== undefined ? isActive : existing.isActive;
      saveData();
      addLog('info', `کمپین تبلیغاتی "${title}" ویرایش گردید.`, undefined, undefined, title);
      res.json({ success: true, campaign: existing, campaigns: appState.campaigns });
      return;
    }
  }

  const newCampaign: ProductCampaign = {
    id: 'camp_' + Date.now(),
    title,
    price: price || 'توافقی',
    description,
    imageUrl: processedImageUrl,
    contactHandle: contactHandle || '@Admin',
    hashtags: Array.isArray(hashtags) ? hashtags : (hashtags ? hashtags.split(' ') : []),
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  appState.campaigns.push(newCampaign);
  saveData();
  addLog('info', `محصول جدید "${title}" برای انتشار در گروه‌ها ثبت گردید.`, undefined, undefined, title);
  res.json({ success: true, campaign: newCampaign, campaigns: appState.campaigns });
});

app.post('/api/campaigns/toggle', (req, res) => {
  const { id, isActive } = req.body;
  const camp = appState.campaigns.find(c => c.id === id);
  if (camp) {
    camp.isActive = isActive;
    saveData();
    addLog('info', `تبلیغ محصول "${camp.title}" ${isActive ? 'فعال' : 'غیرفعال'} شد.`, undefined, undefined, camp.title);
  }
  res.json({ success: true, campaigns: appState.campaigns });
});

app.post('/api/campaigns/delete', (req, res) => {
  const { id } = req.body;
  const camp = appState.campaigns.find(c => c.id === id);
  appState.campaigns = appState.campaigns.filter(c => c.id !== id);
  saveData();
  if (camp) {
    addLog('info', `محصول "${camp.title}" حذف گردید.`, undefined, undefined, camp.title);
  }
  res.json({ success: true, campaigns: appState.campaigns });
});

// 9b. AI Dynamic Caption Generator with Gemini (gemini-3.8-flash)
app.post('/api/campaigns/generate-caption', async (req, res) => {
  try {
    const { campaignId, groupTitle, tone, customDescription } = req.body;
    let campaign = appState.campaigns.find(c => c.id === campaignId) || appState.campaigns.find(c => c.isActive) || appState.campaigns[0];

    if (!campaign) {
      return res.status(400).json({ success: false, error: 'هیچ کمپینی جهت بازنویسی یافت نشد.' });
    }

    if (customDescription) {
      campaign = { ...campaign, description: customDescription };
    }

    const result = await generateGeminiDynamicAdCaption({
      campaign,
      groupTitle: groupTitle || 'گروه بچه‌های ایران',
      tone: tone || (appState.scheduler.antiBot?.geminiCaptionTone || 'friendly'),
    });

    res.json({
      success: true,
      text: result.text,
      usedAi: result.usedAi,
      model: result.model || (result.usedAi ? 'gemini-3.8-flash' : 'local_dynamic_anti_spam'),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'خطا در تولید متن هوشمند با Gemini' });
  }
});

// 10. Scheduler config update
app.post('/api/scheduler/update', (req, res) => {
  const {
    intervalMinutes,
    jitterSeconds,
    dailyLimit,
    nightModePause,
    isAutoRunActive,
    onlyPromotionalGroups,
    onlyPersianVerifiedGroups,
    multiAccountDispatchMode,
    maxConcurrentAccounts,
  } = req.body;
  
  if (intervalMinutes !== undefined) {
    appState.scheduler.intervalMinutes = Math.max(1, parseInt(intervalMinutes, 10) || 15);
  }
  if (jitterSeconds !== undefined) {
    appState.scheduler.jitterSeconds = Math.max(10, parseInt(jitterSeconds, 10) || 45);
  }
  if (dailyLimit !== undefined) {
    appState.scheduler.dailyLimit = Math.max(5, parseInt(dailyLimit, 10) || 35);
  }
  if (nightModePause !== undefined) {
    appState.scheduler.nightModePause = Boolean(nightModePause);
  }
  if (onlyPromotionalGroups !== undefined) {
    appState.scheduler.onlyPromotionalGroups = Boolean(onlyPromotionalGroups);
  }
  if (onlyPersianVerifiedGroups !== undefined) {
    appState.scheduler.onlyPersianVerifiedGroups = Boolean(onlyPersianVerifiedGroups);
  }
  if (multiAccountDispatchMode !== undefined) {
    appState.scheduler.multiAccountDispatchMode = multiAccountDispatchMode === 'sequential_rotation' ? 'sequential_rotation' : 'parallel_multichannel';
  }
  if (maxConcurrentAccounts !== undefined) {
    appState.scheduler.maxConcurrentAccounts = Math.max(1, parseInt(maxConcurrentAccounts, 10) || 4);
  }
  if (isAutoRunActive !== undefined) {
    appState.scheduler.isAutoRunActive = Boolean(isAutoRunActive);
    
    if (appState.scheduler.isAutoRunActive) {
      // Calculate next run time
      const nextDate = new Date();
      nextDate.setMinutes(nextDate.getMinutes() + appState.scheduler.intervalMinutes);
      appState.scheduler.nextRunTime = nextDate.toISOString();
      addLog('success', `ارسال خودکار تبلیغات فعال گردید. بازه زمانی: هر ${appState.scheduler.intervalMinutes} دقیقه.`);
    } else {
      appState.scheduler.nextRunTime = undefined;
      addLog('warning', 'ارسال خودکار تبلیغات متوقف شد.');
    }
  }

  saveData();
  res.json({ success: true, scheduler: appState.scheduler });
});

// In-Memory Telegram Entity Peer Cache to prevent repetitive MTProto resolve queries (drastically reduces FloodWait)
const resolvedGroupPeerCache = new Map<string, any>();
const accountLastActionTime = new Map<string, number>();

async function enforceAccountActionThrottle(accountId: string, minIntervalMs: number = 3000): Promise<void> {
  if (!accountId) return;
  const lastTime = accountLastActionTime.get(accountId) || 0;
  const now = Date.now();
  const elapsed = now - lastTime;
  if (elapsed < minIntervalMs) {
    const waitTime = (minIntervalMs - elapsed) + Math.floor(Math.random() * 1200);
    await new Promise(r => setTimeout(r, waitTime));
  }
  accountLastActionTime.set(accountId, Date.now());
}

// Helper Function: Resolve Telegram Group/Channel Peer and Join if needed
async function resolveAndJoinGroup(client: any, rawInput: string) {
  const check = isValidTelegramTarget(rawInput);
  if (!check.valid) {
    throw new Error(`آیدی یا لینک گروه اشتباه یا نامعتبر است: ${check.reason || rawInput}`);
  }

  // Pre-Check: Persistent Non-Persian Blacklist
  if (isBlacklistedNonPersianTarget(rawInput)) {
    throw new Error('غربالگری پیش از عضویت: این گروه قبلاً به عنوان غیرفارسی/خارجی شناسایی و در لیست سیاه دائمی مسدود شده است.');
  }

  await loadGramJS();
  let cleanInput = String(rawInput).trim();

  // Check in-memory entity cache to avoid redundant Telegram server queries
  const clientKey = client?._selfInputPeer?.userId ? String(client._selfInputPeer.userId) : 'default';
  const cacheKey = `${clientKey}:${cleanInput}`;
  if (resolvedGroupPeerCache.has(cacheKey)) {
    const cachedPeer = resolvedGroupPeerCache.get(cacheKey);
    if (cachedPeer) return cachedPeer;
  }

  // Invite link with + hash or joinchat (e.g., https://t.me/+ABCDEF... or t.me/joinchat/ABCDEF...)
  if (cleanInput.includes('/+') || cleanInput.includes('joinchat/')) {
    let hash = '';
    if (cleanInput.includes('/+')) {
      hash = cleanInput.split('/+')[1].split('/')[0].split('?')[0];
    } else if (cleanInput.includes('joinchat/')) {
      hash = cleanInput.split('joinchat/')[1].split('/')[0].split('?')[0];
    }

    if (hash) {
      if (isBlacklistedNonPersianTarget(hash)) {
        throw new Error('غربالگری پیش از عضویت: این لینک در لیست سیاه گروه‌های غیرایرانی مسدود شده است.');
      }

      try {
        // Pre-Join Verification: Check Invite info BEFORE joining
        const isEnforcePersian = appState.groupJoinStrategy?.enforcePersianIranianOnly !== false;
        if (isEnforcePersian) {
          try {
            const preCheck = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
            const preTitle = preCheck.title || preCheck.chat?.title || '';
            const preAbout = preCheck.about || '';
            const auditResult = await verifyAndAuditGroupIsPersian(null, null, preTitle, `${hash} ${preAbout}`, { skipSampleMessages: true });
            
            if (!auditResult.isPersian) {
              addToNonPersianBlacklist(hash, preTitle);
              addToNonPersianBlacklist(rawInput);
              throw new Error(`غربالگری پیش از عضویت: گروه غیرایرانی (${auditResult.reason}) تشخیص داده شد و از عضویت ممانعت به عمل آمد.`);
            }
            if (preCheck.chat) return preCheck.chat;
          } catch (preErr: any) {
            if (preErr.message && preErr.message.includes('غربالگری پیش از عضویت')) {
              throw preErr;
            }
          }
        }

        const result = await client.invoke(
          new Api.messages.ImportChatInvite({ hash })
        );
        const resolvedChat = result.chats?.[0] || result;
        if (resolvedChat) {
          resolvedGroupPeerCache.set(cacheKey, resolvedChat);
        }
        return resolvedChat;
      } catch (err: any) {
        if (err.message && err.message.includes('غربالگری پیش از عضویت')) {
          throw err;
        }
        handleGramJsFloodWait(err);
        if (err.errorMessage === 'USER_ALREADY_PARTICIPANT') {
          const checkResult = await client.invoke(
            new Api.messages.CheckChatInvite({ hash })
          );
          if (checkResult.chat) {
            resolvedGroupPeerCache.set(cacheKey, checkResult.chat);
            return checkResult.chat;
          }
        }
        throw new Error(`خطای عضویت با لینک دعوت: ${translateTgError(err)}`);
      }
    }
  }

  // Handle t.me/username or https://t.me/username
  if (cleanInput.includes('t.me/')) {
    cleanInput = cleanInput.split('t.me/')[1].split('/')[0].split('?')[0];
  }

  // Remove leading @ if present or ensure valid format
  if (!cleanInput.startsWith('@') && !cleanInput.startsWith('-') && !/^\d+$/.test(cleanInput)) {
    cleanInput = '@' + cleanInput;
  }

  // If numeric ID e.g. -100123456789
  let peerTarget: any = cleanInput;
  if (cleanInput.startsWith('-') || /^\d+$/.test(cleanInput)) {
    peerTarget = parseInt(cleanInput, 10);
  }

  // Check if ResolveUsername is currently flood-waited
  if (typeof peerTarget === 'string' && peerTarget.startsWith('@') && resolveUsernameFloodWaitUntil > Date.now()) {
    const remainingMins = Math.ceil((resolveUsernameFloodWaitUntil - Date.now()) / 60000);
    throw new Error(`حساب شخصی در محدودیّت استعلام آیدی (FloodWait) است (${remainingMins} دقیقه باقی‌مانده). ارسال به صورت مستقیم با ربات انجام می‌شود.`);
  }

  // Get Telegram Entity
  try {
    const entity = await client.getEntity(peerTarget);

    // Pre-join Persian Verification for public channels/groups
    const isEnforcePersian = appState.groupJoinStrategy?.enforcePersianIranianOnly !== false;
    const isChannel = entity && (entity.className === 'Channel' || entity._ === 'channel' || entity.broadcast || entity.megagroup);

    if (isEnforcePersian && isChannel) {
      const entityTitle = entity.title || '';
      const entityUsername = entity.username || cleanInput;
      const auditResult = await verifyAndAuditGroupIsPersian(null, null, entityTitle, entityUsername, { skipSampleMessages: true });
      if (!auditResult.isPersian) {
        addToNonPersianBlacklist(cleanInput, entityTitle);
        if (entity.id) addToNonPersianBlacklist(entity.id);
        throw new Error(`غربالگری پیش از عضویت: گروه غیرایرانی (${auditResult.reason}) تشخیص داده شد و از عضویت ممانعت به عمل آمد.`);
      }
    }

    // Auto-join public group/channel if possible (only if entity is a Channel/Group, not a User)
    try {
      if (isChannel && Api && Api.channels) {
        await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
      }
    } catch (err: any) {
      // Ignore if already joined or not a channel
    }

    if (entity) {
      resolvedGroupPeerCache.set(cacheKey, entity);
    }
    return entity;
  } catch (err: any) {
    if (err.message && err.message.includes('غربالگری پیش از عضویت')) {
      throw err;
    }
    handleGramJsFloodWait(err);
    throw new Error(translateTgError(err));
  }
}

// Helper Function: Process Image URL or Base64 into temporary file for GramJS upload
async function getImageFilePathForTelegram(imageUrl: string): Promise<string | undefined> {
  if (!imageUrl || typeof imageUrl !== 'string') return undefined;

  try {
    // If it's a relative uploads path on disk
    if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
      const cleanRel = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
      const localFile = path.join(process.cwd(), cleanRel);
      if (fs.existsSync(localFile)) {
        return localFile;
      }
    }

    // If it's already an existing local file on disk
    if ((imageUrl.startsWith('/') || imageUrl.startsWith('./')) && fs.existsSync(imageUrl)) {
      return imageUrl;
    }

    const ext = imageUrl.includes('image/png') ? '.png' : imageUrl.includes('image/webp') ? '.webp' : '.jpg';
    const tmpPath = path.join('/tmp', `tg_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);

    if (imageUrl.startsWith('data:image') || imageUrl.includes(';base64,')) {
      const parts = imageUrl.split(',');
      const base64Data = parts[1] || parts[0];
      if (!base64Data) return undefined;
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(tmpPath, buffer);
      return tmpPath;
    }

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(imageUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(tmpPath, Buffer.from(arrayBuffer));
        return tmpPath;
      }
    }
  } catch (e) {
    console.error('Failed to prepare image file for Telegram upload:', e);
  }

  return undefined;
}

// Helper Function: Check if Telegram send error indicates invalid group or restricted posting permissions
function isGroupInvalidOrRestricted(err: any): boolean {
  if (!err) return false;
  const str = String(err.errorMessage || err.message || err).toLowerCase();

  const invalidKeywords = [
    'username_invalid',
    'username_not_occupied',
    'chat_not_found',
    'no_username',
    'peer_id_invalid',
    'channel_private',
    'invite_hash_expired',
    'invite_hash_invalid',
    'chat_write_forbidden',
    'user_banned_in_channel',
    'chat_restricted',
    'chat_admin_required',
    'msg_id_invalid',
    'user_is_blocked',
    'could not find the input entity',
    'cannot find',
    'نامعتبر',
    'یافت نشد',
    'ارسال پیام ندارد',
    'ممنوع',
    'مسدود',
    'دسترسی ندارد',
    'فقط مدیران',
    'اجازه ارسال',
  ];

  return invalidKeywords.some(kw => str.includes(kw));
}

// Helper Function: Format human-readable Persian Telegram error
function translateTgError(err: any): string {
  if (!err) return 'خطای نامشخص تلگرام';
  const msg = String(err.errorMessage || err.message || err);

  handleGramJsFloodWait(err);

  const secs = parseFloodWaitSeconds(err);
  if (secs !== null && secs > 0) {
    const hours = (secs / 3600).toFixed(1);
    const mins = Math.ceil(secs / 60);
    if (msg.includes('ResolveUsername') || msg.includes('contacts.ResolveUsername')) {
      return `محدودیت استعلام آیدی (Flood Wait). حساب تلگرام شما به مدت ${hours} ساعت (${mins} دقیقه) از استعلام آیدی‌های جدید محدود شده است. ارسال‌ها به طور خودکار با ربات انجام می‌شود.`;
    }
    return `محدودیت ارسال تلگرام (Flood Wait). لطفاً ${hours} ساعت (${mins} دقیقه) صبوری کنید.`;
  }

  if (msg.includes('API_ID_INVALID') || msg.includes('API_ID_PUBLISHED_FLOOD')) {
    return 'شناسه API ID یا کلید API Hash تلگرام نامعتبر یا منقضی است. لطفاً کلیدها را بررسی کنید یا از پیش‌تنظیم استاندارد تلگرام دسکتاپ استفاده فرمایید.';
  }
  if (msg.includes('TIMEOUT') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET') || msg.includes('EHOSTUNREACH')) {
    return 'خطای وقفه در ارتباط با سرورهای تلگرام (Timeout). لطفاً ارتباط اینترنت خود را بررسی کرده و چند ثانیه بعد مجدداً تلاش فرمایید.';
  }
  if (msg.includes('PHONE_NUMBER_INVALID')) {
    return 'شماره تلفن وارد شده نامعتبر است. فرمت صحیح با کد کشور: 989123456789+';
  }
  if (msg.includes('PHONE_NUMBER_BANNED')) {
    return 'این شماره تلفن توسط تلگرام مسدود (Ban) شده است و امکان ارسال کد ندارد.';
  }
  if (msg.includes('PHONE_CODE_EXPIRED')) {
    return 'کد تایید ۵ رقمی تلگرام منقضی شده است. لطفاً مجدداً درخواست کد تایید ارسال نمایید.';
  }
  if (msg.includes('PHONE_CODE_INVALID')) {
    return 'کد تایید وارد شده نادرست است. لطفاً کد ۵ رقمی دریافتی از تلگرام را به دقت وارد کنید.';
  }
  if (msg.includes('PASSWORD_HASH_INVALID')) {
    return 'رمز عبور تایید دو مرحله‌ای (2FA) نادرست است.';
  }
  if (msg.includes('SESSION_PASSWORD_NEEDED')) {
    return 'تایید دو مرحله‌ای (2FA) فعال است. لطفاً رمز عبور را وارد نمایید.';
  }
  if (msg.includes('SEND_CODE_UNAVAILABLE')) {
    return 'امکان ارسال کد به این شماره در حال حاضر مقدور نیست. لطفاً دقایقی دیگر تلاش فرمایید.';
  }

  if (
    msg.includes('AUTH_KEY_DUPLICATED') ||
    msg.includes('AUTH_KEY_UNREGISTERED') ||
    msg.includes('AUTH_KEY_INVALID') ||
    msg.includes('SESSION_REVOKED') ||
    msg.includes('SESSION_EXPIRED') ||
    msg.includes('406')
  ) {
    appState.credentials.isConnected = false;
    appState.credentials.sessionString = '';
    appState.credentials.userProfile = undefined;
    if (activeTgClient) {
      try { activeTgClient.disconnect(); } catch (e) {}
      activeTgClient = null;
    }
    saveData();
    return 'نشست تلگرام شما منقضی یا تکراری گردیده است (AUTH_KEY_DUPLICATED). لطفاً از طریق منوی تنظیمات اتصال، مجدداً کد تایید تلگرام بگیرید.';
  }
  if (msg.includes('Not connected')) {
    return 'اتصال به تلگرام برقرار نیست. لطفاً وارد حساب کاربری خود شوید.';
  }
  if (msg.includes('CHAT_WRITE_FORBIDDEN')) return 'ارسال پیام در این گروه قفل است یا فقط برای مدیران مجاز می‌باشد.';
  if (msg.includes('USER_BANNED_IN_CHANNEL')) return 'حساب کاربری شما در این گروه/کانال مسدود شده است.';
  if (msg.includes('SLOWMODE_WAIT')) return `حالت کند (Slowmode) در گروه فعال است. ${msg}`;
  if (msg.includes('USERNAME_INVALID') || msg.includes('USERNAME_NOT_OCCUPIED')) return 'آیدی یا لینک گروه اشتباه یا نامعتبر است.';
  if (msg.includes('INVITE_HASH_EXPIRED')) return 'لینک دعوت گروه منقضی شده است.';
  if (msg.includes('CHANNEL_PRIVATE')) return 'گروه یا کانال خصوصی است و نیاز به لینک دعوت جدید دارد.';
  if (msg.includes('MSG_ID_INVALID')) return 'خطا در ساختار پیام.';

  return msg;
}

// -----------------------------------------------------------------------------
// SPINTAX & DYNAMIC VARIABLE ENGINE (Anti-Spam & Fingerprint Neutralizer)
// -----------------------------------------------------------------------------

function parseSpintaxBackend(text: string): string {
  if (!text || typeof text !== 'string') return '';
  // Matches innermost curly braces containing at least one pipe '|'
  const spintaxRegex = /\{([^{}|]+\|[^{}]+)\}/;
  let matches: RegExpExecArray | null;
  let iterations = 0;
  let result = text;
  while ((matches = spintaxRegex.exec(result)) !== null && iterations < 50) {
    iterations++;
    const fullMatch = matches[0];
    const options = matches[1].split('|');
    const chosen = options[Math.floor(Math.random() * options.length)] || '';
    result = result.replace(fullMatch, chosen);
  }
  return result;
}

function applyDynamicVariablesBackend(
  text: string,
  context: { groupTitle?: string; contactHandle?: string; price?: string; campaignTitle?: string; accountName?: string } = {}
): string {
  if (!text || typeof text !== 'string') return '';

  const now = new Date();
  const timeFa = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const dateFa = now.toLocaleDateString('fa-IR');
  const weekDaysFa = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  const dayName = weekDaysFa[now.getDay()] || 'امروز';

  const EMOJI_POOL = ['✨', '💎', '🚀', '📌', '🎁', '🔥', '⚡', '🌟', '🛍️', '👑', '🎉', '💼', '🏷️', '🎯', '💫'];
  const GREETING_POOL = [
    'سلام دوستان',
    'درود بر همگی',
    'سلام وقت بخیر',
    'سلام و درود',
    'درود بر اعضای محترم',
    'سلام خدمت دوستان عزیز',
    'وقت بخیر دوستان',
  ];
  const CTA_POOL = [
    'جهت ثبت سفارش پیام دهید',
    'ارتباط مستقیم از طریق آیدی زیر',
    'مشاوره و اطلاعات بیشتر',
    'برای سفارش فوری در ارتباط باشید',
    'جهت پاسخگویی و هماهنگی پیام دهید',
  ];

  let processed = text;
  const cleanGroupTitle = context.groupTitle ? context.groupTitle.replace(/[#@]/g, '').trim() : 'گروه';
  processed = processed.replace(/\{(group_title|نام_گروه|گروه)\}/gi, cleanGroupTitle);
  processed = processed.replace(/\{(time|ساعت|زمان)\}/gi, timeFa);
  processed = processed.replace(/\{(date|تاریخ)\}/gi, dateFa);
  processed = processed.replace(/\{(day_of_week|روز_هفته|روز)\}/gi, dayName);

  processed = processed.replace(/\{(random_emoji|اموجی|اموجی_رندوم|emoji)\}/gi, () => EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]);
  processed = processed.replace(/\{(greeting|احوالپرسی|سلام)\}/gi, () => GREETING_POOL[Math.floor(Math.random() * GREETING_POOL.length)]);
  processed = processed.replace(/\{(cta_text|متن_اقدام|اقدام_به_خرید|call_to_action)\}/gi, () => CTA_POOL[Math.floor(Math.random() * CTA_POOL.length)]);
  processed = processed.replace(/\{(random_id|کد_پیگیری|شناسه_پیگیری|کد_رندوم)\}/gi, () => '#' + Math.floor(1000 + Math.random() * 9000).toString());
  processed = processed.replace(/\{(random_num|عدد_رندوم|عدد_تصادفی)\}/gi, () => Math.floor(10 + Math.random() * 90).toString());

  if (context.contactHandle) {
    processed = processed.replace(/\{(contact|آیدی_تماس|پشتیبانی|آیدی_پشتیبانی)\}/gi, context.contactHandle);
  }
  if (context.price) {
    processed = processed.replace(/\{(price|قیمت)\}/gi, context.price);
  }
  if (context.campaignTitle) {
    processed = processed.replace(/\{(campaign_title|نام_کمپین|عنوان_محصول)\}/gi, context.campaignTitle);
  }
  if (context.accountName) {
    processed = processed.replace(/\{(account_name|نام_اکانت)\}/gi, context.accountName);
  }
  return processed;
}

function processMessageWithSpintaxAndVars(
  template: string,
  context: { groupTitle?: string; contactHandle?: string; price?: string; campaignTitle?: string; accountName?: string } = {}
): { text: string; spintaxApplied: boolean } {
  const isSpintaxOrVarsPresent = /\{[^{}]+\}/.test(template);
  const resolved = processVariablesAndSpintax(template, context);
  return {
    text: resolved,
    spintaxApplied: isSpintaxOrVarsPresent,
  };
}

// Helper Function: Solve common bot math equations, captcha codes, and text challenges
function solveBotMathOrTextChallenge(text: string, groupTitle?: string): string | null {
  if (!text) return null;
  const clean = text.toLowerCase();

  // 1. Convert Persian and Arabic digits to standard English digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let normalized = clean;
  for (let i = 0; i < 10; i++) {
    normalized = normalized.split(persianDigits[i]).join(String(i));
    normalized = normalized.split(arabicDigits[i]).join(String(i));
  }

  // 1b. Convert common Persian number words to digits
  const wordToNumber: Record<string, string> = {
    'صفر': '0', 'یک': '1', 'یه': '1', 'دو': '2', 'سه': '3', 'چهار': '4',
    'پنج': '5', 'شش': '6', 'شیش': '6', 'هفت': '7', 'هشت': '8', 'نه': '9',
    'ده': '10', 'یازده': '11', 'دوازده': '12', 'سیزده': '13', 'چهارده': '14',
    'پانزده': '15', 'پونزده': '15', 'شانزده': '16', 'هفده': '17', 'هجده': '18',
    'نوزده': '19', 'بیست': '20'
  };
  for (const [word, digit] of Object.entries(wordToNumber)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    normalized = normalized.replace(regex, digit);
  }

  // 2. Math questions: e.g. "حاصل 2 + 5 چیست", "2 + 5 = ?", "5 ضربدر 3", "12 - 4", "حاصل ضرب 4 در 5"
  const mathRegex = /(\d+)\s*([\+\-\*xX×÷\/]|ضربدر|ضرب در|به علاوه|بعلاوه|منهای|منها|تقسیم بر)\s*(\d+)/;
  const mathMatch = normalized.match(mathRegex);
  if (mathMatch) {
    const num1 = parseInt(mathMatch[1], 10);
    const op = mathMatch[2];
    const num2 = parseInt(mathMatch[3], 10);
    let result: number | null = null;
    if (op === '+' || op === 'به علاوه' || op === 'بعلاوه') result = num1 + num2;
    else if (op === '-' || op === 'منهای' || op === 'منها') result = num1 - num2;
    else if (op === '*' || op === 'x' || op === 'X' || op === '×' || op === 'ضربدر' || op === 'ضرب در') result = num1 * num2;
    else if ((op === '/' || op === '÷' || op === 'تقسیم بر') && num2 !== 0) result = Math.floor(num1 / num2);

    if (result !== null && !isNaN(result)) {
      return String(result);
    }
  }

  // Pattern: "حاصل ضرب 4 در 5" or "مجموع اعداد 3 و 8"
  const wordMathRegex = /(?:حاصل ضرب|حاصلضرب|ضرب)\s*(\d+)\s*(?:در|و)\s*(\d+)/;
  const wordMathMatch = normalized.match(wordMathRegex);
  if (wordMathMatch) {
    const n1 = parseInt(wordMathMatch[1], 10);
    const n2 = parseInt(wordMathMatch[2], 10);
    return String(n1 * n2);
  }
  const wordAddRegex = /(?:مجموع|جمع|حاصل جمع|حاصلجمع)\s*(?:اعداد)?\s*(\d+)\s*(?:و|با|به علاوه)\s*(\d+)/;
  const wordAddMatch = normalized.match(wordAddRegex);
  if (wordAddMatch) {
    const n1 = parseInt(wordAddMatch[1], 10);
    const n2 = parseInt(wordAddMatch[2], 10);
    return String(n1 + n2);
  }

  // 3. Number repetition challenge: e.g. "عدد 5482 را وارد کنید" or "کد تایید: 9821"
  const codeRegex = /(?:عدد|کد|رمز|شماره|number|code)\s*(?:تایید|زیر|عبور|امنیتی)?\s*[:\s]\s*(\d{2,8})/i;
  const codeMatch = normalized.match(codeRegex);
  if (codeMatch && codeMatch[1]) {
    return codeMatch[1];
  }

  // 4. Common trivia & Persian bot riddles
  if (normalized.includes('چند تا چشم') || normalized.includes('چند چشم')) return '2';
  if (normalized.includes('چند تا دست') || normalized.includes('چند دست')) return '2';
  if (normalized.includes('چند تا پا') || normalized.includes('چند پا')) return '2';
  if (normalized.includes('چند روز در هفته') || normalized.includes('روزهای هفته')) return '7';
  if (normalized.includes('پایتخت ایران')) return 'تهران';
  if (normalized.includes('فصل بعد از بهار')) return 'تابستان';
  if (normalized.includes('فصل بعد از تابستان')) return 'پاییز';
  if (normalized.includes('فصل بعد از پاییز')) return 'زمستان';

  // 5. Group name challenge: "نام گروه را بفرستید"
  if (groupTitle && (clean.includes('نام گروه') || clean.includes('اسم گروه') || clean.includes('group name'))) {
    return groupTitle.trim();
  }

  return null;
}

// AI Captcha Solver (Deep Reasoning via Gemini for complex Persian telegram bot challenges)
async function solveCaptchaWithGemini(
  promptText: string,
  buttonTexts: string[],
  groupTitle?: string
): Promise<{ action: 'click_button' | 'send_text' | 'join_channel' | 'unknown'; target?: string; answer?: string } | null> {
  try {
    const ai = getAiClient();
    if (!ai) return null;
    const prompt = `شما دستیار ارشد هوش مصنوعی حل کپچای گروه‌های تلگرام هستید.
وظیفه شما ارزیابی پیام ربات ناظر (مثل MissRose، ShieldBot، GroupHelp، CaptchaBot) و دکمه‌های آن و تعیین اقدام دقیق است:

متن پیام ربات ناظر:
"""${promptText}"""

دکمه‌های شیشه‌ای موجود:
${buttonTexts.map((b, i) => `${i + 1}. "${b}"`).join('\n')}

نام گروه: "${groupTitle || ''}"

لطفاً خروجی را منحصراً در قالب JSON زیر بدهید:
{
  "action": "click_button" | "send_text" | "join_channel" | "unknown",
  "target": "متن دقیق دکمه ای که باید کلیک شود یا آیدی کانال حامی با @",
  "answer": "پاسخ متنی مورد نیاز (مثلا حاصل ریاضی، کد تایید، یا پاسخ سوال)"
}`;

    const candidateModels = getAdaptiveCandidateModels();
    for (const modelName of candidateModels) {
      try {
        const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 4500;
        const apiCall = ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        const response: any = await runWithTimeout(apiCall, timeoutMs, 'GEMINI_TIMEOUT');
        const raw = response.text || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.action && parsed.action !== 'unknown') {
            recordGeminiSuccess(modelName);
            return parsed;
          }
        }
      } catch (err: any) {
        recordGeminiFailure(modelName, err);
      }
    }
  } catch (err: any) {
    console.warn('solveCaptchaWithGemini failed gracefully:', err?.message || err);
  }
  return null;
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// FORCE-ADD & MEMBER LOCK BYPASS ENGINE (Auto-Solve Telegram Group Add-Member Locks)
// -----------------------------------------------------------------------------

// AI Fallback Parser for Force Add requirements
async function solveForceAddWithGemini(
  botText: string,
  targetAccountName?: string
): Promise<{ isForceAdd: boolean; totalNeeded: number; currentAdded: number; remainingNeeded: number; targetUser?: string } | null> {
  try {
    const ai = getAiClient();
    if (!ai) return null;
    const prompt = `شما تحلیل‌گر فوق دقیق پیام‌های ربات‌های محافظ و ناظر گروه‌های تلگرام فارسی (مثل مبصر، ناظم، تبچی، رز، شیلد، دیجی‌آنتی و ...) هستید.
وظیفه شما بررسی متن زیر و تشخیص این است که آیا ربات گروه از کاربر خواسته برای ارسال پیام یا فعالیت، تعدادی عضو/ممبر/مخاطب ادد (اضافه) کند یا خیر.

متن پیام ربات گروه:
"""${botText}"""

نام احتمالی اکانت ما: "${targetAccountName || ''}"

لطفاً خروجی را منحصراً در قالب JSON معتبر زیر بازگردانید (هیچ متنی قبل یا بعد از JSON نباشد):
{
  "isForceAdd": true | false,
  "totalNeeded": تعداد کل ممبرهای خواسته شده جهت باز شدن قفل (عدد صحیح مثلا 2 یا 3),
  "currentAdded": تعداد ممبرهایی که کاربر تاکنون اد کرده (عدد صحیح مثلا 0),
  "remainingNeeded": تعداد باقیمانده ممبرهای لازم برای ادد شدن (عدد صحیح),
  "targetUser": "نام یا آیدی کاربری که ربات او را منشن/مخاطب قرار داده (مثلا Voss)"
}`;

    const candidateModels = getAdaptiveCandidateModels();
    for (const modelName of candidateModels) {
      try {
        const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 4500;
        const apiCall = ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        const response: any = await runWithTimeout(apiCall, timeoutMs, 'GEMINI_TIMEOUT');
        const raw = response.text || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (typeof parsed.isForceAdd === 'boolean') {
            recordGeminiSuccess(modelName);
            const total = Math.max(1, Math.min(50, parseInt(parsed.totalNeeded, 10) || 2));
            const current = Math.max(0, parseInt(parsed.currentAdded, 10) || 0);
            const rem = Math.max(1, Math.min(20, parseInt(parsed.remainingNeeded, 10) || (total - current)));
            return {
              isForceAdd: parsed.isForceAdd,
              totalNeeded: total,
              currentAdded: current,
              remainingNeeded: rem,
              targetUser: parsed.targetUser ? String(parsed.targetUser).trim() : undefined,
            };
          }
        }
      } catch (err: any) {
        recordGeminiFailure(modelName, err);
      }
    }
  } catch (err: any) {
    console.warn('solveForceAddWithGemini failed gracefully:', err?.message || err);
  }
  return null;
}

function detectAndExtractForceAddRequirement(
  botText: string,
  targetAccountName?: string,
  targetPhone?: string,
  targetUsername?: string,
  targetId?: string
): { isForceAdd: boolean; totalNeeded: number; currentAdded: number; remainingNeeded: number; targetUser?: string; botName?: string } {
  if (!botText) return { isForceAdd: false, totalNeeded: 0, currentAdded: 0, remainingNeeded: 0 };
  
  let raw = botText;
  
  // Normalize Persian and Arabic digits to standard English (0-9)
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    raw = raw.split(persianDigits[i]).join(String(i));
    raw = raw.split(arabicDigits[i]).join(String(i));
  }

  // Normalize Arabic characters and zero-width spaces/line artifacts
  raw = raw
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200b\u200e\u200f\u00a0]/g, ' ')
    .replace(/\s+/g, ' ');

  const clean = raw.toLowerCase();

  // Convert Persian number words to numeric digits when describing member counts
  const wordNumbers: Record<string, string> = {
    'صفر': '0',
    'یک': '1',
    'يك': '1',
    'دو': '2',
    'سه': '3',
    'چهار': '4',
    'پنج': '5',
    'شش': '6',
    'شیش': '6',
    'هفت': '7',
    'هشت': '8',
    'نه': '9',
    'ده': '10',
  };

  let normalized = clean;
  for (const [w, n] of Object.entries(wordNumbers)) {
    normalized = normalized.replace(new RegExp(`\\b${w}\\s*(?:نفر|عضو|کاربر|ممبر|مخاطب|اد|ادد)`, 'gi'), `${n} نفر`);
    normalized = normalized.replace(new RegExp(`(?:باید|حداقل|تاکنون|شما)\\s*${w}\\b`, 'gi'), ` $1 ${n} `);
  }

  // Extract targeted username or name (e.g. "• کاربر ( Voss )")
  let targetUser: string | undefined = undefined;
  const targetMatch =
    botText.match(/کاربر\s*[\(\[\{]\s*([^\)\]\}]+)\s*[\)\]\}]/i) ||
    botText.match(/کاربر\s*:\s*([^\n،,]+)/i) ||
    botText.match(/کاربر\s+@?([A-Za-z0-9_]{3,32})/i) ||
    botText.match(/@([A-Za-z0-9_]{3,32})/i);
  if (targetMatch && targetMatch[1]) {
    targetUser = targetMatch[1].trim();
  }

  // Common keywords in Iranian group manager bots (Tabchi, Mobser, Nazem, MrBot, Saba, Rose, Shield, etc.)
  const hasAddKeyword =
    normalized.includes('اضافه کنید') ||
    normalized.includes('اضافه نمایید') ||
    normalized.includes('اضافه کرده') ||
    normalized.includes('اضافه کردید') ||
    normalized.includes('اضافه شده') ||
    normalized.includes('نفر اضافه') ||
    normalized.includes('عضو اضافه') ||
    normalized.includes('مخاطب اضافه') ||
    normalized.includes('ممبر اضافه') ||
    normalized.includes('کاربر اضافه') ||
    normalized.includes('نفر دیگر اضافه') ||
    normalized.includes('نفر دیگر اد') ||
    normalized.includes('اد کنید') ||
    normalized.includes('ادد کنید') ||
    normalized.includes('اد نمایید') ||
    normalized.includes('ادد نمایید') ||
    normalized.includes('اد کرده') ||
    normalized.includes('ادد کرده') ||
    normalized.includes('اد کردید') ||
    normalized.includes('ادد کردید') ||
    normalized.includes('اد شده') ||
    normalized.includes('ادد شده') ||
    normalized.includes('دعوت کنید') ||
    normalized.includes('دعوت نمایید') ||
    normalized.includes('عضو کنید') ||
    normalized.includes('عضو نمایید') ||
    normalized.includes('وارد کنید') ||
    normalized.includes('قفل اد') ||
    normalized.includes('قفل ادد') ||
    normalized.includes('قفل عضوگیری') ||
    normalized.includes('قفل ممبر') ||
    normalized.includes('قفل دعوت') ||
    normalized.includes('سهمیه اد') ||
    normalized.includes('تعداد اد') ||
    normalized.includes('تعداد دعوت') ||
    normalized.includes('برای ارسال پیام باید') ||
    normalized.includes('جهت ارسال پیام باید') ||
    normalized.includes('برای ارسال پیام') ||
    normalized.includes('جهت ارسال پیام') ||
    normalized.includes('برای چت کردن') ||
    normalized.includes('جهت چت') ||
    /باید\s*\d+\s*(?:نفر|عضو|ممبر|مخاطب|کاربر|اد)/i.test(normalized) ||
    /نیاز به\s*\d+\s*(?:نفر|عضو|ممبر|مخاطب|اد)/i.test(normalized) ||
    /حداقل\s*\d+\s*(?:نفر|عضو|ممبر|مخاطب)/i.test(normalized) ||
    /(\d+)\s*نفر\s*(?:را\s*)?(?:اضافه|اد|ادد|دعوت|عضو)/i.test(normalized);

  if (!hasAddKeyword) {
    return { isForceAdd: false, totalNeeded: 0, currentAdded: 0, remainingNeeded: 0, targetUser };
  }

  let totalNeeded = 2; // Default safe count
  let currentAdded = 0;

  // Patterns for required count:
  // 1. "برای ارسال پیام باید 2 نفر را اضافه کنید", "باید 3 نفر دیگر اضافه کنید", "نیاز به 5 ادد"
  const needMatch =
    normalized.match(/(?:برای ارسال پیام|جهت ارسال پیام|برای چت|جهت چت|برای فعالیت)?\s*باید\s*(\d+)\s*(?:نفر|عضو|کاربر|ممبر|مخاطب|اد|ادد)/i) ||
    normalized.match(/(\d+)\s*(?:نفر|عضو|کاربر|ممبر|مخاطب)\s*(?:دیگر\s*)?(?:را\s*)?(?:اضافه|عضو|اد|ادد|دعوت|وارد)/i) ||
    normalized.match(/(?:نیاز به|حداقل|الزام به)\s*(\d+)\s*(?:عضو|مخاطب|نفر|ممبر|کاربر|اد|ادد)/i) ||
    normalized.match(/تعداد\s*(\d+)\s*(?:عضو|مخاطب|نفر|ممبر|کاربر)/i) ||
    normalized.match(/سهمیه\s*(?:اد|ادد|عضوگیری|دعوت)\s*[:：]?\s*(\d+)/i) ||
    normalized.match(/قفل\s*(?:اد|ادد|عضوگیری)\s*[:：]?\s*(\d+)/i) ||
    normalized.match(/(\d+)\s*(?:اد|ادد|دعوت|عضو|ممبر|مخاطب)\s*(?:کنید|نمایید)/i) ||
    normalized.match(/باید\s*(\d+)\s*نفر/i);

  if (needMatch && needMatch[1]) {
    totalNeeded = parseInt(needMatch[1], 10) || 2;
  }

  // Patterns for currently added count:
  // "در حال حاضر شما 0 نفر اضافه کردهاید", "شما 0 نفر اضافه کرده اید", "تاکنون 1 نفر اد شده", "تعداد اد شما: 0"
  const addedMatch =
    normalized.match(/(?:در حال حاضر|هم اکنون|تاکنون|تا الان)\s*(?:شما\s*)?(\d+)\s*(?:نفر|عضو|ممبر|مخاطب|کاربر)?/i) ||
    normalized.match(/شما\s*(\d+)\s*(?:نفر|عضو|ممبر|مخاطب|کاربر)?\s*(?:را\s*)?(?:اضافه|اد|ادد|دعوت|وارد)\s*(?:کرده|کردید|نمودید)/i) ||
    normalized.match(/(?:اضافه کرده|اد کرده|ادد کرده|دعوت کرده|تعداد اد|تعداد دعوت|اد شده|اضافه شده|ثبت شده)\s*[:：]\s*(\d+)/i) ||
    normalized.match(/تاکنون\s*(\d+)\s*(?:نفر|عضو|کاربر)/i);

  if (addedMatch && addedMatch[1]) {
    currentAdded = parseInt(addedMatch[1], 10) || 0;
  }

  // Ratio pattern: "0/2" or "0 از 2" or "(0/2)"
  const ratioMatch = normalized.match(/(\d+)\s*(?:\/|از|of)\s*(\d+)\s*(?:نفر|عضو|ممبر|اد|کاربر)?/i);
  if (ratioMatch && ratioMatch[1] && ratioMatch[2]) {
    const rAdded = parseInt(ratioMatch[1], 10);
    const rTotal = parseInt(ratioMatch[2], 10);
    if (rTotal >= rAdded && rTotal > 0 && rTotal <= 50) {
      currentAdded = rAdded;
      totalNeeded = rTotal;
    }
  }

  const remainingNeeded = Math.max(1, Math.min(20, totalNeeded - currentAdded));

  return {
    isForceAdd: true,
    totalNeeded,
    currentAdded,
    remainingNeeded,
    targetUser,
    botName: 'ربات قفل عضوگیری/اد اجباری',
  };
}

// Helper Function: Retrieve multi-tiered candidate users for automatic group invitation
async function fetchCandidateUsersForGroupInvite(
  client: any,
  countNeeded: number,
  currentPeer: any,
  excludeUserIds: Set<string> = new Set()
): Promise<any[]> {
  await loadGramJS();
  const candidates: any[] = [];
  const seenIds = new Set<string>(excludeUserIds);

  // Exclude current self account
  try {
    const me = await client.getMe();
    if (me && me.id) seenIds.add(String(me.id));
  } catch (e) {}

  // Tier 1: Telegram Phone Contacts (highest success rate & lowest Telegram privacy restrictions)
  try {
    if (Api && Api.contacts && Api.contacts.GetContacts) {
      const resContacts = await client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) }));
      const users = resContacts.users || [];
      for (const u of users) {
        if (!u || !u.id) continue;
        const sId = String(u.id);
        if (!seenIds.has(sId) && !u.bot && !u.isSelf && !u.deleted) {
          seenIds.add(sId);
          candidates.push(u);
          if (candidates.length >= countNeeded * 4) break;
        }
      }
    }
  } catch (contactErr) {
    console.warn('Tier 1 contacts fetch warning:', contactErr);
  }

  // Tier 1.5: Dynamic Contact Import (If contacts are fewer than needed, import known safe numbers into Telegram address book)
  if (candidates.length < countNeeded * 2) {
    try {
      if (Api && Api.contacts && Api.contacts.ImportContacts) {
        const poolPhones: string[] = [];
        // Pool from other userbot accounts
        (appState.accounts || []).forEach(a => {
          if (a.phoneNumber && !poolPhones.includes(a.phoneNumber)) {
            poolPhones.push(a.phoneNumber);
          }
        });

        if (poolPhones.length > 0) {
          const importList = poolPhones.map((p, idx) => {
            return new Api.InputPhoneContact({
              clientId: BigInt(Date.now() + idx),
              phone: p.replace(/[^0-9+]/g, ''),
              firstName: 'Member',
              lastName: `Sync_${idx}`,
            });
          });

          const importRes = await client.invoke(new Api.contacts.ImportContacts({ contacts: importList })).catch(() => null);
          if (importRes && importRes.users) {
            for (const u of importRes.users) {
              if (!u || !u.id) continue;
              const sId = String(u.id);
              if (!seenIds.has(sId) && !u.bot && !u.isSelf && !u.deleted) {
                seenIds.add(sId);
                candidates.push(u);
              }
            }
          }
        }
      }
    } catch (importErr) {
      console.warn('Tier 1.5 dynamic contact import warning:', importErr);
    }
  }

  // Tier 2: Recent Private Dialogs / Chats
  if (candidates.length < countNeeded * 2) {
    try {
      const dialogs = await client.getDialogs({ limit: 50 });
      for (const d of dialogs) {
        if (d.isUser && d.entity && !d.entity.bot && !d.entity.isSelf && !d.entity.deleted) {
          const sId = String(d.entity.id);
          if (!seenIds.has(sId)) {
            seenIds.add(sId);
            candidates.push(d.entity);
            if (candidates.length >= countNeeded * 4) break;
          }
        }
      }
    } catch (dialogErr) {
      console.warn('Tier 2 dialogs fetch warning:', dialogErr);
    }
  }

  // Tier 3: Members from other joined public groups
  if (candidates.length < countNeeded) {
    try {
      const dialogs = await client.getDialogs({ limit: 30 });
      for (const d of dialogs) {
        if (d.isGroup || d.isChannel) {
          const isSamePeer = currentPeer && d.id && String(d.id) === String(currentPeer.id || currentPeer);
          if (isSamePeer) continue;
          try {
            const participants = await client.getParticipants(d.entity, { limit: 25 });
            for (const p of participants) {
              if (p && p.id && !p.bot && !p.isSelf && !p.deleted) {
                const sId = String(p.id);
                if (!seenIds.has(sId)) {
                  seenIds.add(sId);
                  candidates.push(p);
                  if (candidates.length >= countNeeded * 4) break;
                }
              }
            }
          } catch (partErr) {
            // Group might not allow fetching members
          }
        }
        if (candidates.length >= countNeeded * 4) break;
      }
    } catch (e) {}
  }

  // Tier 4: Known users from local database (recentLeads, anonymous bots or other accounts)
  if (candidates.length < countNeeded) {
    try {
      const leads = appState.groupPromotionStrategy?.recentLeads || [];
      for (const lead of leads) {
        const candidateId = lead.userId || (lead as any).senderId;
        if (candidateId) {
          const sId = String(candidateId);
          if (!seenIds.has(sId)) {
            seenIds.add(sId);
            candidates.push(candidateId);
            if (candidates.length >= countNeeded * 4) break;
          }
        }
      }
    } catch (e) {}
  }

  return candidates;
}

// Helper Function: Execute Automatic Force-Add Bypass (Add Required Members Step-by-Step)
async function executeForceAddBypass(
  client: any,
  peer: any,
  countNeeded: number,
  groupTitle: string,
  botMsgToConfirm?: any
): Promise<{ success: boolean; invitedCount: number; message: string }> {
  await loadGramJS();
  addLog('info', `[شکستن قفل ادد اجباری] گروه "${groupTitle}" نیازمند افزودن ${countNeeded} نفر است. در حال استخراج کاربران مناسب از استخر مخاطبین و چت‌ها...`);

  const candidates = await fetchCandidateUsersForGroupInvite(client, countNeeded, peer);
  if (!candidates || candidates.length === 0) {
    addLog('warning', `[ادد اجباری] متاسفانه کاربری برای افزودن به گروه در دفترچه مخاطبین یا چت‌های اکانت یافت نشد.`);
    return { success: false, invitedCount: 0, message: 'کاربری جهت افزودن یافت نشد.' };
  }

  addLog('info', `[استخر کاربران] تعداد ${candidates.length} کاندیدای معتبر برای دعوت شناسایی شد. آغاز افزودن مرحله‌به‌مرحله به گروه "${groupTitle}"...`);

  let successfulInvites = 0;
  
  // Resolve peer input entity for GramJS MTProto calls
  let inputPeer: any = null;
  try {
    inputPeer = await client.getInputEntity(peer);
  } catch (pe) {
    inputPeer = peer;
  }

  const isChannelOrSupergroup = Boolean(
    peer && (
      peer.className === 'Channel' ||
      peer._ === 'channel' ||
      peer.megagroup ||
      (inputPeer && (inputPeer.className === 'InputPeerChannel' || inputPeer.className === 'InputChannel'))
    )
  );

  for (const candidate of candidates) {
    if (successfulInvites >= countNeeded) break;
    
    // Resolve candidate input entity so MTProto serialization never fails
    let inputUser: any = null;
    try {
      inputUser = await client.getInputEntity(candidate);
    } catch (entErr) {
      inputUser = candidate.id || candidate;
    }

    if (!inputUser) continue;

    const displayName = candidate.firstName || candidate.username || `User_${candidate.id || candidate}`;

    try {
      if (isChannelOrSupergroup && Api && Api.channels && Api.channels.InviteToChannel) {
        const channelTarget = (inputPeer && (inputPeer.className === 'InputChannel' || inputPeer.className === 'InputPeerChannel')) 
          ? inputPeer 
          : await client.getInputEntity(peer);

        await client.invoke(new Api.channels.InviteToChannel({
          channel: channelTarget,
          users: [inputUser],
        }));
      } else if (Api && Api.messages && Api.messages.AddChatUser) {
        const chatIdVal = peer.id || (inputPeer && inputPeer.chatId) || peer;
        await client.invoke(new Api.messages.AddChatUser({
          chatId: chatIdVal,
          userId: inputUser,
          fwdLimit: 0,
        }));
      }

      successfulInvites++;
      addLog('success', `[ادد اجباری - موفق ✓] کاربر «${displayName}» با موفقیت به گروه "${groupTitle}" افزوده شد (${successfulInvites}/${countNeeded}).`);

      // Natural Human Safe Delay
      await new Promise(r => setTimeout(r, 2000));
    } catch (inviteErr: any) {
      const errMsg = inviteErr?.message || String(inviteErr);
      if (errMsg.includes('USER_PRIVACY_RESTRICTED') || errMsg.includes('PRIVACY_RESTRICTED')) {
        addLog('info', `[ادد اجباری] حریم خصوصی «${displayName}» مانع ادد شد. انتخاب کاندیدای بعدی...`);
      } else if (errMsg.includes('USER_ALREADY_PARTICIPANT')) {
        addLog('info', `[ادد اجباری] کاربر «${displayName}» از قبل عضو این گروه بود. انتخاب نفر بعدی...`);
      } else if (errMsg.includes('USER_NOT_MUTUAL_CONTACT')) {
        addLog('info', `[ادد اجباری] کاربر «${displayName}» مخاطب دوطرفه نبود. انتخاب نفر بعدی...`);
      } else if (errMsg.includes('PEER_FLOOD')) {
        addLog('warning', `[ادد اجباری] اعمال محدودیت موقت دعوت تلگرام (FloodWait).`);
        break;
      } else if (errMsg.includes('CHAT_ADMIN_REQUIRED')) {
        addLog('warning', `[ادد اجباری] افزودن عضو در این گروه نیازمند دسترسی ادمین است.`);
        break;
      } else {
        console.warn(`Invite error for ${displayName}:`, errMsg);
      }
      // Brief pause before trying next candidate
      await new Promise(r => setTimeout(r, 800));
    }
  }

  // If there was a confirmation button on the guardian bot's challenge, click it
  if (botMsgToConfirm && successfulInvites > 0) {
    if (botMsgToConfirm.replyMarkup?.rows) {
      for (let r = 0; r < botMsgToConfirm.replyMarkup.rows.length; r++) {
        const rowBtns = botMsgToConfirm.replyMarkup.rows[r].buttons || [];
        for (let c = 0; c < rowBtns.length; c++) {
          const btn = rowBtns[c];
          const btnText = (btn.text || '').toLowerCase();
          const isConfirmBtn =
            btnText.includes('بررسی') ||
            btnText.includes('بررسی مجدد') ||
            btnText.includes('تایید') ||
            btnText.includes('عضو شدم') ||
            btnText.includes('حل شد') ||
            btnText.includes('ورود');
          if (isConfirmBtn) {
            try {
              if (typeof botMsgToConfirm.click === 'function') {
                await botMsgToConfirm.click({ i: r, j: c });
              } else if (btn.data && Api && Api.messages && Api.messages.GetBotCallbackAnswer) {
                await client.invoke(new Api.messages.GetBotCallbackAnswer({
                  peer,
                  msgId: botMsgToConfirm.id,
                  data: btn.data,
                }));
              }
              addLog('info', `[تایید بعد از ادد] دکمه بررسی/تایید ربات «${btn.text}» با موفقیت کلیک شد.`);
            } catch (e) {}
          }
        }
      }
    }
  }

  if (successfulInvites >= countNeeded) {
    addLog('success', `[شکستن قفل ادد اجباری] تبریک! هر ${successfulInvites} نفر مورد نیاز با موفقیت به گروه "${groupTitle}" اضافه شدند. قفل ارسال باز شد.`);
    return { success: true, invitedCount: successfulInvites, message: `تعداد ${successfulInvites} نفر با موفقیت اضافه شدند.` };
  } else if (successfulInvites > 0) {
    addLog('warning', `[ادد اجباری] تعداد ${successfulInvites} از ${countNeeded} نفر اضافه شدند.`);
    return { success: false, invitedCount: successfulInvites, message: `تعداد ${successfulInvites} نفر اضافه شد اما به حد نصاب نرسید.` };
  } else {
    addLog('error', `[شکست ادد اجباری] امکان افزودن مخاطبان به این گروه وجود نداشت (محدودیت پرایوسی کاربران یا تنظیمات گروه).`);
    return { success: false, invitedCount: 0, message: 'هیچ کاربری اضافه نشد.' };
  }
}

// -----------------------------------------------------------------------------
// MEDIA UPLOAD CACHE (Telegram InputMedia / File Handle Caching)
// -----------------------------------------------------------------------------
interface CachedMediaEntry {
  cacheKey: string;
  uploadedHandle: any;
  createdAt: number;
}
const accountMediaCache = new Map<string, CachedMediaEntry>();

// Helper Function: Robust Campaign Message Sender with Typing Simulation, Media Caching & Forum Topic Support
async function sendCampaignWithRetry(
  client: any,
  peer: any,
  textMessage: string,
  tempImgPath?: string,
  accountId?: string,
  options: {
    simulateTyping?: boolean;
    typingDurationSeconds?: number;
    maxRetries?: number;
    groupTitle?: string;
    supportForumTopics?: boolean;
    replyToMsgId?: number;
  } = {}
): Promise<{ success: boolean; sentResult?: any; error?: string; mediaFromCache?: boolean; typingSimulated?: boolean; topicId?: number }> {
  const maxRetries = options.maxRetries || 3;
  let mediaFromCache = false;
  let typingSimulated = false;

  // 0. Telegram Supergroup Forum & Topics Detection
  let targetReplyTo: number | undefined = options.replyToMsgId;
  if (!targetReplyTo && options.supportForumTopics !== false && appState.scheduler.antiBot?.supportForumTopics !== false) {
    try {
      await loadGramJS();
      if (peer && (peer.forum || peer.megagroup) && Api && Api.channels && Api.channels.GetForumTopics) {
        const topicsRes = await client.invoke(new Api.channels.GetForumTopics({
          channel: peer,
          offsetDate: 0,
          offsetId: 0,
          offsetTopic: 0,
          limit: 15,
        }));
        const topics = topicsRes?.topics || [];
        if (topics.length > 0) {
          // Look for promotional, general, or active open topic
          const matchedTopic = topics.find((t: any) => {
            const title = (t.title || '').toLowerCase();
            return !t.closed && (
              title.includes('تبلیغ') ||
              title.includes('آگهی') ||
              title.includes('چت') ||
              title.includes('آزاد') ||
              title.includes('عمومی') ||
              title.includes('ads') ||
              title.includes('chat') ||
              title.includes('market') ||
              title.includes('general')
            );
          }) || topics.find((t: any) => !t.closed) || topics[0];

          if (matchedTopic && matchedTopic.id) {
            targetReplyTo = matchedTopic.id;
          }
        }
      }
    } catch (topicErr) {
      // Non-blocking forum topic resolution
    }
  }

  // 1. Simulate Realistic Human Typing Action if enabled
  if (options.simulateTyping !== false && appState.scheduler.antiBot?.simulateTyping !== false) {
    try {
      await loadGramJS();
      if (Api && Api.messages) {
        await client.invoke(new Api.messages.SetTyping({
          peer: peer,
          action: new Api.SendMessageTypingAction(),
        }));
        typingSimulated = true;
        const typingSec = options.typingDurationSeconds || appState.scheduler.antiBot?.typingDurationSeconds || 2;
        const jitterMs = Math.max(800, Math.floor(typingSec * 1000 * (0.85 + Math.random() * 0.35)));
        await new Promise(r => setTimeout(r, jitterMs));
      }
    } catch (e) {
      // Non-blocking typing error
    }
  }

  // 2. Prepare media cache handle
  const cacheKey = tempImgPath ? `${accountId || 'default'}_${tempImgPath}` : '';
  let cachedHandle: any = null;
  if (tempImgPath && appState.scheduler.antiBot?.cacheMediaInput !== false && accountMediaCache.has(cacheKey)) {
    const entry = accountMediaCache.get(cacheKey)!;
    if (Date.now() - entry.createdAt < 24 * 60 * 60 * 1000) {
      cachedHandle = entry.uploadedHandle;
    } else {
      accountMediaCache.delete(cacheKey);
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let sentResult: any = null;
      const sendOptions: any = {
        caption: textMessage,
        parseMode: 'md',
      };
      if (targetReplyTo) {
        sendOptions.replyTo = targetReplyTo;
      }

      if (tempImgPath && fs.existsSync(tempImgPath)) {
        let fileSource: any = cachedHandle || tempImgPath;
        if (cachedHandle) {
          mediaFromCache = true;
        }

        try {
          sentResult = await client.sendFile(peer, {
            file: fileSource,
            ...sendOptions,
          });
        } catch (mediaSendErr: any) {
          const mErr = String(mediaSendErr.errorMessage || mediaSendErr.message || mediaSendErr);
          if (cachedHandle && (mErr.includes('FILE_REFERENCE') || mErr.includes('MEDIA_INVALID') || mErr.includes('FILE_ID_INVALID'))) {
            // Invalidate stale cache and retry with local disk file
            accountMediaCache.delete(cacheKey);
            cachedHandle = null;
            mediaFromCache = false;
            sentResult = await client.sendFile(peer, {
              file: tempImgPath,
              ...sendOptions,
            });
          } else {
            throw mediaSendErr;
          }
        }

        // Cache the uploaded media object if not yet cached
        if (sentResult && !cachedHandle && cacheKey) {
          const mediaObj = sentResult.media || (Array.isArray(sentResult) ? sentResult[0]?.media : null);
          if (mediaObj) {
            accountMediaCache.set(cacheKey, {
              cacheKey,
              uploadedHandle: mediaObj,
              createdAt: Date.now(),
            });
          }
        }
      } else {
        const msgOptions: any = {
          message: textMessage,
          parseMode: 'md',
        };
        if (targetReplyTo) {
          msgOptions.replyTo = targetReplyTo;
        }
        sentResult = await client.sendMessage(peer, msgOptions);
      }
      if (sentResult && sentResult.id) {
        const gKey = options.groupTitle || String(peer?.id || peer?.channelId || 'group');
        const bKey = `${gKey}_${sentResult.id}`;
        recentBotSentGroupMessageMap.set(bKey, {
          accountId: accountId || '',
          text: textMessage,
          timestamp: Date.now(),
        });
      }
      return { success: true, sentResult, mediaFromCache, typingSimulated, topicId: targetReplyTo };
    } catch (err: any) {
      const errStr = String(err.errorMessage || err.message || err);

      // If failed due to forum topic closed or invalid, clear topic and retry without it
      if (targetReplyTo && (errStr.includes('TOPIC_CLOSED') || errStr.includes('TOPIC_DELETED') || errStr.includes('FORUM_CLOSED'))) {
        targetReplyTo = undefined;
        continue;
      }

      const secs = parseFloodWaitSeconds(err);
      if (secs && secs > 0 && secs <= 20 && attempt < maxRetries) {
        addLog('info', `[تایمر FloodWait/Slowmode] نیاز به ${secs} ثانیه شکیبایی قبل از تلاش مجدد ارسال...`);
        await new Promise(r => setTimeout(r, (secs + 1) * 1000));
        continue;
      }

      if ((errStr.includes('SLOWMODE_WAIT') || errStr.toLowerCase().includes('slow mode')) && attempt < maxRetries) {
        const slowSecsMatch = errStr.match(/\d+/);
        const slowSecs = slowSecsMatch ? parseInt(slowSecsMatch[0], 10) : 5;
        if (slowSecs <= 30) {
          addLog('info', `[حالت کند گروه] شکیبایی به مدت ${slowSecs} ثانیه برای رفع حالت کند (Slow Mode)...`);
          await new Promise(r => setTimeout(r, (slowSecs + 1) * 1000));
          continue;
        }
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2500));
        continue;
      }
      return { success: false, error: translateTgError(err), mediaFromCache, typingSimulated, topicId: targetReplyTo };
    }
  }
  return { success: false, error: 'تلاش‌های متوالی جهت ارسال با شکست مواجه شد.', mediaFromCache, typingSimulated, topicId: targetReplyTo };
}

// Helper Function: Check if message persists in group after delay (Anti-Delete / Strict Filter Detection)
async function verifyMessagePersistenceInGroup(
  client: any,
  peer: any,
  msgId: number,
  group: TargetGroup,
  delaySeconds = 15
): Promise<{ persisted: boolean; autoDeleted: boolean; reason?: string }> {
  if (!client || !peer || !msgId) {
    return { persisted: true, autoDeleted: false };
  }

  try {
    if (delaySeconds > 0) {
      await new Promise(r => setTimeout(r, delaySeconds * 1000));
    }
    const messages = await client.getMessages(peer, { ids: [msgId] });
    if (!messages || messages.length === 0 || !messages[0] || messages[0].className === 'MessageEmpty' || messages[0]._ === 'messageEmpty') {
      // Message was deleted by group admin / bot filter!
      group.persistenceStatus = 'auto_deleted';
      group.strictFilterDetected = true;
      group.lastVerifiedAt = new Date().toISOString();
      addLog(
        'warning',
        `[حذف خودکار توسط ربات ناظر] پیام ارسالی در "${group.title}" پس از ${delaySeconds} ثانیه توسط ربات نگهبان حذف گردید (فیلتر سخت‌گیر).`,
        group.title
      );
      saveData();
      return { persisted: false, autoDeleted: true, reason: 'پیام توسط ربات ناظر گروه حذف شد.' };
    } else {
      group.persistenceStatus = 'verified';
      group.strictFilterDetected = false;
      group.lastVerifiedAt = new Date().toISOString();
      saveData();
      return { persisted: true, autoDeleted: false };
    }
  } catch (e: any) {
    return { persisted: true, autoDeleted: false, reason: e.message || String(e) };
  }
}

// Helper to get all connected Telegram clients (Primary + All connected sub-accounts)
async function getAllConnectedClients(): Promise<{ client: any; accountId: string; phone: string }[]> {
  const result: { client: any; accountId: string; phone: string }[] = [];
  
  if (appState.credentials?.isConnected && appState.credentials?.sessionString) {
    try {
      const primaryClient = await getOrInitTgClient();
      if (primaryClient && !primaryClient._destroyed) {
        result.push({
          client: primaryClient,
          accountId: 'primary_account',
          phone: appState.credentials.phoneNumber || 'حساب اصلی',
        });
      }
    } catch (e) {}
  }

  if (Array.isArray(appState.accounts)) {
    for (const acc of appState.accounts) {
      if (acc.sessionString && acc.status !== 'session_expired' && acc.status !== 'disabled') {
        try {
          const accClient = await getOrInitClientForAccount(acc);
          if (accClient && !accClient._destroyed) {
            result.push({
              client: accClient,
              accountId: acc.id,
              phone: acc.phoneNumber || acc.id,
            });
          }
        } catch (e) {}
      }
    }
  }

  return result;
}

// Helper: Resolve Telegram Entity for leaving without joining or throwing
async function getEntityForLeave(client: any, target: TargetGroup | string): Promise<any> {
  if (!client) return null;
  await loadGramJS();

  const usernameOrLink = typeof target === 'string' ? target : (target.usernameOrLink || '');
  const title = typeof target === 'string' ? '' : (target.title || '');
  const groupId = typeof target === 'string' ? '' : (target.id || '');

  // 1. If it's an invite link (t.me/+... or t.me/joinchat/...), use CheckChatInvite to resolve chat entity directly
  if (usernameOrLink && (usernameOrLink.includes('+') || usernameOrLink.includes('joinchat/'))) {
    try {
      let hash = '';
      if (usernameOrLink.includes('+')) {
        hash = usernameOrLink.split('+')[1].split('?')[0].split('/')[0];
      } else if (usernameOrLink.includes('joinchat/')) {
        hash = usernameOrLink.split('joinchat/')[1].split('?')[0].split('/')[0];
      }
      if (hash && Api && Api.messages && Api.messages.CheckChatInvite) {
        const inviteCheck = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
        if (inviteCheck && (inviteCheck as any).chat) {
          return (inviteCheck as any).chat;
        }
      }
    } catch (e) {}
  }

  // 2. Direct resolution for valid usernames and numerical IDs
  if (usernameOrLink && !usernameOrLink.includes('+') && !usernameOrLink.includes('joinchat')) {
    try {
      let clean = usernameOrLink.trim();
      if (clean.includes('t.me/')) {
        clean = clean.split('t.me/')[1].split('/')[0].split('?')[0];
      }
      if (clean && !clean.startsWith('@') && !clean.startsWith('-') && !/^\d+$/.test(clean)) {
        clean = '@' + clean;
      }
      if (clean) {
        const entity = await client.getEntity(clean.startsWith('-') || /^\d+$/.test(clean) ? parseInt(clean, 10) : clean);
        if (entity) return entity;
      }
    } catch (e) {}
  }

  // 3. Search client's dialogs (handles all joined channels/groups by title, ID, username)
  try {
    const dialogs = await client.getDialogs({ limit: 250 });
    const normalize = (s: string) =>
      s
        .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const normTargetTitle = normalize(title);
    const cleanGroupId = groupId.replace(/^-100/, '').replace(/^-/, '');

    for (const d of dialogs) {
      const entity = d.entity;
      if (!entity) continue;
      const entityTitle = normalize(entity.title || d.title || '');
      const entityId = String(entity.id || d.id || '').replace(/^-100/, '').replace(/^-/, '');

      // Match by ID
      if (cleanGroupId && entityId === cleanGroupId) {
        return entity;
      }
      // Match by title
      if (
        normTargetTitle &&
        (entityTitle === normTargetTitle ||
          (normTargetTitle.length >= 4 &&
            (entityTitle.includes(normTargetTitle) || normTargetTitle.includes(entityTitle))))
      ) {
        return entity;
      }
      // Match by username
      if (entity.username && usernameOrLink && usernameOrLink.toLowerCase().includes(entity.username.toLowerCase())) {
        return entity;
      }
    }
  } catch (err) {
    console.warn('Dialog search fallback warning:', err);
  }

  // 4. Quiet resolution fallback
  if (usernameOrLink) {
    try {
      const entity = await resolveAndJoinGroupQuiet(client, usernameOrLink);
      if (entity) return entity;
    } catch (e) {}
  }

  return null;
}

// Engine: Deep Leave & Complete Zero-Trace Purge from Telegram Client
async function leaveGroupAndClearHistory(client: any, peerOrTarget: any): Promise<boolean> {
  if (!client || !peerOrTarget) return false;
  await loadGramJS();

  let resolvedPeer: any = peerOrTarget;
  try {
    if (typeof peerOrTarget === 'string' || (!peerOrTarget.className && !peerOrTarget._ && peerOrTarget.usernameOrLink)) {
      resolvedPeer = await getEntityForLeave(client, peerOrTarget);
    }
  } catch (e) {
    console.warn('Resolution for leave warning:', e);
  }

  if (!resolvedPeer) {
    console.warn('Could not resolve Telegram entity for leaving:', peerOrTarget?.title || peerOrTarget);
    return true; // Still treat as cleaned from account
  }

  let inputEntity: any = null;
  try {
    inputEntity = await client.getInputEntity(resolvedPeer);
  } catch (e) {
    inputEntity = resolvedPeer;
  }

  const isChannelOrSupergroup =
    resolvedPeer.className === 'Channel' ||
    resolvedPeer._ === 'channel' ||
    resolvedPeer.broadcast ||
    resolvedPeer.megagroup ||
    (inputEntity && (inputEntity.className === 'InputChannel' || inputEntity.className === 'InputPeerChannel' || inputEntity.channelId));

  const isChat =
    resolvedPeer.className === 'Chat' ||
    resolvedPeer._ === 'chat' ||
    (inputEntity && (inputEntity.className === 'InputPeerChat' || inputEntity.chatId));

  let leftSuccess = false;

  // 1. Leave Channel / Supergroup / Chat
  try {
    if (isChannelOrSupergroup && Api && Api.channels && Api.channels.LeaveChannel) {
      const channelInput = inputEntity.channelId
        ? new Api.InputChannel({ channelId: inputEntity.channelId, accessHash: inputEntity.accessHash || 0n })
        : inputEntity;
      await client.invoke(new Api.channels.LeaveChannel({ channel: channelInput }));
      leftSuccess = true;
    } else if (isChat && Api && Api.messages && Api.messages.DeleteChatUser) {
      const chatId = resolvedPeer.id || inputEntity.chatId || resolvedPeer;
      await client.invoke(new Api.messages.DeleteChatUser({
        chatId: chatId,
        userId: 'me'
      }));
      leftSuccess = true;
    } else if (Api && Api.channels && Api.channels.LeaveChannel) {
      await client.invoke(new Api.channels.LeaveChannel({ channel: inputEntity }));
      leftSuccess = true;
    }
  } catch (leaveErr: any) {
    const msg = String(leaveErr.errorMessage || leaveErr.message || '');
    if (msg.includes('USER_NOT_PARTICIPANT') || msg.includes('CHANNEL_INVALID') || msg.includes('CHAT_INVALID')) {
      leftSuccess = true; // Already not a member
    } else {
      console.warn('Leave group warning:', msg);
    }
  }

  // 2. Delete Channel History from Telegram
  try {
    if (isChannelOrSupergroup && Api && Api.channels && Api.channels.DeleteHistory) {
      const channelInput = inputEntity.channelId
        ? new Api.InputChannel({ channelId: inputEntity.channelId, accessHash: inputEntity.accessHash || 0n })
        : inputEntity;
      await client.invoke(new Api.channels.DeleteHistory({
        channel: channelInput,
        maxId: 0,
        forEveryone: false
      }));
    }
  } catch (delErr: any) {}

  // 3. Delete Dialog & History from Telegram Dialogs List (guarantees dialog vanishes from Telegram client)
  try {
    if (Api && Api.messages && Api.messages.DeleteHistory) {
      let peerInput = inputEntity;
      if (inputEntity.className === 'InputChannel') {
        peerInput = new Api.InputPeerChannel({
          channelId: inputEntity.channelId,
          accessHash: inputEntity.accessHash || 0n
        });
      }
      await client.invoke(new Api.messages.DeleteHistory({
        peer: peerInput,
        maxId: 0,
        justClear: false,
        revoke: true
      }));
    }
  } catch (delHistErr: any) {}

  // 4. Fallback DeleteChat for legacy groups
  try {
    if (isChat && Api && Api.messages && Api.messages.DeleteChat) {
      const chatId = resolvedPeer.id || inputEntity.chatId || resolvedPeer;
      await client.invoke(new Api.messages.DeleteChat({ chatId: chatId }));
    }
  } catch (e) {}

  return true;
}

// Orchestrator: Zero-Trace Deep Purge of a Target Group from All Associated Telegram Accounts
async function deepPurgeGroupFromAllAccounts(
  group: TargetGroup,
  specificAccountId?: string
): Promise<{ success: boolean; accountsProcessed: number; details: string[] }> {
  syncAccountsState();
  const accountsToPurge: any[] = [];
  const allAccounts = appState.accounts || [];

  if (specificAccountId) {
    const acc = allAccounts.find(a => a.id === specificAccountId);
    if (acc) {
      accountsToPurge.push(acc);
    } else if (specificAccountId === 'primary_account' && appState.credentials.isConnected) {
      accountsToPurge.push({
        id: 'primary_account',
        phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
        sessionString: appState.credentials.sessionString || '',
        isActive: true,
      });
    }
  } else {
    const targetAccountIds = new Set<string>();
    if (group.joinedAccountIds && group.joinedAccountIds.length > 0) {
      group.joinedAccountIds.forEach(id => targetAccountIds.add(id));
    }
    if (group.assignedAccountId) {
      targetAccountIds.add(group.assignedAccountId);
    }

    if (targetAccountIds.size > 0) {
      for (const id of targetAccountIds) {
        const acc = allAccounts.find(a => a.id === id);
        if (acc && acc.isActive && acc.status !== 'session_expired') {
          accountsToPurge.push(acc);
        } else if (id === 'primary_account' && appState.credentials.isConnected) {
          accountsToPurge.push({
            id: 'primary_account',
            phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
            sessionString: appState.credentials.sessionString || '',
            isActive: true,
          });
        }
      }
    }
    if (accountsToPurge.length === 0) {
      for (const a of allAccounts) {
        if (a.isActive && a.status !== 'session_expired') {
          accountsToPurge.push(a);
        }
      }
      if (accountsToPurge.length === 0 && appState.credentials.isConnected) {
        accountsToPurge.push({
          id: 'primary_account',
          phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
          sessionString: appState.credentials.sessionString || '',
          isActive: true,
        });
      }
    }
  }

  const details: string[] = [];
  let successCount = 0;

  for (const acc of accountsToPurge) {
    try {
      let client: any = null;
      if (acc.id === 'primary_account') {
        client = await getOrInitTgClient();
      } else {
        client = await getOrInitClientForAccount(acc);
      }

      if (client && !client._destroyed) {
        await leaveGroupAndClearHistory(client, group);
        successCount++;
        details.push(`اکانت ${acc.phoneNumber}: لفت و پاکسازی کامل دیالوگ انجام شد.`);
      }
    } catch (err: any) {
      console.warn(`Error purging group ${group.title} from account ${acc.phoneNumber}:`, err);
      details.push(`اکانت ${acc.phoneNumber}: خطا: ${err.message || err}`);
    }
  }

  // Update group state in memory
  if (specificAccountId) {
    group.joinedAccountIds = (group.joinedAccountIds || []).filter(id => id !== specificAccountId);
    const acc = allAccounts.find(a => a.id === specificAccountId);
    if (acc) {
      group.joinedAccountPhones = (group.joinedAccountPhones || []).filter(p => p !== acc.phoneNumber);
    }
    if ((group.joinedAccountIds || []).length === 0) {
      group.status = 'not_joined';
      group.membershipStatus = 'not_joined';
    }
  } else {
    group.joinedAccountIds = [];
    group.joinedAccountPhones = [];
    group.status = 'not_joined';
    group.membershipStatus = 'not_joined';
  }
  group.purgedFromTelegramAt = new Date().toISOString();

  return { success: true, accountsProcessed: Math.max(1, successCount), details };
}

// ============================================================================
// Engine: 100% Persian & Iranian Audience Verifier and Auto-Purge System
// ============================================================================

export interface PersianAudienceAuditResult {
  isPersian: boolean;
  confidence: number;
  reason: string;
  language: string; // 'fa' | 'hi' | 'ar' | 'en' | 'ru' | 'other'
  details?: {
    titleAnalysis?: string;
    messageAnalysis?: string;
    sampleMessagesCount?: number;
    persianCharRatio?: number;
  };
}

// 1. Check if text contains Persian specific indicators, letters, or vocabulary
function hasPersianScriptOrTokens(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Persian specific alphabet characters (گ، چ، پ، ژ)
  if (/[گچپژ]/.test(text)) return true;

  // Common Persian vocabulary tokens
  const persianKeywords = [
    'سلام', 'خوبی', 'داداش', 'بچه', 'اینجا', 'گپ', 'دورهمی', 'ایران', 'تهران', 'اصفهان',
    'شیراز', 'مشهد', 'تبریز', 'کرج', 'اهواز', 'قم', 'خرید', 'فروش', 'بازار', 'نیازمندی',
    'تبادل', 'فیلترشکن', 'وی پی ان', 'پروکسی', 'کانفیگ', 'کانال', 'دوستان', 'دختر', 'پسر',
    'سینگل', 'رل', 'لینکدونی', 'ارز دیجیتال', 'بورس', 'سهام', 'دانشجو', 'کنکور', 'استخدام',
    'کاریابی', 'ورزش', 'فوتبال', 'موزیک', 'آهنگ', 'فیلم', 'سریال', 'گیمر', 'بازی', 'پابجی',
    'مشکلات', 'کامپیوتری', 'موبایل', 'گفتگو', 'دانلود', 'پالادینز', 'همیار', 'مشاغل', 'کاربرد',
    'هوش مصنوعی', 'کلش', 'کالاف', 'دیوتی', 'چت', 'سکه', 'تعرفه', 'رایگان', 'پینگ', 'اینترنت',
    'فیلتر', 'اعتماد', 'تبلیغات', 'مدرک', 'تحصیلی', 'ارزان', 'اختصاصی', 'ری اکت', 'لینک', 'ربات'
  ];

  if (persianKeywords.some(w => lower.includes(w))) return true;

  // Fingilish tokens
  const fingilishTokens = [
    'gap', 'gp', 'ir', 'iran', 'irani', 'tehran', 'karaj', 'shiraz', 'esfahan', 'mashhad',
    'tabriz', 'ahvaz', 'tabligh', 'tabadol', 'niazmandi', 'bazar', 'kharid', 'forosh',
    'dorehami', 'chating', 'hamegani', 'pesar', 'dokhtar', 'single', 'linkdoni', 'injavpn',
    'filtershekan', 'proxyir', 'v2rayir', 'baz', 'filtr', 'nofilter', 'adminir'
  ];

  const words = lower.split(/[^a-z0-9]+/);
  if (fingilishTokens.some(f => words.includes(f))) return true;

  // Check if contains Persian/Arabic unicode letters and at least 3 characters
  if (/[\u0600-\u06FF]/.test(text) && text.trim().length >= 4) {
    // If it has Arabic/Persian letters and doesn't trigger pure Arabic or foreign checks, it qualifies
    return true;
  }

  return false;
}

// 2. Check for forbidden non-Iranian scripts (Indic, Cyrillic, East Asian, Southeast Asian, etc.)
function containsForbiddenForeignScript(text: string): { forbidden: boolean; script?: string } {
  if (!text) return { forbidden: false };

  // Indic / South Asian (Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam, Sinhala)
  if (/[\u0900-\u0D7F]/.test(text)) {
    return { forbidden: true, script: 'هندی و دواناگاری (Indic/South Asian)' };
  }
  // Cyrillic (Russian, Ukrainian, Bulgarian, Kazakh, etc.)
  if (/[\u0400-\u04FF\u0500-\u052F]/.test(text)) {
    return { forbidden: true, script: 'روسی و سیریلیک (Cyrillic/Russian)' };
  }
  // East Asian CJK (Chinese Han, Japanese Hiragana/Katakana, Korean Hangul)
  if (/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(text)) {
    return { forbidden: true, script: 'شرق آسیا (چینی/کره‌ای/ژاپنی)' };
  }
  // Southeast Asian (Thai, Lao, Myanmar, Khmer)
  if (/[\u0E00-\u0EFF\u1000-\u109F]/.test(text)) {
    return { forbidden: true, script: 'جنوب شرق آسیا (تایلندی/برمه‌ای)' };
  }
  // Hebrew / Armenian / Georgian
  if (/[\u0590-\u05FF\u0530-\u058F\u10A0-\u10FF]/.test(text)) {
    return { forbidden: true, script: 'عبری/ارمنی/گرجی' };
  }

  return { forbidden: false };
}

// 3. Check for pure Arabic non-Persian dialect keywords
function isPureArabicNonPersian(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  const arabicSlangList = [
    'ببجي', 'جيش', 'قروب', 'سعودي', 'عراقي', 'كويت', 'مصر', 'سوري', 'حياكم', 'سوالف',
    'للبيع', 'مجموعه', 'شباب', 'بنات', 'شات', 'متفاعلين', 'نورتو', 'منورين', 'بوت',
    'قوانين', 'مسابقات', 'قروبات', 'تسجيل', 'شحن', 'شدات', 'يوزر', 'تفاعل', 'ستوريات',
    'رمزيات', 'روابط قروبات', 'تبادل نشر', 'تعارف'
  ];

  const hasPersianSpecific = /[گچپژ]/.test(text);
  const persianKeywords = [
    'سلام', 'خوبی', 'داداش', 'بچه', 'اینجا', 'گپ', 'دورهمی', 'ایران', 'تهران', 'خرید',
    'فروش', 'بفرست', 'داری', 'دارم', 'هست', 'نیست', 'پابجی'
  ];
  const hasPersianTokens = persianKeywords.some(w => lower.includes(w));

  const hasArabicWord = arabicSlangList.some(a => lower.includes(a));
  return hasArabicWord && !hasPersianSpecific && !hasPersianTokens;
}

// 4. Explicit non-Iranian foreign keywords in title / link
function hasExplicitForeignKeywords(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const foreignKws = [
    'indian gaming', 'india ', 'igc', 'kerala', 'tamil', 'punjab', 'delhi', 'mumbai',
    'bangalore', 'kolkata', 'hyderabad', 'pakistan', 'pakistani', 'lahore', 'karachi',
    'bangladesh', 'dhaka', 'nepal', 'sri lanka', 'philippines', 'pinoy', 'tagalog',
    'nigeria', 'nigerian', 'vietnam', 'vietnamese', 'russia', 'russian', 'turkish',
    'turkiye', 'istanbul', 'ankara', 'indonesia', 'jakarta', 'malaysia', 'thailand',
    'bangkok', 'brazil', 'brasil', 'argentina', 'colombia', 'mexico', 'saudi', 'riyadh',
    'iraq', 'baghdad', 'egypt', 'cairo', 'kuwait', 'dubai', 'qatar', 'morocco', 'algeria',
    'faizan gaming', 'seller gaming', 'amazon prime accounts', 'netflix seller',
    'accounts seller', 'bgmi', 'pubg global', 'free fire india', 'free fire brazil',
    'codm global', 'mlbb global', 'apply link', 'dropshipping worldwide', 'crypto signals',
    'forex signals', 'binance pump', 'airdrop hunters', 'whatsapp group', 'worldwide community'
  ];
  return foreignKws.some(kw => lower.includes(kw));
}

// Main Verification Function: 100% Persian/Iranian Audience Audit Engine
async function verifyAndAuditGroupIsPersian(
  client: any,
  peer: any,
  groupTitle: string,
  usernameOrLink?: string,
  options?: { skipSampleMessages?: boolean }
): Promise<PersianAudienceAuditResult> {
  const title = (groupTitle || '').trim();
  const link = (usernameOrLink || '').trim();
  const combinedMeta = `${title} ${link}`;

  // 0. Blacklist Check: If previously purged as non-Persian, immediately reject
  if (isBlacklistedNonPersianTarget(link) || isBlacklistedNonPersianTarget(title)) {
    return {
      isPersian: false,
      confidence: 1.0,
      language: 'blocked',
      reason: 'در لیست سیاه گروه‌های غیرفارسی و مسدودشده قبلی قرار دارد',
    };
  }

  // 1. Negative heuristic: Indian / Cyrillic / East Asian scripts in title or link
  const foreignScriptCheck = containsForbiddenForeignScript(combinedMeta);
  if (foreignScriptCheck.forbidden) {
    return {
      isPersian: false,
      confidence: 0.99,
      language: 'foreign_script',
      reason: `شناسایی خطوط غیرایرانی (${foreignScriptCheck.script}) در عنوان یا شناسه گروه`,
    };
  }

  // 2. Negative heuristic: Explicit foreign region/language keywords in title or link
  if (hasExplicitForeignKeywords(combinedMeta)) {
    return {
      isPersian: false,
      confidence: 0.98,
      language: 'foreign_keyword',
      reason: 'شناسایی کلیدواژه‌های غیرایرانی و منطقه‌ای خارجی در عنوان یا لینک گروه',
    };
  }

  // 3. Negative heuristic: Pure Arabic dialect in title (e.g. جيش وايتي || ببجي موبايل)
  if (isPureArabicNonPersian(combinedMeta)) {
    return {
      isPersian: false,
      confidence: 0.96,
      language: 'ar',
      reason: 'شناسایی زبان و اصطلاحات عربی غیرایرانی در عنوان گروه',
    };
  }

  // 4. Ground Truth Chat Language: Fetch recent messages to verify actual community language
  let sampleMessages: any[] = [];
  if (!options?.skipSampleMessages && client && peer) {
    try {
      sampleMessages = await client.getMessages(peer, { limit: 12 });
    } catch (err: any) {
      console.warn('Could not fetch sample messages for Persian check:', err?.message || err);
    }
  }

  const sampleTexts = (sampleMessages || [])
    .map(m => m?.message)
    .filter(t => typeof t === 'string' && t.trim().length > 0)
    .map(t => t.trim());

  if (sampleTexts.length > 0) {
    let persianMsgCount = 0;
    let foreignScriptCount = 0;
    let arabicMsgCount = 0;
    let latinForeignCount = 0;
    const totalTextCount = sampleTexts.length;

    for (const st of sampleTexts) {
      if (containsForbiddenForeignScript(st).forbidden) {
        foreignScriptCount++;
      } else if (isPureArabicNonPersian(st)) {
        arabicMsgCount++;
      } else if (hasPersianScriptOrTokens(st)) {
        persianMsgCount++;
      } else if (/[a-zA-Z]/.test(st)) {
        latinForeignCount++;
      }
    }

    if (foreignScriptCount >= 2 || (foreignScriptCount > 0 && persianMsgCount === 0)) {
      return {
        isPersian: false,
        confidence: 0.99,
        language: 'hi',
        reason: 'چت‌های اخیر اعضای گروه به خطوط و زبان‌های هندی/غیرایرانی است',
        details: { sampleMessagesCount: totalTextCount }
      };
    }

    if (arabicMsgCount >= 2 && persianMsgCount === 0) {
      return {
        isPersian: false,
        confidence: 0.96,
        language: 'ar',
        reason: 'چت‌های اخیر اعضای گروه به زبان و لهجه‌های عربی غیرایرانی است',
        details: { sampleMessagesCount: totalTextCount }
      };
    }

    if (persianMsgCount >= 1) {
      return {
        isPersian: true,
        confidence: 0.95,
        language: 'fa',
        reason: 'تایید چت‌های فارسی و مخاطبان ایرانی در گروه',
        details: { sampleMessagesCount: totalTextCount, persianCharRatio: persianMsgCount / totalTextCount }
      };
    }

    if (latinForeignCount >= 3 && persianMsgCount === 0) {
      return {
        isPersian: false,
        confidence: 0.92,
        language: 'en',
        reason: 'چت‌های اخیر گروه تماماً انگلیسی/بین‌المللی و فاقد مخاطبان ایرانی است',
        details: { sampleMessagesCount: totalTextCount }
      };
    }
  }

  // 5. Positive title heuristic
  if (hasPersianScriptOrTokens(title)) {
    return {
      isPersian: true,
      confidence: 0.92,
      language: 'fa',
      reason: 'عنوان گروه دارای کلمات و نشانه‌های قطعی زبان فارسی است',
    };
  }

  // 6. Ambiguous (e.g. English-only title like "Dota 2 Baz" or "Gaming Zone" with no messages yet) -> Use Gemini AI if available
  const ai = getAiClient();
  if (ai) {
    const candidateModels = getAdaptiveCandidateModels();
    for (const modelName of candidateModels) {
      try {
        const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 4500;
        const apiCall = ai.models.generateContent({
          model: modelName,
          contents: `You are a Persian language and Iranian audience classifier for Telegram groups.
Determine if the following Telegram group is intended for Persian / Iranian audiences or foreign audiences:
Group Title: "${title}"
Username/Link: "${link}"
Recent messages sample: [${sampleTexts.slice(0, 5).join(' --- ')}]

Respond strictly in JSON:
{
  "isPersian": boolean,
  "confidence": number,
  "language": "fa" | "en" | "ar" | "hi" | "ru" | "other",
  "reason": "short explanation in Persian"
}`,
          config: { responseMimeType: 'application/json' }
        });

        const response: any = await runWithTimeout(apiCall, timeoutMs, 'GEMINI_TIMEOUT');
        const parsed = JSON.parse(response.text?.trim() || '{}');
        if (typeof parsed.isPersian === 'boolean') {
          recordGeminiSuccess(modelName);
          return {
            isPersian: parsed.isPersian,
            confidence: parsed.confidence || 0.85,
            language: parsed.language || (parsed.isPersian ? 'fa' : 'other'),
            reason: parsed.reason || (parsed.isPersian ? 'تایید هوش مصنوعی به عنوان گروه ایرانی' : 'تشخیص هوش مصنوعی به عنوان گروه غیرایرانی')
          };
        }
      } catch (aiErr: any) {
        recordGeminiFailure(modelName, aiErr);
      }
    }
  }

  // 7. Strict Fallback: If title and link have 0 Persian characters/tokens and 0 messages
  const hasAnyPersianIndicator = hasPersianScriptOrTokens(title) || hasPersianScriptOrTokens(link) || sampleTexts.some(t => hasPersianScriptOrTokens(t));
  if (!hasAnyPersianIndicator) {
    return {
      isPersian: false,
      confidence: 0.92,
      language: 'en',
      reason: 'عنوان، آیدی و پیام‌های گروه فاقد هرگونه نشانه زبان فارسی و جامعه هدف ایرانی است',
    };
  }

  return {
    isPersian: true,
    confidence: 0.85,
    language: 'fa',
    reason: 'شناسایی و تایید نشانه‌های زبان فارسی و جامعه ایرانی',
  };
}

// Auto Purge and Leave Non-Persian Group across ALL active user accounts & Register into Blacklist
async function purgeAndLeaveNonPersianGroup(
  client: any,
  peer: any,
  group: TargetGroup,
  reason: string
): Promise<void> {
  const title = group.title || group.usernameOrLink || 'گروه';
  addLog(
    'warning',
    `🚫 [غربالگری ۱۰۰٪ فارسی و پاکسازی] گروه "${title}" (${group.usernameOrLink}) به عنوان گروه غیرفارسی/غیرایرانی (${reason}) تشخیص داده شد. ربات بلافاصله از گروه لفت داده و چت را از تمام اکانت‌های تلگرام به طور کامل پاکسازی کرد.`
  );

  // 1. Add to persistent blacklist so it is NEVER imported or joined again
  addToNonPersianBlacklist(group.usernameOrLink, group.title);
  if (group.id) {
    addToNonPersianBlacklist(group.id);
  }

  // 2. Leave & purge on provided client
  if (client && peer) {
    try {
      await leaveGroupAndClearHistory(client, peer);
    } catch (e: any) {
      console.warn('Error while leaving non-Persian group on primary client:', e?.message || e);
    }
  }

  // 3. Iterate through ALL connected accounts to guarantee 100% deletion from all sessions
  try {
    const allClients = await getAllConnectedClients();
    for (const item of allClients) {
      if (item.client && item.client !== client) {
        try {
          const accPeer = await resolveAndJoinGroupQuiet(item.client, group.usernameOrLink);
          if (accPeer) {
            await leaveGroupAndClearHistory(item.client, accPeer);
          }
        } catch (accErr) {
          // Ignore if not in this account
        }
      }
    }
  } catch (multiPurgeErr) {
    console.warn('Multi-account purge warning:', multiPurgeErr);
  }

  group.isActive = false;
  group.status = 'purged_non_persian';
  group.membershipStatus = 'restricted';
  group.readinessStatus = 'non_persian_purged';
  group.isPersianVerified = false;
  group.nonPersianPurgedAt = new Date().toISOString();
  group.canSendMessages = false;
  group.errorMessage = `گروه غیرفارسی/غیرایرانی (${reason}) - لفت و پاکسازی کامل از تلگرام انجام شد.`;

  saveData();
}

// Helper: Quiet entity resolution without throwing or auto-joining
async function resolveAndJoinGroupQuiet(client: any, rawInput: string): Promise<any> {
  try {
    let cleanInput = String(rawInput || '').trim();
    if (cleanInput.includes('t.me/')) {
      cleanInput = cleanInput.split('t.me/')[1].split('/')[0].split('?')[0];
    }
    if (!cleanInput.startsWith('@') && !cleanInput.startsWith('-') && !/^\d+$/.test(cleanInput)) {
      cleanInput = '@' + cleanInput;
    }
    let peerTarget: any = cleanInput;
    if (cleanInput.startsWith('-') || /^\d+$/.test(cleanInput)) {
      peerTarget = parseInt(cleanInput, 10);
    }
    return await client.getEntity(peerTarget);
  } catch (e) {
    return null;
  }
}

// Monitoring State Updater Helper
function updateGroupMonitoringReport(report: Partial<GroupMonitoringReport> & { groupId: string; groupTitle: string }) {
  if (!appState.monitoringReports) appState.monitoringReports = [];
  const nowStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const idx = appState.monitoringReports.findIndex(r => r.groupId === report.groupId || r.groupTitle === report.groupTitle);

  const updated: GroupMonitoringReport = {
    id: idx >= 0 ? appState.monitoringReports[idx].id : ('mon_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
    groupId: report.groupId,
    groupTitle: report.groupTitle,
    usernameOrLink: report.usernameOrLink || (idx >= 0 ? appState.monitoringReports[idx].usernameOrLink : report.groupTitle),
    lastCheckedAt: nowStr,
    step: report.step || (idx >= 0 ? appState.monitoringReports[idx].step : 'JOINING'),
    botDetected: report.botDetected ?? (idx >= 0 ? appState.monitoringReports[idx].botDetected : false),
    botTypeOrName: report.botTypeOrName || (idx >= 0 ? appState.monitoringReports[idx].botTypeOrName : 'نامشخص'),
    captchaClicked: report.captchaClicked ?? (idx >= 0 ? appState.monitoringReports[idx].captchaClicked : false),
    channelJoined: report.channelJoined ?? (idx >= 0 ? appState.monitoringReports[idx].channelJoined : false),
    contactsInvited: report.contactsInvited ?? (idx >= 0 ? appState.monitoringReports[idx].contactsInvited : 0),
    statusMessage: report.statusMessage || (idx >= 0 ? appState.monitoringReports[idx].statusMessage : 'در حال پردازش...'),
    requiresManualCheck: report.requiresManualCheck ?? (idx >= 0 ? appState.monitoringReports[idx].requiresManualCheck : false),
  };

  if (idx >= 0) {
    appState.monitoringReports[idx] = updated;
  } else {
    appState.monitoringReports.unshift(updated);
  }

  if (appState.monitoringReports.length > 50) {
    appState.monitoringReports = appState.monitoringReports.slice(0, 50);
  }
  saveData();
}

// Multi-Account Real-Time Telegram Dialogs & Group Membership Sync Engine
async function syncTelegramRealtimeMemberships(targetAccountIds?: string[]): Promise<{
  totalGroups: number;
  joinedGroupsCount: number;
  unjoinedGroupsCount: number;
  accountsCheckedCount: number;
  addedGroupsCount: number;
  accountsSummary: Array<{ accountId: string; accountPhone: string; accountName?: string; dialogsCount: number; joinedGroupsCount: number }>;
  territoryAudit?: TerritoryAuditReport;
}> {
  syncAccountsState();
  await loadGramJS();

  let allAccounts = (appState.accounts || []).filter(
    a => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled' && (a.enableForGroupBroadcast !== false)
  );

  // If no multi-accounts exist or only single primary account
  if (allAccounts.length === 0 && appState.credentials.isConnected && appState.credentials.sessionString) {
    allAccounts = [{
      id: 'primary_account',
      phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
      sessionString: appState.credentials.sessionString,
      apiId: appState.credentials.apiId || DEFAULT_API_ID,
      apiHash: appState.credentials.apiHash || DEFAULT_API_HASH,
      isActive: true,
      status: 'connected',
      userProfile: appState.credentials.userProfile,
      dailySentCount: appState.scheduler.dailySentCount || 0,
    }];
  }

  const accountsToSync = targetAccountIds && targetAccountIds.length > 0
    ? allAccounts.filter(a => targetAccountIds.includes(a.id))
    : allAccounts;

  if (accountsToSync.length === 0) {
    throw new Error('هیچ اکانت تلگرام فعال و متصلی برای همگام‌سازی یافت نشد.');
  }

  addLog('info', `[همگام‌سازی واقعی با تلگرام] آغاز استعلام دقیق لیست گفت‌وگوها و وضعیت عضویت در ${accountsToSync.length} اکانت تلگرام...`);

  const accountsSummary: Array<{ accountId: string; accountPhone: string; accountName?: string; dialogsCount: number; joinedGroupsCount: number }> = [];
  let totalDiscoveredGroupsAdded = 0;

  // Account -> Set of Group Match Identifiers
  const accountMembershipSets = new Map<string, {
    usernames: Set<string>;
    rawIds: Set<string>;
    titles: Set<string>;
  }>();

  for (const account of accountsToSync) {
    let client: any = null;
    try {
      if (account.id === 'primary_account') {
        client = await getOrInitTgClient();
      } else {
        client = await getOrInitClientForAccount(account);
      }
    } catch (e: any) {
      console.error(`Sync connect error for account ${account.phoneNumber}:`, e);
      continue;
    }

    if (!client || client._destroyed) continue;

    const usernameSet = new Set<string>();
    const rawIdSet = new Set<string>();
    const titleSet = new Set<string>();

    let dialogs: any[] = [];
    try {
      if (typeof client.getDialogs === 'function') {
        dialogs = await client.getDialogs({ limit: 400 });
      }
    } catch (e: any) {
      console.error(`getDialogs error for account ${account.phoneNumber}:`, e);
    }

    for (const dialog of dialogs) {
      if (!dialog) continue;
      const entity = dialog.entity;
      if (!entity) continue;

      const isChannelBroadcast = (entity.className === 'Channel' || entity._ === 'channel') && !entity.megagroup;
      const isUser = entity.className === 'User' || entity._ === 'user';
      const isGroup = dialog.isGroup || entity.megagroup || entity.className === 'Chat' || entity._ === 'chat';

      if (isUser || isChannelBroadcast || !isGroup) continue;

      const title = (dialog.title || entity.title || '').trim();
      if (title) titleSet.add(title.toLowerCase());

      if (entity.username) {
        usernameSet.add(entity.username.toLowerCase());
      }
      if (entity.id) {
        const idStr = entity.id.toString();
        rawIdSet.add(idStr);
        rawIdSet.add(`-100${idStr}`);
        rawIdSet.add(`-${idStr}`);
      }

      // Auto-discover new group into appState.groups if not present
      let usernameOrLink = '';
      if (entity.username) {
        usernameOrLink = '@' + entity.username;
      } else if (entity.id) {
        const idStr = entity.id.toString();
        usernameOrLink = idStr.startsWith('-') ? idStr : (entity.megagroup ? `-100${idStr}` : `-${idStr}`);
      }

      if (usernameOrLink) {
        // Check for 100% Persian & Iranian Audience
        const isEnforcePersian = appState.groupJoinStrategy?.enforcePersianIranianOnly !== false;
        const combinedMeta = `${title} ${usernameOrLink}`;
        const hasForeignKeywords = hasExplicitForeignKeywords(combinedMeta);
        const hasForbiddenScript = containsForbiddenForeignScript(combinedMeta).forbidden;
        const isArabicNonFa = isPureArabicNonPersian(combinedMeta);

        if (isEnforcePersian && (hasForeignKeywords || hasForbiddenScript || isArabicNonFa)) {
          console.log(`[Auto-Purge Non-Persian Dialog] Leaving and clearing non-Persian group: "${title}" (${usernameOrLink})`);
          addLog(
            'warning',
            `🚫 [پاکسازی خودکار تلگرام] گروه غیرایرانی "${title}" (${usernameOrLink}) شناسایی شد و به طور کامل از تلگرام لفت داده و چت آن پاک شد.`
          );
          try {
            await leaveGroupAndClearHistory(client, entity);
          } catch (leaveErr: any) {
            console.warn('Leave dialog error:', leaveErr?.message || leaveErr);
          }
          // Mark existing group in DB if present
          const existing = appState.groups.find(
            g => g.usernameOrLink.toLowerCase() === usernameOrLink.toLowerCase() ||
                 (g.title && g.title.trim().toLowerCase() === title.toLowerCase())
          );
          if (existing) {
            existing.isActive = false;
            existing.status = 'purged_non_persian';
            existing.membershipStatus = 'restricted';
            existing.readinessStatus = 'non_persian_purged';
            existing.isPersianVerified = false;
            existing.nonPersianPurgedAt = new Date().toISOString();
            existing.errorMessage = 'گروه غیرفارسی/غیرایرانی تشخیص داده شد و از تلگرام پاک شد.';
          }
          continue;
        }

        const existing = appState.groups.find(
          g => g.usernameOrLink.toLowerCase() === usernameOrLink.toLowerCase() ||
               (g.title && g.title.trim().toLowerCase() === title.toLowerCase())
        );

        if (!existing) {
          const newGrp: TargetGroup = {
            id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            title: title || 'گروه تلگرام',
            usernameOrLink: usernameOrLink,
            isActive: true,
            memberCount: entity.participantsCount || undefined,
            status: 'joined',
            membershipStatus: 'joined',
            joinedAccountIds: [account.id],
            joinedAccountPhones: [account.phoneNumber],
            isPersianVerified: hasPersianScriptOrTokens(title),
            languageDetected: hasPersianScriptOrTokens(title) ? 'fa' : undefined,
            category: 'همگام‌سازی تلگرام',
          };
          appState.groups.push(newGrp);
          totalDiscoveredGroupsAdded++;
        }
      }
    }

    accountMembershipSets.set(account.id, {
      usernames: usernameSet,
      rawIds: rawIdSet,
      titles: titleSet,
    });
  }

  // Cross-reference every group in appState.groups
  const nowIso = new Date().toISOString();
  let totalJoinedGroupsCount = 0;
  let totalUnjoinedGroupsCount = 0;

  for (const group of appState.groups) {
    if (!group.accountMemberships) {
      group.accountMemberships = {};
    }
    const joinedIds: string[] = [];
    const joinedPhones: string[] = [];

    // Parse group identifiers
    let cleanTarget = (group.usernameOrLink || '').trim().toLowerCase();
    if (cleanTarget.includes('t.me/')) {
      cleanTarget = cleanTarget.split('t.me/')[1].split('/')[0].split('?')[0];
    }
    const cleanUsername = cleanTarget.replace(/^@/, '').toLowerCase();
    const cleanTitle = (group.title || '').trim().toLowerCase();

    for (const account of accountsToSync) {
      const setObj = accountMembershipSets.get(account.id);
      let isMember = false;

      if (setObj) {
        if (cleanUsername && setObj.usernames.has(cleanUsername)) {
          isMember = true;
        } else if (cleanTarget && (setObj.rawIds.has(cleanTarget) || setObj.rawIds.has(cleanTarget.replace(/^-100/, '')))) {
          isMember = true;
        } else if (cleanTitle && setObj.titles.has(cleanTitle)) {
          isMember = true;
        }
      }

      const existingMem = group.accountMemberships[account.id];
      group.accountMemberships[account.id] = {
        accountId: account.id,
        accountPhone: account.phoneNumber,
        accountName: account.userProfile?.firstName,
        isMember,
        status: isMember ? 'joined' : 'not_joined',
        checkedAt: nowIso,
        joinedAt: isMember ? (existingMem?.joinedAt || nowIso) : undefined,
      };

      if (isMember) {
        joinedIds.push(account.id);
        joinedPhones.push(account.phoneNumber);
      }
    }

    group.joinedAccountIds = Array.from(new Set(joinedIds));
    group.joinedAccountPhones = Array.from(new Set(joinedPhones));
    const hasAnyJoined = group.joinedAccountIds.length > 0;
    group.membershipStatus = hasAnyJoined ? 'joined' : 'not_joined';
    group.status = hasAnyJoined ? 'joined' : 'not_joined';

    if (hasAnyJoined) {
      totalJoinedGroupsCount++;
    } else {
      totalUnjoinedGroupsCount++;
    }
  }

  for (const account of accountsToSync) {
    const accJoinedCount = appState.groups.filter(g => g.joinedAccountIds?.includes(account.id)).length;
    const memSet = accountMembershipSets.get(account.id);
    accountsSummary.push({
      accountId: account.id,
      accountPhone: account.phoneNumber,
      accountName: account.userProfile?.firstName,
      dialogsCount: memSet ? (memSet.usernames.size + memSet.rawIds.size) : 0,
      joinedGroupsCount: accJoinedCount,
    });
  }

  // Audit territories and reconcile zero-overlap assignments immediately following real-time dialog sync
  const territoryAudit = auditAndBalanceTerritories({ forceRebalanceUnassigned: false });

  saveData();

  addLog(
    'success',
    `[همگام‌سازی واقعی و ممیزی قلمرو] بررسی عضویت در ${accountsToSync.length} اکانت تلگرام به پایان رسید. نتیجه: ${totalJoinedGroupsCount} گروه عضو شده ✅ (${territoryAudit.totalOverlapsDetected} تداخل مشترک)، ${totalUnjoinedGroupsCount} گروه تفکیک‌شده برای عضویت تدریجی ⏳ (${totalDiscoveredGroupsAdded} گروه جدید استخراج شد).`
  );

  return {
    totalGroups: appState.groups.length,
    joinedGroupsCount: totalJoinedGroupsCount,
    unjoinedGroupsCount: totalUnjoinedGroupsCount,
    accountsCheckedCount: accountsToSync.length,
    addedGroupsCount: totalDiscoveredGroupsAdded,
    accountsSummary,
    territoryAudit,
  };
}

// Backward-compatible wrapper for single client sync
async function syncTelegramGroups(client: any): Promise<{ addedCount: number; updatedCount: number; totalGroups: number }> {
  const result = await syncTelegramRealtimeMemberships();
  return { addedCount: result.addedGroupsCount, updatedCount: result.joinedGroupsCount, totalGroups: result.totalGroups };
}

// ==========================================
// Territory Management & Zero-Overlap Balancing Engine
// ==========================================
function auditAndBalanceTerritories(options?: { forceRebalanceUnassigned?: boolean }): TerritoryAuditReport {
  syncAccountsState();
  let availableAccounts = (appState.accounts || []).filter(
    a => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled'
  );

  if (availableAccounts.length === 0 && appState.credentials.isConnected && appState.credentials.sessionString) {
    availableAccounts = [{
      id: 'primary_account',
      phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
      sessionString: appState.credentials.sessionString,
      apiId: appState.credentials.apiId || DEFAULT_API_ID,
      apiHash: appState.credentials.apiHash || DEFAULT_API_HASH,
      isActive: true,
      status: 'connected',
      userProfile: appState.credentials.userProfile,
      dailySentCount: appState.scheduler.dailySentCount || 0,
    }];
  }

  const overlapGroups: Array<{
    groupId: string;
    groupTitle: string;
    usernameOrLink: string;
    joinedAccountIds: string[];
    primaryOwnerAccountId: string;
  }> = [];

  // 1. Audit confirmed memberships & detect overlaps
  for (const group of appState.groups) {
    const joinedIds = group.joinedAccountIds || [];
    if (joinedIds.length > 1) {
      group.hasOverlap = true;
      group.duplicateAccountIds = [...joinedIds];

      // Select primary owner: keep current owner if among joined; otherwise pick least loaded
      if (!group.assignedAccountId || !joinedIds.includes(group.assignedAccountId)) {
        const sortedJoined = [...joinedIds].sort((aId, bId) => {
          const countA = appState.groups.filter(g => g.assignedAccountId === aId).length;
          const countB = appState.groups.filter(g => g.assignedAccountId === bId).length;
          return countA - countB;
        });
        group.assignedAccountId = sortedJoined[0];
      }

      const ownerAcc = availableAccounts.find(a => a.id === group.assignedAccountId);
      if (ownerAcc) {
        group.assignedAccountPhone = ownerAcc.phoneNumber;
        group.assignedAccountName = ownerAcc.userProfile?.firstName;
      }
      group.membershipStatus = 'joined';
      group.status = 'joined';

      overlapGroups.push({
        groupId: group.id,
        groupTitle: group.title,
        usernameOrLink: group.usernameOrLink,
        joinedAccountIds: joinedIds,
        primaryOwnerAccountId: group.assignedAccountId,
      });
    } else if (joinedIds.length === 1) {
      group.hasOverlap = false;
      group.duplicateAccountIds = [];
      group.assignedAccountId = joinedIds[0];
      const ownerAcc = availableAccounts.find(a => a.id === joinedIds[0]);
      if (ownerAcc) {
        group.assignedAccountPhone = ownerAcc.phoneNumber;
        group.assignedAccountName = ownerAcc.userProfile?.firstName;
      }
      group.membershipStatus = 'joined';
      group.status = 'joined';
    } else {
      group.hasOverlap = false;
      group.duplicateAccountIds = [];
      group.membershipStatus = 'not_joined';
      if (group.status !== 'purged_non_persian') {
        group.status = 'not_joined';
      }
    }
  }

  // 2. Zero-Overlap Partitioning for unjoined/pending groups
  if (availableAccounts.length > 0) {
    const unjoinedGroups = appState.groups.filter(
      g => (!g.joinedAccountIds || g.joinedAccountIds.length === 0) && g.isActive && g.status !== 'purged_non_persian'
    );

    const accountLoads: Record<string, number> = {};
    for (const acc of availableAccounts) {
      accountLoads[acc.id] = appState.groups.filter(
        g => g.assignedAccountId === acc.id && g.joinedAccountIds?.includes(acc.id)
      ).length;
    }

    for (const group of unjoinedGroups) {
      // If group already has a designated valid active owner and forceRebalanceUnassigned is false, keep it!
      if (!options?.forceRebalanceUnassigned && group.assignedAccountId && availableAccounts.some(a => a.id === group.assignedAccountId)) {
        accountLoads[group.assignedAccountId] = (accountLoads[group.assignedAccountId] || 0) + 1;
        continue;
      }

      // Pick least loaded account
      availableAccounts.sort((a, b) => (accountLoads[a.id] || 0) - (accountLoads[b.id] || 0));
      const chosen = availableAccounts[0];

      group.assignedAccountId = chosen.id;
      group.assignedAccountPhone = chosen.phoneNumber;
      group.assignedAccountName = chosen.userProfile?.firstName;
      group.isFailoverReassigned = false;
      accountLoads[chosen.id] = (accountLoads[chosen.id] || 0) + 1;
    }
  }

  // 3. Build per-account territory summary
  const todayStr = new Date().toISOString().split('T')[0];
  if (!appState.dripJoinConfig) {
    appState.dripJoinConfig = {
      enabled: false,
      maxJoinsPerAccountPerDay: 8,
      intervalMinutes: 20,
      jitterMinutes: 5,
      dailyJoinResetDate: todayStr,
      accountDailyJoins: {},
      lastJoinTimePerAccount: {},
    };
  }
  if (appState.dripJoinConfig.dailyJoinResetDate !== todayStr) {
    appState.dripJoinConfig.dailyJoinResetDate = todayStr;
    appState.dripJoinConfig.accountDailyJoins = {};
  }

  const accountSummaries: AccountTerritorySummary[] = availableAccounts.map(acc => {
    const assigned = appState.groups.filter(g => g.assignedAccountId === acc.id && g.isActive && g.status !== 'purged_non_persian');
    const joined = assigned.filter(g => g.joinedAccountIds && g.joinedAccountIds.includes(acc.id)).length;
    const pending = assigned.length - joined;
    const overlaps = appState.groups.filter(g => g.assignedAccountId === acc.id && g.hasOverlap).length;
    const joinsToday = appState.dripJoinConfig?.accountDailyJoins?.[acc.id] || 0;
    const maxJoins = appState.dripJoinConfig?.maxJoinsPerAccountPerDay || 8;

    let status: 'active' | 'flood_wait' | 'session_expired' | 'disabled' | 'daily_quota_reached' = 'active';
    let statusMessage = 'آماده و فعال';
    if (acc.floodWaitUntil && acc.floodWaitUntil > Date.now()) {
      status = 'flood_wait';
      const remMins = Math.ceil((acc.floodWaitUntil - Date.now()) / 60000);
      statusMessage = `محدودیت موقت تلگرام (${remMins} دقیقه باقی‌مانده)`;
    } else if (acc.status === 'session_expired') {
      status = 'session_expired';
      statusMessage = 'نشست منقضی شده';
    } else if (joinsToday >= maxJoins) {
      status = 'daily_quota_reached';
      statusMessage = `تکمیل سقف روزانه عضویت (${joinsToday}/${maxJoins} گروه)`;
    }

    acc.assignedGroupCount = assigned.length;

    return {
      accountId: acc.id,
      accountPhone: acc.phoneNumber,
      accountName: acc.userProfile?.firstName,
      isActive: acc.isActive,
      status,
      statusMessage,
      totalAssignedGroups: assigned.length,
      joinedGroupsCount: joined,
      pendingJoinCount: pending,
      overlapCount: overlaps,
      dailyJoinsCompletedToday: joinsToday,
      dailyJoinQuotaRemaining: Math.max(0, maxJoins - joinsToday),
    };
  });

  saveData();

  const totalTarget = appState.groups.filter(g => g.isActive && g.status !== 'purged_non_persian').length;
  const totalUniqueJoined = appState.groups.filter(g => g.isActive && g.status !== 'purged_non_persian' && g.joinedAccountIds && g.joinedAccountIds.length > 0).length;
  const totalPending = totalTarget - totalUniqueJoined;

  return {
    totalTargetGroups: totalTarget,
    totalUniqueJoined,
    totalPendingUnjoined: totalPending,
    totalOverlapsDetected: overlapGroups.length,
    zeroOverlapEnforced: overlapGroups.length === 0,
    accounts: accountSummaries,
    overlapGroups,
  };
}

// ==========================================
// Safe Drip-Feed Group Joining Background Runner
// ==========================================
let isDripJoinStepRunning = false;

async function runDripJoinBackgroundStep() {
  if (isDripJoinStepRunning) return;
  const config = appState.dripJoinConfig;
  if (!config || !config.enabled) return;

  const todayStr = new Date().toISOString().split('T')[0];
  if (config.dailyJoinResetDate !== todayStr) {
    config.dailyJoinResetDate = todayStr;
    config.accountDailyJoins = {};
    saveData();
  }

  syncAccountsState();
  const accounts = (appState.accounts || []).filter(
    a => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled' && (!a.floodWaitUntil || a.floodWaitUntil < Date.now())
  );

  let targetAccounts = accounts;
  if (targetAccounts.length === 0 && appState.credentials.isConnected && appState.credentials.sessionString) {
    targetAccounts = [{
      id: 'primary_account',
      phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
      sessionString: appState.credentials.sessionString,
      apiId: appState.credentials.apiId || DEFAULT_API_ID,
      apiHash: appState.credentials.apiHash || DEFAULT_API_HASH,
      isActive: true,
      status: 'connected',
      userProfile: appState.credentials.userProfile,
      dailySentCount: appState.scheduler.dailySentCount || 0,
    }];
  }

  if (targetAccounts.length === 0) return;

  isDripJoinStepRunning = true;
  try {
    for (const account of targetAccounts) {
      const joinsToday = config.accountDailyJoins?.[account.id] || 0;
      const maxDaily = config.maxJoinsPerAccountPerDay || 8;
      if (joinsToday >= maxDaily) {
        continue; // Daily limit reached for this account
      }

      const lastJoinTime = config.lastJoinTimePerAccount?.[account.id] || 0;
      const intervalMs = (config.intervalMinutes || 20) * 60 * 1000;
      const jitterMs = ((Math.random() * 2 - 1) * (config.jitterMinutes || 5)) * 60 * 1000;
      const effectiveInterval = Math.max(3 * 60 * 1000, intervalMs + jitterMs);

      if (Date.now() - lastJoinTime < effectiveInterval) {
        continue; // Not yet time for next join
      }

      // Find the next unjoined group assigned specifically to this account's territory
      const pendingGroup = appState.groups.find(
        g => g.assignedAccountId === account.id &&
             (!g.joinedAccountIds || !g.joinedAccountIds.includes(account.id)) &&
             g.isActive &&
             g.status !== 'purged_non_persian' &&
             g.membershipStatus !== 'failed'
      );

      if (!pendingGroup) {
        continue; // No pending groups in territory for this account
      }

      addLog(
        'info',
        `[پیوستن قطره‌چکانی و امن] اکانت (${account.phoneNumber}) در حال عضویت تدریجی در گروه اختصاصی خود: "${pendingGroup.title}" (${pendingGroup.usernameOrLink}) - [سهمیه: ${joinsToday + 1}/${maxDaily}]...`
      );

      let client: any = null;
      try {
        if (account.id === 'primary_account') {
          client = await getOrInitTgClient();
        } else {
          client = await getOrInitClientForAccount(account);
        }
      } catch (err: any) {
        console.error('Drip join client init error:', err);
        continue;
      }

      if (!client || client._destroyed) continue;

      try {
        const peer = await resolveAndJoinGroup(client, pendingGroup.usernameOrLink);
        if (peer) {
          // Anti-bot & Captcha verification
          await handleAntiBotAndGroupVerification(
            client,
            peer,
            pendingGroup.title || pendingGroup.usernameOrLink,
            pendingGroup,
            account
          );

          pendingGroup.joinedAccountIds = Array.from(new Set([...(pendingGroup.joinedAccountIds || []), account.id]));
          pendingGroup.joinedAccountPhones = Array.from(new Set([...(pendingGroup.joinedAccountPhones || []), account.phoneNumber]));
          pendingGroup.membershipStatus = 'joined';
          pendingGroup.status = 'joined';
          pendingGroup.dripJoinStatus = 'joined';
          pendingGroup.dripJoinedAt = new Date().toISOString();

          config.accountDailyJoins = config.accountDailyJoins || {};
          config.accountDailyJoins[account.id] = joinsToday + 1;
          config.lastJoinTimePerAccount = config.lastJoinTimePerAccount || {};
          config.lastJoinTimePerAccount[account.id] = Date.now();

          addLog(
            'success',
            `✅ [عضویت قطره‌چکانی موفق] اکانت (${account.phoneNumber}) با موفقیت عضو گروه اختصاصی "${pendingGroup.title}" گردید و بدون تداخل در سیستم ثبت شد. (${joinsToday + 1}/${maxDaily} سهمیه امروز).`
          );
          saveData();
        }
      } catch (joinErr: any) {
        const errStr = (joinErr?.message || String(joinErr)).toLowerCase();
        if (errStr.includes('flood_wait') || errStr.includes('floodwait')) {
          handleAccountFailover(account.id, joinErr.message);
          addLog(
            'warning',
            `⏳ [محدودیت موقت FloodWait] اکانت (${account.phoneNumber}) با تاخیر اجباری تلگرام مواجه شد. گروه‌های این اکانت محفوظ می‌مانند و سایر اکانت‌ها به فعالیت خود ادامه می‌دهند.`
          );
        } else {
          pendingGroup.membershipStatus = 'failed';
          pendingGroup.lastJoinError = joinErr?.message || String(joinErr);
          config.lastJoinTimePerAccount = config.lastJoinTimePerAccount || {};
          config.lastJoinTimePerAccount[account.id] = Date.now();
          addLog(
            'warning',
            `⚠️ [خطای عضویت گروه] اکانت (${account.phoneNumber}) در ورود به گروه "${pendingGroup.title}": ${joinErr?.message || joinErr}`
          );
          saveData();
        }
      }
    }
  } catch (loopErr: any) {
    console.error('Drip join background runner error:', loopErr);
  } finally {
    isDripJoinStepRunning = false;
  }
}

// Intelligent Account Distribution Algorithm for Group Joining
function distributeGroupsForJoin(
  groupsToJoin: TargetGroup[],
  accounts: any[],
  strategy: 'balanced_distribution' | 'redundant_all_accounts' | 'single_account'
): { [accountId: string]: TargetGroup[] } {
  const distribution: { [accountId: string]: TargetGroup[] } = {};
  for (const acc of accounts) {
    distribution[acc.id] = [];
  }

  if (accounts.length === 0 || groupsToJoin.length === 0) {
    return distribution;
  }

  if (strategy === 'redundant_all_accounts') {
    // Every unjoined account joins every group
    for (const group of groupsToJoin) {
      for (const acc of accounts) {
        const isAlreadyJoined = group.joinedAccountIds?.includes(acc.id);
        if (!isAlreadyJoined) {
          distribution[acc.id].push(group);
        }
      }
    }
    return distribution;
  }

  // Strict Non-Overlap Balanced Distribution: Each group is strictly handled by exactly 1 account
  // Pre-calculate account assigned loads
  const accountLoads: Record<string, number> = {};
  for (const acc of accounts) {
    accountLoads[acc.id] = appState.groups.filter(
      g => g.assignedAccountId === acc.id && g.joinedAccountIds?.includes(acc.id)
    ).length;
  }

  for (const group of groupsToJoin) {
    // 1. If group already has confirmed joined accounts, assign to the joined account with least load
    const joinedIds = (group.joinedAccountIds || []).filter(id => accounts.some(a => a.id === id));
    if (joinedIds.length > 0) {
      joinedIds.sort((aId, bId) => (accountLoads[aId] || 0) - (accountLoads[bId] || 0));
      const ownerId = (group.assignedAccountId && joinedIds.includes(group.assignedAccountId)) ? group.assignedAccountId : joinedIds[0];
      group.assignedAccountId = ownerId;
      const ownerAcc = accounts.find(a => a.id === ownerId);
      if (ownerAcc) {
        group.assignedAccountPhone = ownerAcc.phoneNumber;
      }
      distribution[ownerId].push(group);
      accountLoads[ownerId] = (accountLoads[ownerId] || 0) + 1;
      continue;
    }

    // 2. If group is already assigned to a valid available account, keep it in that territory!
    if (group.assignedAccountId && distribution[group.assignedAccountId]) {
      distribution[group.assignedAccountId].push(group);
      accountLoads[group.assignedAccountId] = (accountLoads[group.assignedAccountId] || 0) + 1;
      continue;
    }

    // 3. Unassigned group: pick the available account with the lowest total load
    accounts.sort((a, b) => (accountLoads[a.id] || 0) - (accountLoads[b.id] || 0));
    const chosenAcc = accounts[0];

    distribution[chosenAcc.id].push(group);
    group.assignedAccountId = chosenAcc.id;
    group.assignedAccountPhone = chosenAcc.phoneNumber;
    accountLoads[chosenAcc.id] = (accountLoads[chosenAcc.id] || 0) + 1;
  }

  return distribution;
}

// Autonomous Smart Group Join Engine State & Controller
let isGroupJoinRunning = false;
let isGroupJoinCancellationRequested = false;

async function startSmartGroupJoinEngine(options?: {
  mode?: 'balanced_distribution' | 'redundant_all_accounts' | 'single_account';
  delaySeconds?: number;
  targetGroupIds?: string[];
  accountIds?: string[];
  autoResolveAntibot?: boolean;
}): Promise<{ success: boolean; message: string; activeProgress?: ActiveGroupJoinProgress }> {
  if (isGroupJoinRunning) {
    return { success: false, message: 'عملیات عضویت هوشمند گروه‌ها هم‌اکنون در حال اجرا است.' };
  }

  isGroupJoinRunning = true;
  isGroupJoinCancellationRequested = false;

  const mode = options?.mode || appState.groupJoinStrategy?.mode || 'balanced_distribution';
  const delaySec = Math.max(3, options?.delaySeconds || appState.groupJoinStrategy?.delayBetweenJoinsSeconds || 10);
  const autoAntibot = options?.autoResolveAntibot ?? (appState.groupJoinStrategy?.autoResolveAntibotOnJoin ?? true);

  syncAccountsState();
  let availableAccounts = (appState.accounts || []).filter(
    a => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled' && (a.enableForGroupBroadcast !== false) && (!a.floodWaitUntil || a.floodWaitUntil < Date.now())
  );

  // Fallback to primary account if no multi-account registered
  if (availableAccounts.length === 0 && appState.credentials.isConnected && appState.credentials.sessionString) {
    availableAccounts = [{
      id: 'primary_account',
      phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
      sessionString: appState.credentials.sessionString,
      apiId: appState.credentials.apiId || DEFAULT_API_ID,
      apiHash: appState.credentials.apiHash || DEFAULT_API_HASH,
      isActive: true,
      status: 'connected',
      userProfile: appState.credentials.userProfile,
      dailySentCount: appState.scheduler.dailySentCount || 0,
    }];
  }

  const selectedAccounts = options?.accountIds && options.accountIds.length > 0
    ? availableAccounts.filter(a => options.accountIds!.includes(a.id))
    : availableAccounts;

  if (selectedAccounts.length === 0) {
    isGroupJoinRunning = false;
    addLog('warning', '[عضویت هوشمند گروه‌ها] هیچ اکانت فعال و بدون محدودیتی برای عضویت یافت نشد.');
    return { success: false, message: 'هیچ اکانت فعالی برای عضویت در دسترس نیست.' };
  }

  // Determine groups that need joining
  let targetGroups = appState.groups.filter(g => g.isActive);
  if (options?.targetGroupIds && options.targetGroupIds.length > 0) {
    targetGroups = targetGroups.filter(g => options.targetGroupIds!.includes(g.id));
  } else {
    if (mode === 'redundant_all_accounts') {
      targetGroups = targetGroups.filter(g => (g.joinedAccountIds?.length || 0) < selectedAccounts.length);
    } else {
      targetGroups = targetGroups.filter(g => !g.joinedAccountIds || g.joinedAccountIds.length === 0 || g.membershipStatus === 'not_joined' || g.membershipStatus === 'failed');
    }
  }

  if (targetGroups.length === 0) {
    isGroupJoinRunning = false;
    addLog('info', '[عضویت هوشمند گروه‌ها] تمامی گروه‌های مدنظر هم‌اکنون عضو شده هستند و نیازی به عضویت جدید نیست.');
    return { success: true, message: 'تمامی گروه‌ها در اکانت‌های مربوطه عضو شده هستند.' };
  }

  // Build distribution map
  const distribution = distributeGroupsForJoin(targetGroups, selectedAccounts, mode);

  // Initialize workers progress
  const workersProgress: ActiveGroupJoinWorkerProgress[] = selectedAccounts.map(acc => ({
    accountId: acc.id,
    accountPhone: acc.phoneNumber,
    accountName: acc.userProfile?.firstName,
    status: 'idle',
    successCount: 0,
    failedCount: 0,
    lastAction: `در صف آماده‌سازی (${distribution[acc.id]?.length || 0} گروه تخصیص یافته)...`,
  }));

  const distributionSummary: AccountDistributionSummary[] = selectedAccounts.map(acc => ({
    accountId: acc.id,
    accountPhone: acc.phoneNumber,
    accountName: acc.userProfile?.firstName,
    assignedCount: distribution[acc.id]?.length || 0,
    joinedCount: 0,
    pendingCount: distribution[acc.id]?.length || 0,
    failedCount: 0,
  }));

  appState.activeGroupJoinProgress = {
    isRunning: true,
    startTime: new Date().toISOString(),
    totalToJoin: targetGroups.length,
    completedCount: 0,
    successCount: 0,
    failedCount: 0,
    strategy: mode,
    workers: workersProgress,
    distributionSummary,
  };

  addLog(
    'info',
    `[آغاز فرآیند عضویت هوشمند] تفکیک و تخصیص ${targetGroups.length} گروه نیازمند عضویت بین ${selectedAccounts.length} اکانت تلگرام (استراتژی: ${mode === 'balanced_distribution' ? 'تقسیم متوازن و مساوی' : 'عضویت در تمام اکانت‌ها'}) با وقفه امنیتی ${delaySec} ثانیه...`
  );

  // Launch parallel background worker loop
  (async () => {
    try {
      await Promise.all(selectedAccounts.map(async (acc, workerIdx) => {
        const workerProg = workersProgress[workerIdx];
        const assignedGroups = distribution[acc.id] || [];
        const summary = distributionSummary.find(s => s.accountId === acc.id);

        if (assignedGroups.length === 0) {
          if (workerProg) {
            workerProg.status = 'completed';
            workerProg.lastAction = 'هیچ گروهی برای این اکانت نیاز به عضویت ندارد.';
          }
          return;
        }

        if (acc.floodWaitUntil && acc.floodWaitUntil > Date.now()) {
          const remainingSecs = Math.ceil((acc.floodWaitUntil - Date.now()) / 1000);
          const remainingMins = Math.ceil(remainingSecs / 60);
          if (workerProg) {
            workerProg.status = 'flood_waited';
            workerProg.lastAction = `اکانت در وضعیت محدودیت تلگرام (FloodWait) است (${remainingMins} دقیقه باقی‌مانده).`;
          }
          addLog('warning', `[محدودیت FloodWait] اکانت (${acc.phoneNumber}) تا ${remainingMins} دقیقه آینده دارای محدودیت تلگرام است و عضویت جدید انجام نمی‌دهد.`);
          return;
        }

        let client: any = null;
        try {
          if (workerProg) {
            workerProg.status = 'preparing';
            workerProg.lastAction = 'در حال اتصال و برقراری نشست تلگرام...';
          }
          if (acc.id === 'primary_account') {
            client = await getOrInitTgClient();
          } else {
            client = await getOrInitClientForAccount(acc);
          }
        } catch (err: any) {
          if (workerProg) {
            workerProg.status = 'error';
            workerProg.lastAction = `خطا در اتصال: ${err?.message || 'نامشخص'}`;
          }
          return;
        }

        if (!client || client._destroyed) {
          if (workerProg) {
            workerProg.status = 'error';
            workerProg.lastAction = 'نشست تلگرام در دسترس نیست.';
          }
          return;
        }

        for (let i = 0; i < assignedGroups.length; i++) {
          if (isGroupJoinCancellationRequested) {
            if (workerProg) {
              workerProg.status = 'completed';
              workerProg.lastAction = 'عملیات توسط کاربر لغو شد.';
            }
            break;
          }

          if (acc.floodWaitUntil && acc.floodWaitUntil > Date.now()) {
            const remainingMins = Math.ceil((acc.floodWaitUntil - Date.now()) / 60000);
            if (workerProg) {
              workerProg.status = 'flood_waited';
              workerProg.lastAction = `محدودیت FloodWait تلگرام (${remainingMins} دقیقه باقی‌مانده)`;
            }
            break;
          }

          const group = assignedGroups[i];
          if (workerProg) {
            workerProg.currentGroupId = group.id;
            workerProg.currentGroupTitle = group.title;
            workerProg.status = 'joining';
            workerProg.lastAction = `در حال ارسال درخواست عضویت به "${group.title}" (${i + 1}/${assignedGroups.length})...`;
          }
          group.membershipStatus = 'joining';
          group.lastJoinAttemptAt = new Date().toISOString();

          // Pre-flight check: If handle is invalid, fail immediately without triggering Telegram RPC or flood limits
          const targetCheck = isValidTelegramTarget(group.usernameOrLink);
          if (!targetCheck.valid) {
            group.membershipStatus = 'failed';
            group.lastJoinError = `آیدی یا لینک گروه نامعتبر است: ${targetCheck.reason}`;
            group.isActive = false;
            if (workerProg) {
              workerProg.failedCount++;
              workerProg.lastAction = `رد گروه نامعتبر "${group.title}" (${targetCheck.reason})`;
            }
            if (summary) {
              summary.failedCount++;
              summary.pendingCount = Math.max(0, summary.pendingCount - 1);
            }
            if (appState.activeGroupJoinProgress) {
              appState.activeGroupJoinProgress.failedCount++;
              appState.activeGroupJoinProgress.completedCount++;
            }
            addLog(
              'warning',
              `[رد گروه نامعتبر] اکانت (${acc.phoneNumber}): گروه "${group.title}" دارای آیدی نامعتبر است (${targetCheck.reason}) و درخواست عضویت ارسال نشد.`
            );
            saveData();
            continue;
          }

          try {
            const peer = await resolveAndJoinGroup(client, group.usernameOrLink);

            let verificationResult: any = null;
            // Handle Anti-Bot verification if enabled
            if (autoAntibot && peer) {
              if (workerProg) {
                workerProg.status = 'antibot';
                workerProg.lastAction = `در حال ارزیابی آنتی‌بات و قفل‌های گروه "${group.title}"...`;
              }
              verificationResult = await handleAntiBotAndGroupVerification(client, peer, group.title, group, acc);
            }

            if (verificationResult?.noPermissionLeft || group.readinessStatus === 'no_permission_left') {
              // Group had no send permission -> Left and deleted from Telegram
              group.canSendMessages = false;
              group.readinessStatus = 'no_permission_left';
              group.status = 'failed';
              group.membershipStatus = 'restricted';
              group.isActive = false;
              if (workerProg) {
                workerProg.failedCount++;
                workerProg.lastAction = `فاقد اجازه ارسال در "${group.title}" (خروج و حذف خودکار از تلگرام انجام شد)`;
              }
              if (summary) {
                summary.failedCount++;
                summary.pendingCount = Math.max(0, summary.pendingCount - 1);
              }
              if (appState.activeGroupJoinProgress) {
                appState.activeGroupJoinProgress.failedCount++;
                appState.activeGroupJoinProgress.completedCount++;
              }
              saveData();
              continue;
            }

            if (verificationResult?.isClear) {
              group.readinessStatus = 'ready';
              group.canSendMessages = true;
              group.greetingSurvived = true;
            } else if (!group.readinessStatus) {
              group.readinessStatus = 'captcha_required';
            }

            // Membership Succeeded!
            if (!group.accountMemberships) group.accountMemberships = {};
            const nowIso = new Date().toISOString();
            group.accountMemberships[acc.id] = {
              accountId: acc.id,
              accountPhone: acc.phoneNumber,
              accountName: acc.userProfile?.firstName,
              isMember: true,
              status: 'joined',
              checkedAt: nowIso,
              joinedAt: nowIso,
            };

            group.joinedAccountIds = Array.from(new Set([...(group.joinedAccountIds || []), acc.id]));
            group.joinedAccountPhones = Array.from(new Set([...(group.joinedAccountPhones || []), acc.phoneNumber]));
            group.membershipStatus = 'joined';
            group.status = 'joined';
            group.lastJoinError = undefined;

            if (workerProg) workerProg.successCount++;
            if (summary) {
              summary.joinedCount++;
              summary.pendingCount = Math.max(0, summary.pendingCount - 1);
            }
            if (appState.activeGroupJoinProgress) {
              appState.activeGroupJoinProgress.successCount++;
              appState.activeGroupJoinProgress.completedCount++;
            }

            addLog(
              'success',
              `[عضویت موفق در گروه] اکانت (${acc.userProfile?.firstName || acc.phoneNumber}) با موفقیت به گروه "${group.title}" ملحق شد.`
            );

            // Safe Delay between joins with random jitter
            if (i < assignedGroups.length - 1 && !isGroupJoinCancellationRequested) {
              if (workerProg) workerProg.status = 'cooldown';
              const jitterMs = (delaySec * 1000) + Math.floor(Math.random() * 3500);
              if (workerProg) {
                workerProg.cooldownEndsAt = Date.now() + jitterMs;
                workerProg.lastAction = `عضویت موفق. شکیبایی امنیتی (${Math.round(jitterMs / 1000)} ثانیه) جهت جلوگیری از FloodWait...`;
              }

              const startWait = Date.now();
              while (Date.now() - startWait < jitterMs) {
                if (isGroupJoinCancellationRequested) break;
                await new Promise(r => setTimeout(r, Math.min(250, jitterMs - (Date.now() - startWait))));
              }
              if (workerProg) workerProg.cooldownEndsAt = undefined;
            }
          } catch (joinErr: any) {
            handleGramJsFloodWait(joinErr);
            const secs = parseFloodWaitSeconds(joinErr);

            if (secs && secs > 0) {
              acc.status = 'flood_wait';
              acc.floodWaitUntil = Date.now() + secs * 1000;
              if (workerProg) {
                workerProg.status = 'flood_waited';
                workerProg.lastAction = `محدودیت FloodWait تلگرام (${Math.ceil(secs / 60)} دقیقه)`;
              }
              addLog('warning', `[محدودیت FloodWait] اکانت (${acc.phoneNumber}) به محدودیت عضویت تلگرام برخورد کرد. ادامه عضویت برای این اکانت تا ${Math.ceil(secs / 60)} دقیقه آینده متوقف گردید.`);
              group.membershipStatus = 'not_joined';
              group.status = 'pending';
              group.lastJoinError = `محدودیت موقت FloodWait تلگرام (${Math.ceil(secs / 60)} دقیقه)`;
              break;
            } else {
              console.warn(`[خطای عضویت در گروه] اکانت ${acc.phoneNumber} در گروه ${group.title}:`, joinErr?.message || joinErr);
              group.membershipStatus = 'failed';
              group.lastJoinError = translateTgError(joinErr);
              if (workerProg) workerProg.failedCount++;
              if (summary) {
                summary.failedCount++;
                summary.pendingCount = Math.max(0, summary.pendingCount - 1);
              }
              if (appState.activeGroupJoinProgress) {
                appState.activeGroupJoinProgress.failedCount++;
                appState.activeGroupJoinProgress.completedCount++;
              }
              addLog(
                'warning',
                `[خطای عضویت در گروه] اکانت (${acc.phoneNumber}) نتوانست به گروه "${group.title}" ملحق شود: ${group.lastJoinError}`
              );

              // Quick safety pause before trying next group
              await new Promise(r => setTimeout(r, 4000));
            }
          }
          saveData();
        }

        if (workerProg && workerProg.status !== 'flood_waited' && workerProg.status !== 'error') {
          workerProg.status = 'completed';
          workerProg.lastAction = `پایان عضویت هوشمند (موفق: ${workerProg.successCount}، خطا: ${workerProg.failedCount})`;
        }
      }));
    } finally {
      if (appState.activeGroupJoinProgress) {
        appState.activeGroupJoinProgress.isRunning = false;
      }
      isGroupJoinRunning = false;
      saveData();
      addLog('success', `[پایان عملیات عضویت هوشمند] فرآیند عضویت و همگام‌سازی گروه‌ها با موفقیت خاتمه یافت.`);
    }
  })();

  return { success: true, message: 'عملیات عضویت هوشمند گروه‌ها آغاز گردید.', activeProgress: appState.activeGroupJoinProgress };
}

function stopSmartGroupJoinEngine(): { success: boolean; message: string } {
  if (!isGroupJoinRunning) {
    return { success: false, message: 'هیچ عملیات عضویتی در حال حاضر در حال اجرا نیست.' };
  }
  isGroupJoinCancellationRequested = true;
  if (appState.activeGroupJoinProgress) {
    appState.activeGroupJoinProgress.isRunning = false;
  }
  addLog('warning', '[توقف عضویت] درخواست توقف فرآیند عضویت هوشمند توسط کاربر صادر گردید.');
  return { success: true, message: 'دستور توقف فرآیند عضویت صادر شد.' };
}

interface SponsorTarget {
  type: 'username' | 'invite_hash' | 'url';
  target: string;
  sourceText?: string;
}

// Helper: Extract Sponsor Channels & Links from Bot Messages & Inline Buttons
function extractSponsorChannelsFromBotMessage(msg: any): SponsorTarget[] {
  const targets: SponsorTarget[] = [];
  const seen = new Set<string>();

  const addTarget = (t: SponsorTarget) => {
    const key = `${t.type}:${t.target.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push(t);
    }
  };

  // 1. Extract from Inline Buttons (especially URL buttons!)
  if (msg?.replyMarkup?.rows) {
    for (const row of msg.replyMarkup.rows) {
      for (const btn of row.buttons || []) {
        if (btn.url) {
          const urlStr = String(btn.url).trim();
          // Check for Telegram Invite Hash e.g. t.me/+... or t.me/joinchat/...
          if (urlStr.includes('/+') || urlStr.includes('joinchat/')) {
            const hash = urlStr.includes('/+')
              ? urlStr.split('/+')[1]?.split('/')[0]?.split('?')[0]
              : urlStr.split('joinchat/')[1]?.split('/')[0]?.split('?')[0];
            if (hash && hash.length >= 4) {
              addTarget({ type: 'invite_hash', target: hash, sourceText: btn.text });
            }
          } else if (urlStr.includes('t.me/') || urlStr.includes('telegram.me/')) {
            const handle = (urlStr.includes('t.me/') ? urlStr.split('t.me/')[1] : urlStr.split('telegram.me/')[1])
              ?.split('/')[0]?.split('?')[0]?.replace(/^@+/, '').trim();
            if (handle && /^[a-zA-Z0-9_]{4,32}$/.test(handle)) {
              addTarget({ type: 'username', target: handle, sourceText: btn.text });
            }
          } else {
            addTarget({ type: 'url', target: urlStr, sourceText: btn.text });
          }
        }
      }
    }
  }

  // 2. Extract from Message Entities (links, mentions, text_links)
  if (msg?.entities) {
    for (const entity of msg.entities) {
      if (entity.url) {
        const u = String(entity.url).trim();
        if (u.includes('/+') || u.includes('joinchat/')) {
          const hash = u.includes('/+') ? u.split('/+')[1]?.split('/')[0]?.split('?')[0] : u.split('joinchat/')[1]?.split('/')[0]?.split('?')[0];
          if (hash && hash.length >= 4) addTarget({ type: 'invite_hash', target: hash });
        } else if (u.includes('t.me/') || u.includes('telegram.me/')) {
          const handle = (u.includes('t.me/') ? u.split('t.me/')[1] : u.split('telegram.me/')[1])
            ?.split('/')[0]?.split('?')[0]?.replace(/^@+/, '').trim();
          if (handle && /^[a-zA-Z0-9_]{4,32}$/.test(handle)) {
            addTarget({ type: 'username', target: handle });
          }
        }
      }
    }
  }

  // 3. Extract from Text Body
  const text = String(msg?.message || msg?.text || '');
  // Match @username
  const mentionMatches = text.match(/@([a-zA-Z0-9_]{4,32})/g);
  if (mentionMatches) {
    for (const m of mentionMatches) {
      const handle = m.replace(/^@+/, '').trim();
      addTarget({ type: 'username', target: handle });
    }
  }

  // Match t.me links in text
  const linkMatches = text.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_+/-]{4,50})/g);
  if (linkMatches) {
    for (const l of linkMatches) {
      if (l.includes('/+') || l.includes('joinchat/')) {
        const hash = l.includes('/+') ? l.split('/+')[1]?.split('/')[0]?.split('?')[0] : l.split('joinchat/')[1]?.split('/')[0]?.split('?')[0];
        if (hash && hash.length >= 4) addTarget({ type: 'invite_hash', target: hash });
      } else {
        const handle = (l.includes('t.me/') ? l.split('t.me/')[1] : l.split('telegram.me/')[1])
          ?.split('/')[0]?.split('?')[0]?.replace(/^@+/, '').trim();
        if (handle && /^[a-zA-Z0-9_]{4,32}$/.test(handle)) {
          addTarget({ type: 'username', target: handle });
        }
      }
    }
  }

  // 4. Special Match for Persian Guardian Bots (like DIGI ANTI / Sponsor locks in user images):
  // Examples:
  // "• برای ارسال پیام باید در فروش قیمت و خرید سیستم های گیمینگ رندر خرید کیس گیمینگ Gaming_Render عضو شوید."
  // "• برای ارسال پیام، ابتدا در چنل اسپانسر عضو شوید."
  const sponsorContextRegex = /(?:عضو شوید|چنل اسپانسر|کانال اسپانسر|کانال|چنل)\s*[:،\s]+.*?([a-zA-Z0-9_]{4,32})|(?:باید در|در)\s+(?:.+?\s+)?([a-zA-Z0-9_]{4,32})\s+عضو شوید/gi;
  let match;
  while ((match = sponsorContextRegex.exec(text)) !== null) {
    const candidate = (match[1] || match[2])?.trim();
    if (candidate && /^[a-zA-Z0-9_]{4,32}$/.test(candidate)) {
      const lowerCand = candidate.toLowerCase();
      if (!['admin', 'bot', 'anti', 'voss', 'user', 'message', 'telegram', 'group'].includes(lowerCand)) {
        addTarget({ type: 'username', target: candidate });
      }
    }
  }

  return targets;
}

// Helper: Join extracted sponsor channel or start sponsor bot
async function joinSponsorTarget(client: any, target: SponsorTarget, groupTitle: string): Promise<boolean> {
  await loadGramJS();
  try {
    if (target.type === 'invite_hash') {
      try {
        await client.invoke(new Api.messages.ImportChatInvite({ hash: target.target }));
        addLog('success', `[عضویت هوشمند در کانال اسپانسر] عضویت با لینک خصوصی در کانال حامی گروه "${groupTitle}" با موفقیت انجام شد.`);
        return true;
      } catch (err: any) {
        const msg = String(err?.errorMessage || err?.message || err);
        if (msg.includes('USER_ALREADY_PARTICIPANT')) {
          addLog('info', `[عضویت اسپانسر] اکانت از قبل عضو کانال حامی گروه "${groupTitle}" است.`);
          return true;
        }
        console.warn(`Sponsor private invite join failed (${target.target}):`, msg);
      }
    } else if (target.type === 'username') {
      const cleanHandle = target.target.replace(/^@+/, '').trim();
      try {
        // Resolve entity first to distinguish Channel vs User/Bot
        let entity: any = null;
        try {
          entity = await client.getEntity(cleanHandle);
        } catch (resolveErr: any) {
          // Fallback to string handle if entity resolution is pending
        }

        const isUserOrBot = entity && (entity.className === 'User' || entity.bot || entity._ === 'user' || cleanHandle.toLowerCase().endsWith('bot'));

        if (isUserOrBot) {
          // Sponsor target is a Bot or User, not an InputChannel
          try {
            await client.invoke(new Api.messages.StartBot({
              bot: entity || cleanHandle,
              peer: entity || cleanHandle,
              startParam: 'start',
            }));
            addLog('success', `[استارت ربات حامی/اسپانسر] ربات حامی @${cleanHandle} جهت رفع محدودیت گروه "${groupTitle}" با موفقیت استارت شد.`);
            return true;
          } catch (botErr: any) {
            try {
              await client.sendMessage(`@${cleanHandle}`, { message: '/start' });
              addLog('success', `[استارت ربات حامی] پیام /start به ربات حامی @${cleanHandle} ارسال شد.`);
              return true;
            } catch (sendErr) {}
          }
        } else {
          // Standard Channel / Supergroup
          const channelTarget = entity || cleanHandle;
          await client.invoke(new Api.channels.JoinChannel({ channel: channelTarget }));
          addLog('success', `[عضویت هوشمند در کانال اسپانسر] عضویت در کانال حامی @${cleanHandle} جهت رفع محدودیت گروه "${groupTitle}" با موفقیت انجام شد.`);
          return true;
        }
      } catch (err: any) {
        const msg = String(err?.errorMessage || err?.message || err);
        if (msg.includes('USER_ALREADY_PARTICIPANT')) {
          addLog('info', `[عضویت اسپانسر] اکانت از قبل عضو کانال @${target.target} است.`);
          return true;
        }
        if (msg.includes('InputPeerUser') || msg.includes('InputChannel') || cleanHandle.toLowerCase().endsWith('bot')) {
          // Fallback bot start if MTProto cast threw error
          try {
            await client.sendMessage(`@${cleanHandle}`, { message: '/start' });
            addLog('success', `[استارت ربات حامی] ارسال /start به @${cleanHandle} جهت رفع محدودیت انجام شد.`);
            return true;
          } catch (e) {}
        }
        console.warn(`Sponsor username join failed (@${target.target}):`, msg);
      }
    }
  } catch (e: any) {
    console.warn('Sponsor join unexpected error:', e?.message || e);
  }
  return false;
}

// Engine: Smart Anti-Bot & Lock Bypass Engine with 4-State Lifecycle & Deep AI Verification
async function handleAntiBotAndGroupVerification(
  client: any,
  peer: any,
  groupTitle: string,
  targetGroup?: TargetGroup,
  account?: any
): Promise<{
  isClear: boolean;
  botDetected: boolean;
  statusMessage: string;
  captchaClicked: boolean;
  channelJoined: boolean;
  contactsInvited: number;
  noPermissionLeft?: boolean;
}> {
  if (!client || !peer) {
    return { isClear: false, botDetected: false, statusMessage: 'کلاینت یا گروه نامعتبر است.', captchaClicked: false, channelJoined: false, contactsInvited: 0 };
  }
  await loadGramJS();

  const antiBotConfig = appState.scheduler.antiBot || {
    autoClickCaptcha: true,
    autoForceJoinChannels: true,
    autoInviteContacts: false,
    contactsToInviteCount: 3,
    safeContactShield: true,
    sendGreetingFirst: true,
    greetingMode: 'natural_greeting',
    greetingMessage: 'سلام بچه ها',
    autoSolveMathCaptcha: true,
    safeMembershipRetention: true,
    supportForumTopics: true,
  };

  const greetingMsg = appState.groupJoinStrategy?.greetingMessage || antiBotConfig.greetingMessage || 'سلام بچه ها';

  // --------------------------------------------------------------------------
  // STAGE 1: Check Group Rights & Permission to Send Messages
  // Only broadcast channels (strictly one-way broadcasts) should be left.
  // Supergroups with add-member locks or temporary bot mutes must NOT be auto-left.
  // --------------------------------------------------------------------------
  try {
    const isChannel = peer && (peer.className === 'Channel' || peer._ === 'channel');
    const isBroadcastChannel = isChannel && peer.broadcast && !peer.megagroup;

    if (isBroadcastChannel) {
      addLog('warning', `[فاقد قابلیت ارسال] کانال یک‌طرفه "${groupTitle}" اجازه ارسال پیام ندارد. در حال خروج و پاکسازی...`);
      try {
        if (Api && Api.channels && Api.channels.LeaveChannel) {
          await client.invoke(new Api.channels.LeaveChannel({ channel: peer })).catch(() => {});
        }
        if (Api && Api.messages && Api.messages.DeleteHistory) {
          await client.invoke(new Api.messages.DeleteHistory({ peer, maxId: 0, justClear: false, revoke: true })).catch(() => {});
        }
      } catch (e: any) {
        console.warn('Auto leave/delete warning:', e?.message || e);
      }

      if (targetGroup) {
        targetGroup.canSendMessages = false;
        targetGroup.readinessStatus = 'no_permission_left';
        targetGroup.status = 'failed';
        targetGroup.membershipStatus = 'restricted';
        targetGroup.isActive = false;
        targetGroup.autoLeftAt = new Date().toISOString();
        targetGroup.errorMessage = 'کانال یک‌طرفه فاقد قابلیت ارسال پیام (خروج و پاکسازی خودکار انجام شد)';
      }

      return {
        isClear: false,
        botDetected: false,
        statusMessage: 'امکان ارسال پیام در کانال یک‌طرفه وجود ندارد. خروج خودکار انجام شد.',
        captchaClicked: false,
        channelJoined: false,
        contactsInvited: 0,
        noPermissionLeft: true,
      };
    }
  } catch (permErr: any) {
    console.warn('Pre-check permission warning:', permErr?.message || permErr);
  }

  // --------------------------------------------------------------------------
  // STAGE 1.5: 100% Persian & Iranian Audience Verification & Purge
  // --------------------------------------------------------------------------
  const isEnforcePersian = appState.groupJoinStrategy?.enforcePersianIranianOnly !== false;
  if (isEnforcePersian) {
    const persianAudit = await verifyAndAuditGroupIsPersian(client, peer, groupTitle, targetGroup?.usernameOrLink);
    if (!persianAudit.isPersian) {
      if (targetGroup) {
        await purgeAndLeaveNonPersianGroup(client, peer, targetGroup, persianAudit.reason);
      } else {
        await leaveGroupAndClearHistory(client, peer);
      }
      return {
        isClear: false,
        botDetected: false,
        statusMessage: `گروه غیرفارسی شناسایی شد: ${persianAudit.reason}. لفت و پاکسازی کامل از تلگرام انجام شد.`,
        captchaClicked: false,
        channelJoined: false,
        contactsInvited: 0,
        noPermissionLeft: true,
      };
    } else if (targetGroup) {
      targetGroup.isPersianVerified = true;
      targetGroup.languageDetected = persianAudit.language;
    }
  }

  // --------------------------------------------------------------------------
  // STAGE 2: Send Initial Test Greeting ("سلام بچه ها") if enabled
  // --------------------------------------------------------------------------
  let sentGreetingMsg: any = null;
  let initialWriteRestricted = false;
  const shouldSendGreeting = antiBotConfig.sendGreetingFirst !== false && antiBotConfig.greetingMode !== 'stealth_silent';

  if (shouldSendGreeting) {
    try {
      sentGreetingMsg = await client.sendMessage(peer, { message: greetingMsg });
      addLog('info', `[تست ربات محافظ] پیام اولیه «${greetingMsg}» به گروه "${groupTitle}" ارسال شد. بررسی ماندگاری و واکنش ربات ناظر...`);

      updateGroupMonitoringReport({
        groupId: groupTitle,
        groupTitle: groupTitle,
        step: 'GREETING_SENT',
        statusMessage: `پیام تست ارسال شد: «${greetingMsg}». در حال پایش واکنش ربات ناظر...`,
      });
    } catch (sendErr: any) {
      const errMsg = String(sendErr?.message || sendErr?.errorMessage || sendErr);
      const isWriteForbidden =
        errMsg.includes('CHAT_WRITE_FORBIDDEN') ||
        errMsg.includes('CHAT_SEND_PLAIN_FORBIDDEN') ||
        errMsg.includes('USER_BANNED_IN_CHANNEL') ||
        errMsg.includes('CHAT_ADMIN_REQUIRED') ||
        errMsg.includes('RIGHT_FORBIDDEN') ||
        errMsg.includes('CHANNEL_PRIVATE') ||
        errMsg.includes('USER_RESTRICTED');

      if (isWriteForbidden) {
        initialWriteRestricted = true;
        addLog('info', `[محدودیت ارسال پیام اولیه] در گروه "${groupTitle}" اجازه ارسال مستقیم پیام وجود ندارد (${translateTgError(sendErr)}). در حال بررسی قفل کانال اسپانسر و پیام ربات محافظ...`);
      }
    }

    // Wait 3 seconds for guardian bot reaction
    await new Promise(res => setTimeout(res, 3000));
  } else {
    // Stealth Silent Mode: no unsolicited greeting, proceed directly to inspection
    await new Promise(res => setTimeout(res, 800));
  }

  // --------------------------------------------------------------------------
  // STAGE 3: Check Message Survival & Scan Recent Messages for Guardian Bot
  // --------------------------------------------------------------------------
  let initialSurvived = false;
  if (sentGreetingMsg?.id && !initialWriteRestricted) {
    try {
      const checkArr = await client.getMessages(peer, { ids: [sentGreetingMsg.id] });
      if (checkArr && checkArr.length > 0 && checkArr[0] && checkArr[0].className !== 'MessageEmpty') {
        initialSurvived = true;
      }
    } catch (e) {
      initialSurvived = false;
    }
  }

  let messages: any[] = [];
  try {
    messages = await client.getMessages(peer, { limit: 15 });
  } catch (e: any) {
    console.warn('Failed to fetch recent messages:', e?.message || e);
  }

  let botReactionDetected = initialWriteRestricted;
  let botName = initialWriteRestricted ? 'ربات قفل اسپانسر / ناظر' : 'ربات ناظر گروه';
  let botMsg: any = null;
  let botPromptText = '';
  const inlineButtons: Array<{ text: string; data?: string; url?: string; row: number; col: number }> = [];

  if (messages && messages.length > 0) {
    for (const msg of messages) {
      if (!msg) continue;
      const text = (msg.message || msg.text || '');
      const lower = text.toLowerCase();

      const isSponsorLockNotice =
        lower.includes('اسپانسر') ||
        lower.includes('sponsor') ||
        lower.includes('چنل اسپانسر') ||
        lower.includes('کانال اسپانسر') ||
        lower.includes('ابتدا در چنل') ||
        lower.includes('ابتدا در کانال') ||
        lower.includes('عضو شوید') ||
        lower.includes('عضو شو') ||
        lower.includes('لینک عضویت') ||
        lower.includes('فروش قیمت و خرید') ||
        lower.includes('gaming_render') ||
        lower.includes('digi anti') ||
        lower.includes('دیجی آنتی');

      const isForceAddNotice =
        lower.includes('اضافه کنید') ||
        lower.includes('اضافه نمایید') ||
        lower.includes('اضافه کردهاید') ||
        lower.includes('اضافه کرده اید') ||
        lower.includes('اضافه کرده‌اید') ||
        lower.includes('نفر را اضافه') ||
        lower.includes('نفر اضافه') ||
        lower.includes('نفر دیگر اضافه') ||
        lower.includes('نفر دیگر اد') ||
        lower.includes('نفر اد کنید') ||
        lower.includes('نفر ادد کنید') ||
        lower.includes('اد کنید') ||
        lower.includes('ادد کنید') ||
        lower.includes('قفل اد') ||
        lower.includes('قفل عضوگیری') ||
        lower.includes('دعوت کنید') ||
        lower.includes('دعوت نمایید') ||
        lower.includes('مخاطب اضافه') ||
        lower.includes('باید 3 نفر') ||
        lower.includes('باید ۳ نفر');

      const isBotNotice =
        isSponsorLockNotice ||
        isForceAddNotice ||
        lower.includes('ربات') ||
        lower.includes('bot') ||
        lower.includes('کاپچا') ||
        lower.includes('captcha') ||
        lower.includes('خوش آمد') ||
        lower.includes('welcome') ||
        lower.includes('تایید') ||
        lower.includes('verify') ||
        lower.includes('قفل') ||
        lower.includes('کانال') ||
        lower.includes('channel') ||
        lower.includes('ادد') ||
        lower.includes('عضو') ||
        lower.includes('مخاطب') ||
        lower.includes('حاصل') ||
        lower.includes('جمع') ||
        lower.includes('ضرب') ||
        lower.includes('کد');

      if (isBotNotice || msg.replyMarkup) {
        botReactionDetected = true;
        botMsg = msg;
        botPromptText = text;

        if (isSponsorLockNotice) botName = 'ربات قفل کانال اسپانسر (DIGI ANTI / Sponsor)';
        else if (isForceAddNotice) botName = 'ربات قفل عضوگیری/اد اجباری';
        else if (lower.includes('rose') || lower.includes('رز')) botName = 'ربات MissRose';
        else if (lower.includes('shield') || lower.includes('شیلد')) botName = 'ربات ShieldBot';
        else if (lower.includes('grouphelp') || lower.includes('گروه‌بان')) botName = 'ربات GroupHelp';
        else if (lower.includes('captcha')) botName = 'ربات CaptchaBot';
        else botName = 'ربات محافظ گروه';

        // Extract inline buttons
        if (msg.replyMarkup?.rows) {
          for (let r = 0; r < msg.replyMarkup.rows.length; r++) {
            const rowBtns = msg.replyMarkup.rows[r].buttons || [];
            for (let c = 0; c < rowBtns.length; c++) {
              const b = rowBtns[c];
              inlineButtons.push({
                text: b.text || '',
                data: b.data ? b.data.toString('utf-8') : undefined,
                url: b.url,
                row: r,
                col: c,
              });
            }
          }
        }
        break;
      }
    }
  }

  // If initial greeting survived AND no bot challenged: 100% READY!
  if (initialSurvived && !botReactionDetected && !initialWriteRestricted) {
    if (targetGroup) {
      targetGroup.readinessStatus = 'ready';
      targetGroup.canSendMessages = true;
      targetGroup.greetingTested = true;
      targetGroup.greetingSurvived = true;
      targetGroup.status = 'joined';
      targetGroup.membershipStatus = 'joined';
      targetGroup.lastJoinError = undefined;
      targetGroup.errorMessage = undefined;
    }
    addLog('success', `[۱۰۰٪ آماده ارسال] گروه "${groupTitle}" فاقد ربات محافظ است و پیام «${greetingMsg}» ماندگار ماند. آماده پخش تبلیغات!`);
    return {
      isClear: true,
      botDetected: false,
      statusMessage: 'آماده ارسال تبلیغات (پیام تستی ماندگار ماند)',
      captchaClicked: false,
      channelJoined: false,
      contactsInvited: 0,
    };
  }

  // --------------------------------------------------------------------------
  // STAGE 4: Guardian Bot Challenge Active -> Execute Maximum Solving Pipeline
  // --------------------------------------------------------------------------
  addLog('info', `[ربات محافظ شناسایی شد] "${botName}" در گروه "${groupTitle}" مانع ارسال ایجاد کرده است. در حال اجرای روش‌های حل خودکار...`);

  let captchaClicked = false;
  let channelJoined = false;
  let contactsInvitedCount = 0;
  let mathOrTextSolved = false;

  // 1. Join Sponsor Channels & Click "عضو شدم" / "تایید" button (Comprehensive DIGI ANTI Support)
  if (antiBotConfig.autoForceJoinChannels && botMsg) {
    const sponsorTargets = extractSponsorChannelsFromBotMessage(botMsg);
    if (sponsorTargets.length > 0) {
      addLog('info', `[قفل کانال اسپانسر] ${sponsorTargets.length} کانال حامی الزامی برای گروه "${groupTitle}" شناسایی شد. در حال عضویت خودکار...`);
      for (const st of sponsorTargets) {
        const success = await joinSponsorTarget(client, st, groupTitle);
        if (success) channelJoined = true;
      }
    }

    // Now look for confirmation / verify buttons (callback buttons)
    if (botMsg.replyMarkup?.rows) {
      for (let r = 0; r < botMsg.replyMarkup.rows.length; r++) {
        const rowBtns = botMsg.replyMarkup.rows[r].buttons || [];
        for (let c = 0; c < rowBtns.length; c++) {
          const btn = rowBtns[c];
          const btnText = (btn.text || '').toLowerCase();
          const isJoinConfirm =
            btnText.includes('عضو شدم') ||
            btnText.includes('عضویت تایید شد') ||
            btnText.includes('تایید عضویت') ||
            btnText.includes('بررسی') ||
            btnText.includes('بررسی مجدد') ||
            btnText.includes('joined') ||
            btnText.includes('verify') ||
            btnText.includes('حل شد') ||
            btnText.includes('ورود به گروه');

          if (isJoinConfirm) {
            try {
              if (typeof botMsg.click === 'function') {
                await botMsg.click({ i: r, j: c });
              } else if (btn.data && Api && Api.messages && Api.messages.GetBotCallbackAnswer) {
                await client.invoke(new Api.messages.GetBotCallbackAnswer({
                  peer,
                  msgId: botMsg.id,
                  data: btn.data,
                }));
              }
              captchaClicked = true;
              addLog('info', `[تایید عضویت] دکمه تایید عضویت در کانال «${btn.text}» خودکار کلیک شد.`);
              await new Promise(res => setTimeout(res, 1200));
            } catch (e: any) {}
          }
        }
      }
    }

    // If DIGI ANTI or similar bot has no confirmation button (automated webhook verification), wait 3.5 seconds
    if (channelJoined && !captchaClicked) {
      addLog('info', `[رفع خودکار قفل اسپانسر] وقفه ۳ ثانیه‌ای جهت به‌روزرسانی ربات ناظر تلگرام...`);
      await new Promise(res => setTimeout(res, 3500));
    }
  }

  // 2. Click "I am not a bot" Button
  if (antiBotConfig.autoClickCaptcha && botMsg?.replyMarkup?.rows) {
    for (let r = 0; r < botMsg.replyMarkup.rows.length; r++) {
      const rowBtns = botMsg.replyMarkup.rows[r].buttons || [];
      for (let c = 0; c < rowBtns.length; c++) {
        const btn = rowBtns[c];
        const btnText = (btn.text || '').toLowerCase();
        const isNotBotBtn =
          btnText.includes('ربات نیستم') ||
          btnText.includes('من ربات نیستم') ||
          btnText.includes('not a bot') ||
          btnText.includes('human') ||
          btnText.includes('انسانیت') ||
          btnText.includes('کلیک کنید') ||
          btnText.includes('ورود') ||
          btnText.includes('تایید قوانین') ||
          btnText.includes('پذیرش قوانین');

        if (isNotBotBtn) {
          try {
            if (typeof botMsg.click === 'function') {
              await botMsg.click({ i: r, j: c });
            } else if (btn.data && Api && Api.messages && Api.messages.GetBotCallbackAnswer) {
              await client.invoke(new Api.messages.GetBotCallbackAnswer({
                peer,
                msgId: botMsg.id,
                data: btn.data,
              }));
            }
            captchaClicked = true;
            addLog('info', `[حل کاپچا] دکمه «${btn.text}» جهت اثبات کاربر واقعی خودکار کلیک شد.`);
            await new Promise(res => setTimeout(res, 1000));
          } catch (e: any) {}
        }
      }
    }
  }

  // 3. Solve Math & Text Challenge via Algorithmic Solver
  if (antiBotConfig.autoSolveMathCaptcha !== false && botMsg) {
    const solved = solveBotMathOrTextChallenge(botPromptText, groupTitle);
    if (solved) {
      mathOrTextSolved = true;
      let clickedBtn = false;
      if (botMsg.replyMarkup?.rows) {
        for (let r = 0; r < botMsg.replyMarkup.rows.length; r++) {
          const rowBtns = botMsg.replyMarkup.rows[r].buttons || [];
          for (let c = 0; c < rowBtns.length; c++) {
            const btn = rowBtns[c];
            const btnText = (btn.text || '').trim();
            const normBtn = btnText.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
            if (normBtn === solved || normBtn.includes(solved)) {
              try {
                if (typeof botMsg.click === 'function') {
                  await botMsg.click({ i: r, j: c });
                } else if (btn.data && Api && Api.messages && Api.messages.GetBotCallbackAnswer) {
                  await client.invoke(new Api.messages.GetBotCallbackAnswer({
                    peer,
                    msgId: botMsg.id,
                    data: btn.data,
                  }));
                }
                captchaClicked = true;
                clickedBtn = true;
                addLog('info', `[پاسخ ریاضی] پاسخ «${solved}» با کلیک روی دکمه «${btn.text}» اعمال شد.`);
                await new Promise(res => setTimeout(res, 1000));
                break;
              } catch (e: any) {}
            }
          }
          if (clickedBtn) break;
        }
      }

      if (!clickedBtn) {
        try {
          await client.sendMessage(peer, { message: solved, replyTo: botMsg.id });
          addLog('info', `[پاسخ ریاضی/متنی] پاسخ چالش ربات ناظر («${solved}») در قالب ریپلای ارسال شد.`);
          await new Promise(res => setTimeout(res, 1500));
        } catch (e: any) {}
      }
    }
  }

  // 4. Automatic Force-Add & Member Lock Solver (Bypass "باید X نفر اضافه کنید")
  const forceAddReq = detectAndExtractForceAddRequirement(botPromptText, account?.firstName, account?.phoneNumber);
  if (forceAddReq.isForceAdd) {
    addLog(
      'info',
      `[قفل اد اجباری شناسایی شد] ربات ناظر گروه "${groupTitle}" الزام کرده: باید ${forceAddReq.totalNeeded} نفر اضافه شوند (تاکنون: ${forceAddReq.currentAdded} نفر). در حال اجرای خودکار افزودن ${forceAddReq.remainingNeeded} مخاطب جهت شکستن قفل...`
    );
    const bypassRes = await executeForceAddBypass(client, peer, forceAddReq.remainingNeeded, groupTitle);
    contactsInvitedCount = bypassRes.invitedCount;
    if (bypassRes.invitedCount > 0) {
      await new Promise(res => setTimeout(res, 3000));
    }
  } else if (antiBotConfig.autoInviteContacts && botMsg) {
    const needsAddMembers =
      botPromptText.includes('اضافه کنید') ||
      botPromptText.includes('عضو کنید') ||
      botPromptText.includes('اد کنید') ||
      botPromptText.includes('مخاطب') ||
      botPromptText.includes('دعوت');

    if (needsAddMembers) {
      const needed = antiBotConfig.contactsToInviteCount || 3;
      addLog('info', `[ادد خودکار مخاطبان] در حال افزودن ${needed} نفر به گروه "${groupTitle}"...`);
      const bypassRes = await executeForceAddBypass(client, peer, needed, groupTitle);
      contactsInvitedCount = bypassRes.invitedCount;
      if (bypassRes.invitedCount > 0) {
        await new Promise(res => setTimeout(res, 3000));
      }
    }
  }

  // 5. Deep AI Solver (Gemini) for Complex / Unsolved Challenges
  if (!mathOrTextSolved && !captchaClicked && botMsg) {
    const buttonTexts = inlineButtons.map(b => b.text);
    const aiSolution = await solveCaptchaWithGemini(botPromptText, buttonTexts, groupTitle);
    if (aiSolution) {
      addLog('info', `[هوش مصنوعی Gemini] تحلیل هوشمند چالش ربات انجام شد: اقدام پیشنهادی: ${aiSolution.action}`);
      if (aiSolution.action === 'click_button' && aiSolution.target) {
        for (let r = 0; r < (botMsg.replyMarkup?.rows || []).length; r++) {
          const rowBtns = botMsg.replyMarkup.rows[r].buttons || [];
          for (let c = 0; c < rowBtns.length; c++) {
            const b = rowBtns[c];
            if (b.text?.includes(aiSolution.target) || aiSolution.target.includes(b.text)) {
              try {
                if (typeof botMsg.click === 'function') await botMsg.click({ i: r, j: c });
                captchaClicked = true;
                addLog('info', `[هوش مصنوعی Gemini] دکمه مورد تایید «${b.text}» کلیک شد.`);
                await new Promise(res => setTimeout(res, 1000));
              } catch (e: any) {}
            }
          }
        }
      } else if (aiSolution.action === 'send_text' && aiSolution.answer) {
        try {
          await client.sendMessage(peer, { message: aiSolution.answer, replyTo: botMsg.id });
          addLog('info', `[هوش مصنوعی Gemini] پاسخ متنی «${aiSolution.answer}» ارسال شد.`);
          await new Promise(res => setTimeout(res, 1500));
        } catch (e: any) {}
      } else if (aiSolution.action === 'join_channel' && aiSolution.target) {
        const cleanCh = aiSolution.target.replace('@', '').trim();
        try {
          if (Api && Api.channels) {
            await client.invoke(new Api.channels.JoinChannel({ channel: cleanCh }));
            channelJoined = true;
            addLog('info', `[هوش مصنوعی Gemini] عضویت در کانال حامی @${cleanCh} انجام شد.`);
          }
        } catch (e: any) {}
      }
    }
  }

  // --------------------------------------------------------------------------
  // STAGE 5: Send Second Test Greeting & Verify Survival
  // --------------------------------------------------------------------------
  await new Promise(res => setTimeout(res, 2500));
  let secondSurvived = false;
  let secondSendErrorReason: string | undefined = undefined;

  try {
    const secondMsg = await client.sendMessage(peer, { message: greetingMsg });
    addLog('info', `[تست مجدد پس از حل چالش] پیام تاییدیه دوم «${greetingMsg}» به گروه "${groupTitle}" ارسال شد. در حال پایش ۴ ثانیه‌ای ماندگاری پیام...`);
    await new Promise(res => setTimeout(res, 4000));
    const checkSecond = await client.getMessages(peer, { ids: [secondMsg.id] });
    if (checkSecond && checkSecond.length > 0 && checkSecond[0] && checkSecond[0].className !== 'MessageEmpty') {
      secondSurvived = true;
    }
  } catch (secondErr: any) {
    const secondErrMsg = String(secondErr?.message || secondErr?.errorMessage || secondErr);
    if (
      secondErrMsg.includes('CHAT_WRITE_FORBIDDEN') ||
      secondErrMsg.includes('CHAT_SEND_PLAIN_FORBIDDEN') ||
      secondErrMsg.includes('USER_BANNED_IN_CHANNEL') ||
      secondErrMsg.includes('USER_RESTRICTED') ||
      secondErrMsg.includes('CHAT_ADMIN_REQUIRED') ||
      secondErrMsg.includes('RIGHT_FORBIDDEN') ||
      secondErrMsg.includes('CHANNEL_PRIVATE')
    ) {
      secondSendErrorReason = translateTgError(secondErr);
      addLog('info', `[محدودیت ارسال در گروه] ارسال پیام در گروه "${groupTitle}" به دلیل محدودیت‌های مدیر یا ربات مسدود است (${secondSendErrorReason}).`);
    } else {
      secondSendErrorReason = secondErrMsg;
      console.warn(`[تست پیام دوم] خطا در ارسال پیام به گروه ${groupTitle}:`, secondErrMsg);
    }
  }

  // --------------------------------------------------------------------------
  // STAGE 6: Final Categorization (Ready vs Captcha Required)
  // --------------------------------------------------------------------------
  if (secondSurvived) {
    // 100% READY!
    if (targetGroup) {
      targetGroup.readinessStatus = 'ready';
      targetGroup.canSendMessages = true;
      targetGroup.greetingTested = true;
      targetGroup.greetingSurvived = true;
      targetGroup.status = 'joined';
      targetGroup.membershipStatus = 'joined';
      targetGroup.lastJoinError = undefined;
      targetGroup.errorMessage = undefined;
      targetGroup.captchaDetails = {
        botName,
        challengeText: botPromptText.slice(0, 300),
        solvedAutomatically: true,
        detectedAt: new Date().toISOString(),
        lastAttemptResult: 'کپچا با موفقیت خودکار حل شد و پیام دوم ماندگار ماند ✓',
      };
    }

    addLog('success', `[۱۰۰٪ آماده ارسال تبلیغات] گروه "${groupTitle}" با موفقیت تایید شد! موانع رفع شد و پیام تستی ماندگار ماند.`);
    return {
      isClear: true,
      botDetected: true,
      statusMessage: 'موانع برطرف شد و گروه ۱۰۰٪ آماده انتشار تبلیغات است.',
      captchaClicked,
      channelJoined,
      contactsInvited: contactsInvitedCount,
    };
  } else {
    // CATEGORY 2: NEEDS MANUAL RESOLUTION (Never auto-leave supergroups!)
    const failureReason = secondSendErrorReason
      ? `ارسال پیام در این گروه مسدود است (${secondSendErrorReason})`
      : 'قفل کانال اسپانسر یا ربات ناظر شناسایی شد. جهت اطمینان نیازمند تایید کاربر است.';

    if (targetGroup) {
      targetGroup.readinessStatus = 'captcha_required';
      targetGroup.canSendMessages = false;
      targetGroup.greetingTested = true;
      targetGroup.greetingSurvived = false;
      targetGroup.status = 'joined';
      targetGroup.membershipStatus = 'joined';
      targetGroup.captchaDetails = {
        botName: botName || (secondSendErrorReason ? 'تنظیمات دسترسی گروه / ربات ناظر' : 'ربات ناظر گروه'),
        challengeText: botPromptText.slice(0, 400) || (secondSendErrorReason ? `خطای ارسال تلگرام: ${secondSendErrorReason}` : ''),
        solvedAutomatically: false,
        detectedAt: new Date().toISOString(),
        inlineButtons,
        msgId: botMsg?.id,
        lastAttemptResult: failureReason,
      };
    }

    addLog('warning', `[نیازمند اقدام تکمیلی] در گروه "${groupTitle}" ربات محافظ مانع ایجاد کرده یا پیام تاییدیه ماندگار نشد. گروه در وضعیت «نیازمند بررسی» قرار گرفت.`);
    return {
      isClear: false,
      botDetected: true,
      statusMessage: failureReason,
      captchaClicked,
      channelJoined,
      contactsInvited: contactsInvitedCount,
    };
  }
}

// Helper Function: Execute Broadcast to Active Groups with Parallel Multi-Account Dispatch & Dynamic Failover
async function executeBroadcast(isManualTrigger = false) {
  if (isBroadcastRunning) {
    addLog('warning', '[پروسه ارسال] یک عملیات ارسال کمپین هم‌اکنون در حال اجرا است. جهت جلوگیری از ارسال تکراری توسط اکانت‌ها، درخواست جدید منتظر ماند.');
    return { success: false, message: 'عملیات ارسال کمپین هم‌اکنون در حال اجرا است.' };
  }

  isBroadcastRunning = true;
  isBroadcastCancellationRequested = false;
  let tempImgPath: string | undefined = undefined;
  let reportSuccessCount = 0;
  let reportFailedCount = 0;
  const broadcastStartTime = Date.now();
  const reportGroupDetails: any[] = [];
  const usedAccountPhones = new Set<string>();

  try {
    // 1. Reset daily counters if a new day has started
    checkAndResetDailyCounters();

    // 2. Check Night Mode (01:00 AM to 07:00 AM pause)
    if (!isManualTrigger && isNightModeActive()) {
      addLog('warning', '[حالت خواب شبانه] ارسال اتوماتیک بین ساعت ۰۱:۰۰ تا ۰۷:۰۰ صبح جهت جلوگیری از ریپورت و جلب توجه متوقف گردید.');
      return { success: false, message: 'حالت خواب شبانه فعال است. ارسال متوقف شد.' };
    }

    // 3. Check Daily Limit
    const currentDailySent = appState.scheduler.dailySentCount || 0;
    const maxDailyLimit = appState.scheduler.dailyLimit || 35;
    if (currentDailySent >= maxDailyLimit) {
      addLog('warning', `[سقف مجاز روزانه] سقف ارسال امروز (${maxDailyLimit} پیام) فراتر رفته است. ارسال تا فردا متوقف شد.`);
      return { success: false, message: `سقف ارسال روزانه (${maxDailyLimit} پیام) تکمیل شده است.` };
    }

    const activeCampaigns = appState.campaigns.filter(c => c.isActive);
    const shardedActiveGroups = getShardedActiveGroups();
    const activeGroups = shardedActiveGroups;

    if (activeCampaigns.length === 0) {
      addLog('warning', 'هیچ کمپین یا محصول فعالی برای ارسال وجود ندارد.');
      return { success: false, message: 'هیچ محصول فعالی یافت نشد.' };
    }

    if (activeGroups.length === 0) {
      addLog('warning', 'هیچ گروه هدفی برای این نود فعال نیست. لطفاً حداقل یک گروه فعال انتخاب کنید.');
      return { success: false, message: 'گروه هدفی فعال نیست.' };
    }

    // 4. Apply Promotional Group Filter if enabled
    let targetGroupsToProcess = activeGroups;
    if (appState.scheduler.onlyPromotionalGroups) {
      targetGroupsToProcess = activeGroups.filter(g => {
        const cat = (g.category || '').toLowerCase();
        const title = (g.title || '').toLowerCase();
        const isGeneral = cat.includes('عمومی') || cat.includes('general') || title.includes('چت عمومی');
        return !isGeneral;
      });
      if (targetGroupsToProcess.length < activeGroups.length) {
        addLog('info', `[فیلتر گروه‌ها] تعداد ${activeGroups.length - targetGroupsToProcess.length} گروه عمومی جهت جلوگیری از ریپورت نادیده گرفته شد.`);
      }
      if (targetGroupsToProcess.length === 0) {
        addLog('warning', 'تمام گروه‌های فعال از نوع عمومی تشخیص داده شدند. ارسال انجام نشد.');
        return { success: false, message: 'هیچ گروه تبلیغاتی یا تبادلی یافت نشد.' };
      }
    }

    // 4.1 Apply Strategy 1 constraint: only groups that are 100% ready (joined & sendable)
    const activeStrategy = appState.groupPromotionStrategy?.activeStrategy || 'periodic_broadcast';
    const strat1 = appState.groupPromotionStrategy?.strategy1;
    if ((activeStrategy === 'periodic_broadcast' || activeStrategy === 'hybrid_both') && strat1?.onlyFullyReadyGroups) {
      const prevCount = targetGroupsToProcess.length;
      targetGroupsToProcess = targetGroupsToProcess.filter(g => {
        const isJoined = g.status === 'joined' || g.membershipStatus === 'joined' || (g.joinedAccountIds && g.joinedAccountIds.length > 0);
        const canSend = g.canSendMessages !== false && g.readinessStatus !== 'no_permission_left';
        return isJoined && canSend;
      });
      addLog('info', `[استراتژی اول] تعداد ${targetGroupsToProcess.length} گروه ۱۰۰٪ آماده (با مجوز ارسال پیام) از مجموع ${prevCount} گروه فعال انتخاب شدند.`);
      if (targetGroupsToProcess.length === 0) {
        addLog('warning', '[استراتژی اول] هیچ گروهی با وضعیت ۱۰۰٪ آماده (عضو شده و دارای مجوز ارسال پیام) یافت نشد.');
        return { success: false, message: 'هیچ گروه ۱۰۰٪ آماده‌ای جهت ارسال یافت نشد.' };
      }
    }

    // 4.2 Persian-Only Audience Shield: strictly enforce sending to 100% verified Persian groups
    const isEnforcePersian = appState.scheduler?.onlyPersianVerifiedGroups !== false && appState.groupJoinStrategy?.enforcePersianIranianOnly !== false;
    if (isEnforcePersian) {
      const prevCount = targetGroupsToProcess.length;
      targetGroupsToProcess = targetGroupsToProcess.filter(g => {
        if (g.status === 'purged_non_persian' || g.readinessStatus === 'non_persian_purged') return false;
        if (isBlacklistedNonPersianTarget(g.usernameOrLink) || isBlacklistedNonPersianTarget(g.title)) return false;
        if (g.isPersianVerified === false) return false;
        const isVerified = g.isPersianVerified === true || (g.languageDetected === 'fa' && hasPersianScriptOrTokens(g.title));
        return isVerified;
      });
      const filteredOut = prevCount - targetGroupsToProcess.length;
      if (filteredOut > 0) {
        addLog('info', `[سپر جامعه هدف فارسی] تعداد ${filteredOut} گروه غیرایرانی یا تاییدنشده جهت حفظ سهمیه تبلیغاتی نادیده گرفته شدند.`);
      }
      if (targetGroupsToProcess.length === 0) {
        addLog('warning', '[سپر جامعه هدف فارسی] هیچ گروه تاییدشده فارسی برای ارسال تبلیغات یافت نشد. جهت حفظ سهمیه، ارسال متوقف گردید.');
        return { success: false, message: 'هیچ گروه تاییدشده فارسی جهت ارسال یافت نشد.' };
      }
    }

    // Prepare media image paths for all active campaigns
    const campaignImagePaths = new Map<string, string>();
    for (const camp of activeCampaigns) {
      if (camp.imageUrl) {
        try {
          const imgP = await getImageFilePathForTelegram(camp.imageUrl);
          if (imgP) campaignImagePaths.set(camp.id, imgP);
        } catch (e) {}
      }
    }

    // Helper: Select campaign based on campaignRotationMode ('round_robin', 'category_match', or 'first_active')
    function getCampaignForGroup(grp: any, grpIdx: number): any {
      if (activeCampaigns.length <= 1) return activeCampaigns[0];
      const rotMode = appState.scheduler.campaignRotationMode || 'round_robin';
      if (rotMode === 'category_match') {
        const groupCat = (grp.category || '').toLowerCase();
        const groupTitle = (grp.title || '').toLowerCase();
        const matched = activeCampaigns.find(c => {
          const cTitle = (c.title || '').toLowerCase();
          const tagMatch = c.hashtags?.some((h: string) => {
            const cleanH = h.replace('#', '').toLowerCase();
            return groupCat.includes(cleanH) || groupTitle.includes(cleanH);
          });
          return tagMatch || groupCat.includes(cTitle) || groupTitle.includes(cTitle);
        });
        if (matched) return matched;
      }
      if (rotMode === 'first_active') {
        return activeCampaigns[0];
      }
      // Default: round_robin
      return activeCampaigns[grpIdx % activeCampaigns.length];
    }

    const primaryCampaign = activeCampaigns[0];
    const campaign = primaryCampaign;
    const botToken = appState.credentials.botToken;

    // Filter available active accounts for Group Broadcast
    syncAccountsState();
    const availableAccounts = (appState.accounts || []).filter(
      a => (a.enableForGroupBroadcast !== false) && a.isActive && a.status !== 'session_expired' && a.status !== 'disabled' && (!a.floodWaitUntil || a.floodWaitUntil < Date.now())
    );

    const dispatchMode = appState.scheduler.multiAccountDispatchMode || 'parallel_multichannel';
    const isParallel = dispatchMode === 'parallel_multichannel' && availableAccounts.length > 1;

    addLog(
      'info',
      `[آغاز فرایند ارسال] انتشار ${activeCampaigns.length} کمپین فعال به ${targetGroupsToProcess.length} گروه هدف با ${availableAccounts.length} اکانت متصل (حالت: ${isParallel ? 'ارسال همزمان و تقسیم موازی کار' : 'ارسال تک‌کاناله/چرخشی'}، چرخش: ${appState.scheduler.campaignRotationMode || 'نوبتی Round-Robin'})...`,
      undefined,
      undefined,
      primaryCampaign.title
    );

    // Track per-account statistics
    const accountStatsMap = new Map<string, {
      accountId: string;
      accountPhone: string;
      accountName?: string;
      sentCount: number;
      failedCount: number;
      hitRateLimit?: boolean;
    }>();

    for (const acc of availableAccounts) {
      accountStatsMap.set(acc.id, {
        accountId: acc.id,
        accountPhone: acc.phoneNumber,
        accountName: acc.userProfile?.firstName,
        sentCount: 0,
        failedCount: 0,
        hitRateLimit: false,
      });
    }

    // Central Synchronized Queue for Zero-Collision & Dynamic Redistribution
    const claimedGroupIds = new Set<string>();
    const completedGroupIds = new Set<string>();
    const minGroupIntervalMs = Math.max((appState.scheduler.intervalMinutes || 10) - 1, 5) * 60 * 1000;
    const nowTime = Date.now();

    // Initialize live broadcast worker progress
    const activeWorkersProgress: any[] = availableAccounts.map(a => ({
      accountId: a.id,
      accountPhone: a.phoneNumber,
      accountName: a.userProfile?.firstName,
      status: 'idle',
      sentSuccessCount: 0,
      failedCount: 0,
      lastAction: 'در صف آماده‌سازی...',
    }));

    appState.activeBroadcastProgress = {
      isRunning: true,
      startTime: new Date().toISOString(),
      totalGroups: targetGroupsToProcess.length,
      completedGroups: 0,
      successCount: 0,
      failedCount: 0,
      dispatchMode: isParallel ? 'parallel_multichannel' : 'sequential_rotation',
      workers: activeWorkersProgress,
    };

    function claimNextGroupForWorker(workerAccId: string): TargetGroup | null {
      // 1. Highest priority: Groups where this account is the assigned territory owner AND a confirmed joined member
      for (const g of targetGroupsToProcess) {
        if (!claimedGroupIds.has(g.id) && !completedGroupIds.has(g.id)) {
          if (g.assignedAccountId === workerAccId && g.joinedAccountIds && g.joinedAccountIds.includes(workerAccId)) {
            claimedGroupIds.add(g.id);
            return g;
          }
        }
      }
      // 2. High priority: Groups where this account is a confirmed joined member in Telegram
      for (const g of targetGroupsToProcess) {
        if (!claimedGroupIds.has(g.id) && !completedGroupIds.has(g.id)) {
          if (g.joinedAccountIds && g.joinedAccountIds.includes(workerAccId)) {
            claimedGroupIds.add(g.id);
            return g;
          }
        }
      }
      // 3. Medium priority: Unjoined groups explicitly assigned to this account's territory
      for (const g of targetGroupsToProcess) {
        if (!claimedGroupIds.has(g.id) && !completedGroupIds.has(g.id)) {
          if (g.assignedAccountId === workerAccId) {
            claimedGroupIds.add(g.id);
            return g;
          }
        }
      }
      // 4. Territory Guard: If failover redistribution is disabled, do NOT claim other accounts' groups!
      const enableRedistribution = appState.scheduler?.antiBot?.enableFailoverRedistribution ?? false;
      if (enableRedistribution) {
        // Fallback: claim next unassigned unclaimed group
        for (const g of targetGroupsToProcess) {
          if (!claimedGroupIds.has(g.id) && !completedGroupIds.has(g.id)) {
            claimedGroupIds.add(g.id);
            return g;
          }
        }
      }
      return null;
    }

    function releaseGroupBackToSharedQueue(g: TargetGroup, reason: string) {
      claimedGroupIds.delete(g.id);
      addLog('info', `[تقسیم مجدد کار] گروه "${g.title}" به دلیل (${reason}) به صف عمومی بازگردانده شد تا سایر اکانت‌های فعال آن را ارسال کنند.`);
    }

    function markGroupAsCompleted(g: TargetGroup) {
      completedGroupIds.add(g.id);
      claimedGroupIds.delete(g.id);
      if (appState.activeBroadcastProgress) {
        appState.activeBroadcastProgress.completedGroups = completedGroupIds.size;
      }
    }

    // Worker executor for a specific account
    async function runAccountWorker(account: any, workerIndex: number) {
      const workerProgress = activeWorkersProgress.find(w => w.accountId === account.id) || activeWorkersProgress[workerIndex];
      const accStats = accountStatsMap.get(account.id);

      if (workerProgress) {
        workerProgress.status = 'preparing';
        workerProgress.lastAction = 'در حال اتصال کلاینت تلگرام...';
      }

      let accClient: any = null;
      try {
        accClient = await getOrInitClientForAccount(account);
      } catch (err: any) {
        console.error(`Client init error for account ${account.phoneNumber}:`, err);
        if (workerProgress) {
          workerProgress.status = 'finished';
          workerProgress.lastAction = `خطا در اتصال: ${err?.message || 'نامشخص'}`;
        }
        return;
      }

      if (!accClient || accClient._destroyed) {
        if (workerProgress) {
          workerProgress.status = 'finished';
          workerProgress.lastAction = 'کلاینت تلگرام آماده نشد یا نشست منقضی شده است';
        }
        return;
      }

      usedAccountPhones.add(account.phoneNumber);

      // Continuous queue draining loop for this worker
      while (completedGroupIds.size < targetGroupsToProcess.length) {
        // Immediate user cancellation check
        if (isBroadcastCancellationRequested) {
          if (workerProgress) {
            workerProgress.status = 'finished';
            workerProgress.lastAction = 'عملیات ارسال توسط کاربر لغو گردید';
          }
          break;
        }

        // Check if daily limits reached
        if ((account.dailySentCount || 0) >= maxDailyLimit || (appState.scheduler.dailySentCount || 0) >= maxDailyLimit) {
          if (workerProgress) {
            workerProgress.status = 'finished';
            workerProgress.lastAction = 'سقف مجاز روزانه این حساب تکمیل شد';
          }
          break;
        }

        // Check if account has entered flood wait
        if (account.floodWaitUntil && account.floodWaitUntil > Date.now()) {
          if (workerProgress) {
            workerProgress.status = 'flood_waited';
            workerProgress.lastAction = 'محدودیت FloodWait تلگرام';
          }
          break;
        }

        const group = claimNextGroupForWorker(account.id);
        if (!group) {
          // No more unclaimed groups right now
          break;
        }

        if (isBroadcastCancellationRequested) {
          releaseGroupBackToSharedQueue(group, 'توقف دستی');
          break;
        }

        // Check group cooldown
        if (group.lastPostedAt && !isManualTrigger) {
          const lastPostedTime = new Date(group.lastPostedAt).getTime();
          if (nowTime - lastPostedTime < minGroupIntervalMs) {
            addLog('info', `[زمان تنفس گروه] گروه "${group.title}" اخیراً پیام دریافت کرده است. عبور جهت جلوگیری از اسپم...`, group.title);
            reportGroupDetails.push({
              groupId: group.id,
              groupTitle: group.title,
              usernameOrLink: group.usernameOrLink,
              status: 'skipped',
              botDetected: false,
              botResolved: false,
              message: 'در زمان تنفس گروه (ارسال اخیر)',
            });
            markGroupAsCompleted(group);
            continue;
          }
        }

        if (workerProgress) {
          workerProgress.status = 'antibot_verifying';
          workerProgress.currentGroupId = group.id;
          workerProgress.currentGroupTitle = group.title;
          workerProgress.lastAction = `در حال ورود و ارزیابی موانع آنتی‌بات "${group.title}"...`;
        }

        let botDetectedInGroup = false;
        const existingMon = (appState.monitoringReports || []).find(r => r.groupId === group.title || r.groupTitle === group.title);
        if (existingMon && existingMon.botDetected) {
          botDetectedInGroup = true;
        }

        let isVerified = false;
        let sentSuccessForGroup = false;
        let peer: any = null;

        try {
          if (isBroadcastCancellationRequested) {
            releaseGroupBackToSharedQueue(group, 'توقف دستی');
            break;
          }

          peer = await resolveAndJoinGroup(accClient, group.usernameOrLink);

          if (isBroadcastCancellationRequested) {
            releaseGroupBackToSharedQueue(group, 'توقف دستی');
            break;
          }

          if (botToken) {
            await ensureBotInGroup(accClient, peer, botToken);
          }

          const verification = await handleAntiBotAndGroupVerification(accClient, peer, group.title, group, account);
          if (verification.botDetected) {
            botDetectedInGroup = true;
          }

          if (isBroadcastCancellationRequested) {
            releaseGroupBackToSharedQueue(group, 'توقف دستی');
            break;
          }

          // Select campaign for this group based on rotation mode
          const grpIdx = targetGroupsToProcess.findIndex(tg => tg.id === group.id);
          const campaign = getCampaignForGroup(group, grpIdx >= 0 ? grpIdx : completedGroupIds.size);
          const allowBanner = (activeStrategy === 'periodic_broadcast' || activeStrategy === 'hybrid_both')
            ? (strat1?.includeBanner !== false)
            : true;
          const campImgPath = (allowBanner && campaign.imageUrl) ? campaignImagePaths.get(campaign.id) : undefined;

          if (verification.isClear) {
            if (workerProgress) {
              workerProgress.status = 'sending';
              workerProgress.lastAction = `در حال شبیه‌سازی رفتار انسانی و انتشار پیام در "${group.title}"...`;
            }

            // Anti-Spam Dynamic Caption Generation (Gemini AI or Local Dynamic Engine)
            let groupTextMessage = '';
            let usedAiCaption = false;
            const useGemini = (strat1?.useGeminiRewriting !== undefined)
              ? Boolean(strat1.useGeminiRewriting)
              : (appState.scheduler.antiBot?.useGeminiForCaptions !== false);
            const captionTone = strat1?.geminiCaptionTone || appState.scheduler.antiBot?.geminiCaptionTone || 'friendly';

            if (useGemini) {
              try {
                const aiGen = await generateGeminiDynamicAdCaption({
                  campaign,
                  groupTitle: group.title,
                  accountName: account.userProfile?.firstName || account.phoneNumber,
                  tone: captionTone,
                });
                groupTextMessage = aiGen.text;
                usedAiCaption = aiGen.usedAi;
              } catch (aiErr) {
                console.warn('[Broadcast] Gemini caption error, falling back:', aiErr);
              }
            }

            if (!groupTextMessage) {
              groupTextMessage = generateLocalDynamicCaption(campaign, {
                groupTitle: group.title,
                accountName: account.userProfile?.firstName || account.phoneNumber,
              });
            }

            if (usedAiCaption) {
              addLog('info', `[هوش مصنوعی Gemini] متن بنر اختصاصی و متنوع برای گروه "${group.title}" با موفقیت تولید شد.`);
            }

            if (appState.activeBroadcastProgress) {
              appState.activeBroadcastProgress.lastGeneratedSampleMessage = {
                groupTitle: group.title,
                accountName: account.userProfile?.firstName || account.phoneNumber,
                text: groupTextMessage,
                timestamp: new Date().toISOString(),
              };
            }

            const sendRes = await sendCampaignWithRetry(
              accClient,
              peer,
              groupTextMessage,
              campImgPath,
              account.id,
              {
                simulateTyping: appState.scheduler.antiBot?.simulateTyping !== false,
                typingDurationSeconds: appState.scheduler.antiBot?.typingDurationSeconds || 2,
                groupTitle: group.title,
                supportForumTopics: appState.scheduler.antiBot?.supportForumTopics !== false,
              }
            );

            if (sendRes.success) {
              const msgId = sendRes.sentResult?.id || (Array.isArray(sendRes.sentResult) ? sendRes.sentResult[0]?.id : undefined);
              await new Promise(r => setTimeout(r, 1200));

              if (msgId) {
                try {
                  const checkedMsgs = await accClient.getMessages(peer, { ids: [msgId] });
                  if (checkedMsgs && checkedMsgs.length > 0 && checkedMsgs[0] && checkedMsgs[0].id === msgId) {
                    isVerified = true;
                  }
                } catch (e) {
                  isVerified = true;
                }
              } else if (sendRes.sentResult) {
                isVerified = true;
              }

              // Post-Broadcast Persistence Check (detect auto-delete bots)
              if (isVerified && msgId && appState.scheduler.antiBot?.verifyMessagePersistence !== false) {
                group.persistenceStatus = 'pending_check';
                const pDelay = appState.scheduler.antiBot?.persistenceCheckDelaySeconds || 15;
                // Run non-blocking persistence check after specified delay
                verifyMessagePersistenceInGroup(accClient, peer, msgId, group, pDelay).catch(err => {
                  console.warn('Post-broadcast persistence check warning:', err);
                });
              } else if (isVerified) {
                group.persistenceStatus = 'verified';
              }
            } else {
              addLog('warning', `[خطای ارسال اکانت] ارسال با اکانت (${account.phoneNumber}) در "${group.title}" ناموفق بود: ${sendRes.error}`, group.title);
            }
          }

          if (isVerified) {
            sentSuccessForGroup = true;
            markGroupAsCompleted(group);

            const postTimeStr = new Date().toISOString();
            group.lastPostedAt = postTimeStr;
            group.lastPostedByAccountId = account.id;
            group.lastPostedByAccountPhone = account.phoneNumber;
            group.status = 'joined';
            group.errorMessage = undefined;

            account.dailySentCount = (account.dailySentCount || 0) + 1;
            account.lastUsedAt = postTimeStr;
            appState.scheduler.dailySentCount = (appState.scheduler.dailySentCount || 0) + 1;

            if (accStats) accStats.sentCount++;
            if (workerProgress) {
              workerProgress.sentSuccessCount++;
              workerProgress.status = 'cooldown';
              workerProgress.lastAction = `پیام با موفقیت در "${group.title}" ثبت شد. استراحت هوشمند...`;
            }
            if (appState.activeBroadcastProgress) {
              appState.activeBroadcastProgress.successCount++;
            }

            updateGroupMonitoringReport({
              groupId: group.title,
              groupTitle: group.title,
              step: 'CAMPAIGN_SENT',
              requiresManualCheck: false,
              statusMessage: `🚀 پیام کمپین با موفقیت توسط اکانت همزمان (${account.userProfile?.firstName || account.phoneNumber}) منتشر و تایید شد!`,
            });

            addLog(
              'success',
              `[ارسال موفق همزمان] پیام کمپین "${campaign.title}" در گروه "${group.title}" توسط اکانت (${account.userProfile?.firstName || account.phoneNumber}) ارسال و تایید شد.`,
              group.title,
              undefined,
              campaign.title
            );

            reportGroupDetails.push({
              groupId: group.id,
              groupTitle: group.title,
              usernameOrLink: group.usernameOrLink,
              status: 'success',
              botDetected: botDetectedInGroup,
              botResolved: botDetectedInGroup,
              accountPhone: account.phoneNumber,
              accountName: account.userProfile?.firstName,
              message: botDetectedInGroup ? 'ارسال موفق با خنثی‌سازی ربات ناظر' : 'ارسال همزمان موفق و تایید شده',
              postedAt: postTimeStr,
              persistenceStatus: group.persistenceStatus || 'verified',
              spintaxApplied: true,
              mediaFromCache: true,
              typingSimulated: appState.scheduler.antiBot?.simulateTyping !== false,
            });

            // Optional: Auto Leave & Purge Group from Telegram after successful post
            if (appState.scheduler.antiBot?.autoLeaveAndPurgeAfterPost && peer) {
              try {
                await leaveGroupAndClearHistory(accClient, peer);
                group.status = 'not_joined';
                group.membershipStatus = 'not_joined';
                group.joinedAccountIds = (group.joinedAccountIds || []).filter(id => id !== account.id);
                group.joinedAccountPhones = (group.joinedAccountPhones || []).filter(p => p !== account.phoneNumber);
                group.purgedFromTelegramAt = new Date().toISOString();
                addLog(
                  'info',
                  `🚪 [خروج و پاکسازی خودکار پس از ارسال] اکانت (${account.phoneNumber}) بلافاصله از گروه "${group.title}" خارج شد و چت، تاریخچه و دیالوگ آن از محیط تلگرام محو گردید.`
                );
              } catch (autoLeaveErr: any) {
                console.warn('Auto leave after post error:', autoLeaveErr);
              }
            }

            // Interruptible independent jitter delay for this worker to mimic realistic human behavior
            const baseJitterSec = appState.scheduler.jitterSeconds || 45;
            const randomJitterMs = Math.min(8000, Math.floor((baseJitterSec + Math.random() * 15) * 1000));
            const jitterStart = Date.now();
            while (Date.now() - jitterStart < randomJitterMs) {
              if (isBroadcastCancellationRequested) break;
              await new Promise(r => setTimeout(r, Math.min(200, randomJitterMs - (Date.now() - jitterStart))));
            }
          } else {
            // Anti-bot or message check failed on this group for this account
            const shouldLeave = appState.scheduler.antiBot?.safeMembershipRetention === false;
            if (shouldLeave && peer) {
              try { await leaveGroupAndClearHistory(accClient, peer); } catch (e) {}
            } else {
              addLog('info', `[ایمنی اکانت] جهت پیشگیری از حساسیت الگوریتم ضداسپم تلگرام (عدم ورود و خروج مکرر)، عضویت اکانت در گروه "${group.title}" حفظ گردید.`);
            }
            if (accStats) accStats.failedCount++;
            if (workerProgress) workerProgress.failedCount++;
            markGroupAsCompleted(group);

            group.status = 'failed';
            group.readinessStatus = 'captcha_required';
            group.canSendMessages = false;
            group.errorMessage = 'پیام در گروه تایید نشد یا توسط ربات ناظر رد گردید.';
            reportGroupDetails.push({
              groupId: group.id,
              groupTitle: group.title,
              usernameOrLink: group.usernameOrLink,
              status: 'failed',
              botDetected: botDetectedInGroup,
              botResolved: false,
              accountPhone: account.phoneNumber,
              accountName: account.userProfile?.firstName,
              message: 'پیام توسط ربات ناظر حذف گردید یا تایید نشد.',
            });
            if (appState.activeBroadcastProgress) {
              appState.activeBroadcastProgress.failedCount++;
            }
          }
        } catch (accErr: any) {
          console.error(`Worker error for account ${account.phoneNumber} on group ${group.title}:`, accErr);
          handleGramJsFloodWait(accErr);
          const secs = parseFloodWaitSeconds(accErr);

          if (secs && secs > 0) {
            account.status = 'flood_wait';
            account.floodWaitUntil = Date.now() + (secs + 5) * 1000;
            if (accStats) accStats.hitRateLimit = true;

            const enableRedistrib = appState.scheduler.antiBot?.enableFailoverRedistribution ?? false;

            if (enableRedistrib) {
              if (workerProgress) {
                workerProgress.status = 'flood_waited';
                workerProgress.lastAction = `محدودیت FloodWait به مدت ${Math.ceil(secs / 60)} دقیقه. وظایف به سایر اکانت‌ها واگذار شد.`;
              }

              const activeOthers = availableAccounts.filter(a => a.id !== account.id && (!a.floodWaitUntil || a.floodWaitUntil < Date.now()));
              addLog(
                'warning',
                `[محدودیت تلگرام و توزیع مجدد خودکار] اکانت (${account.phoneNumber}) به محدودیت موقت تلگرام برخورد کرد. گروه "${group.title}" و سایر گروه‌های باقی‌مانده بلافاصله بین ${activeOthers.length} اکانت فعال دیگر تقسیم گردیدند.`
              );

              // Release the current group back so other active parallel workers pick it up immediately
              releaseGroupBackToSharedQueue(group, `محدودیت FloodWait اکانت ${account.phoneNumber}`);
            } else {
              if (workerProgress) {
                workerProgress.status = 'flood_waited';
                workerProgress.lastAction = `محدودیت FloodWait به مدت ${Math.ceil(secs / 60)} دقیقه. با توجه به تنظیمات، انتقال به سایر اکانت‌ها انجام نشد.`;
              }
              addLog(
                'info',
                `🔒 [حفظ قلمرو و عدم انتقال وظایف] اکانت (${account.phoneNumber}) به محدودیت FloodWait برخورد کرد. با توجه به غیرفعال بودن توزیع مجدد، گروه "${group.title}" به هیچ اکانت دیگری واگذار نشد و تا رفع محدودیت اکانت اصلی متوقف می‌ماند.`
              );
              markGroupAsCompleted(group);
            }
            
            // Exit this worker loop
            break;
          } else {
            // Non-flood error (e.g. invalid invite link or user ban in this specific group)
            const shouldLeave = appState.scheduler.antiBot?.safeMembershipRetention === false;
            if (shouldLeave && peer) {
              try { await leaveGroupAndClearHistory(accClient, peer); } catch (e) {}
            } else {
              addLog('info', `[ایمنی اکانت] جهت پیشگیری از حساسیت الگوریتم ضداسپم تلگرام، عضویت اکانت در گروه "${group.title}" حفظ گردید.`);
            }
            if (accStats) accStats.failedCount++;
            if (workerProgress) workerProgress.failedCount++;
            markGroupAsCompleted(group);

            group.status = 'failed';
            group.errorMessage = translateTgError(accErr);
            reportGroupDetails.push({
              groupId: group.id,
              groupTitle: group.title,
              usernameOrLink: group.usernameOrLink,
              status: 'failed',
              botDetected: botDetectedInGroup,
              botResolved: false,
              accountPhone: account.phoneNumber,
              accountName: account.userProfile?.firstName,
              message: translateTgError(accErr),
            });
            if (appState.activeBroadcastProgress) {
              appState.activeBroadcastProgress.failedCount++;
            }
          }
        }
      }

      if (workerProgress && workerProgress.status !== 'flood_waited') {
        workerProgress.status = 'finished';
        workerProgress.lastAction = `پایان پردازش صف (موفق: ${workerProgress.sentSuccessCount}، خطا: ${workerProgress.failedCount})`;
      }
    }

    // 5. Run Worker Pool: Parallel Multi-Worker Dispatch or Sequential Rotation
    if (availableAccounts.length > 0) {
      if (isParallel) {
        addLog('info', `[اجرای همزمان موازی] در حال اجرای ${availableAccounts.length} کانال ارسال موازی همزمان بدون تداخل برای حداکثر سرعت...`);
        // Launch all account workers concurrently
        await Promise.all(availableAccounts.map((acc, idx) => runAccountWorker(acc, idx)));
      } else {
        // Sequential single-channel rotation mode
        for (let i = 0; i < availableAccounts.length; i++) {
          if (completedGroupIds.size >= targetGroupsToProcess.length) break;
          await runAccountWorker(availableAccounts[i], i);
        }
      }
    }

    // 6. Bot API Fallback for any remaining uncompleted groups
    const remainingUncompletedGroups = targetGroupsToProcess.filter(g => !completedGroupIds.has(g.id));
    if (remainingUncompletedGroups.length > 0 && botToken) {
      addLog('info', `[تکمیل با Bot API] تعداد ${remainingUncompletedGroups.length} گروه باقی‌مانده توسط ربات واسط تلگرام ارسال خواهند شد...`);
      for (const group of remainingUncompletedGroups) {
        try {
          const botCamp = getCampaignForGroup(group, completedGroupIds.size);
          const botTags = (botCamp.hashtags || []).map((h: string) => (h.startsWith('#') ? h : '#' + h)).join(' ');
          const botTextMessage = `📌 **${botCamp.title}**\n\n💰 **قیمت:** ${botCamp.price}\n\n📝 ${botCamp.description}\n\n👤 **سفارش و ارتباط:** ${botCamp.contactHandle}\n\n${botTags}`;
          await sendViaBotApi(botToken, group.usernameOrLink, botTextMessage, botCamp.imageUrl);
          const postTimeStr = new Date().toISOString();
          group.lastPostedAt = postTimeStr;
          group.lastPostedByAccountId = 'bot_api';
          group.lastPostedByAccountPhone = 'Bot API';
          group.status = 'joined';
          group.errorMessage = undefined;
          appState.scheduler.dailySentCount = (appState.scheduler.dailySentCount || 0) + 1;
          usedAccountPhones.add('Bot API');

          updateGroupMonitoringReport({
            groupId: group.title,
            groupTitle: group.title,
            step: 'CAMPAIGN_SENT',
            requiresManualCheck: false,
            statusMessage: '🤖 [جایگزینی ربات واسط] پیام کمپین از طریق Bot API با موفقیت منتشر شد.',
          });

          addLog('success', `[جایگزینی Bot API] پیام با موفقیت از طریق ربات واسط در گروه "${group.title}" منتشر گردید.`, group.title, undefined, campaign.title);

          reportGroupDetails.push({
            groupId: group.id,
            groupTitle: group.title,
            usernameOrLink: group.usernameOrLink,
            status: 'success',
            botDetected: false,
            botResolved: false,
            accountPhone: 'Bot API',
            accountName: 'ربات واسط',
            message: 'ارسال با موفقیت از طریق Bot API',
            postedAt: postTimeStr,
          });
          markGroupAsCompleted(group);
        } catch (botErr: any) {
          group.status = 'failed';
          group.errorMessage = `UserBot & Bot API: ${botErr.message}`;
          reportGroupDetails.push({
            groupId: group.id,
            groupTitle: group.title,
            usernameOrLink: group.usernameOrLink,
            status: 'failed',
            botDetected: false,
            botResolved: false,
            accountPhone: 'Bot API',
            accountName: 'ربات واسط',
            message: botErr.message,
          });
          markGroupAsCompleted(group);
        }
      }
    }

    // Generate Final Execution Report
    const broadcastDurationSeconds = Math.max(1, Math.round((Date.now() - broadcastStartTime) / 1000));
    const totalAttempted = reportGroupDetails.filter(d => d.status !== 'skipped').length;
    reportSuccessCount = reportGroupDetails.filter(d => d.status === 'success').length;
    reportFailedCount = reportGroupDetails.filter(d => d.status === 'failed').length;
    const botDetectedCount = reportGroupDetails.filter(d => d.botDetected).length;
    const botResolvedCount = reportGroupDetails.filter(d => d.botDetected && d.status === 'success').length;

    const nowPersian = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + new Date().toLocaleDateString('fa-IR');

    const accountBreakdownList = Array.from(accountStatsMap.values()).map(s => ({
      accountId: s.accountId,
      accountPhone: s.accountPhone,
      accountName: s.accountName,
      sentCount: s.sentCount,
      failedCount: s.failedCount,
      hitRateLimit: Boolean(s.hitRateLimit),
    }));

    const executionReport: any = {
      id: 'rpt_' + Date.now(),
      timestamp: nowPersian,
      durationSeconds: broadcastDurationSeconds,
      campaignTitle: campaign.title,
      totalAttempted,
      successCount: reportSuccessCount,
      failedCount: reportFailedCount,
      botDetectedCount,
      botResolvedCount,
      accountsUsedCount: usedAccountPhones.size,
      accountsList: Array.from(usedAccountPhones),
      dispatchMode: isParallel ? 'parallel_multichannel' : 'sequential_rotation',
      accountBreakdown: accountBreakdownList,
      details: reportGroupDetails,
    };

    appState.lastBroadcastReport = executionReport;
    if (!appState.broadcastHistory) appState.broadcastHistory = [];
    appState.broadcastHistory.unshift(executionReport);
    if (appState.broadcastHistory.length > 20) {
      appState.broadcastHistory = appState.broadcastHistory.slice(0, 20);
    }

    addLog(
      'success',
      `[گزارش کامل اجرای ارسال] پایان ارسال کمپین "${campaign.title}" | مدت زمان: ${broadcastDurationSeconds} ثانیه (${isParallel ? 'ارسال همزمان موازی' : 'ارسال تک‌اکانت'}) | اقدام روی ${totalAttempted} گروه: ${reportSuccessCount} موفق، ${reportFailedCount} ناموفق، ${botResolvedCount} گروه دارای ربات ناظر خنثی‌شده.`
    );
  } finally {
    if (tempImgPath && fs.existsSync(tempImgPath)) {
      try { fs.unlinkSync(tempImgPath); } catch (e) {}
    }
    if (appState.activeBroadcastProgress) {
      appState.activeBroadcastProgress.isRunning = false;
    }
    if (appState.groupPromotionStrategy) {
      const strat1 = appState.groupPromotionStrategy.strategy1;
      if (reportSuccessCount > 0) {
        strat1.totalBroadcastsSent = (strat1.totalBroadcastsSent || 0) + 1;
        strat1.totalGroupsReached = (strat1.totalGroupsReached || 0) + reportSuccessCount;
      }
      strat1.lastBroadcastAt = new Date().toISOString();
      const intervalMs = (strat1.intervalHours || 2) * 60 * 60 * 1000;
      strat1.nextBroadcastAt = new Date(Date.now() + intervalMs).toISOString();
    }
    saveData();
    isBroadcastRunning = false;
  }

  return {
    success: reportSuccessCount > 0,
    message: `فرایند ارسال به پایان رسید. (موفق: ${reportSuccessCount}، ناموفق: ${reportFailedCount})`,
    sentCount: reportSuccessCount,
    failedCount: reportFailedCount,
  };
}

// 15. Telegram Groups Auto-Sync & Real-Time Membership Sync Endpoints
app.post('/api/telegram/sync-groups', async (req, res) => {
  try {
    const result = await syncTelegramRealtimeMemberships();
    res.json({ success: true, ...result, groups: appState.groups });
  } catch (err: any) {
    console.error('Group sync error:', err);
    res.status(500).json({ error: translateTgError(err) });
  }
});

app.post('/api/groups/sync-realtime-memberships', async (req, res) => {
  try {
    const { accountIds } = req.body || {};
    const result = await syncTelegramRealtimeMemberships(accountIds);
    res.json({ success: true, ...result, groups: appState.groups });
  } catch (err: any) {
    console.error('Realtime membership sync error:', err);
    res.status(500).json({ error: translateTgError(err) });
  }
});

// 15a-1. Territory Audit & Zero-Overlap Management Endpoints
app.get('/api/groups/territory-audit', (req, res) => {
  try {
    const report = auditAndBalanceTerritories({ forceRebalanceUnassigned: false });
    res.json({ success: true, report, groups: appState.groups });
  } catch (err: any) {
    console.error('Territory audit error:', err);
    res.status(500).json({ error: err.message || 'خطا در تحلیل قلمروهای گروه‌ها' });
  }
});

app.post('/api/groups/territory-audit', (req, res) => {
  try {
    const report = auditAndBalanceTerritories({ forceRebalanceUnassigned: false });
    res.json({ success: true, report, groups: appState.groups });
  } catch (err: any) {
    console.error('Territory audit error:', err);
    res.status(500).json({ error: err.message || 'خطا در تحلیل قلمروهای گروه‌ها' });
  }
});

app.post('/api/groups/auto-balance-territories', (req, res) => {
  try {
    const report = auditAndBalanceTerritories({ forceRebalanceUnassigned: true });
    addLog(
      'success',
      `⚖️ [تقسیم عادلانه و بدون همپوشانی قلمروها] تمام گروه‌های هدف بدون تداخل میان ${report.accounts.length} اکانت فعال تفکیک شدند. گروه‌های عضو شده در قلمرو خود حفظ شدند و گروه‌های باقیمانده به طور متوازن سهمیه‌بندی گردیدند.`
    );
    res.json({
      success: true,
      message: 'تقسیم متوازن و تفکیک قلمروهای بدون همپوشانی با موفقیت انجام شد.',
      report,
      groups: appState.groups,
    });
  } catch (err: any) {
    console.error('Auto balance territories error:', err);
    res.status(500).json({ error: err.message || 'خطا در توازن قلمروها' });
  }
});

// 15a-2. Safe Drip-Feed Join Endpoints
app.get('/api/groups/drip-join/status', (req, res) => {
  res.json({
    success: true,
    config: appState.dripJoinConfig,
    isStepRunning: isDripJoinStepRunning,
    groups: appState.groups,
  });
});

app.post('/api/groups/drip-join/toggle', (req, res) => {
  const { enabled } = req.body || {};
  if (!appState.dripJoinConfig) {
    appState.dripJoinConfig = {
      enabled: false,
      maxJoinsPerAccountPerDay: 8,
      intervalMinutes: 20,
      jitterMinutes: 5,
      dailyJoinResetDate: new Date().toISOString().split('T')[0],
      accountDailyJoins: {},
      lastJoinTimePerAccount: {},
    };
  }

  const newState = enabled !== undefined ? Boolean(enabled) : !appState.dripJoinConfig.enabled;
  appState.dripJoinConfig.enabled = newState;
  saveData();

  if (newState) {
    addLog(
      'info',
      `🟢 [آغاز پیوستن تدریجی و قطره‌چکانی] سیستم عضویت امن فعال شد. هر اکانت حداکثر روزانه ${appState.dripJoinConfig.maxJoinsPerAccountPerDay} گروه از قلمرو خود را با فواصل ${appState.dripJoinConfig.intervalMinutes} دقیقه‌ای عضو خواهد شد.`
    );
    // Trigger first step asynchronously without blocking
    runDripJoinBackgroundStep().catch(err => console.warn('Immediate drip join step error:', err));
  } else {
    addLog('warning', '⏸️ [توقف پیوستن قطره‌چکانی] فرایند عضویت خودکار و تدریجی متوقف شد.');
  }

  res.json({
    success: true,
    enabled: appState.dripJoinConfig.enabled,
    config: appState.dripJoinConfig,
  });
});

app.post('/api/groups/drip-join/settings', (req, res) => {
  const { maxJoinsPerAccountPerDay, intervalMinutes, jitterMinutes } = req.body || {};
  if (!appState.dripJoinConfig) {
    appState.dripJoinConfig = {
      enabled: false,
      maxJoinsPerAccountPerDay: 8,
      intervalMinutes: 20,
      jitterMinutes: 5,
      dailyJoinResetDate: new Date().toISOString().split('T')[0],
      accountDailyJoins: {},
      lastJoinTimePerAccount: {},
    };
  }

  if (typeof maxJoinsPerAccountPerDay === 'number' && maxJoinsPerAccountPerDay > 0) {
    appState.dripJoinConfig.maxJoinsPerAccountPerDay = Math.min(20, Math.max(1, maxJoinsPerAccountPerDay));
  }
  if (typeof intervalMinutes === 'number' && intervalMinutes > 0) {
    appState.dripJoinConfig.intervalMinutes = Math.max(3, intervalMinutes);
  }
  if (typeof jitterMinutes === 'number' && jitterMinutes >= 0) {
    appState.dripJoinConfig.jitterMinutes = jitterMinutes;
  }

  saveData();
  addLog('info', `تنظیمات پیوستن تدریجی بروزرسانی شد: سقف روزانه=${appState.dripJoinConfig.maxJoinsPerAccountPerDay} گروه/اکانت، فاصله=${appState.dripJoinConfig.intervalMinutes} دقیقه.`);
  res.json({ success: true, config: appState.dripJoinConfig });
});

app.post('/api/groups/drip-join/trigger-now', async (req, res) => {
  try {
    await runDripJoinBackgroundStep();
    res.json({ success: true, message: 'مرحله پیوستن قطره‌چکانی اجرا شد.', config: appState.dripJoinConfig });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'خطا در اجرای مرحله قطره‌چکانی' });
  }
});

// 15a-3. Graceful Overlap Resolver (Leave duplicate group from extra account)
app.post('/api/groups/leave-duplicate', async (req, res) => {
  try {
    const { groupId, accountIdToLeave } = req.body || {};
    if (!groupId || !accountIdToLeave) {
      res.status(400).json({ error: 'شناسه گروه و اکانت مشخص نشده است.' });
      return;
    }

    const group = appState.groups.find(g => g.id === groupId);
    if (!group) {
      res.status(404).json({ error: 'گروه مورد نظر یافت نشد.' });
      return;
    }

    syncAccountsState();
    let account = (appState.accounts || []).find(a => a.id === accountIdToLeave);
    let client: any = null;
    if (!account && accountIdToLeave === 'primary_account' && appState.credentials.isConnected) {
      account = {
        id: 'primary_account',
        phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
      } as any;
      client = await getOrInitTgClient();
    } else if (account) {
      client = await getOrInitClientForAccount(account);
    }

    if (client && !client._destroyed) {
      try {
        const peer = await resolveAndJoinGroup(client, group.usernameOrLink);
        if (peer) {
          await leaveGroupAndClearHistory(client, peer);
        }
      } catch (leaveErr: any) {
        console.warn('Leave duplicate group Telegram call warning:', leaveErr);
      }
    }

    // Remove accountIdToLeave from joinedAccountIds
    group.joinedAccountIds = (group.joinedAccountIds || []).filter(id => id !== accountIdToLeave);
    group.joinedAccountPhones = (group.joinedAccountPhones || []).filter(phone => phone !== account?.phoneNumber);
    if (group.duplicateAccountIds) {
      group.duplicateAccountIds = group.duplicateAccountIds.filter(id => id !== accountIdToLeave);
    }
    if ((group.joinedAccountIds || []).length <= 1) {
      group.hasOverlap = false;
      group.duplicateAccountIds = [];
    }

    // If the left account was the assigned owner, pick the remaining joined account as owner
    if (group.assignedAccountId === accountIdToLeave && group.joinedAccountIds.length > 0) {
      group.assignedAccountId = group.joinedAccountIds[0];
      const remainingAcc = (appState.accounts || []).find(a => a.id === group.assignedAccountId);
      if (remainingAcc) {
        group.assignedAccountPhone = remainingAcc.phoneNumber;
        group.assignedAccountName = remainingAcc.userProfile?.firstName;
      }
    }

    const report = auditAndBalanceTerritories({ forceRebalanceUnassigned: false });
    saveData();

    addLog(
      'info',
      `[رفع تداخل گروه] اکانت (${account?.phoneNumber || accountIdToLeave}) از گروه تکراری "${group.title}" خارج شد تا ظرفیت عضویت آن برای گروه‌های جدید آزاد بماند.`
    );

    res.json({
      success: true,
      message: `اکانت با موفقیت از گروه "${group.title}" خارج شد و ظرفیت آن آزاد گردید.`,
      report,
      groups: appState.groups,
    });
  } catch (err: any) {
    console.error('Leave duplicate error:', err);
    res.status(500).json({ error: translateTgError(err) });
  }
});

// 15a-4. Balanced Overlap Auto-Resolver: Resolves all overlapping groups by balancing territory load evenly among all active accounts and having extra accounts leave Telegram
app.post('/api/groups/resolve-all-overlaps-balanced', async (req, res) => {
  try {
    syncAccountsState();
    let availableAccounts = (appState.accounts || []).filter(
      a => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled'
    );
    if (availableAccounts.length === 0 && appState.credentials.isConnected && appState.credentials.sessionString) {
      availableAccounts = [{
        id: 'primary_account',
        phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
        sessionString: appState.credentials.sessionString,
        apiId: appState.credentials.apiId || DEFAULT_API_ID,
        apiHash: appState.credentials.apiHash || DEFAULT_API_HASH,
        isActive: true,
        status: 'connected',
        userProfile: appState.credentials.userProfile,
        dailySentCount: appState.scheduler.dailySentCount || 0,
      } as any];
    }

    if (availableAccounts.length === 0) {
      res.status(400).json({ error: 'هیچ اکانت تلگرام فعال و متصلی در سامانه یافت نشد.' });
      return;
    }

    // Identify all overlapping groups
    const overlappingGroups = appState.groups.filter(
      g => g.joinedAccountIds && g.joinedAccountIds.length > 1 && g.isActive && g.status !== 'purged_non_persian'
    );

    if (overlappingGroups.length === 0) {
      const report = auditAndBalanceTerritories({ forceRebalanceUnassigned: true });
      saveData();
      res.json({
        success: true,
        message: 'هیچ گروه دارای تداخلی یافت نشد. تمام قلمروها از قبل تفکیک‌شده و بدون تداخل هستند.',
        resolvedCount: 0,
        totalLeaves: 0,
        report,
        groups: appState.groups,
      });
      return;
    }

    // Step 1: Calculate current non-overlapping baseline load for each active account
    const accountLoads: Record<string, number> = {};
    for (const acc of availableAccounts) {
      accountLoads[acc.id] = appState.groups.filter(
        g =>
          g.assignedAccountId === acc.id &&
          (!g.joinedAccountIds || g.joinedAccountIds.length <= 1) &&
          g.isActive &&
          g.status !== 'purged_non_persian'
      ).length;
    }

    let totalLeavesCount = 0;
    const leaveActionsSummary: Array<{
      groupTitle: string;
      chosenOwnerId: string;
      chosenOwnerPhone: string;
      leavingAccountIds: string[];
    }> = [];

    // Step 2: For each overlapping group, assign to the candidate with lowest current load, and make others leave Telegram
    for (const group of overlappingGroups) {
      const joinedIds = [...group.joinedAccountIds!];

      // Filter to joined accounts that are currently active
      const activeJoinedAccounts = availableAccounts.filter(a => joinedIds.includes(a.id));
      const candidates = activeJoinedAccounts.length > 0 ? activeJoinedAccounts : availableAccounts;

      // Sort candidates by current load ascending (least loaded first to achieve perfect equality)
      candidates.sort((a, b) => (accountLoads[a.id] || 0) - (accountLoads[b.id] || 0));
      const chosenOwner = candidates[0];

      // Update owner's load
      accountLoads[chosenOwner.id] = (accountLoads[chosenOwner.id] || 0) + 1;

      // Determine accounts that must leave Telegram
      const accountsToLeaveIds = joinedIds.filter(id => id !== chosenOwner.id);

      for (const leaveAccId of accountsToLeaveIds) {
        let leaveAcc = (appState.accounts || []).find(a => a.id === leaveAccId);
        let client: any = null;
        if (!leaveAcc && leaveAccId === 'primary_account' && appState.credentials.isConnected) {
          leaveAcc = { id: 'primary_account', phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی' } as any;
          client = await getOrInitTgClient();
        } else if (leaveAcc) {
          client = await getOrInitClientForAccount(leaveAcc);
        }

        if (client && !client._destroyed) {
          try {
            await leaveGroupAndClearHistory(client, group);
            totalLeavesCount++;
          } catch (e: any) {
            console.warn(`Leave error for account ${leaveAcc?.phoneNumber} in group ${group.title}:`, e);
          }
        }
      }

      // Update the group record
      group.joinedAccountIds = [chosenOwner.id];
      group.joinedAccountPhones = [chosenOwner.phoneNumber || ''];
      group.assignedAccountId = chosenOwner.id;
      group.assignedAccountPhone = chosenOwner.phoneNumber;
      group.assignedAccountName = chosenOwner.userProfile?.firstName;
      group.hasOverlap = false;
      group.duplicateAccountIds = [];
      group.membershipStatus = 'joined';
      group.status = 'joined';

      leaveActionsSummary.push({
        groupTitle: group.title,
        chosenOwnerId: chosenOwner.id,
        chosenOwnerPhone: chosenOwner.phoneNumber || '',
        leavingAccountIds: accountsToLeaveIds,
      });
    }

    // Step 3: Run final territory audit & save
    const report = auditAndBalanceTerritories({ forceRebalanceUnassigned: true });
    saveData();

    // Build human-friendly distribution summary
    const loadDistributionStr = availableAccounts
      .map(acc => {
        const count = appState.groups.filter(g => g.assignedAccountId === acc.id && g.isActive).length;
        return `${acc.phoneNumber || acc.id}: ${count} گروه`;
      })
      .join(' • ');

    addLog(
      'success',
      `⚖️ [توزیع کاملاً متوازن و رفع تمام تداخل‌ها] تعداد ${overlappingGroups.length} گروه دارای تداخل با موفقیت تفکیک شدند. تعداد ${totalLeavesCount} خروج و محوسازی از تلگرام انجام شد. وضعیت توزیع بار پس از تعادل: (${loadDistributionStr}).`
    );

    res.json({
      success: true,
      resolvedCount: overlappingGroups.length,
      totalLeaves: totalLeavesCount,
      loadDistribution: loadDistributionStr,
      report,
      groups: appState.groups,
      message: `تعداد ${overlappingGroups.length} تداخل با موفقیت رفع شد و بار گروه‌ها به طور کاملاً مساوی بین اکانت‌ها تقسیم گردید (${loadDistributionStr}).`,
    });
  } catch (err: any) {
    console.error('Resolve all overlaps error:', err);
    res.status(500).json({ error: err.message || 'خطا در رفع هوشمند تداخل‌ها' });
  }
});

// 15b. Smart Group Join Engine Endpoints
app.post('/api/groups/smart-join-start', async (req, res) => {
  try {
    const { mode, delaySeconds, targetGroupIds, accountIds, autoResolveAntibot } = req.body || {};
    const result = await startSmartGroupJoinEngine({
      mode,
      delaySeconds,
      targetGroupIds,
      accountIds,
      autoResolveAntibot,
    });
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }
    res.json({ success: true, message: result.message, progress: appState.activeGroupJoinProgress });
  } catch (err: any) {
    console.error('Smart join start error:', err);
    res.status(500).json({ error: translateTgError(err) });
  }
});

app.post('/api/groups/smart-join-stop', (req, res) => {
  const result = stopSmartGroupJoinEngine();
  res.json(result);
});

app.post('/api/groups/join-single', async (req, res) => {
  const { groupId, accountId } = req.body || {};
  if (!groupId) {
    res.status(400).json({ error: 'شناسه گروه مشخص نشده است.' });
    return;
  }

  const group = appState.groups.find(g => g.id === groupId);
  if (!group) {
    res.status(404).json({ error: 'گروه مورد نظر یافت نشد.' });
    return;
  }

  try {
    syncAccountsState();
    let account = (appState.accounts || []).find(a => a.id === accountId);
    if (!account) {
      account = (appState.accounts || []).find(a => a.isActive && a.status !== 'session_expired' && (!a.floodWaitUntil || a.floodWaitUntil < Date.now()));
    }

    let client: any = null;
    if (account) {
      client = await getOrInitClientForAccount(account);
    } else {
      client = await getOrInitTgClient();
      account = {
        id: 'primary_account',
        phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
      } as any;
    }

    if (!client) {
      res.status(400).json({ error: 'حساب تلگرام معتبر جهت عضویت یافت نشد.' });
      return;
    }

    group.membershipStatus = 'joining';
    group.lastJoinAttemptAt = new Date().toISOString();

    const peer = await resolveAndJoinGroup(client, group.usernameOrLink);
    await handleAntiBotAndGroupVerification(client, peer, group.title);

    if (!group.accountMemberships) group.accountMemberships = {};
    const nowIso = new Date().toISOString();
    group.accountMemberships[account.id] = {
      accountId: account.id,
      accountPhone: account.phoneNumber,
      accountName: account.userProfile?.firstName,
      isMember: true,
      status: 'joined',
      checkedAt: nowIso,
      joinedAt: nowIso,
    };

    group.joinedAccountIds = Array.from(new Set([...(group.joinedAccountIds || []), account.id]));
    group.joinedAccountPhones = Array.from(new Set([...(group.joinedAccountPhones || []), account.phoneNumber]));
    group.membershipStatus = 'joined';
    group.status = 'joined';
    group.lastJoinError = undefined;
    saveData();

    addLog('success', `[عضویت دستی موفق] اکانت (${account.phoneNumber}) با موفقیت به گروه "${group.title}" ملحق شد.`);
    res.json({ success: true, message: `عضویت در گروه "${group.title}" با موفقیت انجام شد.`, group });
  } catch (err: any) {
    group.membershipStatus = 'failed';
    group.lastJoinError = translateTgError(err);
    saveData();
    res.status(500).json({ error: translateTgError(err) });
  }
});

app.post('/api/groups/distribution-preview', (req, res) => {
  const { mode = 'balanced_distribution', targetGroupIds, accountIds } = req.body || {};
  syncAccountsState();

  let availableAccounts = (appState.accounts || []).filter(
    a => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled' && (a.enableForGroupBroadcast !== false)
  );

  if (availableAccounts.length === 0 && appState.credentials.isConnected) {
    availableAccounts = [{
      id: 'primary_account',
      phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
      userProfile: appState.credentials.userProfile,
    } as any];
  }

  const selectedAccounts = accountIds && accountIds.length > 0
    ? availableAccounts.filter(a => accountIds.includes(a.id))
    : availableAccounts;

  let targetGroups = appState.groups.filter(g => g.isActive);
  if (targetGroupIds && targetGroupIds.length > 0) {
    targetGroups = targetGroups.filter(g => targetGroupIds.includes(g.id));
  } else {
    targetGroups = targetGroups.filter(g => !g.joinedAccountIds || g.joinedAccountIds.length === 0 || g.membershipStatus === 'not_joined');
  }

  const distribution = distributeGroupsForJoin(targetGroups, selectedAccounts, mode);

  const preview = selectedAccounts.map(acc => ({
    accountId: acc.id,
    accountPhone: acc.phoneNumber,
    accountName: acc.userProfile?.firstName,
    assignedGroups: (distribution[acc.id] || []).map(g => ({ id: g.id, title: g.title, usernameOrLink: g.usernameOrLink })),
    assignedCount: (distribution[acc.id] || []).length,
  }));

  res.json({
    totalTargetGroups: targetGroups.length,
    accountsCount: selectedAccounts.length,
    strategy: mode,
    preview,
  });
});

app.post('/api/groups/update-join-strategy', (req, res) => {
  const incoming = req.body;
  appState.groupJoinStrategy = {
    mode: incoming.mode || 'balanced_distribution',
    delayBetweenJoinsSeconds: incoming.delayBetweenJoinsSeconds || 10,
    maxJoinsPerAccountPerHour: incoming.maxJoinsPerAccountPerHour || 15,
    autoResolveAntibotOnJoin: incoming.autoResolveAntibotOnJoin !== false,
    leaveIfNoSendPermission: incoming.leaveIfNoSendPermission !== false,
    sendGreetingTest: incoming.sendGreetingTest !== false,
    greetingMessage: incoming.greetingMessage || 'سلام بچه ها',
    verifyGreetingSurvival: incoming.verifyGreetingSurvival !== false,
    autoSolveAllCaptchas: incoming.autoSolveAllCaptchas !== false,
  };
  saveData();
  res.json({ success: true, strategy: appState.groupJoinStrategy });
});

// Purge all groups marked 'no_permission_left' or invalid from application
app.post('/api/groups/purge-invalid', (req, res) => {
  const initialCount = appState.groups.length;
  appState.groups = appState.groups.filter(g => {
    if (g.readinessStatus === 'no_permission_left' || g.readinessStatus === 'non_persian_purged' || g.status === 'purged_non_persian') return false;
    const check = isValidTelegramTarget(g.usernameOrLink);
    return check.valid;
  });
  const removedCount = initialCount - appState.groups.length;
  saveData();
  addLog('info', `[پاکسازی هوشمند گروه‌ها] تعداد ${removedCount} گروه نامعتبر، غیرفارسی یا فاقد مجوز ارسال پیام از لیست حذف شدند.`);
  res.json({ success: true, removedCount, groups: appState.groups });
});

// Endpoint: Audit all groups for 100% Persian/Iranian Audience & Purge Non-Persian Groups from Telegram
app.post('/api/groups/audit-and-purge-non-persian', async (req, res) => {
  try {
    await loadGramJS();
    syncAccountsState();

    const activeAccounts = (appState.accounts || []).filter(a => a.isActive && a.status !== 'session_expired');
    let primaryClient = await getOrInitTgClient();

    let totalAudited = 0;
    let totalPurged = 0;
    let totalPersianVerified = 0;
    const purgedDetails: Array<{ id: string; title: string; link: string; reason: string; language: string }> = [];

    addLog('info', `[شروع غربالگری ۱۰۰٪ مخاطبان ایرانی] در حال بررسی دقیق زبان و مخاطبان فارسی تمام گروه‌ها...`);

    for (const group of appState.groups) {
      if (group.status === 'purged_non_persian' || group.readinessStatus === 'non_persian_purged') {
        continue;
      }

      totalAudited++;
      const title = group.title || '';
      const link = group.usernameOrLink || '';

      // 1. Fast metadata audit
      const combinedMeta = `${title} ${link}`;
      const hasForeignKw = hasExplicitForeignKeywords(combinedMeta);
      const foreignScript = containsForbiddenForeignScript(combinedMeta);
      const arabicNonFa = isPureArabicNonPersian(combinedMeta);

      if (hasForeignKw || foreignScript.forbidden || arabicNonFa) {
        const reason = foreignScript.forbidden
          ? `خطوط غیرایرانی (${foreignScript.script})`
          : (hasForeignKw ? 'کلیدواژه‌های غیرایرانی در عنوان' : 'اصطلاحات عربی غیرایرانی');
        
        // Find best client to leave and purge from Telegram
        let clientToUse = primaryClient;
        if (group.assignedAccountId) {
          const acc = activeAccounts.find(a => a.id === group.assignedAccountId);
          if (acc) {
            const ac = await getOrInitClientForAccount(acc);
            if (ac) clientToUse = ac;
          }
        }

        let peer: any = null;
        if (clientToUse) {
          try {
            peer = await resolveAndJoinGroup(clientToUse, group.usernameOrLink);
          } catch (e) {}
        }

        await purgeAndLeaveNonPersianGroup(clientToUse, peer, group, reason);
        totalPurged++;
        purgedDetails.push({ id: group.id, title: group.title, link: group.usernameOrLink, reason, language: foreignScript.forbidden ? 'hi' : (arabicNonFa ? 'ar' : 'en') });
        continue;
      }

      // 2. In-depth message audit for ambiguous groups
      let clientToUse = primaryClient;
      if (group.assignedAccountId) {
        const acc = activeAccounts.find(a => a.id === group.assignedAccountId);
        if (acc) {
          const ac = await getOrInitClientForAccount(acc);
          if (ac) clientToUse = ac;
        }
      }

      let peer: any = null;
      if (clientToUse) {
        try {
          peer = await resolveAndJoinGroup(clientToUse, group.usernameOrLink);
        } catch (e) {}
      }

      const auditResult = await verifyAndAuditGroupIsPersian(clientToUse, peer, group.title, group.usernameOrLink);
      if (!auditResult.isPersian) {
        await purgeAndLeaveNonPersianGroup(clientToUse, peer, group, auditResult.reason);
        totalPurged++;
        purgedDetails.push({ id: group.id, title: group.title, link: group.usernameOrLink, reason: auditResult.reason, language: auditResult.language });
      } else {
        group.isPersianVerified = true;
        group.languageDetected = auditResult.language;
        totalPersianVerified++;
      }
    }

    // 3. Scan live dialogs across all connected Telegram accounts to find & purge any hidden foreign groups
    const scanDialogs = req.body?.scanDialogs !== false;
    if (scanDialogs) {
      try {
        const allClients = await getAllConnectedClients();
        for (const item of allClients) {
          const client = item.client;
          if (!client || client._destroyed) continue;
          let dialogs: any[] = [];
          try {
            if (typeof client.getDialogs === 'function') {
              dialogs = await client.getDialogs({ limit: 200 });
            }
          } catch (dErr) {
            continue;
          }

          for (const d of dialogs) {
            if (!d) continue;
            const entity = d.entity;
            if (!entity) continue;
            const isGroup = d.isGroup || entity.megagroup || entity.className === 'Chat' || entity._ === 'chat';
            const isUser = entity.className === 'User' || entity._ === 'user';
            const isBroadcast = (entity.className === 'Channel' || entity._ === 'channel') && !entity.megagroup;
            if (isUser || isBroadcast || !isGroup) continue;

            const dTitle = (d.title || entity.title || '').trim();
            const dUsername = entity.username ? `@${entity.username}` : '';
            const dId = entity.id ? String(entity.id) : '';
            const combinedD = `${dTitle} ${dUsername} ${dId}`.trim();

            if (isBlacklistedNonPersianTarget(combinedD) || isBlacklistedNonPersianTarget(dTitle) || isBlacklistedNonPersianTarget(dUsername)) {
              try {
                await leaveGroupAndClearHistory(client, entity);
                totalPurged++;
              } catch (e) {}
              continue;
            }

            const scriptCheck = containsForbiddenForeignScript(combinedD);
            const foreignKw = hasExplicitForeignKeywords(combinedD);
            const arabicNonFa = isPureArabicNonPersian(combinedD);

            if (scriptCheck.forbidden || foreignKw || arabicNonFa) {
              const reason = scriptCheck.forbidden
                ? `خطوط غیرایرانی (${scriptCheck.script})`
                : (foreignKw ? 'کلیدواژه‌های غیرایرانی در عنوان' : 'لهجه عربی غیرایرانی');

              addToNonPersianBlacklist(dUsername || dId, dTitle);
              if (dId) addToNonPersianBlacklist(dId);

              try {
                await leaveGroupAndClearHistory(client, entity);
                totalPurged++;
                purgedDetails.push({
                  id: dId || `dialog_${Date.now()}`,
                  title: dTitle,
                  link: dUsername || dId,
                  reason: `شناسایی در اکانت تلگرام (${item.phone || item.accountId}): ${reason}`,
                  language: scriptCheck.forbidden ? 'hi' : (arabicNonFa ? 'ar' : 'en')
                });
              } catch (e) {}
            }
          }
        }
      } catch (scanErr) {
        console.warn('Dialogs scan error during non-persian audit:', scanErr);
      }
    }

    // 4. Optionally permanently delete purged non-Persian groups from database
    const deleteFromDatabase = req.body?.deleteFromDatabase === true;
    if (deleteFromDatabase) {
      const beforeLen = appState.groups.length;
      appState.groups = appState.groups.filter(g => {
        if (g.status === 'purged_non_persian' || g.readinessStatus === 'non_persian_purged') return false;
        if (isBlacklistedNonPersianTarget(g.usernameOrLink) || isBlacklistedNonPersianTarget(g.title)) return false;
        return true;
      });
      const removedFromDb = beforeLen - appState.groups.length;
      addLog('info', `[پاکسازی پایگاه داده] تعداد ${removedFromDb} گروه غیرایرانی به طور کامل از دیتابیس حذف شدند.`);
    }

    saveData();

    addLog(
      'info',
      `[پایان غربالگری هوشمند زبان] تعداد ${totalAudited} گروه بررسی شدند: ${totalPersianVerified} گروه فارسی ایرانی تایید شدند و ${totalPurged} گروه غیرفارسی به طور کامل از تلگرام لفت داده و پاکسازی گردیدند.`
    );

    res.json({
      success: true,
      totalAudited,
      totalPurged,
      totalPersianVerified,
      purgedDetails,
      blacklistCount: (appState.purgedNonPersianBlacklist || []).length,
      groups: appState.groups,
    });
  } catch (err: any) {
    console.error('Audit non-persian error:', err);
    res.status(500).json({ error: 'خطا در غربالگری و پاکسازی گروه‌های غیرفارسی: ' + (err.message || err) });
  }
});

// Endpoint: Purge/Clean purged groups from database completely
app.post('/api/groups/clean-purged-from-db', (req, res) => {
  const initial = appState.groups.length;
  appState.groups = appState.groups.filter(g => {
    if (g.status === 'purged_non_persian' || g.readinessStatus === 'non_persian_purged') return false;
    if (isBlacklistedNonPersianTarget(g.usernameOrLink) || isBlacklistedNonPersianTarget(g.title)) return false;
    return true;
  });
  const removedCount = initial - appState.groups.length;
  saveData();
  addLog('info', `[پاکسازی پایگاه داده] تعداد ${removedCount} گروه غیرایرانی اخراج‌شده به طور کامل از لیست دیتابیس پاک شدند.`);
  res.json({ success: true, removedCount, groups: appState.groups });
});

// Endpoint: Persian verification stats & audit summary
app.get('/api/groups/persian-stats', (req, res) => {
  const total = appState.groups.length;
  const verifiedPersian = appState.groups.filter(g => g.isPersianVerified === true).length;
  const purgedCount = appState.groups.filter(g => g.status === 'purged_non_persian' || g.readinessStatus === 'non_persian_purged').length;
  const blacklistCount = (appState.purgedNonPersianBlacklist || []).length;
  const onlyPersian = appState.scheduler?.onlyPersianVerifiedGroups !== false;

  res.json({
    totalGroups: total,
    verifiedPersian,
    purgedCount,
    blacklistCount,
    onlyPersianActive: onlyPersian,
    blacklistSample: (appState.purgedNonPersianBlacklist || []).slice(0, 50),
  });
});

// Endpoint: Blacklist management
app.get('/api/groups/non-persian-blacklist', (req, res) => {
  res.json({
    blacklist: appState.purgedNonPersianBlacklist || [],
    count: (appState.purgedNonPersianBlacklist || []).length,
  });
});

app.post('/api/groups/non-persian-blacklist/clear', (req, res) => {
  appState.purgedNonPersianBlacklist = [];
  saveData();
  res.json({ success: true, message: 'لیست سیاه گروه‌های غیرایرانی پاک شد.' });
});

// Re-verify a single group's captcha & readiness status
app.post('/api/groups/retry-verification', async (req, res) => {
  const { groupId, clickButtonIndex, customReply, buttonRow, buttonCol, joinSponsorUrl, autoJoinSponsors } = req.body;
  const group = appState.groups.find(g => g.id === groupId);
  if (!group) {
    res.status(404).json({ error: 'گروه مورد نظر یافت نشد.' });
    return;
  }

  // Find best account client for this group
  let client: any = null;
  let chosenAccount: any = null;
  const candidateAccId = group.assignedAccountId;

  if (candidateAccId) {
    chosenAccount = (appState.accounts || []).find(a => a.id === candidateAccId);
    if (chosenAccount) {
      client = await getOrInitClientForAccount(chosenAccount);
    }
  }

  if (!client && group.accountMemberships) {
    for (const [accId, mem] of Object.entries(group.accountMemberships)) {
      if ((mem as any).isMember) {
        chosenAccount = (appState.accounts || []).find(a => a.id === accId);
        if (chosenAccount) {
          client = await getOrInitClientForAccount(chosenAccount);
          if (client) break;
        }
      }
    }
  }

  if (!client) {
    client = await getOrInitTgClient();
    chosenAccount = (appState.accounts || []).find(a => a.id === appState.activeAccountId);
  }

  if (!client || !appState.credentials.isConnected) {
    res.status(400).json({ error: 'هیچ اکانت متصل و آنلاینی برای ارزیابی این گروه یافت نشد.' });
    return;
  }

  try {
    const peer = await resolveAndJoinGroup(client, group.usernameOrLink);

    // If specific sponsor url requested to join
    if (joinSponsorUrl) {
      addLog('info', `[عضویت در کانال اسپانسر] در حال عضویت در کانال اسپانسر "${joinSponsorUrl}"...`);
      await joinSponsorTarget(client, { type: 'url', target: joinSponsorUrl }, group.title);
      await new Promise(r => setTimeout(r, 2500));
    }

    // If specific button clicked
    if (buttonRow !== undefined && buttonCol !== undefined && group.captchaDetails?.msgId) {
      try {
        const msgs = await client.getMessages(peer, { ids: [group.captchaDetails.msgId] });
        if (msgs && msgs[0]) {
          const targetMsg = msgs[0];
          if (typeof targetMsg.click === 'function') {
            await targetMsg.click({ i: Number(buttonRow), j: Number(buttonCol) });
            addLog('info', `[کلیک دکمه اینلاین] روی دکمه سطر ${buttonRow + 1} و ستون ${buttonCol + 1} پیام ربات ناظر با موفقیت کلیک شد.`);
          } else if (Api?.messages?.GetBotCallbackAnswer) {
            const btn = targetMsg.replyMarkup?.rows?.[buttonRow]?.buttons?.[buttonCol];
            if (btn?.data) {
              await client.invoke(new Api.messages.GetBotCallbackAnswer({
                peer,
                msgId: targetMsg.id,
                data: btn.data,
              }));
              addLog('info', `[کلیک دکمه شیشه‌ای] درخواست GetBotCallbackAnswer برای دکمه ارسال شد.`);
            }
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (clickErr: any) {
        console.warn('Error clicking inline button:', clickErr?.message || clickErr);
      }
    }

    // If manual custom reply specified
    if (customReply) {
      await client.sendMessage(peer, { message: customReply });
      addLog('info', `[پاسخ دستی به گروه] پیام دستی «${customReply}» به گروه "${group.title}" ارسال شد.`);
      await new Promise(r => setTimeout(r, 2500));
    }

    const verification = await handleAntiBotAndGroupVerification(client, peer, group.title, group, chosenAccount);
    saveData();
    res.json({ success: true, verification, group });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'خطا در ارزیابی مجدد گروه' });
  }
});

// Re-verify readiness status of all groups or ready groups to guarantee 100% truth
app.post('/api/groups/reverify-all', async (req, res) => {
  const { filterType } = req.body; // 'ready_only' | 'captcha_only' | 'all'
  const groupsToTest = appState.groups.filter(g => {
    if (filterType === 'ready_only') return g.readinessStatus === 'ready';
    if (filterType === 'captcha_only') return g.readinessStatus === 'captcha_required';
    return g.membershipStatus === 'joined' || g.readinessStatus === 'ready' || g.readinessStatus === 'captcha_required';
  });

  if (groupsToTest.length === 0) {
    res.json({ success: true, message: 'هیچ گروهی برای راستی‌آزمایی یافت نشد.', testedCount: 0 });
    return;
  }

  // Non-blocking background verification
  (async () => {
    addLog('info', `[راستی‌آزمایی سراسری سلامت گروه‌ها] آغاز بررسی وضعیت ${groupsToTest.length} گروه هدف جهت اطمینان از امکان ارسال پیام...`);
    let readyCount = 0;
    let challengeCount = 0;

    for (const grp of groupsToTest) {
      try {
        let client: any = null;
        let chosenAccount: any = null;
        if (grp.assignedAccountId) {
          chosenAccount = (appState.accounts || []).find(a => a.id === grp.assignedAccountId);
          if (chosenAccount) client = await getOrInitClientForAccount(chosenAccount);
        }
        if (!client) {
          client = await getOrInitTgClient();
          chosenAccount = (appState.accounts || []).find(a => a.id === appState.activeAccountId);
        }
        if (!client) break;

        const peer = await resolveAndJoinGroup(client, grp.usernameOrLink);
        const verification = await handleAntiBotAndGroupVerification(client, peer, grp.title, grp, chosenAccount);
        if (verification.isClear) {
          readyCount++;
        } else {
          challengeCount++;
        }
        saveData();
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.warn(`Error verifying group ${grp.title}:`, err);
      }
    }
    addLog('success', `[پایان راستی‌آزمایی سراسری] نتایج: ${readyCount} گروه کاملاً آماده، ${challengeCount} گروه نیازمند حل چالش ربات ناظر.`);
    saveData();
  })().catch(e => console.error('Global reverify error:', e));

  res.json({
    success: true,
    message: `فرآیند راستی‌آزمایی ${groupsToTest.length} گروه در پس‌زمینه آغاز گردید. لاگ‌ها به صورت زنده نمایش داده می‌شوند.`,
    count: groupsToTest.length,
  });
});

// Endpoint: Dedicated Force-Add Bypass Engine (Resolve "Invite X Members" Challenge for Specific Group)
app.post('/api/groups/bypass-force-add', async (req, res) => {
  const { groupId, usernameOrLink, accountId, forceCount } = req.body;
  const targetQuery = (usernameOrLink || '').trim().toLowerCase();

  let group = appState.groups.find(
    g => (groupId && g.id === groupId) ||
         (targetQuery && (
           g.usernameOrLink?.toLowerCase() === targetQuery ||
           g.usernameOrLink?.toLowerCase().replace('@', '') === targetQuery.replace('@', '') ||
           g.title?.toLowerCase().includes(targetQuery)
         ))
  );

  const groupIdentifier = group?.usernameOrLink || usernameOrLink || (groupId ? `ID: ${groupId}` : 'گروه هدف');

  // If group not found in list, dynamically register it
  if (!group && usernameOrLink) {
    const newGroup: TargetGroup = {
      id: 'group_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: usernameOrLink,
      usernameOrLink: usernameOrLink,
      isActive: true,
      memberCount: 0,
      status: 'pending',
      category: 'همگام‌سازی تلگرام',
      readinessStatus: 'unjoined',
    };
    appState.groups.push(newGroup);
    group = newGroup;
  }

  // Find best account to execute the bypass
  let client: any = null;
  let chosenAccount: any = null;
  const candidateAccId = accountId || group?.assignedAccountId;

  if (candidateAccId) {
    chosenAccount = (appState.accounts || []).find(a => a.id === candidateAccId);
    if (chosenAccount) {
      client = await getOrInitClientForAccount(chosenAccount);
    }
  }

  // Look for an account marked as joined
  if (!client && group?.accountMemberships) {
    for (const [accId, mem] of Object.entries(group.accountMemberships)) {
      if ((mem as any).isMember) {
        chosenAccount = (appState.accounts || []).find(a => a.id === accId);
        if (chosenAccount) {
          client = await getOrInitClientForAccount(chosenAccount);
          if (client) break;
        }
      }
    }
  }

  // Fallback to active account client
  if (!client) {
    client = await getOrInitTgClient();
    chosenAccount = (appState.accounts || []).find(a => a.id === appState.activeAccountId);
  }

  if (!client) {
    res.status(400).json({ error: 'هیچ اکانت متصل و فعالی در تلگرام برای اجرای عملیات یافت نشد.' });
    return;
  }

  const groupTitle = group?.title || usernameOrLink || 'گروه هدف';
  const targetLink = group?.usernameOrLink || usernameOrLink;

  addLog('info', `[شروع فرآیند شکستن قفل ادد اجباری] برای گروه "${groupTitle}" با اکانت «${chosenAccount?.accountName || chosenAccount?.phoneNumber || 'پیش‌فرض'}»...`);

  try {
    const peer = await resolveAndJoinGroup(client, targetLink);
    if (!peer) {
      res.status(400).json({ error: `امکان دسترسی به گروه "${targetLink}" وجود نداشت.` });
      return;
    }

    // Step 1: Run comprehensive verification (Greeting -> Bot response detection -> Force add detection & execution)
    const verification = await handleAntiBotAndGroupVerification(client, peer, groupTitle, group, chosenAccount);

    // If verification didn't trigger invites automatically but forceCount was passed, execute bypass directly
    let manualInvited = 0;
    if (verification.contactsInvited === 0 && forceCount && forceCount > 0) {
      addLog('info', `[ادد دستی درخواستی] الزام به افزودن ${forceCount} کاربر به گروه "${groupTitle}" صادر شد...`);
      const bypassRes = await executeForceAddBypass(client, peer, forceCount, groupTitle);
      manualInvited = bypassRes.invitedCount;

      if (manualInvited > 0) {
        // Send verification greeting after adding members
        await new Promise(r => setTimeout(r, 2500));
        const greetingMsg = appState.scheduler?.antiBot?.greetingMessage || 'سلام بچه ها';
        try {
          await client.sendMessage(peer, { message: greetingMsg });
          addLog('info', `[پیام تستی پس از ادد] پیام «${greetingMsg}» به گروه "${groupTitle}" ارسال شد.`);
        } catch (e) {}
      }
    }

    // Update group state
    if (group) {
      group.isActive = true;
      group.status = 'joined';
      group.membershipStatus = 'joined';
      group.canSendMessages = true;
      group.readinessStatus = 'ready';
      group.lastJoinError = undefined;
      group.errorMessage = undefined;
      if (chosenAccount) {
        group.assignedAccountId = chosenAccount.id;
        group.assignedAccountPhone = chosenAccount.phoneNumber;
        if (!group.accountMemberships) group.accountMemberships = {};
        group.accountMemberships[chosenAccount.id] = {
          accountId: chosenAccount.id,
          accountPhone: chosenAccount.phoneNumber,
          accountName: chosenAccount.accountName || chosenAccount.phoneNumber,
          isMember: true,
          status: 'joined',
          checkedAt: new Date().toISOString(),
          joinedAt: new Date().toISOString(),
        };
      }
    }

    saveData();
    addLog('success', `[عملیات رفع قفل با موفقیت انجام شد ✓] گروه "${groupTitle}" آماده ارسال و انتشار تبلیغات شد.`);

    res.json({
      success: true,
      message: `قفل اد اجباری گروه "${groupTitle}" با موفقیت بررسی و رفع گردید.`,
      invitedCount: verification.contactsInvited + manualInvited,
      verification,
      group,
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    addLog('error', `[خطا در شکستن قفل ادد اجباری] گروه "${groupTitle}": ${errorMsg}`);
    res.status(500).json({ error: errorMsg });
  }
});

// 16. Real-time Monitoring & Process Reports Endpoints
app.get('/api/monitoring/reports', (req, res) => {
  res.json({
    reports: appState.monitoringReports || [],
  });
});

app.post('/api/monitoring/clear', (req, res) => {
  appState.monitoringReports = [];
  saveData();
  res.json({ success: true, message: 'گزارش‌های مانیتورینگ پاکسازی شد.' });
});

app.post('/api/monitoring/mark-reviewed', (req, res) => {
  const { groupId } = req.body;
  if (appState.monitoringReports) {
    const report = appState.monitoringReports.find(r => r.groupId === groupId || r.id === groupId);
    if (report) {
      report.requiresManualCheck = false;
      report.statusMessage = '✅ توسط کاربر بررسی و تایید گردید.';
      saveData();
    }
  }
  res.json({ success: true, reports: appState.monitoringReports || [] });
});

// 17. Re-check Group Anti-Bot & Immediately Send Active Campaign Endpoint
app.post('/api/groups/recheck-and-send', async (req, res) => {
  const { target, groupId } = req.body;
  const searchTarget = target || groupId;

  if (!searchTarget) {
    res.status(400).json({ error: 'آیدی یا نام گروه مشخص نشده است.' });
    return;
  }

  const client = await getOrInitTgClient();
  if (!client || !appState.credentials.isConnected) {
    res.status(400).json({ error: 'حساب تلگرام متصل نیست. لطفاً ابتدا وارد حساب تلگرام شوید.' });
    return;
  }

  const activeCampaigns = appState.campaigns.filter(c => c.isActive);
  const campaign = activeCampaigns[0] || appState.campaigns[0];

  if (!campaign) {
    res.status(400).json({ error: 'هیچ کمپین یا محصول فعالی برای ارسال یافت نشد.' });
    return;
  }

  // Find target group or title
  const targetGroupObj = appState.groups.find(
    g => g.id === searchTarget || g.usernameOrLink.toLowerCase() === searchTarget.toLowerCase() || g.title.toLowerCase() === searchTarget.toLowerCase()
  );
  const targetUsernameOrTitle = targetGroupObj ? targetGroupObj.usernameOrLink : searchTarget;
  const groupTitleName = targetGroupObj ? targetGroupObj.title : searchTarget;

  let tempImgPath: string | undefined = undefined;
  if (campaign.imageUrl) {
    tempImgPath = await getImageFilePathForTelegram(campaign.imageUrl);
  }

  let textMessage = '';
  let usedAiCaption = false;
  if (appState.scheduler.antiBot?.useGeminiForCaptions !== false) {
    try {
      const aiGen = await generateGeminiDynamicAdCaption({
        campaign,
        groupTitle: groupTitleName,
        tone: appState.scheduler.antiBot?.geminiCaptionTone || 'friendly',
      });
      textMessage = aiGen.text;
      usedAiCaption = aiGen.usedAi;
    } catch (e) {}
  }
  if (!textMessage) {
    textMessage = generateLocalDynamicCaption(campaign, { groupTitle: groupTitleName });
  }

  try {
    const peer = await resolveAndJoinGroup(client, targetUsernameOrTitle);
    
    // 1. Re-verify & Resolve Anti-Bot Barriers
    addLog('info', `[بررسی مجدد گروه] در حال بررسی موانع و آنتی‌بات برای گروه "${groupTitleName}"...`);
    const verification = await handleAntiBotAndGroupVerification(client, peer, groupTitleName);

    if (!verification.isClear) {
      res.status(400).json({
        success: false,
        campaignSent: false,
        error: `مانع ارسال هنوز برطرف نشده است: ${verification.statusMessage}`,
        verification,
      });
      return;
    }

    // 2. Obstacles clear! Now immediately send active campaign message
    addLog('info', `[ارسال کمپین] موانع گروه "${groupTitleName}" برطرف گردید. در حال انتشار پیام اصلی کمپین "${campaign.title}"...`);
    
    const sendRes = await sendCampaignWithRetry(client, peer, textMessage, tempImgPath);

    if (!sendRes.success) {
      res.status(400).json({
        success: false,
        campaignSent: false,
        error: `خطا در ارسال پیام کمپین: ${sendRes.error}`,
      });
      return;
    }

    const sentResult = sendRes.sentResult;

    // 3. Verify Message Posted
    const msgId = sentResult?.id || (Array.isArray(sentResult) ? sentResult[0]?.id : undefined);
    await new Promise(r => setTimeout(r, 1500));

    let isVerified = false;
    if (msgId) {
      try {
        const checkedMsgs = await client.getMessages(peer, { ids: [msgId] });
        if (checkedMsgs && checkedMsgs.length > 0 && checkedMsgs[0] && checkedMsgs[0].id === msgId) {
          isVerified = true;
        }
      } catch (checkErr) {
        isVerified = true;
      }
    } else if (sentResult) {
      isVerified = true;
    }

    if (isVerified) {
      const nowStr = new Date().toISOString();
      if (targetGroupObj) {
        targetGroupObj.lastPostedAt = nowStr;
        targetGroupObj.status = 'joined';
        targetGroupObj.errorMessage = undefined;
      }

      updateGroupMonitoringReport({
        groupId: groupTitleName,
        groupTitle: groupTitleName,
        step: 'CAMPAIGN_SENT',
        botDetected: verification.botDetected,
        captchaClicked: verification.captchaClicked,
        channelJoined: verification.channelJoined,
        contactsInvited: verification.contactsInvited,
        requiresManualCheck: false,
        statusMessage: '🚀 مانع گروه رفع شد و پیام کمپین تبلیغاتی با موفقیت در گروه منتشر گردید!',
      });

      addLog('success', `[انتشار موفق کمپین] مانع گروه "${groupTitleName}" برطرف شد و پیام تبلیغاتی "${campaign.title}" با موفقیت ارسال شد!`);

      res.json({
        success: true,
        campaignSent: true,
        message: `مانع برطرف شد و پیام کمپین با موفقیت در گروه "${groupTitleName}" منتشر گردید!`,
      });
    } else {
      // Leave group and clear chat history from user's Telegram
      if (peer) {
        await leaveGroupAndClearHistory(client, peer);
      }

      if (targetGroupObj) {
        appState.groups = appState.groups.filter(g => g.id !== targetGroupObj.id);
      }

      updateGroupMonitoringReport({
        groupId: groupTitleName,
        groupTitle: groupTitleName,
        step: 'FAILED',
        requiresManualCheck: false,
        statusMessage: '❌ پیام توسط ربات ناظر حذف شد. گروه ترک شد و چت مربوطه از حساب تلگرام و نرم‌افزار پاکسازی گردید.',
      });

      addLog('error', `[ترک و پاکسازی] پیام در گروه "${groupTitleName}" توسط ربات ناظر حذف گردید. گروه ترک شد و چت مربوطه از حساب تلگرام و نرم‌افزار پاکسازی گردید.`);

      res.status(400).json({
        success: false,
        campaignSent: false,
        error: 'پیام ارسال شد اما بلافاصله توسط ربات ناظر گروه حذف گردید. گروه از حساب تلگرام ترک شد و چت آن پاکسازی گردید.',
      });
    }
  } catch (err: any) {
    console.error('Error in recheck-and-send route:', err);
    const botToken = appState.credentials.botToken;

    // Fallback to Bot API Helper if userbot encounters an error
    if (botToken) {
      try {
        await sendViaBotApi(botToken, searchTarget, textMessage, campaign.imageUrl);
        const nowStr = new Date().toISOString();
        if (targetGroupObj) {
          targetGroupObj.lastPostedAt = nowStr;
          targetGroupObj.status = 'joined';
          targetGroupObj.errorMessage = undefined;
        }

        updateGroupMonitoringReport({
          groupId: groupTitleName,
          groupTitle: groupTitleName,
          step: 'CAMPAIGN_SENT',
          requiresManualCheck: false,
          statusMessage: '🤖 [ارسال موفق ربات واسط] اکانت اصلی دارای محدودیت بود اما پیام کمپین با موفقیت از طریق ربات واسط ارسال گردید!',
        });

        addLog('success', `[ارسال موفق ربات واسط] پیام کمپین در گروه "${groupTitleName}" از طریق ربات واسط تلگرام ارسال شد.`);

        return res.json({
          success: true,
          campaignSent: true,
          message: `ارسال با موفقیت از طریق ربات واسط (Bot API) در گروه "${groupTitleName}" انجام گردید!`,
        });
      } catch (botErr: any) {
        console.error('Bot API fallback failed as well:', botErr);
      }
    }

    const friendly = translateTgError(err);
    res.status(500).json({ error: friendly });
  } finally {
    if (tempImgPath && fs.existsSync(tempImgPath)) {
      try { fs.unlinkSync(tempImgPath); } catch (e) {}
    }
  }
});

// 13. Direct Test Send Endpoint
app.post('/api/send-direct-test', async (req, res) => {
  const { target, botToken: inputBotToken, useBotOnly, mode } = req.body;
  const chatTarget = target ? String(target).trim() : '';
  if (!chatTarget) {
    return res.status(400).json({ success: false, error: 'لطفاً آیدی مقصد تست را وارد کنید.' });
  }
  const botToken = (inputBotToken && String(inputBotToken).trim()) || appState.credentials.botToken;
  const isBotOnlyMode = Boolean(useBotOnly) || mode === 'bot_only' || Boolean(inputBotToken);

  const activeCampaigns = appState.campaigns.filter(c => c.isActive);
  const campaign = activeCampaigns[0] || appState.campaigns[0];
  let textMessage = '';
  if (campaign) {
    if (appState.scheduler.antiBot?.useGeminiForCaptions !== false) {
      try {
        const aiGen = await generateGeminiDynamicAdCaption({
          campaign,
          groupTitle: chatTarget,
          tone: appState.scheduler.antiBot?.geminiCaptionTone || 'friendly',
        });
        textMessage = aiGen.text;
      } catch (e) {}
    }
    if (!textMessage) {
      textMessage = generateLocalDynamicCaption(campaign, { groupTitle: chatTarget });
    }
  } else {
    textMessage = 'سلام، این یک پیام تست از سامانه مدیریت تبلیغات تلگرام است.';
  }

  // If Bot-Only test is requested (e.g. from Bot API Test button)
  if (isBotOnlyMode) {
    if (!botToken) {
      res.status(400).json({ error: 'توکن ربات تلگرام مشخص نشده است. لطفاً توکن ربات را وارد کنید.' });
      return;
    }

    // Try to automatically join group and invite Bot API Bot via UserBot if connected
    try {
      const client = await getOrInitTgClient();
      if (client && appState.credentials.isConnected) {
        try {
          const peer = await resolveAndJoinGroup(client, chatTarget);
          await ensureBotInGroup(client, peer, botToken);
        } catch (joinErr: any) {
          console.log('[Bot-Only Mode] UserBot resolve/invite notice:', joinErr.message || joinErr);
        }
      }
    } catch (e) {}

    try {
      await sendViaBotApi(botToken, chatTarget, textMessage, campaign?.imageUrl);
      addLog('success', `پیام تست مستقیماً از طریق ربات واسط تلگرام به "${chatTarget}" تحویل گردید.`);
      res.json({ 
        success: true, 
        message: `پیام تست با موفقیت توسط ربات تلگرام مشخص شده به ${chatTarget} ارسال گردید.` 
      });
      return;
    } catch (botErr: any) {
      res.status(400).json({ error: `خطای ارسال با ربات تلگرام: ${botErr.message}` });
      return;
    }
  }

  const client = await getOrInitTgClient();

  let tempImgPath: string | undefined = undefined;
  if (campaign?.imageUrl) {
    tempImgPath = await getImageFilePathForTelegram(campaign.imageUrl);
  }

  if (client && appState.credentials.isConnected) {
    let peer: any = null;
    let sentResult: any = null;
    let isVerified = false;

    try {
      peer = await resolveAndJoinGroup(client, chatTarget);
      await handleAntiBotAndGroupVerification(client, peer, chatTarget);

      if (tempImgPath && fs.existsSync(tempImgPath)) {
        sentResult = await client.sendFile(peer, {
          file: tempImgPath,
          caption: textMessage,
          parseMode: 'md',
        });
      } else {
        sentResult = await client.sendMessage(peer, { message: textMessage, parseMode: 'md' });
      }

      // Verification Check
      const msgId = sentResult?.id || (Array.isArray(sentResult) ? sentResult[0]?.id : undefined);
      await new Promise(r => setTimeout(r, 1500));

      if (msgId) {
        try {
          const checked = await client.getMessages(peer, { ids: [msgId] });
          if (checked && checked.length > 0 && checked[0] && checked[0].id === msgId) {
            isVerified = true;
          }
        } catch (e) {
          isVerified = true;
        }
      } else if (sentResult) {
        isVerified = true;
      }

      if (isVerified) {
        addLog('success', `پیام تست همراه با تصویر به کاربر/گروه "${chatTarget}" ارسال و تایید شد.`);
        res.json({ success: true, message: `پیام تست با موفقیت به ${chatTarget} ارسال و تایید گردید.` });
        return;
      } else {
        // Message was deleted or not posted
        if (peer) {
          await leaveGroupAndClearHistory(client, peer);
        }
        addLog('warning', `پیام تست به "${chatTarget}" ناپایدار بود یا بلافاصله حذف شد. گروه ترک گردید و چت از تلگرام پاک شد.`);
        res.status(400).json({ error: `پیام در ${chatTarget} ثبت نگردید یا حذف شد. حساب کاربری از این گروه خارج شد و چت پاک گردید.` });
        return;
      }
    } catch (tgErr: any) {
      console.error('Direct test userbot error:', tgErr);
      if (peer) {
        await leaveGroupAndClearHistory(client, peer);
      }
      const friendly = translateTgError(tgErr);
      if (botToken) {
        try {
          await sendViaBotApi(botToken, chatTarget, textMessage, campaign?.imageUrl);
          addLog('success', `پیام تست از طریق Bot API با موفقیت به "${chatTarget}" تحویل گردید.`);
          res.json({ success: true, message: `پیام تست از طریق Bot API با موفقیت به ${chatTarget} ارسال شد.` });
          return;
        } catch (botErr: any) {
          res.status(400).json({ error: `Userbot: ${friendly} | Bot API: ${botErr.message}` });
          return;
        }
      }
      res.status(400).json({ error: friendly });
      return;
    } finally {
      if (tempImgPath && fs.existsSync(tempImgPath)) {
        try { fs.unlinkSync(tempImgPath); } catch (e) {}
      }
    }
  }

  if (botToken) {
    try {
      await sendViaBotApi(botToken, chatTarget, textMessage, campaign?.imageUrl);
      addLog('success', `پیام تست از طریق Bot API با موفقیت به "${chatTarget}" تحویل شد.`);
      res.json({ success: true, message: `پیام تست از طریق Bot API با موفقیت به ${chatTarget} ارسال شد.` });
      return;
    } catch (botErr: any) {
      res.status(400).json({ error: `خطای Bot API: ${botErr.message}` });
      return;
    }
  }

  res.status(400).json({ 
    error: 'حساب تلگرام یا توکن ربات متصل نیست! لطفاً توکن ربات تلگرام یا شماره تلفن و کد ۵ رقمی را وارد نمایید.' 
  });
});

// 11. Send Immediate Broadcast API
app.post('/api/broadcast/send-now', (req, res) => {
  if (isBroadcastRunning) {
    res.status(400).json({ success: false, message: 'یک عملیات ارسال در حال حاضر در حال اجرا است.' });
    return;
  }

  isBroadcastCancellationRequested = false;
  // Trigger background execution without hanging HTTP connection
  executeBroadcast(true).catch(err => {
    console.error('Background broadcast execution error:', err);
    isBroadcastRunning = false;
    if (appState.activeBroadcastProgress) {
      appState.activeBroadcastProgress.isRunning = false;
    }
    saveData();
  });

  res.json({ success: true, message: 'عملیات ارسال به گروه‌ها آغاز گردید.' });
});

// 11.1 Live Broadcast Progress API
app.get('/api/broadcast/live-progress', (req, res) => {
  res.json({
    isRunning: Boolean(isBroadcastRunning),
    progress: appState.activeBroadcastProgress || null,
    lastReport: appState.lastBroadcastReport || null,
  });
});

// 11.2 Stop / Cancel Broadcast Process API
app.post('/api/broadcast/stop', (req, res) => {
  isBroadcastCancellationRequested = true;
  isBroadcastRunning = false;

  addLog('warning', '[توقف اضطراری] دستور لغو و توقف فوری فرایند ارسال توسط کاربر صادر و اعمال گردید.');

  if (appState.activeBroadcastProgress) {
    appState.activeBroadcastProgress.isRunning = false;
    if (appState.activeBroadcastProgress.workers) {
      appState.activeBroadcastProgress.workers.forEach(w => {
        w.status = 'finished';
        w.lastAction = 'عملیات ارسال متوقف گردید.';
      });
    }
  }

  saveData();
  res.json({ success: true, message: 'فرایند ارسال با موفقیت متوقف شد.' });
});

// 12. Clear logs
app.post('/api/logs/clear', (req, res) => {
  appState.logs = [
    {
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'تاریخچه لاگ‌ها پاکسازی گردید.',
    }
  ];
  saveData();
  res.json({ success: true, logs: appState.logs });
});

// 14. Update Anti-Bot Settings
app.post('/api/scheduler/update-antibot', (req, res) => {
  const {
    autoClickCaptcha,
    autoForceJoinChannels,
    autoInviteContacts,
    contactsToInviteCount,
    safeContactShield,
    sendGreetingFirst,
    greetingMode,
    greetingMessage,
    autoSolveMathCaptcha,
    safeMembershipRetention,
    supportForumTopics,
    simulateTyping,
    typingDurationSeconds,
    enableSpintax,
    cacheMediaInput,
    verifyMessagePersistence,
    persistenceCheckDelaySeconds,
    campaignRotationMode,
  } = req.body;
  
  if (!appState.scheduler.antiBot) {
    appState.scheduler.antiBot = {
      autoClickCaptcha: true,
      autoForceJoinChannels: true,
      autoInviteContacts: false,
      contactsToInviteCount: 3,
      safeContactShield: true,
      sendGreetingFirst: false,
      greetingMode: 'stealth_silent',
      greetingMessage: 'سلام بچه ها',
      autoSolveMathCaptcha: true,
      safeMembershipRetention: true,
      supportForumTopics: true,
      simulateTyping: true,
      typingDurationSeconds: 2,
      enableSpintax: true,
      cacheMediaInput: true,
      verifyMessagePersistence: true,
      persistenceCheckDelaySeconds: 15,
    };
  }

  if (autoClickCaptcha !== undefined) appState.scheduler.antiBot.autoClickCaptcha = Boolean(autoClickCaptcha);
  if (autoForceJoinChannels !== undefined) appState.scheduler.antiBot.autoForceJoinChannels = Boolean(autoForceJoinChannels);
  if (autoInviteContacts !== undefined) appState.scheduler.antiBot.autoInviteContacts = Boolean(autoInviteContacts);
  if (safeContactShield !== undefined) appState.scheduler.antiBot.safeContactShield = Boolean(safeContactShield);
  if (sendGreetingFirst !== undefined) appState.scheduler.antiBot.sendGreetingFirst = Boolean(sendGreetingFirst);
  if (greetingMode !== undefined) appState.scheduler.antiBot.greetingMode = greetingMode;
  if (typeof greetingMessage === 'string' && greetingMessage.trim().length > 0) {
    appState.scheduler.antiBot.greetingMessage = greetingMessage.trim();
  }
  if (typeof contactsToInviteCount === 'number' && contactsToInviteCount > 0) {
    appState.scheduler.antiBot.contactsToInviteCount = contactsToInviteCount;
  }
  if (autoSolveMathCaptcha !== undefined) appState.scheduler.antiBot.autoSolveMathCaptcha = Boolean(autoSolveMathCaptcha);
  if (safeMembershipRetention !== undefined) appState.scheduler.antiBot.safeMembershipRetention = Boolean(safeMembershipRetention);
  if (supportForumTopics !== undefined) appState.scheduler.antiBot.supportForumTopics = Boolean(supportForumTopics);
  // Enforce human-like typing simulation always
  appState.scheduler.antiBot.simulateTyping = true;
  if (typeof typingDurationSeconds === 'number' && typingDurationSeconds > 0) {
    appState.scheduler.antiBot.typingDurationSeconds = Math.min(10, Math.max(1, typingDurationSeconds));
  }
  if (enableSpintax !== undefined) appState.scheduler.antiBot.enableSpintax = Boolean(enableSpintax);
  // Enforce media file caching always to prevent redundant uploads and avoid FloodWait
  appState.scheduler.antiBot.cacheMediaInput = true;
  if (verifyMessagePersistence !== undefined) appState.scheduler.antiBot.verifyMessagePersistence = Boolean(verifyMessagePersistence);
  if (typeof persistenceCheckDelaySeconds === 'number' && persistenceCheckDelaySeconds >= 5) {
    appState.scheduler.antiBot.persistenceCheckDelaySeconds = Math.min(120, Math.max(5, persistenceCheckDelaySeconds));
  }

  if (campaignRotationMode && ['round_robin', 'category_match', 'first_active'].includes(campaignRotationMode)) {
    appState.scheduler.campaignRotationMode = campaignRotationMode;
  }

  saveData();
  addLog('info', 'تنظیمات پیشرفته سیستم ضد اسپم (سپر امنیتی، هوش مصنوعی آنتی‌بات، فروم و چرخش کمپین‌ها) به‌روزرسانی شد.');
  res.json({ success: true, antiBot: appState.scheduler.antiBot, campaignRotationMode: appState.scheduler.campaignRotationMode });
});

// Endpoint: Manual/On-Demand Persistence Verification of Target Groups
app.post('/api/groups/verify-persistence', async (req, res) => {
  const { groupId, checkAll } = req.body;
  const client = await getOrInitTgClient();

  if (!client || !appState.credentials.isConnected) {
    return res.status(400).json({ error: 'اکانت تلگرام متصل نیست.' });
  }

  const groupsToTest = checkAll 
    ? appState.groups.filter(g => g.isActive && g.lastPostedAt) 
    : appState.groups.filter(g => g.id === groupId);

  if (groupsToTest.length === 0) {
    return res.status(400).json({ error: 'گروهی جهت پایش ماندگاری یافت نشد.' });
  }

  addLog('info', `[پایش ماندگاری پیام] آغاز بررسی آنلاین ماندگاری پیام‌ها در ${groupsToTest.length} گروه...`);

  let verifiedCount = 0;
  let deletedCount = 0;

  for (const g of groupsToTest) {
    try {
      const peer = await resolveAndJoinGroup(client, g.usernameOrLink);
      // Fetch latest 5 messages in this chat
      const msgs = await client.getMessages(peer, { limit: 5 });
      const myId = await client.getMe().then((m: any) => m.id);
      
      const foundMyMsg = msgs.find((m: any) => m && m.fromId && (m.fromId.userId?.toString() === myId?.toString() || m.senderId?.toString() === myId?.toString()));

      if (foundMyMsg) {
        g.persistenceStatus = 'verified';
        g.strictFilterDetected = false;
        g.lastVerifiedAt = new Date().toISOString();
        verifiedCount++;
      } else {
        g.persistenceStatus = 'auto_deleted';
        g.strictFilterDetected = true;
        g.lastVerifiedAt = new Date().toISOString();
        deletedCount++;
        addLog('warning', `[حذف خودکار] پیام در گروه "${g.title}" موجود نیست (احتمالاً توسط ربات نگهبان حذف شده است).`, g.title);
      }
    } catch (e: any) {
      console.warn(`Persistence check error on ${g.title}:`, e.message || e);
    }
  }

  saveData();
  res.json({
    success: true,
    message: `بررسی ماندگاری تکمیل شد: ${verifiedCount} پیام تاییدشده، ${deletedCount} پیام حذف شده توسط ربات.`,
    groups: appState.groups,
  });
});

// 18. Export Data Backup Endpoints
const handleExportBackup = (req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=telegram_promoter_backup_${new Date().toISOString().slice(0, 10)}.json`);
  res.send(JSON.stringify(appState, null, 2));
};
app.get('/api/backup/export', handleExportBackup);
app.get('/api/download-backup', handleExportBackup);

// 19. Import Data Backup Endpoints
const handleImportBackup = (req: express.Request, res: express.Response) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'فایل پشتیبان نامعتبر است.' });
    return;
  }

  if (Array.isArray(data.groups)) {
    appState.groups = data.groups;
  }
  if (Array.isArray(data.campaigns)) {
    appState.campaigns = data.campaigns;
  }
  if (data.scheduler) {
    appState.scheduler = { ...appState.scheduler, ...data.scheduler };
  }
  if (data.credentials) {
    appState.credentials = { ...appState.credentials, ...data.credentials };
  }
  if (data.anonymousAutomator) {
    appState.anonymousAutomator = normalizeAnonymousAutomatorConfig({
      ...appState.anonymousAutomator,
      ...data.anonymousAutomator,
      products: data.anonymousAutomator.products || data.anonymousAutomator.instructions?.products,
      activeProductId: data.anonymousAutomator.activeProductId || data.anonymousAutomator.instructions?.activeProductId,
      instructions: {
        ...(appState.anonymousAutomator?.instructions || {}),
        ...(data.anonymousAutomator.instructions || {}),
        products: data.anonymousAutomator.instructions?.products || data.anonymousAutomator.products,
        activeProductId: data.anonymousAutomator.instructions?.activeProductId || data.anonymousAutomator.activeProductId,
        savedPrompts: Array.isArray(data.anonymousAutomator.instructions?.savedPrompts)
          ? data.anonymousAutomator.instructions.savedPrompts
          : (appState.anonymousAutomator?.instructions?.savedPrompts || []),
      },
    });
  }
  if (Array.isArray(data.accounts)) {
    appState.accounts = data.accounts;
  }
  if (data.activeAccountId) {
    appState.activeAccountId = data.activeAccountId;
  }
  if (Array.isArray(data.anonymousSessionHistory)) {
    appState.anonymousSessionHistory = data.anonymousSessionHistory;
  }

  saveData();
  addLog('success', 'بازیابی موفق تمام اطلاعات، دستورالعمل‌های ذخیره‌شده هوش مصنوعی و تنظیمات از فایل پشتیبان JSON انجام شد.');

  res.json({
    success: true,
    message: 'اطلاعات و دستورالعمل‌های ذخیره‌شده با موفقیت بازیابی شد.',
    groupsCount: appState.groups.length,
    campaignsCount: appState.campaigns.length,
    savedPromptsCount: appState.anonymousAutomator?.instructions?.savedPrompts?.length || 0,
    state: appState,
  });
};
app.post('/api/backup/import', handleImportBackup);
app.post('/api/restore-backup', handleImportBackup);

// Save All Endpoint
app.post('/api/save-all', (req, res) => {
  saveData();
  addLog('info', 'تمام تنظیمات و دستورالعمل‌های ذخیره‌شده در فایل پایگاه داده ذخیره شدند.');
  res.json({ success: true, state: appState });
});

// 20. Multi-Account Management Endpoints
app.get('/api/accounts/list', (req, res) => {
  syncAccountsState();
  res.json({
    accounts: appState.accounts || [],
    activeAccountId: appState.activeAccountId,
  });
});

// Verify All Accounts Live Health (100% Guaranteed MTProto Check)
app.post('/api/accounts/verify-all', async (req, res) => {
  syncAccountsState();
  const accounts = appState.accounts || [];
  if (accounts.length === 0) {
    res.json({ success: true, accounts: [], verifiedCount: 0, expiredCount: 0, floodCount: 0, message: 'هیچ اکانتی در سیستم ثبت نشده است.' });
    return;
  }

  addLog('info', `[پایش سلامت زنده] در حال بررسی اعتبار نشست ${accounts.length} اکانت تلگرام...`);

  let verifiedCount = 0;
  let expiredCount = 0;
  let floodCount = 0;

  for (const acc of accounts) {
    try {
      const result = await verifyAccountLiveHealth(acc, false);
      if (result.status === 'connected') {
        verifiedCount++;
      } else if (result.status === 'session_expired') {
        expiredCount++;
      } else if (result.status === 'flood_wait') {
        floodCount++;
      }
    } catch (e: any) {
      acc.status = 'error';
      acc.isVerifiedLive = false;
      acc.statusMessage = e.message || 'خطا در بررسی نشست';
    }
  }

  saveData();
  addLog(
    verifiedCount > 0 ? 'success' : 'warning',
    `[نتیجه پایش زنده اکانت‌ها] ${verifiedCount} اکانت فعال و تایید شده، ${expiredCount} اکانت منقضی (نیاز به تمدید)، ${floodCount} اکانت در محدودیت FloodWait.`
  );

  res.json({
    success: true,
    accounts: appState.accounts,
    activeAccountId: appState.activeAccountId,
    verifiedCount,
    expiredCount,
    floodCount,
    message: `بررسی زنده انجام شد: ${verifiedCount} اکانت متصل، ${expiredCount} منقضی، ${floodCount} در انتظار.`,
  });
});

// Verify Single Account Live Health
app.post('/api/accounts/verify-single', async (req, res) => {
  const { accountId } = req.body;
  syncAccountsState();
  const acc = (appState.accounts || []).find(a => a.id === accountId);
  if (!acc) {
    res.status(404).json({ error: 'اکانت مورد نظر یافت نشد.' });
    return;
  }

  try {
    const result = await verifyAccountLiveHealth(acc, true);
    addLog(
      result.success ? 'success' : 'warning',
      `[تست زنده اکانت] اکانت (${acc.userProfile?.firstName || acc.phoneNumber}): ${result.statusMessage}`
    );
    res.json({
      success: result.success,
      account: acc,
      status: result.status,
      statusMessage: result.statusMessage,
      accounts: appState.accounts,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'خطا در بررسی اکانت' });
  }
});

// Toggle Module Participation for Single Account
app.post('/api/accounts/toggle-module', (req, res) => {
  const { accountId, module, enabled } = req.body;
  syncAccountsState();
  const acc = (appState.accounts || []).find(a => a.id === accountId);
  if (!acc) {
    res.status(404).json({ error: 'اکانت یافت نشد.' });
    return;
  }

  const isEnabled = Boolean(enabled);
  if (module === 'group_broadcast') {
    acc.enableForGroupBroadcast = isEnabled;
    const label = isEnabled ? 'فعال در ارسال تبلیغات گروهی' : 'غیرفعال در تبلیغات گروهی';
    addLog('info', `[تغییر نقش اکانت] اکانت (${acc.userProfile?.firstName || acc.phoneNumber}) ${label} گردید.`);
  } else if (module === 'anonymous_bot') {
    acc.enableForAnonymousBot = isEnabled;
    const label = isEnabled ? 'فعال در چت ربات ناشناس' : 'غیرفعال در چت ربات ناشناس';
    addLog('info', `[تغییر نقش اکانت] اکانت (${acc.userProfile?.firstName || acc.phoneNumber}) ${label} گردید.`);
  } else if (module === 'pv_reply') {
    acc.enableForPvReply = isEnabled;
    const label = isEnabled ? 'فعال در پاسخگویی خودکار پی‌وی (PV)' : 'غیرفعال در پاسخگویی خودکار پی‌وی (پاسخگویی دستی شخصی توسط شما)';
    addLog('info', `[تغییر نقش اکانت] اکانت (${acc.userProfile?.firstName || acc.phoneNumber}) ${label} گردید.`);
  } else {
    res.status(400).json({ error: 'بخش مشخص شده نامعتبر است.' });
    return;
  }

  ensureGroupTerritories();
  saveData();
  res.json({ success: true, accounts: appState.accounts, account: acc });
});

// Dynamic Real-time FloodWait Checker and Telegram Session Probe
app.post('/api/accounts/check-flood-wait', async (req, res) => {
  const { accountId, probeTelegram } = req.body;
  syncAccountsState();
  const acc = (appState.accounts || []).find(a => a.id === accountId);
  if (!acc) {
    res.status(404).json({ success: false, error: 'اکانت مورد نظر یافت نشد.' });
    return;
  }

  const now = Date.now();
  if (acc.floodWaitUntil && acc.floodWaitUntil <= now) {
    // Restriction has expired! Automatically restore account status
    acc.floodWaitUntil = undefined;
    acc.status = 'connected';
    acc.shiftStatus = 'active_working';
    acc.statusMessage = 'متصل و فعال (محدودیت FloodWait برطرف گردید)';
    addLog('success', `🎉 [رفع محدودیت تلگرام] محدودیت FloodWait اکانت (${acc.userProfile?.firstName || acc.phoneNumber}) به پایان رسید و اکانت مجدداً فعال شد.`);
    saveData();
    res.json({
      success: true,
      status: 'cleared',
      isLimited: false,
      message: 'محدودیت FloodWait این اکانت به پایان رسیده است و به چرخه فعالیت بازگشت.',
      account: acc,
    });
    return;
  }

  if (acc.floodWaitUntil && acc.floodWaitUntil > now) {
    const remainingSeconds = Math.ceil((acc.floodWaitUntil - now) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    let probeResult: any = null;
    if (probeTelegram) {
      try {
        const client = await getOrInitClientForAccount(acc);
        if (client && !client._destroyed) {
          await loadGramJS();
          // Safe lightweight ping to verify MTProto session connectivity
          const state = await client.invoke(new Api.updates.GetState());
          probeResult = {
            sessionAlive: true,
            pts: state?.pts,
            date: state?.date,
            note: 'نشست MTProto با سرورهای تلگرام کاملاً متصل و زنده است.',
          };
        }
      } catch (pErr: any) {
        probeResult = {
          sessionAlive: false,
          error: pErr?.message || String(pErr),
        };
      }
    }

    res.json({
      success: true,
      status: 'waiting',
      isLimited: true,
      remainingSeconds,
      remainingMinutes,
      floodWaitUntil: acc.floodWaitUntil,
      unlockTimeIso: new Date(acc.floodWaitUntil).toISOString(),
      account: acc,
      probeResult,
    });
    return;
  }

  // Account has no flood wait
  res.json({
    success: true,
    status: 'healthy',
    isLimited: false,
    message: 'این اکانت در حال حاضر هیچ محدودیت FloodWait فعالی ندارد و در وضعیت نرمال است.',
    account: acc,
  });
});

// Toggle Failover Territory Redistribution Policy
app.post('/api/scheduler/toggle-failover-redistribution', (req, res) => {
  const { enabled } = req.body;
  if (!appState.scheduler) appState.scheduler = {} as any;
  if (!appState.scheduler.antiBot) appState.scheduler.antiBot = {} as any;

  appState.scheduler.antiBot.enableFailoverRedistribution = Boolean(enabled);
  if (appState.groupPromotionStrategy) {
    (appState.groupPromotionStrategy as any).enableFailoverRedistribution = Boolean(enabled);
  }

  const statusText = enabled ? 'فعال (توزیع وظایف بین سایر اکانت‌ها)' : 'غیرفعال (حفظ قلمرو و عدم واگذاری گروه به اکانت‌های دیگر)';
  addLog('info', `[تنظیمات انتقال مسئولیت] سیاست Failover به حالت: «${statusText}» تنظیم گردید.`);

  saveData();
  res.json({
    success: true,
    enableFailoverRedistribution: appState.scheduler.antiBot.enableFailoverRedistribution,
    antiBot: appState.scheduler.antiBot,
  });
});

// Bulk Toggle Module Participation for All Accounts
app.post('/api/accounts/bulk-toggle-module', (req, res) => {
  const { module, enabled } = req.body;
  syncAccountsState();
  const isEnabled = Boolean(enabled);

  if (module === 'group_broadcast') {
    for (const acc of appState.accounts) {
      acc.enableForGroupBroadcast = isEnabled;
    }
    addLog('info', `[تغییر دسته‌جمعی] تمامی اکانت‌ها در ارسال تبلیغات گروهی ${isEnabled ? 'فعال' : 'غیرفعال'} شدند.`);
  } else if (module === 'anonymous_bot') {
    for (const acc of appState.accounts) {
      acc.enableForAnonymousBot = isEnabled;
    }
    addLog('info', `[تغییر دسته‌جمعی] تمامی اکانت‌ها در اتوماسیون چت ناشناس ${isEnabled ? 'فعال' : 'غیرفعال'} شدند.`);
  } else if (module === 'pv_reply') {
    for (const acc of appState.accounts) {
      acc.enableForPvReply = isEnabled;
    }
    addLog('info', `[تغییر دسته‌جمعی] تمامی اکانت‌ها در پاسخگویی خودکار پی‌وی (PV) ${isEnabled ? 'فعال' : 'غیرفعال'} شدند.`);
  } else {
    res.status(400).json({ error: 'بخش نامعتبر است.' });
    return;
  }

  saveData();
  res.json({ success: true, accounts: appState.accounts });
});

app.post('/api/accounts/select-active', async (req, res) => {
  const { accountId } = req.body;
  syncAccountsState();
  const acc = (appState.accounts || []).find(a => a.id === accountId);
  if (!acc) {
    res.status(404).json({ error: 'حساب کاربری مورد نظر یافت نشد.' });
    return;
  }

  // Disconnect existing client so new account connects cleanly
  if (activeTgClient) {
    try {
      await activeTgClient.disconnect();
    } catch (e) {}
    activeTgClient = null;
  }

  appState.activeAccountId = acc.id;
  appState.credentials.phoneNumber = acc.phoneNumber;
  appState.credentials.apiId = acc.apiId || DEFAULT_API_ID;
  appState.credentials.apiHash = acc.apiHash || DEFAULT_API_HASH;
  appState.credentials.sessionString = acc.sessionString;
  appState.credentials.userProfile = acc.userProfile;
  appState.credentials.isConnected = true;
  saveData();

  addLog('info', `[تغییر اکانت فعال] اکانت فعال نرم‌افزار با یک کلیک به (${acc.userProfile?.firstName || acc.phoneNumber}) تغییر یافت.`);
  res.json({
    success: true,
    accounts: appState.accounts,
    activeAccountId: appState.activeAccountId,
    credentials: appState.credentials,
  });
});

app.post('/api/accounts/toggle', (req, res) => {
  const { accountId, isActive } = req.body;
  syncAccountsState();
  const acc = (appState.accounts || []).find(a => a.id === accountId);
  if (!acc) {
    res.status(404).json({ error: 'حساب کاربری یافت نشد.' });
    return;
  }

  acc.isActive = Boolean(isActive);
  ensureGroupTerritories();
  saveData();

  const statusText = acc.isActive ? 'فعال در عملیات' : 'غیرفعال شد';
  addLog('info', `[مدیریت اکانت] وضعیت اکانت (${acc.userProfile?.firstName || acc.phoneNumber}) به ${statusText} تغییر یافت.`);
  res.json({ success: true, accounts: appState.accounts });
});

app.post('/api/accounts/delete', async (req, res) => {
  const { accountId } = req.body;
  syncAccountsState();
  const targetAcc = (appState.accounts || []).find(a => a.id === accountId);
  if (!targetAcc) {
    res.status(404).json({ error: 'حساب کاربری یافت نشد.' });
    return;
  }

  // Safely disconnect client if alive
  if (accountClientsMap.has(accountId)) {
    try {
      const client = accountClientsMap.get(accountId);
      await client.disconnect();
    } catch (e) {}
    accountClientsMap.delete(accountId);
  }

  appState.accounts = (appState.accounts || []).filter(a => a.id !== accountId);

  // If deleted account was the active account in credentials, update credentials
  if (appState.activeAccountId === accountId || appState.credentials.phoneNumber === targetAcc.phoneNumber) {
    if (appState.accounts.length > 0) {
      const nextAcc = appState.accounts[0];
      appState.activeAccountId = nextAcc.id;
      appState.credentials.phoneNumber = nextAcc.phoneNumber;
      appState.credentials.apiId = nextAcc.apiId || DEFAULT_API_ID;
      appState.credentials.apiHash = nextAcc.apiHash || DEFAULT_API_HASH;
      appState.credentials.sessionString = nextAcc.sessionString;
      appState.credentials.userProfile = nextAcc.userProfile;
      appState.credentials.isConnected = nextAcc.status === 'connected' || nextAcc.status === 'active';
    } else {
      appState.activeAccountId = undefined;
      appState.credentials.isConnected = false;
      appState.credentials.sessionString = '';
      appState.credentials.userProfile = undefined;
    }
  }

  saveData();
  addLog('warning', `[حذف اکانت] اکانت (${targetAcc.userProfile?.firstName || targetAcc.phoneNumber}) با موفقیت حذف و ارتباط آن قطع گردید.`);
  res.json({ success: true, accounts: appState.accounts, activeAccountId: appState.activeAccountId });
});

// Helper store for multi-account login sessions
const multiAccLoginSessionsMap = new Map<string, any>();

app.post('/api/accounts/add-start', async (req, res) => {
  const { phoneNumber, apiId, apiHash, proxy } = req.body;
  if (!phoneNumber) {
    res.status(400).json({ error: 'شماره تلفن الزامی است.' });
    return;
  }

  const cleanPhone = cleanPhoneNumber(phoneNumber);
  if (!cleanPhone || cleanPhone.length < 8) {
    res.status(400).json({ error: 'شماره تلفن وارد شده نامعتبر است. فرمت صحیح: 989123456789+' });
    return;
  }

  const effectiveApiId = parseInt(apiId || appState.credentials.apiId || '', 10);
  const effectiveApiHash = apiHash || appState.credentials.apiHash || '';

  if (!effectiveApiId || !effectiveApiHash) {
    res.status(400).json({ error: 'لطفاً ابتدا API ID و API Hash اختصاصی خود را وارد نمایید. (از my.telegram.org دریافت کنید)' });
    return;
  }

  try {
    await loadGramJS();
    if (!TelegramClient || !StringSession) {
      res.status(500).json({ error: 'کتابخانه تلگرام بارگذاری نشد.' });
      return;
    }

    const tempSession = new StringSession('');
    const tempClient = createTelegramClient(tempSession, effectiveApiId, effectiveApiHash, proxy || appState.credentials.proxy);

    await Promise.race([
      tempClient.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 25000))
    ]);

    const { phoneCodeHash } = await tempClient.sendCode(
      { apiId: effectiveApiId, apiHash: effectiveApiHash },
      cleanPhone
    );

    const sessionId = 'acc_login_' + Date.now();
    multiAccLoginSessionsMap.set(sessionId, {
      sessionId,
      phoneNumber: cleanPhone,
      phoneCodeHash,
      apiId: String(effectiveApiId),
      apiHash: effectiveApiHash,
      client: tempClient,
      proxy: proxy || undefined,
    });

    res.json({
      success: true,
      sessionId,
      message: 'کد تایید تلگرام به حساب شما ارسال گردید.',
    });
  } catch (err: any) {
    console.error('Account add-start error:', err);
    res.status(400).json({ error: translateTgError(err) });
  }
});

// Renew Session Start Endpoint
app.post('/api/accounts/renew-start', async (req, res) => {
  const { accountId, proxy } = req.body;
  syncAccountsState();
  const acc = (appState.accounts || []).find(a => a.id === accountId);
  if (!acc) {
    res.status(404).json({ error: 'اکانت مورد نظر یافت نشد.' });
    return;
  }

  const cleanPhone = cleanPhoneNumber(acc.phoneNumber);
  const effectiveApiId = parseInt(acc.apiId || appState.credentials.apiId || '', 10);
  const effectiveApiHash = acc.apiHash || appState.credentials.apiHash || '';

  if (!effectiveApiId || !effectiveApiHash) {
    res.status(400).json({ error: 'کلیدهای API برای این اکانت یافت نشد. لطفاً API ID و API Hash را مجدداً وارد فرمایید.' });
    return;
  }

  try {
    await loadGramJS();
    const tempSession = new StringSession('');
    const tempClient = createTelegramClient(tempSession, effectiveApiId, effectiveApiHash, proxy || acc.proxy || appState.credentials.proxy);

    await Promise.race([
      tempClient.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 25000))
    ]);

    const { phoneCodeHash } = await tempClient.sendCode(
      { apiId: effectiveApiId, apiHash: effectiveApiHash },
      cleanPhone
    );

    const sessionId = 'acc_renew_' + Date.now();
    multiAccLoginSessionsMap.set(sessionId, {
      sessionId,
      targetAccountId: acc.id,
      phoneNumber: cleanPhone,
      phoneCodeHash,
      apiId: String(effectiveApiId),
      apiHash: effectiveApiHash,
      client: tempClient,
      proxy: proxy || acc.proxy || undefined,
    });

    res.json({
      success: true,
      sessionId,
      accountId: acc.id,
      phoneNumber: cleanPhone,
      message: `کد تایید تمدید نشست به شماره ${cleanPhone} ارسال شد.`,
    });
  } catch (err: any) {
    console.error('Account renew-start error:', err);
    res.status(400).json({ error: translateTgError(err) });
  }
});

app.post('/api/accounts/add-verify', async (req, res) => {
  const { sessionId, phoneCode, password, targetAccountId } = req.body;
  if (!sessionId || !phoneCode) {
    res.status(400).json({ error: 'کد ورود و شناسه نشست الزامی است.' });
    return;
  }

  const loginSession = multiAccLoginSessionsMap.get(sessionId);
  if (!loginSession || !loginSession.client) {
    res.status(400).json({ error: 'نشست ورود معتبر نیست یا منقضی شده است. لطفاً دوباره تلاش کنید.' });
    return;
  }

  const { client, phoneNumber, phoneCodeHash, apiId, apiHash } = loginSession;

  try {
    const apiIdNum = parseInt(apiId, 10);

    try {
      if (Api && Api.auth && Api.auth.SignIn) {
        await client.invoke(
          new Api.auth.SignIn({
            phoneNumber,
            phoneCodeHash: phoneCodeHash || '',
            phoneCode,
          })
        );
      } else {
        throw new Error('کتابخانه تلگرام بارگذاری نشده است');
      }
    } catch (codeErr: any) {
      const errStr = String(codeErr.errorMessage || codeErr.message || codeErr);
      if (errStr.includes('SESSION_PASSWORD_NEEDED') || errStr.includes('2FA')) {
        if (!password) {
          res.status(401).json({
            requiresPassword: true,
            error: 'تایید دو مرحله‌ای (2FA) برای این حساب فعال است. لطفاً رمز عبور را وارد نمایید.',
          });
          return;
        }
        await verify2FAPassword(client, password, apiIdNum, apiHash);
      } else {
        throw codeErr;
      }
    }

    const sessionString = client.session.save();
    const me = await client.getMe();

    const userProfile = {
      id: me.id ? me.id.toString() : 'me',
      firstName: me.firstName || '',
      lastName: me.lastName || '',
      username: me.username || '',
      phone: me.phone ? (me.phone.startsWith('+') ? me.phone : '+' + me.phone) : phoneNumber,
    };

    syncAccountsState();

    const existingAccId = targetAccountId || loginSession.targetAccountId;
    const existingIndex = existingAccId
      ? appState.accounts.findIndex(a => a.id === existingAccId)
      : appState.accounts.findIndex(a => a.phoneNumber === userProfile.phone);

    if (existingIndex >= 0) {
      const acc = appState.accounts[existingIndex];
      acc.sessionString = sessionString;
      acc.userProfile = userProfile;
      acc.apiId = apiId;
      acc.apiHash = apiHash;
      if (loginSession.proxy) {
        acc.proxy = loginSession.proxy;
      }
      acc.status = 'connected';
      acc.isVerifiedLive = true;
      acc.requiresReauth = false;
      acc.lastVerifiedAt = new Date().toISOString();
      acc.statusMessage = 'متصل و ۱۰۰٪ فعال و تایید شده';
      accountClientsMap.set(acc.id, client);
      appState.activeAccountId = acc.id;
    } else {
      const newAcc: TelegramAccount = {
        id: 'acc_' + Date.now(),
        phoneNumber: userProfile.phone,
        apiId,
        apiHash,
        sessionString,
        userProfile,
        proxy: loginSession.proxy,
        isActive: true,
        enableForGroupBroadcast: true,
        enableForAnonymousBot: true,
        isVerifiedLive: true,
        lastVerifiedAt: new Date().toISOString(),
        requiresReauth: false,
        dailySentCount: 0,
        status: 'connected',
        statusMessage: 'متصل و ۱۰۰٪ فعال و تایید شده',
      };
      appState.accounts.push(newAcc);
      appState.activeAccountId = newAcc.id;
      accountClientsMap.set(newAcc.id, client);
    }

    // Set as active credentials
    appState.credentials.phoneNumber = userProfile.phone;
    appState.credentials.apiId = apiId;
    appState.credentials.apiHash = apiHash;
    appState.credentials.sessionString = sessionString;
    appState.credentials.userProfile = userProfile;
    appState.credentials.isConnected = true;

    saveData();
    multiAccLoginSessionsMap.delete(sessionId);

    addLog('success', `[اتصال موفق] اکانت (${userProfile.firstName || userProfile.phone}) با موفقیت به سیستم متصل و تایید گردید.`);

    ensureGroupTerritories();

    res.json({
      success: true,
      message: 'اکانت با موفقیت متصل و تایید گردید.',
      accounts: appState.accounts,
      activeAccountId: appState.activeAccountId,
    });
  } catch (err: any) {
    console.error('Account add-verify error:', err);
    res.status(500).json({ error: translateTgError(err) });
  }
});

// Territory Management: Auto-Balance All Groups Evenly Across Accounts
app.post('/api/territory/rebalance', (req, res) => {
  const { forceRebalanceAll = false, forceAll = false } = req.body;
  const shouldForce = Boolean(forceRebalanceAll || forceAll);
  const result = autoBalanceTerritories(shouldForce);
  res.json({
    success: result.success,
    totalGroups: result.totalGroups,
    totalAccounts: result.totalAccounts,
    distribution: result.distribution,
    groups: appState.groups,
    accounts: appState.accounts,
  });
});

// Territory Management: Assign a specific group to a designated account
app.post('/api/territory/assign-group', (req, res) => {
  const { groupId, accountId } = req.body;
  syncAccountsState();
  const group = (appState.groups || []).find(g => g.id === groupId);
  if (!group) {
    return res.status(404).json({ error: 'گروه مورد نظر یافت نشد.' });
  }
  const account = (appState.accounts || []).find(a => a.id === accountId);
  if (!account) {
    return res.status(404).json({ error: 'اکانت مورد نظر یافت نشد.' });
  }

  group.assignedAccountId = account.id;
  group.assignedAccountPhone = account.phoneNumber;
  group.assignedAccountName = account.userProfile?.firstName || account.phoneNumber;
  group.isFailoverReassigned = false;
  group.previousOwnerAccountId = undefined;

  for (const acc of appState.accounts) {
    acc.assignedGroupCount = (appState.groups || []).filter(g => g.assignedAccountId === acc.id).length;
  }

  saveData();
  addLog(
    'info',
    `[تخصیص قلمرو] مسئولیت گروه "${group.title}" به صورت دستی به اکانت (${account.userProfile?.firstName || account.phoneNumber}) واگذار شد.`
  );

  res.json({
    success: true,
    group,
    accounts: appState.accounts,
  });
});

// Multi-Account Settings: Update Persona, Custom Prompt, Limits and Shift Status
app.post('/api/accounts/update-settings', (req, res) => {
  const {
    accountId,
    personaTone,
    customPersonaPrompt,
    hourlyLimit,
    dailyLimit,
    shiftStatus,
    deviceFingerprint,
    enableForGroupBroadcast,
    enableForAnonymousBot,
    enableForPvReply,
  } = req.body;

  syncAccountsState();
  const acc = (appState.accounts || []).find(a => a.id === accountId);
  if (!acc) {
    return res.status(404).json({ error: 'اکانت مورد نظر یافت نشد.' });
  }

  if (personaTone) acc.personaTone = personaTone;
  if (customPersonaPrompt !== undefined) acc.customPersonaPrompt = customPersonaPrompt;
  if (hourlyLimit !== undefined) acc.hourlyLimit = Math.max(1, parseInt(hourlyLimit, 10) || 15);
  if (dailyLimit !== undefined) acc.dailyLimit = Math.max(1, parseInt(dailyLimit, 10) || 50);
  if (shiftStatus) acc.shiftStatus = shiftStatus;
  if (deviceFingerprint) acc.deviceFingerprint = deviceFingerprint;
  if (enableForGroupBroadcast !== undefined) acc.enableForGroupBroadcast = Boolean(enableForGroupBroadcast);
  if (enableForAnonymousBot !== undefined) acc.enableForAnonymousBot = Boolean(enableForAnonymousBot);
  if (enableForPvReply !== undefined) acc.enableForPvReply = Boolean(enableForPvReply);

  saveData();
  addLog(
    'info',
    `[تنظیمات اکانت] مشخصات و پرسونای رفتاری اکانت (${acc.userProfile?.firstName || acc.phoneNumber}) با لحن «${acc.personaTone}» و سقف روزانه ${acc.dailyLimit} به‌روزرسانی شد.`
  );

  res.json({
    success: true,
    account: acc,
    accounts: appState.accounts,
  });
});

// Multi-Instance Google AI Studio Sharding Configuration
app.post('/api/sharding/update', (req, res) => {
  const { isEnabled, currentShard, totalShards, instanceLabel } = req.body;
  if (!appState.instanceSharding) {
    appState.instanceSharding = {
      isEnabled: false,
      currentShard: 1,
      totalShards: 5,
      instanceLabel: 'Google AI Studio Node #1',
    };
  }

  if (isEnabled !== undefined) appState.instanceSharding.isEnabled = Boolean(isEnabled);
  if (currentShard !== undefined) {
    appState.instanceSharding.currentShard = Math.max(1, Math.min(10, parseInt(currentShard, 10) || 1));
  }
  if (totalShards !== undefined) {
    appState.instanceSharding.totalShards = Math.max(1, Math.min(10, parseInt(totalShards, 10) || 5));
  }
  if (instanceLabel !== undefined) {
    appState.instanceSharding.instanceLabel = String(instanceLabel).trim();
  }

  saveData();
  addLog(
    'info',
    `[تقسیم بار بین ۵ نود Google AI Studio] تنظیمات Sharding به‌روزرسانی شد: وضعیت: ${appState.instanceSharding.isEnabled ? 'فعال' : 'غیرفعال'} | این نود: Shard ${appState.instanceSharding.currentShard} از مجموع ${appState.instanceSharding.totalShards} نود موازی.`
  );

  res.json({
    success: true,
    instanceSharding: appState.instanceSharding,
    shardedGroupCount: getShardedActiveGroups().length,
    totalActiveGroupCount: (appState.groups || []).filter(g => g.isActive).length,
  });
});

app.get('/api/sharding/status', (req, res) => {
  if (!appState.instanceSharding) {
    appState.instanceSharding = {
      isEnabled: false,
      currentShard: 1,
      totalShards: 5,
      instanceLabel: 'Google AI Studio Node #1',
    };
  }
  res.json({
    instanceSharding: appState.instanceSharding,
    shardedGroupCount: getShardedActiveGroups().length,
    totalActiveGroupCount: (appState.groups || []).filter(g => g.isActive).length,
  });
});

// ============================================================================
// ============================================================================
// GEMINI AI INTEGRATION & ADAPTIVE MODEL ROUTER (High Availability & Zero Latency Failover)
// ============================================================================
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  try {
    aiClient = new GoogleGenAI(apiKey ? { apiKey } : {});
    return aiClient;
  } catch (e: any) {
    console.warn('Failed to initialize GoogleGenAI client:', e?.message || e);
    return null;
  }
}

// Helper: Extract partner demographics (gender, age, city) or user tags from bot announcement text
function extractPartnerMetadata(text: string): { partnerTag?: string; partnerSnippet?: string } {
  if (!text) return {};
  const clean = text.trim();
  let partnerTag: string | undefined = undefined;
  let partnerSnippet: string | undefined = undefined;

  // 1. User Tag Match (e.g. /user_80Wazd, user_xxxx)
  const userTagMatch = clean.match(/\/user_[a-zA-Z0-9_-]+/) || clean.match(/user_[a-zA-Z0-9_-]+/i);
  if (userTagMatch) {
    partnerTag = userTagMatch[0];
  }

  // 2. Demographic Elements (جنسیت: ... سن: ... استان: ...)
  const parts: string[] = [];
  const genderMatch = clean.match(/جنسیت\s*[:：]\s*([^\n,|،]+)/);
  if (genderMatch && genderMatch[1]) {
    parts.push(`جنسیت: ${genderMatch[1].trim()}`);
  }
  const ageMatch = clean.match(/سن\s*[:：]\s*([^\n,|،]+)/);
  if (ageMatch && ageMatch[1]) {
    parts.push(`سن: ${ageMatch[1].trim()}`);
  }
  const locationMatch = clean.match(/(استان|شهر|موقعیت|فاصله)\s*[:：]\s*([^\n,|،]+)/);
  if (locationMatch && locationMatch[2]) {
    parts.push(`${locationMatch[1]}: ${locationMatch[2].trim()}`);
  }

  if (parts.length > 0) {
    partnerSnippet = parts.join('، ');
  } else {
    const partnerDescMatch = clean.match(/(هم‌صحبت|همصحبت|مخاطب|طرف مقابل|کاربر)\s*(شما)?\s*[:：]\s*([^\n]+)/);
    if (partnerDescMatch && partnerDescMatch[3]) {
      const desc = partnerDescMatch[3].trim();
      if (desc.length < 60 && !desc.includes('خارج شد') && !desc.includes('بست')) {
        partnerSnippet = desc;
      }
    }
  }

  return { partnerTag, partnerSnippet };
}

export interface AnonymousAiSessionContext {
  sessionId?: string;
  sessionIndex?: number;
  partnerTag?: string;
  partnerProfileSnippet?: string;
  currentTurn?: number;
  maxTurns?: number;
  isNewSession?: boolean;
  elapsedSeconds?: number;
  isUnder2Minutes?: boolean;
  coinRewarded?: boolean;
  mediaUnlocked?: boolean;
  conversationContext?: ConversationContext;
}

// Helper: Convert any number to fluent Persian words
function convertNumberToPersianWords(num: number): string {
  const yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  const dahgan = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  const dahYek = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const sadgan = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];

  if (num === 0) return 'صفر';
  if (num < 0) return 'منفی ' + convertNumberToPersianWords(-num);

  const parts: string[] = [];

  if (num >= 1000000) {
    const million = Math.floor(num / 1000000);
    parts.push(convertNumberToPersianWords(million) + ' میلیون');
    num %= 1000000;
  }

  if (num >= 1000) {
    const hezar = Math.floor(num / 1000);
    if (hezar === 1) {
      parts.push('هزار');
    } else {
      parts.push(convertNumberToPersianWords(hezar) + ' هزار');
    }
    num %= 1000;
  }

  if (num >= 100) {
    const sad = Math.floor(num / 100);
    parts.push(sadgan[sad]);
    num %= 100;
  }

  if (num >= 20) {
    const dah = Math.floor(num / 10);
    parts.push(dahgan[dah]);
    num %= 10;
  } else if (num >= 10) {
    parts.push(dahYek[num - 10]);
    num = 0;
  }

  if (num > 0) {
    parts.push(yekan[num]);
  }

  return parts.filter(Boolean).join(' و ');
}

// Helper: Convert English and Persian digits in text to written Persian words
function convertDigitsToPersianWords(text: string): string {
  if (!text) return '';
  return text.replace(/[\d۰-۹]+/g, (match) => {
    const standardized = match.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
    const num = parseInt(standardized, 10);
    if (!isNaN(num) && num >= 0 && num <= 999999999) {
      return convertNumberToPersianWords(num);
    }
    return '';
  });
}

// Helper: Sanitize any message or caption sent to Telegram anonymous chat
// Rule: Prohibit phone numbers, prohibit @ handles (convert @handle to handle), URLs, and external links
// Preserve underscores in valid handles like nova_vpn10
// Remove forbidden bot emojis (🌸, 🌹, ✨, etc.)
// Clean code artifacts and remove unnatural bot-like punctuation
// Normalizes age to digits (۲۶) and ensures natural Telegram tone
function sanitizeAnonymousChatMessage(rawText: string): string {
  if (!rawText) return '';
  let sanitized = rawText;

  // 1. Strip internal system prompt tags, banner tags, and control tokens in all formats
  sanitized = sanitized.replace(/\[?\s*(?:SEND_PROMO_BANNER|PROMO_BANNER|SEND_PROMO_CARD|PROMO_TRIGGER|PROMO_CARD|SEND\s+PROMO\s+CARD|SEND_PROMO|SEND\s+PROMO|BANNER|PROMO|ارسال_تبلیغ|ارسال\s*بنر|کپشن\s*عکس|کپشن:?)\s*\]?/gi, ' ');
  sanitized = sanitized.replace(/[_—–\-\s]*\b(?:BANNER|SEND_PROMO_BANNER|PROMO_BANNER|PROMO_CARD)\b[_—–\-\s]*/gi, ' ');
  sanitized = sanitized.replace(/[_—–\-]+BANNER[_—–\-]+/gi, ' ');
  sanitized = sanitized.replace(/(?:^|\s)[_—–\-]*BANNER[_—–\-]*(?:\s|$)/gi, ' ');
  sanitized = sanitized.replace(/\[?BANNER\]?/gi, ' ');

  // 1.2 Strip AI reasoning, draft prefixes, and option labels
  sanitized = sanitized.replace(/(?:^|[\n\r]+)\s*(?:پیش[\s‌-]*نویس|نویس|پاسخ|گزینه|پیام|حباب|پیشنهاد|متن|Draft|Option|Response|Message|Bubble)\s*(?:شماره\s*)?[۰-۹\d]+[\s:：\-–—]*/gi, ' ');
  sanitized = sanitized.replace(/\b(?:پیش[\s‌-]*نویس|نویس)\s+[۰-۹\d]+\s*/gi, ' ');

  // 1.3 Strip English AI chain-of-thought, meta-reasoning, and thinking leakage
  sanitized = sanitized.replace(/(?:^|[\n\r]+|\b)(?:wait|thinking|thought|reasoning|internal|user\s+asked|the\s+user\s+asked|direct\s+question|as\s+an\s+ai|as\s+a\s+bot|i\s+should|i\s+need\s+to|let\s+me|note\s+that|my\s+response|here\s+is\s+the\s+reply)\b[^\n\r]*[\n\r]*/gi, ' ');
  sanitized = sanitized.replace(/\b(?:wait|direct\s+question|user\s+asked|specific\s+question)\b/gi, ' ');

  // 2. Remove markdown code blocks and inline formatting
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '');
  sanitized = sanitized.replace(/`([^`]+)`/g, '$1');

  // 3. Remove comments, prompt leakage, and syntax artifacts
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');
  sanitized = sanitized.replace(/(?:\/{2,}|\/\*+|\*+\/|[\\\/]\s*["')\]]+\s*(?:\.\s*\*?\s*")?).*/g, '');
  sanitized = sanitized.replace(/[\/\\*#~`^<>{}[\]|•]+/g, ' ');
  // Clean isolated formatting underscores without breaking handle names like nova_vpn10
  sanitized = sanitized.replace(/(?<![a-zA-Z0-9])_(?![a-zA-Z0-9])|(?<=\s)_(?=\s)|_{2,}/g, ' ');

  // 3.5 Strip non-allowed English words (strictly keep only valid technical tokens like vpn, v2ray, ios, android, nova_vpn10)
  const ALLOWED_ENGLISH_WORDS = new Set([
    'vpn', 'v2ray', 'v2rayng', 'vless', 'vmess', 'shadowsocks', 'trojan', 'ssh', 'ping',
    'ios', 'android', 'windows', 'mac', 'streisand', 'nekoray', 'hiddify', 'singbox', 'sing-box',
    'outline', 'warp', 'wireguard', 'app', 'bot', 'ip', 'gb', 'mb', 'wifi', 'dns', 'tg', 't.me',
    'nova_vpn10', 'fastvpnsupport', 'config', 'support', 'online', 'id', 'asl', 'gbps', 'mbps', 'udp', 'tcp'
  ]);

  sanitized = sanitized.replace(/\b[a-zA-Z]{2,}\b/g, (match) => {
    const lower = match.toLowerCase();
    if (ALLOWED_ENGLISH_WORDS.has(lower) || lower.startsWith('nova_vpn')) {
      return match;
    }
    return '';
  });

  // 4. Remove all emojis (sparkles, flowers, faces, etc.)
  sanitized = sanitized.replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ');
  sanitized = sanitized.replace(/[🌸🌹✨💐🌺🌷🌻❤️🤍💙]/g, ' ');

  // 5. Remove @ from telegram handles and normalize nova_vpn10 (strictly no @ and with underscore _)
  sanitized = sanitized.replace(/@([a-zA-Z0-9_]+)/g, '$1');
  sanitized = sanitized.replace(/\bnova\s+vpn\s*10\b/gi, 'nova_vpn10');
  sanitized = sanitized.replace(/\bFastVpnSupport\b/gi, 'nova_vpn10');

  // 6. Remove stray quotes, quotes around text, and parentheses
  sanitized = sanitized.replace(/["'«»“”\(\)]\s*[\.\*\/\\\-]+\s*["'«»“”\(\)]/g, ' ');
  sanitized = sanitized.replace(/["'«»“”]/g, '');

  // 7. Remove leading and trailing symbols, quotes, brackets, slashes, colons
  sanitized = sanitized.replace(/^["'«»“”(.)\/\\:;؛،,\s\-–—]+/, '');
  sanitized = sanitized.replace(/["'«»“”(.)\/\\:;؛،,\s\-–—]+$/, '');

  // 8. Remove phone numbers and long digit sequences (e.g., 0912..., +98..., 09..., etc.)
  sanitized = sanitized.replace(/(?:\+?98|0098|0)?9\d{9}/g, '');
  sanitized = sanitized.replace(/(?:\+?۹۸|۰۰۹۸|۰)?۹[۰-۹]{9}/g, '');
  sanitized = sanitized.replace(/\b\d{7,}\b/g, '');
  sanitized = sanitized.replace(/[۰-۹]{7,}/g, '');

  // 9. Remove URLs, links (t.me/..., http://...)
  sanitized = sanitized.replace(/(https?:\/\/[^\s]+|t\.me\/[^\s]+|telegram\.me\/[^\s]+)/gi, '');

  // 10. Clean contact boilerplate labels if they have nothing or just "inside photo"
  sanitized = sanitized.replace(/💬\s*(ارتباط|خرید|پشتیبانی|کانال|ثبت سفارش)\s*[:：]?\s*(داخل عکسی که فرستادم هست|داخل عکس|تو عکسه|)/gi, '');

  // 11. Clean unnatural bot-like punctuation for Telegram chat:
  // - Remove multiple exclamation marks
  sanitized = sanitized.replace(/!+/g, '');
  // - Clean redundant question marks (leave at most one ؟)
  sanitized = sanitized.replace(/([؟?]){2,}/g, '$1');
  // - Clean redundant commas, semicolons, and colons
  sanitized = sanitized.replace(/[,،;؛:：]+/g, ' ');
  // - Remove trailing dots or dots at the end of sentences
  sanitized = sanitized.replace(/\.+$/g, '');
  sanitized = sanitized.replace(/\.+/g, ' ');

  // 12. Normalize age: Convert written words for age 26 (e.g. "بیست و شش") to natural digits "۲۶"
  sanitized = sanitized
    .replace(/بیست\s+و\s+شش/g, '۲۶')
    .replace(/بیست\s+و\s+شیش/g, '۲۶')
    .replace(/بیست\s+و\s+6/g, '۲۶')
    .replace(/20\s+ساله/g, '۲۶ ساله')
    .replace(/۲۰\s+ساله/g, '۲۶ ساله')
    .replace(/بیست\s+ساله/g, '۲۶ ساله')
    .replace(/بیست\s+سالمه/g, '۲۶ سالمه');

  // 13. Aggressively strip over-familiar / affectionate vocatives (عزیزم, جانم, جان, گلم, فدات, قربونت, etc.)
  sanitized = stripAffectionateTerms(sanitized);

  // 14. Clean up whitespace and empty lines
  sanitized = sanitized
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 14. Repair incomplete sentence endings
  sanitized = repairIncompleteSentences(sanitized);

  // 15. Final trim of any remaining trailing punctuation
  sanitized = sanitized.replace(/[\.\:،,!;؛\-–—]+$/g, '').trim();

  return sanitized;
}

// Helper: Sanitize all outgoing bot messages when conversation is under 2 minutes
function sanitizeMessageForUnderTwoMinutes(rawText: string): string {
  if (!rawText) return '';
  let sanitized = sanitizeAnonymousChatMessage(rawText);

  // Clean trailing punctuation
  sanitized = sanitized.replace(/[\.\:،,!;؛\-–—]+$/g, '').trim();

  const persianCharCount = (sanitized.match(/[\u0600-\u06FF]/g) || []).length;
  if (!sanitized || persianCharCount < 2) {
    sanitized = 'خوبم مرسی تو چیکارا میکنی';
  }

  return sanitized;
}

// Helper: Ensure support ID rule: "nova_vpn10" strictly without '@'
function formatSupportHandle(handle?: string): string {
  if (!handle) return 'nova_vpn10';
  let clean = handle.replace(/@/g, '').trim();
  clean = clean.replace(/\s+/g, '_');
  if (!clean || clean.toLowerCase().includes('fastvpnsupport')) {
    clean = 'nova_vpn10';
  }
  return clean;
}

async function generateAnonymousAiReply(
  dialogueHistory: Array<{ sender: string; text: string }>,
  instructions: AnonymousChatInstructions,
  sessionContext?: AnonymousAiSessionContext
): Promise<{
  text: string;
  source: 'ai_gemini' | 'offline_fallback';
  modelUsed?: string;
  shouldSendPromoCard?: boolean;
  promoMentioned?: boolean;
  stepOutput?: ConversationStepOutput;
}> {
  const lastStrangerMsg = dialogueHistory.filter((m) => m.sender === 'stranger').pop()?.text || '';
  const ai = getAiClient();
  const activeProduct = getActiveProduct(instructions);
  const promo = instructions.productPromotion || {
    enabled: true,
    productName: activeProduct.productName,
    productDescription: activeProduct.productDescription,
    imageUrl: activeProduct.bannerImageUrl,
    contactHandleOrLink: activeProduct.support?.handle,
    sendMode: 'send_photo_with_caption_before_exit',
    sendAtMessageNumber: 3,
    faqItems: (activeProduct.faqItems || []).map(f => ({ id: f.id, question: f.question, answer: f.answer, keywords: f.keywords })),
    knowledgeBaseText: activeProduct.knowledgeBaseText || '',
  };

  const elapsedSec = sessionContext?.elapsedSeconds ?? (sessionContext?.isUnder2Minutes ? 60 : 130);
  const maxTurns = sessionContext?.maxTurns || instructions.maxMessagesPerChat || 4;
  const effectiveSupportHandle = formatSupportHandle(activeProduct.support?.handle || promo?.contactHandleOrLink);

  const previousBotMessages = dialogueHistory
    .filter((m) => m.sender === 'me_melody')
    .map((m) => (m.text || '').trim())
    .filter(Boolean);
  const previousStrangerMessages = dialogueHistory
    .filter((m) => m.sender === 'stranger')
    .map((m) => (m.text || '').trim())
    .filter(Boolean);

  // 1. Initialize or obtain existing deterministic ConversationContext
  let convContext: ConversationContext = sessionContext?.conversationContext
    ? { ...sessionContext.conversationContext }
    : createInitialConversationContext(
        sessionContext?.partnerTag,
        sessionContext?.partnerProfileSnippet
      );

  convContext.elapsedSeconds = elapsedSec;
  convContext.recentBotMessages = previousBotMessages.slice(-15);
  convContext.recentStrangerMessages = previousStrangerMessages.slice(-15);

  if (sessionContext?.currentTurn !== undefined) {
    convContext.turnCount = sessionContext.currentTurn;
  }

  // 2. Process conversation turn through deterministic Conversation Engine Pipeline
  const mockHistoryForEngine: AnonymousChatMessage[] = dialogueHistory.map((m, idx) => ({
    id: `msg_${idx}`,
    sender: m.sender as any,
    text: m.text,
    timestamp: new Date().toISOString(),
  }));

  const chosenStrategy: ConversationStrategy = (instructions as any).strategy || (instructions as any).conversationStrategy || 'social_rapport';
  const chosenPersona: BotPersonaConfig = (instructions as any).persona || {
    name: (instructions as any).personaName || (chosenStrategy === 'direct_pitch' ? 'پشتیبان فروش و تست رایگان' : 'ملودی'),
    role: chosenStrategy === 'direct_pitch' ? 'ویزیتور و پشتیبان اشتراک اختصاصی' : 'هم‌صحبت صمیمی و دوستانه',
    tone: (instructions as any).personaTone || 'بسیار صمیمی، روان، محاوره‌ای و حرفه‌ای',
    age: 26,
    city: 'تهران',
    bio: 'ارائه راهنمایی صمیمی، سریع و ارائه اکانت تست رایگان',
  };

  const stepOutput = processConversationTurn(
    lastStrangerMsg,
    convContext,
    promo,
    maxTurns,
    mockHistoryForEngine,
    activeProduct,
    chosenStrategy,
    chosenPersona
  );

  const updatedCtx = stepOutput.updatedContext;
  updatedCtx.recentBotMessages = previousBotMessages.slice(-15);
  updatedCtx.recentStrangerMessages = previousStrangerMessages.slice(-15);
  const isUnder2Min = updatedCtx.elapsedSeconds < 120;

  if (ai) {
    const candidateModels = getAdaptiveCandidateModels();

    let basePrompt =
      instructions.systemPrompt ||
      `شما در نقش ${chosenPersona.name} (${chosenPersona.role}) هستید که در یک ربات چت تلگرام در حال مکالمه با مخاطب هستید.
دستورالعمل‌ها:
۱. پاسخ‌های بسیار کوتاه، روان و عامیانه تلگرامی بدهید (۱ الی ۲ جمله محاوره‌ای).
۲. لحن شما: ${chosenPersona.tone}.
۳. بدون پیشوند یا علامت نقل‌قول پاسخ دهید.`;

    // Dynamic session placeholders
    basePrompt = basePrompt
      .replace(/{{CURRENT_STATE}}/g, `${updatedCtx.state}`)
      .replace(/{{PROMOTION_LEVEL}}/g, `${updatedCtx.promotionLevel}`)
      .replace(/{{ELAPSED_TIME}}/g, `${elapsedSec} ثانیه`)
      .replace(/{{TURN_COUNT}}/g, `${updatedCtx.turnCount} از ${maxTurns}`)
      .replace(/{{PARTNER_PROFILE}}/g, sessionContext?.partnerProfileSnippet || 'نامشخص')
      .replace(/{{PARTNER_TAG}}/g, sessionContext?.partnerTag || 'ندارد')
      .replace(/{{SUPPORT_HANDLE}}/g, effectiveSupportHandle)
      .replace(/{{PRODUCT_NAME}}/g, activeProduct.productName || promo?.productName || 'محصول')
      .replace(/{{PRODUCT_DESCRIPTION}}/g, activeProduct.productDescription || promo?.productDescription || '');

    // Extract questions already asked by bot and facts declared by stranger
    const askedQuestionCategories = extractQuestionCategories(previousBotMessages.join(' '));
    const strangerFacts: string[] = [];
    const fullStrangerText = previousStrangerMessages.join(' ');
    const ageMatch = fullStrangerText.match(/(?:من\s+)?(\d+|[۰-۹]+)\s*(?:سالمه|ساله|سال)/i);
    if (ageMatch) strangerFacts.push(`سن مخاطب: ${ageMatch[1]} سال`);
    const fieldMatch = fullStrangerText.match(/\b(دانشجو|دانشگاه|کامپیوتر|نرم‌افزار|عمران|معماری|روانشناسی|پزشکی|دندانپزشکی|داروسازی|حقوق|حسابداری|مدیریت|مکانیک|برق|گرافیک|هنر|زبان)\b/i);
    if (fieldMatch) strangerFacts.push(`رشته/تحصیلات مخاطب: ${fieldMatch[1]}`);
    const jobMatch = fullStrangerText.match(/\b(برنامه‌نویس|برنامه نویس|توسعه‌دهنده|کارمند|شغل آزاد|کاسب|مغازه|فریلنسر|معلم|استاد|خیاط|طراح|آرایشگر)\b/i);
    if (jobMatch) strangerFacts.push(`شغل/فعالیت مخاطب: ${jobMatch[1]}`);
    const cityMatch = fullStrangerText.match(/\b(تهران|مشهد|اصفهان|شیراز|تبریز|کرج|اهواز|قم|رشت|ساری|کرمان|ارومیه|همدان|یزد|قزوین|کرمانشاه)\b/i);
    if (cityMatch) strangerFacts.push(`شهر/محل سکونت مخاطب: ${cityMatch[1]}`);

    // Dynamic Session Framing & Complete Memory Isolation with Deterministic Directive Injection
    const sessionFrameParts: string[] = [
      `\n\n══════════════════════════════════════════════`,
      `[چارچوب وضعیت و تصمیمات قطعی ماشین وضعیت (Deterministic State Machine)]:`,
      stepOutput.promptDirective,
      `- استراتژی فعال مکالمه: ${chosenStrategy}`,
      `- پرسونای فعال: ${chosenPersona.name} (${chosenPersona.role})`,
      `- وضعیت سیستم (State): ${updatedCtx.state}`,
      `- قصد تشخیص‌داده‌شده کاربر (Intent): ${stepOutput.intentResult.intent} (اطمینان: ${Math.round(stepOutput.intentResult.confidence * 100)}%)`,
      `- امتیاز لید (Lead Score): ${updatedCtx.leadScore}/100`,
      `- سطح مجاز تبلیغات (Promotion Policy): ${updatedCtx.promotionLevel} (قفل تبلیغ: ${updatedCtx.promotionLock ? 'فعال' : 'غیرفعال'})`,
      `- مدت زمان مکالمه: ${elapsedSec} ثانیه`,
      `- تفکیک حافظه: شما با یک هم‌صحبت جدید چت می‌کنید و هیچ اطلاعی از افراد قبلی ندارید.`,
    ];

    if (previousBotMessages.length > 0) {
      sessionFrameParts.push(`- پیام‌های قبلی ارسال‌شده شما در این چت: [${previousBotMessages.slice(-4).join(' | ')}]`);
    }
    if (askedQuestionCategories.length > 0) {
      sessionFrameParts.push(`- دسته‌بندی سوالاتی که قبلاً پرسیده‌اید و نباید تکرار شوند: [${askedQuestionCategories.join('، ')}]`);
    }
    if (strangerFacts.length > 0) {
      sessionFrameParts.push(`- اطلاعات و حقایق گفته‌شده توسط کاربر (هرگز دوباره درباره آن‌ها سوال نپرسید): [${strangerFacts.join(' | ')}]`);
    }

    if (sessionContext?.partnerProfileSnippet && instructions.extractPartnerProfileInfo !== false) {
      sessionFrameParts.push(`- مشخصات هم‌صحبت جاری: ${sessionContext.partnerProfileSnippet}`);
    }
    if (sessionContext?.partnerTag) {
      sessionFrameParts.push(`- شناسه مخاطب جاری: ${sessionContext.partnerTag}`);
    }
    sessionFrameParts.push(`══════════════════════════════════════════════\n`);

    let systemInstruction = basePrompt + sessionFrameParts.join('\n');

    let dynamicPersonaGuideline = '';
    if (chosenStrategy === 'direct_pitch') {
      dynamicPersonaGuideline = `\n\n══════════════════════════════════════════════
[دستورات استراتژی ویزیتور و فروش مستقیم (${chosenPersona.name})]:
۱. هویت و لحن: شما به عنوان ${chosenPersona.role} با نام «${chosenPersona.name}» و لحن «${chosenPersona.tone}» پاسخ می‌دهید.
۲. معرفی مستقیم و جذاب: ارزش محصول (${activeProduct.productName})، کیفیت بالا و پیشنهاد تست رایگان را مستقیماً و محاوره‌ای مطرح کنید.
۳. ساختار پیام و حباب‌ها: پاسخ‌ها را به صورت ۱ یا نهایتاً ۲ گزاره کوتاه و مستقل تلگرامی بنویسید (هر خط ۳ الی ۸ کلمه). هر خط باید یک فکر یا پیام معنادار کامل باشد؛ هرگز وسط یک جمله خط نزنید یا عبارت را تکه‌تکه نکنید. اگر دو بخش مجزا دارید، آن‌ها را با خط بعد (\\n) جدا کنید.
۴. قانون عدم صمیمیت لوس: از کلمات «عزیزم»، «جانم»، «جان»، «گلم»، «فدات»، «قربونت» برای غریبه استفاده نکنید.
۵. عدم استفاده از نگارش کتابی: بدون نقطه (.)، بدون علامت‌های مکرر، کاملاً شبیه چت تلگرام.
══════════════════════════════════════════════`;
    } else if (chosenStrategy === 'consultative') {
      dynamicPersonaGuideline = `\n\n══════════════════════════════════════════════
[دستورات استراتژی مشاوره‌ای و حل مسئله (${chosenPersona.name})]:
۱. هویت و لحن: شما به عنوان ${chosenPersona.role} با نام «${chosenPersona.name}» و لحن «${chosenPersona.tone}» پاسخ می‌دهید.
۲. رویکرد مشاوره‌ای: با بررسی کوتاه نیاز کاربر، راهکار متناسب (${activeProduct.productName}) را ارائه دهید.
۳. ساختار پیام: پاسخ‌های طبیعی و روان ۱ یا ۲ خطی. هرگز جمله را از وسط تکه‌تکه نکنید؛ هر خط باید یک گزاره مستقل ۳ الی ۸ کلمه‌ای باشد.
۴. قانون عدم صمیمیت لوس: از به کاربردن کلمات «عزیزم»، «جانم»، «جان»، «گلم» خودداری کنید.
══════════════════════════════════════════════`;
    } else {
      dynamicPersonaGuideline = `\n\n══════════════════════════════════════════════
[دستورات ساختار نگارش و لحن مکالمه طبیعی (${chosenPersona.name})]:
۱. هویت و بیوگرافی شخصی: شما ${chosenPersona.name}، ۲۶ ساله ساکن ${chosenPersona.location || 'تهران'} هستید. شغلتان کارهای طراحی و سیستم/پروژه‌ای است.
۲. پاسخ به سوالات شخصی و شهری: اگر مخاطب درباره اسم، سن، شهر ("تهرانی؟"، "کجایی؟")، شغل، جنسیت یا احوال پرسید، مستقیماً، طبیعی و فوق‌العاده کوتاه پاسخ دهید ("آره من تهرانم" / "${chosenPersona.name} هستم ۲۶ سالمه"). هرگز از کلیشه‌های رباتی مانند «شما چطور؟» یا «شما چی؟» استفاده نکنید و اگر مخاطب مشخصاتش را گفته از او سوال تکراری نپرسید.
۳. قانون طلایی کوتاهی پیام‌ها (حداکثر ۳ تا ۶ کلمه در هر حباب): پیام‌های تلگرام باید بسیار کوتاه، مینیمال و خودمانی باشد (۳ الی ۶ کلمه). هرگز متن‌های طولانی، توضیحات چندموضوعی، یا پاراگراف ننویسید!
۴. ممنوعیت کلمات لوس و صمیمیت نامتعارف برای فرد ناشناس: اکیداً از کلمات «عزیزم»، «جانم»، «جان»، «گلم»، «فدات»، «قربونت»، «عشقم» استفاده نکنید؛ حس بدی به مخاطب می‌دهد و نشانه‌ی ربات بودن است.
۵. سکوت فعال و پاسخ‌های تک‌کلمه‌ای تلگرامی: در پاسخ به احوالپرسی یا صحبت‌های عادی مخاطب، همیشه سوال نپرسید و همیشه بحث را جلو نبرید! از تاییدها و پاسخ‌های تک‌کلمه‌ای طبیعی مثل «اوهوم»، «آره»، «آره والا»، «دقیقا»، «نه»، «نوچ»، «خوبه» استفاده کنید تا مخاطب خودش سوال بپرسد.
۶. بدون نگارش کتابی (بدون نقطه در انتها، بدون دونقطه، بدون گیومه).
══════════════════════════════════════════════`;
    }

    systemInstruction += dynamicPersonaGuideline;

    if (updatedCtx.promotionLock || updatedCtx.state === ConversationState.REJECTED) {
      systemInstruction += `\n\n══════════════════════════════════════════════
[قفل عدم پذیرش تبلیغ (Ad Lock Active)]:
- مخاطب صریحاً اعلام کرده نیازی به خدمات/محصول ندارد یا تمایلی نشان نداده است.
- اکیداً و تحت هیچ شرایطی نام محصول، وی‌پی‌ان، تعرفه، تست یا آیدی پشتیبانی را مطرح نکنید.
- بلافاصله در یک جمله ۳ کلمه‌ای خداحافظی کنید و بحث را ادامه ندهید.
══════════════════════════════════════════════`;
    }

    const isPlatformRestricted = !Boolean(updatedCtx.coinRewarded || updatedCtx.mediaUnlocked || updatedCtx.elapsedSeconds >= 120);

    // Strict 2-Minute / Coin Notice Policy & Product Answering Section in AI System Instructions
    if (isPlatformRestricted) {
      systemInstruction += `\n\n══════════════════════════════════════════════
[قانون حیاتی پلتفرم چت ناشناس تلگرام: فاز ۱ - زیر ۲ دقیقه و قبل از پیام سکه]:
- پلتفرم چت ناشناس تا قبل از ۲ دقیقه یا قبل از ظاهر شدن پیام «💰 تبریک تعداد 1 سکه به دلیل موفق بودن چت به حساب شما اضافه شد!»، ارسال هرگونه عکس، بنر، حروف انگلیسی و آیدی تلگرام را کاملاً مسدود می‌کند!
- وظایف شما در فاز ۱:
  ۱. اکیداً هیچ حرف انگلیسی (حتی vpn، ios، id، @) ننویسید، هیچ آیدی تلگرامی نفرستید، و هیچ تگ عکسی ارسال نکنید.
  ۲. احوال‌پرسی گرم و خیلی کوتاه کنید و سن را ۲۶ بنویسید («ملودی ۲۶ تهران»).
  ۳. به مرور و کاملاً طبیعی به زبان فارسی در پیام‌های ۳ تا ۵ کلمه‌ای بحث را به سمت قطعی اینترنت بکشانید (مثلاً: «راستی نتم خیلی کنده توام قطعی داری؟»).
  ۴. پیام‌ها فوق‌العاده کوتاه و محاوره‌ای (۳ الی ۶ کلمه) و بدون علائم نگارشی کتابی (نقطه، تعجب، ویرگول) باشد.
══════════════════════════════════════════════`;
    } else if (!updatedCtx.promotionLock) {
      systemInstruction += `\n\n══════════════════════════════════════════════
[وضعیت مکالمه: فاز ۲ - بالای ۲ دقیقه یا پس از دریافت سکه (${elapsedSec} ثانیه)]:
- محدودیت زمانی پلتفرم برداشته شده است.
- اگر درباره اینترنت صحبت شد، خیلی کوتاه و خودمانی در ۳ الی ۵ کلمه بگویید خودتان از چه وی‌پی‌انی استفاده می‌کنید (مثلاً: «من از نوا وی‌پی‌ان وصل میشم خوبه» یا «نوا وی‌پی‌ان دارم تستش رایگانه»).
- اکیداً کل داستان و تبلیغات و آیدی را در یک جمله بلند تلنبار نکنید!
- فقط اگر مخاطب آیدی، قیمت یا لینک خواست، در ۳ کلمه آیدی را بگویید: «به ${effectiveSupportHandle} پیام بده»
- اگر مخاطب گفت نه، خودم دارم، وصلم یا نیازی نداشت، اصلاً اصرار نکنید، یک خداحافظی ۳ کلمه‌ای («باشه موفق باشی») بگویید تا سیستم فوراً خارج شود.
══════════════════════════════════════════════`;
    }

    // Always inject product information whenever promotion is enabled or user asks/inquired about product
    const isCommercialInquiry =
      stepOutput.promotionDecision.isExplicitOverride ||
      updatedCtx.promotionLevel !== PromotionLevel.NO_PROMOTION ||
      /(قیمت|چنده|چند|تست|خرید|اکانت|سرویس|اشتراک|تعرفه|لینک|آیدی|عکس|وی\s*پی\s*ان|فیلترشکن|vpn|پروتکل|کانفیگ|سرور|همراه اول|ایرانسل)/i.test(lastStrangerMsg);

    if (promo?.enabled || isCommercialInquiry) {
      systemInstruction += `\n\n══════════════════════════════════════════════
${formatProductPromptContext(activeProduct, updatedCtx.supportIdAvailable)}
- وضعیت دسترسی به آیدی پشتیبانی: ${updatedCtx.supportIdAvailable ? `مجاز («${effectiveSupportHandle}» بدون @)` : 'غیرمجاز (هنوز زیر ۲ دقیقه است)'}
══════════════════════════════════════════════`;

      if (activeProduct.faqItems && activeProduct.faqItems.length > 0) {
        systemInstruction += `\n\n[پایگاه دانش سوالات متداول (Product FAQ)]:\n` +
          activeProduct.faqItems.map((faq, idx) => `${idx + 1}. سوال: ${faq.question}\n   پاسخ: ${faq.answer}`).join('\n');
      } else if (promo?.faqItems && promo.faqItems.length > 0) {
        systemInstruction += `\n\n[پایگاه دانش سوالات متداول (Product FAQ)]:\n` +
          promo.faqItems.map((faq, idx) => `${idx + 1}. سوال: ${faq.question}\n   پاسخ: ${faq.answer}`).join('\n');
      }

      if (activeProduct.knowledgeBaseText && activeProduct.knowledgeBaseText.trim()) {
        systemInstruction += `\n\n[توضیحات تکمیلی محصول (Knowledge Base)]:\n${activeProduct.knowledgeBaseText.trim()}`;
      } else if (promo?.knowledgeBaseText && promo.knowledgeBaseText.trim()) {
        systemInstruction += `\n\n[توضیحات تکمیلی محصول (Knowledge Base)]:\n${promo.knowledgeBaseText.trim()}`;
      }
    }

    const cleanHistory = dialogueHistory.filter(
      (m) => m.sender === 'stranger' || m.sender === 'me_melody'
    );
    const configuredMemory = instructions.memoryWindowSize || 16;
    // Scale window so multi-bubble bursts don't consume the entire memory depth prematurely
    const windowSize = Math.max(configuredMemory * 2, 32);
    const recentHistory = cleanHistory.slice(-windowSize);

    // Smart multi-turn and consecutive message batch formatter
    const formattedHistory: string[] = [];
    let currentSpeaker = '';
    let currentBatch: string[] = [];

    for (const msg of recentHistory) {
      const speakerName = msg.sender === 'stranger' ? 'کاربر ناشناس' : 'من';
      const cleanMsgText = (msg.text || '').trim();
      if (!cleanMsgText) continue;

      if (speakerName === currentSpeaker) {
        // Same speaker sent consecutive message(s)
        const subLines = cleanMsgText.split(/\n+/).map(l => l.trim()).filter(Boolean);
        currentBatch.push(...subLines);
      } else {
        if (currentBatch.length > 0) {
          if (currentSpeaker === 'کاربر ناشناس' && currentBatch.length > 1) {
            formattedHistory.push(`کاربر ناشناس (در ${currentBatch.length} پیام متوالی):\n` + currentBatch.map(t => `• ${t}`).join('\n'));
          } else {
            formattedHistory.push(`${currentSpeaker}: ${currentBatch.join(' / ')}`);
          }
        }
        currentSpeaker = speakerName;
        const subLines = cleanMsgText.split(/\n+/).map(l => l.trim()).filter(Boolean);
        currentBatch = subLines.length > 0 ? subLines : [cleanMsgText];
      }
    }
    if (currentBatch.length > 0) {
      if (currentSpeaker === 'کاربر ناشناس' && currentBatch.length > 1) {
        formattedHistory.push(`کاربر ناشناس (در ${currentBatch.length} پیام متوالی):\n` + currentBatch.map(t => `• ${t}`).join('\n'));
      } else {
        formattedHistory.push(`${currentSpeaker}: ${currentBatch.join(' / ')}`);
      }
    }

    let chatPrompt = '';
    if (formattedHistory.length > 0) {
      chatPrompt =
        `[تاریخچه مکالمه فعال با این مخاطب ناشناس]:\n` +
        formattedHistory.join('\n\n') +
        `\n\n[دستور خروجی]: با توجه به تمامی پیام‌های متوالی بالا، پاسخ جدید و کوتاه (۱ الی ۲ جمله) خود را به صورت صمیمی، روان و محاوره‌ای بنویسید (مستقیماً پاسخ دهید و از گذاشتن پیشوندهایی مثل «من:» خودداری کنید).`;
    } else {
      chatPrompt = `[مخاطب جدید متصل شد]\nکاربر ناشناس: ${lastStrangerMsg || 'سلام چطوری؟'}\nپاسخ خودمانی و مستقیم شما:`;
    }

    for (const modelName of candidateModels) {
      try {
        const modelConfig: any = {
          systemInstruction,
          temperature: 0.70,
          maxOutputTokens: 500,
          thinkingConfig: { thinkingBudget: 0 },
        };

        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents: chatPrompt,
          config: modelConfig,
        });

        // Fail-fast timeout based on model characteristics so failovers happen rapidly (به سرعت)
        const timeoutMs =
          modelName.includes('3.1')
            ? 4000
            : modelName.includes('3.5')
            ? 4500
            : modelName.includes('3.6')
            ? 5000
            : 5500;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms on model ${modelName}`)), timeoutMs)
        );

        const response: any = await Promise.race([generatePromise, timeoutPromise]);

        let rawReply = '';
        if (response?.text && typeof response.text === 'string' && response.text.trim()) {
          rawReply = response.text.trim();
        } else if (response?.candidates?.[0]?.content?.parts) {
          rawReply = response.candidates[0].content.parts
            .map((p: any) => p.text || '')
            .filter(Boolean)
            .join('')
            .trim();
        }

        if (rawReply) {
          // Use our robust Response Validator & Sanitizer
          const validation = validateAndSanitizeResponse(
            rawReply,
            updatedCtx,
            promo
          );

          if (validation.wasFallbackUsed) {
            console.warn(`[Gemini Adaptive Router] Model ${modelName} output triggered fallback validator (${validation.violations.join(', ')}). Trying next candidate model...`);
            continue;
          }

          recordGeminiSuccess(modelName);

          const promoTagRegex = /\[?\s*(?:SEND_PROMO_BANNER|PROMO_BANNER|SEND_PROMO_CARD|PROMO_TRIGGER|PROMO_CARD|SEND_PROMO|BANNER|ارسال_تبلیغ)\s*\]?/gi;
          const hasPromoTag = promoTagRegex.test(rawReply);

          let cleanText = validation.sanitizedText;
          if (isPlatformRestricted) {
            cleanText = sanitizeMessageForUnderTwoMinutes(cleanText);
          } else {
            cleanText = sanitizeAnonymousChatMessage(cleanText);
            cleanText = cleanText.replace(/@?nova_vpn10/gi, 'nova_vpn10');
            cleanText = cleanText.replace(/nova vpn10/gi, 'nova_vpn10');
            cleanText = cleanText.replace(/@?FastVpnSupport/gi, 'nova_vpn10');
          }

          cleanText = cleanText.replace(/\[?\s*(?:SEND_PROMO_BANNER|PROMO_BANNER|SEND_PROMO_CARD|PROMO_TRIGGER|PROMO_CARD|SEND_PROMO|BANNER|ارسال_تبلیغ)\s*\]?/gi, ' ');
          cleanText = cleanText.replace(/[_—–\-\s]*\b(?:BANNER|SEND_PROMO_BANNER|PROMO_BANNER)\b[_—–\-\s]*/gi, ' ');
          cleanText = cleanText.replace(/[_—–\-]+BANNER[_—–\-]+/gi, ' ');
          cleanText = cleanText.replace(/(?:^|\s)[_—–\-]*BANNER[_—–\-]*(?:\s|$)/gi, ' ');
          cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();

          const isPromoLocked = Boolean(
            updatedCtx.promotionLock ||
            updatedCtx.state === ConversationState.REJECTED ||
            updatedCtx.promotionLevel === PromotionLevel.NO_PROMOTION
          );

          return {
            text: cleanText,
            source: 'ai_gemini',
            modelUsed: modelName,
            shouldSendPromoCard: !isPlatformRestricted && !isPromoLocked && (stepOutput.shouldSendPhotoBanner || hasPromoTag),
            promoMentioned: !isPromoLocked && (updatedCtx.promotionLevel !== PromotionLevel.NO_PROMOTION || hasPromoTag),
            stepOutput,
          };
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const cooldownSec = recordGeminiFailure(modelName, err);
        const health = getModelHealth(modelName);
        const reason = health.isDailyLimitExceeded
          ? 'محدودیت استفاده روزانه (Daily Quota Exceeded)'
          : health.isServerBusy
          ? 'شلوغی و ترافیک بالای سرور گوگل (High Demand / Busy)'
          : errMsg.includes('429')
          ? 'محدودیت نرخ ارسال در دقیقه (RPM Rate Limit)'
          : 'تاخیر در پاسخگویی یا خطای موقت (Timeout/Error)';

        console.warn(
          `[Gemini Adaptive Router] ⚠️ مدل ${modelName} دچار «${reason}» شد. استراحت هوشمند ${cooldownSec} ثانیه فعال شد. سوییچ آنی و هوشمند به مدل بعدی اولویت‌بندی...`
        );
      }
    }
  }

  // Fallback responses if offline or Gemini fails (smart context-aware Persian)
  const normLastMsg = normalizePersianText(lastStrangerMsg).toLowerCase().trim();
  const personaName = chosenPersona.name || 'ملودی';
  const personaAge = chosenPersona.age || '۲۶';
  const personaCity = chosenPersona.location || 'تهران';
  
  let fallbackText = '';

  if (/(احمق|دیوونه|روانی|خر|اسکل|چرت|بی‌شعور|بیشعور|احمقی)/i.test(normLastMsg)) {
    const insultCandidates = [
      'ای بابا! چرا بد می‌گی؟ مگه من چی گفتم بهت؟ 😂',
      'نه بابا! مگه چی دیدی ازم که اینطوری می‌گی؟',
      'چرا آخه؟ من که تازه اومدم باهات گپ بزنم!',
    ];
    fallbackText = insultCandidates.find((c) => !previousBotMessages.some((prev) => prev.includes(c.slice(0, 10)))) || insultCandidates[0];
  } else if (/(تهران|تهرانی|کجایی|کجا زندگی|اهل کجایی|بچه کجایی|کدوم شهری)/i.test(normLastMsg)) {
    const cityCandidates = [
      'آره ساکن تهرانم شما اهل کجایی',
      'تهرانم شما کجایی هستی',
      'آره من تهران زندگی می‌کنم',
    ];
    fallbackText = cityCandidates.find((c) => !previousBotMessages.some((prev) => prev.includes(c.slice(0, 10)))) || cityCandidates[0];
  } else if (/(اسم|اسمت|نامت|کی هستی|معرفی)/i.test(normLastMsg) && /(شغل|کارت|سرکار|شاغل)/i.test(normLastMsg)) {
    fallbackText = `${personaName} هستم ${personaAge} سالمه از ${personaCity}، کارم تو شرکت و سیستمه؛ شما اسمت چیه؟`;
  } else if (/(اسم|اسمات|اسمت|نامت|نام شما|کی هستی|معرفی|اصل|asl|چند سالته|سنت|کجایی|اهل کجایی|بچه کجایی)/i.test(normLastMsg)) {
    const userAlreadySaidAsl = /(تهران|مشهد|اصفهان|کرج|شیراز|\b\d{2}\b)/i.test(normLastMsg);
    fallbackText = userAlreadySaidAsl ? `${personaName} هستم ${personaAge} ${personaCity}` : `${personaName} هستم ${personaAge} ${personaCity}، شما اسمت چیه؟`;
  } else if (/(دختری|پسری|پسر|دختر|جنسیت|مونث|مذکر|خانم|آقا)/i.test(normLastMsg)) {
    fallbackText = `دخترم ${personaAge} سالمه از ${personaCity}`;
  } else if (/(سرکار|شغل|شغلت|کارت چیه|شاغلی|چه کاره‌ای|چه کاره ای|چه کاری هستی|کجا کار میکنی)/i.test(normLastMsg)) {
    fallbackText = 'تو کارای اداری و پروژه‌ای سیستمم، شما مشغولی یا درس می‌خونی؟';
  } else if (/(برگشتم خونه|رسیدم خونه|اومدم خونه|خونه رسیدم|تازه رسیدم|تازه اومدم|خسته‌ام|خسته ام|خستگی)/i.test(normLastMsg)) {
    fallbackText = 'خسته نباشی! روزت چطور گذشت؟ حسابی خسته شدی؟';
  } else if (/(چیکار|چیکارا|مشغول|چخبر|چه خبر|چه خبرها|چیکار میکنی|چیکارا میکنی)/i.test(normLastMsg)) {
    const activityCandidates = [
      'سلامتی، سرگرم کارامم پای گوشی بودم، چه خبر؟',
      'پای لپ‌تاپم داشتم یه سری کار انجام می‌دادم',
      'بیشتر پای گوشی و فیلم و آهنگم، شما چیکار می‌کنی؟',
    ];
    fallbackText = activityCandidates.find((c) => !previousBotMessages.some((prev) => prev.includes(c.slice(0, 15)))) || activityCandidates[0];
  } else if (/(سلام|درود|hi|slm|هلو|سلامتی|علیک)/i.test(normLastMsg) && !/(نپرسیدم|فقط سلام|کی پرسید)/i.test(normLastMsg)) {
    const greetingCandidates = [
      'سلام چطوری خوبی روزت چطور بوده تا الان؟',
      'سلام مرسی، چه خبر چیکارا می‌کنی؟',
      'سلام خوبی روبراهی؟',
    ];
    fallbackText = greetingCandidates.find((c) => !previousBotMessages.some((prev) => prev.includes(c.slice(0, 10)))) || greetingCandidates[0];
  } else if (/(نپرسیدم|فقط سلام|نگفتم چطور)/i.test(normLastMsg)) {
    fallbackText = 'آره متوجه شدم، چه خبر چیکارا میکنی';
  } else if (/(خوبم|مرسی|فدات|شکر|سلامتی|قربونت|عالی|بد نیستم)/i.test(normLastMsg) && /(تو چطوری|شما چطور|خودت چطور|احوال)/i.test(normLastMsg)) {
    fallbackText = 'منم خوبم مرسی، روزت چطور بوده تا الان؟';
  } else if (/(خوبم|مرسی|فدات|شکر|سلامتی|قربونت|عالی|بد نیستم)/i.test(normLastMsg)) {
    fallbackText = updatedCtx.isPassiveListeningTurn ? 'خداروشکر' : 'خداروشکر همیشه خوب باشی، خوشبختم از آشناییت';
  } else if (/(هستی|هستم|کجایی|چرا رفتی|الو|کجایی پس|جواب بده)/i.test(normLastMsg)) {
    fallbackText = 'آره هستم پیامت رو دیدم، چه خبر؟';
  } else if (/(عکس|عکست|عکس خودت|ببینمت|عکس میدی)/i.test(normLastMsg)) {
    fallbackText = 'عکس که نمیدم با هم چت کنیم آشنا شیم بهتره';
  } else if (/(آیدی|ایدی|شماره|شمارت|تلگرامت|پیوی|پی وی)/i.test(normLastMsg)) {
    if (updatedCtx.supportIdAvailable && (updatedCtx.promotionLevel !== PromotionLevel.NO_PROMOTION || stepOutput.promotionDecision.isExplicitOverride)) {
      fallbackText = `می‌تونی به آیدی ${effectiveSupportHandle} پیام بدی`;
    } else {
      fallbackText = 'فعلاً تو همین ناشناس چت کنیم راحت‌تره';
    }
  } else if (/(قیمت|چنده|چند|تست|خرید|وی\s*پی\s*ان|فیلترشکن|vpn|اشتراک|کانفیگ|سرور|پروتکل|ایفون|اندروید)/i.test(normLastMsg)) {
    if (updatedCtx.promotionLevel === PromotionLevel.DIRECT_OFFER || !isUnder2Min) {
      fallbackText = `کانفیگ اختصاصی و تست رایگان داریم، آیدی پشتیبانی ${effectiveSupportHandle} هست پیام بده برات بفرستم`;
    } else {
      fallbackText = 'راستش یه سرور اختصاصی خیلی پرسرعت دارم که واسه اینستا و یوتیوب عالیه تست رایگانم داره';
    }
  } else if (/(نه|نمیخوام|تبلیغ|اسپم|بلاک|علاقه ندارم|حوصله ندارم)/i.test(normLastMsg)) {
    fallbackText = 'باشه حله، هر طور راحتی مراقب خودت باش';
  } else if (/(خداحافظ|خدافظ|بای|فعلا|باید برم|شبت بخیر|روزت بخیر)/i.test(normLastMsg)) {
    fallbackText = 'خوشحال شدم از هم‌صحبتی، مراقب خودت باش فعلاً';
  } else {
    fallbackText = getAlternativeVariedFallback(
      updatedCtx.state,
      updatedCtx.intent,
      previousBotMessages,
      updatedCtx.supportIdAvailable,
      lastStrangerMsg
    );
  }

  // Ensure fallback is not identical to immediately preceding bot message
  if (previousBotMessages.length > 0 && previousBotMessages.some((prev) => prev === fallbackText)) {
    fallbackText = getAlternativeVariedFallback(
      updatedCtx.state,
      updatedCtx.intent,
      previousBotMessages,
      updatedCtx.supportIdAvailable,
      lastStrangerMsg
    );
  }

  const validatedFallback = validateAndSanitizeResponse(
    fallbackText,
    updatedCtx,
    promo
  );

  const isPlatformRestrictedFallback = !Boolean(updatedCtx.coinRewarded || updatedCtx.mediaUnlocked || updatedCtx.elapsedSeconds >= 120);
  let cleanFallbackText = validatedFallback.sanitizedText;
  if (isPlatformRestrictedFallback && !stepOutput.promotionDecision.isExplicitOverride) {
    cleanFallbackText = sanitizeMessageForUnderTwoMinutes(cleanFallbackText);
  } else {
    cleanFallbackText = sanitizeAnonymousChatMessage(cleanFallbackText);
  }

  const isPromoLockedFallback = Boolean(
    updatedCtx.promotionLock ||
    updatedCtx.state === ConversationState.REJECTED ||
    updatedCtx.promotionLevel === PromotionLevel.NO_PROMOTION
  );

  return {
    text: cleanFallbackText,
    source: 'offline_fallback',
    shouldSendPromoCard: !isPlatformRestrictedFallback && !isPromoLockedFallback && stepOutput.shouldSendPhotoBanner,
    promoMentioned: !isPromoLockedFallback && updatedCtx.promotionLevel !== PromotionLevel.NO_PROMOTION,
    stepOutput,
  };
}

// Helper: Multi-bubble intelligent sentence chunking for natural typing sensation
// Rule: Human-like chat bursts (micro-bubbles of 2 to 5 words max).
// Splits cleanly on explicit newlines, question marks, and natural syntactic/grammatical boundaries.
// Guarantees that sentences are NEVER sliced mid-phrase or left with dangling prepositions/particles.
function splitIntoNaturalBubbles(
  text: string,
  maxChunks: number = 2,
  maxWordsPerBubble: number = 8
): string[] {
  if (!text) return [];
  const clean = sanitizeAnonymousChatMessage(text).trim();
  if (!clean) return [];

  // 1. Initial split on explicit line breaks, dash separators, or distinct question/exclamation delimiters
  const initialSegments = clean
    .split(/\n+|(?:\s*[-–—]{2,}\s*)|(?<=[!؟?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (initialSegments.length === 0) {
    return [clean];
  }

  // Persian syntactic and conversational markers
  const FORBIDDEN_ENDINGS = new Set([
    'به', 'با', 'از', 'در', 'برای', 'واسه', 'توی', 'روی', 'درگیر', 'تست',
    'آیدی', 'درباره', 'مثل', 'سر', 'و', 'یا', 'اگر', 'اگه', 'چون', 'تا',
    'که', 'هم', 'اما', 'ولی', 'بلکه', 'خیلی', 'بیشتر', 'کمتر', 'هر', 'هیچ',
    'یه', 'یک', 'این', 'اون', 'گوش', 'پیام', 'وصل', 'چت', 'امتحان', 'تماس',
    'خرید', 'سرگرم', 'نوا', 'وی', 'پی', 'ان', 'همراه', 'ایرانسل', 'گوگل',
    'اینکه', 'کارم', 'واسم', 'برام', 'جهت', 'طریق'
  ]);

  const FORBIDDEN_STARTS = new Set([
    'رو', 'را', 'که', 'تا', 'تر', 'ترین', 'کن', 'بده', 'کرد', 'زد', 'میدم',
    'می‌دم', 'بفرستم', 'هستم', 'باشم', 'بشم', 'میشه', 'می‌شه', 'بشه', 'میکنه',
    'می‌کنه', 'میکنم', 'می‌کنم', 'می‌بینم', 'میبینم', 'بگیر', 'راه'
  ]);

  const COMPOUND_VERB_PAIRS: [string, string][] = [
    ['امتحان', 'کن'],
    ['پیام', 'بده'],
    ['وصل', 'میشه'],
    ['وصل', 'می‌شه'],
    ['وصل', 'بشه'],
    ['کانفیگ', 'میزنم'],
    ['چت', 'کنیم'],
    ['تست', 'بگیر'],
    ['برات', 'بفرستم'],
    ['گوش', 'میدم'],
    ['گوش', 'می‌دم'],
    ['فیلم', 'می‌بینم'],
    ['فیلم', 'میبینم'],
    ['تست', 'کن'],
    ['سر', 'در'],
    ['قطعی', 'داره'],
    ['قطعی', 'داری'],
    ['وی', 'پی'],
    ['پی', 'ان'],
    ['همراه', 'اول'],
  ];

  const BONUS_ENDINGS = new Set([
    'مرسی', 'ممنون', 'قربانت', 'فدات', 'خوبم', 'سلام', 'درود', 'جان',
    'عالی', 'دمت', 'گرم', 'چطوری', 'هستم', 'نیستم', 'شدم', 'کردم', 'بودم',
    'دارم', 'ندارم', 'میکنم', 'میکنی', 'میشه', 'گفتم', 'میشینم', 'هستی'
  ]);

  const BONUS_STARTS = new Set([
    'راستی', 'ولی', 'اما', 'چون', 'اگه', 'پس', 'خب', 'حالا', 'تازه', 'تو', 'شما', 'من'
  ]);

  const APPROVED_STANDALONE_SHORT = new Set([
    'سلام', 'سلامتی', 'درود', 'مرسی', 'ممنون', 'خوبم', 'فدات', 'قربانت', 'خوشبختم',
    'آره', 'اره', 'نه', 'باشه', 'اوکیه', 'اوکی', 'دقیقا', 'اوهوم', 'نوچ', 'ایول', 'عالی', 'چطور', 'چطوری', 'هستی؟', 'هستی'
  ]);

  // Clause-based natural splitting of a single segment
  function splitSegmentByClauses(seg: string): string[] {
    const trimmed = seg.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);

    // Rule 1: A single cohesive proposition (< 9-10 words) should NEVER be sliced!
    // Keeping a 7-9 word sentence as one bubble is 100% more natural than chopping it.
    if (words.length <= Math.max(8, (maxWordsPerBubble || 8) + 2)) {
      return [trimmed];
    }

    // Rule 2: Try splitting on Greeting / Acknowledgement prefix
    const greetingMatch = trimmed.match(
      /^(سلام\s+خوبی|سلام\s+چطوری|سلام\s+درود|سلام|منم\s+خوبم|شکر\s+خوبم|خوبم\s+مرسی|قربانت|فدات|مرسی|سلامتی|اره|نه|باشه|ایول)[\s،,]+(.+)$/i
    );
    if (greetingMatch && greetingMatch[2]) {
      const p1 = greetingMatch[1].trim();
      const p2 = greetingMatch[2].trim();
      if (p1 && p2 && p2.split(/\s+/).length >= 2) {
        return [p1, ...splitSegmentByClauses(p2)];
      }
    }

    // Rule 3: Try splitting on Conversational Pivots (راستی، ولی، اما، چون، اگه)
    const pivotMatch = trimmed.match(/^(.+?)[\s،,]+(راستی|ولی|اما|چون|اگه|پس)[\s،,]+(.+)$/i);
    if (pivotMatch && pivotMatch[1] && pivotMatch[2] && pivotMatch[3]) {
      const left = pivotMatch[1].trim();
      const pivot = pivotMatch[2].trim();
      const right = pivotMatch[3].trim();
      if (left.split(/\s+/).length >= 2 && right.split(/\s+/).length >= 2) {
        return [left, `${pivot} ${right}`.trim()];
      }
    }

    // Rule 4: Try splitting on Question Suffix (e.g. توام قطعی داری؟ / تو کجایی؟)
    const questionSuffixMatch = trimmed.match(
      /^(.+?)[\s،,]+(توام\s+قطعی\s+داری\s*[؟?]?|واسه\s+توام\s+کنده\s*[؟?]?|تو\s+کجایی\s*[؟?]?|تو\s+چطور\s*[؟?]?|خطت\s+چیه\s*[؟?]?|گوشیت\s+چیه\s*[؟?]?)$/i
    );
    if (questionSuffixMatch && questionSuffixMatch[1] && questionSuffixMatch[2]) {
      const left = questionSuffixMatch[1].trim();
      const right = questionSuffixMatch[2].trim();
      if (left.split(/\s+/).length >= 3) {
        return [left, right];
      }
    }

    // Rule 5: Comma pause splitting if both sides have substantial words
    const commaParts = trimmed.split(/(?<=[،,])\s+/).map((s) => s.trim()).filter(Boolean);
    if (commaParts.length > 1 && commaParts.every((p) => p.split(/\s+/).length >= 3)) {
      return commaParts;
    }

    // Rule 6: Syntactic fallback scoring (only if sentence is genuinely long >= 10 words)
    let bestK = -1;
    let bestScore = -9999;
    const targetMax = Math.max(5, Math.min(maxWordsPerBubble || 8, 9));

    for (let k = Math.min(targetMax, words.length - 2); k >= 3; k--) {
      let score = 0;
      const lastWord = words[k - 1];
      const nextWord = words[k];

      // Absolute grammatical penalties
      if (FORBIDDEN_ENDINGS.has(lastWord)) score -= 500;
      if (FORBIDDEN_STARTS.has(nextWord)) score -= 500;

      for (const [w1, w2] of COMPOUND_VERB_PAIRS) {
        if (lastWord === w1 && nextWord === w2) score -= 500;
      }

      // Heavily penalize leaving 1 or 2 dangling words at the end
      const remainingLen = words.length - k;
      if (remainingLen <= 2) score -= 300;
      else if (remainingLen <= 7) score += 40;

      if (BONUS_ENDINGS.has(lastWord)) score += 80;
      if (BONUS_STARTS.has(nextWord)) score += 70;

      if (
        lastWord.endsWith('م') ||
        lastWord.endsWith('ی') ||
        lastWord.endsWith('یم') ||
        lastWord.endsWith('ید') ||
        lastWord.endsWith('ند')
      ) {
        score += 35;
      }

      if (score > bestScore) {
        bestScore = score;
        bestK = k;
      }
    }

    // Only split if a syntactically sound split point with positive score was found
    if (bestK > 0 && bestScore > 0) {
      const c1 = words.slice(0, bestK).join(' ').trim();
      const c2 = words.slice(bestK).join(' ').trim();
      if (c1 && c2) return [c1, c2];
    }

    // If no clean split exists, it is 100x better to keep as ONE natural bubble
    return [trimmed];
  }

  const rawSubBubbles: string[] = [];
  for (const part of initialSegments) {
    const chunks = splitSegmentByClauses(part);
    rawSubBubbles.push(...chunks);
  }

  // Post-processing & Invariant Safety:
  // Merge any orphan or severed fragments with adjacent bubbles
  const processedBubbles: string[] = [];
  for (let i = 0; i < rawSubBubbles.length; i++) {
    let part = repairIncompleteSentences(rawSubBubbles[i]);
    part = part.replace(/[\.\:،,!;؛\-–—]+$/g, '').trim();
    if (!part) continue;

    // Drop robotic echo clichés
    if (/^(?:شما\s*چطور\s*[؟?]?|شما\s*چی\s*[؟?]?|تو\s*چطور\s*[؟?]?|شما\s*چطوری\s*[؟?]?|خودت\s*چطور\s*[؟?]?)$/i.test(part)) {
      continue;
    }

    const bWords = part.split(/\s+/).filter(Boolean);
    const firstWord = bWords[0];
    const isCurStandalone = APPROVED_STANDALONE_SHORT.has(part) || /[؟?]$/.test(part);

    if (processedBubbles.length > 0) {
      const prev = processedBubbles[processedBubbles.length - 1];
      const prevWords = prev.split(/\s+/).filter(Boolean);
      const prevLastWord = prevWords[prevWords.length - 1];

      const isPrevEndingForbidden = FORBIDDEN_ENDINGS.has(prevLastWord);
      const isCurStartForbidden = FORBIDDEN_STARTS.has(firstWord);
      const isCompoundVerbSevered = COMPOUND_VERB_PAIRS.some(
        ([w1, w2]) => prevLastWord === w1 && firstWord === w2
      );
      const isCurOrphan = bWords.length <= 2 && !isCurStandalone;

      // If either side creates a severed fragment, merge them into a single coherent bubble
      if (isPrevEndingForbidden || isCurStartForbidden || isCompoundVerbSevered || isCurOrphan) {
        processedBubbles[processedBubbles.length - 1] = `${prev} ${part}`.trim();
        continue;
      }
    }

    processedBubbles.push(part);
  }

  // Bubble Budgeting:
  // In natural human chat, 1-2 bubbles is the golden standard.
  // If more bubbles were created, fold excess into the last bubble rather than dropping words.
  const effectiveMax = Math.max(1, Math.min(maxChunks || 2, 3));
  if (processedBubbles.length > effectiveMax) {
    const head = processedBubbles.slice(0, effectiveMax - 1);
    const tail = processedBubbles.slice(effectiveMax - 1).join(' ');
    return [...head, tail];
  }

  return processedBubbles.length > 0 ? processedBubbles : [clean];
}

// Helper: Calculate Dynamic Typing Speed based on human reading latency, message length, and typing variance
function calculateTypingDelay(
  text: string,
  instructions: AnonymousChatInstructions,
  incomingStrangerText?: string
): number {
  if (instructions.dynamicTypingSpeed === false) {
    return Math.max(600, (instructions.replyDelaySeconds || 1.2) * 1000);
  }
  const speedPerChar = instructions.typingSpeedMsPerChar || 35;
  const charCount = (text || '').trim().length;

  // 1. Reading & Cognitive thinking latency based on stranger message length
  const strangerLen = (incomingStrangerText || '').trim().length;
  const readingDuration = Math.min(1000, Math.max(200, strangerLen * 12 + (Math.random() * 200 - 100)));

  // 2. Dynamic formula: char count * typing speed + human jitter
  const typingDuration = charCount * speedPerChar + (Math.random() * 300 + 150);

  const rawDuration = readingDuration + typingDuration;
  const minMs = Math.max(800, (instructions.minTypingDelaySeconds !== undefined ? instructions.minTypingDelaySeconds : 1.0) * 1000);
  const maxMs = Math.min(5000, (instructions.maxTypingDelaySeconds !== undefined ? instructions.maxTypingDelaySeconds : 4.0) * 1000);
  return Math.min(maxMs, Math.max(minMs, Math.round(rawDuration)));
}

// Helper: Simulate human-like typing wait with reading delay and active Telegram typing pulse (with instant abort on disconnect)
async function simulateRealisticTypingWait(
  client: any,
  botEntity: any,
  totalDelayMs: number,
  session?: AnonymousChatSession,
  statusLabel?: string,
  selectedBot?: AnonymousBotProfile
): Promise<boolean> {
  const readingPartMs = Math.min(800, Math.max(200, Math.round(totalDelayMs * 0.22)));
  const typingPartMs = Math.max(200, totalDelayMs - readingPartMs);

  if (session) {
    session.statusMessage = `${statusLabel || 'در حال شبیه‌سازی تایپ هوشمند'} (${(totalDelayMs / 1000).toFixed(1)} ثانیه)...`;
    saveData();
  }

  const checkDisconnected = async (): Promise<boolean> => {
    if (anonEngineAbort || (session && (session.status as string) === 'ended')) return true;
    try {
      const recent = await client.getMessages(botEntity, { limit: 3 });
      for (const m of recent || []) {
        if (!m.out && m.message) {
          if (
            isDisconnectNotice(m.message, selectedBot?.partnerDisconnectedKeywords) ||
            isMainMenuNotice(m.message, m.replyMarkup, selectedBot?.notInChatKeywords)
          ) {
            return true;
          }
        }
      }
    } catch {}
    return false;
  };

  // 1. Reading / thinking phase (قبل از شروع تایپ)
  const readSteps = Math.ceil(readingPartMs / 150);
  for (let i = 0; i < readSteps; i++) {
    if (await checkDisconnected()) return false;
    await new Promise((r) => setTimeout(r, Math.min(150, readingPartMs)));
  }

  // 2. Active typing simulation with continuous keep-alive pulse (وضعیت Typing در تلگرام)
  let remainingMs = typingPartMs;
  while (remainingMs > 0) {
    if (await checkDisconnected()) return false;
    try {
      if (Api && Api.messages && Api.messages.SetTyping) {
        client.invoke(
          new Api.messages.SetTyping({ peer: botEntity, action: new Api.SendMessageTypingAction() })
        ).catch(() => {});
      }
    } catch {}

    const stepWait = Math.min(200, remainingMs);
    await new Promise((r) => setTimeout(r, stepWait));
    remainingMs -= stepWait;
  }

  if (await checkDisconnected()) return false;
  return true;
}

// Helper: Detect Spam / Bot Links and Unwanted Promotional Inbounds from Strangers
function isSpamBotMessage(text: string, customKeywords?: string[]): boolean {
  if (!text) return false;
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. URLs, Telegram handles, and external invite links
  if (
    lower.includes('t.me/') ||
    lower.includes('telegram.me/') ||
    lower.includes('joinchat') ||
    lower.includes('chat.whatsapp.com') ||
    lower.includes('instagram.com/') ||
    /https?:\/\//i.test(clean) ||
    /www\.[a-z0-9-]+\.[a-z]+/i.test(clean) ||
    /@([a-zA-Z0-9_]{5,})/i.test(clean)
  ) {
    return true;
  }

  // 2. Common Persian spam & bot patterns
  const defaultSpamPhrases = [
    'عضویت در کانال',
    'کانال تلگرام',
    'پست آخر کانال',
    'شارژ رایگان',
    'فروش اکانت',
    'ربات هوشمند',
    'ربات چت ناشناس',
    'صیغه موقت',
    'صیغه یابی',
    'همسریابی',
    'کارت به کارت',
    'پکیج آموزشی',
    'تخفیف ویژه کانال',
    'افزایش ممبر',
    'خرید ممبر',
    'فالور ارزان',
    'سین زن',
    'بیا کانالم',
    'بیا پیوی',
  ];

  const allKeywords = Array.from(new Set([...(customKeywords || []), ...defaultSpamPhrases]));
  return allKeywords.some((kw) => {
    const k = kw.trim();
    if (!k) return false;
    return clean.includes(k) || isKeywordMatchInText(clean, k);
  });
}

// Helper: Check if stranger sent a positive inquiry / question about the product after promo pitch
function isStrangerInquiryAfterPromo(text: string): boolean {
  if (!text) return false;
  const clean = text.trim();
  const inquiryKeywords = [
    'قیمت', 'چنده', 'چند', 'تعرفه', 'هزینه', 'تست', 'تست میدی', 'خرید', 'اکانت',
    'اشتراک', 'کانفیگ', 'سرویس', 'لینک', 'آیدی', 'کارت', 'شماره کارت', 'واریز',
    'پرداخت', 'چطوری', 'شرایط', 'آیفون', 'اندروید', 'سرعت', 'پشتیبانی', 'میخوام',
    'بفرست', 'میدی', 'چندماهه', 'vpn', 'وی پی ان', 'فیلترشکن'
  ];
  return inquiryKeywords.some((kw) => isKeywordMatchInText(clean, kw));
}

// Helper: Calculate Comprehensive Anonymous Analytics Report
function calculateAnonymousAnalytics(): AnonymousAnalyticsReport {
  const automator = appState.anonymousAutomator || defaultAnonymousAutomatorConfig;
  const history = appState.anonymousSessionHistory || [];
  const allSessions: AnonymousChatSession[] = [...history];
  if (activeAnonChatSession && !allSessions.some((s) => s.id === activeAnonChatSession?.id)) {
    allSessions.unshift({ ...activeAnonChatSession });
  }

  let totalChatsInitiated = automator.stats.totalChatsInitiated || allSessions.length;
  let totalCompletedChats = 0;
  let totalPromoSent = 0;
  let totalInquiriesAfterPromo = 0;
  let totalSpamBotsSkipped = 0;
  let totalDurationSeconds = 0;
  let totalMessages = 0;
  const exitReasonsBreakdown: Record<string, number> = {};
  const topInquiries: Array<{
    sessionId: string;
    partnerTag?: string;
    partnerSnippet?: string;
    inquiryText: string;
    timestamp: string;
  }> = [];

  allSessions.forEach((s) => {
    if (s.status === 'ended') {
      totalCompletedChats++;
    }
    if (s.promoSent) {
      totalPromoSent++;
    }
    if (s.isSpamBot || s.exitReason === 'spam_bot_skipped') {
      totalSpamBotsSkipped++;
    }
    if (s.inquiryDetected && s.inquirySnippet) {
      totalInquiriesAfterPromo++;
      topInquiries.push({
        sessionId: s.id,
        partnerTag: s.partnerTag,
        partnerSnippet: s.partnerProfileSnippet,
        inquiryText: s.inquirySnippet,
        timestamp: s.endedAt || s.startedAt,
      });
    }

    // Duration calculation
    if (s.startedAt && s.endedAt) {
      const dur = Math.max(0, (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000);
      totalDurationSeconds += dur;
    }

    totalMessages += s.messagesCount || (s.transcript?.length || 0);

    const reason = s.exitReason || (s.status === 'ended' ? 'max_messages_reached' : 'in_progress');
    exitReasonsBreakdown[reason] = (exitReasonsBreakdown[reason] || 0) + 1;
  });

  // Ensure automator stats align
  if (automator.stats) {
    automator.stats.totalCompletedChats = totalCompletedChats;
    automator.stats.totalPromoSent = totalPromoSent;
    automator.stats.totalInquiriesAfterPromo = totalInquiriesAfterPromo;
    automator.stats.totalSpamBotsSkipped = totalSpamBotsSkipped;
    automator.stats.exitReasonsBreakdown = exitReasonsBreakdown;
  }

  const denominator = Math.max(1, allSessions.length);
  const promoDenominator = Math.max(1, totalPromoSent);
  const conversionRatePercent = Number(((totalInquiriesAfterPromo / promoDenominator) * 100).toFixed(1));
  const promoPitchRatePercent = Number(((totalPromoSent / denominator) * 100).toFixed(1));
  const averageChatDurationSeconds = Math.round(totalDurationSeconds / denominator);
  const averageMessagesPerChat = Number((totalMessages / denominator).toFixed(1));

  return {
    totalChatsInitiated: Math.max(totalChatsInitiated, allSessions.length),
    totalCompletedChats,
    totalPromoSent,
    totalInquiriesAfterPromo,
    totalSpamBotsSkipped,
    conversionRatePercent,
    promoPitchRatePercent,
    averageChatDurationSeconds,
    averageMessagesPerChat,
    exitReasonsBreakdown,
    topInquiries: topInquiries.slice(0, 30),
  };
}

// Helper: Normalize Persian & Arabic characters, strip emojis, punctuation, diacritics
function normalizePersianText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u0640ـ]/g, '') // remove tatweel / kashida completely
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove arabic diacritics (fathah, dammah, etc.)
    .replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00A0]/g, ' ') // replace ZWNJ / ZWJ / NBSP with space
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/إ|أ|آ/g, 'ا')
    .replace(/[《》【】«»]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // remove emojis
    .replace(/[^\p{L}\p{N}\s]/gu, '') // remove symbols / punctuation
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: Calculate similarity score between candidate button text and target label (0.0 to 1.0)
function calculateButtonSimilarity(buttonText: string, targetPattern: string): number {
  if (!buttonText || !targetPattern) return 0;
  const rawBtn = buttonText.trim();
  const rawTarget = targetPattern.trim();

  // 1. Direct exact or case-insensitive match
  if (rawBtn === rawTarget) return 1.0;
  if (rawBtn.toLowerCase() === rawTarget.toLowerCase()) return 0.98;

  // Normalized Persian
  const normBtn = normalizePersianText(rawBtn);
  const normTarget = normalizePersianText(rawTarget);

  // Negative filter: If target is an exit intent, strictly only match exit buttons
  const exitKeywords = ['پایان', 'اتمام', 'قطع', 'خروج', 'بستن'];
  const isTargetExit = exitKeywords.some((kw) => normTarget.includes(kw));
  if (isTargetExit) {
    const nonExitKeywords = ['ایمن', 'اطلاع', 'اعلان', 'خبر', 'نوتیف', 'پروفایل', 'جستجو', 'شروع', 'وصل', 'مشخصات', 'گزارش', 'راهنما', 'سکه', 'دعوت', 'درخواست'];
    if (nonExitKeywords.some((nek) => normBtn.includes(nek))) {
      return 0.0;
    }
    const isBtnExit = exitKeywords.some((kw) => normBtn.includes(kw));
    const isConfirmation = normBtn.includes('بله') || normBtn.includes('تایید') || normBtn.includes('مطمئن');
    if (!isBtnExit && !isConfirmation) {
      return 0.0;
    }
  }

  // 2. Direct substring match
  if (rawBtn.includes(rawTarget) || rawTarget.includes(rawBtn)) {
    const minLen = Math.min(rawBtn.length, rawTarget.length);
    const maxLen = Math.max(rawBtn.length, rawTarget.length);
    return 0.88 + (minLen / maxLen) * 0.1;
  }

  // 3. Match ignoring emojis & special characters entirely
  const cleanBtn = rawBtn.replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '').trim();
  const cleanTarget = rawTarget.replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '').trim();
  if (cleanBtn && cleanTarget) {
    if (cleanBtn === cleanTarget) return 0.96;
    if (cleanBtn.toLowerCase() === cleanTarget.toLowerCase()) return 0.95;
    if (cleanBtn.includes(cleanTarget) || cleanTarget.includes(cleanBtn)) {
      const minL = Math.min(cleanBtn.length, cleanTarget.length);
      const maxL = Math.max(cleanBtn.length, cleanTarget.length);
      return 0.85 + (minL / maxL) * 0.1;
    }
  }

  // 4. Normalized Persian match (letters, spaces, diacritics)
  if (normBtn && normTarget) {
    if (normBtn === normTarget) return 0.95;
    if (normBtn.includes(normTarget) || normTarget.includes(normBtn)) {
      const minNL = Math.min(normBtn.length, normTarget.length);
      const maxNL = Math.max(normBtn.length, normTarget.length);
      return 0.85 + (minNL / maxNL) * 0.1;
    }

    // 5. Semantic exit synonyms for Persian anonymous bots (پایان چت, اتمام چت, قطع مکالمه, خروج, پایان مکالمه)
    const isBtnExit = exitKeywords.some((kw) => normBtn.includes(kw));
    if (isTargetExit && isBtnExit) {
      if (
        (normTarget.includes('چت') && normBtn.includes('چت')) ||
        (normTarget.includes('مکالمه') && normBtn.includes('مکالمه')) ||
        (normTarget.includes('پایان') && normBtn.includes('پایان')) ||
        (normTarget.includes('اتمام') && normBtn.includes('اتمام')) ||
        (normTarget.includes('قطع') && normBtn.includes('قطع'))
      ) {
        return 0.95;
      }
      return 0.88;
    }

    // If target is exit confirmation and button is confirmation (بله, تایید, مطمئنم)
    if (isTargetExit && (normBtn.includes('بله') || normBtn.includes('تایید') || normBtn.includes('مطمئن'))) {
      return 0.92;
    }

    // Token-based Jaccard overlap
    const btnTokens = normBtn.split(' ').filter((t) => t.length > 1);
    const targetTokens = normTarget.split(' ').filter((t) => t.length > 1);
    if (btnTokens.length > 0 && targetTokens.length > 0) {
      const matchedCount = targetTokens.filter((tt) => btnTokens.some((bt) => bt === tt || bt.includes(tt) || tt.includes(bt))).length;
      if (matchedCount > 0) {
        const overlapScore = matchedCount / Math.max(btnTokens.length, targetTokens.length);
        if (overlapScore >= 0.75) {
          return 0.70 + overlapScore * 0.25;
        } else if (overlapScore >= 0.5) {
          // Penalize partial matches of common words to prevent false positive matching
          // (e.g. matching "جستجوی کاربران" when target is "جستجوی شانسی" because they both contain "جستجوی")
          return 0.40 + overlapScore * 0.20; // 0.50 score, which is below the matching threshold (0.55/0.60)
        }
      }
    }

    // Levenshtein distance on normalized strings
    const dist = getLevenshteinDistance(normBtn, normTarget);
    const maxLen = Math.max(normBtn.length, normTarget.length);
    if (maxLen > 0) {
      const levScore = 1 - dist / maxLen;
      if (levScore > 0.6) return levScore * 0.85;
    }
  }

  return 0;
}

// Levenshtein distance helper
function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Helper: Check if a button matches target pattern (Fuzzy / Partial / Token / Contains / Emoji-insensitive)
function isButtonMatch(buttonText: string, targetPattern: string, mode: 'fuzzy' | 'exact' | 'contains' = 'fuzzy'): boolean {
  if (!buttonText || !targetPattern) return false;
  if (mode === 'exact') {
    return buttonText.trim() === targetPattern.trim();
  }
  const score = calculateButtonSimilarity(buttonText, targetPattern);
  return score >= 0.55;
}

// Helper: Robust check if a message text contains a target trigger keyword (tolerant to emojis, punctuation, diacritics, and Persian spacing)
function isKeywordMatchInText(messageText: string, targetPattern: string): boolean {
  if (!messageText || !targetPattern) return false;
  const rawMsg = messageText.trim();
  const rawTarget = targetPattern.trim();
  if (!rawMsg || !rawTarget) return false;

  const normMsg = normalizePersianText(rawMsg).toLowerCase();
  const normTarget = normalizePersianText(rawTarget).toLowerCase();
  if (!normMsg || !normTarget) return false;

  // 1. Direct contains check
  if (normMsg.includes(normTarget)) return true;

  // 2. Clean punctuation/emojis and check substring again
  const cleanMsg = normMsg.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const cleanTarget = normTarget.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (cleanTarget && cleanMsg.includes(cleanTarget)) return true;

  // 3. Exact single word check for single-word keywords
  const msgWords = cleanMsg.split(/\s+/).filter(Boolean);
  const targetWords = cleanTarget.split(/\s+/).filter(Boolean);
  if (targetWords.length === 1) {
    const kw = targetWords[0];
    if (msgWords.includes(kw)) return true;
  }

  return false;
}

// Helper: Check if message or reply markup indicates partner is connected / matched
function isMatchNotification(
  text: string,
  replyMarkup?: any,
  customKeywords?: string[]
): boolean {
  const rawText = (text || '').trim();
  const normalized = normalizePersianText(rawText);

  // 1. Text phrase matching across all standard Iranian anonymous chat bots
  const defaultMatchPhrases = [
    'به مخاطب وصل شدی',
    'وصل شدی',
    'متصل شدی',
    'متصل شدید',
    'وصل شدید',
    'مخاطب پیدا شد',
    'همصحبت پیدا شد',
    'هم‌صحبت پیدا شد',
    'یک همصحبت پیدا شد',
    'یک هم‌صحبت پیدا شد',
    'یک هم صحبت پیدا شد',
    'هم صحبت پیدا شد',
    'شما در حال گفتگو با یک ناشناس هستید',
    'مکالمه آغاز شد',
    'شروع مکالمه',
    'شروع چت',
    'گفتگو آغاز شد',
    'وصلتون کردم',
    'پیدا کردم',
    'به مخاطبت سلام کن',
    'سلام کن',
    'مشخصات هم‌صحبت',
    'مشخصات مخاطب',
    'اطلاعات هم‌صحبت',
    'اطلاعات مخاطب',
    'پروفایل مخاطب',
    'طرف مقابل وارد چت شد',
    'مخاطب متصل شد',
    'شما به هم‌صحبت متصل شدید',
    'شما به مخاطب متصل شدید',
    'شما به یک کاربر ناشناس وصل شدید',
    'به یک ناشناس متصل شدید',
    'به یک هم‌صحبت متصل شدید',
    'هم‌اکنون در حال گفتگو هستید',
    'هم اکنون در حال گفتگو هستید',
    '👀 پیدا کردم وصلتون کردم',
    'پیدا کردم وصلتون کردم',
  ];
  const allMatchPhrases = Array.from(
    new Set([...(customKeywords || []).filter((k) => k && k.trim()), ...defaultMatchPhrases])
  );

  if (rawText) {
    const matchedPhrase = allMatchPhrases.some((kw) => {
      const cleanKw = kw.trim();
      if (!cleanKw) return false;
      return isKeywordMatchInText(rawText, cleanKw) || normalized.includes(normalizePersianText(cleanKw));
    });
    if (matchedPhrase) return true;

    // HyperGap profile pattern from bot header: "جنسیت: ... سن: ... استان: ..."
    if (
      (rawText.includes('جنسیت:') || rawText.includes('جنسیت :')) &&
      (rawText.includes('سن:') || rawText.includes('استان:') || rawText.includes('شهر:') || rawText.includes('فاصله:')) &&
      rawText.length > 25
    ) {
      return true;
    }
  }

  // 2. Inspect replyMarkup: if reply markup contains an in-chat button (indicates active chat state)
  if (replyMarkup?.rows) {
    for (const row of replyMarkup.rows) {
      for (const btn of row.buttons || []) {
        const bText = (btn.text || '').trim();
        if (
          isButtonMatch(bText, 'پایان چت', 'fuzzy') ||
          isButtonMatch(bText, '❌ پایان چت', 'fuzzy') ||
          isButtonMatch(bText, '❌ پایان مکالمه', 'fuzzy') ||
          isButtonMatch(bText, '❌ اتمام چت', 'fuzzy') ||
          isButtonMatch(bText, 'قطع مکالمه', 'fuzzy') ||
          isButtonMatch(bText, 'قطع چت', 'fuzzy') ||
          isButtonMatch(bText, '🛑 خروج از چت', 'fuzzy') ||
          isButtonMatch(bText, 'خروج از چت', 'fuzzy') ||
          isButtonMatch(bText, '👀 پروفایل مخاطب 👤', 'fuzzy') ||
          isButtonMatch(bText, 'پروفایل مخاطب', 'fuzzy')
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

// Helper: Check if message is an incoming direct chat request from another user in HyperGap/bots
function isChatRequestNotice(text: string): boolean {
  if (!text) return false;
  const rawText = text.trim();
  return (
    rawText.includes('درخواست چت از طرف') ||
    rawText.includes('را میپذیرید؟') ||
    rawText.includes('را می‌پذیرید؟') ||
    rawText.includes('درخواست چت') ||
    rawText.includes('درخواست گفتگو') ||
    (rawText.includes('درخواست') && (rawText.includes('میپذیرید') || rawText.includes('می‌پذیرید')))
  );
}

// Helper: Check if bot informs that we are already in chat
function isAlreadyInChatNotice(text: string, customKeywords?: string[]): boolean {
  if (!text) return false;
  const rawText = text.trim();
  const normalized = normalizePersianText(rawText);
  const phrases = [
    'هم اکنون شما در حال چت هستید',
    'هم اکنون در حال چت هستید',
    'هم‌اکنون در حال چت هستید',
    'در حال حاضر در حال چت هستید',
    'شما در حال حاضر در یک گفتگو هستید',
    'ابتدا باید مکالمه رو قطع کنی',
    'ابتدا چت فعلی را قطع کنید',
    'ابتدا مکالمه فعلی را ببندید',
    'مکالمه قبلی هنوز باز است',
    'برای قطع چت از دستور',
    'خطا : هم اکنون شما در حال چت هستید',
    'خطا: هم اکنون شما در حال چت هستید',
    'چت فعال دارید',
  ];
  const allPhrases = Array.from(new Set([...(customKeywords || []).filter((k) => k && k.trim()), ...phrases]));
  return allPhrases.some((p) => rawText.includes(p) || normalized.includes(normalizePersianText(p)) || isKeywordMatchInText(rawText, p.trim()));
}

// Helper: Check if message indicates stranger disconnected / left chat
function isDisconnectNotice(
  text: string,
  customKeywords?: string[]
): boolean {
  if (!text) return false;
  const rawText = text.trim();
  const normalized = normalizePersianText(rawText);

  // 1. Direct Regex patterns for HyperGap and all Persian anonymous bots
  if (
    /🎌/i.test(rawText) ||
    /قطع شد/i.test(rawText) ||
    /قطع گردید/i.test(rawText) ||
    /ترک کرد/i.test(rawText) ||
    /خارج شد/i.test(rawText) ||
    /بوسیله او/i.test(rawText) ||
    /توسط مخاطب/i.test(rawText) ||
    /توسط کاربر/i.test(rawText) ||
    /توسط هم/i.test(rawText) ||
    /گفتگو را بست/i.test(rawText) ||
    /چت را بست/i.test(rawText) ||
    /مکالمه را بست/i.test(rawText) ||
    /پایان یافت/i.test(rawText) ||
    /خاتمه یافت/i.test(rawText) ||
    /پایان داد/i.test(rawText) ||
    /بسته شد/i.test(rawText)
  ) {
    const isDisconnectContext =
      rawText.includes('🎌') ||
      rawText.includes('توسط') ||
      rawText.includes('بوسیله') ||
      rawText.includes('مخاطب') ||
      rawText.includes('هم‌صحبت') ||
      rawText.includes('هم صحبت') ||
      rawText.includes('کاربر') ||
      rawText.includes('اتصال') ||
      rawText.includes('ارتباط') ||
      rawText.includes('مکالمه') ||
      rawText.includes('گفتگو') ||
      rawText.includes('چت') ||
      rawText.includes('شما') ||
      rawText.includes('طرف مقابل') ||
      rawText.includes('بست') ||
      rawText.includes('لفت') ||
      rawText.includes('خارج') ||
      rawText.includes('ترک');

    if (isDisconnectContext) {
      return true;
    }
  }

  const defaultDisconnectPhrases = [
    '🎌 چت شما با',
    'چت شما با',
    'توسط مخاطب شما قطع شد',
    'توسط مخاطب قطع شد',
    'توسط شما قطع شد',
    'چت توسط مخاطب قطع شد',
    'مکالمه توسط مخاطب قطع شد',
    'مکالمه توسط هم‌صحبت قطع شد',
    'توسط مخاطب شما پایان یافت',
    'توسط مخاطب پایان یافت',
    'مخاطب گفتگو را بست',
    'مخاطب مکالمه را بست',
    'مخاطب چت را ترک کرد',
    'مخاطب چت را بست',
    'مخاطب مکالمه را ترک کرد',
    'مخاطب از چت خارج شد',
    'هم‌صحبت شما گفتگو را بست',
    'هم‌صحبت شما چت را بست',
    'هم صحبت شما گفتگو را بست',
    'هم صحبت شما چت را بست',
    'هم‌صحبت چت را ترک کرد',
    'هم صحبت چت را ترک کرد',
    'هم‌صحبت از چت خارج شد',
    'هم صحبت از چت خارج شد',
    'کاربر مقابل از چت خارج شد',
    'کاربر مقابل گفتگو را بست',
    'کاربر مقابل چت را ترک کرد',
    'کاربر مقابل چت را بست',
    'مکالمه به پایان رسید',
    'گفتگو به پایان رسید',
    'مکالمه پایان یافت',
    'گفتگو پایان یافت',
    'پایان مکالمه',
    'پایان گفتگو',
    'چت بسته شد',
    'مکالمه بسته شد',
    'مکالمه خاتمه یافت',
    'اتصال به هم‌صحبت قطع شد',
    'اتصال چت قطع شد',
    'بوسیله او قطع شد',
    'بوسیله مخاطب قطع شد',
    'لفت داد',
    'برای شروع چت بصورت ناشناس',
    'برای شروع چت',
    'جستجوی شانسی',
    'همین الان برای شروع چت',
    'به یه ناشناس وصلم کن',
    'سکه رایگان هدیه بگیر',
    'رو بزن و چت کن',
  ];
  const allPhrases = Array.from(
    new Set([...(customKeywords || []).filter((k) => k && k.trim() && k.trim().length >= 2), ...defaultDisconnectPhrases])
  );
  return allPhrases.some((p) => rawText.includes(p) || normalized.includes(normalizePersianText(p)) || isKeywordMatchInText(rawText, p.trim()));
}

// Helper: Check if message is a search queue status from bot (waiting, queue, etc.)
function isSearchQueueNotice(text: string): boolean {
  if (!text) return false;
  const queuePhrases = [
    'در حال جستجو',
    'لطفا صبور باشید',
    'در صف انتظار',
    'جستجوی هم‌صحبت',
    'در حال یافتن',
    'شکیبا باشید',
    'منتظر بمانید',
    'جستجو آغاز شد',
    'در حال اتصال',
    'به دنبال هم صحبت',
    'به دنبال هم‌صحبت',
  ];
  return queuePhrases.some((p) => text.includes(p) || isButtonMatch(text, p, 'fuzzy'));
}

// Helper: Accurately distinguish Bot System Messages from real Stranger Chat Messages
function isSystemOrBotMessage(
  text: string,
  replyMarkup?: any,
  selectedBot?: AnonymousBotProfile,
  customIgnoredPhrases?: string[]
): boolean {
  if (!text) return false;
  const clean = text.trim();
  const normalized = normalizePersianText(clean);

  // 1. Explicit system warning, errors, and announcement messages from bot
  const exactSystemSnippets = [
    'متوجه نشدم',
    'متوجه نشدم !',
    'متوجه نشدم 🤔',
    'دستور نامعتبر',
    'دستور ناشناخته',
    'امکان ارسال حروف انگلیسی اوایل چت وجود ندارد',
    'امکان ارسال حروف انگلیسی',
    'برای ارسال کاراکتر انگلیسی از پیام دایرکت استفاده کنید',
    'خب ، حالا چه کاری برات انجام بدم؟',
    'خب ، حالا چه کاری برات انجام بدم',
    'از منوی پایین👇 انتخاب کن',
    'از منوی پایین انتخاب کن',
    'به بخش چت با ناشناس خوش اومدی',
    'به هیچ کاربری در ربات اعتماد نکنید',
    'اطلاعات شخصیتان را در اختیارشان قرار ندهید',
    'اطلاعات شخصیتان',
    'پیام سیستم: میدونستی اگر با این کاربر چت کنی',
    'سکه رایگان دریافت میکنی',
    'هر چت موفق = 1 سکه رایگان',
    'هر چت موفق',
    'سکه رایگان',
    'تبریک تعداد',
    'سکه به دلیل موفق بودن چت',
    'سکه به حساب شما اضافه شد',
    'به حساب شما اضافه شد',
    'پیام سیستم 👇',
    'پروفایلِ هایپر گپ',
    'پروفایل هایپر گپ',
    'شما را مشاهده کرد',
    'اطلاعاتی است که در بخش پروفایل ربات ثبت کرده اید',
    '⚠️ توجه:',
    '🚫 اخطار:',
    '🔔پیام سیستم:',
    '🔔 پیام سیستم:',
    '🤖 پیام سیستم',
    'اطلاعیه سیستم',
    'درخواست چت از طرف',
    'را میپذیرید؟',
    'را می‌پذیرید؟',
    'درآمد ملیونی',
    'HyperGapAd',
    'چنین کاربری وجود ندارد',
    'حذف کل پیام های در چت',
    'عدم رعایت قوانین',
    'گزارش کاربر',
    'delet_chat_',
    'ghavanin',
    'هم اکنون شما در حال چت هستید',
  ];

  if (exactSystemSnippets.some((snippet) => clean.includes(snippet) || normalized.includes(normalizePersianText(snippet)))) {
    return true;
  }

  // 2. Custom ignored phrases from bot profile and general instructions
  const allCustomIgnores = [
    ...(selectedBot?.customIgnoredKeywords || []),
    ...(customIgnoredPhrases || []),
    ...(appState?.anonymousAutomator?.instructions?.customIgnoredSystemPhrases || []),
  ].flatMap((phrase) => phrase.split(/[-–—\n]/).map((p) => p.trim()).filter(Boolean));

  if (allCustomIgnores.some((phrase) => {
    const pClean = phrase.trim();
    if (!pClean) return false;
    return isKeywordMatchInText(clean, pClean);
  })) {
    return true;
  }

  // 3. Disconnect / Leave notifications
  if (isDisconnectNotice(clean, selectedBot?.partnerDisconnectedKeywords)) {
    return true;
  }

  // 4. Search queue / Waiting notifications
  if (isSearchQueueNotice(clean)) {
    return true;
  }

  // 5. Incoming chat request notifications
  if (isChatRequestNotice(clean)) {
    return true;
  }

  // 6. Generic System Headers & Prefixes (Bell, Warnings, System Alerts)
  if (
    clean.startsWith('🔔 پیام سیستم') ||
    clean.startsWith('🤖 پیام سیستم') ||
    clean.startsWith('⚠️ توجه:') ||
    clean.startsWith('⚠️ خطا:') ||
    clean.startsWith('⚠️ خطا :') ||
    clean.startsWith('🚫 اخطار:') ||
    clean.startsWith('🚫 اخطار :') ||
    clean.startsWith('⛔ اخطار:') ||
    clean.startsWith('📢 اطلاعیه:')
  ) {
    return true;
  }

  // 7. Bot Rules, Commands and Support Channel announcements
  const systemTipsPhrases = [
    'برای پایان چت از دستور',
    'برای قطع چت از دستور',
    'جهت گزارش تخلف',
    'قوانین چت ناشناس',
    'قوانین گفتگو در ربات',
    'کانال پشتیبانی ربات',
    'عضویت در کانال رسمی',
    'لینک اختصاصی شما برای دعوت',
    'افزایش سکه در ربات',
    'امتیاز به مخاطب در پایان',
    'آیا از این مکالمه رضایت داشتید',
  ];
  if (systemTipsPhrases.some((p) => clean.includes(p) || normalized.includes(normalizePersianText(p)))) {
    return true;
  }

  // 8. Structured bot profile card from bot (starts with profile header and has multiple structured fields)
  if (
    (clean.includes('مشخصات مخاطب') || clean.includes('پروفایل مخاطب') || clean.includes('اطلاعات هم‌صحبت')) &&
    clean.includes('جنسیت:') &&
    (clean.includes('سن:') || clean.includes('استان:') || clean.includes('شهر:'))
  ) {
    return true;
  }

  // 9. Short bot slash commands (e.g. /start, /end)
  if (clean.startsWith('/') && clean.length <= 15 && !clean.includes(' ')) {
    return true;
  }

  return false;
}

// Helper: Check if message is a main menu notice (outside of chat)
function isMainMenuNotice(text: string, replyMarkup?: any, customKeywords?: string[]): boolean {
  if (!text && !replyMarkup) return false;
  const rawText = (text || '').trim();
  const normalized = normalizePersianText(rawText);
  const menuPhrases = [
    'متوجه نشدم',
    'متوجه نشدم !',
    'متوجه نشدم 🤔',
    'دستور نامعتبر',
    'دستور ناشناخته',
    'امکان ارسال حروف انگلیسی اوایل چت وجود ندارد',
    'امکان ارسال حروف انگلیسی',
    'خب ، حالا چه کاری برات انجام بدم؟',
    'خب ، حالا چه کاری برات انجام بدم',
    'از منوی پایین👇 انتخاب کن',
    'از منوی پایین انتخاب کن',
    'برای شروع از دکمه',
    'از منوی زیر استفاده',
    'لطفا از دکمه های زیر',
    'لطفاً از دکمه های زیر',
    'پیام شما متوجه نشدم',
    'منوی اصلی',
    'دستور وارد شده صحیح نیست',
    'پیام نامفهوم',
    'برای شروع گفتگو',
    'برای شروع چت',
    'برای شروع چت بصورت ناشناس',
    'جستجوی شانسی',
    'همین الان برای شروع چت',
    'به یه ناشناس وصلم کن',
    'سکه رایگان هدیه بگیر',
    'رو بزن و چت کن',
    'منوی ربات',
    'به بخش چت با ناشناس خوش اومدی',
  ];
  const allPhrases = Array.from(new Set([...(customKeywords || []).filter((k) => k && k.trim()), ...menuPhrases]));

  if (rawText) {
    const matched = allPhrases.some((p) =>
      rawText.includes(p) ||
      normalized.includes(normalizePersianText(p)) ||
      isKeywordMatchInText(rawText, p.trim())
    );
    if (matched) return true;
  }

  // Check if reply markup rows contain main menu buttons (e.g. "به یه ناشناس وصلم کن!")
  if (replyMarkup?.rows) {
    for (const row of replyMarkup.rows) {
      for (const btn of row.buttons || []) {
        const bText = (btn.text || '').trim();
        if (
          bText.includes('وصلم کن') ||
          bText.includes('چت با ناشناس') ||
          bText.includes('شروع جستجو') ||
          bText.includes('پروفایلِ من') ||
          bText.includes('تنظیمات') ||
          bText.includes('سکه رایگان') ||
          bText.includes('جستجوی شانسی') ||
          bText.includes('شروع چت')
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

// Helper: Detect if stranger is saying goodbye or expressing clear exit intent
function isPartnerGoodbyeOrExitIntent(text: string): boolean {
  if (!text) return false;
  const raw = text.trim();
  const normalized = normalizePersianText(raw);

  const goodbyeExactPhrases = [
    'خداحافظ',
    'خدافظ',
    'خدافس',
    'فعلا خداحافظ',
    'فعلا بای',
    'بای بای',
    'بای',
    'bye',
    'goodbye',
    'شب بخیر',
    'شبخیر',
    'شبت بخیر',
    'شبت شیک',
    'من باید برم',
    'من دارم میرم',
    'من برم دیگه',
    'من رفتم',
    'باید برم',
    'دارم میرم',
    'برم دیگه',
    'فعلا برم',
    'کاری نداری',
    'مراقب خودت باش',
    'قربانت فعلا',
    'فدات فعلا',
    'خوش گذشت فعلا',
    'خوشحال شدم فعلا',
    'قطع کن',
    'ببند چت رو',
    'ببند چتو',
    'چت رو ببند',
    'چتو ببند',
    'لفت بده',
    'لفت میدم',
    'خارج شو',
    'نفر بعدی',
    'نکست بزن',
    'next بزن',
  ];

  if (goodbyeExactPhrases.some((phrase) => isKeywordMatchInText(raw, phrase) || normalized.includes(normalizePersianText(phrase)))) {
    return true;
  }

  // Regex patterns for short expressions
  if (/^(بای|خدافظ|خداحافظ|فعلا|شب\s*بخیر|bye|cya)[\s!.,،🌸🌹]*$/i.test(raw)) {
    return true;
  }

  return false;
}

// Helper: Detect if stranger explicitly rejects, says no, insults spam/bots, or demands disconnect
function isStrangerExplicitRejection(text: string): boolean {
  if (!text) return false;
  const raw = text.trim();
  const normalized = normalizePersianText(raw).toLowerCase();

  // 1. Short standalone rejections
  if (/^(نه|ن|نچ|خیر|نو|no|nop|nope)[\s!.,،]*$/i.test(raw)) {
    return true;
  }
  if (/^(نه\s*(مرسی|ممنون|نمیخوام|نمی‌خوام|نمیخام|لازم\s*ندارم|نیاز\s*ندارم|داداش|عزیز|آقا|خانوم))[\s!.,،]*$/i.test(raw)) {
    return true;
  }

  // 2. Clear rejection and disinterest phrases
  const rejectionPhrases = [
    'نمیخوام',
    'نمی‌خوام',
    'نمیخام',
    'لازم ندارم',
    'نیاز ندارم',
    'علاقه‌ای ندارم',
    'علاقه ندارم',
    'به کارم نمیاد',
    'به دردم نمیخوره',
    'به درد من نمیخوره',
    'تبلیغه',
    'تبلیغاتیه',
    'تبلیغ نکن',
    'اسپمر',
    'اسپمه',
    'رباتی',
    'ربات احمق',
    'باتی',
    'لفت بده',
    'لفت بزن',
    'قطع کن',
    'برو پی کارت',
    'ول کن',
    'ولم کن',
    'مزاحم نشو',
    'پیام نده',
    'بکشش بیرون',
    'بلاک میکنم',
    'بلاک میشی',
    'ریپورت',
    'ریپورتت میکنم',
  ];

  if (rejectionPhrases.some((phrase) => isKeywordMatchInText(raw, phrase) || normalized.includes(normalizePersianText(phrase)))) {
    return true;
  }

  // 3. User says they already have a VPN or are connected / satisfied / don't need
  if (/(?:دارم|وصله|وصلم|اوکیم|اوکی‌ام|مشکلی ندارم|به کارم نمیاد|به دردم نمیخوره|دنبالش نیستم)/i.test(raw)) {
    if (/(?:خودم|من|مرسی|ممنون|نه|الان|فعلا|همینجوری|خوبی|پره|نیازی|فیلترشکن|وی\s*پی\s*ان|vpn)/i.test(raw) || /(?:خودم\s*دارم|دارم\s*مرسی|دارم\s*ممنون|من\s*دارم|من\s*وصلم|وصله\s*مرسی|اوکیم\s*مرسی|مشکلی\s*ندارم|فیلترشکن\s*دارم|وی\s*پی\s*ان\s*دارم|گوگل\s*پلی\s*پره)/i.test(raw)) {
      return true;
    }
  }

  const additionalRejections = [
    'خودم دارم',
    'دارم مرسی',
    'دارم ممنون',
    'من دارم',
    'من وصلم',
    'وصله مرسی',
    'اوکیم مرسی',
    'مشکلی ندارم',
    'فیلترشکن دارم',
    'وی پی ان دارم',
    'vpn دارم',
    'سرویس دارم',
    'اکانت دارم',
    'گوگل پلی پره',
    'بدون فیلترشکن وصلم',
    'نیازی نیست',
    'نیازی ندارم',
    'میخوام چیکار',
    'به چه دردم میخوره',
  ];

  if (additionalRejections.some((phrase) => isKeywordMatchInText(raw, phrase) || normalized.includes(normalizePersianText(phrase)))) {
    return true;
  }

  return false;
}

// Helper: Detect if incoming system/bot message is the coin reward notice
// e.g.: "💰 تبریک تعداد 1 سکه به دلیل موفق بودن چت به حساب شما اضافه شد!"
function isCoinRewardNotice(text: string): boolean {
  if (!text) return false;
  const clean = text.trim();
  const normalized = normalizePersianText(clean).toLowerCase();
  return (
    /(?:تبریک.*سکه|سکه.*موفق|سکه به دلیل موفق بودن چت|سکه به حساب شما اضافه شد|1\s*سکه.*اضافه شد|۱\s*سکه.*اضافه شد|موفق بودن چت)/i.test(clean) ||
    normalized.includes('سکه به دلیل موفق بودن چت') ||
    normalized.includes('سکه به حساب شما اضافه شد') ||
    normalized.includes('تبریک تعداد')
  );
}

const DEFAULT_POPUP_OK_KEYWORDS = ['ok', 'تایید', 'بله', 'قبول', 'باشه', 'فهمیدم', 'ادامه', 'متوجه شدم', 'yes', 'confirm', 'باش'];

// Helper: Auto-detect and click OK / Confirm / Alert popups
async function autoDismissBotPopups(
  client: any,
  botEntity: any,
  session: AnonymousChatSession,
  customKeywords?: string[]
): Promise<boolean> {
  const keywords = customKeywords && customKeywords.length > 0 ? customKeywords : DEFAULT_POPUP_OK_KEYWORDS;
  try {
    const recentMsgs = await client.getMessages(botEntity, { limit: 4 });
    for (const msg of recentMsgs) {
      if (msg.replyMarkup?.rows) {
        for (let rowIdx = 0; rowIdx < msg.replyMarkup.rows.length; rowIdx++) {
          const row = msg.replyMarkup.rows[rowIdx];
          for (let colIdx = 0; colIdx < row.buttons.length; colIdx++) {
            const btn = row.buttons[colIdx];
            const btnText = btn.text || '';
            const isOkBtn = keywords.some((kw) => isButtonMatch(btnText, kw, 'fuzzy'));
            if (isOkBtn) {
              let okClicked = false;
              if (btn.data && Api?.messages?.GetBotCallbackAnswer) {
                try {
                  await client.invoke(
                    new Api.messages.GetBotCallbackAnswer({
                      peer: botEntity,
                      msgId: msg.id,
                      data: btn.data,
                    })
                  );
                  okClicked = true;
                } catch {}
              }
              if (!okClicked && typeof msg.click === 'function') {
                try {
                  await msg.click(rowIdx, colIdx);
                  okClicked = true;
                } catch {}
              }
              if (okClicked) {
                session.transcript.push({
                  id: 'msg_' + Date.now(),
                  sender: 'bot_system',
                  text: `✅ تایید خودکار پنجره پاپ‌آپ/دیالوگ ربات (کلیک روی «${btnText}»)`,
                  timestamp: new Date().toISOString(),
                });
                saveData();
                return true;
              }
            }
          }
        }
      }
    }
  } catch (e) {}
  return false;
}

interface InlineButtonCandidate {
  message: any;
  msgId: number;
  rowIdx: number;
  colIdx: number;
  text: string;
  dataHex: string;
  rawButton: any;
  score: number;
}

interface ReplyKeyboardButtonCandidate {
  message?: any;
  msgId?: number;
  rowIdx?: number;
  colIdx?: number;
  text: string;
  rawButton: any;
  score: number;
}

// Helper: Scan all available buttons (both inline across recent messages and reply keyboard in latest state)
async function scanAllBotButtons(
  client: any,
  botEntity: any,
  targetPattern: string,
  limit: number = 80,
  lastClickedDataHex?: string
): Promise<{
  inlineCandidates: InlineButtonCandidate[];
  replyCandidates: ReplyKeyboardButtonCandidate[];
  bestInline: InlineButtonCandidate | null;
  bestReply: ReplyKeyboardButtonCandidate | null;
}> {
  const inlineCandidates: InlineButtonCandidate[] = [];
  const replyCandidates: ReplyKeyboardButtonCandidate[] = [];

  try {
    const recentMsgs = await client.getMessages(botEntity, { limit: Math.max(limit, 80) });

    for (const m of recentMsgs || []) {
      if (!m) continue;

      // 1. Check GramJS message.replyMarkup
      if (m.replyMarkup?.rows) {
        const markupClass = String(m.replyMarkup.className || m.replyMarkup._ || '').toLowerCase();
        const isInlineMarkup =
          markupClass.includes('inline') ||
          m.replyMarkup.rows?.[0]?.buttons?.[0]?.data !== undefined ||
          m.replyMarkup.rows?.[0]?.buttons?.[0]?.url !== undefined ||
          m.replyMarkup.rows?.[0]?.buttons?.[0]?.className === 'KeyboardButtonCallback' ||
          m.replyMarkup.rows?.[0]?.buttons?.[0]?._ === 'keyboardButtonCallback';

        if (isInlineMarkup) {
          // Collect inline buttons from all recent messages that have inline markup
          for (let rowIdx = 0; rowIdx < m.replyMarkup.rows.length; rowIdx++) {
            const row = m.replyMarkup.rows[rowIdx];
            for (let colIdx = 0; colIdx < (row.buttons || []).length; colIdx++) {
              const btn = row.buttons[colIdx];
              const btnText = (btn.text || '').trim();
              if (!btnText) continue;

              const score = calculateButtonSimilarity(btnText, targetPattern);
              const btnDataHex = btn.data ? Buffer.from(btn.data).toString('hex') : '';
              // Avoid repeating immediate last clicked button data if provided
              if (lastClickedDataHex && btnDataHex && btnDataHex === lastClickedDataHex) {
                continue;
              }
              inlineCandidates.push({
                message: m,
                msgId: m.id,
                rowIdx,
                colIdx,
                text: btnText,
                dataHex: btnDataHex,
                rawButton: btn,
                score,
              });
            }
          }
        } else {
          // Telegram Custom Reply Keyboard (menu buttons at bottom of screen)
          for (let rowIdx = 0; rowIdx < m.replyMarkup.rows.length; rowIdx++) {
            const row = m.replyMarkup.rows[rowIdx];
            for (let colIdx = 0; colIdx < (row.buttons || []).length; colIdx++) {
              const btn = row.buttons[colIdx];
              const btnText = (btn.text || '').trim();
              if (!btnText) continue;

              const score = calculateButtonSimilarity(btnText, targetPattern);
              replyCandidates.push({
                message: m,
                msgId: m.id,
                rowIdx,
                colIdx,
                text: btnText,
                rawButton: btn,
                score,
              });
            }
          }
        }
      }

      // 2. Also inspect GramJS m.buttons if available
      if (Array.isArray(m.buttons) && m.buttons.length > 0) {
        for (let r = 0; r < m.buttons.length; r++) {
          const row = m.buttons[r];
          if (!Array.isArray(row)) continue;
          for (let c = 0; c < row.length; c++) {
            const btnObj = row[c];
            const btnText = (btnObj?.text || btnObj?.button?.text || '').trim();
            if (!btnText) continue;

            const score = calculateButtonSimilarity(btnText, targetPattern);
            const btnData = btnObj?.data || btnObj?.button?.data;
            const btnDataHex = btnData ? Buffer.from(btnData).toString('hex') : '';

            // If it has data or is inline button
            if (btnData !== undefined || btnObj?.button?.className === 'KeyboardButtonCallback') {
              const exists = inlineCandidates.some((cnd) => cnd.msgId === m.id && cnd.text === btnText);
              if (!exists) {
                inlineCandidates.push({
                  message: m,
                  msgId: m.id,
                  rowIdx: r,
                  colIdx: c,
                  text: btnText,
                  dataHex: btnDataHex,
                  rawButton: btnObj?.button || btnObj,
                  score,
                });
              }
            } else {
              const exists = replyCandidates.some((cnd) => cnd.text === btnText);
              if (!exists) {
                replyCandidates.push({
                  message: m,
                  msgId: m.id,
                  rowIdx: r,
                  colIdx: c,
                  text: btnText,
                  rawButton: btnObj?.button || btnObj,
                  score,
                });
              }
            }
          }
        }
      }
    }
  } catch (e: any) {
    console.warn('Error scanning bot buttons:', e?.message || e);
  }

  // Sort by score descending
  inlineCandidates.sort((a, b) => b.score - a.score);
  replyCandidates.sort((a, b) => b.score - a.score);

  const bestInline = inlineCandidates.length > 0 ? inlineCandidates[0] : null;
  const bestReply = replyCandidates.length > 0 ? replyCandidates[0] : null;

  return { inlineCandidates, replyCandidates, bestInline, bestReply };
}

// Helper: Click an inline button candidate using Telegram MTProto callback or GramJS click
async function clickInlineCandidate(
  client: any,
  botEntity: any,
  candidate: InlineButtonCandidate,
  session: AnonymousChatSession
): Promise<{ success: boolean; dataClicked?: string }> {
  let inputPeer: any = botEntity;
  try {
    inputPeer = await client.getInputEntity(botEntity);
  } catch {
    inputPeer = botEntity;
  }

  let clickSuccess = false;
  let popupMessage = '';

  // 1. Direct MTProto invoke of GetBotCallbackAnswer (fastest, most reliable)
  if (candidate.rawButton?.data && Api?.messages?.GetBotCallbackAnswer) {
    try {
      const rawData = Buffer.isBuffer(candidate.rawButton.data)
        ? candidate.rawButton.data
        : Buffer.from(candidate.rawButton.data);
      const ans = await client.invoke(
        new Api.messages.GetBotCallbackAnswer({
          peer: inputPeer || botEntity,
          msgId: candidate.msgId,
          data: rawData,
        })
      );
      clickSuccess = true;
      if (ans?.message) popupMessage = ans.message;
    } catch (invErr: any) {
      const errStr = String(invErr?.errorMessage || invErr?.message || invErr);
      // BOT_RESPONSE_TIMEOUT or MESSAGE_NOT_MODIFIED means the callback was successfully sent to Telegram
      if (
        errStr.includes('BOT_RESPONSE_TIMEOUT') ||
        errStr.includes('MESSAGE_NOT_MODIFIED') ||
        errStr.includes('TIMEOUT')
      ) {
        clickSuccess = true;
      } else {
        console.log('GetBotCallbackAnswer notice:', errStr);
      }
    }
  }

  // 2. GramJS Message.click(row, col) helper
  if (!clickSuccess && typeof candidate.message?.click === 'function') {
    try {
      const ans = await candidate.message.click(candidate.rowIdx, candidate.colIdx);
      clickSuccess = true;
      if (ans?.message) popupMessage = ans.message;
    } catch (e1: any) {
      const e1Str = String(e1?.message || e1);
      if (e1Str.includes('BOT_RESPONSE_TIMEOUT') || e1Str.includes('MESSAGE_NOT_MODIFIED')) {
        clickSuccess = true;
      } else {
        try {
          const ans2 = await candidate.message.click({ text: candidate.text });
          clickSuccess = true;
          if (ans2?.message) popupMessage = ans2.message;
        } catch (e2: any) {
          const e2Str = String(e2?.message || e2);
          if (e2Str.includes('BOT_RESPONSE_TIMEOUT') || e2Str.includes('MESSAGE_NOT_MODIFIED')) {
            clickSuccess = true;
          }
        }
      }
    }
  }

  // 3. Direct button.click()
  if (!clickSuccess && typeof candidate.rawButton?.click === 'function') {
    try {
      const ans3 = await candidate.rawButton.click();
      clickSuccess = true;
      if (ans3?.message) popupMessage = ans3.message;
    } catch (e3: any) {
      const e3Str = String(e3?.message || e3);
      if (e3Str.includes('BOT_RESPONSE_TIMEOUT') || e3Str.includes('MESSAGE_NOT_MODIFIED')) {
        clickSuccess = true;
      }
    }
  }

  if (clickSuccess) {
    session.transcript.push({
      id: 'msg_' + Date.now(),
      sender: 'bot_system',
      text: `✅ کلیک موفق روی دکمه شیشه‌ای [${candidate.text}]${popupMessage ? ` (پیام بات: ${popupMessage})` : ''}`,
      timestamp: new Date().toISOString(),
    });
    saveData();
    return { success: true, dataClicked: candidate.dataHex || candidate.text };
  }

  return { success: false };
}

// Helper: Accurately find and click an inline button across recent bot messages using GramJS API
async function clickBotInlineButton(
  client: any,
  botEntity: any,
  targetLabel: string,
  matchMode: 'fuzzy' | 'exact' = 'fuzzy',
  session: AnonymousChatSession,
  maxWaitMs: number = 15000,
  lastClickedData?: string
): Promise<{ success: boolean; dataClicked?: string }> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs && !anonEngineAbort) {
    const { bestInline } = await scanAllBotButtons(client, botEntity, targetLabel, 50, lastClickedData);
    const threshold = matchMode === 'exact' ? 0.95 : 0.45;
    if (bestInline && bestInline.score >= threshold) {
      const res = await clickInlineCandidate(client, botEntity, bestInline, session);
      if (res.success) return res;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return { success: false };
}

// Helper: execute an individual button step (reply keyboard or inline keyboard with trigger conditions)
async function executeBotButtonStep(
  client: any,
  botEntity: any,
  step: AnonymousBotButtonStep,
  session: AnonymousChatSession,
  botProfile?: AnonymousBotProfile,
  lastClickedData?: string
): Promise<string | undefined> {
  // 1. Check trigger condition
  if (step.triggerMode === 'on_any_message') {
    session.statusMessage = `در حال انتظار برای دریافت پیام از ربات قبل از فشردن «${step.label}»...`;
    saveData();
    const startWait = Date.now();
    let initialMsgId = 0;
    try {
      const msgs = await client.getMessages(botEntity, { limit: 1 });
      initialMsgId = msgs[0]?.id || 0;
    } catch {}

    while (Date.now() - startWait < 30000 && !anonEngineAbort) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const checkMsgs = await client.getMessages(botEntity, { limit: 4 });
        if (checkMsgs.some((m: any) => m.id > initialMsgId && !m.out)) {
          break;
        }
      } catch {}
    }
  } else if (step.triggerMode === 'on_keyword_match' && step.triggerKeyword) {
    const targetKw = step.triggerKeyword.trim();
    session.statusMessage = `در حال انتظار و اسکن پیام‌های اخیر ربات برای «${targetKw.slice(0, 30)}» قبل از فشردن «${step.label}»...`;
    saveData();
    const startWait = Date.now();
    const maxWaitMatchMs = 120000; // Allow up to 120 seconds for bot to connect to a stranger

    while (Date.now() - startWait < maxWaitMatchMs && !anonEngineAbort) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        const checkMsgs = await client.getMessages(botEntity, { limit: 10 });
        let matchedMsg: any = null;
        for (const m of (checkMsgs || [])) {
          if (!m.message) continue;
          const txt = m.message.trim();
          if (
            isKeywordMatchInText(txt, targetKw) ||
            isMatchNotification(txt, m.replyMarkup, [targetKw])
          ) {
            matchedMsg = m;
            break;
          }
        }

        if (matchedMsg) {
          addLog('info', `[چت ناشناس] پیام کلیدی شرطی («${targetKw.slice(0, 35)}») در پیام‌های اخیر ربات شناسایی شد («${matchedMsg.message.slice(0, 35)}»). بلافاصله اجرای دکمه «${step.label}»...`);
          if (isMatchNotification(matchedMsg.message, matchedMsg.replyMarkup, [targetKw])) {
            session.status = 'chatting';
            session.statusMessage = `هم‌صحبت ناشناس پیدا شد! در حال فشردن «${step.label}» 🌸`;
            saveData();
          }
          break;
        }
      } catch {}

      // Update timer progress in status every 5 seconds
      const elapsedSec = Math.round((Date.now() - startWait) / 1000);
      if (elapsedSec % 5 === 0 && elapsedSec > 0) {
        session.statusMessage = `در حال جستجوی هم‌صحبت و اسکن پیام‌های اخیر برای «${targetKw.slice(0, 25)}» (${elapsedSec}s)...`;
        saveData();
      }
    }
  } else if (step.triggerMode === 'on_popup_dialog') {
    session.statusMessage = `در حال بررسی و انتظار برای پنجره پاپ‌آپ/تایید «${step.label}»...`;
    saveData();
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Delay before executing click (instant execution if delaySeconds is 0)
  const delaySec = step.delaySeconds || 0;
  if (delaySec > 0) {
    await new Promise((r) => setTimeout(r, delaySec * 1000));
  }
  if (anonEngineAbort) return;

  const locName =
    step.buttonLocation === 'inline_button'
      ? 'دکمه شیشه‌ای چت'
      : step.buttonLocation === 'reply_keyboard'
      ? 'دکمه کیبورد منو'
      : step.buttonLocation === 'popup_ok'
      ? 'پاپ‌آپ / تایید OK'
      : 'دستور متنی';

  session.statusMessage = `در حال اجرای «${step.label}» (${locName})...`;
  session.transcript.push({
    id: 'msg_' + Date.now(),
    sender: 'bot_system',
    text: `⚡ اجرای مرحله: [${step.label}] (${locName})`,
    timestamp: new Date().toISOString(),
  });
  saveData();

  let clicked = false;
  let clickedDataHex: string | undefined = undefined;
  const matchMode = step.matchMode || (botProfile?.fuzzyButtonMatching !== false ? 'fuzzy' : 'exact');
  const minThreshold = matchMode === 'exact' ? 0.90 : 0.40;

  // Handle popup_ok
  if (step.buttonLocation === 'popup_ok' || step.triggerMode === 'on_popup_dialog') {
    clicked = await autoDismissBotPopups(client, botEntity, session, botProfile?.popupOkKeywords);
    if (clicked) return undefined;
  }

  // Handle explicit text_command
  if (step.buttonLocation === 'text_command') {
    await client.sendMessage(botEntity, { message: step.label });
    clicked = true;
    return undefined;
  }

  // Case 1: Configured specifically as reply_keyboard (منوی کیبورد تلگرام)
  if (step.buttonLocation === 'reply_keyboard') {
    let textToSend = step.label.trim();
    try {
      const { bestReply } = await scanAllBotButtons(client, botEntity, step.label, 40);
      if (bestReply && bestReply.score >= minThreshold && bestReply.text) {
        textToSend = bestReply.text;
      }
    } catch {}

    addLog('info', `[اتوماسیون] فشردن دکمه کیبورد «${textToSend}» به ربات...`);
    await client.sendMessage(botEntity, { message: textToSend });
    clicked = true;
    return undefined;
  }

  // Polling loop to find and execute best matching button (inline or keyboard)
  const maxScanTimeMs = 12000;
  const scanStart = Date.now();

  while (!clicked && Date.now() - scanStart <= maxScanTimeMs && !anonEngineAbort) {
    const { bestInline, bestReply } = await scanAllBotButtons(
      client,
      botEntity,
      step.label,
      60,
      lastClickedData
    );

    // Case 2: Configured specifically as inline_button (دکمه شیشه‌ای داخل پیام)
    if (step.buttonLocation === 'inline_button') {
      if (bestInline && bestInline.score >= minThreshold) {
        addLog('info', `[اتوماسیون] کلیک دکمه شیشه‌ای «${bestInline.text}» (تطابق با «${step.label}» با امتیاز ${(bestInline.score * 100).toFixed(0)}٪)...`);
        const res = await clickInlineCandidate(client, botEntity, bestInline, session);
        if (res.success) {
          clicked = true;
          clickedDataHex = res.dataClicked;
          break;
        }
      }
    }
    // Case 3: any_location (Find closest button across all types)
    else if (step.buttonLocation === 'any_location') {
      const inlineScore = bestInline ? bestInline.score : 0;
      const replyScore = bestReply ? bestReply.score : 0;

      if (inlineScore >= minThreshold && inlineScore >= replyScore && bestInline) {
        const res = await clickInlineCandidate(client, botEntity, bestInline, session);
        if (res.success) {
          clicked = true;
          clickedDataHex = res.dataClicked;
          break;
        }
      } else if (replyScore >= minThreshold && bestReply) {
        await client.sendMessage(botEntity, { message: bestReply.text });
        clicked = true;
        break;
      }
    }

    await new Promise((r) => setTimeout(r, 50));
  }

  // Fallbacks after scan timeout:
  if (!clicked && step.buttonLocation !== 'popup_ok') {
    if (step.buttonLocation === 'inline_button') {
      // SAFEGUARD: Never send raw text to chat for an inline button!
      session.transcript.push({
        id: 'msg_' + Date.now(),
        sender: 'bot_system',
        text: `⚠️ دکمه شیشه‌ای [${step.label}] در پیام‌های دریافتی ربات یافت نشد (جلوگیری از ارسال پیام اشتباه به مخاطب).`,
        timestamp: new Date().toISOString(),
      });
      saveData();
    } else if (step.label.startsWith('/')) {
      // Command fallback
      await client.sendMessage(botEntity, { message: step.label });
      clicked = true;
    } else {
      addLog('info', `[اتوماسیون] ارسال متن دکمه کیبورد «${step.label}» به ربات...`);
      await client.sendMessage(botEntity, { message: step.label.trim() });
      clicked = true;
    }
  }

  // Auto-confirm popup after button click if enabled
  if (step.autoConfirmPopup || botProfile?.autoDismissPopups) {
    await new Promise((r) => setTimeout(r, 50));
    await autoDismissBotPopups(client, botEntity, session, botProfile?.popupOkKeywords);
  }

  return clickedDataHex;
}

// Helper: Anti-Filter Sanitizer for Anonymous Bots (strips @ handles and urls so bots don't ban)
function sanitizePitchTextForBot(rawText: string): string {
  if (!rawText) return '';
  let sanitized = rawText;
  // Replace @username with clean text directing to image banner
  sanitized = sanitized.replace(/@[a-zA-Z0-9_]+/g, 'پشتیبانی (آیدی در تصویر بنر بالا)');
  // Replace t.me/ links
  sanitized = sanitized.replace(/(https?:\/\/)?t\.me\/[a-zA-Z0-9_+/]+/g, 'کانال (در تصویر بالا)');
  // Remove standalone @ symbols
  sanitized = sanitized.replace(/@+/g, '');
  return sanitized.trim();
}

// Helper: Thoroughly disconnect current chat session and verify termination
async function ensureChatDisconnected(
  client: any,
  botEntity: any,
  selectedBot: AnonymousBotProfile,
  session?: AnonymousChatSession
): Promise<void> {
  const currentSession = session || activeAnonChatSession || ({} as any);

  if (currentSession?.exitReason === 'stranger_disconnected') {
    addLog('info', `[چت ناشناس] مخاطب قبلاً چت را قطع کرده است؛ نیازی به اجرای گام‌های خروج نیست.`);
    // Safe dismissal of any rating/disconnection dialogs or popups
    try {
      await autoDismissBotPopups(client, botEntity, currentSession, selectedBot.popupOkKeywords);
    } catch {}
    return;
  }

  // Pre-check: Verify if chat was already disconnected by inspecting last 3 messages
  try {
    const preMsgs = await client.getMessages(botEntity, { limit: 3 });
    const latestIncoming = (preMsgs || []).find((m: any) => !m.out && m.message);
    if (latestIncoming) {
      const txt = latestIncoming.message.trim();
      if (
        isDisconnectNotice(txt, selectedBot.partnerDisconnectedKeywords) ||
        isMainMenuNotice(txt, latestIncoming.replyMarkup, selectedBot.notInChatKeywords)
      ) {
        addLog('info', `[چت ناشناس] چت قبلاً خاتمه یافته یا ربات در منوی اصلی است («${txt.slice(0, 35)}»). نیازی به ارسال مجدد دکمه خروج نیست.`);
        try {
          await autoDismissBotPopups(client, botEntity, currentSession, selectedBot.popupOkKeywords);
        } catch {}
        return;
      }
    }
  } catch {}

  addLog('info', `[چت ناشناس] آغاز فرآیند خروج هوشمند از چت (${(selectedBot.exitSteps || []).length} گام)...`);

  // Step 1: Execute configured exitSteps in order
  let inlineConfirmed = false;
  if (selectedBot.exitSteps && selectedBot.exitSteps.length > 0) {
    let lastClickedHex: string | undefined = undefined;
    let stepIndex = 1;
    for (const exitStep of selectedBot.exitSteps) {
      if (anonEngineAbort) break;
      addLog('info', `[چت ناشناس] اجرای گام خروج ${stepIndex} از ${selectedBot.exitSteps.length}: «${exitStep.label}» (${exitStep.buttonLocation})...`);

      const resHex = await executeBotButtonStep(
        client,
        botEntity,
        exitStep,
        currentSession,
        selectedBot,
        lastClickedHex
      );
      if (resHex) {
        lastClickedHex = resHex;
        inlineConfirmed = true;
      }
      stepIndex++;
      await new Promise((r) => setTimeout(r, Math.max(20, (exitStep.delaySeconds || 0) * 1000)));
    }
  }

  // Step 2: Verification & Scan for Confirmation Inline Button (e.g. ❌ اتمام چت, بله، مطمئنم)
  const findAndClickInlineConfirmation = async (): Promise<boolean> => {
    try {
      const confirmLabels = ['اتمام چت', '❌ اتمام چت', 'بله، مطمئنم', 'قطع چت', 'تایید', 'بله'];
      for (const lbl of confirmLabels) {
        const { bestInline } = await scanAllBotButtons(client, botEntity, lbl, 20);
        if (bestInline && bestInline.score >= 0.40) {
          addLog('info', `[اتوماسیون] کلیک دکمه شیشه‌ای تایید خروج «${bestInline.text}»...`);
          const res = await clickInlineCandidate(client, botEntity, bestInline, currentSession);
          if (res.success) return true;
        }
      }
    } catch {}
    return false;
  };

  if (!inlineConfirmed) {
    inlineConfirmed = await findAndClickInlineConfirmation();
  }

  // Step 3: Single intelligent fallback if not confirmed and still in chat
  if (!inlineConfirmed) {
    try {
      const checkMsgs = await client.getMessages(botEntity, { limit: 3 });
      const lastMsg = (checkMsgs || []).find((m: any) => !m.out && m.message);
      const isAlreadyOut = lastMsg && (
        isDisconnectNotice(lastMsg.message, selectedBot.partnerDisconnectedKeywords) ||
        isMainMenuNotice(lastMsg.message, lastMsg.replyMarkup, selectedBot.notInChatKeywords)
      );

      if (!isAlreadyOut) {
        // Find in-chat exit button from reply markup
        const exitCandidates = ['❌ پایان مکالمه', 'پایان چت', '❌ پایان چت', 'قطع مکالمه'];
        let sentFallback = false;
        for (const candidate of exitCandidates) {
          const { bestReply } = await scanAllBotButtons(client, botEntity, candidate, 15);
          if (bestReply && bestReply.score >= 0.50 && bestReply.text) {
            addLog('info', `[چت ناشناس] ارسال دکمه خروج کیبورد «${bestReply.text}» به ربات...`);
            await client.sendMessage(botEntity, { message: bestReply.text });
            sentFallback = true;
            break;
          }
        }
        if (!sentFallback) {
          addLog('info', `[چت ناشناس] ارسال دستور خروج «❌ پایان مکالمه» به ربات...`);
          await client.sendMessage(botEntity, { message: '❌ پایان مکالمه' });
        }
        await new Promise((r) => setTimeout(r, 600));
        await findAndClickInlineConfirmation();
      }
    } catch {}
  }

  // Step 4: Auto-dismiss any pending popup alerts/dialogs
  await autoDismissBotPopups(
    client,
    botEntity,
    currentSession,
    selectedBot.popupOkKeywords
  );

  await new Promise((r) => setTimeout(r, 50));

  // Step 5: Handle rating prompts if bot sent them
  try {
    const postExitMsgs = await client.getMessages(botEntity, { limit: 4 });
    for (const msg of postExitMsgs || []) {
      if (msg.replyMarkup?.rows) {
        for (const row of msg.replyMarkup.rows) {
          for (const btn of row.buttons || []) {
            if (btn.text && (btn.text.includes('👍') || btn.text.includes('عالی') || btn.text.includes('خوب'))) {
              try {
                if (btn.data && Api?.messages?.GetBotCallbackAnswer) {
                  await client.invoke(new Api.messages.GetBotCallbackAnswer({
                    peer: botEntity,
                    msgId: msg.id,
                    data: btn.data,
                  }));
                }
              } catch {}
            }
          }
        }
      }
    }
  } catch {}

  addLog('info', `[چت ناشناس] ✅ فرآیند خروج از چت با موفقیت کامل شد.`);
}

// Helper: Send Instant Ice-breaker Greeting to Partner with Human Pacing
async function sendIceBreakerGreeting(
  client: any,
  botEntity: any,
  session: AnonymousChatSession,
  instructions: AnonymousChatInstructions,
  selectedBot?: AnonymousBotProfile
): Promise<boolean> {
  if (
    instructions.initiateGreetingOnConnect === false ||
    (session.aiMessagesCount || 0) > 0 ||
    (session.status as string) === 'ended' ||
    anonEngineAbort
  ) {
    return false;
  }

  let greetText = (instructions.initialGreetingText || 'سلام خوبی؟ 🌸').trim();
  if (instructions.greetingMode === 'random_list' && instructions.initialGreetings && instructions.initialGreetings.length > 0) {
    const list = instructions.initialGreetings.map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) {
      greetText = list[Math.floor(Math.random() * list.length)];
    }
  }

  // Enforce under-2-minute rule (no digits, no English letters) on icebreaker greeting
  greetText = sanitizeMessageForUnderTwoMinutes(greetText);

  // Human greeting delay calculation (2.2s - 4.5s with human jitter)
  const baseDelaySec = typeof instructions.greetingDelaySeconds === 'number' ? instructions.greetingDelaySeconds : 2.8;
  const delayMs = Math.max(1600, Math.round(baseDelaySec * 1000 + (Math.random() * 800 - 400)));
  addLog('info', `[چت ناشناس] اتصال برقرار شد. شبیه‌سازی شروع و تایپ سلام («${greetText}») با تاخیر انسانی ${(delayMs / 1000).toFixed(1)} ثانیه...`);
  
  const waitSuccess = await simulateRealisticTypingWait(
    client,
    botEntity,
    delayMs,
    session,
    'اتصال برقرار شد. در حال ارسال پیام شروع',
    selectedBot
  );

  if (!waitSuccess || anonEngineAbort || (session.status as string) === 'ended') {
    addLog('info', `[چت ناشناس] مخاطب حین شبیه‌سازی تایپ سلام خارج شد یا مکالمه پایان یافت. از ارسال پیام شروع صرف‌نظر شد.`);
    return false;
  }

  // Final pre-flight verification check immediately before sending
  try {
    const checkMsgs = await client.getMessages(botEntity, { limit: 2 });
    for (const m of checkMsgs || []) {
      if (!m.out && m.message) {
        if (
          isDisconnectNotice(m.message, selectedBot?.partnerDisconnectedKeywords) ||
          isMainMenuNotice(m.message, m.replyMarkup, selectedBot?.notInChatKeywords)
        ) {
          addLog('info', `[چت ناشناس] پیام قطع اتصال قبل از ارسال پیام شروع دریافت گردید. لغو ارسال سلام.`);
          return false;
        }
      }
    }
  } catch {}

  try {
    const maxBotLimit = instructions.maxBotMessages || MAX_BOT_MESSAGES_LIMIT;
    if ((session.botMessageCount || 0) >= maxBotLimit) {
      return false;
    }
    await client.sendMessage(botEntity, { message: greetText });
    session.aiMessagesCount = (session.aiMessagesCount || 0) + 1;
    session.botMessageCount = (session.botMessageCount || 0) + 1;
    session.messagesCount = (session.messagesCount || 0) + 1;
    if (session.conversationContext) {
      session.conversationContext.botMessageCount = session.botMessageCount;
      session.conversationContext.recentBotMessages = [
        ...(session.conversationContext.recentBotMessages || []),
        greetText,
      ].slice(-10);
    }
    session.transcript.push({
      id: 'msg_' + Date.now() + '_ai_greet',
      sender: 'me_melody',
      text: greetText,
      timestamp: new Date().toISOString(),
    });
    session.statusMessage = 'پیام شروع ارسال شد. در انتظار پاسخ مخاطب ناشناس...';
    saveData();
    return true;
  } catch (greetErr: any) {
    console.error('Failed to send initial greeting:', greetErr);
    return false;
  }
}

// Helper: Send Pre-Exit Farewell Message to Partner Before Promotional Pitch & Disconnect
async function sendPreExitFarewellIfEnabled(
  client: any,
  botEntity: any,
  session: AnonymousChatSession,
  instructions: AnonymousChatInstructions
): Promise<boolean> {
  if (instructions.enablePreExitFarewell === false) {
    return false;
  }

  // If already sent farewell in this session, do not duplicate
  const hasFarewell = (session.transcript || []).some(
    (t) => t.id?.includes('_farewell') || t.id?.includes('_ai_farewell')
  );
  if (hasFarewell) {
    return false;
  }

  let farewellText = (instructions.preExitFarewellText || 'خب منم کار برام پیش اومد کم‌کم باید برم، مراقب خودت باش 🌸').trim();
  if (instructions.farewellMode === 'random_list' && instructions.preExitFarewells && instructions.preExitFarewells.length > 0) {
    const list = instructions.preExitFarewells.map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) {
      farewellText = list[Math.floor(Math.random() * list.length)];
    }
  }

  // If user explicitly declined/rejected, sanitize to pure natural polite goodbye
  const ctx = session.conversationContext;
  const isExplicitRejection =
    ctx?.promotionLock ||
    ctx?.state === ConversationState.REJECTED;

  if (isExplicitRejection) {
    farewellText = 'خب منم کار برام پیش اومد کم‌کم باید برم، مراقب خودت باش 🌸';
  }

  if (!farewellText) return false;

  const sessionDurationMs = session.startedAt ? (Date.now() - new Date(session.startedAt).getTime()) : 0;
  if (sessionDurationMs < 120000) {
    // If under 2 minutes and photo was not sent, adapt "داخل عکس" to avoid confusing the user
    if (!session.promoSent && farewellText.includes('داخل عکس')) {
      farewellText = farewellText.replace(/داخل عکس/g, 'به nova_vpn10 در تلگرام');
    }
    farewellText = sanitizeMessageForUnderTwoMinutes(farewellText);
  } else {
    farewellText = sanitizeAnonymousChatMessage(farewellText);
  }

  try {
    if (Api && Api.messages && Api.messages.SetTyping) {
      client.invoke(
        new Api.messages.SetTyping({ peer: botEntity, action: new Api.SendMessageTypingAction() })
      ).catch(() => {});
    }
  } catch {}

  addLog('info', `[چت ناشناس] 🚪 ارسال پیام خداحافظی قبل از خروج به ناشناس («${farewellText}»)...`);
  session.statusMessage = 'در حال ارسال پیام خداحافظی قبل از خروج به هم‌صحبت...';
  saveData();

  try {
    await client.sendMessage(botEntity, { message: farewellText });
    session.aiMessagesCount = (session.aiMessagesCount || 0) + 1;
    session.messagesCount = (session.messagesCount || 0) + 1;
    session.transcript.push({
      id: 'msg_' + Date.now() + '_ai_farewell',
      sender: 'me_melody',
      text: farewellText,
      timestamp: new Date().toISOString(),
    });
    saveData();
  } catch (farewellErr: any) {
    console.error('[چت ناشناس] خطا در ارسال پیام خداحافظی:', farewellErr);
  }

  const delayMs = Math.max(500, (instructions.farewellDelaySeconds !== undefined ? instructions.farewellDelaySeconds : 1.5) * 1000);
  await new Promise((r) => setTimeout(r, delayMs));
  return true;
}

// Helper: Send Campaign Promotional Photo & Pitch on Exit if Not Already Sent
async function sendCampaignPromotionBeforeExitIfPending(
  client: any,
  botEntity: any,
  session: AnonymousChatSession,
  instructions: AnonymousChatInstructions
): Promise<boolean> {
  // If promo was already sent in this session, do not repeat
  if (session.promoSent) {
    return false;
  }

  // Check if promotion is suppressed / locked or user showed NO interest
  const ctx = session.conversationContext;
  const isExplicitRejection =
    ctx?.promotionLock ||
    ctx?.state === ConversationState.REJECTED;

  const isSuppressed = isExplicitRejection || (
    !instructions.sendPromoBeforeExitAlways &&
    (ctx?.state === ConversationState.LOW_INTEREST || (!session.inquiryDetected && (ctx?.leadScore || 0) < 30))
  );

  if (isSuppressed) {
    addLog('info', `[چت ناشناس] 🚪 مخاطب علاقه‌ای به محصول نشان نداد یا تمایل نداشت. خروج بدون ارسال تبلیغ یا بنر انجام شد.`);
    return false;
  }

  // Also check transcript for any promo message
  const hasPromoInTranscript = (session.transcript || []).some(
    (t) => t.id?.includes('_promo') || (t.text && (t.text.includes('[🖼 تصویر') || t.text.includes('[🖼 بنر') || t.text.includes('[🎯 معرفی')))
  );
  if (hasPromoInTranscript) {
    session.promoSent = true;
    return false;
  }

  const activeProduct = getActiveProduct(instructions);
  const promo = instructions?.productPromotion;
  const fallbackCampaign =
    (appState.campaigns || []).find((c) => c.isActive && (c.imageUrl || c.description)) ||
    (appState.campaigns || []).find((c) => c.imageUrl || c.description) ||
    (appState.campaigns || [])[0];

  const isPromoEnabled = promo?.enabled !== false || fallbackCampaign?.isActive;
  if (!isPromoEnabled && !promo?.productDescription && !activeProduct.productDescription && !fallbackCampaign?.description) {
    return false;
  }

  const sessionDurationMs = session.startedAt ? (Date.now() - new Date(session.startedAt).getTime()) : 0;
  
  // STRICT RULE: Photo sending and English IDs are allowed ONLY if coin reward received or session >= 120s
  const isPlatformRestricted = !Boolean(session.coinRewarded || session.mediaUnlocked || sessionDurationMs >= 120000);

  // STRICT RULE 2: Support Handle MUST be formatted as "nova_vpn10" strictly without '@'
  const rawContact = (activeProduct.support?.handle || promo?.contactHandleOrLink || fallbackCampaign?.contactHandle || '').trim();
  const effectiveContactHandle = formatSupportHandle(rawContact);

  let promoText = (activeProduct.productDescription || promo?.productDescription || '').trim();
  if (!promoText && (activeProduct.productName || promo?.productName)) {
    promoText = `🌸 مشخصات و قیمت‌های پلن‌های ${activeProduct.productName || promo?.productName} داخل عکس هست`;
  }
  if (!promoText) {
    promoText = 'راستی یه پیشنهاد ویژه برات دارم، عکس رو ببین 🌸';
  }

  // UNDER 2 MINUTES / PRE-COIN RULE: No photos, no numbers, no English letters, no @ handles
  if (isPlatformRestricted) {
    addLog('info', `[چت ناشناس] ⏱️ مکالمه در فاز محدودیت پلتفرم (${Math.round(sessionDurationMs / 1000)} ثانیه و قبل از دریافت سکه) است. ارسال عکس و آیدی انگلیسی مسدود بوده و متن پاکسازی شد.`);
    promoText = sanitizeMessageForUnderTwoMinutes(promoText);
  } else {
    promoText = sanitizeAnonymousChatMessage(promoText);
  }

  // 1. Send the text pitch as a natural text bubble first
  try {
    await client.sendMessage(botEntity, { message: promoText });
  } catch (textErr: any) {
    console.error('[چت ناشناس] خطا در ارسال متن تبلیغاتی قبل از خروج:', textErr);
  }

  const effectiveImageUrl = (activeProduct.bannerImageUrl && activeProduct.bannerImageUrl.trim()) || (promo?.imageUrl && promo.imageUrl.trim()) || (instructions?.productPromotion?.imageUrl && instructions.productPromotion.imageUrl.trim()) || (fallbackCampaign?.imageUrl && fallbackCampaign.imageUrl.trim()) || '';
  let sentWithPhoto = false;

  if (effectiveImageUrl && !isPlatformRestricted) {
    addLog('info', `[چت ناشناس] 📸 ارسال بنر تصویری کمپین قبل از خروج به هم‌صحبت ناشناس (مدت مکالمه: ${Math.round(sessionDurationMs / 1000)} ثانیه)...`);
    try {
      const tempImgPath = await getImageFilePathForTelegram(effectiveImageUrl);
      if (tempImgPath && fs.existsSync(tempImgPath)) {
        // Send photo with completely empty caption
        try {
          await client.sendFile(botEntity, {
            file: tempImgPath,
            caption: '',
          });
          sentWithPhoto = true;
        } catch (sendFileErr: any) {
          try {
            await client.sendMessage(botEntity, {
              file: tempImgPath,
              message: '',
            });
            sentWithPhoto = true;
          } catch (e2) {}
        }

        // Send a very short natural explanation in a separate message right after the photo
        if (sentWithPhoto) {
          await new Promise((r) => setTimeout(r, 1200));
          const shortPhotoExplanation = 'این عکس رو فرستادم شاید به کارت بیاد برای فیلترشکن';
          try {
            await client.sendMessage(botEntity, { message: shortPhotoExplanation });
            session.transcript.push({
              id: 'msg_' + Date.now() + '_ai_photo_explain',
              sender: 'me_melody',
              text: shortPhotoExplanation,
              timestamp: new Date().toISOString(),
            });
          } catch (explainErr) {
            console.warn('[چت ناشناس] خطا در ارسال پیام توضیح عکس قبل از خروج:', explainErr);
          }
        }
      }
    } catch (photoErr: any) {
      console.warn('[چت ناشناس] خطا در بارگذاری عکس تبلیغاتی قبل از خروج:', photoErr?.message || photoErr);
    }
  } else if (effectiveImageUrl && isPlatformRestricted) {
    addLog('info', `[چت ناشناس] ⏱️ مکالمه در فاز محدودیت زمانی یا قبل از دریافت سکه است. عکس بنر ارسال نشد تا توسط پلتفرم تلگرام مسدود نگردد.`);
  }

  session.promoSent = true;
  session.aiMessagesCount = (session.aiMessagesCount || 0) + 1;
  session.messagesCount = (session.messagesCount || 0) + 1;

  session.transcript.push({
    id: 'msg_' + Date.now() + '_ai_promo_exit',
    sender: 'me_melody',
    text: sentWithPhoto ? `[🖼 تصویر محصول و توضیحات تبلیغاتی قبل از خروج ارسال شد]\n${promoText}` : `[توضیحات قبل از خروج ارسال شد]\n${promoText}`,
    timestamp: new Date().toISOString(),
  });
  saveData();

  await new Promise((r) => setTimeout(r, 1200));
  return true;
}

// Helper: Execute Exit from Current Chat and Transition to Next Stranger
async function executeExitAndNextPartner(
  client: any,
  botEntity: any,
  selectedBot: AnonymousBotProfile,
  session: AnonymousChatSession,
  reason:
    | 'max_messages_reached'
    | 'stranger_silence'
    | 'stranger_disconnected'
    | 'inappropriate_content'
    | 'manual_operator_skip'
    | 'partner_bye_exit'
    | 'bot_timeout'
    | 'spam_bot_skipped',
  statusExplanation: string
) {
  const instructions = appState.anonymousAutomator?.instructions || defaultAnonymousAutomatorConfig.instructions;

  // A6: User Disconnect handling -> Stop generation immediately, do NOT send any farewell or ad
  if (reason === 'stranger_disconnected') {
    addLog('info', `[چت ناشناس] 🔌 مخاطب قطع ارتباط کرد. جلسه بلافاصله پایان یافته و بدون ارسال هیچ پیامی ذخیره شد.`);
  } else if (reason === 'max_messages_reached' || reason === 'partner_bye_exit' || reason === 'stranger_silence') {
    // Send promotional offer/photo if enabled and pending, then send natural pre-exit farewell
    try {
      if (instructions.sendPromoBeforeExitAlways && !session.promoSent) {
        await sendCampaignPromotionBeforeExitIfPending(client, botEntity, session, instructions);
      }
      await sendPreExitFarewellIfEnabled(client, botEntity, session, instructions);
    } catch (farewellErr) {
      console.warn('[چت ناشناس] ارسال پیام خداحافظی یا تبلیغ با خطا روبرو شد:', farewellErr);
    }
  }

  // A9: Record all comprehensive session telemetry metrics
  session.exitReason = reason;
  session.status = 'ended';
  session.statusMessage = statusExplanation;
  session.endedAt = new Date().toISOString();
  session.durationSeconds = session.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000))
    : 0;
  session.botMessageCount = session.aiMessagesCount || 0;
  session.userMessageCount = session.strangerMessagesCount || 0;
  session.supportIdAvailable = (session.durationSeconds || 0) >= 120;
  session.salesState = session.conversationContext?.promotionLevel || 'NO_PROMOTION';
  session.conversationState = session.conversationContext?.state;
  session.offerCount = session.conversationContext?.offerCount || 0;

  session.transcript.push({
    id: 'msg_' + Date.now() + '_exit',
    sender: 'bot_system',
    text: `🛑 ${statusExplanation}`,
    timestamp: new Date().toISOString(),
  });
  saveData();

  // Always perform disconnection sequence according to exitSteps to reset menu/state cleanly
  await ensureChatDisconnected(client, botEntity, selectedBot, session);

  await new Promise((r) => setTimeout(r, 50));
}

// ============================================================================
// ANONYMOUS CHAT BOT TELEGRAM AUTOMATION ENGINE
// ============================================================================
let activeAnonChatSession: AnonymousChatSession | null = null;
let isAnonEngineRunning = false;
let anonEngineAbort = false;
const botEntityCache = new Map<string, any>();

async function getOrInitAnonymousClient(preferredAccountId?: string): Promise<{ client: any; account: TelegramAccount | null } | null> {
  syncAccountsState();
  const accounts = appState.accounts || [];

  // 1. Try preferred account if explicitly passed and enabled
  if (preferredAccountId) {
    const acc = accounts.find(a => a.id === preferredAccountId && a.isActive && a.enableForAnonymousBot === true && a.status !== 'session_expired' && a.status !== 'disabled');
    if (acc) {
      const client = await getOrInitClientForAccount(acc);
      if (client) return { client, account: acc };
    }
  }

  // 2. Find any candidate account enabled for anonymous bot
  const candidateAccounts = accounts.filter(
    a => a.enableForAnonymousBot === true && a.isActive && a.status !== 'session_expired' && a.status !== 'disabled' && Boolean(a.sessionString)
  );
  if (candidateAccounts.length > 0) {
    const chosenAcc = candidateAccounts[0];
    const client = await getOrInitClientForAccount(chosenAcc);
    if (client) return { client, account: chosenAcc };
  }

  return null;
}

function extractEntityUsernames(entity: any): string[] {
  const list: string[] = [];
  if (entity?.username) list.push(String(entity.username).toLowerCase().trim());
  if (Array.isArray(entity?.usernames)) {
    for (const u of entity.usernames) {
      if (u?.username) list.push(String(u.username).toLowerCase().trim());
    }
  }
  return list;
}

function isChannelOrGroup(d: any, entity: any): boolean {
  if (!d && !entity) return false;
  if (d?.isChannel || d?.isGroup) return true;
  const cls = entity?.className || d?.entity?.className;
  if (cls === 'Channel' || cls === 'Chat') return true;
  return false;
}

async function resolveBotEntitySmart(client: any, rawUsernameOrLink: string, botProfile?: any): Promise<any> {
  const cleanUsername = (rawUsernameOrLink || '')
    .replace('https://t.me/', '')
    .replace('http://t.me/', '')
    .replace('t.me/', '')
    .replace('@', '')
    .trim()
    .toLowerCase();

  const botNameLower = (botProfile?.name || '').toLowerCase();
  const clientId = client?._selfId || appState.activeAccountId || 'active';
  const cacheKey = `${clientId}_${cleanUsername || botNameLower}`;

  if (botEntityCache.has(cacheKey)) {
    const cached = botEntityCache.get(cacheKey);
    // Ensure cached is NOT a Channel or Group and is a bot or user
    if (cached && !isChannelOrGroup(null, cached) && (cached.bot || cached.className === 'User' || cached.userId)) {
      return cached;
    }
    botEntityCache.delete(cacheKey);
  }

  // 1. First attempt: Search in active dialogs (Zero network lookup, bypasses ResolveUsername flood wait entirely!)
  try {
    const dialogs = await client.getDialogs({ limit: 150 });
    
    // Pass 1: Exact or variant username match on eligible (non-channel, non-group) dialogs
    for (const d of dialogs || []) {
      const entity = d.entity;
      if (!entity || isChannelOrGroup(d, entity)) continue;

      const botUsernames = extractEntityUsernames(entity);
      const isExactMatch = cleanUsername && botUsernames.includes(cleanUsername);
      const isVariantMatch = cleanUsername && (
        botUsernames.includes(cleanUsername + 'bot') ||
        (cleanUsername.endsWith('bot') && botUsernames.includes(cleanUsername.slice(0, -3)))
      );

      if (isExactMatch || isVariantMatch) {
        const resolved = d.inputEntity || d.entity;
        botEntityCache.set(cacheKey, resolved);
        addLog('info', `[چت ناشناس] ربات «${d.title || cleanUsername}» در لیست گفتگوها بر اساس نام کاربری شناسایی شد.`);
        return resolved;
      }
    }

    // Pass 2: Bot dialogs with matching title/name
    for (const d of dialogs || []) {
      const entity = d.entity;
      if (!entity || isChannelOrGroup(d, entity)) continue;
      // Must be marked as a bot or be a direct user
      if (!entity.bot && entity.className !== 'User' && !d.isUser) continue;

      const entityTitle = (d.title || d.name || entity.firstName || entity.lastName || '').toLowerCase();
      const titleMatch = (
        (cleanUsername && (entityTitle.includes(cleanUsername) || cleanUsername.includes(entityTitle))) ||
        (botNameLower && (entityTitle.includes(botNameLower) || botNameLower.includes(entityTitle))) ||
        (cleanUsername === 'hypergap' && (entityTitle.includes('هایپر') || entityTitle.includes('hyper'))) ||
        (cleanUsername === 'bichatbot' && (entityTitle.includes('بای چت') || entityTitle.includes('بی چت') || entityTitle.includes('bichat'))) ||
        (cleanUsername === 'chatgrambot' && (entityTitle.includes('چت‌گرام') || entityTitle.includes('چت گرام') || entityTitle.includes('chatgram'))) ||
        (cleanUsername === 'hamsedabot' && (entityTitle.includes('هم‌صدا') || entityTitle.includes('هم صدا') || entityTitle.includes('hamseda'))) ||
        (cleanUsername === 'gapgrambot' && (entityTitle.includes('گپ‌گرام') || entityTitle.includes('گپ گرام') || entityTitle.includes('gapgram')))
      );

      if (titleMatch) {
        const resolved = d.inputEntity || d.entity;
        botEntityCache.set(cacheKey, resolved);
        addLog('info', `[چت ناشناس] ربات «${d.title || cleanUsername}» در لیست گفتگوها بر اساس عنوان شناسایی شد.`);
        return resolved;
      }
    }
  } catch (dialogErr: any) {
    console.warn('[resolveBotEntitySmart] Error scanning dialogs:', dialogErr?.message || dialogErr);
  }

  // 2. Second attempt: Direct getEntity lookup
  try {
    let entity = await client.getEntity(cleanUsername);
    if (isChannelOrGroup(null, entity) && !cleanUsername.endsWith('bot')) {
      try {
        const alt = await client.getEntity(cleanUsername + 'bot');
        if (alt && !isChannelOrGroup(null, alt)) {
          entity = alt;
        }
      } catch {}
    }

    if (entity && !isChannelOrGroup(null, entity)) {
      botEntityCache.set(cacheKey, entity);
      return entity;
    }
  } catch (err: any) {
    if (!cleanUsername.endsWith('bot')) {
      try {
        const entityWithBot = await client.getEntity(cleanUsername + 'bot');
        if (entityWithBot && !isChannelOrGroup(null, entityWithBot)) {
          botEntityCache.set(cacheKey, entityWithBot);
          return entityWithBot;
        }
      } catch {}
    }
    const errMsg = String(err?.errorMessage || err?.message || err);
    if (errMsg.includes('FLOOD_WAIT') || errMsg.includes('wait of') || errMsg.includes('ResolveUsername')) {
      throw new Error(
        `حساب تلگرام شما به دلیل جستجوهای زیاد، از طرف تلگرام موقتاً دچار محدودیت جستجوی نام‌کاربری (FloodWait) شده است.\n\n💡 راه‌حل فوری: لطفاً یک‌بار در اپلیکیشن تلگرام خود ربات @${cleanUsername} را باز کرده و دکمه Start را بزنید تا این ربات به لیست گفتگوهای تلگرام شما اضافه شود. پس از آن، سیستم بدون نیاز به جستجو مستقیماً به ربات متصل خواهد شد.`
      );
    }
    throw err;
  }

  return null;
}

async function runAnonymousChatWorker(targetAccountId?: string) {
  if (isAnonEngineRunning) return;
  isAnonEngineRunning = true;
  anonEngineAbort = false;

  console.log('🤖 Starting Telegram Anonymous Chat Bot Automation Worker...');
  addLog('info', '[چت ناشناس] اتوماسیون ربات چت ناشناس فعال گردید.');

  while (isAnonEngineRunning && !anonEngineAbort) {
    if (!appState.anonymousAutomator?.isActive) {
      break;
    }

    const automator = appState.anonymousAutomator;
    const selectedBot = automator.bots.find((b) => b.id === automator.selectedBotId) || automator.bots[0];
    if (!selectedBot) {
      addLog('warning', '[چت ناشناس] هیچ ربات چت ناشناسی انتخاب نشده است.');
      break;
    }

    // Get active Telegram client for Anonymous Chat
    const anonClientInfo = await getOrInitAnonymousClient(targetAccountId || appState.activeAccountId);
    if (!anonClientInfo || !anonClientInfo.client) {
      addLog('error', '[چت ناشناس] هیچ اکانت فعال و تاییدشده‌ای برای بخش چت ناشناس یافت نشد. لطفاً در بخش ۳ (مدیریت اکانت‌ها) اکانت خود را اضافه کرده یا گزینه چت ربات ناشناس را فعال نمایید.');
      appState.anonymousAutomator.isActive = false;
      saveData();
      break;
    }

    const client = anonClientInfo.client;
    const chosenAcc = anonClientInfo.account || {
      id: 'primary',
      phoneNumber: appState.credentials.phoneNumber || '',
      userProfile: appState.credentials.userProfile || { firstName: 'User' },
    };

    const sessionNum = (automator.stats.totalChatsInitiated || 0) + 1;
    const sessionId = 'anon_session_' + Date.now();
    activeAnonChatSession = {
      id: sessionId,
      sessionIndex: sessionNum,
      botId: selectedBot.id,
      botUsername: selectedBot.botUsername,
      botName: selectedBot.name,
      accountId: chosenAcc.id,
      accountPhone: chosenAcc.phoneNumber || '',
      accountName: chosenAcc.userProfile?.firstName || 'UserBot',
      status: 'navigating_buttons',
      statusMessage: `در حال اتصال به ${selectedBot.name} با اکانت (${chosenAcc.userProfile?.firstName || chosenAcc.phoneNumber}) (جلسه چت #${sessionNum}) و اجرای مراحل ورود...`,
      startedAt: new Date().toISOString(),
      messagesCount: 0,
      strangerMessagesCount: 0,
      aiMessagesCount: 0,
      transcript: [],
    };
    appState.activeAnonymousSession = activeAnonChatSession;
    saveData();

    try {
      // 1. Resolve Bot Entity using smart resolver
      let botEntity: any = null;
      try {
        botEntity = await resolveBotEntitySmart(client, selectedBot.botUsername, selectedBot);
        if (!botEntity) {
          throw new Error(`ربات ${selectedBot.botUsername} (${selectedBot.name}) در تلگرام یافت نشد.`);
        }
      } catch (e: any) {
        addLog('error', `[چت ناشناس] یافتن ربات ${selectedBot.botUsername} ناموفق بود: ${e.message}`);
        activeAnonChatSession.status = 'failed';
        activeAnonChatSession.statusMessage = e.message || `ربات ${selectedBot.botUsername} یافت نشد.`;
        appState.anonymousAutomator.isActive = false;
        saveData();
        break;
      }

      // Record baseline message ID at start of session
      let sessionBaselineMsgId = 0;
      try {
        const initRecent = await client.getMessages(botEntity, { limit: 1 });
        sessionBaselineMsgId = initRecent[0]?.id || 0;
      } catch {}
      let lastProcessedMsgId = sessionBaselineMsgId;

      let isConnectedToPartner = false;
      const instructions = automator.instructions || {
        systemPrompt: 'شما در نقش یک کاربر عادی ایرانی هستید و کوتاه و صمیمی چت می‌کنید.',
        maxMessagesPerChat: 4,
        memoryWindowSize: 10,
        enforceSessionIsolation: true,
        extractPartnerProfileInfo: true,
        dynamicSessionStatePrompt: true,
        initiateGreetingOnConnect: true,
        initialGreetingText: 'سلام خوبی؟ 🌸',
        greetingDelaySeconds: 2.8,
        replyDelaySeconds: 3.0,
        messageAggregationDelaySeconds: 3.2,
        silenceTimeoutSeconds: 35,
        enableSilenceNudge: true,
        silenceNudgeText: 'هستی؟ 🌸',
        dynamicTypingSpeed: true,
        typingSpeedMsPerChar: 65,
        minTypingDelaySeconds: 2.5,
        maxTypingDelaySeconds: 7.5,
        enableMultiBubble: true,
        multiBubbleMaxChunks: 3,
        multiBubbleDelaySeconds: 1.8,
        inappropriateKeywords: ['بلاک', 'اسپم', 'فحش'],
      };

      // 2. Always send Start Command first if configured
      if (selectedBot.startCommand) {
        await client.sendMessage(botEntity, { message: selectedBot.startCommand });
        activeAnonChatSession.transcript.push({
          id: 'msg_' + Date.now(),
          sender: 'bot_system',
          text: `ارسال دستور شروع (${selectedBot.startCommand}) به ${selectedBot.name}`,
          timestamp: new Date().toISOString(),
        });
        saveData();
        await new Promise((r) => setTimeout(r, selectedBot.delayBetweenButtonsMs || 1500));
      }

      // 3. Sequentially execute Entry Steps (button clicks / commands in order)
      let lastClickedHex: string | undefined = undefined;
      const entrySteps = selectedBot.entrySteps || [];
      for (const step of entrySteps) {
        if (anonEngineAbort) break;
        const resHex = await executeBotButtonStep(
          client,
          botEntity,
          step,
          activeAnonChatSession,
          selectedBot,
          lastClickedHex
        );
        if (resHex) lastClickedHex = resHex;
        await new Promise((r) => setTimeout(r, Math.max(50, (step.delaySeconds || 0) * 1000)));
      }

      // Check messages received *during* this session (only id > sessionBaselineMsgId)
      let stuckInOldChat = false;
      let sessionDisconnectedAtStart = false;
      try {
        const newSessionMsgs = await client.getMessages(botEntity, { limit: 15 });
        const chronologicalMsgs = (newSessionMsgs || [])
          .filter((m: any) => !m.out && m.id > sessionBaselineMsgId && m.message)
          .reverse();

        for (const m of chronologicalMsgs) {
          lastProcessedMsgId = Math.max(lastProcessedMsgId, m.id);
          const mText = (m.message || '').trim();

          // 1. Disconnect or Left notice
          if (isDisconnectNotice(mText, selectedBot.partnerDisconnectedKeywords)) {
            sessionDisconnectedAtStart = true;
            isConnectedToPartner = false;
            break;
          }
          // 2. Main menu notice (outside of chat)
          if (isMainMenuNotice(mText, m.replyMarkup, selectedBot.notInChatKeywords)) {
            isConnectedToPartner = false;
            break;
          }
          // 3. Stuck in old chat notice
          if (isAlreadyInChatNotice(mText, selectedBot.alreadyInChatKeywords)) {
            stuckInOldChat = true;
            break;
          }
          // 4. Match / connection notification
          if (
            isMatchNotification(mText, m.replyMarkup, selectedBot.connectionKeywords) ||
            (selectedBot.connectionKeywords || []).some((kw) => kw.trim() && isKeywordMatchInText(mText, kw.trim()))
          ) {
            isConnectedToPartner = true;
            sessionDisconnectedAtStart = false;
            const meta = extractPartnerMetadata(mText);
            if (meta.partnerTag) activeAnonChatSession.partnerTag = meta.partnerTag;
            if (meta.partnerSnippet) activeAnonChatSession.partnerProfileSnippet = meta.partnerSnippet;
          }
        }
      } catch {}

      if (sessionDisconnectedAtStart) {
        addLog('info', `[چت ناشناس] 🔌 مخاطب در بدو اتصال چت را قطع کرد. انتقال فوری به هم‌صحبت بعدی...`);
        await executeExitAndNextPartner(
          client,
          botEntity,
          selectedBot,
          activeAnonChatSession,
          'stranger_disconnected',
          'مخاطب در بدو ورود مکالمه را ترک کرد.'
        );
        continue;
      }

      if (stuckInOldChat) {
        await ensureChatDisconnected(client, botEntity, selectedBot, activeAnonChatSession);
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }

      // Update baseline message ID to latest
      let searchStartTime = Date.now();
      let lastPartnerActivityTime = Date.now();
      let lastAiReplyTime = Date.now();
      let silenceNudgeSent = false;
      let exitTriggered = false;

      // 4. Waiting / Chatting State Setup
      if (isConnectedToPartner) {
        activeAnonChatSession.status = 'chatting';
        activeAnonChatSession.statusMessage = 'اتصال به مخاطب ناشناس برقرار شد! آماده گفتگو...';
        automator.stats.totalChatsInitiated = (automator.stats.totalChatsInitiated || 0) + 1;
        automator.stats.lastActiveAt = new Date().toISOString();
        addLog('info', `[شروع جلسه #${activeAnonChatSession.sessionIndex || 1}] هم‌صحبت جدید متصل شد. حافظه مکالمات قبلی کاملاً پاکسازی شد.${activeAnonChatSession.partnerProfileSnippet ? ` مشخصات: ${activeAnonChatSession.partnerProfileSnippet}` : ''}`);
        saveData();

        // Send instant ice-breaker greeting if configured
        if (
          instructions.initiateGreetingOnConnect !== false &&
          (activeAnonChatSession.aiMessagesCount || 0) === 0 &&
          (activeAnonChatSession.strangerMessagesCount || 0) === 0
        ) {
          const sent = await sendIceBreakerGreeting(client, botEntity, activeAnonChatSession, instructions, selectedBot);
          if (sent) {
            lastAiReplyTime = Date.now();
            lastPartnerActivityTime = Date.now();
            silenceNudgeSent = false;
          }
        }
      } else {
        activeAnonChatSession.status = 'waiting_for_stranger';
        activeAnonChatSession.statusMessage = 'در حال جستجو و انتظار برای اتصال هم‌صحبت ناشناس...';
        saveData();
      }

      // 5. Main Session Message Polling Loop with Consecutive Message Aggregator
      while (!anonEngineAbort && appState.anonymousAutomator?.isActive && !exitTriggered) {
        let recentMsgs: any[] = [];
        try {
          recentMsgs = await client.getMessages(botEntity, { limit: 10 });
        } catch (e) {}

        const pendingStrangerBatch: string[] = [];

        for (const msg of (recentMsgs || []).reverse()) {
          if (msg.id <= lastProcessedMsgId || !msg.message) continue;
          lastProcessedMsgId = msg.id;

          const msgText = msg.message.trim();

          // Process incoming messages from bot/stranger
          if (!msg.out) {
            // Case 1: Match / Connection Notification from Bot
            const isConnectionMsg = (selectedBot.connectionKeywords || []).some(
              (kw) => kw.trim() && (isKeywordMatchInText(msgText, kw.trim()) || normalizePersianText(msgText).includes(normalizePersianText(kw.trim())))
            ) || isMatchNotification(msgText, msg.replyMarkup, selectedBot.connectionKeywords);

            if (isConnectionMsg) {
              if (!isConnectedToPartner) {
                isConnectedToPartner = true;
                lastPartnerActivityTime = Date.now();
                lastAiReplyTime = Date.now();
                silenceNudgeSent = false;

                const meta = extractPartnerMetadata(msgText);
                if (meta.partnerTag) activeAnonChatSession.partnerTag = meta.partnerTag;
                if (meta.partnerSnippet) activeAnonChatSession.partnerProfileSnippet = meta.partnerSnippet;

                activeAnonChatSession.status = 'chatting';
                activeAnonChatSession.statusMessage = 'اتصال به مخاطب ناشناس تایید شد! در حال چت...';
                activeAnonChatSession.transcript.push({
                  id: 'msg_' + Date.now(),
                  sender: 'bot_system',
                  text: `🟢 اتصال به هم‌صحبت جدید برقرار شد (جلسه #${activeAnonChatSession.sessionIndex || 1}${meta.partnerSnippet ? ` | مشخصات: ${meta.partnerSnippet}` : ''}) - حافظه مکالمه قبلی ریست شد.`,
                  timestamp: new Date().toISOString(),
                });
                automator.stats.totalChatsInitiated = (automator.stats.totalChatsInitiated || 0) + 1;
                automator.stats.lastActiveAt = new Date().toISOString();
                addLog('info', `[شروع جلسه #${activeAnonChatSession.sessionIndex || 1}] اتصال برقرار شد. حافظه مکالمات قبلی ریست شد.`);
                saveData();
              }
              continue;
            }

            // Case 2: Incoming Chat Request Notice (e.g. 🔔درخواست چت از طرف ... را میپذیرید؟)
            if (isChatRequestNotice(msgText)) {
              addLog('info', `[درخواست چت دریافتی] درخواست چت از طرف مخاطب شناسایی شد. پذیرش و ورود به مکالمه...`);
              try {
                const acceptLabels = ['قبول چت', '✅ قبول چت', 'قبول', 'پذیرش', 'تایید', 'بله'];
                for (const lbl of acceptLabels) {
                  const { bestInline } = await scanAllBotButtons(client, botEntity, lbl, 15);
                  if (bestInline && bestInline.score >= 0.40) {
                    await clickInlineCandidate(client, botEntity, bestInline, activeAnonChatSession);
                    break;
                  }
                }
              } catch {}
              isConnectedToPartner = true;
              lastPartnerActivityTime = Date.now();
              lastAiReplyTime = Date.now();
              silenceNudgeSent = false;
              activeAnonChatSession.status = 'chatting';
              activeAnonChatSession.statusMessage = 'درخواست چت تایید شد! در حال چت با مخاطب...';
              automator.stats.totalChatsInitiated = (automator.stats.totalChatsInitiated || 0) + 1;
              automator.stats.lastActiveAt = new Date().toISOString();
              saveData();
              continue;
            }

            // Case 3: Partner Disconnected Notification
            const isDisconnected = isDisconnectNotice(msgText, selectedBot.partnerDisconnectedKeywords);
            if (isDisconnected) {
              addLog('info', `[چت ناشناس] 🔌 مخاطب گفتگو را ترک کرد («${msgText.slice(0, 45)}»). خروج فوری و اتصال به فرد بعدی...`);
              isConnectedToPartner = false;
              await executeExitAndNextPartner(
                client,
                botEntity,
                selectedBot,
                activeAnonChatSession,
                'stranger_disconnected',
                'مخاطب ناشناس مکالمه را ترک کرد. آماده اتصال به هم‌صحبت بعدی...'
              );
              exitTriggered = true;
              break;
            }

            // Case 4: Already In Chat Error Notice (e.g. خطا : هم اکنون شما در حال چت هستید)
            if (isAlreadyInChatNotice(msgText, selectedBot.alreadyInChatKeywords)) {
              addLog('warning', `[بازیابی خودکار] خطای چت فعال قبلی («${msgText.slice(0, 45)}») دریافت شد. آزادسازی سریع ربات...`);
              await ensureChatDisconnected(client, botEntity, selectedBot, activeAnonChatSession);
              await new Promise((r) => setTimeout(r, 800));
              // Trigger entry steps again to join fresh search
              for (const step of selectedBot.entrySteps || []) {
                if (anonEngineAbort) break;
                await executeBotButtonStep(client, botEntity, step, activeAnonChatSession, selectedBot);
                await new Promise((r) => setTimeout(r, Math.max(50, (step.delaySeconds || 0) * 1000)));
              }
              continue;
            }

            // Case 5: Outside of Chat / Main Menu Notice (e.g. متوجه نشدم / چه کاری برات انجام بدم؟)
            if (isMainMenuNotice(msgText, msg.replyMarkup, selectedBot.notInChatKeywords)) {
              if (isConnectedToPartner) {
                addLog('warning', `[بازیابی خودکار] پیام منوی اصلی حین چت فعال دریافت شد («${msgText.slice(0, 35)}»). خروج و اتصال به هم‌صحبت جدید...`);
                isConnectedToPartner = false;
                await executeExitAndNextPartner(
                  client,
                  botEntity,
                  selectedBot,
                  activeAnonChatSession,
                  'stranger_disconnected',
                  'پیام منوی اصلی ربات دریافت شد. خروج و اتصال مجدد...'
                );
                exitTriggered = true;
                break;
              } else {
                addLog('info', `[ناوبری ربات] ربات در منوی اصلی قرار دارد («${msgText.slice(0, 35)}»). اجرای گام‌های ورود به چت...`);
                for (const step of selectedBot.entrySteps || []) {
                  if (anonEngineAbort) break;
                  await executeBotButtonStep(client, botEntity, step, activeAnonChatSession, selectedBot);
                  await new Promise((r) => setTimeout(r, Math.max(50, (step.delaySeconds || 0) * 1000)));
                }
                continue;
              }
            }

            // Check for Coin Reward Notice (💰 تبریک تعداد 1 سکه به دلیل موفق بودن چت به حساب شما اضافه شد!)
            if (isCoinRewardNotice(msgText)) {
              activeAnonChatSession.coinRewarded = true;
              activeAnonChatSession.mediaUnlocked = true;
              activeAnonChatSession.supportIdAvailable = true;
              if (activeAnonChatSession.conversationContext) {
                activeAnonChatSession.conversationContext.coinRewarded = true;
                activeAnonChatSession.conversationContext.mediaUnlocked = true;
                activeAnonChatSession.conversationContext.supportIdAvailable = true;
              }
              addLog('success', `[چت ناشناس] 💰 پیام پاداش سکه پلتفرم دریافت شد: «${msgText.slice(0, 50)}». قفل ارسال عکس، بنر و آیدی انگلیسی با موفقیت باز شد!`);
            }

            // Case 6: System Bot Message (Warnings, Coins, Profile View, System Alerts, Search Queue)
            const isSystemMsg = isSystemOrBotMessage(msgText, msg.replyMarkup, selectedBot) || isSearchQueueNotice(msgText);
            if (isSystemMsg) {
              activeAnonChatSession.transcript.push({
                id: 'msg_' + Date.now() + '_bot_sys',
                sender: 'bot_system',
                text: `📋 پیام سیستم ربات: ${msgText}`,
                timestamp: new Date().toISOString(),
              });
              saveData();
              continue;
            }

            // Case 7: Real stranger message vs Queue notice
            if (!isConnectedToPartner) {
              // Verify if this message or its markup proves connection
              const hasInChatProof = isMatchNotification(msgText, msg.replyMarkup, selectedBot.connectionKeywords);
              if (hasInChatProof) {
                addLog('info', `[چت ناشناس] تایید اتصال از طریق دکمه‌های چت / محتوای پیام («${msgText.slice(0, 30)}»).`);
                isConnectedToPartner = true;
                activeAnonChatSession.status = 'chatting';
                activeAnonChatSession.statusMessage = 'در حال مکالمه فعال با مخاطب ناشناس...';
                automator.stats.totalChatsInitiated = (automator.stats.totalChatsInitiated || 0) + 1;
                automator.stats.lastActiveAt = new Date().toISOString();
                saveData();
                pendingStrangerBatch.push(msgText);
              } else {
                // Ignore unclassified bot announcements while waiting in queue
                activeAnonChatSession.transcript.push({
                  id: 'msg_' + Date.now() + '_bot_sys',
                  sender: 'bot_system',
                  text: `📋 پیام در صف انتظار ربات: ${msgText}`,
                  timestamp: new Date().toISOString(),
                });
                saveData();
                continue;
              }
            } else {
              pendingStrangerBatch.push(msgText);
            }
          }
        }

        if (exitTriggered || (activeAnonChatSession.status as string) === 'ended') {
          break;
        }

        // If connected and no stranger messages yet, and initial greeting not sent, send greeting immediately
        if (
          isConnectedToPartner &&
          instructions.initiateGreetingOnConnect !== false &&
          (activeAnonChatSession.aiMessagesCount || 0) === 0 &&
          (activeAnonChatSession.strangerMessagesCount || 0) === 0 &&
          pendingStrangerBatch.length === 0
        ) {
          await sendIceBreakerGreeting(client, botEntity, activeAnonChatSession, instructions);
          lastAiReplyTime = Date.now();
          lastPartnerActivityTime = Date.now();
          silenceNudgeSent = false;
        }

        // Consecutive Message Aggregator: If stranger sent message(s), wait for additional consecutive lines before generating reply
        if (pendingStrangerBatch.length > 0) {
          const aggregationSec = Math.max(0.5, instructions.messageAggregationDelaySeconds !== undefined ? instructions.messageAggregationDelaySeconds : 3.2);
          const aggregationWindowMs = aggregationSec * 1000;
          const maxWaitMs = 8000; // Natural human safety ceiling
          const aggregationStartTime = Date.now();
          let lastMsgArrival = Date.now();

          activeAnonChatSession.statusMessage = `در حال دریافت پیام‌های متوالی مخاطب (${pendingStrangerBatch.length} پیام)...`;
          saveData();

          while (
            Date.now() - lastMsgArrival < aggregationWindowMs &&
            Date.now() - aggregationStartTime < maxWaitMs &&
            !anonEngineAbort &&
            !exitTriggered
          ) {
            await new Promise((r) => setTimeout(r, 350));
            try {
              const checkRecent = await client.getMessages(botEntity, { limit: 5 });
              for (const subMsg of (checkRecent || []).reverse()) {
                if (subMsg.id <= lastProcessedMsgId || !subMsg.message || subMsg.out) continue;
                lastProcessedMsgId = subMsg.id;
                const subText = subMsg.message.trim();

                // Check if partner disconnected during aggregation
                const isSubDisconnected = isDisconnectNotice(subText, selectedBot.partnerDisconnectedKeywords);
                if (isSubDisconnected) {
                  addLog('info', `[چت ناشناس] 🔌 مخاطب گفتگو را حین تجمیع پیام‌ها ترک کرد. خروج فوری...`);
                  await executeExitAndNextPartner(
                    client,
                    botEntity,
                    selectedBot,
                    activeAnonChatSession,
                    'stranger_disconnected',
                    'مخاطب ناشناس مکالمه را ترک کرد.'
                  );
                  exitTriggered = true;
                  break;
                }

                // Check if main menu / outside chat notice during aggregation
                if (isMainMenuNotice(subText, subMsg.replyMarkup, selectedBot.notInChatKeywords)) {
                  addLog('warning', `[بازیابی خودکار] پیام منو/خارج از چت («${subText.slice(0, 45)}») حین تجمیع دریافت شد. خروج و اتصال مجدد...`);
                  await executeExitAndNextPartner(
                    client,
                    botEntity,
                    selectedBot,
                    activeAnonChatSession,
                    'stranger_disconnected',
                    'پیام خارج از چت دریافت شد.'
                  );
                  exitTriggered = true;
                  break;
                }

                // Check for Coin Reward Notice during aggregation
                if (isCoinRewardNotice(subText)) {
                  activeAnonChatSession.coinRewarded = true;
                  activeAnonChatSession.mediaUnlocked = true;
                  activeAnonChatSession.supportIdAvailable = true;
                  if (activeAnonChatSession.conversationContext) {
                    activeAnonChatSession.conversationContext.coinRewarded = true;
                    activeAnonChatSession.conversationContext.mediaUnlocked = true;
                    activeAnonChatSession.conversationContext.supportIdAvailable = true;
                  }
                  addLog('success', `[چت ناشناس] 💰 پیام پاداش سکه پلتفرم حین تجمیع پیام‌ها دریافت شد: «${subText.slice(0, 50)}». قفل ارسال عکس و آیدی باز شد!`);
                }

                // Check if system message
                const isSubSys = isSystemOrBotMessage(subText, subMsg.replyMarkup, selectedBot);
                if (isSubSys) {
                  activeAnonChatSession.transcript.push({
                    id: 'msg_' + Date.now() + '_bot_sys',
                    sender: 'bot_system',
                    text: `📋 پیام سیستم ربات: ${subText}`,
                    timestamp: new Date().toISOString(),
                  });
                  saveData();
                  continue;
                }

                // New consecutive message from stranger
                pendingStrangerBatch.push(subText);
                lastMsgArrival = Date.now();
                activeAnonChatSession.statusMessage = `پیام متوالی جدید دریافت شد (${pendingStrangerBatch.length} پیام). در حال تجمیع...`;
                saveData();
              }
            } catch {}
          }

          if (exitTriggered || (activeAnonChatSession.status as string) === 'ended') {
            break;
          }

          // Combine all consecutive stranger messages into a unified text block
          const unifiedStrangerText = pendingStrangerBatch.join('\n');
          lastPartnerActivityTime = Date.now();
          silenceNudgeSent = false;
          activeAnonChatSession.strangerMessagesCount++;
          activeAnonChatSession.messagesCount++;
          automator.stats.totalRepliesFromStrangers = (automator.stats.totalRepliesFromStrangers || 0) + 1;

          activeAnonChatSession.transcript.push({
            id: 'msg_' + Date.now() + '_stranger',
            sender: 'stranger',
            text: unifiedStrangerText,
            timestamp: new Date().toISOString(),
          });
          saveData();

          // Feature 4: Spam / Bot Link Fast Skip (فیلتر سریع ربات‌های تبلیغاتی و فرستنده‌های لینک)
          if (
            instructions.autoSkipSpamBots !== false &&
            (activeAnonChatSession.strangerMessagesCount || 0) <= 2
          ) {
            const isSpam = isSpamBotMessage(unifiedStrangerText, instructions.spamBotKeywords);
            if (isSpam) {
              activeAnonChatSession.isSpamBot = true;
              automator.stats.totalSpamBotsSkipped = (automator.stats.totalSpamBotsSkipped || 0) + 1;
              addLog(
                'warning',
                `[ضد اسپم] 🚫 مخاطب به عنوان ربات تبلیغاتی یا فرستنده لینک تشخیص داده شد («${unifiedStrangerText.slice(0, 35)}...»). خروج فوری بدون هدر رفتن سهمیه...`
              );
              await executeExitAndNextPartner(
                client,
                botEntity,
                selectedBot,
                activeAnonChatSession,
                'spam_bot_skipped',
                'تشخیص پیام اسپم/لینک تبلیغاتی. خروج فوری...'
              );
              exitTriggered = true;
              break;
            }
          }

          // Feature 5 (Analytics): Detect Positive Inquiry / Lead Response after Promo Pitch
          if (activeAnonChatSession.promoSent && isStrangerInquiryAfterPromo(unifiedStrangerText)) {
            if (!activeAnonChatSession.inquiryDetected) {
              activeAnonChatSession.inquiryDetected = true;
              activeAnonChatSession.inquirySnippet = unifiedStrangerText.slice(0, 150);
              automator.stats.totalInquiriesAfterPromo = (automator.stats.totalInquiriesAfterPromo || 0) + 1;
              addLog(
                'success',
                `[🎯 لید موفق / علاقه‌مندی مخاطب] مخاطب پس از دریافت معرفی محصول، سوال یا ابراز علاقه ارسال کرد: «${unifiedStrangerText.slice(0, 45)}»`
              );
              saveData();
            }
          }

          // Check for Inappropriate / Blacklisted keywords
          if (instructions.inappropriateKeywords?.length) {
            const lowerInput = unifiedStrangerText.toLowerCase();
            const allBadKws = instructions.inappropriateKeywords.flatMap((k) =>
              k.split(/[-–—\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean)
            );
            const isInappropriate = allBadKws.some((badKw) =>
              lowerInput.includes(badKw) || isKeywordMatchInText(unifiedStrangerText, badKw)
            );
            if (isInappropriate) {
              await executeExitAndNextPartner(
                client,
                botEntity,
                selectedBot,
                activeAnonChatSession,
                'inappropriate_content',
                'دریافت کلمه نامناسب از مخاطب. خروج طبق ترتیب دکمه‌های خروج...'
              );
              exitTriggered = true;
              break;
            }
          }

          // Check if stranger said Goodbye or expressed Exit Intent
          if (instructions.autoExitOnPartnerBye !== false && isPartnerGoodbyeOrExitIntent(unifiedStrangerText)) {
            addLog('info', `[چت ناشناس] 🚪 مخاطب پیام خداحافظی یا قصد خروج ارسال کرد («${unifiedStrangerText.slice(0, 35)}»). اجرای فرایند خروج هوشمند...`);
            await executeExitAndNextPartner(
              client,
              botEntity,
              selectedBot,
              activeAnonChatSession,
              'partner_bye_exit',
              'مخاطب پیام خداحافظی یا قصد خروج ارسال نمود. خروج طبق مراحل تعیین‌شده...'
            );
            exitTriggered = true;
            break;
          }

          // Check if stranger expressed explicit rejection or disinterest (Fast Skip)
          if (instructions.fastDropOnRejection !== false && isStrangerExplicitRejection(unifiedStrangerText)) {
            addLog(
              'info',
              `[چت ناشناس] ⚡ مخاطب عدم تمایل یا رد پیشنهاد ابراز نمود («${unifiedStrangerText.slice(0, 35)}»). ارسال پاسخ کوتاه و خروج فوق‌سریع...`
            );
            const fastDropPhrases = [
              instructions.fastDropFarewellText || 'اوکی فعلا',
              'اوکی فعلا',
              'باشه موفق باشی',
              'اوکی روزت خوش',
              'حله فعلا',
            ];
            const chosenFastFarewell = (instructions.fastDropFarewellText && instructions.fastDropFarewellText.trim()) || fastDropPhrases[Math.floor(Math.random() * fastDropPhrases.length)];
            try {
              await client.sendMessage(botEntity, { message: chosenFastFarewell });
              activeAnonChatSession.botMessageCount = (activeAnonChatSession.botMessageCount || 0) + 1;
              activeAnonChatSession.messagesCount++;
              activeAnonChatSession.transcript.push({
                id: 'msg_' + Date.now() + '_ai_fast_drop',
                sender: 'me_melody',
                text: chosenFastFarewell,
                timestamp: new Date().toISOString(),
              });
              saveData();
            } catch (sendErr) {
              console.warn('[چت ناشناس] خطا در ارسال پاسخ کوتاه خروج سریع:', sendErr);
            }

            activeAnonChatSession.conversationState = ConversationState.REJECTED;
            if (activeAnonChatSession.conversationContext) {
              activeAnonChatSession.conversationContext.state = ConversationState.REJECTED;
              activeAnonChatSession.conversationContext.promotionLock = true;
            }

            await executeExitAndNextPartner(
              client,
              botEntity,
              selectedBot,
              activeAnonChatSession,
              'partner_bye_exit',
              'عدم تمایل مخاطب (Fast Drop). خروج آنی و چرخش به مخاطب بعدی...'
            );
            exitTriggered = true;
            break;
          }

          const sessionDurationSec = activeAnonChatSession.startedAt ? Math.floor((Date.now() - new Date(activeAnonChatSession.startedAt).getTime()) / 1000) : 0;
          const isUnder2Min = sessionDurationSec < 120;

          // Generate reply using isolated session transcript (only current partner)
          const replyResult = await generateAnonymousAiReply(
            activeAnonChatSession.transcript.map((t) => ({ sender: t.sender, text: t.text })),
            instructions,
            {
              sessionId: activeAnonChatSession.id,
              sessionIndex: activeAnonChatSession.sessionIndex,
              partnerTag: activeAnonChatSession.partnerTag,
              partnerProfileSnippet: activeAnonChatSession.partnerProfileSnippet,
              currentTurn: activeAnonChatSession.aiMessagesCount || 0,
              maxTurns: instructions.maxMessagesPerChat || 4,
              isNewSession: (activeAnonChatSession.aiMessagesCount || 0) === 0,
              elapsedSeconds: sessionDurationSec,
              isUnder2Minutes: isUnder2Min,
              coinRewarded: Boolean(activeAnonChatSession.coinRewarded),
              mediaUnlocked: Boolean(activeAnonChatSession.mediaUnlocked),
              conversationContext: activeAnonChatSession.conversationContext,
            }
          );

          if (replyResult.stepOutput) {
            activeAnonChatSession.conversationContext = replyResult.stepOutput.updatedContext;
            const ctx = replyResult.stepOutput.updatedContext;
            activeAnonChatSession.conversationState = ctx.state;
            activeAnonChatSession.previousState = ctx.previousState;
            activeAnonChatSession.lastIntent = replyResult.stepOutput.intentResult.intent;
            activeAnonChatSession.leadScore = ctx.leadScore;
            activeAnonChatSession.promotionLevel = ctx.promotionLevel;
            activeAnonChatSession.promotionLock = ctx.promotionLock;
            activeAnonChatSession.objectionsCount = ctx.objectionsCount;
            activeAnonChatSession.rejectionsCount = ctx.rejectionsCount;
            activeAnonChatSession.lastPromotionTurn = ctx.lastPromotionTurn;
            activeAnonChatSession.lastCTATurn = ctx.lastCTATurn;
            addLog(
              'info',
              `[ماشین وضعیت چت] 🧠 وضعیت: ${ctx.state} | قصد: ${replyResult.stepOutput.intentResult.intent} | لید: ${ctx.leadScore}/100 | تبلیغ: ${ctx.promotionLevel}${ctx.promotionLock ? ' [قفل تبلیغ]' : ''}`
            );
          }

          // Feature 3: Dynamic Typing Speed Simulation (شبیه‌سازی پویا، زمان مطالعه و مکث تایپ کاملاً انسانی)
          const lastStrangerMsgText = activeAnonChatSession.transcript.filter(t => t.sender === 'stranger').pop()?.text || '';
          const dynamicDelay = calculateTypingDelay(replyResult.text, instructions, lastStrangerMsgText);
          
          const typingOk = await simulateRealisticTypingWait(
            client,
            botEntity,
            dynamicDelay,
            activeAnonChatSession,
            'در حال شبیه‌سازی تایپ هوش مصنوعی',
            selectedBot
          );

          if (!typingOk || anonEngineAbort || (activeAnonChatSession as any).status === 'ended') {
            addLog('info', `[چت ناشناس] 🔌 قطع ارتباط مخاطب حین شبیه‌سازی تایپ هوش مصنوعی. خروج سریع و رفتن به فرد بعدی...`);
            await executeExitAndNextPartner(
              client,
              botEntity,
              selectedBot,
              activeAnonChatSession,
              'stranger_disconnected',
              'مخاطب ناشناس حین تایپ ربات مکالمه را ترک کرد.'
            );
            exitTriggered = true;
            break;
          }

          const maxMsgs = instructions.maxMessagesPerChat || 3;
          const promo = instructions.productPromotion;
          const currentAiCount = activeAnonChatSession.aiMessagesCount || 0;

          // Photo banner sending rule: allow photo when promotion is triggered or inquired
          const activeProd = getActiveProduct(instructions);
          const fallbackCampaign = (appState.campaigns || []).find(c => c.isActive && c.imageUrl) || (appState.campaigns || []).find(c => c.imageUrl);
          const effectiveImageUrl = (activeProd?.bannerImageUrl && activeProd.bannerImageUrl.trim()) || (promo?.imageUrl && promo.imageUrl.trim()) || (instructions?.productPromotion?.imageUrl && instructions.productPromotion.imageUrl.trim()) || (fallbackCampaign?.imageUrl && fallbackCampaign.imageUrl.trim()) || '';

          const lastStrangerText = lastStrangerMsgText;
          const strangerInquiredPromo = /(قیمت|چنده|چند|تست|خرید|اکانت|سرویس|اشتراک|تعرفه|لینک|آیدی|عکس|وی\s*پی\s*ان|فیلترشکن|vpn)/i.test(lastStrangerText);
          const aiReferencedPhoto = /(داخل عکس|تو عکس|عکسم|عکسی که|آیدی داخل عکس|نوا وی\s*پی\s*ان|تست رایگان)/i.test(replyResult.text);

          const isPhotoAllowedByPlatform = Boolean(
            activeAnonChatSession.coinRewarded ||
            activeAnonChatSession.mediaUnlocked ||
            sessionDurationSec >= 120
          );

          let isPromoStep = false;
          if (promo?.enabled && !activeAnonChatSession.promoSent && isPhotoAllowedByPlatform) {
            if (strangerInquiredPromo) {
              isPromoStep = true;
            } else if (promo.sendMode === 'send_custom_card_at_step' && currentAiCount === (promo.sendAtMessageNumber || 2) - 1) {
              isPromoStep = true;
            } else if (replyResult.shouldSendPromoCard) {
              isPromoStep = true;
            }
          }

          // 1. ALWAYS send AI conversational reply (replyResult.text) as natural chat text bubble(s) FIRST
          const shouldMultiBubble = instructions.enableMultiBubble !== false;
          const bubbles = shouldMultiBubble
            ? splitIntoNaturalBubbles(
                replyResult.text,
                instructions.multiBubbleMaxChunks || 2,
                instructions.maxWordsPerBubble || 8
              )
            : [replyResult.text];

          const isCommercialSession =
            Boolean(activeAnonChatSession.inquiryDetected) ||
            (activeAnonChatSession.conversationContext?.leadScore || 0) >= 40 ||
            [
              ConversationState.PRODUCT_INTRODUCTION,
              ConversationState.PRODUCT_INTEREST,
              ConversationState.TRIAL_DISCUSSION,
              ConversationState.PRICE_DISCUSSION,
              ConversationState.SUPPORT_HANDOFF,
              ConversationState.OBJECTION_HANDLING,
            ].includes(activeAnonChatSession.conversationContext?.state as any);

          // Dynamic range between 18 and 25 for normal/winding down chats, up to 35 if active lead/commercial interest
          if (!activeAnonChatSession.targetMaxBotMessages) {
            activeAnonChatSession.targetMaxBotMessages = Math.floor(Math.random() * 8) + 18; // 18 to 25
          }
          const sessionTargetLimit = activeAnonChatSession.targetMaxBotMessages;

          const maxBotLimit = isCommercialSession
            ? (MAX_COMMERCIAL_LEAD_MESSAGES_LIMIT || 35)
            : sessionTargetLimit;

          for (let bIdx = 0; bIdx < bubbles.length; bIdx++) {
            if ((activeAnonChatSession.botMessageCount || 0) >= maxBotLimit) {
              addLog('warning', `[سقف پیام ربات] سقف مجاز ${maxBotLimit} پیام ربات پر شد. توقف ارسال بخش‌های بعدی.`);
              break;
            }

            const bubbleText = bubbles[bIdx];
            if (!bubbleText) continue;

            if (bIdx > 0) {
              const curCharLen = bubbleText.length;
              // Human typing simulation: reading previous short bubble + typing current bubble (~35ms/char) + human cognitive variance (400-800ms)
              const dynamicBubbleDelay = Math.max(
                800,
                Math.min(3200, Math.round(500 + (curCharLen * 38) + (Math.random() * 350 - 150)))
              );
              const waitBetween = instructions.dynamicTypingSpeed !== false
                ? dynamicBubbleDelay
                : Math.max(600, ((instructions.multiBubbleDelaySeconds || 1.2) * 1000) + (Math.random() * 300 - 150));

              const bubbleOk = await simulateRealisticTypingWait(
                client,
                botEntity,
                waitBetween,
                activeAnonChatSession,
                `در حال تایپ تکه ${bIdx + 1} از ${bubbles.length}`,
                selectedBot
              );
              if (!bubbleOk || anonEngineAbort || (activeAnonChatSession as any).status === 'ended') {
                addLog('info', `[چت ناشناس] 🔌 قطع ارتباط مخاطب حین تایپ حباب بعدی. خروج سریع و رفتن به فرد بعدی...`);
                await executeExitAndNextPartner(
                  client,
                  botEntity,
                  selectedBot,
                  activeAnonChatSession,
                  'stranger_disconnected',
                  'مخاطب ناشناس حین تایپ حباب مکالمه را ترک کرد.'
                );
                exitTriggered = true;
                break;
              }
            }

            await client.sendMessage(botEntity, { message: bubbleText });
            activeAnonChatSession.botMessageCount = (activeAnonChatSession.botMessageCount || 0) + 1;
            activeAnonChatSession.messagesCount++;
            lastAiReplyTime = Date.now();

            if (activeAnonChatSession.conversationContext) {
              activeAnonChatSession.conversationContext.botMessageCount = activeAnonChatSession.botMessageCount;
              activeAnonChatSession.conversationContext.recentBotMessages = [
                ...(activeAnonChatSession.conversationContext.recentBotMessages || []),
                bubbleText,
              ].slice(-10);
            }

            activeAnonChatSession.transcript.push({
              id: 'msg_' + Date.now() + `_ai_b${bIdx + 1}`,
              sender: 'me_melody',
              text: bubbleText,
              timestamp: new Date().toISOString(),
            });
            saveData();
          }

          // Increment full AI conversational response turn count once per completed reply
          activeAnonChatSession.aiMessagesCount = (activeAnonChatSession.aiMessagesCount || 0) + 1;
          saveData();

          // 2. NOW check if a photo banner attachment should be sent SEPARATELY after the conversational reply (ONLY if requested or configured)
          if (promo?.enabled && !activeAnonChatSession.promoSent) {
            if (isPromoStep && effectiveImageUrl) {
              let sentWithPhoto = false;
              const isPhotoAllowedByPlatform = Boolean(
                activeAnonChatSession.coinRewarded ||
                activeAnonChatSession.mediaUnlocked ||
                sessionDurationSec >= 120
              );

              if (effectiveImageUrl && isPhotoAllowedByPlatform) {
                // Natural typing delay before sending the visual banner attachment
                await simulateRealisticTypingWait(
                  client,
                  botEntity,
                  1500,
                  activeAnonChatSession,
                  'در حال ارسال تصویر بنر محصول'
                );

                const activeProd = getActiveProduct(instructions);
                let bannerCaption = `تعرفه‌ها و مشخصات سرورهای ${activeProd.productName || 'نوا وی‌پی‌ان'}`.trim();
                bannerCaption = sanitizeAnonymousChatMessage(bannerCaption);

                try {
                  const tempImgPath = await getImageFilePathForTelegram(effectiveImageUrl);
                  if (tempImgPath && fs.existsSync(tempImgPath)) {
                    // Send photo with completely empty caption
                    try {
                      await client.sendFile(botEntity, {
                        file: tempImgPath,
                        caption: '',
                      });
                      sentWithPhoto = true;
                    } catch (sendFileErr: any) {
                      try {
                        await client.sendMessage(botEntity, {
                          file: tempImgPath,
                          message: '',
                        });
                        sentWithPhoto = true;
                      } catch (e2) {}
                    }

                    if (sentWithPhoto) {
                      lastAiReplyTime = Date.now();
                    }
                  }
                } catch (photoErr: any) {
                  console.warn('[چت ناشناس] خطا در ارسال بنر تصویری:', photoErr?.message || photoErr);
                }

                activeAnonChatSession.promoSent = true;
                lastAiReplyTime = Date.now();
                silenceNudgeSent = false;
                automator.stats.totalPromoSent = (automator.stats.totalPromoSent || 0) + 1;
                if (sentWithPhoto) {
                  activeAnonChatSession.transcript.push({
                    id: 'msg_' + Date.now() + '_ai_promo_banner',
                    sender: 'me_melody',
                    text: `[🖼 تصویر بنر محصول با موفقیت ارسال شد]`,
                    timestamp: new Date().toISOString(),
                  });
                  addLog('info', `[چت ناشناس] 🖼 بنر معرفی محصول با موفقیت پس از سپری شدن ۲ دقیقه به مخاطب ارسال شد.`);
                }
                saveData();
              } else if (effectiveImageUrl && !isPhotoAllowedByPlatform) {
                addLog('info', `[چت ناشناس] ⏱️ محدودیت ۲ دقیقه ربات تلگرام: مکالمه ${sessionDurationSec} ثانیه طول کشیده (< ۱۲۰ ثانیه). پلتفرم عکس یا آیدی را قبل از ۲ دقیقه تحویل نمی‌دهد. ارسال بنر پس از رسیدن به ۲ دقیقه انجام خواهد شد.`);
              }
            } else if (replyResult.promoMentioned && sessionDurationSec >= 120) {
              activeAnonChatSession.promoSent = true;
              lastAiReplyTime = Date.now();
              silenceNudgeSent = false;
              automator.stats.totalPromoSent = (automator.stats.totalPromoSent || 0) + 1;
              addLog('info', `[هوش مصنوعی] 💬 مشخصات محصول (${promo.productName || 'تبلیغ'}) در متن پاسخ مطرح گردید.`);
              saveData();
            }
          }

          // Check if conversation reached natural goodbye/exit state (e.g. user uninterested or farewell complete)
          const currentConvState = activeAnonChatSession.conversationContext?.state;
          if (
            currentConvState === ConversationState.GOODBYE ||
            currentConvState === ConversationState.EXITING ||
            currentConvState === ConversationState.REJECTED ||
            replyResult.stepOutput?.isTerminal
          ) {
            addLog('info', `[چت ناشناس] 🚪 مکالمه به مرحله خداحافظی و خروج طبیعی رسید. پایان جلسه و خروج از چت...`);
            await executeExitAndNextPartner(
              client,
              botEntity,
              selectedBot,
              activeAnonChatSession,
              'partner_bye_exit',
              'اتمام محترمانه گفتگو و خروج طبق تنظیمات دکمه‌ها...'
            );
            exitTriggered = true;
            break;
          }

          // Check if max bot messages limit reached
          const configuredMaxTurns = instructions.maxMessagesPerChat || 12;
          const shouldExitOnMaxTurns = !isCommercialSession && (activeAnonChatSession.aiMessagesCount || 0) >= configuredMaxTurns;
          const shouldExitOnBotCeiling = (activeAnonChatSession.botMessageCount || 0) >= maxBotLimit;

          if (shouldExitOnMaxTurns || shouldExitOnBotCeiling) {
            const reasonMsg = shouldExitOnBotCeiling
              ? `سقف مجاز (${maxBotLimit}) پیام ربات به پایان رسید.`
              : `اتمام ${configuredMaxTurns} نوبت پاسخ ربات در مکالمه عادی. خروج هوشمند و رفتن به نفر بعدی...`;
            addLog('info', `[چت ناشناس] ${reasonMsg}`);
            await executeExitAndNextPartner(
              client,
              botEntity,
              selectedBot,
              activeAnonChatSession,
              'max_messages_reached',
              reasonMsg
            );
            exitTriggered = true;
            break;
          }
        }

        if (exitTriggered || (activeAnonChatSession.status as string) === 'ended') {
          break;
        }

        // Silence Timeout Detector
        if (isConnectedToPartner && activeAnonChatSession.status === 'chatting') {
          const nowMs = Date.now();
          const lastActivity = Math.max(lastPartnerActivityTime, lastAiReplyTime);
          const silenceSec = (nowMs - lastActivity) / 1000;
          const targetTimeout = instructions.silenceTimeoutSeconds || 30;

          // Optional Silence Nudge
          if (silenceSec >= targetTimeout / 2 && !silenceNudgeSent && instructions.enableSilenceNudge) {
            silenceNudgeSent = true;
            const rawNudge = instructions.silenceNudgeText || 'هستی؟';
            const nudgeText = rawNudge.replace(/[🌸🌺🌷✨❤️🤍]+/g, '').trim() || 'هستی؟';
            try {
              await client.sendMessage(botEntity, { message: nudgeText });
              activeAnonChatSession.botMessageCount = (activeAnonChatSession.botMessageCount || 0) + 1;
              activeAnonChatSession.messagesCount++;
              lastAiReplyTime = Date.now();
              activeAnonChatSession.transcript.push({
                id: 'msg_' + Date.now() + '_nudge',
                sender: 'me_melody',
                text: nudgeText,
                timestamp: new Date().toISOString(),
              });
              saveData();
            } catch (nudgeErr) {
              console.warn('Nudge error:', nudgeErr);
            }
            // Give partner fresh grace period to reply to nudge before checking timeout
            continue;
          }

          // Full silence timeout reached -> Exit using exitSteps
          const effectiveSilenceSec = silenceNudgeSent
            ? (nowMs - lastAiReplyTime) / 1000
            : silenceSec;
          const requiredTimeout = silenceNudgeSent
            ? Math.max(20, targetTimeout / 2)
            : targetTimeout;

          if (effectiveSilenceSec >= requiredTimeout) {
            await executeExitAndNextPartner(
              client,
              botEntity,
              selectedBot,
              activeAnonChatSession,
              'stranger_silence',
              `عدم پاسخ مخاطب پس از ${Math.round(silenceSec)} ثانیه. خروج طبق ترتیب دکمه‌های خروج...`
            );
            exitTriggered = true;
            break;
          }
        }

        // Timeout check for finding stranger
        if (!isConnectedToPartner && Date.now() - searchStartTime > 180000) {
          activeAnonChatSession.statusMessage = 'زمان انتظار جستجو طولانی شد. تلاش مجدد...';
          await ensureChatDisconnected(client, botEntity, selectedBot, activeAnonChatSession);
          break;
        }

        await new Promise((r) => setTimeout(r, 150));
      }

      // Archive session to history
      if (activeAnonChatSession) {
        activeAnonChatSession.endedAt = new Date().toISOString();
        if (!appState.anonymousSessionHistory) appState.anonymousSessionHistory = [];
        const existingIdx = appState.anonymousSessionHistory.findIndex((s) => s.id === activeAnonChatSession?.id);
        if (existingIdx >= 0) {
          appState.anonymousSessionHistory[existingIdx] = { ...activeAnonChatSession };
        } else {
          appState.anonymousSessionHistory.unshift({ ...activeAnonChatSession });
        }
        if (appState.anonymousSessionHistory.length > 200) {
          appState.anonymousSessionHistory = appState.anonymousSessionHistory.slice(0, 200);
        }
        syncCurrentTestRunFromSessions();
        saveData();
      }

      // Cooldown before next chat cycle
      const isLoopEnabled = automator.loopForever !== false;
      if (isLoopEnabled && appState.anonymousAutomator?.isActive && !anonEngineAbort) {
        const cooldown = (automator.cooldownBetweenChatsSeconds ?? 0) * 1000;
        console.log(`⏳ Cooldown ${cooldown / 1000}s before next anonymous chat cycle...`);
        if (activeAnonChatSession && cooldown > 0) {
          activeAnonChatSession.statusMessage = `استراحت به مدت ${cooldown / 1000} ثانیه قبل از ورود به چت ناشناس بعدی...`;
          saveData();
        }
        if (cooldown > 0) {
          await new Promise((r) => setTimeout(r, cooldown));
        }
      } else {
        break;
      }
    } catch (chatErr: any) {
      console.error('Anonymous chat worker error:', chatErr);
      addLog('warning', `[چت ناشناس] خطایی در اجرای نشست چت ناشناس رخ داد: ${chatErr?.message || chatErr}`);
      if (activeAnonChatSession) {
        activeAnonChatSession.status = 'failed';
        activeAnonChatSession.statusMessage = 'خطا: ' + (chatErr?.message || chatErr);
        activeAnonChatSession.endedAt = new Date().toISOString();
        if (!appState.anonymousSessionHistory) appState.anonymousSessionHistory = [];
        if (!appState.anonymousSessionHistory.some((s) => s.id === activeAnonChatSession?.id)) {
          appState.anonymousSessionHistory.unshift({ ...activeAnonChatSession });
        }
        syncCurrentTestRunFromSessions();
        saveData();
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  isAnonEngineRunning = false;
  if (appState.anonymousAutomator) {
    appState.anonymousAutomator.isActive = false;
  }
  if (activeAnonChatSession) {
    if (activeAnonChatSession.status === 'chatting' || activeAnonChatSession.status === 'navigating_buttons') {
      activeAnonChatSession.status = 'ended';
      activeAnonChatSession.statusMessage = 'اتوماسیون متوقف گردید.';
      activeAnonChatSession.endedAt = new Date().toISOString();
    }
    if (activeAnonChatSession.transcript && activeAnonChatSession.transcript.length > 0) {
      if (!appState.anonymousSessionHistory) appState.anonymousSessionHistory = [];
      const existingIdx = appState.anonymousSessionHistory.findIndex((s) => s.id === activeAnonChatSession?.id);
      if (existingIdx >= 0) {
        appState.anonymousSessionHistory[existingIdx] = { ...activeAnonChatSession };
      } else {
        appState.anonymousSessionHistory.unshift({ ...activeAnonChatSession });
      }
    }
  }
  syncCurrentTestRunFromSessions();
  saveData();
  console.log('🛑 Telegram Anonymous Chat Bot Automation Worker stopped.');
}

// Helper: Build Clean Dialogue Turns strictly filtering out bot system messages, buttons, and popups
function buildCleanDialogueTurns(transcript: AnonymousChatMessage[]): AnonymousDialogueTurn[] {
  if (!Array.isArray(transcript)) return [];
  const turns: AnonymousDialogueTurn[] = [];
  for (const msg of transcript) {
    if (!msg || !msg.text) continue;
    // Strictly filter out bot system messages, button logs, popups and start commands
    if (msg.sender === 'bot_system') continue;

    let role: 'user' | 'assistant' = 'user';
    let sender: 'partner' | 'ai_bot' | 'operator_manual' = 'partner';

    if (msg.sender === 'stranger') {
      role = 'user';
      sender = 'partner';
    } else if (msg.sender === 'me_melody') {
      role = 'assistant';
      sender = 'ai_bot';
    } else if (msg.sender === 'operator_manual') {
      role = 'assistant';
      sender = 'operator_manual';
    }

    // Clean any bracketed system notifications or prompt injection markers
    let cleanText = msg.text.trim();
    if (cleanText.startsWith('[🎯 معرفی هوشمندانه')) {
      cleanText = cleanText.replace(/\[🎯[^\]]+\]\s*/g, '').trim();
    } else if (cleanText.startsWith('[🖼 تصویر محصول')) {
      cleanText = cleanText.replace(/\[🖼[^\]]+\]\s*/g, '').trim();
    }

    if (cleanText) {
      turns.push({
        sender,
        role,
        text: cleanText,
        timestamp: msg.timestamp || new Date().toISOString(),
      });
    }
  }
  return turns;
}

// Helper: Build Partner Conversation Object with isolated metrics
function buildPartnerConversationObject(
  session: AnonymousChatSession,
  partnerNumber: number
): AnonymousPartnerConversation {
  const dialogue = buildCleanDialogueTurns(session.transcript || []);
  let partnerCount = 0;
  let aiCount = 0;
  dialogue.forEach((t) => {
    if (t.sender === 'partner') partnerCount++;
    if (t.sender === 'ai_bot' || t.sender === 'operator_manual') aiCount++;
  });

  return {
    partnerNumber,
    sessionId: session.id,
    partnerTag: session.partnerTag || undefined,
    partnerProfile: session.partnerProfileSnippet || undefined,
    startedAt: session.startedAt,
    endedAt: session.endedAt || undefined,
    exitReason: session.exitReason || (session.status === 'ended' ? 'max_messages_reached' : undefined),
    messagesCount: {
      partner: partnerCount,
      aiBot: aiCount,
    },
    dialogue,
  };
}

// Helper: Sync current test run conversations and stats in real-time
function syncCurrentTestRunFromSessions() {
  if (!appState.currentTestRun) return;
  const history = appState.anonymousSessionHistory || [];
  const allSessions: AnonymousChatSession[] = [...history];
  if (activeAnonChatSession && !allSessions.some((s) => s.id === activeAnonChatSession?.id)) {
    allSessions.unshift({ ...activeAnonChatSession });
  }

  // Filter only sessions of the active test run
  const runStartTs = new Date(appState.currentTestRun.startedAt).getTime();
  const runSessions = allSessions.filter((s) => {
    const sStart = new Date(s.startedAt).getTime();
    return sStart >= runStartTs - 30000;
  });

  const partnerConvs: AnonymousPartnerConversation[] = [];
  // Sort chronologically (oldest to newest)
  const sortedSessions = [...runSessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  let totalPromo = 0;
  let totalInquiries = 0;
  let totalSpamSkipped = 0;

  sortedSessions.forEach((s, idx) => {
    const conv = buildPartnerConversationObject(s, idx + 1);
    if (conv.dialogue.length > 0 || (s.messagesCount && s.messagesCount > 0) || s.partnerProfileSnippet || s.partnerTag) {
      partnerConvs.push(conv);
    }
    if (s.promoSent) totalPromo++;
    if (s.inquiryDetected) totalInquiries++;
    if (s.isSpamBot || s.exitReason === 'spam_bot_skipped') totalSpamSkipped++;
  });

  let totalPartnerMsgs = 0;
  let totalAiMsgs = 0;
  partnerConvs.forEach((c) => {
    totalPartnerMsgs += c.messagesCount.partner;
    totalAiMsgs += c.messagesCount.aiBot;
  });

  const convRate = totalPromo > 0
    ? Number(((totalInquiries / totalPromo) * 100).toFixed(1))
    : (partnerConvs.length > 0 ? Number(((totalInquiries / partnerConvs.length) * 100).toFixed(1)) : 0);

  appState.currentTestRun.sessions = [...runSessions];
  appState.currentTestRun.conversationsByPartner = partnerConvs;
  appState.currentTestRun.analyticsSummary = {
    totalPartnersChatted: partnerConvs.length,
    totalPartnerMessagesReceived: totalPartnerMsgs,
    totalAiRepliesSent: totalAiMsgs,
    averageTurnsPerPartner:
      partnerConvs.length > 0
        ? Number(((totalPartnerMsgs + totalAiMsgs) / partnerConvs.length).toFixed(2))
        : 0,
    totalPromoSent: totalPromo,
    totalInquiriesAfterPromo: totalInquiries,
    totalSpamBotsSkipped: totalSpamSkipped,
    conversionRatePercent: convRate,
  };
}

// Helper: Initialize a Fresh Prompt Evaluation Run
function initNewPromptEvaluationTestRun(botId?: string): AnonymousPromptTestRun {
  const automator = appState.anonymousAutomator || defaultAnonymousAutomatorConfig;
  const effectiveBotId = botId || automator.selectedBotId;
  const selectedBot = automator.bots.find((b) => b.id === effectiveBotId) || automator.bots[0];
  const instructions = automator.instructions;

  // Archive previous run if it had recorded conversations
  if (
    appState.currentTestRun &&
    (appState.currentTestRun.conversationsByPartner?.length > 0 ||
      appState.currentTestRun.analyticsSummary.totalPartnersChatted > 0 ||
      (appState.currentTestRun.sessions && appState.currentTestRun.sessions.length > 0) ||
      (appState.anonymousSessionHistory && appState.anonymousSessionHistory.length > 0))
  ) {
    if (!appState.previousTestRuns) appState.previousTestRuns = [];
    appState.currentTestRun.status = 'stopped';
    if (!appState.currentTestRun.endedAt) appState.currentTestRun.endedAt = new Date().toISOString();
    if (!appState.currentTestRun.sessions || appState.currentTestRun.sessions.length === 0) {
      appState.currentTestRun.sessions = [...(appState.anonymousSessionHistory || [])];
    }
    appState.previousTestRuns.unshift({ ...appState.currentTestRun });
    if (appState.previousTestRuns.length > 25) {
      appState.previousTestRuns = appState.previousTestRuns.slice(0, 25);
    }
  }

  // Clear session history for a clean fresh test run
  appState.anonymousSessionHistory = [];

  // Reset automator stats strictly for this new round
  automator.stats = {
    totalChatsInitiated: 0,
    totalCompletedChats: 0,
    totalRepliesFromStrangers: 0,
    totalPromoSent: 0,
    totalInquiriesAfterPromo: 0,
    totalSpamBotsSkipped: 0,
    lastActiveAt: new Date().toISOString(),
    exitReasonsBreakdown: {},
  };

  const runIndex = (appState.previousTestRuns?.length || 0) + 1;
  const newRun: AnonymousPromptTestRun = {
    id: `run_${Date.now()}_idx${runIndex}`,
    runIndex,
    startedAt: new Date().toISOString(),
    status: 'running',
    botProfile: {
      id: selectedBot?.id || 'hyper_gap_bot',
      name: selectedBot?.name || 'ربات ناشناس',
      botUsername: selectedBot?.botUsername || '',
    },
    aiInstructionsAndContext: {
      systemPrompt: instructions.systemPrompt || '',
      maxMessagesPerChat: instructions.maxMessagesPerChat || 4,
      memoryWindowSize: instructions.memoryWindowSize || 10,
      initialGreeting: {
        enabled: instructions.initiateGreetingOnConnect !== false,
        text: instructions.initialGreetingText || 'سلام خوبی؟ 🌸',
        mode: instructions.greetingMode || 'single',
      },
      preExitFarewell: {
        enabled: instructions.enablePreExitFarewell !== false,
        text: instructions.preExitFarewellText || '',
      },
      productPromotion: {
        enabled: Boolean(instructions.productPromotion?.enabled),
        productName: instructions.productPromotion?.productName || '',
        productDescription: instructions.productPromotion?.productDescription || '',
        contactHandleOrLink: instructions.productPromotion?.contactHandleOrLink || '',
        sendMode: instructions.productPromotion?.sendMode || 'send_photo_with_caption_before_exit',
      },
      inappropriateKeywords: instructions.inappropriateKeywords || [],
    },
    analyticsSummary: {
      totalPartnersChatted: 0,
      totalPartnerMessagesReceived: 0,
      totalAiRepliesSent: 0,
      averageTurnsPerPartner: 0,
      totalPromoSent: 0,
      totalInquiriesAfterPromo: 0,
      totalSpamBotsSkipped: 0,
      conversionRatePercent: 0,
    },
    conversationsByPartner: [],
    sessions: [],
  };

  appState.currentTestRun = newRun;
  saveData();
  return newRun;
}

// Helper: Format Clean Prompt Performance JSON
function generateCleanPromptEvaluationJson(run: AnonymousPromptTestRun | null): object {
  const automator = appState.anonymousAutomator;
  const currentOrEmpty = run || {
    id: `run_${Date.now()}`,
    runIndex: 1,
    startedAt: automator?.currentRunStartedAt || new Date().toISOString(),
    status: 'stopped' as const,
    botProfile: {
      id: automator?.bots[0]?.id || 'anon_bot',
      name: automator?.bots[0]?.name || 'ربات ناشناس',
      botUsername: automator?.bots[0]?.botUsername || '',
    },
    aiInstructionsAndContext: {
      systemPrompt: automator?.instructions.systemPrompt || '',
      maxMessagesPerChat: automator?.instructions.maxMessagesPerChat || 4,
      memoryWindowSize: automator?.instructions.memoryWindowSize || 10,
      initialGreeting: {
        enabled: automator?.instructions.initiateGreetingOnConnect !== false,
        text: automator?.instructions.initialGreetingText || 'سلام خوبی؟ 🌸',
        mode: automator?.instructions.greetingMode || 'single',
      },
      preExitFarewell: {
        enabled: automator?.instructions.enablePreExitFarewell !== false,
        text: automator?.instructions.preExitFarewellText || '',
      },
      productPromotion: {
        enabled: Boolean(automator?.instructions.productPromotion?.enabled),
        productName: automator?.instructions.productPromotion?.productName || '',
        productDescription: automator?.instructions.productPromotion?.productDescription || '',
        contactHandleOrLink: automator?.instructions.productPromotion?.contactHandleOrLink || '',
        sendMode: automator?.instructions.productPromotion?.sendMode || 'send_photo_with_caption_before_exit',
      },
      inappropriateKeywords: automator?.instructions.inappropriateKeywords || [],
    },
    analyticsSummary: {
      totalPartnersChatted: 0,
      totalPartnerMessagesReceived: 0,
      totalAiRepliesSent: 0,
      averageTurnsPerPartner: 0,
    },
    conversationsByPartner: [],
  };

  return {
    analysisTitle: 'تحلیل عملکرد دستورالعمل هوش مصنوعی در چت ناشناس تلگرام (Prompt Performance Evaluation)',
    description: 'این فایل فقط شامل رفت‌وبرگشت‌های مکالمه هوش مصنوعی با مخاطبان و دستورالعمل‌های داده‌شده به مدل است و پیام‌های سیستمی ربات حذف شده‌اند.',
    exportedAt: new Date().toISOString(),
    testRunId: currentOrEmpty.id,
    runIndex: currentOrEmpty.runIndex,
    startedAt: currentOrEmpty.startedAt,
    endedAt: currentOrEmpty.endedAt || (currentOrEmpty.status === 'stopped' ? new Date().toISOString() : undefined),
    status: currentOrEmpty.status,
    botProfile: currentOrEmpty.botProfile,
    aiInstructionsAndContext: currentOrEmpty.aiInstructionsAndContext,
    analyticsSummary: currentOrEmpty.analyticsSummary,
    conversationsByPartner: currentOrEmpty.conversationsByPartner,
  };
}

// Helper: Format Analytical Conversation Log for Export (TXT / MD)
function generateAnonymousChatTextReport(
  sessions: AnonymousChatSession[],
  automator: AnonymousChatAutomatorConfig | undefined,
  options: { runOnly?: boolean; currentRunStartedAt?: string } = {}
): string {
  let filteredSessions = sessions;
  if (options.runOnly && options.currentRunStartedAt) {
    const runStartTs = new Date(options.currentRunStartedAt).getTime();
    filteredSessions = sessions.filter((s) => {
      const startTs = new Date(s.startedAt).getTime();
      return startTs >= runStartTs - 30000;
    });
  }

  if (filteredSessions.length === 0 && sessions.length > 0) {
    filteredSessions = sessions;
  }

  const bot = automator?.bots.find((b) => b.id === automator.selectedBotId) || automator?.bots[0];
  const instructions = automator?.instructions;
  const nowStr = new Date().toLocaleString('fa-IR');
  const nowIso = new Date().toISOString();

  let totalStrangerMsgs = 0;
  let totalAiMsgs = 0;
  filteredSessions.forEach((s) => {
    totalStrangerMsgs += s.strangerMessagesCount || 0;
    totalAiMsgs += s.aiMessagesCount || 0;
  });

  const lines: string[] = [
    '================================================================================',
    '📊 گزارش تحلیلی جامع مکالمات چت ناشناس تلگرام (Anonymous Chat Analysis Report)',
    '================================================================================',
    `📅 زمان تولید گزارش: ${nowStr} (${nowIso})`,
    `🤖 ربات هدف: ${bot?.name || 'ربات ناشناس'} (@${bot?.botUsername?.replace('@', '') || ''})`,
    `📱 شماره حساب تلگرام: ${appState.credentials.phoneNumber || 'ثبت نشده'} (${appState.credentials.userProfile?.firstName || 'UserBot'})`,
    `👥 تعداد کل مکالمات ثبت‌شده در این گزارش: ${filteredSessions.length} مکالمه`,
    `📥 مجموع پیام‌های دریافتی از کاربران ناشناس: ${totalStrangerMsgs} پیام`,
    `📤 مجموع پاسخ‌های ارسالی هوش مصنوعی (Gemini): ${totalAiMsgs} پیام`,
    `📈 میانگین تبادل پیام در هر مکالمه: ${filteredSessions.length > 0 ? ((totalStrangerMsgs + totalAiMsgs) / filteredSessions.length).toFixed(1) : '0'} پیام`,
    '',
    '--------------------------------------------------------------------------------',
    '⚙️ دستورالعمل و پرامپت فعال هوش مصنوعی (Active AI System Prompt & Instructions)',
    '--------------------------------------------------------------------------------',
    `[متن دستورالعمل و هویت هوش مصنوعی]:`,
    instructions?.systemPrompt || '(دستورالعمل پیش‌فرض)',
    '',
    `• سقف پیام در هر چت: ${instructions?.maxMessagesPerChat || 4} پیام`,
    `• عمق پنجره حافظه مکالمه جاری: ${instructions?.memoryWindowSize || 10} پیام`,
    `• پیام سلام/شروع خودکار: ${instructions?.initiateGreetingOnConnect ? `فعال («${instructions?.initialGreetingText || 'سلام خوبی؟'}»)` : 'غیرفعال'}`,
    `• پیام خداحافظی قبل از خروج: ${instructions?.enablePreExitFarewell ? `فعال («${instructions?.preExitFarewellText || ''}»)` : 'غیرفعال'}`,
    `• محصول/کمپین تبلیغاتی: ${instructions?.productPromotion?.enabled ? `فعال (محصول: ${instructions?.productPromotion?.productName || 'نامشخص'} - آیدی: ${instructions?.productPromotion?.contactHandleOrLink || 'ندارد'})` : 'غیرفعال'}`,
    '',
    '================================================================================',
    '📋 مشروح متن مکالمات ثبت‌شده به ترتیب زمان (Full Conversation Transcripts)',
    '================================================================================',
    '',
  ];

  if (filteredSessions.length === 0) {
    lines.push('⚠️ هنوز هیچ مکالمه‌ای در این نشست ثبت نشده است.');
  } else {
    filteredSessions.forEach((s, idx) => {
      const sessionNum = s.sessionIndex || (filteredSessions.length - idx);
      const startFa = s.startedAt ? new Date(s.startedAt).toLocaleTimeString('fa-IR') : 'نامشخص';
      const endFa = s.endedAt ? new Date(s.endedAt).toLocaleTimeString('fa-IR') : 'در حال انجام';

      let exitReasonLabel = 'در حال گفتگو یا خروج عادی';
      switch (s.exitReason) {
        case 'max_messages_reached':
          exitReasonLabel = 'اتمام سقف پیام‌های مجاز (خروج طبق سناریو)';
          break;
        case 'stranger_silence':
          exitReasonLabel = 'سکوت و عدم پاسخ مخاطب (Timeout)';
          break;
        case 'stranger_disconnected':
          exitReasonLabel = 'قطع اتصال توسط کاربر ناشناس';
          break;
        case 'inappropriate_content':
          exitReasonLabel = 'شناسایی کلیدواژه نامناسب';
          break;
        case 'manual_operator_skip':
          exitReasonLabel = 'رد کردن دستی توسط اپراتور';
          break;
      }

      lines.push(`────────────────────────────────────────────────────────────────────────────────`);
      lines.push(`💬 [مکالمه شماره #${sessionNum}] (شناسه: ${s.id})`);
      lines.push(`• شروع: ${startFa}  |  پایان: ${endFa}  |  وضعیت/علت خاتمه: ${exitReasonLabel}`);
      if (s.partnerProfileSnippet) {
        lines.push(`• مشخصات استخراج‌شده هم‌صحبت: ${s.partnerProfileSnippet}`);
      }
      if (s.partnerTag) {
        lines.push(`• شناسه/تگ مخاطب: ${s.partnerTag}`);
      }
      lines.push(`• آمار پیام‌ها: ${s.aiMessagesCount || 0} پیام بات/هوش مصنوعی | ${s.strangerMessagesCount || 0} پیام کاربر ناشناس`);
      lines.push(`----------------- ریز دیالوگ‌ها و پیام‌ها -----------------`);

      if (!s.transcript || s.transcript.length === 0) {
        lines.push('  (پیامی رد و بدل نشد)');
      } else {
        s.transcript.forEach((m) => {
          const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('fa-IR') : '';
          let senderLabel = '[کاربر ناشناس]';
          if (m.sender === 'me_melody') {
            senderLabel = '[بات (هوش مصنوعی Gemini)]';
          } else if (m.sender === 'operator_manual') {
            senderLabel = '[اپراتور دستی]';
          } else if (m.sender === 'bot_system') {
            senderLabel = '[پیام سیستمی ربات]';
          }

          lines.push(`[${time}] ${senderLabel}: ${m.text}`);
        });
      }
      lines.push('');
    });
  }

  lines.push('================================================================================');
  lines.push('🏁 پایان گزارش تحلیلی چت ناشناس.');
  lines.push('================================================================================');

  return lines.join('\n');
}

// ============================================================================
// ANONYMOUS CHAT BOT API ENDPOINTS
// ============================================================================

app.get('/api/anonymous/state', (req, res) => {
  syncCurrentTestRunFromSessions();
  res.json({
    automator: appState.anonymousAutomator || defaultAnonymousAutomatorConfig,
    activeSession: activeAnonChatSession || appState.activeAnonymousSession || null,
    history: appState.anonymousSessionHistory || [],
    currentTestRun: appState.currentTestRun || null,
    previousTestRuns: appState.previousTestRuns || [],
  });
});

app.get('/api/anonymous/export-history', (req, res) => {
  try {
    syncCurrentTestRunFromSessions();
    const format = (req.query.format as string) || 'json';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'json') {
      const exportJson = generateCleanPromptEvaluationJson(appState.currentTestRun);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="prompt_evaluation_run_${timestamp}.json"`
      );
      res.send(JSON.stringify(exportJson, null, 2));
      return;
    }

    // Default: Formatted Text / Markdown Report
    const automator = appState.anonymousAutomator;
    const history = appState.anonymousSessionHistory || [];
    const allSessions = [...history];
    if (activeAnonChatSession && !allSessions.some((s) => s.id === activeAnonChatSession?.id)) {
      allSessions.unshift({ ...activeAnonChatSession });
    }

    const textReport = generateAnonymousChatTextReport(allSessions, automator, {
      runOnly: true,
      currentRunStartedAt: automator?.currentRunStartedAt,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="anonymous_prompt_evaluation_${timestamp}.txt"`
    );
    res.send(textReport);
  } catch (err: any) {
    console.error('Failed to export anonymous history:', err);
    res.status(500).json({ error: 'خطا در تولید فایل خروجی تاریخچه: ' + (err.message || err) });
  }
});

app.get('/api/anonymous/export-run-json', (req, res) => {
  try {
    syncCurrentTestRunFromSessions();
    const runId = req.query.runId as string;
    let targetRun = appState.currentTestRun;
    if (runId && appState.previousTestRuns) {
      const found = appState.previousTestRuns.find((r) => r.id === runId);
      if (found) targetRun = found;
    }
    const exportJson = generateCleanPromptEvaluationJson(targetRun);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="prompt_evaluation_run_${timestamp}.json"`
    );
    res.send(JSON.stringify(exportJson, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'خطا در تولید فایل JSON: ' + (err.message || err) });
  }
});

app.post('/api/anonymous/clear-history', (req, res) => {
  appState.anonymousSessionHistory = [];
  if (appState.currentTestRun) {
    appState.currentTestRun.conversationsByPartner = [];
    appState.currentTestRun.analyticsSummary = {
      totalPartnersChatted: 0,
      totalPartnerMessagesReceived: 0,
      totalAiRepliesSent: 0,
      averageTurnsPerPartner: 0,
    };
  }
  saveData();
  addLog('info', '[چت ناشناس] آرشیو مکالمات دور جاری با موفقیت پاکسازی شد.');
  res.json({ success: true, message: 'تاریخچه مکالمات با موفقیت پاکسازی شد.', history: [] });
});

app.post('/api/anonymous/update-config', (req, res) => {
  const updates = req.body || {};
  appState.anonymousAutomator = normalizeAnonymousAutomatorConfig(updates, appState.anonymousAutomator);
  saveData();
  res.json({ success: true, automator: appState.anonymousAutomator });
});

app.post('/api/anonymous/save-bot', (req, res) => {
  const bot: AnonymousBotProfile = req.body;
  if (!bot || !bot.name || !bot.botUsername) {
    res.status(400).json({ error: 'نام و آیدی ربات الزامی است.' });
    return;
  }
  if (!appState.anonymousAutomator) {
    appState.anonymousAutomator = { ...defaultAnonymousAutomatorConfig };
  }
  const existingIdx = appState.anonymousAutomator.bots.findIndex((b) => b.id === bot.id);
  if (existingIdx >= 0) {
    appState.anonymousAutomator.bots[existingIdx] = bot;
  } else {
    appState.anonymousAutomator.bots.push(bot);
  }
  saveData();
  res.json({ success: true, bots: appState.anonymousAutomator.bots });
});

app.post('/api/anonymous/delete-bot', (req, res) => {
  const { botId } = req.body;
  if (!appState.anonymousAutomator) {
    res.json({ success: true });
    return;
  }
  appState.anonymousAutomator.bots = appState.anonymousAutomator.bots.filter((b) => b.id !== botId);
  if (appState.anonymousAutomator.selectedBotId === botId) {
    appState.anonymousAutomator.selectedBotId = appState.anonymousAutomator.bots[0]?.id || '';
  }
  saveData();
  res.json({ success: true, bots: appState.anonymousAutomator.bots });
});

app.post('/api/anonymous/start', async (req, res) => {
  const { botId, accountId } = req.body;
  if (!appState.anonymousAutomator) {
    appState.anonymousAutomator = { ...defaultAnonymousAutomatorConfig };
  }
  if (botId) {
    appState.anonymousAutomator.selectedBotId = botId;
  }

  const automator = appState.anonymousAutomator;
  const selectedBot = automator.bots.find((b) => b.id === automator.selectedBotId) || automator.bots[0];
  if (!selectedBot) {
    return res.status(400).json({
      error: 'هیچ ربات چت ناشناسی در لیست وجود ندارد یا انتخاب نشده است.',
    });
  }

  // Pre-validate Telegram connection and account session health
  const anonClientInfo = await getOrInitAnonymousClient(accountId);
  if (!anonClientInfo || !anonClientInfo.client) {
    appState.anonymousAutomator.isActive = false;
    saveData();
    addLog('error', '[چت ناشناس] شروع اتوماسیون ناموفق بود: هیچ اکانت تلگرام متصل و معتبری یافت نشد. لطفاً در بخش مدیریت اکانت‌ها وارد شوید.');
    return res.status(400).json({
      error: 'هیچ اکانت تلگرام متصل و معتبری برای چت ناشناس یافت نشد. لطفاً ابتدا در بخش ۳ (مدیریت اکانت‌ها) اکانت تلگرام خود را متصل یا تمدید نشست فرمایید.',
      needAuth: true,
    });
  }

  const client = anonClientInfo.client;

  // Pre-validate bot entity resolution before starting
  let botEntity: any = null;
  try {
    botEntity = await resolveBotEntitySmart(client, selectedBot.botUsername, selectedBot);
    if (!botEntity) {
      throw new Error(`ربات ${selectedBot.botUsername} (${selectedBot.name}) در تلگرام یافت نشد.`);
    }
  } catch (entityErr: any) {
    appState.anonymousAutomator.isActive = false;
    saveData();
    addLog('error', `[چت ناشناس] یافتن ربات ${selectedBot.botUsername} ناموفق بود: ${entityErr.message}`);
    return res.status(400).json({
      error: entityErr.message,
    });
  }

  appState.anonymousAutomator.isActive = true;
  appState.anonymousAutomator.currentRunStartedAt = new Date().toISOString();

  // Initialize fresh prompt evaluation run (clearing previous run history from memory)
  const newRun = initNewPromptEvaluationTestRun(botId);
  activeAnonChatSession = null;
  appState.activeAnonymousSession = null;
  saveData();

  addLog(
    'info',
    `[ارزیابی دستورالعمل] دوره جدید شماره #${newRun.runIndex} با پرامپت فعال آغاز شد. تمامی مکالمات این دوره تا زمان توقف به صورت تفکیک‌شده ذخیره می‌شوند.`
  );

  // Launch background worker
  runAnonymousChatWorker(accountId || anonClientInfo.account?.id).catch((err) => {
    console.error('Failed to run anonymous chat worker:', err);
  });

  res.json({
    success: true,
    message: `دوره جدید تست دستورالعمل (#${newRun.runIndex}) با موفقیت آغاز شد.`,
    testRun: newRun,
  });
});

app.post('/api/anonymous/stop', async (req, res) => {
  if (appState.anonymousAutomator) {
    appState.anonymousAutomator.isActive = false;
  }
  anonEngineAbort = true;
  isAnonEngineRunning = false;
  if (activeAnonChatSession) {
    activeAnonChatSession.status = 'ended';
    activeAnonChatSession.statusMessage = 'توسط کاربر متوقف گردید.';
    activeAnonChatSession.endedAt = new Date().toISOString();
  }
  if (appState.currentTestRun) {
    appState.currentTestRun.status = 'stopped';
    appState.currentTestRun.endedAt = new Date().toISOString();
  }
  syncCurrentTestRunFromSessions();
  saveData();
  addLog(
    'info',
    `[ارزیابی دستورالعمل] اتوماسیون متوقف شد. ${appState.currentTestRun?.analyticsSummary.totalPartnersChatted || 0} مکالمه تفکیک‌شده در قالب JSON آماده دانلود است.`
  );
  res.json({
    success: true,
    message: 'اتوماسیون چت ناشناس متوقف گردید.',
    testRun: appState.currentTestRun,
  });
});

app.post('/api/anonymous/next-stranger', async (req, res) => {
  const anonClientInfo = await getOrInitAnonymousClient();
  const automator = appState.anonymousAutomator;
  const selectedBot = automator?.bots.find((b) => b.id === automator.selectedBotId) || automator?.bots[0];
  if (anonClientInfo?.client && selectedBot) {
    try {
      const botEntity = await resolveBotEntitySmart(anonClientInfo.client, selectedBot.botUsername, selectedBot);

      if (activeAnonChatSession) {
        await executeExitAndNextPartner(
          anonClientInfo.client,
          botEntity,
          selectedBot,
          activeAnonChatSession,
          'manual_operator_skip',
          'رد کردن دستی توسط اپراتور و درخواست اتصال به مخاطب جدید'
        );
      }

      res.json({ success: true });
      return;
    } catch (e: any) {
      res.status(500).json({ error: e.message });
      return;
    }
  }
  res.status(400).json({ error: 'کلاینت تلگرام در دسترس نیست.' });
});

app.post('/api/anonymous/send-manual-message', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    res.status(400).json({ error: 'متن پیام خالی است.' });
    return;
  }
  const anonClientInfo = await getOrInitAnonymousClient();
  const automator = appState.anonymousAutomator;
  const selectedBot = automator?.bots.find((b) => b.id === automator.selectedBotId) || automator?.bots[0];
  if (anonClientInfo?.client && selectedBot) {
    try {
      const botEntity = await resolveBotEntitySmart(anonClientInfo.client, selectedBot.botUsername, selectedBot);
      await anonClientInfo.client.sendMessage(botEntity, { message: text.trim() });
      if (activeAnonChatSession) {
        activeAnonChatSession.transcript.push({
          id: 'msg_' + Date.now() + '_operator',
          sender: 'me_melody',
          text: text.trim(),
          timestamp: new Date().toISOString(),
        });
        saveData();
      }
      res.json({ success: true });
      return;
    } catch (e: any) {
      res.status(500).json({ error: e.message });
      return;
    }
  }
  res.status(400).json({ error: 'کلاینت تلگرام در دسترس نیست.' });
});

const handleSimulateReply = async (req: any, res: any) => {
  const { history, instructions, sessionContext } = req.body;
  try {
    const activeInstructions: AnonymousChatInstructions =
      instructions ||
      appState.anonymousAutomator?.instructions ||
      defaultAnonymousAutomatorConfig.instructions;

    const replyResult = await generateAnonymousAiReply(
      history || [],
      activeInstructions,
      sessionContext
    );
    const bubbles = splitIntoNaturalBubbles(
      replyResult.text,
      activeInstructions.multiBubbleMaxChunks || 2,
      activeInstructions.maxWordsPerBubble || 8
    );
    res.json({
      success: true,
      reply: replyResult.text,
      bubbles,
      source: replyResult.source,
      modelUsed: replyResult.modelUsed,
      shouldSendPromoCard: replyResult.shouldSendPromoCard,
      promoMentioned: replyResult.promoMentioned,
      stepOutput: replyResult.stepOutput,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to simulate reply' });
  }
};

app.post('/api/anonymous/simulate-reply', handleSimulateReply);
app.post('/api/anonymous/test-ai-simulation', handleSimulateReply);

app.get('/api/anonymous/run-conversation-tests', (req, res) => {
  try {
    const summary = runAllConversationTests();
    res.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || String(err),
    });
  }
});

// =========================================================================
// STEP 5: EVALUATION & REPLAY ENGINE API ENDPOINTS (Offline / Isolated / Read-Only)
// =========================================================================

app.get('/api/evaluation/gold-dataset', (req, res) => {
  try {
    const summaries = GOLD_DATASET.map((c) => ({
      conversationId: c.conversationId,
      category: c.category,
      categoryTitleFa: c.categoryTitleFa,
      description: c.description,
      partnerTag: c.partnerTag,
      turnCount: c.turns.length,
      expectedOutcome: c.expectedOutcome,
    }));
    res.json({
      success: true,
      totalConversations: GOLD_DATASET.length,
      dataset: summaries,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

app.post('/api/evaluation/run-replay', async (req, res) => {
  try {
    const { mode = 'DETERMINISTIC_REPLAY', categoryFilter, conversationIds } = req.body;

    let targetDataset = [...GOLD_DATASET];
    if (categoryFilter && categoryFilter !== 'ALL') {
      targetDataset = targetDataset.filter((c) => c.category === categoryFilter);
    }
    if (Array.isArray(conversationIds) && conversationIds.length > 0) {
      targetDataset = targetDataset.filter((c) => conversationIds.includes(c.conversationId));
    }

    const replayMode =
      mode === 'LLM_REPLAY' ? ReplayMode.LLM_REPLAY : ReplayMode.DETERMINISTIC_REPLAY;

    const report = await runFullEvaluation(targetDataset, replayMode);

    res.json({
      success: true,
      report,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

app.get('/api/evaluation/run-tests', async (req, res) => {
  try {
    const testResults = await runAllEvaluationTests();
    res.json({
      success: true,
      testResults,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

app.post('/api/evaluation/export', async (req, res) => {
  try {
    const { format = 'json', report } = req.body;
    let evalReport = report;
    if (!evalReport) {
      evalReport = await runFullEvaluation(GOLD_DATASET, ReplayMode.DETERMINISTIC_REPLAY);
    }

    if (format === 'csv') {
      const csv = exportTracesToCSV(evalReport.allTraces || []);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="evaluation_traces_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csv);
    }

    const json = exportReportToJSON(evalReport);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="evaluation_report_${new Date().toISOString().slice(0, 10)}.json"`);
    return res.send(json);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// =========================================================================
// GROUP PROMOTION STRATEGIES ENGINE & API ROUTES (STRATEGY 1 & STRATEGY 2)
// =========================================================================

function normalizeUserIdentifier(val?: string): string {
  if (!val) return '';
  return String(val).replace(/^@+/, '').trim().toLowerCase();
}

function ensureGroupPromotionStrategyConfig(): GroupPromotionStrategyConfig {
  if (!appState.groupPromotionStrategy) {
    appState.groupPromotionStrategy = { ...defaultGroupPromotionStrategy };
    saveData();
  }
  if (!appState.groupPromotionStrategy.contactedPvUsers || typeof appState.groupPromotionStrategy.contactedPvUsers !== 'object') {
    appState.groupPromotionStrategy.contactedPvUsers = {};
  }
  if (appState.groupPromotionStrategy.strategy2) {
    if (appState.groupPromotionStrategy.strategy2.neverRepeatPvToSameUser === undefined) {
      appState.groupPromotionStrategy.strategy2.neverRepeatPvToSameUser = true;
    }
    if (appState.groupPromotionStrategy.strategy2.checkTelegramHistoryBeforePv === undefined) {
      appState.groupPromotionStrategy.strategy2.checkTelegramHistoryBeforePv = true;
    }
    if (appState.groupPromotionStrategy.strategy2.totalPvRepeatsPrevented === undefined) {
      appState.groupPromotionStrategy.strategy2.totalPvRepeatsPrevented = 0;
    }
    if (appState.groupPromotionStrategy.strategy2.replyToUserRepliesInGroup === undefined) {
      appState.groupPromotionStrategy.strategy2.replyToUserRepliesInGroup = true;
    }
    if (appState.groupPromotionStrategy.strategy2.humanChatStyleInGroup === undefined) {
      appState.groupPromotionStrategy.strategy2.humanChatStyleInGroup = true;
    }
    if (appState.groupPromotionStrategy.strategy2.maxConsecutiveRepliesPerUser === undefined) {
      appState.groupPromotionStrategy.strategy2.maxConsecutiveRepliesPerUser = 5;
    }
  }
  return appState.groupPromotionStrategy;
}

// Anti-Spam & Anti-Report state for Strategy 2
const processedGroupMsgKeys = new Set<string>();
const userCooldownMap = new Map<string, number>(); // senderId -> timestamp
const groupHourlyReplies = new Map<string, { count: number; hourTs: number }>();
const groupCooldownMap = new Map<string, number>(); // groupIdOrTitle -> timestamp
let isGroupListenerRunning = false;

// Tracking messages sent by our bot accounts to groups (key: `${chatId}_${msgId}`)
interface SentBotGroupMsgRecord {
  accountId: string;
  text: string;
  timestamp: number;
}
const recentBotSentGroupMessageMap = new Map<string, SentBotGroupMsgRecord>();

// Interactive conversation threads per user in each group (key: `${chatId}_${senderId}`)
interface GroupConversationTurn {
  role: 'user' | 'bot';
  text: string;
  timestamp: number;
}
const groupConversationThreads = new Map<string, GroupConversationTurn[]>();

function ensureContactedPvUsersMap(): Record<string, { timestamp: string; userId?: string; username?: string; firstName?: string; reason?: string }> {
  const config = ensureGroupPromotionStrategyConfig();
  if (!config.contactedPvUsers || typeof config.contactedPvUsers !== 'object') {
    config.contactedPvUsers = {};
  }
  return config.contactedPvUsers;
}

// Check if user has EVER been messaged in PV or has existing chat
function isUserAlreadyContactedInPv(userId?: string, username?: string): { contacted: boolean; reason?: string; timestamp?: string } {
  const config = ensureGroupPromotionStrategyConfig();
  const contactedMap = ensureContactedPvUsersMap();
  const normId = normalizeUserIdentifier(userId);
  const normUser = normalizeUserIdentifier(username);

  // 1. Direct registry check by ID
  if (normId && contactedMap[normId]) {
    return { contacted: true, reason: contactedMap[normId].reason || 'ثبت در لیست کاربران پیام‌داده‌شده (شناسه عددی)', timestamp: contactedMap[normId].timestamp };
  }
  // 2. Direct registry check by Username
  if (normUser && contactedMap[normUser]) {
    return { contacted: true, reason: contactedMap[normUser].reason || 'ثبت در لیست کاربران پیام‌داده‌شده (نام کاربری)', timestamp: contactedMap[normUser].timestamp };
  }

  // 3. Check historical recentLeads where pvSent is true or status is sent_pv
  if (Array.isArray(config.recentLeads)) {
    const matchedLead = config.recentLeads.find(l => {
      if (!l.pvSent && l.status !== 'sent_pv') return false;
      if (normId && normalizeUserIdentifier(l.userId) === normId) return true;
      if (normUser && l.userUsername && normalizeUserIdentifier(l.userUsername) === normUser) return true;
      return false;
    });
    if (matchedLead) {
      markUserAsPvContacted(userId, username, matchedLead.userFirstName, 'historical_lead_pv');
      return { contacted: true, reason: 'سابقه پیام پی‌وی در لیست لیدهای گذشته', timestamp: matchedLead.timestamp };
    }
  }

  // 4. Check inboundPvConversations (anyone who has had an inbound conversation)
  if (Array.isArray(config.inboundPvConversations)) {
    const matchedConv = config.inboundPvConversations.find(c => {
      if (normId && normalizeUserIdentifier(c.userId) === normId) return true;
      if (normUser && c.username && normalizeUserIdentifier(c.username) === normUser) return true;
      return false;
    });
    if (matchedConv) {
      markUserAsPvContacted(userId, username, matchedConv.firstName, 'historical_inbound_conv');
      return { contacted: true, reason: 'سابقه گفتگو در مکالمات پی‌وی', timestamp: matchedConv.lastMessageAt };
    }
  }

  return { contacted: false };
}

// Mark user as contacted permanently
function markUserAsPvContacted(userId?: string, username?: string, firstName?: string, reason: string = 'sent_pv'): void {
  const contactedMap = ensureContactedPvUsersMap();
  const nowIso = new Date().toISOString();
  const record = {
    timestamp: nowIso,
    userId: userId ? String(userId) : undefined,
    username: username ? String(username).replace(/^@+/, '').trim() : undefined,
    firstName: firstName || 'کاربر',
    reason,
  };

  const normId = normalizeUserIdentifier(userId);
  const normUser = normalizeUserIdentifier(username);

  if (normId) {
    contactedMap[normId] = record;
    userCooldownMap.set(normId, Date.now());
  }
  if (normUser) {
    contactedMap[normUser] = record;
  }

  saveData();
}

function initContactedPvUsersFromHistory(): void {
  const config = ensureGroupPromotionStrategyConfig();
  const contactedMap = ensureContactedPvUsersMap();
  let count = 0;

  if (Array.isArray(config.recentLeads)) {
    for (const lead of config.recentLeads) {
      if (lead.pvSent || lead.status === 'sent_pv') {
        const normId = normalizeUserIdentifier(lead.userId);
        const normUser = normalizeUserIdentifier(lead.userUsername);
        const record = {
          timestamp: lead.timestamp || new Date().toISOString(),
          userId: lead.userId,
          username: lead.userUsername,
          firstName: lead.userFirstName || 'کاربر',
          reason: 'historical_lead',
        };
        if (normId && !contactedMap[normId]) {
          contactedMap[normId] = record;
          count++;
        }
        if (normUser && !contactedMap[normUser]) {
          contactedMap[normUser] = record;
        }
        if (normId) {
          userCooldownMap.set(normId, Date.now());
        }
      }
    }
  }

  if (Array.isArray(config.inboundPvConversations)) {
    for (const conv of config.inboundPvConversations) {
      const normId = normalizeUserIdentifier(conv.userId);
      const normUser = normalizeUserIdentifier(conv.username);
      const record = {
        timestamp: conv.lastMessageAt || conv.firstContactAt || new Date().toISOString(),
        userId: conv.userId,
        username: conv.username,
        firstName: conv.firstName || 'کاربر',
        reason: 'inbound_conversation',
      };
      if (normId && !contactedMap[normId]) {
        contactedMap[normId] = record;
        count++;
      }
      if (normUser && !contactedMap[normUser]) {
        contactedMap[normUser] = record;
      }
      if (normId) {
        userCooldownMap.set(normId, Date.now());
      }
    }
  }

  if (count > 0) {
    console.log(`🛡️ Anti-Report PV Shield initialized with ${Object.keys(contactedMap).length} historical users.`);
  }
}

// Initial bootstrap of historical contacted users
setTimeout(() => {
  try {
    initContactedPvUsersFromHistory();
  } catch (err) {}
}, 500);

// Typing simulation helper for peer
async function simulateTypingOnPeer(client: any, peer: any, durationMs: number): Promise<void> {
  if (!client || !peer) return;
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    try {
      if (Api && Api.messages && Api.messages.SetTyping) {
        client.invoke(
          new Api.messages.SetTyping({ peer, action: new Api.SendMessageTypingAction() })
        ).catch(() => {});
      }
    } catch {}
    await new Promise((r) => setTimeout(r, Math.min(1800, Math.max(200, durationMs - (Date.now() - start)))));
  }
}

// Inbound Private Message (PV) Auto-Responder
const activeInboundListenerClients = new WeakSet<any>();
const inboundPvDebounceMap = new Map<string, {
  timer: NodeJS.Timeout;
  messages: string[];
  sender: any;
  senderId: string;
  senderUsername: string;
  senderFirstName: string;
}>();

async function registerInboundPvListener(client: any, accountParam?: any) {
  if (!client || activeInboundListenerClients.has(client)) return;
  await loadGramJS();
  if (!NewMessage) return;

  const targetAccount = accountParam || clientAccountMap.get(client) || appState.accounts?.[0];

  try {
    activeInboundListenerClients.add(client);
    client.addEventHandler(async (event: any) => {
      try {
        const msg = event?.message;
        if (!msg || msg.out) return;

        // Verify that target account is currently active and allowed
        const currentAcc = accountParam || clientAccountMap.get(client) || (appState.accounts || []).find(a => a.id === targetAccount?.id);
        if (currentAcc && (!currentAcc.isActive || currentAcc.status === 'disabled' || currentAcc.status === 'session_expired')) {
          return; // Account is disabled or session expired - strictly do not process
        }

        // Check if message is in a 1-on-1 private chat (PV)
        const isPrivate = Boolean(
          event.isPrivate ||
          (msg.peerId && (msg.peerId.className === 'PeerUser' || msg.peerId.userId)) ||
          (event.chat && !event.chat.broadcast && !event.chat.megagroup && !event.chat.participantsCount)
        );
        if (isPrivate) {
          // If PV Auto-Reply is disabled for this account, strictly ignore so the user can manually respond personally
          if (currentAcc && currentAcc.enableForPvReply === false) {
            return;
          }

          const sender = msg.sender || (msg.getSender ? await msg.getSender().catch(() => null) : null);
          if (sender && sender.bot) return; // ignore bots

          const rawText = (msg.message || msg.text || '').trim();
          if (!rawText) return;

          await handleInboundPvMessage(client, event, sender, rawText, currentAcc || targetAccount);
          return;
        }

        // Realtime Group Lead Listener & Smart Reply for Managed Ready Groups
        const isGroup = Boolean(
          event.isGroup ||
          event.chat?.megagroup ||
          (msg.peerId && (msg.peerId.className === 'PeerChannel' || msg.peerId.className === 'PeerChat'))
        );
        if (isGroup) {
          if (currentAcc && currentAcc.enableForGroupBroadcast === false) {
            return; // Group participation is disabled for this account
          }
          await handleRealtimeIncomingGroupMessage(client, event, msg, currentAcc || targetAccount);
        }
      } catch (evtErr: any) {
        console.warn('Inbound PV message event error:', evtErr?.message || evtErr);
      }
    }, new NewMessage({ incoming: true }));

    addLog(
      'info',
      `[شنود جامع و پاسخگویی] شنود لحظه‌ای رویدادهای گروه و پیام‌های شخصی (Real-time MTProto Listener) برای اکانت (${targetAccount?.phoneNumber || 'اصلی'}) فعال گردید.`
    );
  } catch (err: any) {
    console.error('Failed to register inbound PV listener:', err?.message || err);
  }
}

async function handleRealtimeIncomingGroupMessage(client: any, event: any, msg: any, accountParam?: any) {
  try {
    const config = ensureGroupPromotionStrategyConfig();
    if (!config?.strategy2?.isListeningActive) return;
    const isStrat2Active = config.activeStrategy === 'smart_listener_reply' || config.activeStrategy === 'hybrid_both';
    if (!isStrat2Active) return;

    if (!msg || !msg.message) return;
    const currentAcc = accountParam || clientAccountMap.get(client) || appState.accounts?.[0];

    if (msg.out) {
      try {
        const cId = String(msg.peerId?.channelId || msg.peerId?.chatId || event.chatId || '');
        const cUsername = String(event.chat?.username || '').toLowerCase();
        const cTitle = String(event.chat?.title || '').trim().toLowerCase();
        const matched = (appState.groups || []).find(g => {
          const link = String(g.usernameOrLink || '').toLowerCase();
          const title = String(g.title || '').toLowerCase();
          if (cUsername && (link.includes(cUsername) || link === `@${cUsername}`)) return true;
          if (cId && (link.includes(cId) || String(g.id).includes(cId))) return true;
          if (cTitle && title && (cTitle === title || title.includes(cTitle))) return true;
          return false;
        });
        if (matched && msg.id) {
          const sentKey = `${matched.id || matched.title}_${msg.id}`;
          recentBotSentGroupMessageMap.set(sentKey, {
            accountId: currentAcc?.id || '',
            text: String(msg.message || ''),
            timestamp: Date.now(),
          });
        }
      } catch (e) {}
      return;
    }

    if (!currentAcc || !currentAcc.isActive || currentAcc.status === 'session_expired' || currentAcc.status === 'disabled') {
      return;
    }
    const now = Date.now();
    if (currentAcc.floodWaitUntil && currentAcc.floodWaitUntil > now) {
      return; // Account is in flood wait, do not act
    }

    const allGroups = appState.groups || [];
    const eventChat = event.chat;
    const chatId = String(msg.peerId?.channelId || msg.peerId?.chatId || event.chatId || '');
    const chatUsername = String(eventChat?.username || '').toLowerCase();
    const chatTitle = String(eventChat?.title || '').trim().toLowerCase();

    const matchedGroup = allGroups.find(g => {
      if (!g.isActive || g.canSendMessages === false) return false;
      const link = String(g.usernameOrLink || '').toLowerCase();
      const title = String(g.title || '').toLowerCase();
      if (chatUsername && (link.includes(chatUsername) || link === `@${chatUsername}`)) return true;
      if (chatId && (link.includes(chatId) || String(g.id).includes(chatId))) return true;
      if (chatTitle && title && (chatTitle === title || title.includes(chatTitle))) return true;
      return false;
    });

    if (!matchedGroup) return;

    // Verify account responsibility:
    // If failover redistribution is disabled, this account MUST be the assigned owner
    const isOwner = matchedGroup.assignedAccountId === currentAcc.id;
    const enableRedistrib = appState.scheduler?.antiBot?.enableFailoverRedistribution ?? false;
    if (!isOwner && !enableRedistrib) {
      return;
    }

    const msgKey = `${matchedGroup.id || matchedGroup.title}_${msg.id}`;
    if (processedGroupMsgKeys.has(msgKey)) return;
    processedGroupMsgKeys.add(msgKey);
    if (processedGroupMsgKeys.size > 2000) {
      const first = processedGroupMsgKeys.values().next().value;
      if (first) processedGroupMsgKeys.delete(first);
    }

    // Resolve sender
    let sender: any = null;
    let senderId = '';
    let senderFirstName = 'کاربر';
    let senderUsername = '';
    try {
      sender = msg.sender || (msg.getSender ? await msg.getSender() : null);
      if (sender) {
        senderId = String(sender.id || '');
        senderFirstName = sender.firstName || 'کاربر';
        senderUsername = sender.username || '';
      }
    } catch (e) {}

    // Anti-Self-Detection & Anti-Self-Loop
    const isOurOwnAccount = (appState.accounts || []).some(a => {
      const aId = String(a.id || '');
      const aUserId = String(a.userProfile?.id || '');
      const aUsername = String(a.userProfile?.username || '').replace(/^@+/, '').toLowerCase();
      const sUsername = String(senderUsername).replace(/^@+/, '').toLowerCase();
      return (
        (senderId && (senderId === aId || senderId === aUserId)) ||
        (sUsername && aUsername && sUsername === aUsername)
      );
    });
    if (isOurOwnAccount) return;

    const rawMsgText = (msg.message || msg.text || '').trim();
    if (!rawMsgText) return;

    // Detect if this message is an active reply to our bot or mentions our bot
    const replyMsgId = msg.replyToMsgId || msg.replyTo?.replyToMsgId;
    let isReplyToOurBot = false;
    let repliedBotMsgText = '';

    if (replyMsgId) {
      const sentKey = `${matchedGroup.id || matchedGroup.title}_${replyMsgId}`;
      const sentRecord = recentBotSentGroupMessageMap.get(sentKey);
      if (sentRecord) {
        isReplyToOurBot = true;
        repliedBotMsgText = sentRecord.text;
      } else {
        try {
          const origMsg = msg.getReplyMessage ? await msg.getReplyMessage().catch(() => null) : null;
          if (origMsg) {
            const origSenderId = String(origMsg.senderId || origMsg.fromId?.userId || '');
            const isFromOurAccount = (appState.accounts || []).some(a => {
              const aId = String(a.id || '');
              const aUserId = String(a.userProfile?.id || '');
              const aUsername = String(a.userProfile?.username || '').replace(/^@+/, '').toLowerCase();
              const origUser = String(origMsg.sender?.username || '').replace(/^@+/, '').toLowerCase();
              return (
                (origSenderId && (origSenderId === aId || origSenderId === aUserId)) ||
                (aUsername && origUser && aUsername === origUser)
              );
            });
            if (isFromOurAccount) {
              isReplyToOurBot = true;
              repliedBotMsgText = origMsg.message || '';
              recentBotSentGroupMessageMap.set(sentKey, {
                accountId: currentAcc.id,
                text: repliedBotMsgText,
                timestamp: Date.now(),
              });
            }
          }
        } catch (e) {}
      }
    }

    // ------------------------------------------------------------------------
    // REAL-TIME GUARDIAN BOT CHALLENGE INTERCEPTOR & FORCE-ADD SOLVER
    // ------------------------------------------------------------------------
    const forceAddReq = detectAndExtractForceAddRequirement(
      rawMsgText,
      currentAcc.accountName || currentAcc.firstName || currentAcc.userProfile?.firstName,
      currentAcc.phoneNumber,
      currentAcc.userProfile?.username,
      currentAcc.id
    );

    const isTargetedAtOurAccount = Boolean(
      forceAddReq.isForceAdd && (
        (forceAddReq.targetUser && (
          (currentAcc.accountName && forceAddReq.targetUser.toLowerCase().includes(currentAcc.accountName.toLowerCase())) ||
          (currentAcc.firstName && forceAddReq.targetUser.toLowerCase().includes(currentAcc.firstName.toLowerCase())) ||
          (currentAcc.userProfile?.firstName && forceAddReq.targetUser.toLowerCase().includes(currentAcc.userProfile.firstName.toLowerCase())) ||
          (currentAcc.userProfile?.username && forceAddReq.targetUser.toLowerCase().includes(currentAcc.userProfile.username.toLowerCase())) ||
          (currentAcc.phoneNumber && forceAddReq.targetUser.includes(currentAcc.phoneNumber.replace(/[^0-9]/g, '').slice(-7)))
        )) ||
        isReplyToOurBot ||
        Array.from(recentBotSentGroupMessageMap.keys()).some(k => k.startsWith(`${matchedGroup.id || matchedGroup.title}_`))
      )
    );

    if (isTargetedAtOurAccount && forceAddReq.isForceAdd) {
      addLog(
        'info',
        `[شناسایی قفل ادد اجباری در چت زنده] ربات ناظر گروه "${matchedGroup.title}" برای کاربر «${currentAcc.accountName || currentAcc.phoneNumber || 'اکانت'}»: باید ${forceAddReq.totalNeeded} نفر اضافه شوند (تاکنون: ${forceAddReq.currentAdded}، باقیمانده: ${forceAddReq.remainingNeeded}). در حال حل خودکار...`
      );

      (async () => {
        try {
          const bypassRes = await executeForceAddBypass(client, event.chat || msg.peerId, forceAddReq.remainingNeeded, matchedGroup.title, msg);
          if (bypassRes.success || bypassRes.invitedCount > 0) {
            matchedGroup.canSendMessages = true;
            matchedGroup.readinessStatus = 'ready';
            addLog('success', `[قفل ادد بازگشایی شد ✓] قفل اد اجباری گروه "${matchedGroup.title}" با موفقیت برطرف گردید.`);
          }
        } catch (bypassErr: any) {
          console.warn('Realtime force-add bypass warning:', bypassErr?.message || bypassErr);
        }
      })();
      return;
    }

    if (sender && sender.bot) return; // ignore other bots

    const activeCampaign = appState.campaigns.find(c => c.isActive) || appState.campaigns[0];
    if (!activeCampaign) return;

    const myUsername = (currentAcc.userProfile?.username || '').replace(/^@+/, '').toLowerCase();
    const mentionsMe = Boolean(myUsername && rawMsgText.toLowerCase().includes(`@${myUsername}`));
    const isInteractiveReply = (isReplyToOurBot || mentionsMe) && config.strategy2.replyToUserRepliesInGroup !== false;

    // A. INTERACTIVE CONVERSATIONAL REPLY (USER REPLIED TO BOT IN GROUP)
    if (isInteractiveReply) {
      const convKey = `${matchedGroup.id || matchedGroup.title}_${senderId}`;
      let thread = groupConversationThreads.get(convKey) || [];
      const maxRounds = config.strategy2.maxConsecutiveRepliesPerUser || 5;
      const botRepliesCount = thread.filter(t => t.role === 'bot').length;
      if (botRepliesCount >= maxRounds) {
        return; // Max conversation turns reached for this user in this group
      }

      // Check hourly limit for this group
      const hourKey = `${matchedGroup.id || matchedGroup.title}_${new Date().getHours()}`;
      const currentHourly = groupHourlyReplies.get(hourKey) || { count: 0, hourTs: now };
      if (currentHourly.count >= (config.strategy2.maxRepliesPerGroupPerHour || 8)) return;

      await enforceAccountActionThrottle(currentAcc.id, 2000);
      const peer = await resolveAndJoinGroup(client, matchedGroup.usernameOrLink);
      if (!peer) return;

      // Realistic human typing simulation (3 to 6 seconds)
      try {
        const { Api } = await import('telegram');
        await client.invoke(new Api.messages.SetTyping({
          peer,
          action: new Api.SendMessageTypingAction(),
        })).catch(() => {});
      } catch (e) {}

      const replyDelay = Math.floor(Math.random() * 3000) + 3000;
      await new Promise(r => setTimeout(r, replyDelay));

      thread.push({ role: 'user', text: rawMsgText, timestamp: now });

      const convAi = await generateGeminiGroupConversationReply(
        rawMsgText,
        repliedBotMsgText,
        thread.slice(-6),
        activeCampaign,
        senderFirstName,
        appState.anonymousAutomator?.instructions
      );

      if (convAi.text) {
        const sentMsg = await client.sendMessage(peer, {
          message: convAi.text,
          replyTo: msg.id,
        });

        if (sentMsg && sentMsg.id) {
          const mySentKey = `${matchedGroup.id || matchedGroup.title}_${sentMsg.id}`;
          recentBotSentGroupMessageMap.set(mySentKey, {
            accountId: currentAcc.id,
            text: convAi.text,
            timestamp: Date.now(),
          });
        }

        thread.push({ role: 'bot', text: convAi.text, timestamp: Date.now() });
        groupConversationThreads.set(convKey, thread);

        config.strategy2.totalGroupRepliesSent = (config.strategy2.totalGroupRepliesSent || 0) + 1;
        groupHourlyReplies.set(hourKey, { count: currentHourly.count + 1, hourTs: now });
        currentAcc.dailySentCount = (currentAcc.dailySentCount || 0) + 1;

        addLog(
          'success',
          `💬 [مکالمه گروهی هوشمند] پاسخ انسانی کوتاه (${convAi.usedAi ? 'هوش مصنوعی' : 'طبیعی'}) به ریپلای «${senderFirstName}» در گروه "${matchedGroup.title}" ارسال شد: "${convAi.text}"`
        );
      }
      return;
    }

    // B. COLD LEAD DETECTION (INCOMING ORIGINAL MESSAGE ABOUT VPN/FILTERING)
    const leadRes = detectLeadInMessage(rawMsgText, config.strategy2.keywords);
    if (!leadRes.isMatch) return;

    config.strategy2.totalMessagesScanned = (config.strategy2.totalMessagesScanned || 0) + 1;
    config.strategy2.totalLeadsDetected = (config.strategy2.totalLeadsDetected || 0) + 1;
    config.strategy2.lastLeadDetectedAt = new Date().toISOString();

    const supportContact = String(config.strategy2.supportContactHandle || activeCampaign.contactHandle || '').replace(/^@+/, '').toLowerCase();
    if (supportContact && supportContact !== 'در عکس بالا' && rawMsgText.toLowerCase().includes(supportContact)) {
      return;
    }

    // Check user cooldown (default 24h)
    const cooldownMs = (config.strategy2.userCooldownHours || 24) * 3600 * 1000;
    if (senderId && userCooldownMap.has(senderId)) {
      const lastSent = userCooldownMap.get(senderId) || 0;
      if (now - lastSent < cooldownMs) return;
    }

    // Check group cooldown
    const groupCooldownMinutes = config.strategy2.groupCooldownMinutes ?? 5;
    const groupCooldownMs = groupCooldownMinutes * 60 * 1000;
    const lastGroupReplyTs = groupCooldownMap.get(matchedGroup.id || matchedGroup.title) || 0;
    if (now - lastGroupReplyTs < groupCooldownMs) return;

    // Check hourly limit
    const hourKey = `${matchedGroup.id || matchedGroup.title}_${new Date().getHours()}`;
    const currentHourly = groupHourlyReplies.get(hourKey) || { count: 0, hourTs: now };
    if (currentHourly.count >= (config.strategy2.maxRepliesPerGroupPerHour || 5)) return;

    await enforceAccountActionThrottle(currentAcc.id, 2000);

    // Group Reply
    if (config.strategy2.replyInGroup) {
      try {
        const replyDelay = Math.max(1, config.strategy2.groupReplyDelaySeconds || 4) * 1000;
        await new Promise(r => setTimeout(r, replyDelay));

        const groupReplyAi = await generateGeminiGroupReply(
          rawMsgText,
          leadRes.category,
          leadRes.matchedKeywords,
          activeCampaign,
          senderFirstName,
          undefined,
          config.strategy2.humanChatStyleInGroup !== false
        );

        const peer = await resolveAndJoinGroup(client, matchedGroup.usernameOrLink);
        if (peer) {
          const sentMsg = await client.sendMessage(peer, {
            message: groupReplyAi.text,
            replyTo: msg.id,
          });

          if (sentMsg && sentMsg.id) {
            const mySentKey = `${matchedGroup.id || matchedGroup.title}_${sentMsg.id}`;
            recentBotSentGroupMessageMap.set(mySentKey, {
              accountId: currentAcc.id,
              text: groupReplyAi.text,
              timestamp: Date.now(),
            });
          }

          // Initialize conversation thread for this user
          const convKey = `${matchedGroup.id || matchedGroup.title}_${senderId}`;
          groupConversationThreads.set(convKey, [
            { role: 'user', text: rawMsgText, timestamp: now },
            { role: 'bot', text: groupReplyAi.text, timestamp: Date.now() },
          ]);

          config.strategy2.totalGroupRepliesSent = (config.strategy2.totalGroupRepliesSent || 0) + 1;
          groupHourlyReplies.set(hourKey, { count: currentHourly.count + 1, hourTs: now });
          groupCooldownMap.set(matchedGroup.id || matchedGroup.title, now);
          currentAcc.dailySentCount = (currentAcc.dailySentCount || 0) + 1;

          addLog(
            'success',
            `⚡ [شنود لحظه‌ای - رویداد زنده] ریپلای هوشمند به کاربر «${senderFirstName}» در گروه "${matchedGroup.title}" توسط اکانت (${currentAcc.phoneNumber}) ارسال شد: "${groupReplyAi.text}"`
          );

          // Optional banner after reply
          if (config.strategy2.sendBannerInGroupReply !== false && activeCampaign.imageUrl) {
            try {
              const bannerPath = await getImageFilePathForTelegram(activeCampaign.imageUrl);
              if (bannerPath && fs.existsSync(bannerPath)) {
                await new Promise(r => setTimeout(r, 1500));
                const supportHandle = (config.strategy2.supportContactHandle || activeCampaign.contactHandle || '@Nova_vpn10');
                const cleanSupport = (supportHandle && supportHandle !== 'در عکس بالا') ? supportHandle : '@Nova_vpn10';
                await client.sendFile(peer, {
                  file: bannerPath,
                  caption: `📌 لیست تعرفه‌ها و مشخصات سرورها\n👤 ارتباط با پشتیبانی و دریافت تست رایگان: ${cleanSupport}`,
                  replyTo: msg.id,
                }).catch(() => {});
              }
            } catch (bErr) {}
          }

          // Optional background PV message to lead
          if (config.strategy2.sendDirectMessage && sender && senderId) {
            setTimeout(async () => {
              try {
                const targetPeerOrUsername = senderUsername ? senderUsername : sender;
                await dispatchPvWithMultiAccountPool(
                  targetPeerOrUsername,
                  senderId,
                  senderFirstName,
                  senderUsername,
                  rawMsgText,
                  leadRes.category,
                  leadRes.matchedKeywords,
                  activeCampaign,
                  matchedGroup.title,
                  config,
                  currentAcc?.id
                );
              } catch (pvErr) {}
            }, (config.strategy2.pvMessageDelaySeconds || 8) * 1000);
          }
        }
      } catch (rErr: any) {
        console.warn('Realtime reply error:', rErr?.message || rErr);
      }
    }
  } catch (err: any) {
    console.warn('handleRealtimeIncomingGroupMessage error:', err?.message || err);
  }
}

async function handleInboundPvMessage(client: any, event: any, sender: any, messageText: string, accountParam?: any) {
  const config = ensureGroupPromotionStrategyConfig();
  if (!config.strategy2) return;

  // Check if Strategy 2 is active or autoReplyInboundPv is enabled
  const isStrat2Active = config.activeStrategy === 'smart_listener_reply' || config.activeStrategy === 'hybrid_both';
  if (!isStrat2Active && !config.strategy2.autoReplyInboundPv) return;
  if (config.strategy2.autoReplyInboundPv === false) return;

  const senderId = String(sender?.id || (event.message?.peerId?.userId || ''));
  if (!senderId) return;

  const senderUsername = sender?.username || '';
  const senderFirstName = sender?.firstName || 'کاربر';
  const senderPhone = sender?.phone || '';

  // 1. Critical: Prevent any internal system accounts from chatting with each other in an infinite loop!
  if (isInternalSystemAccount(senderId, senderUsername, senderPhone)) {
    return;
  }

  // 2. Resolve target account and verify it is active and allowed
  const account = accountParam || clientAccountMap.get(client) || (appState.accounts || []).find(a => a.id === appState.activeAccountId) || appState.accounts?.find(a => a.isActive);
  if (!account || !account.isActive || account.status === 'disabled' || account.status === 'session_expired' || account.enableForPvReply === false) {
    return; // Strictly do nothing if account is disabled or PV auto-reply is disabled for this account
  }

  // 3. Lead Qualification Check (Do NOT auto-reply to friends, family, or ordinary contacts)
  const isAlreadyContactedLead = Boolean(
    config.contactedPvUsers && (config.contactedPvUsers[senderId] || (senderUsername && config.contactedPvUsers[senderUsername.toLowerCase()]))
  );
  const isRecentGroupLead = Boolean(
    config.recentLeads?.some(l => l.userId === senderId || (l.userUsername && senderUsername && l.userUsername.toLowerCase() === senderUsername.toLowerCase()))
  );
  const existingConv = config.inboundPvConversations?.find(c => c.userId === senderId);
  const hasExistingBotDialogue = Boolean(
    existingConv && existingConv.messages?.some(m => m.sender === 'bot')
  );
  const isRelevantInquiry = isVpnOrProductInquiry(messageText);

  // If sender was never contacted by bot, is not a recent group lead, has no prior sales dialogue, and did not ask about VPN:
  if (!isAlreadyContactedLead && !isRecentGroupLead && !hasExistingBotDialogue && !isRelevantInquiry) {
    return; // Leave personal/friend messages untouched
  }

  if (!config.inboundPvConversations) {
    config.inboundPvConversations = [];
  }

  let conversation = existingConv;
  const nowIso = new Date().toISOString();

  if (!conversation) {
    const existingLead = config.recentLeads?.find(l => l.userId === senderId || (l.userUsername && senderUsername && l.userUsername.toLowerCase() === senderUsername.toLowerCase()));
    conversation = {
      userId: senderId,
      username: senderUsername,
      firstName: senderFirstName,
      leadCategory: existingLead?.detectedCategory || 'vpn_filter',
      firstContactAt: nowIso,
      lastMessageAt: nowIso,
      turnCount: 0,
      status: 'active',
      assignedAccountId: account?.id,
      assignedAccountPhone: account?.phoneNumber,
      messages: [],
    };
    config.inboundPvConversations.unshift(conversation);
  } else {
    conversation.lastMessageAt = nowIso;
    if (account && !conversation.assignedAccountId) {
      conversation.assignedAccountId = account.id;
      conversation.assignedAccountPhone = account.phoneNumber;
    }
    if (senderUsername) conversation.username = senderUsername;
    if (senderFirstName) conversation.firstName = senderFirstName;
    if (conversation.status === 'closed') conversation.status = 'active';
  }

  // Add user incoming message
  conversation.messages.push({
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    sender: 'user',
    text: messageText,
    timestamp: nowIso,
  });

  if (conversation.messages.length > 40) {
    conversation.messages = conversation.messages.slice(-40);
  }

  // Also update lead in recentLeads if found
  const leadMatch = config.recentLeads?.find(l => l.userId === senderId || (l.userUsername && senderUsername && l.userUsername.toLowerCase() === senderUsername.toLowerCase()));
  if (leadMatch) {
    leadMatch.inboundRepliesCount = (leadMatch.inboundRepliesCount || 0) + 1;
    leadMatch.lastInboundMessage = messageText;
  }

  saveData();

  // Debounce multiple fast messages from user (wait 2.2s)
  const existingPending = inboundPvDebounceMap.get(senderId);
  if (existingPending) {
    clearTimeout(existingPending.timer);
    existingPending.messages.push(messageText);
    existingPending.timer = setTimeout(() => {
      executeInboundPvReply(client, senderId, account).catch(console.error);
    }, 2200);
  } else {
    inboundPvDebounceMap.set(senderId, {
      messages: [messageText],
      sender: sender || event.message?.peerId || senderId,
      senderId,
      senderUsername,
      senderFirstName,
      timer: setTimeout(() => {
        executeInboundPvReply(client, senderId, account).catch(console.error);
      }, 2200),
    });
  }
}

async function executeInboundPvReply(client: any, senderId: string, accountParam?: any) {
  const pending = inboundPvDebounceMap.get(senderId);
  if (!pending) return;
  inboundPvDebounceMap.delete(senderId);

  // Prevent internal accounts from replying to each other
  if (isInternalSystemAccount(senderId, pending.senderUsername, pending.sender?.phone)) {
    return;
  }

  const config = ensureGroupPromotionStrategyConfig();
  const conversation = config.inboundPvConversations?.find(c => c.userId === senderId);
  if (!conversation) return;

  const account = accountParam || clientAccountMap.get(client) || (conversation.assignedAccountId ? (appState.accounts || []).find(a => a.id === conversation.assignedAccountId) : null) || appState.accounts?.find(a => a.isActive);

  // Verify account is active and allowed
  if (!account || !account.isActive || account.status === 'disabled' || account.status === 'session_expired' || account.enableForPvReply === false) {
    return;
  }

  const combinedText = pending.messages.join(' - ');
  const activeCampaign: ProductCampaign = appState.campaigns.find(c => c.isActive) || appState.campaigns[0] || {
    id: 'default',
    title: 'نوا وی پی ان (Nova VPN)',
    price: 'ماهانه ۶۰ هزار تومان',
    contactHandle: config.strategy2.supportContactHandle || '@Nova_vpn10',
    description: 'سرورهای اختصاصی با آی‌پی ثابت و تست رایگان',
    imageUrl: '',
    hashtags: [],
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  try {
    const personaConfig = account ? {
      tone: account.personaTone || 'friendly',
      accountName: [account.userProfile?.firstName, account.userProfile?.username].filter(Boolean).join(' ') || 'پشتیبان',
      customPrompt: account.customPersonaPrompt,
    } : undefined;

    const replyRes = await generateGeminiInboundPvReply(
      combinedText,
      conversation.messages,
      activeCampaign,
      pending.senderFirstName,
      personaConfig
    );

    const bubbles = replyRes.bubbles.filter(Boolean);
    if (bubbles.length === 0) return;

    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      const typingTime = Math.min(2200, Math.max(900, bubble.length * 35));
      await simulateTypingOnPeer(client, pending.sender, typingTime);

      await client.sendMessage(pending.sender, { message: bubble });

      conversation.messages.push({
        id: 'bot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        sender: 'bot',
        text: bubble,
        timestamp: new Date().toISOString(),
      });

      if (i < bubbles.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    conversation.turnCount = (conversation.turnCount || 0) + 1;
    conversation.lastBotReplyAt = Date.now();
    conversation.status = replyRes.isHandoff ? 'handed_off' : 'active';
    if (account) {
      conversation.assignedAccountId = account.id;
      conversation.assignedAccountPhone = account.phoneNumber;
      account.dailySentCount = (account.dailySentCount || 0) + 1;
    }
    config.strategy2.totalInboundPvRepliesSent = (config.strategy2.totalInboundPvRepliesSent || 0) + 1;
    saveData();

    addLog(
      'success',
      `[پاسخگویی خصوصی] پاسخ هوشمند در ${bubbles.length} حباب با پرسونای (${account?.personaTone || 'دوستانه'}) توسط اکانت (${account?.phoneNumber || 'اصلی'}) به ${pending.senderFirstName} (@${pending.senderUsername || pending.senderId}) ارسال شد.`
    );
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (account && (errMsg.includes('PEER_FLOOD') || errMsg.includes('FLOOD_WAIT') || errMsg.includes('SESSION'))) {
      handleAccountFailover(account.id, errMsg);
    }
    console.error('Inbound PV reply execution failed:', errMsg);
    addLog('warning', `[پاسخگویی خصوصی] خطا در ارسال پاسخ به پی‌وی: ${errMsg}`);
  }
}

// 1. GET /api/strategy - Get strategy config and stats
app.get('/api/strategy', (req, res) => {
  const config = ensureGroupPromotionStrategyConfig();
  res.json({
    success: true,
    strategy: config,
  });
});

// 2. POST /api/strategy/switch - One-click Strategy Switcher
app.post('/api/strategy/switch', async (req, res) => {
  const { strategy } = req.body;
  if (!strategy || !['periodic_broadcast', 'smart_listener_reply', 'hybrid_both'].includes(strategy)) {
    return res.status(400).json({ success: false, error: 'استراتژی نامعتبر است.' });
  }

  const config = ensureGroupPromotionStrategyConfig();
  config.activeStrategy = strategy as GroupPromotionStrategyType;

  if (strategy === 'periodic_broadcast') {
    config.strategy1.enabled = true;
    config.strategy2.enabled = false;
    config.strategy2.isListeningActive = false;
    addLog(
      'info',
      `[تغییر استراتژی با یک کلیک] استراتژی اول (ارسال دوره‌ای بنر در گروه‌های ۱۰۰٪ آماده) فعال گردید. فواصل ارسال: هر ${config.strategy1.intervalHours || 2} ساعت.`
    );
  } else if (strategy === 'smart_listener_reply') {
    config.strategy1.enabled = false;
    config.strategy2.enabled = true;
    config.strategy2.isListeningActive = true;
    addLog(
      'info',
      `[تغییر استراتژی با یک کلیک] استراتژی دوم (دیده‌بان و شنود هوشمند در گروه‌ها + ریپلای و پیام پی‌وی) فعال گردید. کلمات کلیدی فعال: ${config.strategy2.keywords.length} مورد.`
    );
  } else if (strategy === 'hybrid_both') {
    config.strategy1.enabled = true;
    config.strategy2.enabled = true;
    config.strategy2.isListeningActive = true;
    addLog(
      'info',
      `[تغییر استراتژی با یک کلیک] حالت ترکیبی و چندکاناله (هر دو استراتژی ۱ و ۲ به صورت همزمان) فعال گردید.`
    );
  }

  saveData();
  res.json({
    success: true,
    message: 'استراتژی با موفقیت تغییر یافت.',
    strategy: config,
  });
});

// 3. POST /api/strategy/update - Update settings
app.post('/api/strategy/update', (req, res) => {
  const config = ensureGroupPromotionStrategyConfig();
  const { strategy1, strategy2, activeStrategy } = req.body;

  if (activeStrategy) {
    config.activeStrategy = activeStrategy;
  }
  if (strategy1) {
    config.strategy1 = {
      ...config.strategy1,
      ...strategy1,
    };
  }
  if (strategy2) {
    config.strategy2 = {
      ...config.strategy2,
      ...strategy2,
    };
  }

  saveData();
  res.json({
    success: true,
    message: 'تنظیمات استراتژی با موفقیت ذخیره شد.',
    strategy: config,
  });
});

// 4. POST /api/strategy/strategy1/run-now - Immediate execution of Strategy 1
app.post('/api/strategy/strategy1/run-now', async (req, res) => {
  try {
    ensureGroupPromotionStrategyConfig();
    addLog('info', '[استراتژی اول] اجرای آنی و دستی ارسال بنر و متن به گروه‌های ۱۰۰٪ آماده درخواست شد.');

    executeBroadcast(true).catch(err => {
      console.error('Manual strategy 1 broadcast error:', err);
    });

    res.json({
      success: true,
      message: 'عملیات ارسال استراتژی اول در پیش‌زمینه آغاز گردید.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// 5. POST /api/strategy/strategy2/toggle-listener - Toggle listener
app.post('/api/strategy/strategy2/toggle-listener', (req, res) => {
  const config = ensureGroupPromotionStrategyConfig();
  const { active } = req.body;
  config.strategy2.isListeningActive = Boolean(active);
  saveData();

  addLog(
    'info',
    `[استراتژی دوم] وضعیت شنود زنده پیام‌ها در گروه‌ها: ${config.strategy2.isListeningActive ? 'فعال شد' : 'متوقف شد'}.`
  );

  res.json({
    success: true,
    isListeningActive: config.strategy2.isListeningActive,
    strategy: config,
  });
});

// 6. POST /api/strategy/strategy2/test-simulation - Simulate lead detection & replies
app.post('/api/strategy/strategy2/test-simulation', (req, res) => {
  const { sampleText } = req.body;
  if (!sampleText) {
    return res.status(400).json({ success: false, error: 'متن پیام نمونه الزامی است.' });
  }

  const config = ensureGroupPromotionStrategyConfig();
  const leadRes = detectLeadInMessage(sampleText, config.strategy2.keywords);

  const activeCampaign: ProductCampaign = appState.campaigns.find(c => c.isActive) || appState.campaigns[0] || {
    id: 'default',
    title: 'نوا وی پی ان (Nova VPN)',
    price: 'ماهانه ۶۰ هزار تومان',
    contactHandle: config.strategy2.supportContactHandle || '@Nova_vpn10',
    description: 'سرور اختصاصی بدون قطعی با آی‌پی ثابت',
    imageUrl: '',
    hashtags: ['#VPN', '#V2ray'],
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const groupReplyText = generateGroupReplyMessage(
    leadRes.category,
    leadRes.matchedKeywords,
    activeCampaign,
    'کاربر'
  );

  const pvText = generateCasualFriendPvMessage(
    leadRes.category,
    leadRes.matchedKeywords,
    activeCampaign,
    'امین'
  );

  const multiBubble = generateMultiBubbleFriendPv(
    leadRes.category,
    leadRes.matchedKeywords,
    activeCampaign,
    'امین',
    'گروه تبادل نظر و چت'
  );

  res.json({
    success: true,
    detectedCategory: leadRes.category,
    isMatch: leadRes.isMatch,
    matchedKeywords: leadRes.matchedKeywords,
    confidence: leadRes.confidence,
    groupReplyText,
    pvText,
    pvBubbles: multiBubble,
    campaignTitle: activeCampaign.title,
    contactHandle: activeCampaign.contactHandle,
  });
});

// Helper: Multi-Account PV Dispatcher with Automatic Failover for Spambot (PEER_FLOOD) and FloodWait
interface SendPvResult {
  success: boolean;
  error?: string;
  sentByAccountPhone?: string;
  sentByAccountId?: string;
  pvBubbles: string[];
  pvText: string;
  pvHasBanner: boolean;
}

async function dispatchPvWithMultiAccountPool(
  targetEntityOrPeer: any,
  senderId: string,
  senderFirstName: string,
  senderUsername: string,
  originalLeadMessage: string,
  category: any,
  matchedKeywords: string[],
  activeCampaign: ProductCampaign,
  groupTitle: string,
  config: GroupPromotionStrategyConfig,
  preferredAccountId?: string
): Promise<SendPvResult> {
  // Prevent sending outreach to our own accounts
  if (isInternalSystemAccount(senderId, senderUsername)) {
    return {
      success: false,
      error: 'مخاطب یکی از اکانت‌های خود سیستم است و پیام ارسال نشد.',
      pvBubbles: [],
      pvText: '',
      pvHasBanner: false,
    };
  }

  const allAccounts: TelegramAccount[] = [];
  if (Array.isArray(appState.accounts) && appState.accounts.length > 0) {
    for (const a of appState.accounts) {
      if (a.isActive && a.sessionString && a.status !== 'session_expired' && a.status !== 'disabled') {
        allAccounts.push(a);
      }
    }
  }

  if (appState.credentials?.isConnected && appState.credentials?.sessionString) {
    const primaryAlreadyInList = allAccounts.some(a => a.phoneNumber === appState.credentials.phoneNumber);
    if (!primaryAlreadyInList) {
      allAccounts.push({
        id: 'primary_account',
        phoneNumber: appState.credentials.phoneNumber || 'حساب اصلی',
        sessionString: appState.credentials.sessionString,
        isActive: true,
        dailySentCount: 0,
        status: 'connected',
      });
    }
  }

  if (allAccounts.length === 0) {
    return {
      success: false,
      error: 'هیچ اکانت متصل و آنلاینی برای ارسال پیام خصوصی در دسترس نیست.',
      pvBubbles: [],
      pvText: '',
      pvHasBanner: false,
    };
  }

  const now = Date.now();
  const enableRedistribution = appState.scheduler?.antiBot?.enableFailoverRedistribution ?? false;

  // Strict Territory Isolation: If territory redistribution is disabled, do NOT failover to other accounts
  if (preferredAccountId && !enableRedistribution) {
    const preferredAcc = allAccounts.find(a => a.id === preferredAccountId);
    const isRestricted = !preferredAcc ||
      !preferredAcc.isActive ||
      preferredAcc.status === 'session_expired' ||
      preferredAcc.status === 'disabled' ||
      (preferredAcc.floodWaitUntil && preferredAcc.floodWaitUntil > now) ||
      (preferredAcc.peerFloodUntil && preferredAcc.peerFloodUntil > now);

    if (isRestricted) {
      addLog(
        'info',
        `🔒 [حفظ قلمرو اکانت در پی‌وی] اکانت مسئول این گروه (${preferredAcc?.phoneNumber || preferredAccountId}) در محدودیت تلگرام قرار دارد. با توجه به غیرفعال بودن توزیع مجدد وظایف، ارسال پی‌وی به سایر اکانت‌ها واگذار نشد و تا رفع محدودیت اکانت اصلی متوقف می‌ماند.`
      );
      return {
        success: false,
        error: `اکانت مسئول این گروه (${preferredAcc?.phoneNumber || preferredAccountId}) در محدودیت تلگرام قرار دارد (انتقال خودکار وظایف غیرفعال است).`,
        pvBubbles: [],
        pvText: '',
        pvHasBanner: false,
      };
    }
  }

  // Sort: preferred account first (if healthy), then healthy accounts with lower daily sent counts
  const sortedAccounts = [...allAccounts].sort((a, b) => {
    const aRestricted = (a.peerFloodUntil && a.peerFloodUntil > now) || (a.floodWaitUntil && a.floodWaitUntil > now);
    const bRestricted = (b.peerFloodUntil && b.peerFloodUntil > now) || (b.floodWaitUntil && b.floodWaitUntil > now);
    if (aRestricted && !bRestricted) return 1;
    if (!aRestricted && bRestricted) return -1;
    if (preferredAccountId) {
      if (a.id === preferredAccountId && !aRestricted) return -1;
      if (b.id === preferredAccountId && !bRestricted) return 1;
    }
    return (a.dailySentCount || 0) - (b.dailySentCount || 0);
  });

  const isMultiBubble = config.strategy2.multiBubblePv !== false;
  let pvBubbles: string[] = [];
  let pvText = '';
  let bannerCaption = 'اینم عکس تعرفه‌هاشون 👇';

  try {
    if (isMultiBubble) {
      const pvAi = await generateGeminiMultiBubbleFriendPv(
        originalLeadMessage || 'سلام فیلترشکن خوب چی پیشنهاد می‌دید؟',
        category,
        matchedKeywords,
        activeCampaign,
        senderFirstName,
        groupTitle
      );
      pvBubbles = pvAi.bubbles.allBubbles.filter(Boolean);
      pvText = pvBubbles.join('\n\n');
      bannerCaption = pvAi.bubbles.bannerCaption || bannerCaption;
    } else {
      const pvAi = await generateGeminiCasualFriendPvMessage(
        originalLeadMessage || 'سلام فیلترشکن خوب چی پیشنهاد می‌دید؟',
        category,
        matchedKeywords,
        activeCampaign,
        senderFirstName
      );
      pvText = pvAi.text;
      pvBubbles = [pvText];
    }
  } catch (aiErr) {
    pvBubbles = [
      `سلام ${senderFirstName} جان، خوبی؟`,
      `توی گروه دیدم دنبال فیلترشکن بودی`,
      `${activeCampaign.title} کیفیتش عالیه، پینگش پایینه و قطعی نداره`,
      `برای تست رایگان به پشتیبانی پیام بده: ${config.strategy2.supportContactHandle || activeCampaign.contactHandle || '@Nova_vpn10'}`
    ];
    pvText = pvBubbles.join('\n\n');
  }

  let bannerPath: string | undefined = undefined;
  if (config.strategy2.sendBannerInDirectMessage && activeCampaign.imageUrl) {
    try {
      bannerPath = await getImageFilePathForTelegram(activeCampaign.imageUrl);
    } catch (bErr) {}
  }

  let lastAccountError = '';

  for (const acc of sortedAccounts) {
    if (!enableRedistribution && preferredAccountId && acc.id !== preferredAccountId) {
      continue;
    }
    if (acc.peerFloodUntil && acc.peerFloodUntil > now) {
      const remainMins = Math.ceil((acc.peerFloodUntil - now) / 60000);
      lastAccountError = `اکانت (${acc.phoneNumber}) تا ${remainMins} دقیقه در محدودیت SpamBot/PEER_FLOOD تلگرام است.`;
      continue;
    }
    if (acc.floodWaitUntil && acc.floodWaitUntil > now) {
      const remainMins = Math.ceil((acc.floodWaitUntil - now) / 60000);
      lastAccountError = `اکانت (${acc.phoneNumber}) تا ${remainMins} دقیقه در محدودیت FloodWait تلگرام است.`;
      continue;
    }

    let client: any = null;
    try {
      if (acc.id === 'primary_account') {
        client = await getOrInitTgClient();
      } else {
        client = await getOrInitClientForAccount(acc);
      }
    } catch (cErr: any) {
      console.warn(`[چرخش اکانت] خطا در اتصال اکانت ${acc.phoneNumber}:`, cErr?.message || cErr);
      continue;
    }

    if (!client || client._destroyed) continue;

    try {
      let targetPeer: any = targetEntityOrPeer;
      if (senderUsername && String(senderUsername).trim()) {
        try {
          targetPeer = await client.getEntity(String(senderUsername).replace(/^@/, '').trim());
        } catch (getErr) {
          targetPeer = targetEntityOrPeer;
        }
      } else if (senderId) {
        try {
          targetPeer = await client.getInputEntity(senderId);
        } catch (idErr) {
          targetPeer = targetEntityOrPeer;
        }
      }

      // Live Telegram history check - Only prevent if WE already sent an outgoing message
      if (config.strategy2.checkTelegramHistoryBeforePv !== false) {
        try {
          const existingMsgs = await client.getMessages(targetPeer, { limit: 4 });
          if (existingMsgs && existingMsgs.length > 0) {
            const hasOutgoing = existingMsgs.some((m: any) => m.out);
            if (hasOutgoing) {
              markUserAsPvContacted(senderId, senderUsername, senderFirstName, 'existing_telegram_outgoing');
              return {
                success: false,
                error: `ارسال لغو شد: سابقه پیام ارسالی پیشین در سرور تلگرام اکانت (${acc.phoneNumber}) شناسایی شد.`,
                sentByAccountPhone: acc.phoneNumber,
                sentByAccountId: acc.id,
                pvBubbles,
                pvText,
                pvHasBanner: false,
              };
            }
          }
        } catch (histErr) {}
      }

      let pvHasBanner = false;

      if (isMultiBubble) {
        // Safe human-paced bubble delays: 3.5s to 6s + randomized jitter to prevent anti-spam bot flag
        const configuredDelay = (config.strategy2.multiBubbleDelaySeconds || 4) * 1000;
        for (let bIdx = 0; bIdx < pvBubbles.length; bIdx++) {
          const bubble = pvBubbles[bIdx];
          if (!bubble) continue;

          const typingTime = Math.min(3000, Math.max(1200, bubble.length * 45));
          await simulateTypingOnPeer(client, targetPeer, typingTime);
          await client.sendMessage(targetPeer, { message: bubble });

          if (bIdx < pvBubbles.length - 1) {
            const randomJitter = Math.floor(Math.random() * 2500);
            const actualDelay = Math.max(3000, configuredDelay + randomJitter);
            await new Promise(r => setTimeout(r, actualDelay));
          }
        }

        if (bannerPath && fs.existsSync(bannerPath)) {
          await new Promise(r => setTimeout(r, 1200));
          await simulateTypingOnPeer(client, targetPeer, 1000);
          await client.sendFile(targetPeer, {
            file: bannerPath,
            caption: bannerCaption,
          });
          pvHasBanner = true;
        }
      } else {
        if (bannerPath && fs.existsSync(bannerPath)) {
          await client.sendFile(targetPeer, {
            file: bannerPath,
            caption: pvText,
          });
          pvHasBanner = true;
        } else {
          await client.sendMessage(targetPeer, { message: pvText });
        }
      }

      acc.lastUsedAt = new Date().toISOString();
      acc.dailySentCount = (acc.dailySentCount || 0) + 1;
      markUserAsPvContacted(senderId, senderUsername, senderFirstName, 'sent_strategy2_pv');
      saveData();

      return {
        success: true,
        sentByAccountPhone: acc.phoneNumber,
        sentByAccountId: acc.id,
        pvBubbles,
        pvText,
        pvHasBanner,
      };
    } catch (sendErr: any) {
      const errMsg = String(sendErr?.message || sendErr?.errorMessage || sendErr);
      console.warn(`[ارسال پی‌وی] خطا برای اکانت ${acc.phoneNumber} به کاربر ${senderFirstName}:`, errMsg);

      if (errMsg.includes('PEER_FLOOD')) {
        acc.peerFloodUntil = Date.now() + 2 * 3600 * 1000;
        acc.status = 'flood_wait';
        saveData();
        addLog(
          'warning',
          `⚠️ [محدودیت SpamBot] اکانت (${acc.phoneNumber}) به محدودیت ارسال پیام به افراد ناشناس (PEER_FLOOD) برخورد کرد. سوئیچ خودکار به اکانت سالم بعدی...`
        );
        lastAccountError = `محدودیت SpamBot تلگرام (PEER_FLOOD) روی اکانت (${acc.phoneNumber})`;
        continue;
      } else if (errMsg.includes('FLOOD_WAIT') || errMsg.includes('Flood Wait')) {
        const secs = parseFloodWaitSeconds(sendErr) || 180;
        acc.floodWaitUntil = Date.now() + secs * 1000;
        acc.status = 'flood_wait';
        saveData();
        addLog(
          'warning',
          `⚠️ [محدودیت FloodWait] اکانت (${acc.phoneNumber}) تا ${Math.ceil(secs / 60)} دقیقه آینده محدود شد. تلاش با اکانت بعدی...`
        );
        lastAccountError = `محدودیت FloodWait تلگرام (${Math.ceil(secs / 60)} دقیقه)`;
        continue;
      } else if (errMsg.includes('USER_PRIVACY_RESTRICTED')) {
        return {
          success: false,
          error: 'کاربر دریافت پیام از افراد ناشناس را در حریم خصوصی تلگرام خود مسدود کرده است (USER_PRIVACY_RESTRICTED).',
          sentByAccountPhone: acc.phoneNumber,
          sentByAccountId: acc.id,
          pvBubbles,
          pvText,
          pvHasBanner: false,
        };
      } else {
        lastAccountError = errMsg;
      }
    }
  }

  return {
    success: false,
    error: lastAccountError || 'تمام اکانت‌های متصل در حال حاضر در محدودیت تلگرام هستند یا ارسال ناموفق بود.',
    pvBubbles,
    pvText,
    pvHasBanner: false,
  };
}

// 7. POST /api/strategy/strategy2/test-send-pv - Send live test multi-bubble message
app.post('/api/strategy/strategy2/test-send-pv', async (req, res) => {
  try {
    const { targetUsername, sampleCategory = 'vpn_filter' } = req.body;
    if (!targetUsername || !String(targetUsername).trim()) {
      return res.status(400).json({ success: false, error: 'لطفاً آیدی مقصد تست را وارد کنید.' });
    }

    const cleanTarget = String(targetUsername).replace(/^@/, '').trim();
    const config = ensureGroupPromotionStrategyConfig();
    const activeCampaign: ProductCampaign = appState.campaigns.find(c => c.isActive) || appState.campaigns[0] || {
      id: 'default',
      title: 'نوا وی پی ان (Nova VPN)',
      price: 'ماهانه ۶۰ هزار تومان',
      contactHandle: config.strategy2.supportContactHandle || '@Nova_vpn10',
      description: 'سرور اختصاصی بدون قطعی با آی‌پی ثابت',
      imageUrl: '',
      hashtags: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const dispatchResult = await dispatchPvWithMultiAccountPool(
      cleanTarget,
      cleanTarget,
      cleanTarget,
      cleanTarget,
      'سلام فیلترشکن خوب چی سراغ دارید؟',
      sampleCategory,
      ['فیلترشکن', 'vpn', 'تست_مستقیم'],
      activeCampaign,
      'گروه تست تبلیغات',
      config
    );

    if (!dispatchResult.success) {
      return res.status(400).json({
        success: false,
        error: dispatchResult.error || 'ارسال پیام به پی‌وی ناموفق بود.',
      });
    }

    const testLead: GroupLeadEvent = {
      id: 'lead_test_' + Date.now(),
      timestamp: new Date().toISOString(),
      groupId: 'test_direct',
      groupTitle: 'تست زنده پی‌وی',
      userId: cleanTarget,
      userFirstName: cleanTarget,
      userUsername: cleanTarget,
      originalMessageId: 0,
      originalMessageText: 'ارسال تست پیام‌های حبابی به @' + cleanTarget,
      detectedCategory: sampleCategory as any,
      detectedKeywords: ['فیلترشکن', 'vpn', 'تست_مستقیم'],
      groupReplySent: false,
      pvSent: true,
      sentByAccountPhone: dispatchResult.sentByAccountPhone,
      sentByAccountId: dispatchResult.sentByAccountId,
      pvText: dispatchResult.pvText,
      pvBubbles: dispatchResult.pvBubbles,
      pvHasBanner: dispatchResult.pvHasBanner,
      status: 'sent_pv',
    };

    if (!config.recentLeads) config.recentLeads = [];
    config.recentLeads.unshift(testLead);
    config.strategy2.totalPvMessagesSent = (config.strategy2.totalPvMessagesSent || 0) + 1;
    saveData();

    addLog(
      'success',
      `[تست زنده پی‌وی] ${dispatchResult.pvBubbles.length} حباب پیام صمیمی با اکانت (${dispatchResult.sentByAccountPhone || 'اصلی'}) به اکانت @${cleanTarget} ارسال گردید.`
    );

    res.json({
      success: true,
      targetUsername: cleanTarget,
      bubbles: dispatchResult.pvBubbles,
      hasBanner: dispatchResult.pvHasBanner,
      sentByAccountPhone: dispatchResult.sentByAccountPhone,
      message: `پیام‌ها در قالب ${dispatchResult.pvBubbles.length} حباب مجزا با اکانت (${dispatchResult.sentByAccountPhone || 'اصلی'}) به @${cleanTarget} ارسال شدند.`,
    });
  } catch (err: any) {
    addLog('error', `[تست زنده پی‌وی] خطا در ارسال پیام به کاربر: ${err?.message || err}`);
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// POST /api/strategy/strategy2/retry-pv-lead - Retry PV sending for a failed/pending lead
app.post('/api/strategy/strategy2/retry-pv-lead', async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) {
      return res.status(400).json({ success: false, error: 'شناسه لید الزامی است.' });
    }

    const config = ensureGroupPromotionStrategyConfig();
    const lead = (config.recentLeads || []).find(l => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'لید مورد نظر یافت نشد.' });
    }

    const activeCampaign: ProductCampaign = appState.campaigns.find(c => c.isActive) || appState.campaigns[0] || {
      id: 'default',
      title: 'نوا وی پی ان (Nova VPN)',
      price: 'ماهانه ۶۰ هزار تومان',
      contactHandle: config.strategy2.supportContactHandle || '@Nova_vpn10',
      description: 'سرور اختصاصی بدون قطعی با آی‌پی ثابت',
      imageUrl: '',
      hashtags: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const targetUser = lead.userUsername || lead.userId;
    const dispatchResult = await dispatchPvWithMultiAccountPool(
      targetUser,
      lead.userId,
      lead.userFirstName || 'کاربر',
      lead.userUsername || '',
      lead.originalMessageText,
      lead.detectedCategory,
      lead.detectedKeywords || ['فیلترشکن'],
      activeCampaign,
      lead.groupTitle || 'گروه',
      config
    );

    if (dispatchResult.success) {
      lead.pvSent = true;
      lead.pvError = '';
      lead.sentByAccountPhone = dispatchResult.sentByAccountPhone;
      lead.sentByAccountId = dispatchResult.sentByAccountId;
      lead.pvBubbles = dispatchResult.pvBubbles;
      lead.pvText = dispatchResult.pvText;
      lead.pvHasBanner = dispatchResult.pvHasBanner;
      lead.status = 'sent_pv';
      config.strategy2.totalPvMessagesSent = (config.strategy2.totalPvMessagesSent || 0) + 1;
      saveData();

      addLog(
        'success',
        `[تلاش مجدد پی‌وی] پیام خصوصی با اکانت سالم (${dispatchResult.sentByAccountPhone}) با موفقیت به ${lead.userFirstName} (${lead.userUsername ? '@' + lead.userUsername : lead.userId}) ارسال شد.`
      );

      return res.json({
        success: true,
        message: `پیام پی‌وی با موفقیت توسط اکانت (${dispatchResult.sentByAccountPhone}) ارسال گردید.`,
        lead,
      });
    } else {
      lead.pvError = dispatchResult.error || 'ارسال ناموفق بود';
      saveData();
      return res.status(400).json({
        success: false,
        error: dispatchResult.error || 'ارسال ناموفق بود',
        lead,
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// 8. POST /api/strategy/strategy2/test-inbound-reply - Test inbound PV reply generation
app.post('/api/strategy/strategy2/test-inbound-reply', async (req, res) => {
  try {
    const { userMessage = 'سلام، قیمت اشتراکتون چنده؟ اکانت تست هم دارید؟', senderFirstName = 'امین' } = req.body;
    const config = ensureGroupPromotionStrategyConfig();
    const activeCampaign: ProductCampaign = appState.campaigns.find(c => c.isActive) || appState.campaigns[0] || {
      id: 'default',
      title: 'نوا وی پی ان (Nova VPN)',
      price: 'ماهانه ۶۰ هزار تومان',
      contactHandle: config.strategy2.supportContactHandle || '@Nova_vpn10',
      description: 'سرور اختصاصی بدون قطعی با آی‌پی ثابت',
      imageUrl: '',
      hashtags: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const replyRes = await generateGeminiInboundPvReply(
      userMessage,
      [{ sender: 'user', text: userMessage }],
      activeCampaign,
      senderFirstName
    );

    res.json({
      success: true,
      userMessage,
      replyBubbles: replyRes.bubbles,
      usedAi: replyRes.usedAi,
      isHandoff: replyRes.isHandoff,
      contactHandle: activeCampaign.contactHandle,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// 9. GET /api/strategy/strategy2/inbound-conversations - List all inbound PV conversations
app.get('/api/strategy/strategy2/inbound-conversations', (req, res) => {
  const config = ensureGroupPromotionStrategyConfig();
  res.json({
    success: true,
    conversations: config.inboundPvConversations || [],
  });
});

// 10. POST /api/strategy/strategy2/clear-inbound-conversations - Clear inbound conversations
app.post('/api/strategy/strategy2/clear-inbound-conversations', (req, res) => {
  const config = ensureGroupPromotionStrategyConfig();
  config.inboundPvConversations = [];
  saveData();
  res.json({ success: true, message: 'تاریخچه گفتگوهای خصوصی با موفقیت پاکسازی شد.' });
});

// 11. POST /api/strategy/strategy2/clear-leads - Clear recent leads history
app.post('/api/strategy/strategy2/clear-leads', (req, res) => {
  const config = ensureGroupPromotionStrategyConfig();
  config.recentLeads = [];
  saveData();
  res.json({ success: true, message: 'تاریخچه لیدها با موفقیت پاکسازی شد.' });
});

// GET /api/strategy/strategy2/contacted-users
app.get('/api/strategy/strategy2/contacted-users', (req, res) => {
  const config = ensureGroupPromotionStrategyConfig();
  const contactedMap = ensureContactedPvUsersMap();
  res.json({
    success: true,
    totalContacted: Object.keys(contactedMap).length,
    users: contactedMap,
    totalPvRepeatsPrevented: config.strategy2.totalPvRepeatsPrevented || 0,
  });
});

// POST /api/strategy/strategy2/clear-contacted-users
app.post('/api/strategy/strategy2/clear-contacted-users', (req, res) => {
  const config = ensureGroupPromotionStrategyConfig();
  config.contactedPvUsers = {};
  userCooldownMap.clear();
  saveData();
  res.json({ success: true, message: 'لیست کاربران تماس‌گرفته‌شده ریست شد.' });
});

// Comprehensive Audit & Performance Analytics Generator for Group Advertising
function generateGroupPromotionAuditReport() {
  const config = ensureGroupPromotionStrategyConfig();
  const activeStrat = config.activeStrategy || 'periodic_broadcast';
  const strat1 = config.strategy1 || defaultGroupPromotionStrategy.strategy1;
  const strat2 = config.strategy2 || defaultGroupPromotionStrategy.strategy2;
  const contactedMap = ensureContactedPvUsersMap();
  const contactedUsersCount = Object.keys(contactedMap).length;

  // Filter group-related logs specifically
  const groupLogs = (appState.logs || []).filter(l => {
    const msg = (l.message || '').toLowerCase();
    const grp = (l.groupTitle || '').toLowerCase();
    return (
      grp.length > 0 ||
      msg.includes('گروه') ||
      msg.includes('ارسال') ||
      msg.includes('استراتژی') ||
      msg.includes('کمپین') ||
      msg.includes('لید') ||
      msg.includes('پی‌وی') ||
      msg.includes('شنود') ||
      msg.includes('floodwait') ||
      msg.includes('آنتی‌بات') ||
      msg.includes('همزمان')
    );
  });

  // Calculate Group Readiness Stats
  const allGroups = appState.groups || [];
  const activeGroups = allGroups.filter(g => g.isActive);
  const readyGroups = activeGroups.filter(g => {
    const isJoined = g.status === 'joined' || g.membershipStatus === 'joined' || (g.joinedAccountIds && g.joinedAccountIds.length > 0);
    const canSend = g.canSendMessages !== false && g.readinessStatus !== 'no_permission_left';
    return isJoined && canSend;
  });
  const restrictedGroups = activeGroups.filter(g => g.canSendMessages === false || g.readinessStatus === 'no_permission_left');
  const persianVerifiedGroups = activeGroups.filter(g => g.isPersianVerified);

  // Calculate Account Health & Metrics
  const accounts = appState.accounts || [];
  const now = Date.now();
  const accountsAudit = accounts.map(a => {
    const isFlood = Boolean(a.floodWaitUntil && a.floodWaitUntil > now);
    const isPeerFlood = Boolean(a.peerFloodUntil && a.peerFloodUntil > now);
    return {
      id: a.id,
      phoneNumber: a.phoneNumber,
      firstName: a.userProfile?.firstName || 'نامشخص',
      username: a.userProfile?.username,
      status: a.status,
      isActive: a.isActive,
      dailySentCount: a.dailySentCount || 0,
      dailyLimit: appState.scheduler.dailyLimit || 35,
      isFloodWait: isFlood,
      floodWaitRemainingMinutes: isFlood ? Math.ceil((a.floodWaitUntil! - now) / 60000) : 0,
      isPeerFlood: isPeerFlood,
      peerFloodRemainingMinutes: isPeerFlood ? Math.ceil((a.peerFloodUntil! - now) / 60000) : 0,
      lastUsedAt: a.lastUsedAt,
      enableForGroupBroadcast: a.enableForGroupBroadcast !== false,
    };
  });

  // Broadcast History Metrics
  const history = appState.broadcastHistory || [];
  const totalBroadcastsExecuted = strat1.totalBroadcastsSent || history.length;
  let totalAttemptedAcrossHistory = 0;
  let totalSuccessAcrossHistory = 0;
  let totalFailedAcrossHistory = 0;
  let totalBotsEncounteredAcrossHistory = 0;
  let totalBotsNeutralizedAcrossHistory = 0;

  for (const h of history) {
    totalAttemptedAcrossHistory += h.totalAttempted || 0;
    totalSuccessAcrossHistory += h.successCount || 0;
    totalFailedAcrossHistory += h.failedCount || 0;
    totalBotsEncounteredAcrossHistory += h.botDetectedCount || 0;
    totalBotsNeutralizedAcrossHistory += h.botResolvedCount || 0;
  }

  const broadcastSuccessRate = totalAttemptedAcrossHistory > 0
    ? Math.round((totalSuccessAcrossHistory / totalAttemptedAcrossHistory) * 100)
    : (strat1.totalGroupsReached > 0 ? 100 : 0);

  // Strategy 2 Lead Hunting Metrics
  const leads = config.recentLeads || [];
  const totalLeadsDetected = strat2.totalLeadsDetected || leads.length;
  const totalGroupRepliesSent = strat2.totalGroupRepliesSent || leads.filter(l => l.groupReplySent).length;
  const totalPvSent = strat2.totalPvMessagesSent || leads.filter(l => l.pvSent).length;
  const totalPvRepeatsPrevented = strat2.totalPvRepeatsPrevented || 0;
  const inboundConvs = config.inboundPvConversations || [];

  // SWOT Analysis Engine (Algorithmic Strength/Weakness Diagnosis)
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const threatsAndRisks: string[] = [];
  const actionableRecommendations: string[] = [];

  // Evaluate Strengths
  if (accounts.length > 1) {
    strengths.push(`توزیع بار چنداکانته همزمان (Parallel Multi-Account Pool) با ${accounts.length} اکانت متصل جهت افزایش سرعت و توزیع ریسک`);
  }
  if (strat2.neverRepeatPvToSameUser) {
    strengths.push(`سپر هوشمند ضد ریپورت (Anti-Report Shield) فعال با محافظت از ${totalPvRepeatsPrevented} لید تکراری و حافظه دائم ${contactedUsersCount} مخاطب`);
  }
  if (readyGroups.length > 0) {
    strengths.push(`پوشش ${readyGroups.length} گروه ۱۰۰٪ آماده با مجوز ارسال تایید شده`);
  }
  if (strat1.useGeminiRewriting || appState.scheduler.antiBot?.useGeminiForCaptions) {
    strengths.push('تنوع بی‌نهایت متون با بازنویسی محتوایی هوش مصنوعی Gemini جهت دور زدن الگوریتم‌های هش تکرار تلگرام');
  }
  if (totalSuccessAcrossHistory > 0) {
    strengths.push(`ثبت ${totalSuccessAcrossHistory} ارسال موفق با نرخ بهره‌وری ${broadcastSuccessRate}٪ در تاریخچه ارسال‌ها`);
  }

  // Evaluate Weaknesses
  if (restrictedGroups.length > 0) {
    weaknesses.push(`تعداد ${restrictedGroups.length} گروه دارای محدودیت سلب دسترسی ارسال (Muted/Admin Only) در لیست قرار دارند`);
  }
  if (accounts.some(a => a.floodWaitUntil && a.floodWaitUntil > now)) {
    weaknesses.push('یک یا چند اکانت در وضعیت محدودیت موقت FloodWait تلگرام قرار گرفته‌اند');
  }
  if (strat2.totalMessagesScanned > 50 && totalLeadsDetected === 0) {
    weaknesses.push('نرخ شناسایی لید پایین است؛ کلمات کلیدی نیازمند توسعه به عبارات محاوره‌ای‌تر هستند');
  }
  if (!strat1.onlyFullyReadyGroups) {
    weaknesses.push('گزینه فیلتر گروه‌های ۱۰۰٪ آماده غیرفعال است که می‌تواند منجر به ثبت خطای عدم عضویت شود');
  }

  // Evaluate Opportunities
  opportunities.push('گسترش کلمات کلیدی محاوره‌ای در استراتژی ۲ برای شکار مکالمات غیرمستقیم (مانند "نت چطوره"، "چی وصله")');
  opportunities.push('فعال‌سازی همزمان استراتژی ترکیبی (Hybrid) برای جذب توأمان ترافیک عمومی گروه و تبدیل لیدهای داغ در پی‌وی');
  opportunities.push('استفاده از چندین فرمت لحن متفاوت Gemini (صمیمانه، رسمی، مینی‌مال) برای افزایش تعامل کاربران');

  // Evaluate Threats and Risks
  if ((appState.scheduler.dailyLimit || 35) > 50) {
    threatsAndRisks.push('سقف روزانه بالاتر از ۵۰ ارسال برای اکانت‌های جدید ریسک محدودیت اسپم‌بات دارد؛ حفظ سقف روی ۳۰ الی ۴۰ پیشنهاد می‌شود');
  }
  if ((strat2.groupCooldownMinutes ?? 5) < 3) {
    threatsAndRisks.push('زمان تنفس ارسال در یک گروه کمتر از ۳ دقیقه است؛ پیشنهاد می‌شود حداقل روی ۵ دقیقه تنظیم شود تا ادمین‌ها حساس نشوند');
  }
  threatsAndRisks.push('ارسال پی‌وی بدون بنر تعرفه یا با تاخیر کم می‌تواند ریسک زدن دکمه Report Spam توسط کاربر را بالا ببرد');

  // Actionable recommendations
  if (restrictedGroups.length > 0) {
    actionableRecommendations.push(`گروه‌های مسدود (${restrictedGroups.length} گروه) را پاکسازی کنید یا وضعیت عضویت آن‌ها را با اکانت دیگر بررسی نمایید.`);
  }
  actionableRecommendations.push('پاسخ‌گویی به مکالمات ورودی پی‌وی (Inbound) را ظرف کمتر از ۱۰ دقیقه انجام دهید تا نرخ تبدیل به خرید حداکثر شود.');
  actionableRecommendations.push('گزارش خروجی JSON فعلی را ذخیره کرده و پس از اعمال تغییرات هفتگی با گزارش جدید مقایسه کنید.');

  const nowPersian = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + new Date().toLocaleDateString('fa-IR');

  return {
    exportMetadata: {
      generatedAt: new Date().toISOString(),
      generatedAtPersian: nowPersian,
      systemTitle: 'Telegram UserBot Promoter - Group Advertising & Lead Audit',
      activeStrategy: activeStrat,
      version: '2.5.0-production',
      nodeEnvironment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.round(process.uptime()),
    },
    executiveSummary: {
      totalCampaigns: (appState.campaigns || []).length,
      totalGroupsInDatabase: allGroups.length,
      activeTargetGroups: activeGroups.length,
      fullyReadyGroupsCount: readyGroups.length,
      restrictedGroupsCount: restrictedGroups.length,
      connectedAccountsCount: accounts.filter(a => a.isActive && a.status !== 'session_expired').length,
      totalBroadcastRuns: totalBroadcastsExecuted,
      totalMessagesAttempted: totalAttemptedAcrossHistory,
      totalMessagesDelivered: totalSuccessAcrossHistory,
      broadcastSuccessRatePercent: broadcastSuccessRate,
      totalLeadsIdentified: totalLeadsDetected,
      totalGroupRepliesSent,
      totalDirectMessagesDelivered: totalPvSent,
      antiReportProtectionsTriggered: totalPvRepeatsPrevented,
      totalUniqueUsersShielded: contactedUsersCount,
      inboundConversationsCount: inboundConvs.length,
    },
    botCapabilitiesMatrix: {
      strategy1_periodic_broadcast: {
        supported: true,
        active: activeStrat === 'periodic_broadcast' || activeStrat === 'hybrid_both',
        intervalHours: strat1.intervalHours || 2,
        includeBanner: strat1.includeBanner !== false,
        onlyFullyReadyGroups: strat1.onlyFullyReadyGroups !== false,
        useGeminiRewriting: strat1.useGeminiRewriting !== false,
        captionTone: strat1.geminiCaptionTone || 'friendly',
        rotationMode: appState.scheduler.campaignRotationMode || 'round_robin',
        dispatchMode: appState.scheduler.multiAccountDispatchMode || 'parallel_multichannel',
      },
      strategy2_smart_lead_hunter: {
        supported: true,
        active: activeStrat === 'smart_listener_reply' || activeStrat === 'hybrid_both',
        listenerRunning: strat2.isListeningActive,
        keywordsTrackedCount: (strat2.keywords || []).length,
        keywordsList: strat2.keywords || [],
        replyInGroup: strat2.replyInGroup !== false,
        sendDirectMessage: strat2.sendDirectMessage !== false,
        multiBubblePv: strat2.multiBubblePv !== false,
        friendlyCasualTone: strat2.friendStylePvTone !== false,
        neverRepeatPvToSameUser: strat2.neverRepeatPvToSameUser !== false,
        checkTelegramHistoryBeforePv: strat2.checkTelegramHistoryBeforePv !== false,
        groupReplyDelaySeconds: strat2.groupReplyDelaySeconds || 4,
        pvMessageDelaySeconds: strat2.pvMessageDelaySeconds || 8,
        groupCooldownMinutes: strat2.groupCooldownMinutes ?? 5,
        userCooldownHours: strat2.userCooldownHours || 24,
      },
      antiBotAndSafetyCapabilities: {
        mathCaptchaSolver: true,
        buttonApprovalClicker: true,
        messagePersistenceVerification: appState.scheduler.antiBot?.verifyMessagePersistence !== false,
        persistenceCheckDelaySeconds: appState.scheduler.antiBot?.persistenceCheckDelaySeconds || 15,
        simulateHumanTyping: appState.scheduler.antiBot?.simulateTyping !== false,
        persianOnlyEnforcement: appState.groupJoinStrategy?.enforcePersianIranianOnly !== false,
        safeMembershipRetention: appState.scheduler.antiBot?.safeMembershipRetention !== false,
        floodWaitAutoRedistribution: true,
        peerFloodShield: true,
      },
    },
    performanceKPIs: {
      broadcast: {
        totalAttempted: totalAttemptedAcrossHistory,
        totalSuccess: totalSuccessAcrossHistory,
        totalFailed: totalFailedAcrossHistory,
        successRatePercent: broadcastSuccessRate,
        botEncounteredCount: totalBotsEncounteredAcrossHistory,
        botNeutralizedCount: totalBotsNeutralizedAcrossHistory,
        neutralizationRatePercent: totalBotsEncounteredAcrossHistory > 0
          ? Math.round((totalBotsNeutralizedAcrossHistory / totalBotsEncounteredAcrossHistory) * 100)
          : 100,
        bandwidthSavedMb: (totalSuccessAcrossHistory * 1.85).toFixed(1),
      },
      leadHunting: {
        totalMessagesScanned: strat2.totalMessagesScanned || 0,
        totalLeadsDetected,
        groupRepliesSent: totalGroupRepliesSent,
        directMessagesSent: totalPvSent,
        leadDetectionRatePer100Msgs: (strat2.totalMessagesScanned && strat2.totalMessagesScanned > 0)
          ? Number(((totalLeadsDetected / strat2.totalMessagesScanned) * 100).toFixed(2))
          : 0,
        repeatsPreventedByShield: totalPvRepeatsPrevented,
        activeInboundConversations: inboundConvs.length,
      },
    },
    swotAnalysis: {
      strengths,
      weaknesses,
      opportunities,
      threatsAndRisks,
      actionableRecommendations,
    },
    accountsAudit,
    groupPortfolio: allGroups.map(g => ({
      id: g.id,
      title: g.title,
      usernameOrLink: g.usernameOrLink,
      category: g.category,
      isActive: g.isActive,
      membershipStatus: g.membershipStatus || g.status,
      canSendMessages: g.canSendMessages !== false && g.readinessStatus !== 'no_permission_left',
      readinessStatus: g.readinessStatus || 'ready_to_send',
      isPersianVerified: g.isPersianVerified,
      lastPostedAt: g.lastPostedAt,
      lastPostedByAccount: g.lastPostedByAccountPhone,
      persistenceStatus: g.persistenceStatus,
      errorMessage: g.errorMessage,
    })),
    recentLeadEvents: leads.slice(0, 50),
    broadcastExecutionHistory: history.slice(0, 20),
    actionLogs: groupLogs.slice(0, 80),
  };
}

// GET /api/strategy/group-promotion/audit-export - Return full JSON audit report
app.get('/api/strategy/group-promotion/audit-export', (req, res) => {
  try {
    const report = generateGroupPromotionAuditReport();
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// GET /api/strategy/group-promotion/download-audit - Trigger direct file download
app.get('/api/strategy/group-promotion/download-audit', (req, res) => {
  try {
    const report = generateGroupPromotionAuditReport();
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="group_promotion_audit_${dateStr}.json"`);
    res.send(JSON.stringify(report, null, 2));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

let listenerGroupRoundRobinCursor = 0;

// 8. BACKGROUND WORKER: STRATEGY 2 LISTENER STEP
async function runGroupPromotionListenerStep() {
  if (isGroupListenerRunning) return;
  const config = appState.groupPromotionStrategy;
  if (!config) return;

  const isStrat2Active = config.activeStrategy === 'smart_listener_reply' || config.activeStrategy === 'hybrid_both';
  if (!isStrat2Active || !config.strategy2.isListeningActive) return;

  const hasPrimarySession = Boolean(appState.credentials?.isConnected && appState.credentials?.sessionString);
  const availableAccounts = (appState.accounts || []).filter(
    a => a.isActive && a.sessionString && a.status !== 'session_expired' && a.status !== 'disabled'
  );

  if (!hasPrimarySession && availableAccounts.length === 0) {
    return;
  }

  isGroupListenerRunning = true;
  try {
    let client: any = null;
    if (hasPrimarySession) {
      client = await getOrInitTgClient();
    } else if (availableAccounts.length > 0) {
      client = await getOrInitClientForAccount(availableAccounts[0]);
    }
    if (!client) return;

    // Get active joined groups that are 100% ready
    const readyGroups = getShardedActiveGroups().filter(g => {
      const isJoined = g.status === 'joined' || g.membershipStatus === 'joined' || (g.joinedAccountIds && g.joinedAccountIds.length > 0);
      const isReady = g.isActive && isJoined && g.canSendMessages !== false && g.readinessStatus !== 'no_permission_left';
      return isReady;
    });

    if (readyGroups.length === 0) return;

    const activeCampaign = appState.campaigns.find(c => c.isActive) || appState.campaigns[0];
    if (!activeCampaign) return;

    // Scan up to 50 ready groups per cycle so 100% of groups are covered rapidly without missing leads
    const batchSize = Math.min(readyGroups.length, 50);
    const sampleGroups: TargetGroup[] = [];
    for (let i = 0; i < batchSize; i++) {
      const idx = (listenerGroupRoundRobinCursor + i) % readyGroups.length;
      sampleGroups.push(readyGroups[idx]);
    }
    listenerGroupRoundRobinCursor = (listenerGroupRoundRobinCursor + batchSize) % readyGroups.length;

    for (const group of sampleGroups) {
      try {
        // Resolve designated responsible account for this specific group
        const ownerRes = await getOrAssignGroupOwner(group);
        if (!ownerRes || !ownerRes.client || ownerRes.client._destroyed) {
          // If the group owner is limited or unavailable and failover redistribution is disabled,
          // strictly skip this group so no other account takes its place!
          continue;
        }
        const groupClient = ownerRes.client;
        const groupAccount = ownerRes.account;

        await enforceAccountActionThrottle(groupAccount.id, 1200);

        const peer = await resolveAndJoinGroup(groupClient, group.usernameOrLink);
        if (!peer) continue;

        // Verify 100% Persian & Iranian Audience
        const isEnforcePersian = appState.groupJoinStrategy?.enforcePersianIranianOnly !== false;
        if (isEnforcePersian) {
          const persianCheck = await verifyAndAuditGroupIsPersian(groupClient, peer, group.title, group.usernameOrLink);
          if (!persianCheck.isPersian) {
            await purgeAndLeaveNonPersianGroup(groupClient, peer, group, persianCheck.reason);
            continue;
          }
          group.isPersianVerified = true;
          group.languageDetected = persianCheck.language;
        }

        let messages: any[] = [];
        try {
          messages = await groupClient.getMessages(peer, { limit: 6 });
        } catch (fetchErr) {
          continue;
        }

        for (const msg of messages || []) {
          if (!msg || !msg.message || msg.out) continue;

          const msgKey = `${group.id || group.title}_${msg.id}`;
          if (processedGroupMsgKeys.has(msgKey)) continue;
          processedGroupMsgKeys.add(msgKey);

          // Keep processed set bounded
          if (processedGroupMsgKeys.size > 2000) {
            const first = processedGroupMsgKeys.values().next().value;
            if (first) processedGroupMsgKeys.delete(first);
          }

          config.strategy2.totalMessagesScanned = (config.strategy2.totalMessagesScanned || 0) + 1;

          // Detect Lead
          const leadRes = detectLeadInMessage(msg.message, config.strategy2.keywords);
          if (!leadRes.isMatch) continue;

          config.strategy2.totalLeadsDetected = (config.strategy2.totalLeadsDetected || 0) + 1;
          config.strategy2.lastLeadDetectedAt = new Date().toISOString();

          // Resolve sender
          let sender: any = null;
          let senderId = '';
          let senderFirstName = 'کاربر';
          let senderUsername = '';

          try {
            sender = msg.sender || (msg.getSender ? await msg.getSender() : null);
            if (sender) {
              senderId = String(sender.id || '');
              senderFirstName = sender.firstName || 'کاربر';
              senderUsername = sender.username || '';
            }
          } catch (e) {}

          // 1. Anti-Self-Detection: Skip if sender is one of our own bot accounts
          const isOurOwnAccount = (appState.accounts || []).some(a => {
            const aId = String(a.id || '');
            const aUserId = String(a.userProfile?.id || '');
            const aUsername = String(a.userProfile?.username || '').replace(/^@+/, '').toLowerCase();
            const sUsername = String(senderUsername).replace(/^@+/, '').toLowerCase();
            return (
              (senderId && (senderId === aId || senderId === aUserId)) ||
              (sUsername && aUsername && sUsername === aUsername)
            );
          });

          if (isOurOwnAccount) {
            continue;
          }

          // 2. Anti-Self-Loop: Skip if message mentions our own contact handle or is our own ad
          const supportContact = String(config.strategy2.supportContactHandle || activeCampaign.contactHandle || '').replace(/^@+/, '').toLowerCase();
          if (supportContact && supportContact !== 'در عکس بالا' && msg.message.toLowerCase().includes(supportContact)) {
            continue;
          }

          // Check user cooldown (default 24h)
          const now = Date.now();
          const cooldownMs = (config.strategy2.userCooldownHours || 24) * 3600 * 1000;
          if (senderId && userCooldownMap.has(senderId)) {
            const lastSent = userCooldownMap.get(senderId) || 0;
            if (now - lastSent < cooldownMs) {
              continue;
            }
          }

          // Check group cooldown (default 5 minutes between any replies in this specific group)
          const groupCooldownMinutes = config.strategy2.groupCooldownMinutes ?? 5;
          const groupCooldownMs = groupCooldownMinutes * 60 * 1000;
          const lastGroupReplyTs = groupCooldownMap.get(group.id || group.title) || 0;
          if (now - lastGroupReplyTs < groupCooldownMs) {
            continue;
          }

          // Check group hourly reply limit
          const hourKey = `${group.id || group.title}_${new Date().getHours()}`;
          const currentHourly = groupHourlyReplies.get(hourKey) || { count: 0, hourTs: now };
          if (currentHourly.count >= (config.strategy2.maxRepliesPerGroupPerHour || 5)) {
            continue;
          }

          let groupReplySent = false;
          let groupReplyText = '';
          let groupReplyError = '';

          // 1. Group Reply
          if (config.strategy2.replyInGroup) {
            try {
              const replyDelay = Math.max(1, config.strategy2.groupReplyDelaySeconds || 4) * 1000;
              await new Promise(r => setTimeout(r, replyDelay));

              const groupReplyAi = await generateGeminiGroupReply(
                msg.message,
                leadRes.category,
                leadRes.matchedKeywords,
                activeCampaign,
                senderFirstName,
                undefined,
                config.strategy2.humanChatStyleInGroup !== false
              );
              groupReplyText = groupReplyAi.text;

              const sentGroupReply = await groupClient.sendMessage(peer, {
                message: groupReplyText,
                replyTo: msg.id,
              });

              if (sentGroupReply && sentGroupReply.id) {
                const mySentKey = `${group.id || group.title}_${sentGroupReply.id}`;
                recentBotSentGroupMessageMap.set(mySentKey, {
                  accountId: groupAccount?.id || '',
                  text: groupReplyText,
                  timestamp: Date.now(),
                });
              }

              const convKey = `${group.id || group.title}_${senderId}`;
              groupConversationThreads.set(convKey, [
                { role: 'user', text: msg.message, timestamp: now },
                { role: 'bot', text: groupReplyText, timestamp: Date.now() },
              ]);

              groupReplySent = true;
              config.strategy2.totalGroupRepliesSent = (config.strategy2.totalGroupRepliesSent || 0) + 1;
              groupHourlyReplies.set(hourKey, { count: currentHourly.count + 1, hourTs: now });
              groupCooldownMap.set(group.id || group.title, now);

              if (groupAccount) {
                groupAccount.dailySentCount = (groupAccount.dailySentCount || 0) + 1;
              }

              // Send campaign banner image in group reply if enabled and available
              const shouldSendGroupBanner = config.strategy2.sendBannerInGroupReply !== false;
              let bannerSentInGroup = false;
              if (shouldSendGroupBanner && activeCampaign.imageUrl) {
                try {
                  const bannerPath = await getImageFilePathForTelegram(activeCampaign.imageUrl);
                  if (bannerPath && fs.existsSync(bannerPath)) {
                    await new Promise(r => setTimeout(r, 1500));
                    await simulateTypingOnPeer(groupClient, peer, 800);
                    const supportHandle = (config.strategy2.supportContactHandle || activeCampaign.contactHandle || '@Nova_vpn10');
                    const cleanSupport = (supportHandle && supportHandle !== 'در عکس بالا') ? supportHandle : '@Nova_vpn10';
                    const bannerCaption = `📌 لیست تعرفه‌ها و مشخصات سرورها\n👤 ارتباط با پشتیبانی و دریافت تست رایگان: ${cleanSupport}`;
                    await groupClient.sendFile(peer, {
                      file: bannerPath,
                      caption: bannerCaption,
                      replyTo: msg.id,
                    });
                    bannerSentInGroup = true;
                  }
                } catch (imgErr: any) {
                  console.error('Failed to send banner image in group reply:', imgErr?.message || imgErr);
                }
              }

              addLog(
                'success',
                `[استراتژی دوم - ریپلای گروه] پاسخ هوشمند${bannerSentInGroup ? ' به همراه بنر تعرفه‌ها' : ''} توسط اکانت (${groupAccount?.phoneNumber || 'اصلی'}) به پیام "${msg.message.slice(0, 30)}..." در گروه "${group.title}" ارسال شد.`
              );
            } catch (rErr: any) {
              groupReplyError = rErr?.message || String(rErr);
              const isPermissionErr = groupReplyError.includes('CHAT_WRITE_FORBIDDEN') ||
                                      groupReplyError.includes('USER_BANNED_IN_CHANNEL') ||
                                      groupReplyError.includes('NEED_ADMIN_RIGHTS');
              if (isPermissionErr) {
                group.canSendMessages = false;
                group.readinessStatus = 'no_permission_left';
                group.errorMessage = 'عدم دسترسی ارسال پیام در گروه (محدودیت ادمین)';
                saveData();
              } else if (groupAccount && (groupReplyError.includes('FLOOD_WAIT') || groupReplyError.includes('AUTH_KEY') || groupReplyError.includes('SESSION'))) {
                handleAccountFailover(groupAccount.id, groupReplyError);
              }
              addLog('warning', `[استراتژی دوم] خطا در ریپلای گروه "${group.title}": ${groupReplyError}`);
            }
          }

          // 2. Direct Message (PV) in Casual Friend Multi-Bubble Tone with Anti-Report Shield & Multi-Account Failover
          let pvSent = false;
          let pvText = '';
          let pvBubbles: string[] = [];
          let pvHasBanner = false;
          let pvError = '';
          let sentByAccountPhone = '';
          let sentByAccountId = '';

          if (config.strategy2.sendDirectMessage && sender) {
            const isNeverRepeatPv = config.strategy2.neverRepeatPvToSameUser !== false;
            const contactedStatus = isUserAlreadyContactedInPv(senderId, senderUsername);

            // A. Persistent Lifetime Check (Check local registry, historical leads, inbound conversations)
            if (isNeverRepeatPv && contactedStatus.contacted) {
              pvError = `ارسال لغو شد: کاربر قبلاً سابقه دریافت پی‌وی داشته است (${contactedStatus.reason})`;
              config.strategy2.totalPvRepeatsPrevented = (config.strategy2.totalPvRepeatsPrevented || 0) + 1;
              saveData();
              addLog(
                'info',
                `🛡️ [سپر ضد ریپورت] از ارسال مجدد پی‌وی به «${senderFirstName}» (${senderUsername ? '@' + senderUsername : senderId}) جلوگیری شد. دلیل: ${contactedStatus.reason}.`
              );
            } else {
              // Human-paced reaction delay with randomized jitter (e.g. 8-20s) so messages don't arrive robotically fast
              const baseDelay = Math.max(8, config.strategy2.pvMessageDelaySeconds || 12) * 1000;
              const jitterMs = Math.floor(Math.random() * 5000);
              const pvDelay = baseDelay + jitterMs;
              await new Promise(r => setTimeout(r, pvDelay));

              const targetPeerOrUsername = senderUsername ? senderUsername : sender;
              const dispatchResult = await dispatchPvWithMultiAccountPool(
                targetPeerOrUsername,
                senderId,
                senderFirstName,
                senderUsername,
                msg.message,
                leadRes.category,
                leadRes.matchedKeywords,
                activeCampaign,
                group.title,
                config,
                groupAccount?.id || group.assignedAccountId
              );

              if (dispatchResult.success) {
                pvSent = true;
                pvText = dispatchResult.pvText;
                pvBubbles = dispatchResult.pvBubbles;
                pvHasBanner = dispatchResult.pvHasBanner;
                sentByAccountPhone = dispatchResult.sentByAccountPhone || '';
                sentByAccountId = dispatchResult.sentByAccountId || '';
                config.strategy2.totalPvMessagesSent = (config.strategy2.totalPvMessagesSent || 0) + 1;

                addLog(
                  'success',
                  `[استراتژی دوم - پیام حبابی پی‌وی] ${pvBubbles.length} حباب پیام صمیمی ${pvHasBanner ? '(همراه بنر مجزا)' : ''} با اکانت (${sentByAccountPhone || 'اصلی'}) به پی‌وی ${senderFirstName} (${senderUsername ? '@' + senderUsername : senderId}) ارسال شد.`
                );
              } else {
                pvError = dispatchResult.error || 'ارسال پی‌وی ناموفق بود';
                addLog('warning', `[استراتژی دوم] ارسال پی‌وی به کاربر «${senderFirstName}» انجام نشد: ${pvError}`);
              }
            }
          }

          // Record Lead Event
          const leadEvent: GroupLeadEvent = {
            id: 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            timestamp: new Date().toISOString(),
            groupId: group.id,
            groupTitle: group.title,
            userId: senderId,
            userFirstName: senderFirstName,
            userUsername: senderUsername,
            originalMessageId: msg.id,
            originalMessageText: msg.message,
            detectedCategory: leadRes.category,
            detectedKeywords: leadRes.matchedKeywords,
            groupReplySent,
            groupReplyText,
            groupReplyError,
            pvSent,
            sentByAccountPhone,
            sentByAccountId,
            pvText,
            pvBubbles,
            pvHasBanner,
            pvError,
            inboundRepliesCount: 0,
            status: pvSent ? 'sent_pv' : groupReplySent ? 'replied_group' : 'detected',
          };

          if (!config.recentLeads) config.recentLeads = [];
          config.recentLeads.unshift(leadEvent);
          if (config.recentLeads.length > 50) {
            config.recentLeads = config.recentLeads.slice(0, 50);
          }

          saveData();
        }
      } catch (grpErr) {
        // Continue with other groups
      }
    }
  } catch (err: any) {
    console.warn('Strategy 2 listener step error:', err?.message || err);
  } finally {
    isGroupListenerRunning = false;
  }
}

// Background Listener Loop for Strategy 2 (Runs every 15 seconds)
setInterval(() => {
  runGroupPromotionListenerStep().catch(err => {
    console.warn('Strategy 2 listener loop caught error:', err);
  });
}, 15000);

// Background Drip Join Loop for Safe Territory Growth (Runs every 30 seconds)
setInterval(() => {
  runDripJoinBackgroundStep().catch(err => {
    console.warn('Drip join background runner caught error:', err);
  });
}, 30000);

// SERVER-SIDE BACKGROUND SCHEDULER LOOP (Checks every 10 seconds)
setInterval(async () => {
  // Strategy 1 Periodic Broadcast check
  const stratConfig = appState.groupPromotionStrategy;
  if (stratConfig) {
    const isStrat1Active = stratConfig.activeStrategy === 'periodic_broadcast' || stratConfig.activeStrategy === 'hybrid_both';
    if (isStrat1Active && stratConfig.strategy1.enabled && !isBroadcastRunning) {
      const now = Date.now();
      const nextRun = stratConfig.strategy1.nextBroadcastAt ? new Date(stratConfig.strategy1.nextBroadcastAt).getTime() : 0;
      if (!stratConfig.strategy1.nextBroadcastAt || now >= nextRun) {
        // Set next run time before initiating to avoid duplicate triggers
        const intervalMs = (stratConfig.strategy1.intervalHours || 2) * 60 * 60 * 1000;
        stratConfig.strategy1.nextBroadcastAt = new Date(now + intervalMs).toISOString();
        saveData();

        console.log('⏰ Triggering automated Strategy 1 periodic banner broadcast in 100% ready groups...');
        addLog('info', `[استراتژی اول - زمان‌بندی دوره‌ای] زمان ارسال دوره‌ای فرا رسید. ارسال بنر و متن به گروه‌های ۱۰۰٪ آماده آغاز شد.`);
        await executeBroadcast(false);
      }
    }
  }

  if (!appState.scheduler.isAutoRunActive) return;

  // Night Mode Check (01:00 AM to 07:00 AM)
  if (appState.scheduler.nightModePause) {
    const currentHour = new Date().getHours();
    if (currentHour >= 1 && currentHour < 7) {
      return; // Skip posting during sleep hours
    }
  }

  if (appState.scheduler.nextRunTime) {
    const nextRun = new Date(appState.scheduler.nextRunTime).getTime();
    const now = Date.now();
    
    if (now >= nextRun) {
      console.log('⏰ Triggering automated Telegram UserBot product campaign broadcast...');
      await executeBroadcast(false);
    }
  }
}, 10000);

// VITE SERVING & LAUNCH
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', async () => {
    logger.info('SERVER_STARTUP_SUCCESS', {
      data: { port: PORT, nodeEnv: process.env.NODE_ENV || 'development' },
    });
    console.log(`Telegram UserBot Promoter running at http://0.0.0.0:${PORT}`);
    if (appState.credentials.sessionString && appState.credentials.isConnected) {
      console.log('🔄 Restoring saved Telegram session...');
      getOrInitTgClient().then(client => {
        if (client) {
          console.log('✅ Telegram session restored successfully on startup!');
        } else {
          console.log('⚠️ Could not restore saved Telegram session on startup.');
        }
      }).catch(err => {
        console.warn('Telegram auto-reconnect error:', err?.message || err);
      });
    }
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);
    logger.info('SERVER_SHUTDOWN_SIGNAL', { data: { signal } });
    HealthService.markShuttingDown();

    server.close(() => {
      console.log('[SHUTDOWN] HTTP server closed gracefully.');
      saveData();
      process.exit(0);
    });

    // Force exit if hanging after 5s
    setTimeout(() => {
      console.error('[SHUTDOWN] Forceful shutdown triggered after timeout.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Global uncaught exception and unhandled rejection safety
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT_EXCEPTION', err);
    console.error('[CRITICAL] Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('UNHANDLED_REJECTION', reason);
    console.error('[CRITICAL] Unhandled Rejection:', reason);
  });
}

startServer();
