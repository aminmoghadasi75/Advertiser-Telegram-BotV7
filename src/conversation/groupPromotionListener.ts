import {
  ProductCampaign,
  ConversationState,
  Intent,
  ConversationContext,
  AnonymousChatMessage,
  AnonymousProductPromotion,
  BotPersonaConfig,
} from '../types.js';
import {
  processConversationTurn,
  createInitialConversationContext,
  ConversationStepOutput,
} from './conversationEngine.js';
import { DEFAULT_NOVA_VPN_CONFIG, ProductConfig } from '../config/productConfig.js';
import { validateAndSanitizeResponse } from './responseValidator.js';
import { GoogleGenAI } from '@google/genai';
import {
  getAdaptiveCandidateModels,
  recordGeminiSuccess,
  recordGeminiFailure,
  GEMINI_MODEL_METADATA,
  runWithTimeout,
} from './geminiAdaptiveRouter.js';

let aiClient: GoogleGenAI | null = null;
function getGenAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  try {
    aiClient = new GoogleGenAI(
      apiKey
        ? {
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          }
        : {
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          }
    );
    return aiClient;
  } catch (e) {
    return null;
  }
}

export interface LeadDetectionResult {
  isMatch: boolean;
  category: 'vpn_filter' | 'net_speed' | 'ai_chatgpt' | 'social_media' | 'gaming_ping' | 'general_lead';
  matchedKeywords: string[];
  confidence: number;
}

// Built-in dictionary of lead indicators
const TAXONOMY = {
  vpn_filter: [
    'فیلترشکن',
    'فیلتر شکن',
    'فیلترشکن رایگان',
    'فیلترشکن خوب',
    'فیلترشکن سالم',
    'فیلترشکن قوی',
    'فیلترشکن پولی',
    'وی پی ان',
    'وی‌پی‌ان',
    'ویپیان',
    'vpn',
    'v2ray',
    'v2rayng',
    'کانفیگ',
    'کانفیگ رایگان',
    'کانفیگ سالم',
    'کانفیگ جدید',
    'کانفیگ اختصاصی',
    'کانفیگ v2ray',
    'کانفیگ vmess',
    'کانفیگ vless',
    'کانفیگ reality',
    'سرور',
    'سرور رایگان',
    'سرور سالم',
    'سرور جدید',
    'سرور خوب',
    'لینک کانفیگ',
    'لینک فیلترشکن',
    'لینک پروکسی',
    'کانفیگ میخوام',
    'کانفیگ داری',
    'کانفیگ دارید',
    'کانفیگ بده',
    'کانفیگ بدید',
    'پروکسی داری',
    'پروکسی دارید',
    'سرور داری',
    'سرور دارید',
    'لینک داری',
    'لینک دارید',
    'پروکسی',
    'proxy',
    'پروکسی رایگان',
    'پروکسی خوب',
    'پروکسی سالم',
    'دور زدن فیلتر',
    'فیلترینگ',
    'فیلتر شده',
    'فیلتره',
    'ضدفیلتر',
    'نت ملی',
    'خرید vpn',
    'خرید فیلترشکن',
    'اکانت vpn',
    'گوگل فلو',
    'google flow',
  ],
  net_speed: [
    'سرعت اینترنت',
    'کندی اینترنت',
    'کندی سرعت',
    'افت سرعت',
    'نت ضعیفه',
    'اینترنت ضعیفه',
    'نت ندارم',
    'اینترنت ندارم',
    'نت قطع شده',
    'اینترنت قطع شده',
    'نت قطعه',
    'اینترنت قطع',
    'قطعی اینترنت',
    'قطعی نت',
    'وصل نمیشه',
    'کانکت نمیشه',
    'تایم اوت',
    'تایماوت',
    'پینگ بالا',
    'لود نمیشه',
    'باز نمیشه',
    'همراه اول قطعه',
    'ایرانسل قطعه',
    'مخابرات قطعه',
    'رایتل قطعه',
    'نت داغونه',
    'اینترنت ملی',
  ],
  ai_chatgpt: [
    'هوش مصنوعی',
    'chatgpt',
    'چت جی پی تی',
    'چت‌جی‌پی‌تی',
    'chatgpt باز نمیشه',
    'chatgpt وصل نمیشه',
    'chatgpt کار نمیکنه',
    'chatgpt فیلتره',
    'openai',
    'claude',
    'کلود',
    'claude باز نمیشه',
    'claude کار نمیکنه',
    'gemini',
    'جمینای',
    'gemini باز نمیشه',
    'gemini کار نمیکنه',
    'google ai',
    'google ai studio',
    'ai studio',
    'ai.google',
    'copilot',
    'مایکروسافت کوپایلت',
    'کوپایلت',
    'perplexity',
    'پرپلکسیتی',
    'huggingface',
    'هاگینگ فیس',
    'midjourney',
    'میدجرنی',
    'sora',
    'سورا',
    'تحریم هوش مصنوعی',
    'اکانت هوش مصنوعی',
    'ثبت نام chatgpt',
    'ارور chatgpt',
  ],
  social_media: [
    'اینستا',
    'اینستاگرام',
    'اینستا باز نمیشه',
    'اینستاگرام باز نمیشه',
    'اینستا لود نمیشه',
    'اینستاگرام لود نمیشه',
    'استوری لود نمیشه',
    'استوری باز نمیشه',
    'دایرکت باز نمیشه',
    'یوتیوب',
    'youtube',
    'یوتیوب باز نمیشه',
    'یوتیوب قطع',
    'یوتیوب کند',
    'youtube loading',
    'ویدیو لود نمیشه',
    'توییتر',
    'twitter',
    'twitter باز نمیشه',
    'توییتر باز نمیشه',
    'شبکه ایکس',
    'x.com',
    'x',
    'x باز نمیشه',
    'توییت',
    'ردیت باز نمیشه',
    'reddit باز نمیشه',
    'tiktok',
    'تیک تاک',
    'tiktok باز نمیشه',
    'discord',
    'دیسکورد',
    'discord باز نمیشه',
    'واتساپ',
    'whatsapp',
    'واتساپ وصل نمیشه',
    'تلگرام وصل نمیشه',
  ],
  trading_forex: [
    'tradingview',
    'تریدینگ ویو',
    'تریدینگ‌ویو',
    'بروکر',
    'بروکر خارجی',
    'صرافی خارجی',
    'صرافی',
    'forex',
    'فارکس',
    'فورکس',
    'crypto',
    'کریپتو',
    'binance',
    'بایننس',
    'coinbase',
    'کوین بیس',
    'کوین‌بیس',
    'metatrader',
    'متاتریدر',
    'mt4',
    'mt5',
    'trading',
    'ترید',
    'سرور خارجی',
    'ip خارجی',
    'آی پی خارجی',
    'آی‌پی خارجی',
    'آی پی ثابت',
    'آی‌پی ثابت',
  ],
  gaming_ping: [
    'پینگ',
    'کاهش پینگ',
    'پینگ بالاست',
    'پینگم بالاست',
    'پینگ رفته بالا',
    'پینگ زیاد شده',
    'پینگ نوسان داره',
    'پینگ ثابت نیست',
    'پینگ افتضاحه',
    'پینگ تایم',
    'پکت لاس',
    'پکت لاست',
    'packet loss',
    'لگ',
    'لگ دارم',
    'لگ میزنم',
    'لگ بازی',
    'دی ان اس گیم',
    'dns گیم',
    'تحریم بازی',
    'بازی تحریم',
    'سرور تحریم',
    'اکانت تحریم',
    'سرور اروپا',
    'سرور آلمان',
    'سرور آمریکا',
    'سرور ترکیه',
    'سرور بازی',
    'سرور وصل نمیشه',
    'بازی وصل نمیشه',
    'آنلاین نمیشه',
    'steam',
    'استیم',
    'psn',
    'xbox live',
    'ایکس باکس',
    'discord',
    'دیسکورد',
    'بازی آنلاین',
    'رفع تحریم گیم',
    'valorant',
    'ولورانت',
    'call of duty',
    'کالاف',
    'warzone',
    'وارزون',
    'fortnite',
    'فورتنایت',
    'pubg',
    'پابجی',
    'apex',
    'اپکس',
    'league of legends',
    'league',
    'minecraft',
    'ماینکرفت',
  ],
};

// Game names that only count if a connection/ping problem indicator is also present
const GAME_NAMES = ['پابجی', 'کالاف', 'وارزون', 'فورتنایت', 'دوتا', 'پابجی موبایل', 'وارکرفت', 'ولورانت', 'apex'];
const GAMING_PROBLEM_INDICATORS = [
  'پینگ', 'ping', 'لگ', 'lag', 'دی ان اس', 'dns', 'تحریم', 'فیلتر', 'قطعی', 'قطع میشه',
  'تایم اوت', 'تایماوت', 'timeout', 'وصل نمیشه', 'باز نمیشه', 'ارور', 'تحریم شکن', 'تحریم‌شکن', 'الکترو', 'رادار'
];

// Commercial trading words that should NOT trigger VPN/ping lead detection
const ACCOUNT_TRADE_EXCLUSIONS = [
  'خرید اکانت', 'خریدار اکانت', 'فروش اکانت', 'فروشگاه اکانت', 'خریدارم', 'فروشی',
  'طاق میزنم', 'طاق', 'معاوضه', 'واسطه', 'یوسی', 'uc', 'سیزن', 'لول', 'اسکین', 'متیک', 'امفور',
  'قیمت اکانت', 'کانال فروشی', 'پیج فروشی', 'چیکن', 'الایت', 'محبوبیت', 'استارت میزنین'
];

// Competitor seller broadcast indicators that should NOT be treated as customer buyer leads
const COMPETITOR_SELLER_EXCLUSIONS = [
  'فروش فیلترشکن', 'فروش وی پی ان', 'فروش وی‌پی‌ان', 'فروش vpn', 'فروش کانفیگ', 'فروش سرور',
  'فروش اکانت v2ray', 'فروش اشتراک', 'جهت خرید به پیوی', 'جهت خرید به ایدی', 'جهت خرید پیام',
  'برای خرید پیام', 'برای خرید به پیوی', 'خرید آنلاین از سایت', 'درگاه مستقیم', 'تحویل فوری بعد از پرداخت',
  'پکیج ماهانه', 'اشتراک ماهانه', 'اشتراک سه‌ماهه', 'کد تخفیف', 'تخفیف ویژه', 'کانال تلگرامی ما',
  'عضو کانال ما بشید', 'عضو چنل ما بشید', 'کانفیگ رایگان در کانال', 'پروکسی ها در کانال',
  'کانال پروکسی', 'ربات خرید', 'آیدی ربات ما', 'فروش پنل', 'پنل v2ray', 'نمایندگی v2ray', 'نمایندگی فروش'
];

const GENUINE_CUSTOMER_NEED_INDICATORS = [
  'کسی داره', 'کسی سراغ داره', 'چی خوبه', 'چی وصله', 'چی پیشنهاد میدید', 'چی پیشنهاد میکنید',
  'وصل نمیشه', 'قطع شده', 'قطعه', 'کار نمیکنه', 'باز نمیشه', 'لود نمیشه', 'پینگم بالاست',
  'پینگم', 'لگ دارم', 'کمک کنید', 'راهنمایی کنید', 'فیلترشکن خوب', 'وی پی ان خوب', 'کانفیگ خوب',
  'میخوام بخرم', 'از کجا بخرم', 'چیکار کنم', 'چطوری وصل شم', 'برای آیفون چی وصله', 'برای همراه اول'
];

/**
 * Detects if a message contains intent/need for VPN, internet speed, AI access, etc.
 */
export function detectLeadInMessage(
  text: string,
  userCustomKeywords: string[] = []
): LeadDetectionResult {
  if (!text || typeof text !== 'string') {
    return {
      isMatch: false,
      category: 'general_lead',
      matchedKeywords: [],
      confidence: 0,
    };
  }

  const normalized = text.toLowerCase();

  // Exclude deleted messages or system noise
  if (normalized.includes('deleted message') || normalized.trim().length < 5) {
    return {
      isMatch: false,
      category: 'general_lead',
      matchedKeywords: [],
      confidence: 0,
    };
  }

  // Check if this message is merely account buying/selling or gaming trading
  const isTradeExcluded = ACCOUNT_TRADE_EXCLUSIONS.some(term => normalized.includes(term));
  const hasExplicitVpnTerms = TAXONOMY.vpn_filter.some(kw => normalized.includes(kw.toLowerCase()));
  if (isTradeExcluded && !hasExplicitVpnTerms) {
    // This is gaming account trading, NOT a VPN or networking lead
    return {
      isMatch: false,
      category: 'general_lead',
      matchedKeywords: [],
      confidence: 0,
    };
  }

  // Filter out competitor seller advertisements (ads for other VPN/proxy channels/bots)
  const isCompetitorSellerAd = COMPETITOR_SELLER_EXCLUSIONS.some(term => normalized.includes(term));
  const hasGenuineCustomerNeed = GENUINE_CUSTOMER_NEED_INDICATORS.some(ind => normalized.includes(ind));
  if (isCompetitorSellerAd && !hasGenuineCustomerNeed) {
    // This is another seller advertising their VPN/channel, not an inquiring buyer
    return {
      isMatch: false,
      category: 'general_lead',
      matchedKeywords: [],
      confidence: 0,
    };
  }

  const matchedKeywords = new Set<string>();

  // Check categories with priority: AI -> VPN -> Net Speed -> Social Media -> Gaming
  let matchedCategory: LeadDetectionResult['category'] = 'general_lead';
  let categoryScore = 0;

  // 1. AI check
  for (const kw of TAXONOMY.ai_chatgpt) {
    if (normalized.includes(kw.toLowerCase())) {
      matchedKeywords.add(kw);
      matchedCategory = 'ai_chatgpt';
      categoryScore += 3;
    }
  }

  // 2. VPN / Filter check
  for (const kw of TAXONOMY.vpn_filter) {
    if (normalized.includes(kw.toLowerCase())) {
      matchedKeywords.add(kw);
      if (categoryScore < 4) {
        matchedCategory = 'vpn_filter';
      }
      categoryScore += 4;
    }
  }

  // 3. Net Speed check
  for (const kw of TAXONOMY.net_speed) {
    if (normalized.includes(kw.toLowerCase())) {
      matchedKeywords.add(kw);
      if (categoryScore < 3) {
        matchedCategory = 'net_speed';
      }
      categoryScore += 2;
    }
  }

  // 4. Social Media check
  for (const kw of TAXONOMY.social_media) {
    if (normalized.includes(kw.toLowerCase())) {
      matchedKeywords.add(kw);
      if (categoryScore < 2) {
        matchedCategory = 'social_media';
      }
      categoryScore += 2;
    }
  }

  // 5. Gaming check (high-confidence direct indicators)
  for (const kw of TAXONOMY.gaming_ping) {
    if (normalized.includes(kw.toLowerCase())) {
      matchedKeywords.add(kw);
      if (categoryScore < 2) {
        matchedCategory = 'gaming_ping';
      }
      categoryScore += 2;
    }
  }

  // 5b. Game names - ONLY count if a connection/ping problem is also present
  const hasGameName = GAME_NAMES.some(g => normalized.includes(g));
  const hasGamingProblem = GAMING_PROBLEM_INDICATORS.some(p => normalized.includes(p));
  if (hasGameName && hasGamingProblem) {
    matchedKeywords.add('پابجی/گیم');
    if (categoryScore < 2) {
      matchedCategory = 'gaming_ping';
    }
    categoryScore += 2;
  }

  // 6. User Custom Keywords check
  for (const kw of userCustomKeywords) {
    const cleanKw = (kw || '').trim().toLowerCase();
    if (cleanKw && normalized.includes(cleanKw)) {
      matchedKeywords.add(cleanKw);
      categoryScore += 2;
    }
  }

  const matchedList = Array.from(matchedKeywords);
  const isMatch = matchedList.length > 0;

  return {
    isMatch,
    category: isMatch ? matchedCategory : 'general_lead',
    matchedKeywords: matchedList,
    confidence: isMatch ? Math.min(1.0, 0.4 + matchedList.length * 0.2) : 0,
  };
}

/**
 * Generates an intelligent, helpful reply in the group replying to the user's message.
 */
export function generateGroupReplyMessage(
  category: LeadDetectionResult['category'],
  matchedKeywords: string[],
  campaign: ProductCampaign,
  userFirstName?: string
): string {
  const contact = (campaign.contactHandle && campaign.contactHandle !== 'در عکس بالا') ? campaign.contactHandle : '@Nova_vpn10';
  const price = campaign.price ? `با تعرفه اقتصادی (${campaign.price})` : '';

  switch (category) {
    case 'ai_chatgpt':
      return `سلام دوست عزیز! برای دسترسی بدون تحریم و پرسرعت به ChatGPT و ابزارهای هوش مصنوعی، سرورهای اختصاصی V2ray با آی‌پی ثابت و بدون قطعی کاملاً تضمینی هستند (همراه با تست رایگان قبل از خرید).\n👤 ارتباط با پشتیبانی و دریافت تست رایگان: ${contact}`;

    case 'net_speed':
      return `سلام وقت بخیر، اگر درگیر کندی اینترنت یا اختلال اپراتورها (همراه اول و ایرانسل) هستید، کانفیگ‌های اختصاصی ما با پینگ پایین و سرعت پایدار تضمینی ${price} بهترین گزینه‌ست.\n👤 ارتباط با پشتیبانی و دریافت تست رایگان: ${contact}`;

    case 'social_media':
      return `سلام دوست عزیز، برای باز کردن فوری ویدیوهای یوتیوب و استوری‌های اینستا بدون معطلی و قطعی، سرورهای ضد فیلتر پرسرعت و پایدار ما رو امتحان کنید (با امکان تست رایگان قبل از خرید).\n👤 ارتباط مستقیم با پشتیبانی: ${contact}`;

    case 'gaming_ping':
      return `سلام وقت بخیر، برای کاهش پینگ، رفع لگ در بازی‌ها و ثبات اتصال، سرورهای اختصاصی با پینگ زیر ۸۰ میلی‌ثانیه فعالند.\n👤 ارتباط با پشتیبانی و دریافت تست رایگان: ${contact}`;

    case 'vpn_filter':
    default:
      return `سلام دوست عزیز، ${campaign.title || 'سرویس‌های اختصاصی V2ray و فیلترشکن پرسرعت'} با کیفیت تضمینی، آی‌پی ثابت و تست رایگان روی تمام اینترنت‌ها فعاله.\n👤 ارتباط با پشتیبانی و دریافت تست رایگان: ${contact}`;
  }
}

export interface MultiBubblePvMessage {
  greetingBubble: string; // حباب ۱: سلام و احوال‌پرسی صمیمانه
  contextBubble: string; // حباب ۲: اشاره به دیدن پیام در گروه
  productBubble: string; // حباب ۳: معرفی محصول و تجربه شخصی با اشاره به تست رایگان
  supportBubble: string; // حباب ۴: معرفی پشتیبانی و لینک تماس
  bannerCaption?: string; // کپشن کوتاه و طبیعی بنر تصویر
  allBubbles: string[]; // آرایه کامل حباب‌ها جهت ارسال متوالی
}

/**
 * Generates an authentic multi-bubble recommendation in private DM (PV)
 * Split into 4 distinct human chat bursts:
 * 1. Greeting
 * 2. Group context
 * 3. Product recommendation & free trial
 * 4. Support contact
 */
export function generateMultiBubbleFriendPv(
  category: LeadDetectionResult['category'],
  matchedKeywords: string[],
  campaign: ProductCampaign,
  userFirstName?: string,
  groupTitle?: string
): MultiBubblePvMessage {
  const nameGreeting = userFirstName ? `${userFirstName} جان` : 'دوست عزیز';
  const contact = campaign.contactHandle || '@Admin';
  const groupRef = groupTitle ? `گروه «${groupTitle}»` : 'گروه';
  const productName = campaign.title || 'کانفیگ اختصاصی';

  let topicPhrase = 'فیلترشکن خوب و پرسرعت';
  if (category === 'ai_chatgpt') {
    topicPhrase = 'دسترسی بدون تحریم به چت‌جی‌پی‌تی و هوش مصنوعی';
  } else if (category === 'net_speed') {
    topicPhrase = 'رفع افت سرعت و قطعی‌های اینترنت';
  } else if (category === 'social_media') {
    topicPhrase = 'باز کردن سریع اینستاگرام و ویدیوهای یوتیوب';
  } else if (category === 'gaming_ping') {
    topicPhrase = 'کاهش پینگ و قطعی‌های بازی آنلاین';
  }

  // 1. Greeting
  const greetingBubble = `سلام وقتت بخیر ${nameGreeting} ✋`;

  // 2. Context
  const contextBubble = `توی ${groupRef} دیدم پیام دادی دنبال ${topicPhrase} بودی`;

  // 3. Product
  const productBubble = `خواستم بهت بگم من خودم الان چند وقته برای دور زدن قطعی‌ها از ${productName} استفاده می‌کنم، پینگش عالیه و روی همراه اول و ایرانسل واقعاً ثابته. تست رایگان هم دارن که اول چک کنی بعد اگه خواستی تهیه کنی.`;

  // 4. Support
  const supportBubble = `به پشتیبانیشون پیام بدی سریع بهت لینک و اکانت تست میده: ${contact}`;

  // 5. Banner Caption
  const bannerCaption = `اینم عکس مشخصات سرورها و تعرفه‌هاشون 👇`;

  return {
    greetingBubble,
    contextBubble,
    productBubble,
    supportBubble,
    bannerCaption,
    allBubbles: [greetingBubble, contextBubble, productBubble, supportBubble],
  };
}

/**
 * Generates an authentic, friendly recommendation in private DM (PV)
 * written in the tone of an ordinary person / peer recommending a good service.
 */
export function generateCasualFriendPvMessage(
  category: LeadDetectionResult['category'],
  matchedKeywords: string[],
  campaign: ProductCampaign,
  userFirstName?: string
): string {
  const multi = generateMultiBubbleFriendPv(category, matchedKeywords, campaign, userFirstName);
  return multi.allBubbles.join('\n\n') + (multi.bannerCaption ? `\n\n📌 ${multi.bannerCaption}` : '');
}

export interface AccountPersonaConfig {
  tone?: 'friendly' | 'expert_advisor' | 'concise_direct' | 'energetic_buyer' | 'supportive_polite' | 'custom' | string;
  accountName?: string;
  customPrompt?: string;
}

function buildPersonaInstructions(persona?: AccountPersonaConfig): string {
  if (!persona) return '';
  let toneDesc = 'صمیمی و دوستانه عامیانه';
  if (persona.tone === 'expert_advisor') toneDesc = 'متخصص و راهنمای فنی با دقت و حوصله (اشاره به جزئیات پینگ و پروتکل‌ها)';
  else if (persona.tone === 'concise_direct') toneDesc = 'کوتاه، سریع و بسیار خلاصه بدون اضافه گویی';
  else if (persona.tone === 'energetic_buyer') toneDesc = 'یک خریدار و مصرف‌کننده راضی و پرانرژی و هیجان‌زده';
  else if (persona.tone === 'supportive_polite') toneDesc = 'مشاور بسیار مودب، رسمی‌تر و احترام‌آمیز';
  else if (persona.tone === 'friendly') toneDesc = 'صمیمی، خودمانی و راحت مانند دوست صمیمی';
  else if (typeof persona.tone === 'string') toneDesc = persona.tone;

  let out = `\n۷. پرسونای اختصاصی شما: ${toneDesc}. هویت شما: ${persona.accountName || 'کاربر هم‌گروهی'}.`;
  if (persona.customPrompt) {
    out += `\n۸. راهنمای تکمیلی پرسونای شما: ${persona.customPrompt}`;
  }
  return out;
}

/**
 * Clean Telegram chat text: strips bot prefixes, quotes, and robotic trailing punctuation
 */
export function cleanTelegramChatText(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();
  // Remove markdown quotes and wrap characters
  text = text.replace(/^["'«`]+/, '').replace(/["'»`]+$/, '').trim();
  // Remove bot speaker prefixes like "پاسخ:", "ملودی:", "من:", "کاربر:", "بات:"
  text = text.replace(/^(پاسخ|جواب|ملودی|سارا|من|پشتیبان|ربات|bot|me|response):\s*/i, '');
  // Remove trailing periods, colons, or redundant exclamation to appear authentic
  text = text.replace(/[.:،]+$/, '').trim();
  return text;
}

/**
 * Intelligent instant fallback for group conversation when AI is unavailable or slow
 */
export function getSmartFallbackGroupConversationReply(userText: string, campaign: ProductCampaign): string {
  const t = (userText || '').toLowerCase();
  const rawHandle = (campaign?.contactHandle && campaign.contactHandle !== 'در عکس بالا') ? campaign.contactHandle : '@Nova_vpn10';
  const displayHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;

  if (t.includes('چند') || t.includes('قیمت') || t.includes('هزینه') || t.includes('تعرفه') || t.includes('تومن')) {
    return `تک کاربره ۵۹ دو کاربره ۸۹ تومنه، به ${displayHandle} پیام بدی تست رایگان میده اول چک کن`;
  }
  if (t.includes('تست') || t.includes('امتحان') || t.includes('رایگان') || t.includes('دمو')) {
    return `آره تست رایگان داره، به آیدی ${displayHandle} پیام بده سریع میده بهت`;
  }
  if (t.includes('چیه') || t.includes('چی هست') || t.includes('یعنی چی') || t.includes('نوا چیه')) {
    return `فیلترشکن اختصاصی ضد قطعیه، به آیدی ${displayHandle} پیام بدی تست رایگان میده تست کنی`;
  }
  if (t.includes('همراه') || t.includes('ایرانسل') || t.includes('رایتل') || t.includes('مخابرات') || t.includes('وای فای') || t.includes('مودم')) {
    return `رو همراه اول و ایرانسل عالیه بدون قطعی میده، از ${displayHandle} تست رایگان بگیر`;
  }
  if (t.includes('قطعی') || t.includes('قطع') || t.includes('وصل') || t.includes('کار میکنه') || t.includes('واقعا')) {
    return `من خودم چند وقته دارم اصلا قطعی نداشته، خواستی به ${displayHandle} بگو تست رایگان بده خودت ببین`;
  }
  if (t.includes('پینگ') || t.includes('بازی') || t.includes('گیم') || t.includes('لگ')) {
    return `پینگش پایینه برای گیم جوابه، به ${displayHandle} بگو تست رایگان میده امتحان کن`;
  }
  if (t.includes('آیفون') || t.includes('اندروید') || t.includes('ویندوز') || t.includes('ios')) {
    return `رو همه گوشیا نرم‌افزار داره، به ${displayHandle} بگو با کانفیگ تست بهت میده`;
  }
  if (t.includes('از کجا') || t.includes('چطور') || t.includes('آیدی') || t.includes('لینک') || t.includes('خرید')) {
    return `به آیدی ${displayHandle} پیام بده سریع تحویلت میده`;
  }
  if (t.includes('مرسی') || t.includes('دمت') || t.includes('ممنون') || t.includes('تشکر') || t.includes('عشقی')) {
    return 'فدات عزیزم کاری داشتی بگو';
  }
  if (t.includes('سلام') || t.includes('درود') || t.includes('خوبی')) {
    return 'سلام قربانت خوبی چه خبر';
  }
  if (t.includes('نه') || t.includes('نمیخوام') || t.includes('تبلیغ') || t.includes('گرون')) {
    return 'باشه عزیزم هر جور راحتی';
  }
  return `من از نوا وی‌پی‌ان گرفتم راضیم، خواستی به ${displayHandle} بگو تست رایگان میده`;
}

// ----------------------------------------------------------------------------
// GROUP CONVERSATIONAL ENGINE (BASED ON ANONYMOUS CHAT PIPELINE)
// ----------------------------------------------------------------------------

export interface GroupLeadConversationInput {
  userMessageText: string;
  userMessageId?: number;
  groupId: string;
  groupTitle: string;
  senderId: string;
  senderFirstName: string;
  senderUsername?: string;
  campaign: ProductCampaign;
  isInitialLeadMatch?: boolean;
  leadCategory?: LeadDetectionResult['category'];
  matchedKeywords?: string[];
  repliedBotMessageText?: string;
  anonymousInstructions?: any;
  strategy?: 'social_rapport' | 'direct_pitch' | 'consultative' | 'urgency_trial';
  persona?: BotPersonaConfig;
}

export interface GroupLeadConversationResult {
  replyText: string;
  replyToMessageId: number; // ALWAYS EQUALS userMessageId!
  usedAi: boolean;
  intent: Intent;
  leadScore: number;
  conversationState: ConversationState;
  turnCount: number;
  objectionCategory?: string;
  promptDirective?: string;
}

export interface GroupUserConversationEntry {
  context: ConversationContext;
  history: AnonymousChatMessage[];
  lastActiveAt: number;
  lastBotMessageId?: number;
  lastBotReplyText?: string;
  senderFirstName: string;
  senderUsername?: string;
  groupId: string;
  groupTitle: string;
}

export const groupUserConversationStore = new Map<string, GroupUserConversationEntry>();

export function getGroupConversationKey(groupId: string, senderId: string): string {
  return `${groupId}_${senderId}`;
}

export function getGroupConversationEntry(groupId: string, senderId: string): GroupUserConversationEntry | undefined {
  return groupUserConversationStore.get(getGroupConversationKey(groupId, senderId));
}

export function clearGroupConversationEntry(groupId: string, senderId: string): void {
  groupUserConversationStore.delete(getGroupConversationKey(groupId, senderId));
}

/**
 * Executes a full conversation turn in Telegram groups using the exact same deterministic pipeline
 * (intent engine, lead scoring, objection engine, state machine, response validator, and adaptive Gemini)
 * as the anonymous chat automator.
 * 
 * CRITICAL DIRECTIVE: Every single message returned has replyToMessageId === userMessageId so that
 * all bot messages in crowded groups are sent strictly as REPLIES.
 */
export async function processGroupLeadConversationTurn(
  input: GroupLeadConversationInput
): Promise<GroupLeadConversationResult> {
  const {
    userMessageText,
    userMessageId,
    groupId,
    groupTitle,
    senderId,
    senderFirstName,
    senderUsername,
    campaign,
    isInitialLeadMatch,
    leadCategory,
    matchedKeywords,
    repliedBotMessageText,
    anonymousInstructions,
    strategy,
    persona,
  } = input;

  const key = getGroupConversationKey(groupId, senderId);
  let entry = groupUserConversationStore.get(key);

  const rawContactHandle = String(campaign.contactHandle || '@Nova_vpn10');
  const cleanContactHandle = (rawContactHandle && rawContactHandle !== 'در عکس بالا') ? rawContactHandle.replace(/^@+/, '') : 'Nova_vpn10';
  const displayHandle = `@${cleanContactHandle}`;

  const productConfig: ProductConfig = {
    ...DEFAULT_NOVA_VPN_CONFIG,
    productName: campaign.title || 'نوا وی پی ان',
    productDescription: campaign.description || DEFAULT_NOVA_VPN_CONFIG.productDescription,
    tagline: campaign.title || DEFAULT_NOVA_VPN_CONFIG.tagline,
    support: {
      handle: cleanContactHandle,
      link: `https://t.me/${cleanContactHandle}`,
      operatingHours: DEFAULT_NOVA_VPN_CONFIG.support?.operatingHours || '۲۴ ساعته',
    },
  };

  if (!entry) {
    const freshContext = createInitialConversationContext(
      senderFirstName || 'کاربر',
      `گروه تلگرام: ${groupTitle}`,
      new Date().toISOString()
    );
    if (isInitialLeadMatch) {
      freshContext.state = ConversationState.NEED_DETECTED;
      freshContext.leadScore = 60;
      freshContext.intent = Intent.VPN_REQUEST;
      freshContext.detectedIntentsHistory = [Intent.VPN_REQUEST];
    }
    // Always permit support ID and promotion in group conversations
    freshContext.supportIdAvailable = true;
    freshContext.coinRewarded = true;
    freshContext.mediaUnlocked = true;
    freshContext.elapsedSeconds = 300;
    entry = {
      context: freshContext,
      history: [],
      lastActiveAt: Date.now(),
      senderFirstName,
      senderUsername,
      groupId,
      groupTitle,
    };
    groupUserConversationStore.set(key, entry);
  } else {
    // Keep support ID and promotion enabled across turns in groups
    entry.context.supportIdAvailable = true;
    entry.context.coinRewarded = true;
    entry.context.mediaUnlocked = true;
    entry.context.elapsedSeconds = Math.max(entry.context.elapsedSeconds || 0, 300);
  }

  // Record user turn in history
  const userMsgIdStr = `user_${userMessageId}_${Date.now()}`;
  const userMsgRecord: AnonymousChatMessage = {
    id: userMsgIdStr,
    sender: 'stranger',
    text: userMessageText,
    timestamp: new Date().toISOString(),
  };
  entry.history.push(userMsgRecord);

  // Keep history bounded to last 15 messages
  if (entry.history.length > 15) {
    entry.history = entry.history.slice(-15);
  }

  // Effective strategy: direct_pitch, consultative, or social_rapport
  const effectiveStrategy = strategy || (anonymousInstructions?.strategy as any) || 'direct_pitch';

  const defaultPersona: BotPersonaConfig = persona || {
    name: (anonymousInstructions as any)?.personaName || 'سارا',
    role: 'کاربر فعال گروه و مشتری راضی وی‌پی‌ان اختصاصی',
    tone: 'casual',
    age: '24',
    bio: 'راهنمایی صمیمی، سریع و ارائه اکانت تست رایگان',
  };

  // Run through proven Conversation Engine & State Machine
  const stepOutput = processConversationTurn(
    userMessageText,
    entry.context,
    undefined,
    8,
    entry.history,
    productConfig,
    effectiveStrategy,
    defaultPersona
  );

  entry.context = stepOutput.updatedContext;
  entry.lastActiveAt = Date.now();

  const currentIntent = stepOutput.intentResult.intent;
  const objectionCategory = stepOutput.objectionAnalysis?.category;

  // Prepare fallback text deterministically from conversationEngine results
  let smartFallback = getSmartFallbackGroupConversationReply(userMessageText, campaign);
  if (isInitialLeadMatch) {
    smartFallback = `من خودم چند وقته از نوا وی‌پی‌ان استفاده می‌کنم بدون قطعیه، به آیدی ${displayHandle} پیام بدی تست رایگان میده رو خطت چک کن`;
  } else if (currentIntent === Intent.PRICE_REQUEST || currentIntent === Intent.PLAN_REQUEST) {
    smartFallback = `تک کاربره ۵۹ دو کاربره ۸۹ تومنه، خواستی به ${displayHandle} پیام بده تست رایگان میده اول چک کن`;
  } else if (currentIntent === Intent.TRIAL_REQUEST) {
    smartFallback = `به آیدی ${displayHandle} پیام بده بگو تست می‌خوام سریع برات می‌فرسته`;
  } else if (currentIntent === Intent.OBJECTION) {
    if (String(objectionCategory).toUpperCase().includes('PRICE')) {
      smartFallback = `هزینه‌ش کمه ولی سروراش اختصاصیه، اول از ${displayHandle} تست رایگان بگیر چک کن بعد بردار`;
    } else if (String(objectionCategory).toUpperCase().includes('TRUST')) {
      smartFallback = `حق داری، برای همین اول به ${displayHandle} پیام بده تست رایگان میده که خیالت راحت شه`;
    } else {
      smartFallback = `اول از پشتیبانی ${displayHandle} تست رایگان بگیر خودت رو گوشی چک کن بعد تصمیم بگیر`;
    }
  } else if (currentIntent === Intent.PURCHASE_INTENT) {
    smartFallback = `به آیدی ${displayHandle} پیام بده سریع اکانت رو تحویلت میده`;
  } else if (currentIntent === Intent.GOODBYE) {
    smartFallback = `فدات کاری داشتی بگو`;
  } else if (currentIntent === Intent.GREETING) {
    smartFallback = `سلام قربانت خوبی چه خبر`;
  }

  let finalReplyText = smartFallback;
  let usedAi = false;

  const ai = getGenAiClient();
  if (ai && process.env.GEMINI_API_KEY) {
    const historyLines = entry.history
      .slice(-6)
      .map((h) => `${h.sender === 'stranger' ? 'کاربر' : 'شما'}: ${h.text}`)
      .join('\n');

    const personaInstructions = anonymousInstructions?.systemPrompt
      ? `\n[دستورالعمل‌های تکمیلی لحن و استراتژی]:\n${String(anonymousInstructions.systemPrompt).slice(0, 400)}`
      : '';

    let groupPrompt = '';
    if (isInitialLeadMatch) {
      groupPrompt = `شما به عنوان یک کاربر عادی و مشتری کاملاً راضی فیلترشکن اختصاصی ${campaign.title || 'نوا وی پی ان'} در یک گروه تلگرامی هستید.
کاربری در این گروه به مشکل فیلترینگ، قطعی اینترنت، پینگ بازی، یوتیوب یا اینستاگرام اشاره کرده و نیاز به وی‌پی‌ان دارد:
پیام کاربر نیازمند در گروه: "${userMessageText}"

هدف استراتژیک شما:
هدف صرفاً گپ زدن خالی نیست؛ هدف معرفی نامحسوس و دلسوزانه وی‌پی‌ان و هدایت کاربر به تست رایگان از طریق آیدی پشتیبانی (${displayHandle}) است.
سبک توضیحات شما باید فوق‌العاده صمیمی، دلسوزانه و تجربی باشد (مثل دوستی که تجربه خودش را می‌گوید).
کاربر باید متوجه شود نوا وی‌پی‌ان چیست (سرویس اختصاصی v2ray بدون قطعی) و دقیقاً چگونه می‌تواند از آیدی پشتیبانی (${displayHandle}) تست رایگان بگیرد تا کیفیت را تست کند.

نمونه‌های عالی از نحوه صحبت نامحسوس و طبیعی:
- «من خودم چند وقته از نوا وی‌پی‌ان استفاده می‌کنم پینگش برای گیم و وبگردی عالیه بدون قطعی، به آیدی ${displayHandle} پیام بدی تست رایگان میده اول رو خطت چک کن»
- «من نوا وی‌پی‌ان دارم رو همراه اول و ایرانسل واقعاً ثابته، از پشتیبانیش ${displayHandle} تست رایگان بگیر ببین چطوره برات»
- «کانفیگ اختصاصی نوا وی‌پی‌ان رو همراه اول و ایرانسل بدون قطعی جواب میده، به آیدی ${displayHandle} بگو تست می‌خوام سریع می‌فرسته»

قوانین نگارش:
۱. بسیار طبیعی، روان و محاوره‌ای تهرانی (حدود ۱۰ الی ۲۰ کلمه).
۲. حتماً نام سرویس (${campaign.title || 'نوا وی پی ان'}) و آیدی پشتیبانی جهت دریافت تست رایگان (${displayHandle}) به شکلی کاملاً طبیعی در متن جا بگیرد.
۳. بدون علائم نگارشی سنگین مانند نقطه در انتها (.) یا گیومه.
۴. هرگز نگو ربات هستی. شما یک عضو معمولی گروه هستید.
۵. خروجی فقط متن پاسخ بدون هیچ توضیح اضافه باشد.${personaInstructions}`;
    } else {
      groupPrompt = `شما به عنوان یک کاربر عادی و مشتری راضی فیلترشکن در یک گروه تلگرامی هستید.
یکی از اعضای گروه به پیام قبلی شما ریپلای زده است و با شما گفتگو می‌کند.
${repliedBotMessageText ? `پیام قبلی شما به این کاربر: "${repliedBotMessageText}"` : ''}
پیام جدید و ریپلای کاربر در گروه: "${userMessageText}"
${historyLines ? `تاریخچه گفتگوی قبلی شما با این کاربر در همین گروه:\n${historyLines}\n` : ''}

قوانین حیاتی و استراتژیک (رعایت ۱۰۰٪ الزامی):
۱. پاسخگویی هوشمند و منطقی به ریپلای: همیشه و در هر شرایطی بر اساس زمینه صحبت و گفتگوهای قبلی به این ریپلای پاسخی منطقی، مرتبط و هوشمند بدهید؛ حتی اگر کاربر در پیامش هیچ کلیدواژه‌ای از فیلترشکن یا اینترنت نیاورده باشد (مثلاً فقط بگوید: «چنده؟»، «واقعا خوبه؟»، «چی هست اصن؟»، «از کجا بگیرم؟»، «رو آیفون جواب میده؟»، «من ایرانسلم»).
۲. متقاعدسازی منطقی و دلسوزانه (Persuasion): کاربر را با استدلال قانع کنید و به تست رایگان یا خرید از طریق ${displayHandle} هدایت نمایید:
   - اگر پرسید چنده یا قیمت: قیمت منصفانه (تک‌کاربره ۵۹ تومن، دوکاربره ۸۹ تومن) را بگو و حتماً بگو اول به ${displayHandle} پیام بده تست رایگان میده که خیالت راحت شه بعد اگه خواستی بردار.
   - اگر پرسید چی هست یا نوا چیه: بگو کانفیگ اختصاصی v2ray بدون قطعی با آی‌پی ثابته و بگو به پشتیبانی ${displayHandle} بگو تست رایگان بده خودت ببین.
   - اگر از کیفیت یا قطعی پرسید: با اطمینان بگو خودم چند وقته دارم قطعی نداره، برای اینکه خیالت راحت شه به ${displayHandle} پیام بده اول تست رایگان بگیر روی خطت.
   - اگر درباره اپراتورها پرسید (همراه اول/ایرانسل/وای‌فای): بگو رو تمام اپراتورها سرور جدا داره و ثابته.
   - اگر گفت فیلترشکن پولی نمی‌خوام یا دنبال رایگانه: دلسوزانه بگو فیلترشکن رایگان همش قطع میشه، امنیت نداره و حجم نت رو تموم میکنه، این ۵۹ تومنه پول یه چیپسه و اولش هم تست رایگان میده.
   - اگر آیدی خواست: مستقیماً آیدی ${displayHandle} رو بده.
   - اگر نرم‌افزار خواست: بگو با v2rayNG یا v2box کار میکنه و پشتیبانی ${displayHandle} خودش نرم‌افزار و کانفیگ تست رو میده.
   - اگر سلام، احوالپرسی یا تشکر کرد: بسیار صمیمی و دوستانه پاسخ بده.
   - اگر نخواست یا نپذیرفت: اصرار نکن («باشه عزیزم هر جور راحتی»).
۳. لحن و ساختار: خودمانی، عامیانه تهرانی، صمیمی، منطقی و قانع‌کننده (حدود ۸ تا ۲۲ کلمه).
۴. بدون علائم نگارشی سنگین مانند نقطه در انتها (.) یا گیومه.
۵. خروجی فقط و فقط متن پیام باشد.${personaInstructions}`;
    }

    const candidateModels = getAdaptiveCandidateModels();
    for (const modelName of candidateModels) {
      try {
        const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 4500;
        const apiPromise = ai.models.generateContent({
          model: modelName,
          contents: groupPrompt,
          config: { temperature: 0.75 },
        });
        const res: any = await runWithTimeout(apiPromise, timeoutMs, 'GEMINI_TIMEOUT');
        const text = (res?.text || '').trim();
        if (text && text.length >= 2) {
          recordGeminiSuccess(modelName);
          const cleanedText = cleanTelegramChatText(text);
          const valRes = validateAndSanitizeResponse(cleanedText, stepOutput.updatedContext, undefined, productConfig);
          finalReplyText = valRes.sanitizedText || cleanedText;
          usedAi = true;
          break;
        }
      } catch (e: any) {
        recordGeminiFailure(modelName, e);
      }
    }
  }

  // Record bot turn in history
  const botMsgRecord: AnonymousChatMessage = {
    id: `bot_${Date.now()}`,
    sender: 'me_melody',
    text: finalReplyText,
    timestamp: new Date().toISOString(),
  };
  entry.history.push(botMsgRecord);
  entry.lastBotReplyText = finalReplyText;
  entry.lastBotMessageId = userMessageId; // Reference to the user's message replied to

  return {
    replyText: finalReplyText,
    replyToMessageId: userMessageId, // ALWAYS REPLIES TO THE USER!
    usedAi,
    intent: currentIntent,
    leadScore: stepOutput.updatedContext.leadScore,
    conversationState: stepOutput.updatedContext.state,
    turnCount: stepOutput.updatedContext.turnCount,
    objectionCategory,
    promptDirective: stepOutput.promptDirective,
  };
}

export interface GroupMultiLeadBatchInput {
  leads: Array<{
    senderId: string;
    senderFirstName: string;
    senderUsername: string; // must have telegram username
    userMessageText: string;
    userMessageId: number;
    category?: string;
  }>;
  groupId: string;
  groupTitle: string;
  campaign: ProductCampaign;
  supportHandle?: string;
  anonymousInstructions?: any;
}

export interface GroupMultiLeadBatchResult {
  replyText: string;
  mentionedUsernames: string[];
  replyToMessageId: number;
  leadCount: number;
  usedAi: boolean;
}

/**
 * Consolidates multiple identified leads in the same group into a single high-impact,
 * professional and human reply that addresses their collective and specific needs
 * while tagging their @usernames.
 */
export async function processGroupMultiLeadBatchTurn(
  input: GroupMultiLeadBatchInput
): Promise<GroupMultiLeadBatchResult> {
  const { leads, groupId, groupTitle, campaign, supportHandle, anonymousInstructions } = input;
  const rawSupport = (supportHandle && supportHandle !== 'در عکس بالا')
    ? supportHandle
    : (campaign?.contactHandle && campaign.contactHandle !== 'در عکس بالا')
      ? campaign.contactHandle
      : '@Nova_vpn10';
  const displayHandle = rawSupport.startsWith('@') ? rawSupport : `@${rawSupport}`;

  // Filter out any users without a valid username and cap at 10 users as requested
  const validLeads = (leads || [])
    .filter(l => Boolean(l.senderUsername && String(l.senderUsername).trim()))
    .slice(0, 10);

  if (validLeads.length === 0) {
    return {
      replyText: '',
      mentionedUsernames: [],
      replyToMessageId: leads?.[0]?.userMessageId || 0,
      leadCount: 0,
      usedAi: false,
    };
  }

  const mentionsList = validLeads.map(l => `@${String(l.senderUsername).replace(/^@+/, '')}`);
  const mentionsHeader = mentionsList.join(' ');
  const latestMessageId = validLeads[validLeads.length - 1].userMessageId;

  // High-converting deterministic fallback text
  let finalReply = `سلام بچه‌ها ${mentionsHeader} در مورد قطعی اینترنت و وی‌پی‌ان که سوال داشتید، با این وضعیت اختلالات اپراتورها فقط کانفیگ‌های اختصاصی v2ray بدون قطعی جواب میده. من خودم مدتیه دارم از نوا استفاده می‌کنم رو همراه اول و ایرانسل واقعاً ثابته، قبل خرید هم تست رایگان میدن رو خط خودتون چک کنید؛ به آیدی پشتیبانی پیام بدید براتون بفرستن: ${displayHandle}`;
  let usedAi = false;

  const ai = getGenAiClient();
  if (ai && process.env.GEMINI_API_KEY) {
    const leadsSummary = validLeads
      .map((l, idx) => `${idx + 1}. @${String(l.senderUsername).replace(/^@+/, '')} (${l.senderFirstName || 'کاربر'}): "${l.userMessageText}"`)
      .join('\n');

    const multiPrompt = `شما به عنوان یک کاربر عادی، مطلع و مشتری کاملاً راضی و باتجربه سرویس اختصاصی ${campaign.title || 'نوا وی پی ان'} در گروه تلگرامی «${groupTitle}» هستید.
چند نفر از اعضای گروه همگی در مورد مشکلات فیلترینگ، قطعی اینترنت، پینگ بازی، یوتیوب، اینستاگرام یا نیاز به وی‌پی‌ان خوب پیام داده‌اند:

لیست کاربران شناسایی‌شده و پیام‌هایشان:
${leadsSummary}

هدف استراتژیک و حیاتی شما:
به جای پاسخ‌های جداگانه، یک پاسخ جمع‌وجور، فوق‌العاده صمیمی، دلسوزانه و طبیعی (به زبان محاوره‌ای تهرانی) بنویسید که در یک پیام واحد، نیاز و سوالات همه این دوستان را پوشش دهد و آن‌ها را راهنمایی کند.
در ابتدای پیام حتماً شناسه همه این کاربران منشن شود: ${mentionsHeader}

دستورالعمل‌های نگارش:
۱. در ابتدای پیام این منشن‌ها دقیقاً درج شوند: ${mentionsHeader}
۲. خیلی خودمانی، دلسوزانه و تجربی توضیح دهید که با وضعیت فعلی اختلالات اپراتورها (همراه اول/ایرانسل/مخابرات) سرورهای اختصاصی با پینگ پایین کار می‌کنند.
۳. تجربه واقعی و رضایت خودتان از ${campaign.title || 'نوا وی پی ان'} را مطرح کنید.
۴. پیشنهاد دهید که قبل از هر چیز به آیدی پشتیبانی (${displayHandle}) پیام بدهند تا اکانت تست رایگان بگیرند و خودشان روی خطشان چک کنند.
۵. لحن: کاملاً عامیانه، طبیعی، بدون لحن رباتی یا تبلیغات شرکتی، بدون نقطه یا گیومه اضافی.
۶. طول متن: مناسب برای فضای چت تلگرام (حدود ۲۵ الی ۴۰ کلمه).
۷. خروجی فقط و فقط متن نهایی پیام بدون هیچ پیشوند یا توضیح اضافه باشد.`;

    const candidateModels = getAdaptiveCandidateModels();
    for (const modelName of candidateModels) {
      try {
        const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 5500;
        const apiPromise = ai.models.generateContent({
          model: modelName,
          contents: multiPrompt,
          config: { temperature: 0.72 },
        });
        const res: any = await runWithTimeout(apiPromise, timeoutMs, 'GEMINI_TIMEOUT');
        const text = (res?.text || '').trim();
        if (text && text.length >= 15) {
          recordGeminiSuccess(modelName);
          let cleaned = cleanTelegramChatText(text);
          // Guarantee mentions presence
          if (!cleaned.includes(mentionsList[0])) {
            cleaned = `${mentionsHeader} ${cleaned}`;
          }
          if (!cleaned.includes(displayHandle)) {
            cleaned = `${cleaned} (آیدی تست: ${displayHandle})`;
          }
          finalReply = cleaned;
          usedAi = true;
          break;
        }
      } catch (gemErr) {
        // Try next model if any
      }
    }
  }

  return {
    replyText: finalReply,
    mentionedUsernames: mentionsList,
    replyToMessageId: latestMessageId,
    leadCount: validLeads.length,
    usedAi,
  };
}

/**
 * Intelligent AI-Powered Human Group Conversation Reply
 * Generates natural, human responses to group member replies,
 * actively chatting about VPN, answering questions, and encouraging test/purchase via support handle.
 */
export async function generateGeminiGroupConversationReply(
  userMessageText: string,
  repliedBotMessage: string,
  conversationHistory: Array<{ role: 'user' | 'bot'; text: string }>,
  campaign: ProductCampaign,
  userFirstName?: string,
  anonymousInstructions?: any,
  persona?: AccountPersonaConfig
): Promise<{ text: string; usedAi: boolean }> {
  const fallbackText = getSmartFallbackGroupConversationReply(userMessageText, campaign);
  const ai = getGenAiClient();
  if (!ai || !process.env.GEMINI_API_KEY) {
    return {
      text: fallbackText,
      usedAi: false,
    };
  }

  const rawHandle = (campaign?.contactHandle && campaign.contactHandle !== 'در عکس بالا') ? campaign.contactHandle : '@Nova_vpn10';
  const displayHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;

  const historyLines = (conversationHistory || [])
    .slice(-5)
    .map(h => `${h.role === 'user' ? 'کاربر' : 'شما'}: ${h.text}`)
    .join('\n');

  // Custom prompt from anonymous automator if available, or rich human prompt
  const userPersonaPrompt = anonymousInstructions?.systemPrompt
    ? `\n[دستورالعمل‌های تکمیلی هویت و لحن از اتوماسیون چت]:\n${anonymousInstructions.systemPrompt.slice(0, 500)}`
    : '';

  const prompt = `شما یک کاربر عادی و مشتری راضی فیلترشکن در یک گروه تلگرامی هستید.
یکی از کاربران در گروه به پیام قبلی شما ریپلای زده و با شما گفتگو می‌کند.
پیام قبلی شما در گروه: "${repliedBotMessage || 'پیشنهاد وی‌پی‌ان'}"
پیام جدید کاربر در گروه: "${userMessageText}"
${historyLines ? `تاریخچه گفتگوی اخیر با این کاربر در این گروه:\n${historyLines}\n` : ''}
اطلاعات سرویس برای پاسخگویی به سوالات و متقاعدسازی:
- نام سرویس: ${campaign.title || 'نوا وی پی ان'}
- تعرفه: تک‌کاربره ۵۹ تومن، دوکاربره ۸۹ تومن (یا ${campaign.price})
- اکانت تست رایگان و پشتیبانی: آیدی تلگرام ${displayHandle}
- کیفیت: بدون قطعی، پینگ عالی برای بازی و وبگردی، تضمین کارکرد روی همراه اول، ایرانسل و وای‌فای

قوانین حیاتی (رعایت ۱۰۰٪ الزامی):
۱. پاسخگویی هوشمند و منطقی: حتی اگر پیام کاربر هیچ کلیدواژه‌ای نداشته باشد (مثلاً «چنده؟»، «واقعا؟»، «چی هست؟»، «از کجا؟»)، بر اساس گفتگوهای قبلی به او پاسخ دهید و او را قانع کنید.
۲. معرفی راهکار و تست رایگان: کاربر را به سمت دریافت تست رایگان از آیدی ${displayHandle} هدایت کنید تا خودش کیفیت را تست کند.
۳. هدایت هوشمند و متقاعدسازی:
   - اگر قیمت پرسید: تعرفه را بگو و اضافه کن که به ${displayHandle} پیام بده اول تست رایگان بگیر چک کن.
   - اگر پرسید چی هست یا چیه: توضیح بده کانفیگ اختصاصی v2ray بدون قطعیه و بگو به پشتیبانی ${displayHandle} پیام بده تست فعال کنه.
   - اگر از کیفیت، سرعت، پینگ یا قطعی پرسید: با اطمینان بگو خودم دارم ثابته و اول از ${displayHandle} تست رایگان بگیر خودت رو خطت ببین.
   - اگر درباره اپراتورها پرسید: بگو رو همراه اول و ایرانسل سرور مجزا داره.
   - اگر تست خواست یا گفت چطور بگیرم: بگو به آیدی ${displayHandle} پیام بده سریع تست رایگان میده.
   - اگر سلام یا احوال‌پرسی کرد: صمیمی و با محبت جواب بده.
   - اگر تشکر کرد: بگو «فدات عزیزم کاری داشتی بگو».
   - اگر گفت نمی‌خوام یا رد کرد: اصرار نکن («باشه عزیزم هر جور راحتی»).
۴. طول پیام: ۱ تا ۲ جمله محاوره‌ای، روان و طبیعی (حدود ۸ الی ۲۲ کلمه).
۵. بدون علائم نگارشی سنگین مانند نقطه در انتها (.) یا گیومه.
۶. خط قرمز انسانی: هرگز نگویید هوش مصنوعی یا ربات هستید. شما یک هم‌گروهی صمیمی هستید.
۷. خروجی فقط و فقط متن پیام بدون هیچ پیشوند یا علامتی باشد.${userPersonaPrompt}`;

  const candidateModels = getAdaptiveCandidateModels();
  for (const modelName of candidateModels) {
    try {
      const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 4500;
      const apiPromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { temperature: 0.75 },
      });
      const res: any = await runWithTimeout(apiPromise, timeoutMs, 'GEMINI_TIMEOUT');
      const text = (res?.text || '').trim();
      if (text && text.length >= 2) {
        recordGeminiSuccess(modelName);
        return { text: cleanTelegramChatText(text), usedAi: true };
      }
    } catch (e: any) {
      recordGeminiFailure(modelName, e);
    }
  }

  return {
    text: fallbackText,
    usedAi: false,
  };
}

/**
 * Intelligent AI-Powered Group Reply using Gemini (gemini-3.8-flash)
 * Adapts directly to the user's actual question in the group.
 */
export async function generateGeminiGroupReply(
  userMessageText: string,
  category: LeadDetectionResult['category'],
  matchedKeywords: string[],
  campaign: ProductCampaign,
  userFirstName?: string,
  persona?: AccountPersonaConfig,
  humanShortStyle: boolean = true
): Promise<{ text: string; usedAi: boolean }> {
  const ai = getGenAiClient();
  if (!ai || !process.env.GEMINI_API_KEY) {
    return {
      text: generateGroupReplyMessage(category, matchedKeywords, campaign, userFirstName),
      usedAi: false,
    };
  }

  const contact = 'nova_vpn10';
  const personaNote = buildPersonaInstructions(persona);

  let prompt = '';
  if (humanShortStyle) {
    prompt = `شما یک کاربر عادی و مشتری راضی فیلترشکن در یک گروه تلگرامی هستید.
کاربری در گروه گفته: "${userMessageText}"

شما می‌خواهید در یک جمله کوتاه محاوره‌ای به او پاسخ دهید و سرویس را پیشنهاد دهید:
- آیدی تست رایگان و پشتیبانی: ${contact} (بدون @ با زیرخط)

دستورات:
۱. بسیار کوتاه و انسانی (حداکثر ۱ جمله، حدود ۴ الی ۱۰ کلمه).
۲. خودمانی، صمیمی و دلسوز مانند پیشنهاد یک دوست (مثلاً: من خودم از nova_vpn10 گرفتم واقعا بدون قطعیه بهش بگو تست میده بهت).
۳. بدون علائم نگارشی سنگین مانند نقطه در انتها، گیومه یا علامت تعجب.
۴. خروجی فقط متن پاسخ باشد.${personaNote}`;
  } else {
    prompt = `شما یک کاربر عادی و بسیار بااخلاق و کاربلد در یک گروه تلگرامی هستید.
یک کاربر در گروه پیامی فرستاده و به مشکل فیلترینگ، اینترنت، هوش مصنوعی یا پینگ بازی اشاره کرده است:
پیام کاربر: "${userMessageText}"
نام کاربر: ${userFirstName || 'دوست عزیز'}
موضوع شناسایی‌شده: ${category}

شما می‌خواهید در همان گروه به این کاربر به صورت کاملاً دوستانه، طبیعی و مؤدبانه یک ریپلای بزنید و سرویس زیر را به او پیشنهاد دهید:
- نام سرویس: ${campaign.title}
- قیمت: ${campaign.price}
- راه تماس/تست: ${contact}

دستورات:
۱. ریپلای باید خیلی طبیعی، خودمانی و شبیه پیشنهاد یک هم‌گروهی دلسوز باشد (نه تبلیغ رباتی یا شرکتی).
۲. کوتاه باشد (۲ تا ۳ خط).
۳. حتماً به امکان تست رایگان قبل از خرید اشاره کند.
۴. آیدی تلگرام پشتیبانی (${contact}) را صریحاً در متن ذکر کند (مثلاً: برای دریافت اکانت تست به آیدی ${contact} پیام بده).
۵. به هیچ وجه از عبارات مبهم مثل "در عکس بالا" استفاده نکنید، چون باید آیدی مشخص ${contact} در پیام قید شود.
۶. خروجی فقط متن پاسخ بدون گیومه یا مقدمه باشد.${personaNote}`;
  }

  const candidateModels = getAdaptiveCandidateModels();
  for (const modelName of candidateModels) {
    try {
      const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 5000;
      const apiPromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { temperature: 0.8 },
      });
      const res: any = await runWithTimeout(apiPromise, timeoutMs, 'GEMINI_TIMEOUT');
      const text = (res?.text || '').trim();
      if (text && text.length >= 4) {
        recordGeminiSuccess(modelName);
        return { text: cleanTelegramChatText(text), usedAi: true };
      }
    } catch (e: any) {
      recordGeminiFailure(modelName, e);
    }
  }

  return {
    text: generateGroupReplyMessage(category, matchedKeywords, campaign, userFirstName),
    usedAi: false,
  };
}

/**
 * Intelligent AI-Powered Casual Friend PV Message using Gemini with Multi-Model Fallback
 */
export async function generateGeminiCasualFriendPvMessage(
  userMessageText: string,
  category: LeadDetectionResult['category'],
  matchedKeywords: string[],
  campaign: ProductCampaign,
  userFirstName?: string
): Promise<{ text: string; usedAi: boolean }> {
  const ai = getGenAiClient();
  if (!ai || !process.env.GEMINI_API_KEY) {
    return {
      text: generateCasualFriendPvMessage(category, matchedKeywords, campaign, userFirstName),
      usedAi: false,
    };
  }

  const contact = campaign.contactHandle || '@Admin';
  const nameGreeting = userFirstName ? `${userFirstName} جان` : 'سلام دوست عزیز';

  const prompt = `شما یک فرد عادی در تلگرام هستید که پیامی را در گروه از ${userFirstName || 'یک کاربر'} با متن زیر دیده‌اید:
"${userMessageText}"

می‌خواهید در پی‌وی (چت خصوصی) به او پیام دهید و به عنوان یک تجربه شخصی و دوستانه، سرویس ${campaign.title} را معرفی کنید:
- قیمت: ${campaign.price}
- راه ارتباط و تست رایگان: ${contact}

دستورات:
۱. لحن کاملاً دوستانه، دلسوزانه و معمولی مثل فردی که خودش مشتری راضی سرویس است.
۲. اشاره کند که در گروه دیدم درباره این موضوع گفتی، گفتم اینجا برات بفرستم شاید به دردت بخوره.
۳. اشاره به تست رایگان و بدون قطعی بودن.
۴. ذکر کند که عکس مشخصات و تعرفه‌ها را هم همراه پیام فرستاده است.
۵. خروجی فقط متن نهایی بدون توضیح یا علامت گیومه باشد.`;

  const candidateModels = getAdaptiveCandidateModels();
  for (const modelName of candidateModels) {
    try {
      const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 5000;
      const apiPromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { temperature: 0.85 },
      });
      const res: any = await runWithTimeout(apiPromise, timeoutMs, 'GEMINI_TIMEOUT');
      const text = (res?.text || '').trim();
      if (text && text.length > 20) {
        recordGeminiSuccess(modelName);
        return { text: text.replace(/^["'«]/, '').replace(/["'»]$/, '').trim(), usedAi: true };
      }
    } catch (e: any) {
      recordGeminiFailure(modelName, e);
    }
  }

  return {
    text: generateCasualFriendPvMessage(category, matchedKeywords, campaign, userFirstName),
    usedAi: false,
  };
}

/**
 * Intelligent AI-Powered Multi-Bubble Friend PV Message using Gemini
 * Produces 4 human-like chat bursts:
 * 1. Greeting
 * 2. Group context
 * 3. Product recommendation & free trial
 * 4. Support handle
 */
export async function generateGeminiMultiBubbleFriendPv(
  userMessageText: string,
  category: LeadDetectionResult['category'],
  matchedKeywords: string[],
  campaign: ProductCampaign,
  userFirstName?: string,
  groupTitle?: string,
  persona?: AccountPersonaConfig
): Promise<{ bubbles: MultiBubblePvMessage; usedAi: boolean }> {
  const fallback = generateMultiBubbleFriendPv(category, matchedKeywords, campaign, userFirstName, groupTitle);
  const ai = getGenAiClient();
  if (!ai || !process.env.GEMINI_API_KEY) {
    return { bubbles: fallback, usedAi: false };
  }

  const contact = campaign.contactHandle || '@Admin';
  const nameGreeting = userFirstName ? `${userFirstName} جان` : 'دوست عزیز';
  const groupRef = groupTitle ? `گروه «${groupTitle}»` : 'گروه';
  const personaNote = buildPersonaInstructions(persona);

  const prompt = `شما یک فرد عادی در تلگرام هستید که پیامی را از ${nameGreeting} در ${groupRef} با متن زیر دیده‌اید:
"${userMessageText}"

می‌خواهید در پی‌وی (چت شخصی تلگرام) دقیقاً مثل کاربران واقعی، پیام خود را به صورت ۴ حباب پیام کوتاه و مجزا (نه یک متن طولانی رباتی) به صورت JSON ارسال کنید:
- حباب ۱ (سلام): سلام و احوال‌پرسی خیلی کوتاه و خودمانی
- حباب ۲ (اشاره به گروه): اشاره کوتاه به اینکه توی ${groupRef} دیدم پیام دادی دنبال فیلترشکن/اینترنت/هوش مصنوعی بودی
- حباب ۳ (معرفی محصول): معرفی صمیمی سرویس بر اساس تجربه شخصی خودت (نام: ${campaign.title}، پینگ عالی و بدون قطعی، تست رایگان قبل خرید)
- حباب ۴ (پشتیبانی): معرفی آیدی پشتیبانی جهت دریافت تست رایگان: ${contact}

خروجی شما باید صرفاً یک آبجکت JSON معتبر به این صورت باشد:
{
  "greetingBubble": "سلام وقتت بخیر جان ✋",
  "contextBubble": "توی گروه دیدم گفتی فیلترشکن خوب می‌خوای",
  "productBubble": "من خودم از ${campaign.title} استفاده می‌کنم عالیه و قطعی نداره، تست رایگان هم دارن",
  "supportBubble": "به پشتیبانیشون پیام بدی سریع بهت تست میده: ${contact}",
  "bannerCaption": "اینم عکس تعرفه‌هاشون 👇"
}

نکته مهم: هر حباب باید حداکثر ۵ تا ۱۰ کلمه باشد. از جملات بلند یا ادبیات اداری خودداری کنید.${personaNote}`;

  const candidateModels = getAdaptiveCandidateModels();
  for (const modelName of candidateModels) {
    try {
      const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 5000;
      const apiPromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { 
          temperature: 0.8,
          responseMimeType: 'application/json'
        },
      });
      const res: any = await runWithTimeout(apiPromise, timeoutMs, 'GEMINI_TIMEOUT');
      const rawText = (res?.text || '').trim();
      if (rawText) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.greetingBubble && parsed.productBubble) {
            recordGeminiSuccess(modelName);
            const greeting = String(parsed.greetingBubble || fallback.greetingBubble).trim();
            const context = String(parsed.contextBubble || fallback.contextBubble).trim();
            const product = String(parsed.productBubble || fallback.productBubble).trim();
            const support = String(parsed.supportBubble || fallback.supportBubble).trim();
            const bannerCaption = String(parsed.bannerCaption || fallback.bannerCaption).trim();
            return {
              bubbles: {
                greetingBubble: greeting,
                contextBubble: context,
                productBubble: product,
                supportBubble: support,
                bannerCaption,
                allBubbles: [greeting, context, product, support].filter(Boolean),
              },
              usedAi: true,
            };
          }
        }
      }
    } catch (e: any) {
      recordGeminiFailure(modelName, e);
    }
  }

  return { bubbles: fallback, usedAi: false };
}

/**
 * Generates an intelligent, human-like reply when a user responds to our direct message in private chat (PV).
 * Guides them politely to support or answers their question.
 */
export function generateInboundPvReply(
  userMessageText: string,
  conversationHistory: Array<{ sender: 'user' | 'bot'; text: string }>,
  campaign: ProductCampaign,
  userFirstName?: string
): { bubbles: string[]; isHandoff: boolean } {
  const contact = campaign.contactHandle || '@Admin';
  const price = campaign.price || 'قیمت‌های خیلی مناسب و اقتصادی';
  const lower = (userMessageText || '').toLowerCase().trim();

  // 1. Negative / refusal
  if (/^(نه|مرسی|ممنون|نمیخوام|لازم ندارم|نمی‌خوام|علاقه‌ای ندارم|خیر|بای|مزاحم نشو)/.test(lower)) {
    return {
      bubbles: ['باشه عزیزم موفق باشی 🌹 اگر بعداً نیاز داشتی در خدمتم.'],
      isHandoff: false,
    };
  }

  // 2. Price query
  if (/قیمت|چنده|هزینه|تعرفه|پلن|اشتراک|چقدره/.test(lower)) {
    return {
      bubbles: [
        `تعرفه‌هاشون از ${price} شروع میشه و پلن‌های متنوع دارن`,
        `به پشتیبانیشون پیام بدی لیست دقیق پلن‌ها به همراه تست رایگان رو برات می‌فرسته: ${contact}`,
      ],
      isHandoff: true,
    };
  }

  // 3. Test / trial inquiry
  if (/تست|کانفیگ تست|اکانت تست|امتحان|رایگان|لینک/.test(lower)) {
    return {
      bubbles: [
        'آره تست رایگان دارن که قبل خرید کیفیت رو خودت چک کنی',
        `به آیدی پشتیبانی پیام بده بگو کانفیگ تست می‌خوای سریع برات ارسال می‌کنن: ${contact}`,
      ],
      isHandoff: true,
    };
  }

  // 4. Operator inquiry (Hamrah Aval, Irancell, Wi-Fi, etc.)
  if (/همراه اول|ایرانسل|رایتل|وای فای|مخابرات|مودم|نت ثابت|شاتل|زی تل|اپراتور/.test(lower)) {
    return {
      bubbles: [
        'روی تمام اپراتورها مخصوصاً همراه اول، ایرانسل و وای‌فای خانگی فعاله و سرورهای مختلف داره',
        `برای اینکه روی خط خودت تست کنی به پشتیبانیشون پیام بده تا کانفیگ مناسب رو برات بفرسته: ${contact}`,
      ],
      isHandoff: true,
    };
  }

  // 5. Contact handle inquiry
  if (/آیدی|ایدی|ادمین|پشتیبانی|کجا پیام بدم|لینک بد|شماره/.test(lower)) {
    return {
      bubbles: [
        `آیدی پشتیبانی تلگرامشون اینه: ${contact}`,
        'پیام بدی زیر ۵ دقیقه برات اکانت تست فعال می‌کنن',
      ],
      isHandoff: true,
    };
  }

  // Default helpful response
  return {
    bubbles: [
      'من خودم چند وقته دارم استفاده می‌کنم و سرعتش واقعاً خوبه',
      `برای دریافت کانفیگ تست رایگان و اطلاعات بیشتر با پشتیبانیشون در ارتباط باش: ${contact}`,
    ],
    isHandoff: true,
  };
}

/**
 * AI-Powered Inbound PV Reply using Gemini with Multi-Model Fallback
 */
export async function generateGeminiInboundPvReply(
  userMessageText: string,
  conversationHistory: Array<{ sender: 'user' | 'bot'; text: string }>,
  campaign: ProductCampaign,
  userFirstName?: string,
  persona?: AccountPersonaConfig
): Promise<{ bubbles: string[]; usedAi: boolean; isHandoff: boolean }> {
  const fallback = generateInboundPvReply(userMessageText, conversationHistory, campaign, userFirstName);
  const ai = getGenAiClient();
  if (!ai || !process.env.GEMINI_API_KEY) {
    return { ...fallback, usedAi: false };
  }

  const contact = campaign.contactHandle || '@Admin';
  const isDirectSupportAccount = Boolean(
    persona?.accountName && (
      persona.accountName.toLowerCase().includes('پشتیبانی') ||
      persona.accountName.toLowerCase().includes('support') ||
      persona.accountName.toLowerCase().includes('nova') ||
      (contact && persona.accountName.toLowerCase().includes(contact.toLowerCase().replace(/[@_]/g, '')))
    )
  );

  const historySnippet = conversationHistory
    .slice(-4)
    .map((m) => `${m.sender === 'user' ? 'کاربر' : 'شما'}: ${m.text}`)
    .join('\n');
  const personaNote = buildPersonaInstructions(persona);

  const roleInstruction = isDirectSupportAccount
    ? `شما پشتیبان رسمی سرویس ${campaign.title} هستید و کاربر مستقیماً به پی‌وی پشتیبانی پیام داده است.
مهم: چون خودتان پشتیبانی هستید، هرگز نگویید «به پشتیبانی پیام بده»! بلکه محترمانه و صمیمی بگویید در خدمتم، راهنمایی کنید و برای ارسال تست یا خرید سوالش را پاسخ دهید.`
    : `شما یک فرد عادی در تلگرام هستید که قبلاً به عنوان یک پیشنهاد دوستانه سرویس ${campaign.title} را به این کاربر معرفی کرده بودید.
اکنون او در پی‌وی به شما پیام داده است:
اگر سوالی پرسید، او را به آیدی پشتیبانی (${contact}) هدایت کنید تا تست رایگان بگیرد.`;

  const prompt = `${roleInstruction}
پیام کاربر: "${userMessageText}"

تاریخچه گفتگو:
${historySnippet}

اطلاعات سرویس:
- نام: ${campaign.title}
- تعرفه: ${campaign.price}
- پشتیبانی و اکانت تست: ${contact}
- ویژگی‌ها: آی‌پی ثابت، سرورهای V2ray اختصاصی، مناسب تمام اپراتورها (همراه اول و ایرانسل)، تست رایگان قبل خرید

وظیفه شما:
۱. در ۱ یا نهایتاً ۲ حباب کوتاه (هر حباب ۵ تا ۱۰ کلمه روان محاوره‌ای) پاسخ دهید.
۲. اگر کاربر سوالی پرسید، پاسخ مختصر و مفید بدهید. ${isDirectSupportAccount ? 'چون خودتان پشتیبانی هستید به او تست ارائه دهید.' : `حتماً او را به پشتیبانی (${contact}) هدایت کنید.`}
۳. اگر گفت تمایلی ندارد، محترمانه بگویید: «باشه عزیزم موفق باشی 🌹» و اصرار نکنید.
۴. خروجی را در قالب JSON با کلید "bubbles" (آرایه‌ای از ۱ یا ۲ رشته کوتاه) برگردانید:
{
  "bubbles": ["...", "..."],
  "isHandoff": ${isDirectSupportAccount ? 'false' : 'true'}
}${personaNote}`;

  const candidateModels = getAdaptiveCandidateModels();
  for (const modelName of candidateModels) {
    try {
      const timeoutMs = GEMINI_MODEL_METADATA[modelName]?.timeoutMs || 5000;
      const apiPromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { 
          temperature: 0.75,
          responseMimeType: 'application/json'
        },
      });
      const res: any = await runWithTimeout(apiPromise, timeoutMs, 'GEMINI_TIMEOUT');
      const rawText = (res?.text || '').trim();
      if (rawText) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.bubbles) && parsed.bubbles.length > 0) {
            recordGeminiSuccess(modelName);
            const cleanBubbles = parsed.bubbles
              .map((b: any) => String(b || '').trim())
              .filter(Boolean);
            if (cleanBubbles.length > 0) {
              return {
                bubbles: cleanBubbles,
                usedAi: true,
                isHandoff: parsed.isHandoff !== false,
              };
            }
          }
        }
      }
    } catch (e: any) {
      recordGeminiFailure(modelName, e);
    }
  }

  return { ...fallback, usedAi: false };
}


