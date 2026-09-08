import React, { useState } from 'react';
import {
  GroupPromotionStrategyConfig,
  GroupPromotionStrategyType,
  GroupLeadEvent,
  ProductCampaign,
  TargetGroup,
  TelegramAccount,
} from '../types';
import {
  Sparkles,
  Zap,
  Clock,
  Radio,
  Send,
  MessageSquare,
  UserCheck,
  ShieldCheck,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Sliders,
  Tag,
  ArrowRight,
  ExternalLink,
  Bot,
  HelpCircle,
  Flame,
  Check,
  Plus,
  Trash2,
  HardDriveDownload,
  Download,
  Copy,
  FileJson,
  TrendingUp,
  Lightbulb,
  ShieldAlert,
  Power,
  Users,
  Search,
  Loader2,
} from 'lucide-react';

export const DEFAULT_146_KEYWORDS = [
  'vpn',
  'وی پی ان',
  'وی‌پی‌ان',
  'ویپیان',
  'فیلترشکن',
  'فیلتر شکن',
  'فیلترشکن رایگان',
  'فیلترشکن خوب',
  'فیلترشکن سالم',
  'فیلترشکن قوی',
  'فیلترشکن پولی',
  'پروکسی',
  'proxy',
  'پروکسی رایگان',
  'پروکسی خوب',
  'پروکسی سالم',
  'v2ray',
  'v2rayng',
  'کانفیگ',
  'کانفیگ رایگان',
  'کانفیگ سالم',
  'کانفیگ جدید',
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
  'نت ندارم',
  'اینترنت ندارم',
  'نت قطع شده',
  'اینترنت قطع شده',
  'نت قطعه',
  'اینترنت قطعه',
  'وصل نمیشه',
  'وصل نمیشم',
  'وصل نمیشن',
  'هیچی باز نمیکنه',
  'هیچی لود نمیکنه',
  'کدوم فیلترشکن',
  'کدوم vpn',
  'فیلترشکن چی خوبه',
  'چی وصل میشه',
  'چی کار میکنه',
  'چی باز میکنه',
  'پینگ',
  'ping',
  'لگ',
  'lag',
  'کندی نت',
  'کندی اینترنت',
  'چت جی پی تی',
  'chatgpt',
  'gpt',
  'gpt4',
  'gpt-4',
  'جمینای',
  'gemini',
  'کلود',
  'claude',
  'openai',
  'اپن ای آی',
  'هوش مصنوعی',
  'ai',
  'copilot',
  'کوپایلت',
  'perplexity',
  'midjourney',
  'میدجورنی',
  'sora',
  'huggingface',
  'اینستا باز نمیشه',
  'اینستاگرام باز نمیشه',
  'اینستا لود نمیشه',
  'اینستاگرام لود نمیشه',
  'یوتیوب باز نمیشه',
  'یوتیوب لود نمیشه',
  'یوتیوب کار نمیکنه',
  'youtube باز نمیشه',
  'youtube لود نمیشه',
  'توییتر باز نمیشه',
  'توییتر لود نمیشه',
  'تیک تاک باز نمیشه',
  'tiktok باز نمیشه',
  'تیک‌تاک باز نمیشه',
  'discord',
  'دیسکورد',
  'reddit',
  'ردیت',
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
  'سرور اروپا',
  'سرور آلمان',
  'سرور آمریکا',
  'سرور ترکیه',
  'سرور بازی',
  'سرور وصل نمیشه',
  'بازی وصل نمیشه',
  'آنلاین نمیشه',
  'بازی تحریم',
  'سرور تحریم',
  'اکانت تحریم',
  'steam',
  'استیم',
  'psn',
  'xbox live',
  'ایکس باکس',
  'گوگل فلو',
  'google flow',
];

interface GroupPromotionStrategiesCardProps {
  strategyConfig?: GroupPromotionStrategyConfig;
  campaigns: ProductCampaign[];
  groups: TargetGroup[];
  accounts: TelegramAccount[];
  isConnected: boolean;
  onSwitchStrategy: (strategy: GroupPromotionStrategyType) => Promise<void>;
  onUpdateStrategyConfig: (updates: Partial<GroupPromotionStrategyConfig>) => Promise<void>;
  onRunStrategy1Now: () => Promise<void>;
  onToggleListener: (active: boolean) => Promise<void>;
  onTestSimulateLead: (sampleText: string) => Promise<any>;
  onClearLeads?: () => Promise<void>;
  onToggleAccountModule?: (accountId: string, module: 'pv_reply' | 'group_broadcast' | 'personal_account' | 'strict_isolation', enabled: boolean) => Promise<void>;
}

export const GroupPromotionStrategiesCard: React.FC<GroupPromotionStrategiesCardProps> = ({
  strategyConfig,
  campaigns,
  groups,
  accounts,
  isConnected,
  onSwitchStrategy,
  onUpdateStrategyConfig,
  onRunStrategy1Now,
  onToggleListener,
  onTestSimulateLead,
  onClearLeads,
  onToggleAccountModule,
}) => {
  // Safe default config
  const config = strategyConfig || {
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
        'وی پی ان',
        'وی‌پی‌ان',
        'ویپیان',
        'فیلترشکن',
        'فیلتر شکن',
        'فیلترشکن رایگان',
        'فیلترشکن خوب',
        'فیلترشکن سالم',
        'فیلترشکن قوی',
        'فیلترشکن پولی',
        'پروکسی',
        'proxy',
        'پروکسی رایگان',
        'پروکسی خوب',
        'پروکسی سالم',
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
        'نت ندارم',
        'اینترنت ندارم',
        'نت قطع شده',
        'اینترنت قطع شده',
        'نت قطعه',
        'اینترنت قطع',
        'وصل نمیشه',
        'کانکت نمیشه',
        'فیلتر شده',
        'فیلترینگ',
        'فیلتره',
        'ضدفیلتر',
        'دور زدن فیلتر',
        'اینترنت ملی',
        'پینگ',
        'کاهش پینگ',
        'پینگ بالا',
        'پینگ بالاست',
        'پینگم بالاست',
        'پینگ رفته بالا',
        'پینگ زیاد شده',
        'پینگ نوسان داره',
        'پینگ ثابت نیست',
        'پینگ افتضاحه',
        'پکت لاس',
        'packet loss',
        'لگ',
        'لگ دارم',
        'لگ میزنم',
        'کندی اینترنت',
        'سرعت اینترنت',
        'قطعی اینترنت',
        'باز نمیشه',
        'لود نمیشه',
        'اینترنت ضعیفه',
        'نت ضعیفه',
        'نت داغونه',
        'اینستاگرام',
        'اینستا',
        'اینستا باز نمیشه',
        'اینستاگرام باز نمیشه',
        'اینستا لود نمیشه',
        'اینستاگرام لود نمیشه',
        'یوتیوب',
        'youtube',
        'یوتیوب باز نمیشه',
        'یوتیوب قطع',
        'یوتیوب کند',
        'youtube loading',
        'chatgpt',
        'چت جی پی تی',
        'چت‌جی‌پی‌تی',
        'chatgpt باز نمیشه',
        'chatgpt وصل نمیشه',
        'chatgpt کار نمیکنه',
        'chatgpt فیلتره',
        'gemini',
        'جمینای',
        'gemini باز نمیشه',
        'gemini کار نمیکنه',
        'claude',
        'کلود',
        'claude باز نمیشه',
        'claude کار نمیکنه',
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
        'هوش مصنوعی',
        'openai',
        'twitter',
        'توییتر',
        'twitter باز نمیشه',
        'توییتر باز نمیشه',
        'x',
        'x باز نمیشه',
        'ردیت باز نمیشه',
        'reddit باز نمیشه',
        'tiktok',
        'تیک تاک',
        'tiktok باز نمیشه',
        'discord',
        'دیسکورد',
        'discord باز نمیشه',
        'تلگرام وصل نمیشه',
        'واتساپ وصل نمیشه',
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
        'سرور اروپا',
        'سرور آلمان',
        'سرور آمریکا',
        'سرور ترکیه',
        'سرور بازی',
        'سرور وصل نمیشه',
        'بازی وصل نمیشه',
        'آنلاین نمیشه',
        'بازی تحریم',
        'سرور تحریم',
        'اکانت تحریم',
        'steam',
        'استیم',
        'psn',
        'xbox live',
        'ایکس باکس',
        'گوگل فلو',
        'google flow',
      ],
      replyInGroup: true,
      sendDirectMessage: true,
      sendBannerInDirectMessage: true,
      friendStylePvTone: true,
      groupReplyDelaySeconds: 4,
      pvMessageDelaySeconds: 8,
      userCooldownHours: 24,
      maxRepliesPerGroupPerHour: 5,
      useAiReasoning: true,
      totalMessagesScanned: 0,
      totalLeadsDetected: 0,
      totalGroupRepliesSent: 0,
      totalPvMessagesSent: 0,
      neverRepeatPvToSameUser: true,
      checkTelegramHistoryBeforePv: true,
      totalPvRepeatsPrevented: 0,
    },
    recentLeads: [],
  };

  const [activeStrategyState, setActiveStrategyState] = useState<GroupPromotionStrategyType>(config.activeStrategy);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isRunningStrategy1, setIsRunningStrategy1] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [customTestMessage, setCustomTestMessage] = useState('سلام بچه‌ها، کسی فیلترشکن یا vpn پرسرعت بدون قطعی برای چت جی پی تی و اینستاگرام سراغ داره؟');
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [keywordSearchTerm, setKeywordSearchTerm] = useState('');
  const [keywordCategoryFilter, setKeywordCategoryFilter] = useState<'all' | 'vpn' | 'trading' | 'social' | 'ai' | 'gaming' | 'speed'>('all');
  const [selectedSubTab, setSelectedSubTab] = useState<'strategy1' | 'strategy2' | 'keywords' | 'leads' | 'inbound' | 'audit_export'>('keywords');

  // Comprehensive JSON Audit State
  const [auditReport, setAuditReport] = useState<any>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const handleFetchAudit = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch('/api/strategy/group-promotion/audit-export');
      const data = await res.json();
      if (data.success && data.report) {
        setAuditReport(data.report);
      }
    } catch (e) {
      console.error('Failed to fetch audit report:', e);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleCopyAuditJson = () => {
    if (!auditReport) return;
    navigator.clipboard.writeText(JSON.stringify(auditReport, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  // Multi-bubble live testing to telegram account
  const [testTargetUsername, setTestTargetUsername] = useState(config.strategy2.testTargetUsername || '');
  const [isSendingTestPv, setIsSendingTestPv] = useState(false);
  const [testPvResult, setTestPvResult] = useState<any>(null);

  // Inbound testing state
  const [inboundTestInput, setInboundTestInput] = useState('سلام، قیمت اشتراکتون چنده؟ اکانت تست هم دارید برای آیفون؟');
  const [isInboundTesting, setIsInboundTesting] = useState(false);
  const [inboundTestResult, setInboundTestResult] = useState<any>(null);
  const [supportContactInput, setSupportContactInput] = useState(config.strategy2.supportContactHandle || '@Nova_vpn10');
  const [retryingLeadId, setRetryingLeadId] = useState<string | null>(null);

  // Manual Inbound PV & Isolation Mode States
  const [isTogglingPvMaster, setIsTogglingPvMaster] = useState(false);
  const [isTogglingAccountAction, setIsTogglingAccountAction] = useState<string | null>(null);

  const handleToggleMasterPvReply = async (enabled: boolean) => {
    setIsTogglingPvMaster(true);
    try {
      const res = await fetch('/api/strategy/strategy2/toggle-inbound-pv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success && onUpdateStrategyConfig) {
        await onUpdateStrategyConfig({
          strategy2: {
            ...config.strategy2,
            autoReplyInboundPv: enabled,
          },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingPvMaster(false);
    }
  };

  const handleChangeInboundPvScope = async (inboundPvScope: 'all_messages' | 'product_inquiries_only') => {
    try {
      const res = await fetch('/api/strategy/strategy2/toggle-inbound-pv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inboundPvScope }),
      });
      const data = await res.json();
      if (data.success && onUpdateStrategyConfig) {
        await onUpdateStrategyConfig({
          strategy2: {
            ...config.strategy2,
            inboundPvScope,
          },
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAccountPvToggle = async (accId: string, current: boolean) => {
    setIsTogglingAccountAction(accId);
    try {
      if (onToggleAccountModule) {
        await onToggleAccountModule(accId, 'pv_reply', !current);
      } else {
        await fetch('/api/strategy/strategy2/toggle-inbound-pv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: accId, enableForPvReply: !current }),
        });
      }
    } finally {
      setIsTogglingAccountAction(null);
    }
  };

  const handleAccountPersonalModeToggle = async (accId: string, current: boolean) => {
    setIsTogglingAccountAction(accId);
    try {
      if (onToggleAccountModule) {
        await onToggleAccountModule(accId, 'personal_account', !current);
      } else {
        await fetch('/api/accounts/toggle-personal-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: accId, isPersonalAccount: !current }),
        });
      }
    } finally {
      setIsTogglingAccountAction(null);
    }
  };

  const handleRetryLeadPv = async (leadId: string) => {
    setRetryingLeadId(leadId);
    try {
      const res = await fetch('/api/strategy/strategy2/retry-pv-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'خطا در تلاش مجدد ارسال پی‌وی');
      } else {
        if (data.lead && config.recentLeads) {
          const updated = config.recentLeads.map(l => (l.id === leadId ? data.lead : l));
          await onUpdateStrategyConfig({ recentLeads: updated });
        }
      }
    } catch (err: any) {
      alert('خطا در اتصال به سرور: ' + (err?.message || 'نامشخص'));
    } finally {
      setRetryingLeadId(null);
    }
  };

  // Gemini AI Caption Live Generator State
  const [testAiGroupTitle, setTestAiGroupTitle] = useState('گروه برنامه‌نویسان و گیمرهای ایران');
  const [testAiTone, setTestAiTone] = useState<'friendly' | 'professional' | 'minimal' | 'story'>('friendly');
  const [isGeneratingAiCaption, setIsGeneratingAiCaption] = useState(false);
  const [generatedAiCaptionResult, setGeneratedAiCaptionResult] = useState<{ text: string; usedAi: boolean; model?: string } | null>(null);

  const handleTestGenerateAiCaption = async () => {
    setIsGeneratingAiCaption(true);
    try {
      const res = await fetch('/api/campaigns/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: activeCampaign?.id,
          groupTitle: testAiGroupTitle,
          tone: testAiTone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedAiCaptionResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAiCaption(false);
    }
  };

  const handleToggleGeminiRewriting = async (checked: boolean) => {
    await onUpdateStrategyConfig({
      strategy1: {
        ...config.strategy1,
        useGeminiRewriting: checked,
      },
    });
  };

  const handleChangeGeminiTone = async (tone: 'friendly' | 'professional' | 'minimal' | 'story') => {
    setTestAiTone(tone);
    await onUpdateStrategyConfig({
      strategy1: {
        ...config.strategy1,
        geminiCaptionTone: tone,
      },
    });
  };

  // Calculate 100% ready groups count
  const readyGroups = groups.filter(g => {
    const isJoined = g.status === 'joined' || g.membershipStatus === 'joined' || (g.joinedAccountIds && g.joinedAccountIds.length > 0);
    const canSend = g.canSendMessages !== false && g.readinessStatus !== 'no_permission_left';
    return g.isActive && isJoined && canSend;
  });

  const activeCampaign = campaigns.find(c => c.isActive) || campaigns[0];

  const handleStrategyClick = async (type: GroupPromotionStrategyType) => {
    setIsSwitching(true);
    setActiveStrategyState(type);
    try {
      await onSwitchStrategy(type);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleHourPreset = async (hours: number) => {
    const updatedStrategy1 = {
      ...config.strategy1,
      intervalHours: hours,
      intervalMinutes: hours * 60,
    };
    await onUpdateStrategyConfig({
      strategy1: updatedStrategy1,
    });
  };

  const handleToggleOnlyReady = async (checked: boolean) => {
    await onUpdateStrategyConfig({
      strategy1: {
        ...config.strategy1,
        onlyFullyReadyGroups: checked,
      },
    });
  };

  const handleToggleIncludeBanner = async (checked: boolean) => {
    await onUpdateStrategyConfig({
      strategy1: {
        ...config.strategy1,
        includeBanner: checked,
      },
    });
  };

  const handleStrategy2Toggle = async (key: keyof typeof config.strategy2, value: any) => {
    await onUpdateStrategyConfig({
      strategy2: {
        ...config.strategy2,
        [key]: value,
      },
    });
  };

  const handleApplySpeedPreset = async (preset: 'turbo' | 'balanced' | 'safe') => {
    let groupCooldownMinutes = 2;
    let maxRepliesPerGroupPerHour = 10;
    let groupReplyDelaySeconds = 2;
    let pvMessageDelaySeconds = 4;

    if (preset === 'turbo') {
      groupCooldownMinutes = 1;
      maxRepliesPerGroupPerHour = 15;
      groupReplyDelaySeconds = 2;
      pvMessageDelaySeconds = 4;
    } else if (preset === 'balanced') {
      groupCooldownMinutes = 2;
      maxRepliesPerGroupPerHour = 8;
      groupReplyDelaySeconds = 3;
      pvMessageDelaySeconds = 6;
    } else if (preset === 'safe') {
      groupCooldownMinutes = 5;
      maxRepliesPerGroupPerHour = 4;
      groupReplyDelaySeconds = 5;
      pvMessageDelaySeconds = 10;
    }

    await onUpdateStrategyConfig({
      strategy2: {
        ...config.strategy2,
        scannerPresetMode: preset,
        groupCooldownMinutes,
        maxRepliesPerGroupPerHour,
        groupReplyDelaySeconds,
        pvMessageDelaySeconds,
        autoSkipLockedRestrictedGroups: true,
      },
    });
  };

  const handleAddKeyword = async () => {
    const trimmed = newKeywordInput.trim().toLowerCase();
    if (!trimmed) return;
    if (config.strategy2.keywords.includes(trimmed)) {
      setNewKeywordInput('');
      return;
    }
    const updatedKeywords = [...config.strategy2.keywords, trimmed];
    await onUpdateStrategyConfig({
      strategy2: {
        ...config.strategy2,
        keywords: updatedKeywords,
      },
    });
    setNewKeywordInput('');
  };

  const handleRemoveKeyword = async (kw: string) => {
    const updatedKeywords = config.strategy2.keywords.filter(k => k !== kw);
    await onUpdateStrategyConfig({
      strategy2: {
        ...config.strategy2,
        keywords: updatedKeywords,
      },
    });
  };

  const handleAddCategoryKeywords = async (keywordsToAdd: string[]) => {
    const current = config.strategy2.keywords || [];
    const merged = Array.from(new Set([...current, ...keywordsToAdd.map(k => k.trim().toLowerCase())])).filter(Boolean);
    await onUpdateStrategyConfig({
      strategy2: {
        ...config.strategy2,
        keywords: merged,
      },
    });
  };

  const handleResetDefaultKeywords = async () => {
    if (!confirm('آیا مایلید تمام ۱۴۶ کلیدواژه پیش‌فرض استاندارد (شامل ترید، سوشال، AI، گیمینگ و VPN) بازیابی و اعمال شوند؟')) return;
    await onUpdateStrategyConfig({
      strategy2: {
        ...config.strategy2,
        keywords: DEFAULT_146_KEYWORDS,
      },
    });
  };

  const classifyKeyword = (kw: string) => {
    const k = kw.toLowerCase().trim();
    if (k.includes('trade') || k.includes('ترید') || k.includes('forex') || k.includes('فارکس') || k.includes('crypto') || k.includes('کریپتو') || k.includes('binance') || k.includes('بایننس') || k.includes('coinbase') || k.includes('متاتریدر') || k.includes('mt4') || k.includes('mt5') || k.includes('بروکر') || k.includes('صرافی') || k.includes('آی پی') || k.includes('ip')) {
      return { category: 'trading', label: 'ترید و کریپتو و فارکس', badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    if (k.includes('chatgpt') || k.includes('چت جی پی تی') || k.includes('gemini') || k.includes('جمینای') || k.includes('claude') || k.includes('کلود') || k.includes('ai') || k.includes('هوش مصنوعی') || k.includes('copilot') || k.includes('perplexity') || k.includes('midjourney') || k.includes('sora') || k.includes('huggingface') || k.includes('openai') || k.includes('کوپایلت')) {
      return { category: 'ai', label: 'هوش مصنوعی و ابزارها', badgeColor: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' };
    }
    if (k.includes('اینستا') || k.includes('یوتیوب') || k.includes('youtube') || k.includes('twitter') || k.includes('توییتر') || k.includes('x') || k.includes('tiktok') || k.includes('تیک تاک') || k.includes('discord') || k.includes('دیسکورد') || k.includes('ردیت') || k.includes('reddit') || k.includes('تلگرام') || k.includes('واتساپ')) {
      return { category: 'social', label: 'شبکه‌های اجتماعی', badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    }
    if (k.includes('پینگ') || k.includes('ping') || k.includes('لگ') || k.includes('lag') || k.includes('بازی') || k.includes('گیم') || k.includes('game') || k.includes('valorant') || k.includes('ولورانت') || k.includes('کالاف') || k.includes('warzone') || k.includes('وارزون') || k.includes('fortnite') || k.includes('فورتنایت') || k.includes('pubg') || k.includes('پابجی') || k.includes('apex') || k.includes('league') || k.includes('ماینکرفت') || k.includes('minecraft') || k.includes('steam') || k.includes('استیم') || k.includes('psn') || k.includes('xbox') || k.includes('پکت لاس') || k.includes('تحریم')) {
      return { category: 'gaming', label: 'گیمینگ و پینگ و سرور', badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    }
    if (k.includes('سرعت') || k.includes('کندی') || k.includes('قطعی') || k.includes('نت') || k.includes('اینترنت') || k.includes('قطع') || k.includes('وصل نمیشه') || k.includes('کانکت') || k.includes('باز نمیشه') || k.includes('لود نمیشه') || k.includes('ملی')) {
      return { category: 'speed', label: 'سرعت و قطعی اینترنت', badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
    }
    return { category: 'vpn', label: 'فیلترشکن، کانفیگ و سرور', badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
  };

  const KEYWORD_PRESETS = [
    {
      id: 'trading',
      title: '📈 ترید، فارکس و صرافی',
      keywords: [
        'tradingview', 'تریدینگ ویو', 'تریدینگ‌ویو', 'بروکر', 'بروکر خارجی', 'صرافی خارجی', 'صرافی',
        'forex', 'فارکس', 'فورکس', 'crypto', 'کریپتو', 'binance', 'بایننس', 'coinbase', 'کوین بیس',
        'کوین‌بیس', 'metatrader', 'متاتریدر', 'mt4', 'mt5', 'trading', 'ترید', 'سرور خارجی',
        'ip خارجی', 'آی پی خارجی', 'آی‌پی خارجی', 'آی پی ثابت', 'آی‌پی ثابت'
      ]
    },
    {
      id: 'social',
      title: '💬 اینستاگرام، یوتیوب و سوشال',
      keywords: [
        'اینستا باز نمیشه', 'اینستاگرام باز نمیشه', 'اینستا لود نمیشه', 'اینستاگرام لود نمیشه',
        'یوتیوب باز نمیشه', 'یوتیوب قطع', 'یوتیوب کند', 'youtube loading', 'twitter باز نمیشه',
        'x باز نمیشه', 'توییتر باز نمیشه', 'ردیت باز نمیشه', 'reddit باز نمیشه', 'discord باز نمیشه',
        'tiktok باز نمیشه', 'تلگرام وصل نمیشه', 'واتساپ وصل نمیشه', 'اینستاگرام', 'اینستا', 'یوتیوب', 'youtube', 'twitter', 'توییتر', 'x', 'tiktok', 'تیک تاک', 'discord', 'دیسکورد'
      ]
    },
    {
      id: 'ai',
      title: '🤖 هوش مصنوعی (ChatGPT, Claude, Gemini)',
      keywords: [
        'chatgpt', 'چت جی پی تی', 'چت‌جی‌پی‌تی', 'chatgpt باز نمیشه', 'chatgpt وصل نمیشه',
        'chatgpt کار نمیکنه', 'chatgpt فیلتره', 'gemini', 'جمینای', 'gemini باز نمیشه',
        'gemini کار نمیکنه', 'claude', 'کلود', 'claude باز نمیشه', 'claude کار نمیکنه',
        'google ai', 'google ai studio', 'ai studio', 'ai.google', 'copilot', 'مایکروسافت کوپایلت',
        'کوپایلت', 'perplexity', 'پرپلکسیتی', 'huggingface', 'هاگینگ فیس', 'midjourney',
        'میدجرنی', 'sora', 'سورا', 'هوش مصنوعی', 'openai'
      ]
    },
    {
      id: 'gaming',
      title: '🎮 گیمینگ، پینگ و پکت‌لاس',
      keywords: [
        'valorant', 'ولورانت', 'call of duty', 'کالاف', 'warzone', 'وارزون', 'fortnite',
        'فورتنایت', 'pubg', 'پابجی', 'apex', 'اپکس', 'league of legends', 'league',
        'minecraft', 'ماینکرفت', 'پینگ بالاست', 'پینگم بالاست', 'پینگ رفته بالا',
        'پینگ زیاد شده', 'پینگ نوسان داره', 'پینگ ثابت نیست', 'پینگ افتضاحه', 'پکت لاس',
        'packet loss', 'لگ', 'لگ دارم', 'لگ میزنم', 'سرور اروپا', 'سرور آلمان',
        'سرور آمریکا', 'سرور ترکیه', 'سرور بازی', 'سرور وصل نمیشه', 'بازی وصل نمیشه',
        'آنلاین نمیشه', 'بازی تحریم', 'سرور تحریم', 'اکانت تحریم', 'steam', 'استیم',
        'psn', 'xbox live', 'ایکس باکس', 'پینگ', 'کاهش پینگ', 'پینگ بالا'
      ]
    },
    {
      id: 'speed',
      title: '⚡ سرعت، اختلال و قطعی اینترنت',
      keywords: [
        'نت ندارم', 'اینترنت ندارم', 'نت قطع شده', 'اینترنت قطع شده', 'نت قطعه',
        'اینترنت قطع', 'وصل نمیشه', 'کانکت نمیشه', 'فیلتر شده', 'فیلترینگ', 'فیلتره',
        'ضدفیلتر', 'دور زدن فیلتر', 'اینترنت ملی', 'کندی اینترنت', 'سرعت اینترنت',
        'قطعی اینترنت', 'باز نمیشه', 'لود نمیشه', 'اینترنت ضعیفه', 'نت ضعیفه', 'نت داغونه'
      ]
    },
    {
      id: 'vpn',
      title: '🛡️ فیلترشکن، کانفیگ و سرور',
      keywords: [
        'vpn', 'وی پی ان', 'وی‌پی‌ان', 'ویپیان', 'فیلترشکن', 'فیلتر شکن', 'فیلترشکن رایگان',
        'فیلترشکن خوب', 'فیلترشکن سالم', 'فیلترشکن قوی', 'فیلترشکن پولی', 'پروکسی',
        'proxy', 'پروکسی رایگان', 'پروکسی خوب', 'پروکسی سالم', 'v2ray', 'v2rayng',
        'کانفیگ', 'کانفیگ رایگان', 'کانفیگ سالم', 'کانفیگ جدید', 'کانفیگ اختصاصی',
        'کانفیگ v2ray', 'کانفیگ vmess', 'کانفیگ vless', 'کانفیگ reality', 'سرور',
        'سرور رایگان', 'سرور سالم', 'سرور جدید', 'سرور خوب', 'لینک کانفیگ',
        'لینک فیلترشکن', 'لینک پروکسی', 'کانفیگ میخوام', 'کانفیگ داری', 'کانفیگ دارید',
        'کانفیگ بده', 'کانفیگ بدید', 'پروکسی داری', 'پروکسی دارید', 'سرور داری',
        'سرور دارید', 'لینک داری', 'لینک دارید', 'گوگل فلو', 'google flow'
      ]
    }
  ];

  const handleRunStrategy1Click = async () => {
    setIsRunningStrategy1(true);
    try {
      await onRunStrategy1Now();
    } catch (err: any) {
      alert(err?.message || 'خطا در اجرای استراتژی ۱');
    } finally {
      setIsRunningStrategy1(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!customTestMessage.trim()) return;
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const res = await onTestSimulateLead(customTestMessage);
      setSimulationResult(res);
    } catch (err: any) {
      alert('خطا در اجرای تست: ' + (err?.message || 'نامشخص'));
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSendTestPv = async () => {
    setIsSendingTestPv(true);
    setTestPvResult(null);
    try {
      const res = await fetch('/api/strategy/strategy2/test-send-pv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: testTargetUsername,
          sampleCategory: simulationResult?.detectedCategory || 'vpn_filter',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'خطا در ارسال پیام تستی به تلگرام');
      }
      setTestPvResult(data);
    } catch (err: any) {
      alert(err?.message || 'خطا در ارسال پیام تستی');
    } finally {
      setIsSendingTestPv(false);
    }
  };

  const handleTestInboundReply = async () => {
    if (!inboundTestInput.trim()) return;
    setIsInboundTesting(true);
    setInboundTestResult(null);
    try {
      const res = await fetch('/api/strategy/strategy2/test-inbound-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: inboundTestInput,
          senderFirstName: 'امین',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'خطا در شبیه‌سازی پاسخ به پیام خصوصی');
      }
      setInboundTestResult(data);
    } catch (err: any) {
      alert(err?.message || 'خطا در شبیه‌سازی');
    } finally {
      setIsInboundTesting(false);
    }
  };

  const handleSaveSupportContact = async () => {
    const clean = supportContactInput.trim();
    if (!clean) return;
    await onUpdateStrategyConfig({
      strategy2: {
        ...config.strategy2,
        supportContactHandle: clean.startsWith('@') ? clean : '@' + clean,
      },
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. MASTER ONE-CLICK STRATEGY SELECTOR HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        
        {/* Background glow styling */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-sky-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative space-y-5">
          
          {/* Header text */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white tracking-tight">
                    استراتژی‌های ارسال و فعالیت تبلیغاتی در گروه‌ها
                  </h2>
                  <span className="text-[11px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    تغییر با ۱ کلیک
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  مشخص کنید ربات چگونه تبلیغات VPN کمپین را منتشر کند: ارسال دوره‌ای بنر یا شنود هوشمند پیام‌ها و جذب لید
                </p>
              </div>
            </div>

            {/* Current Active Strategy Badge */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-2xl shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs text-slate-400">استراتژی فعال:</span>
              <span className="text-xs font-black text-emerald-300">
                {activeStrategyState === 'periodic_broadcast' && 'استراتژی اول: ارسال دوره‌ای بنر'}
                {activeStrategyState === 'smart_listener_reply' && 'استراتژی دوم: دیده‌بان و ریپلای هوشمند + پی‌وی'}
                {activeStrategyState === 'hybrid_both' && 'حالت ترکیبی: هر دو استراتژی فعال'}
              </span>
            </div>
          </div>

          {/* 3 ONE-CLICK STRATEGY SELECTOR CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            
            {/* Strategy 1 Card */}
            <button
              type="button"
              onClick={() => handleStrategyClick('periodic_broadcast')}
              disabled={isSwitching}
              className={`text-right p-4 rounded-2xl border transition-all duration-200 relative group flex flex-col justify-between ${
                activeStrategyState === 'periodic_broadcast'
                  ? 'bg-gradient-to-b from-sky-900/30 via-slate-900 to-slate-950 border-sky-500 shadow-xl shadow-sky-500/10 ring-2 ring-sky-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              {activeStrategyState === 'periodic_broadcast' && (
                <div className="absolute top-3 left-3 bg-sky-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>فعال شده</span>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    activeStrategyState === 'periodic_broadcast'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                      : 'bg-slate-800 text-slate-400 group-hover:text-white'
                  }`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">استراتژی اول (دوره‌ای)</h3>
                    <p className="text-[11px] text-sky-400 font-medium">ارسال دوره‌ای بنر و متن تبلیغات</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  ربات در همه گروه‌هایی که عضو است و قابلیت ارسال پیام دارند (<span className="text-sky-300 font-bold">۱۰۰٪ آماده</span>) بصورت دوره‌ای <span className="text-white font-bold">هر چند ساعت یک‌بار</span> بنر و متن کمپین را با رعایت اصول ضداسپم ارسال می‌کند.
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  فواصل: هر <b className="text-white">{config.strategy1.intervalHours || 2} ساعت</b>
                </span>
                <span className="text-sky-400 font-bold flex items-center gap-1">
                  {readyGroups.length} گروه ۱۰۰٪ آماده
                </span>
              </div>
            </button>

            {/* Strategy 2 Card */}
            <button
              type="button"
              onClick={() => handleStrategyClick('smart_listener_reply')}
              disabled={isSwitching}
              className={`text-right p-4 rounded-2xl border transition-all duration-200 relative group flex flex-col justify-between ${
                activeStrategyState === 'smart_listener_reply'
                  ? 'bg-gradient-to-b from-purple-900/30 via-slate-900 to-slate-950 border-purple-500 shadow-xl shadow-purple-500/10 ring-2 ring-purple-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              {activeStrategyState === 'smart_listener_reply' && (
                <div className="absolute top-3 left-3 bg-purple-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>فعال شده</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    activeStrategyState === 'smart_listener_reply'
                      ? 'bg-purple-500 text-white shadow-md shadow-purple-500/25'
                      : 'bg-slate-800 text-slate-400 group-hover:text-white'
                  }`}>
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">استراتژی دوم (شنود و ریپلای)</h3>
                    <p className="text-[11px] text-purple-400 font-medium">دیده‌بان هوشمند + ریپلای و پی‌وی</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  ربات به پیام‌های گروه گوش می‌دهد؛ با شناسایی مباحث <span className="text-purple-300 font-bold">VPN، فیلترشکن، سرعت نت یا هوش مصنوعی</span>، هوشمند به پیام ریپلای زده و همزمان در <span className="text-white font-bold">پی‌وی مانند یک فرد معمولی</span> راهنمایی و بنر می‌فرستد.
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  شناسایی: <b className="text-purple-300 font-bold bg-purple-500/20 px-2 py-0.5 rounded-lg border border-purple-500/30 font-mono">{config.strategy2.keywords.length} کلیدواژه فعال</b>
                </span>
                <span className="text-purple-400 font-bold">
                  ریپلای گروه + پی‌وی
                </span>
              </div>
            </button>

            {/* Hybrid Both Card */}
            <button
              type="button"
              onClick={() => handleStrategyClick('hybrid_both')}
              disabled={isSwitching}
              className={`text-right p-4 rounded-2xl border transition-all duration-200 relative group flex flex-col justify-between ${
                activeStrategyState === 'hybrid_both'
                  ? 'bg-gradient-to-b from-emerald-900/30 via-slate-900 to-slate-950 border-emerald-500 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              {activeStrategyState === 'hybrid_both' && (
                <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>فعال شده</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    activeStrategyState === 'hybrid_both'
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                      : 'bg-slate-800 text-slate-400 group-hover:text-white'
                  }`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">حالت ترکیبی (Hybrid)</h3>
                    <p className="text-[11px] text-emerald-400 font-medium">اجرای همزمان هر دو استراتژی</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  حداکثر بازدهی تبلیغاتی: ارسال منظم و دوره‌ای بنر در گروه‌های ۱۰۰٪ آماده <span className="text-emerald-300 font-bold">+</span> حضور و شنود پیوسته برای پاسخگویی شخصی و سریع به کاربرانی که متقاضی فیلترشکن هستند.
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">عملکرد چندکاناله</span>
                <span className="text-emerald-400 font-bold">بیشترین جذب مشتری</span>
              </div>
            </button>

          </div>

          {/* Sub Navigation Bar to configure details */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 overflow-x-auto">
            <button
              onClick={() => setSelectedSubTab('keywords')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                selectedSubTab === 'keywords'
                  ? 'bg-purple-600 text-white border border-purple-400 shadow-lg shadow-purple-500/20 ring-2 ring-purple-400/30'
                  : 'bg-purple-950/40 text-purple-300 hover:text-white border border-purple-800/50'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-purple-300" />
              <span>مرکز کلیدواژه‌های شنود</span>
              <span className="text-[10px] bg-purple-900/80 px-1.5 py-0.2 rounded-full font-mono font-bold text-purple-200">
                {config.strategy2?.keywords?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setSelectedSubTab('strategy1')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                selectedSubTab === 'strategy1'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>پیکربندی استراتژی اول (ارسال دوره‌ای بنر)</span>
            </button>

            <button
              onClick={() => setSelectedSubTab('strategy2')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                selectedSubTab === 'strategy2'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>پیکربندی استراتژی دوم (شنود هوشمند و چت حبابی پی‌وی)</span>
            </button>

            <button
              onClick={() => setSelectedSubTab('inbound')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                selectedSubTab === 'inbound'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>پاسخگویی خودکار پی‌وی و پشتیبانی</span>
              {config.inboundPvConversations && config.inboundPvConversations.length > 0 && (
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 rounded-full font-mono">
                  {config.inboundPvConversations.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setSelectedSubTab('leads')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                selectedSubTab === 'leads'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>فید زنده لیدهای شناسایی شده</span>
              {config.recentLeads && config.recentLeads.length > 0 && (
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded-full font-mono">
                  {config.recentLeads.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedSubTab('audit_export');
                handleFetchAudit();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                selectedSubTab === 'audit_export'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-amber-400" />
              <span>خروجی هوشمند JSON، لاگ‌ها و تحلیل SWOT</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-PANEL: STRATEGY 1 DETAILED CONTROLS (ارسال دوره‌ای بنر) */}
      {/* ========================================================================= */}
      {selectedSubTab === 'strategy1' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6 animate-in fade-in duration-200">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-400" />
                تنظیمات و کنترل استراتژی اول: ارسال دوره‌ای بنر در گروه‌های ۱۰۰٪ آماده
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تنظیم ساعات ارسال، فیلتر گروه‌های با دسترسی ارسال پیام و اجرای دستی آنی
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunStrategy1Click}
              disabled={isRunningStrategy1 || !isConnected || readyGroups.length === 0}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg active:scale-95 ${
                isConnected && readyGroups.length > 0
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-500/25'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              {isRunningStrategy1 ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال انتشار در گروه‌ها...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>ارسال فوری بنر و تبلیغ (اجرای آنی استراتژی ۱)</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">گروه‌های ۱۰۰٪ آماده (با دسترسی ارسال)</span>
              <div className="text-base font-black text-sky-400 mt-1 flex items-center gap-1.5">
                <span>{readyGroups.length}</span>
                <span className="text-xs text-slate-500 font-normal">از {groups.length} گروه</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">فاصله دوره ارسال</span>
              <div className="text-base font-black text-white mt-1">
                هر {config.strategy1.intervalHours || 2} ساعت
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">کل ارسال‌های دوره‌ای موفق</span>
              <div className="text-base font-black text-emerald-400 mt-1 font-mono">
                {(config.strategy1.totalBroadcastsSent || 0).toLocaleString('fa-IR')}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">زمان اجرای بعدی دوره‌ای</span>
              <div className="text-xs font-bold text-slate-300 mt-1.5 truncate">
                {config.strategy1.nextBroadcastAt
                  ? new Date(config.strategy1.nextBroadcastAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                  : 'آماده شروع'}
              </div>
            </div>
          </div>

          {/* Interval Hours Selector */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <span>تنظیم دوره ارسال (هر چند ساعت یک‌بار ارسال شود):</span>
              </label>
              <span className="text-xs text-sky-400 font-mono font-bold">
                فعلی: هر {config.strategy1.intervalHours || 2} ساعت
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              {[
                { label: 'هر ۱ ساعت', hours: 1 },
                { label: 'هر ۲ ساعت', hours: 2, recommended: true },
                { label: 'هر ۴ ساعت', hours: 4 },
                { label: 'هر ۶ ساعت', hours: 6 },
                { label: 'هر ۱۲ ساعت', hours: 12 },
                { label: 'هر ۲۴ ساعت', hours: 24 },
              ].map((p) => {
                const isSelected = (config.strategy1.intervalHours || 2) === p.hours;
                return (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => handleHourPreset(p.hours)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{p.label}</span>
                    {p.recommended && (
                      <span className={`text-[9px] px-1 py-0.2 rounded font-normal ${isSelected ? 'bg-sky-600 text-white' : 'bg-slate-800 text-sky-300'}`}>
                        محبوب
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checkboxes for 100% Ready & Media Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
              <input
                type="checkbox"
                checked={config.strategy1.onlyFullyReadyGroups}
                onChange={(e) => handleToggleOnlyReady(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-sky-600 bg-slate-900 border-slate-700 focus:ring-sky-500"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">
                  ارسال اختصاصی فقط به گروه‌های ۱۰۰٪ آماده
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  فقط گروه‌هایی که عضویت اکانت در آن‌ها تایید شده و دسترسی ارسال پیام فعال است انتخاب می‌شوند (رد کردن گروه‌های قفل‌دار یا بدون مجوز).
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
              <input
                type="checkbox"
                checked={config.strategy1.includeBanner}
                onChange={(e) => handleToggleIncludeBanner(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-sky-600 bg-slate-900 border-slate-700 focus:ring-sky-500"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">
                  ارسال پیوست بنر تصویری همراه متن تبلیغ
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  بنر آپلود شده در کمپین فعال ({activeCampaign?.title || 'کمپین'}) همراه متن ارسال شده و بازدهی بصری تبلیغ را چند برابر می‌کند.
                </p>
              </div>
            </label>

          </div>

          {/* AI-Powered Dynamic Caption Generation with Gemini */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-950 to-slate-950 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      بازنویسی متن تبلیغ با هوش مصنوعی Gemini (فرار ۱۰۰٪ از سیستم ضد اسپم تلگرام)
                    </h4>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
                      Gemini 3.8 Flash
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    متن ارسالی زیر عکس برای هر گروه کاملاً دگرگون و منحصربه‌فرد می‌شود تا تلگرام رفتار تبلیغ را الگوبرداری و مسدود نکند.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 shrink-0 cursor-pointer bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  checked={config.strategy1.useGeminiRewriting !== false}
                  onChange={(e) => handleToggleGeminiRewriting(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-indigo-300">
                  {config.strategy1.useGeminiRewriting !== false ? 'تولید با Gemini فعال است' : 'استفاده از الگوی محلی'}
                </span>
              </label>
            </div>

            {/* Tone Selector */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                لحن تولید متن توسط هوش مصنوعی:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'friendly', label: '👋 دوستانه و صمیمی', desc: 'متن خودمانی با اموجی‌های جذاب' },
                  { id: 'professional', label: '💼 رسمی و تجاری', desc: 'معرفی مشخصات فنی و اطمینان‌بخش' },
                  { id: 'minimal', label: '⚡ کوتاه و خلاصه', desc: 'سریع و موجز با تمرکز بر اقدام فوری' },
                  { id: 'story', label: '💡 داستانی و تجربی', desc: 'از زبان کاربری که از قطعی نجات پیدا کرده' },
                ].map((t) => {
                  const isSelected = (config.strategy1.geminiCaptionTone || 'friendly') === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleChangeGeminiTone(t.id as any)}
                      className={`p-2.5 rounded-xl text-right transition-all border ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="text-xs font-bold text-indigo-200">{t.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Live Generator Test */}
            <div className="bg-slate-950/80 rounded-xl p-3 sm:p-4 border border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-indigo-400" />
                  آزمایش زنده تولید متن با Gemini قبل از انتشار در تلگرام:
                </span>
                <span className="text-[10px] text-slate-500">
                  متغیرها مانند {`{random_emoji}`} و {`{group_title}`} خودکار پر می‌شوند
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={testAiGroupTitle}
                  onChange={(e) => setTestAiGroupTitle(e.target.value)}
                  placeholder="نام گروه فرضی (مثال: گروه تبادل ارز دیجیتال و کریپتو)..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleTestGenerateAiCaption}
                  disabled={isGeneratingAiCaption}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shrink-0 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isGeneratingAiCaption ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال نگارش با Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تولید کپشن نمونه</span>
                    </>
                  )}
                </button>
              </div>

              {generatedAiCaptionResult && (
                <div className="mt-3 p-3.5 bg-slate-900/90 rounded-xl border border-indigo-500/30 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-indigo-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      متن تولید شده اختصاصی برای «{testAiGroupTitle}»:
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                      {generatedAiCaptionResult.model || 'gemini-3.8-flash'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line select-text">
                    {generatedAiCaptionResult.text}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>طول متن: {generatedAiCaptionResult.text.length} کاراکتر</span>
                    <span className="text-emerald-400 font-bold">بدون متغیر خام و کاملاً ضد اسپم</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUB-PANEL: STRATEGY 2 DETAILED CONTROLS (شنود هوشمند، ریپلای و پی‌وی) */}
      {/* ========================================================================= */}
      {selectedSubTab === 'strategy2' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6 animate-in fade-in duration-200">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  تنظیمات استراتژی دوم: شنود هوشمند در گروه‌ها + ریپلای و پی‌وی (Lead Sniffer)
                </h3>
                {config.strategy2.isListeningActive && (
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">
                    شنود فعال
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                گوش دادن به پیام‌های کاربران در گروه‌ها، تشخیص تقاضای فیلترشکن و اینترنت و جذب مشتری با ریپلای گروه و پیام شخصی
              </p>
            </div>

            {/* Listener Master Switch */}
            <button
              type="button"
              onClick={() => onToggleListener(!config.strategy2.isListeningActive)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                config.strategy2.isListeningActive
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-indigo-500'
              }`}
            >
              {config.strategy2.isListeningActive ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>توقف موقت شنود پیام‌ها</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>فعال‌سازی شنود زنده گروه‌ها</span>
                </>
              )}
            </button>
          </div>

          {/* Strategy 2 Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">کل پیام‌های شنود شده</span>
              <div className="text-base font-black text-white mt-1 font-mono">
                {(config.strategy2.totalMessagesScanned || 0).toLocaleString('fa-IR')}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">لیدهای شناسایی‌شده</span>
              <div className="text-base font-black text-purple-400 mt-1 font-mono">
                {(config.strategy2.totalLeadsDetected || 0).toLocaleString('fa-IR')}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">ریپلای در گروه</span>
              <div className="text-base font-black text-sky-400 mt-1 font-mono">
                {(config.strategy2.totalGroupRepliesSent || 0).toLocaleString('fa-IR')}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">پیام ارسالی پی‌وی</span>
              <div className="text-base font-black text-emerald-400 mt-1 font-mono">
                {(config.strategy2.totalPvMessagesSent || 0).toLocaleString('fa-IR')}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 to-slate-950">
              <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                سپر ضد ریپورت (تکراری مسدود)
              </span>
              <div className="text-base font-black text-emerald-400 mt-1 font-mono">
                {(config.strategy2.totalPvRepeatsPrevented || 0).toLocaleString('fa-IR')}
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            
            {/* 1. Group Reply */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                  ریپلای هوشمند در گروه
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ربات در همان گروه به پیام کاربر ریپلای می‌زند و توضیح می‌دهد این مشکل برطرف می‌شود و آیدی پشتیبانی را ذکر می‌کند.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.replyInGroup}
                onChange={(e) => handleStrategy2Toggle('replyInGroup', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-sky-600 bg-slate-900 border-slate-700 focus:ring-sky-500"
              />
            </div>

            {/* 1.1. Interactive Conversational Reply to Group Members */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-cyan-500/30 ring-1 ring-cyan-500/20 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">
                    پاسخ به ریپلای‌های گروه (مکالمه زنده)
                  </span>
                  <span className="text-[9px] bg-cyan-500/30 text-cyan-200 px-1.5 py-0.2 rounded font-bold">
                    تعاملی و فروش
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  اگر کاربری در گروه به پیام یا ریپلای ربات پاسخ دهد، ربات با او وارد گفتگوی کوتاه شده، به سوالاتش (قیمت، کیفیت، پینگ، تست) جواب می‌دهد و او را تشویق به تست و خرید می‌کند.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.replyToUserRepliesInGroup !== false}
                onChange={(e) => handleStrategy2Toggle('replyToUserRepliesInGroup', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-cyan-600 bg-slate-900 border-slate-700 focus:ring-cyan-500"
              />
            </div>

            {/* 1.1.B. Anonymous Chat Automation Engine in Groups */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-950 border border-indigo-500/40 ring-1 ring-indigo-500/30 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">
                      موتور مکالمه هوشمند چت ناشناس در گروه
                    </span>
                    <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded font-bold">
                      الگوریتم پیشرفته
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    استفاده از الگوریتم و هوش هیجانی اتوماسیون چت ناشناس برای مکالمه طبیعی، تشخیص نیت کاربر، رفع ابهامات و هدایت به محصول.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.strategy2.useAnonymousEngineInGroup !== false}
                  onChange={(e) => handleStrategy2Toggle('useAnonymousEngineInGroup', e.target.checked)}
                  className="w-4 h-4 mt-1 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500"
                />
              </div>

              {/* Strategy Mode Selector */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[10px] text-indigo-300 font-bold">
                  استراتژی مکالمه موتور:
                </span>
                <select
                  value={config.strategy2.anonymousEngineStrategy || 'direct_pitch'}
                  onChange={(e) => handleStrategy2Toggle('anonymousEngineStrategy', e.target.value)}
                  className="text-xs bg-slate-900 border border-indigo-500/40 text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="direct_pitch">معرفی مستقیم و تست رایگان (پیش‌فرض)</option>
                  <option value="curiosity_hook">ایجاد کنجکاوی و سوال</option>
                  <option value="problem_agitation">همدردی با قطعی نت و ارائه راه‌حل</option>
                  <option value="friend_recommendation">پیشنهاد دوستانه و تجربه شخصی</option>
                </select>
              </div>
            </div>

            {/* 1.1.C. Guaranteed Reply-Only Mode */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-950 border border-emerald-500/40 ring-1 ring-emerald-500/30 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    ارسال ۱۰۰٪ به صورت ریپلای (تضمین دیده شدن)
                  </span>
                  <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 rounded font-bold">
                    ریپلای الزامی
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  تمام پیام‌های ربات در گروه‌ها دقیقاً روی پیام کاربر نیازمند یا ریپلای‌کننده ریپلای می‌شوند تا در ترافیک و شلوغی بالای پیام‌های گروه گم نشوند.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.groupReplyAlwaysWithReply !== false}
                onChange={(e) => handleStrategy2Toggle('groupReplyAlwaysWithReply', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
              />
            </div>

            {/* 1.2. Ultra-short Human Chat Style */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-amber-500/30 ring-1 ring-amber-500/20 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    سبک چت فوق‌کوتاه و انسانی
                  </span>
                  <span className="text-[9px] bg-amber-500/30 text-amber-200 px-1.5 py-0.2 rounded font-bold">
                    مشابه چت ناشناس (۳ تا ۷ کلمه)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  پاسخ‌های ارسالی ربات در گروه بسیار کوتاه، محاوره‌ای و بدون علائم نگارشی سنگین است تا دقیقاً مثل یک کاربر عادی پای گوشی به نظر برسد.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.humanChatStyleInGroup !== false}
                onChange={(e) => handleStrategy2Toggle('humanChatStyleInGroup', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-amber-600 bg-slate-900 border-slate-700 focus:ring-amber-500"
              />
            </div>

            {/* 1.5. Group Reply Banner */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-sky-500/30 ring-1 ring-sky-500/20 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">
                    ارسال عکس/بنر بعد از ریپلای گروه
                  </span>
                  <span className="text-[9px] bg-sky-500/30 text-sky-200 px-1.5 py-0.2 rounded font-bold">
                    تعرفه‌ها
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  پس از ارسال توضیحات ریپلای، تصویر بنر پلن‌ها همراه با آیدی پشتیبانی با مکث کوتاه در گروه ارسال می‌شود.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.sendBannerInGroupReply !== false}
                onChange={(e) => handleStrategy2Toggle('sendBannerInGroupReply', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-sky-600 bg-slate-900 border-slate-700 focus:ring-sky-500"
              />
            </div>

            {/* 2.0. Direct Outbound Message to PV (Disabled per user choice) */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-purple-500/30 ring-1 ring-purple-500/20 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">
                    ارسال پیام به پی‌وی لیدها (پیام خصوصی)
                  </span>
                  {!config.strategy2.sendDirectMessage ? (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                      غیرفعال (تمرکز ۱۰۰٪ روی ریپلای گروه)
                    </span>
                  ) : (
                    <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded font-bold">
                      فعال
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ارسال پیام به پی‌وی شخص نیازمند؛ با توجه به اینکه ریپلای گروه عملکرد کافی و مطلوبی دارد، این گزینه غیرفعال است تا اکانت‌ها محدود نشوند.
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(config.strategy2.sendDirectMessage)}
                onChange={(e) => handleStrategy2Toggle('sendDirectMessage', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-purple-600 bg-slate-900 border-slate-700 focus:ring-purple-500"
              />
            </div>

            {/* 2. Multi-Bubble PV DM */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-purple-500/30 ring-1 ring-purple-500/20 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">
                    پیام‌های پی‌وی بصورت حباب‌های مجزا
                  </span>
                  <span className="text-[9px] bg-purple-500/30 text-purple-200 px-1.5 py-0.2 rounded font-bold">
                    مشابه چت ناشناس
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ارسال پیام سلام جدا، اشاره به گروه جدا، معرفی تجربی کوتاه محصول جدا و آیدی پشتیبانی مجزا با شبیه‌سازی تایپینگ طبیعی انسان.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.multiBubblePv !== false}
                onChange={(e) => handleStrategy2Toggle('multiBubblePv', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-purple-600 bg-slate-900 border-slate-700 focus:ring-purple-500"
              />
            </div>

            {/* 3. Inbound PV Auto-Responder */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/30 ring-1 ring-emerald-500/20 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    پاسخگویی به پاسخ‌های پی‌وی
                  </span>
                  <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 rounded font-bold">
                    پشتیبانی خودکار
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ربات تمام پیام‌های دریافتی از کاربران در پی‌وی را خوانده، سوالات آنها را پاسخ داده و نهایتاً به پشتیبانی معرفی می‌کند.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.autoReplyInboundPv !== false}
                onChange={(e) => handleStrategy2Toggle('autoReplyInboundPv', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
              />
            </div>

            {/* 4. Send Banner in PV */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-pink-400" />
                  ارسال بنر تصویری در پی‌وی
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  عکس بنر تعرفه‌ها بصورت پیام تصویری مجزا همراه با کپشن کوتاه ارسال می‌شود تا توجه کاربر جلب گردد.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.sendBannerInDirectMessage}
                onChange={(e) => handleStrategy2Toggle('sendBannerInDirectMessage', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-pink-600 bg-slate-900 border-slate-700 focus:ring-pink-500"
              />
            </div>

            {/* 5. Casual Friend Style Tone */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  لحن صمیمی و فرد معمولی
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  پرهیز از پیام‌های بلند و رباتیک؛ صحبت کوتاه و دوستانه به شکلی که کاربر حس کند از طرف یک دوست معرفی شده است.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.friendStylePvTone}
                onChange={(e) => handleStrategy2Toggle('friendStylePvTone', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-amber-600 bg-slate-900 border-slate-700 focus:ring-amber-500"
              />
            </div>

            {/* 6. Support Contact Handle */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                آیدی تلگرام پشتیبانی
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                آیدی که ربات در پیام‌ها و پاسخ‌های پی‌وی به کاربران معرفی می‌کند:
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  dir="ltr"
                  value={supportContactInput}
                  onChange={(e) => setSupportContactInput(e.target.value)}
                  onBlur={handleSaveSupportContact}
                  placeholder="@Nova_vpn10"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono focus:outline-none focus:border-sky-500 text-left"
                />
                <button
                  type="button"
                  onClick={handleSaveSupportContact}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white"
                >
                  ذخیره
                </button>
              </div>
            </div>

            {/* 7. Never Repeat PV to Same User (Lifetime Anti-Report Shield) */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/40 ring-1 ring-emerald-500/20 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    سپر ضد ریپورت: عدم تکرار پی‌وی به کاربر
                  </span>
                  <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 rounded font-bold">
                    مادام‌العمر
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  تضمین قطعی اینکه به هیچ کاربری در طول عمر ربات بیش از یک بار در پی‌وی پیام داده نشود تا از نارضایتی و گزارش تخلف (Report) توسط کاربر به طور کامل جلوگیری شود.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.neverRepeatPvToSameUser !== false}
                onChange={(e) => handleStrategy2Toggle('neverRepeatPvToSameUser', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
              />
            </div>

            {/* 8. Live Telegram Server History Check */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/40 ring-1 ring-emerald-500/20 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    استعلام زنده سابقه چت از سرور تلگرام
                  </span>
                  <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 rounded font-bold">
                    استعلام پیش از ارسال
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  قبل از شروع ارسال در پی‌وی، تاریخچه گفتگوی اکانت با مخاطب در سرور تلگرام استعلام می‌شود؛ در صورت داشتن هرگونه چت قبلی، ارسال پی‌وی لغو می‌شود.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.strategy2.checkTelegramHistoryBeforePv !== false}
                onChange={(e) => handleStrategy2Toggle('checkTelegramHistoryBeforePv', e.target.checked)}
                className="w-4 h-4 mt-1 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
              />
            </div>

          </div>

          {/* Advanced Keywords Hub Section */}
          <div className="bg-slate-950/80 border border-purple-500/30 rounded-2xl p-5 space-y-4 shadow-xl shadow-purple-950/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>کلیدواژه‌های ردیابی و شنود پیام‌ها</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-mono font-bold border border-purple-500/30">
                      {config.strategy2.keywords.length} کلیدواژه فعال
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    شامل فیلترشکن، ترید و صرافی، اینستاگرام، یوتیوب، هوش مصنوعی، گیمینگ، پینگ و اختلالات نت
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaultKeywords}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-700/80 flex items-center gap-1.5"
                  title="بازیابی تمام ۱۴۶ کلیدواژه پیش‌فرض استاندارد"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                  <span>بازیابی کلیدواژه‌های پیش‌فرض (۱۴۶ مورد)</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>همه</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                  {config.strategy2.keywords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('vpn')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'vpn'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-slate-900 text-purple-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>🛡️ فیلترشکن و سرور</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-950/80 text-purple-200 font-mono">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'vpn').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('trading')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'trading'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-amber-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>📈 ترید و کریپتو و صرافی</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/80 text-amber-200 font-mono">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'trading').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('social')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'social'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                    : 'bg-slate-900 text-rose-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>💬 اینستاگرام و سوشال</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-950/80 text-rose-200 font-mono">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'social').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('ai')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'ai'
                    ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-500/20'
                    : 'bg-slate-900 text-fuchsia-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>🤖 هوش مصنوعی (ChatGPT, Gemini)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-fuchsia-950/80 text-fuchsia-200 font-mono">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'ai').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('gaming')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'gaming'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 text-emerald-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>🎮 گیمینگ، پینگ و سرور</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-200 font-mono">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'gaming').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('speed')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'speed'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 text-cyan-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>⚡ اختلال و قطعی اینترنت</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-200 font-mono">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'speed').length}
                </span>
              </button>
            </div>

            {/* Search and Add Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={keywordSearchTerm}
                  onChange={(e) => setKeywordSearchTerm(e.target.value)}
                  placeholder="جستجو در بین کلیدواژه‌های فعال (مثلاً: ترید، اینستا، پینگ، vmess)..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                {keywordSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setKeywordSearchTerm('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="md:col-span-7 flex items-center gap-2">
                <input
                  type="text"
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="افزودن کلمه کلیدی دلخواه جدید..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن کلمه</span>
                </button>
              </div>
            </div>

            {/* Quick Presets Batch Add */}
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
              <span className="text-[11px] text-slate-400 font-bold shrink-0">افزودن دسته‌ای بسته‌های کلیدواژه:</span>
              {KEYWORD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleAddCategoryKeywords(preset.keywords)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-500/50 text-slate-300 hover:text-purple-200 text-[11px] font-medium transition-all flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-purple-400" />
                  <span>{preset.title}</span>
                </button>
              ))}
            </div>

            {/* Keywords tags badges list */}
            <div className="border border-slate-800/80 rounded-xl p-3 bg-slate-900/50 max-h-56 overflow-y-auto space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {config.strategy2.keywords
                  .filter((kw) => {
                    const matchesSearch = !keywordSearchTerm.trim() || kw.toLowerCase().includes(keywordSearchTerm.trim().toLowerCase());
                    if (!matchesSearch) return false;
                    if (keywordCategoryFilter === 'all') return true;
                    return classifyKeyword(kw).category === keywordCategoryFilter;
                  })
                  .map((kw) => {
                    const info = classifyKeyword(kw);
                    return (
                      <span
                        key={kw}
                        className={`inline-flex items-center gap-1.5 border px-2.5 py-1 rounded-lg text-xs font-medium transition-all group ${info.badgeColor}`}
                      >
                        <span className="font-sans">{kw}</span>
                        <span className="text-[9px] opacity-70 px-1 rounded bg-black/20">{info.label.split(' ')[0]}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(kw)}
                          className="opacity-60 hover:opacity-100 hover:text-rose-400 font-bold transition-colors pr-0.5"
                          title="حذف این کلمه"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
              </div>

              {config.strategy2.keywords.filter((kw) => {
                const matchesSearch = !keywordSearchTerm.trim() || kw.toLowerCase().includes(keywordSearchTerm.trim().toLowerCase());
                if (!matchesSearch) return false;
                if (keywordCategoryFilter === 'all') return true;
                return classifyKeyword(kw).category === keywordCategoryFilter;
              }).length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  هیچ کلمه کلیدی با فیلتر یا جستجوی وارد شده یافت نشد.
                </div>
              )}
            </div>
          </div>

          {/* Speed Presets & Responsiveness Optimizer (Suggestion 1) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white">
                  پروفایل‌های سرعت و واکنش‌گرایی شنود (پیشنهاد ۱ - بهینه‌سازی کول‌داون و سرعت)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400">
                تنظیم فوری پارامترهای تاخیر و سقف پاسخ‌دهی
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleApplySpeedPreset('turbo')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                  config.strategy2.scannerPresetMode === 'turbo'
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold">⚡ فوق‌سریع (Turbo)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    وقفه ۱ دقیقه | سقف ۱۵ پاسخ/ساعت | تاخیر ۲ ثانیه
                  </p>
                </div>
                {config.strategy2.scannerPresetMode === 'turbo' && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleApplySpeedPreset('balanced')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                  config.strategy2.scannerPresetMode === 'balanced'
                    ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-bold">⚖️ متعادل (Balanced)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    وقفه ۲ دقیقه | سقف ۸ پاسخ/ساعت | تاخیر ۳ ثانیه
                  </p>
                </div>
                {config.strategy2.scannerPresetMode === 'balanced' && (
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleApplySpeedPreset('safe')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                  config.strategy2.scannerPresetMode === 'safe'
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold">🛡️ محافظه‌کار (Safe)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    وقفه ۵ دقیقه | سقف ۴ پاسخ/ساعت | تاخیر ۵ ثانیه
                  </p>
                </div>
                {config.strategy2.scannerPresetMode === 'safe' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Skip Locked & Dead Groups Section (Suggestion 3) */}
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">
                    رد کردن هوشمند گروه‌های قفل‌شده یا فقط‌ادمین (پیشنهاد ۳ - تمرکز ۱۰۰٪ روی گروه‌های باز)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    جلوگیری از اتلاف دور موتور شنود روی گروه‌هایی که امکان ارسال پیام در آن‌ها وجود ندارد
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.strategy2.autoSkipLockedRestrictedGroups !== false}
                  onChange={(e) => handleStrategy2Toggle('autoSkipLockedRestrictedGroups', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300 font-bold text-[11px]">گروه‌های فعال و ۱۰۰٪ باز برای شنود و ارسال:</span>
                </div>
                <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-bold text-xs">
                  {groups.filter(g => g.isActive && (g.status === 'joined' || g.membershipStatus === 'joined' || (g.joinedAccountIds && g.joinedAccountIds.length > 0)) && g.canSendMessages !== false && g.readinessStatus !== 'no_permission_left').length} گروه
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-300 font-bold text-[11px]">گروه‌های قفل / نیازمند دسترسی ادمین (اسکیپ):</span>
                </div>
                <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-bold text-xs">
                  {groups.filter(g => g.isActive && (g.canSendMessages === false || g.readinessStatus === 'no_permission_left' || g.membershipStatus === 'restricted' || g.status === 'failed')).length} گروه
                </span>
              </div>
            </div>
          </div>

          {/* Delay & Safety Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="text-[11px] text-slate-300 font-bold block">
                تاخیر قبل از ریپلای در گروه:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={config.strategy2.groupReplyDelaySeconds || 2}
                  onChange={(e) => handleStrategy2Toggle('groupReplyDelaySeconds', Math.max(1, parseInt(e.target.value, 10) || 2))}
                  className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center text-xs font-bold text-white"
                />
                <span className="text-xs text-slate-400">ثانیه</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-sky-500/30 space-y-2">
              <label className="text-[11px] text-sky-300 font-bold block">
                وقفه بین ریپلای در ۱ گروه:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={config.strategy2.groupCooldownMinutes ?? 2}
                  onChange={(e) => handleStrategy2Toggle('groupCooldownMinutes', Math.max(1, parseInt(e.target.value, 10) || 2))}
                  className="w-16 bg-slate-900 border border-sky-500/40 rounded-lg p-1.5 text-center text-xs font-bold text-white"
                />
                <span className="text-xs text-slate-400">دقیقه</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-amber-500/30 space-y-2">
              <label className="text-[11px] text-amber-300 font-bold block">
                سقف پاسخ در گروه در ساعت:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={config.strategy2.maxRepliesPerGroupPerHour || 10}
                  onChange={(e) => handleStrategy2Toggle('maxRepliesPerGroupPerHour', Math.max(1, parseInt(e.target.value, 10) || 10))}
                  className="w-16 bg-slate-900 border border-amber-500/40 rounded-lg p-1.5 text-center text-xs font-bold text-white"
                />
                <span className="text-xs text-slate-400">ریپلای/ساعت</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="text-[11px] text-slate-300 font-bold block">
                تاخیر شروع پی‌وی:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={config.strategy2.pvMessageDelaySeconds || 4}
                  onChange={(e) => handleStrategy2Toggle('pvMessageDelaySeconds', Math.max(2, parseInt(e.target.value, 10) || 4))}
                  className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center text-xs font-bold text-white"
                />
                <span className="text-xs text-slate-400">ثانیه</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-purple-500/30 space-y-2">
              <label className="text-[11px] text-purple-300 font-bold block">
                فاصله بین حباب‌های پیام:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={config.strategy2.multiBubbleDelaySeconds || 1.5}
                  onChange={(e) => handleStrategy2Toggle('multiBubbleDelaySeconds', Math.max(1, parseFloat(e.target.value) || 1.5))}
                  className="w-16 bg-slate-900 border border-purple-500/40 rounded-lg p-1.5 text-center text-xs font-bold text-white"
                />
                <span className="text-xs text-slate-400">ثانیه</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="text-[11px] text-slate-300 font-bold block">
                کول‌داون پیام به کاربر:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={config.strategy2.userCooldownHours || 24}
                  onChange={(e) => handleStrategy2Toggle('userCooldownHours', Math.max(1, parseInt(e.target.value, 10) || 24))}
                  className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center text-xs font-bold text-white"
                />
                <span className="text-xs text-slate-400">ساعت</span>
              </div>
            </div>

          </div>

          {/* Live Multi-Bubble Telegram Send Test Box */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-950 to-slate-950 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-white">
                  تست زنده ارسال حباب‌های پیام به اکانت تلگرام شما
                </h4>
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                ارسال واقعی در تلگرام
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              پیام‌های حبابی تفکیک‌شده (سلام جدا، پیام گروه جدا، معرفی تجربی کوتاه و آیدی پشتیبانی + بنر) را به آیدی تلگرام دلخواه بفرستید تا دقیقاً نحوه نمایش در تلگرام را بررسی فرمایید:
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2 flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:border-indigo-500">
                <span className="text-xs text-slate-500 font-mono">@</span>
                <input
                  type="text"
                  dir="ltr"
                  value={testTargetUsername}
                  onChange={(e) => setTestTargetUsername(e.target.value.replace(/^@/, ''))}
                  placeholder="TelegramUsername"
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTestPv}
                disabled={isSendingTestPv || !testTargetUsername.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-indigo-600/20"
              >
                {isSendingTestPv ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال شبیه‌سازی تایپینگ و ارسال حباب‌ها...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>ارسال پیام‌های حبابی تستی</span>
                  </>
                )}
              </button>
            </div>

            {testPvResult && (
              <div className="bg-slate-900/90 border border-indigo-500/40 rounded-xl p-3.5 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {testPvResult.message || 'پیام‌های حبابی با موفقیت به تلگرام ارسال شدند.'}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {testPvResult.bubblesCount || 4} حباب مجزا
                  </span>
                </div>

                {testPvResult.bubbles && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-slate-400">حباب‌های ارسال‌شده به تلگرام:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {testPvResult.bubbles.map((b: string, idx: number) => (
                        <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-200">
                          <span className="text-[9px] text-indigo-400 block mb-0.5 font-bold">حباب {idx + 1}:</span>
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interactive Simulation & Test Panel */}
          <div className="bg-gradient-to-br from-purple-950/30 via-slate-950 to-slate-950 border border-purple-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white">
                  شبیه‌ساز و تست زنده پاسخ هوشمند استراتژی ۲
                </h4>
              </div>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                تست بدون ارسال به تلگرام
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              یک متن پیام کاربر را وارد کنید تا ببینید سیستم چطور تقاضا را تشخیص می‌دهد، چه پاسخی در گروه ریپلای می‌زند و چه پیام دوستانه‌ای در قالب حباب‌های مجزا به پی‌وی می‌فرستد:
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={customTestMessage}
                onChange={(e) => setCustomTestMessage(e.target.value)}
                placeholder="متن پیام فرضی کاربر در گروه..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={isSimulating || !customTestMessage.trim()}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>تحلیل و شبیه‌سازی...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>شبیه‌سازی و مشاهده خروجی</span>
                  </>
                )}
              </button>
            </div>

            {/* Simulation Results Display */}
            {simulationResult && (
              <div className="bg-slate-900/90 border border-purple-500/40 rounded-xl p-4 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓ لید با موفقیت شناسایی شد:</span>
                    <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-bold">
                      {simulationResult.detectedCategory}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    کلمات کلیدی: {simulationResult.detectedKeywords?.join('، ') || 'ندارد'}
                  </span>
                </div>

                {/* 1. Group Reply Preview */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    پاسخ ریپلای در گروه (Group Reply):
                  </span>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed">
                    {simulationResult.groupReplyText}
                  </div>
                </div>

                {/* 2. PV Multi-Bubble Messages Preview */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    پیام‌های ارسالی به پی‌وی بصورت حباب‌های مجزا (مشابه چت ناشناس و انسان):
                  </span>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                    {/* Display separated speech bubbles */}
                    <div className="space-y-2 max-w-lg">
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tr-sm p-2.5 text-xs text-slate-200 inline-block shadow-sm">
                        <span className="text-[10px] text-purple-400 block font-bold mb-0.5">حباب ۱ (سلام و احوالپرسی کوتاه):</span>
                        سلام وقتت بخیر باشه
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tr-sm p-2.5 text-xs text-slate-200 inline-block shadow-sm">
                        <span className="text-[10px] text-sky-400 block font-bold mb-0.5">حباب ۲ (اشاره طبیعی به پیام گروه):</span>
                        پیامت رو الان توی گروه دیدم درمورد فیلترشکن و قطعی نت گفته بودی
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tr-sm p-2.5 text-xs text-slate-200 inline-block shadow-sm">
                        <span className="text-[10px] text-amber-400 block font-bold mb-0.5">حباب ۳ (معرفی صمیمی و تجربی سرویس):</span>
                        من خودم چند وقته اشتراک Nova VPN رو گرفتم، روی همه اپراتورا حتی همراه اول و ایرانسل با سرعت بالا بدون قطعی وصله
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tr-sm p-2.5 text-xs text-slate-200 inline-block shadow-sm">
                        <span className="text-[10px] text-emerald-400 block font-bold mb-0.5">حباب ۴ (معرفی آیدی پشتیبانی):</span>
                        خواستی به پشتیبانیشون پیام بده راهنماییت میکنن: {config.strategy2.supportContactHandle || '@Nova_vpn10'}
                      </div>
                    </div>

                    {activeCampaign?.imageUrl && (
                      <div className="pt-2 flex items-center gap-2 text-[11px] text-purple-400 border-t border-slate-800/80">
                        <ImageIcon className="w-4 h-4" />
                        <span>همراه با ارسال فایل تصویر بنر تبلیغاتی محصول ({activeCampaign.title})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PANEL: DEDICATED KEYWORDS HUB (مرکز جامع کلیدواژه‌های شنود هوشمند) */}
      {/* ========================================================================= */}
      {selectedSubTab === 'keywords' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6 animate-in fade-in duration-200">
          
          {/* Header & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>بانک و مرکز جامع کلیدواژه‌های شنود و دیده‌بانی</span>
                    <span className="text-xs bg-purple-600 text-white px-2.5 py-0.5 rounded-full font-mono font-bold shadow-md shadow-purple-500/30">
                      {config.strategy2.keywords.length} کلیدواژه فعال در سیستم
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ربات تمام پیام‌های گروه‌ها را با این کلمات تطبیق داده و در صورت شناسایی تقاضا، ریپلای در گروه و پیام شخصی در پی‌وی ارسال می‌کند.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaultKeywords}
                className="px-3.5 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 hover:text-white text-xs font-bold transition-all border border-purple-800/80 flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                <span>بازیابی تمام ۱۴۶ کلمه پیش‌فرض استاندارد</span>
              </button>
            </div>
          </div>

          {/* Category Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              type="button"
              onClick={() => setKeywordCategoryFilter('vpn')}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                keywordCategoryFilter === 'vpn'
                  ? 'bg-purple-900/40 border-purple-500 ring-2 ring-purple-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-purple-300 font-bold">🛡️ فیلترشکن</span>
                <span className="text-[10px] bg-purple-950 px-1.5 py-0.2 rounded font-mono font-bold text-purple-200">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'vpn').length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">VPN، پروکسی، V2Ray و کانفیگ</p>
            </button>

            <button
              type="button"
              onClick={() => setKeywordCategoryFilter('trading')}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                keywordCategoryFilter === 'trading'
                  ? 'bg-amber-900/40 border-amber-500 ring-2 ring-amber-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-amber-300 font-bold">📈 ترید و فارکس</span>
                <span className="text-[10px] bg-amber-950 px-1.5 py-0.2 rounded font-mono font-bold text-amber-200">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'trading').length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">TradingView، بایننس، صرافی، IP ثابت</p>
            </button>

            <button
              type="button"
              onClick={() => setKeywordCategoryFilter('social')}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                keywordCategoryFilter === 'social'
                  ? 'bg-rose-900/40 border-rose-500 ring-2 ring-rose-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-rose-300 font-bold">💬 سوشال مدیا</span>
                <span className="text-[10px] bg-rose-950 px-1.5 py-0.2 rounded font-mono font-bold text-rose-200">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'social').length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">اینستاگرام، یوتیوب، توییتر و تیک‌تاک</p>
            </button>

            <button
              type="button"
              onClick={() => setKeywordCategoryFilter('ai')}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                keywordCategoryFilter === 'ai'
                  ? 'bg-fuchsia-900/40 border-fuchsia-500 ring-2 ring-fuchsia-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-fuchsia-300 font-bold">🤖 هوش مصنوعی</span>
                <span className="text-[10px] bg-fuchsia-950 px-1.5 py-0.2 rounded font-mono font-bold text-fuchsia-200">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'ai').length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">ChatGPT, Claude, Gemini, Midjourney</p>
            </button>

            <button
              type="button"
              onClick={() => setKeywordCategoryFilter('gaming')}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                keywordCategoryFilter === 'gaming'
                  ? 'bg-emerald-900/40 border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-emerald-300 font-bold">🎮 گیم و پینگ</span>
                <span className="text-[10px] bg-emerald-950 px-1.5 py-0.2 rounded font-mono font-bold text-emerald-200">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'gaming').length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">کالاف، وارزون، ولورانت، پکت‌لاس، سرور</p>
            </button>

            <button
              type="button"
              onClick={() => setKeywordCategoryFilter('speed')}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                keywordCategoryFilter === 'speed'
                  ? 'bg-cyan-900/40 border-cyan-500 ring-2 ring-cyan-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-cyan-300 font-bold">⚡ قطعی و سرعت</span>
                <span className="text-[10px] bg-cyan-950 px-1.5 py-0.2 rounded font-mono font-bold text-cyan-200">
                  {config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'speed').length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">نت قطع شده، وصل نمیشه، کندی نت</p>
            </button>
          </div>

          {/* Search, Filter and Add Box */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>نمایش همه ({config.strategy2.keywords.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('vpn')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'vpn'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-slate-900 text-purple-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>🛡️ فیلترشکن و سرور ({config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'vpn').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('trading')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'trading'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-amber-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>📈 ترید و فارکس ({config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'trading').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('social')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'social'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                    : 'bg-slate-900 text-rose-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>💬 سوشال مدیا ({config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'social').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('ai')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'ai'
                    ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-500/20'
                    : 'bg-slate-900 text-fuchsia-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>🤖 هوش مصنوعی ({config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'ai').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('gaming')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'gaming'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 text-emerald-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>🎮 گیمینگ و پینگ ({config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'gaming').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordCategoryFilter('speed')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  keywordCategoryFilter === 'speed'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 text-cyan-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>⚡ اختلال و سرعت ({config.strategy2.keywords.filter(k => classifyKeyword(k).category === 'speed').length})</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={keywordSearchTerm}
                  onChange={(e) => setKeywordSearchTerm(e.target.value)}
                  placeholder="جستجو در بین کلیدواژه‌های فعال (مثلاً: ترید، اینستا، پینگ، vmess)..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                {keywordSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setKeywordSearchTerm('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="md:col-span-7 flex items-center gap-2">
                <input
                  type="text"
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="افزودن کلمه کلیدی دلخواه جدید..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن کلمه</span>
                </button>
              </div>
            </div>

            {/* Presets Quick Injection */}
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-1 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-bold shrink-0">افزودن دسته‌ای بسته‌های کلیدواژه:</span>
              {KEYWORD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleAddCategoryKeywords(preset.keywords)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-500/50 text-slate-300 hover:text-purple-200 text-[11px] font-medium transition-all flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-purple-400" />
                  <span>{preset.title}</span>
                </button>
              ))}
            </div>

            {/* Keyword Pills Cloud */}
            <div className="border border-slate-800/80 rounded-xl p-4 bg-slate-900/50 max-h-96 overflow-y-auto space-y-2">
              <div className="flex flex-wrap gap-2">
                {config.strategy2.keywords
                  .filter((kw) => {
                    const matchesSearch = !keywordSearchTerm.trim() || kw.toLowerCase().includes(keywordSearchTerm.trim().toLowerCase());
                    if (!matchesSearch) return false;
                    if (keywordCategoryFilter === 'all') return true;
                    return classifyKeyword(kw).category === keywordCategoryFilter;
                  })
                  .map((kw) => {
                    const info = classifyKeyword(kw);
                    return (
                      <span
                        key={kw}
                        className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-xl text-xs font-medium transition-all group shadow-sm ${info.badgeColor}`}
                      >
                        <span className="font-sans font-medium">{kw}</span>
                        <span className="text-[9px] opacity-75 px-1.5 py-0.5 rounded bg-black/30 font-bold">{info.label}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(kw)}
                          className="opacity-50 hover:opacity-100 hover:text-rose-400 font-bold transition-colors pr-0.5 text-sm"
                          title="حذف این کلمه"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
              </div>

              {config.strategy2.keywords.filter((kw) => {
                const matchesSearch = !keywordSearchTerm.trim() || kw.toLowerCase().includes(keywordSearchTerm.trim().toLowerCase());
                if (!matchesSearch) return false;
                if (keywordCategoryFilter === 'all') return true;
                return classifyKeyword(kw).category === keywordCategoryFilter;
              }).length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  هیچ کلمه کلیدی با این جستجو یا فیلتر دسته‌بندی یافت نشد.
                </div>
              )}
            </div>
          </div>

          {/* Interactive Tester & Live Keyword Matcher */}
          <div className="bg-gradient-to-br from-purple-950/30 via-slate-950 to-slate-950 border border-purple-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">
                  آزمایش و شبیه‌ساز زنده تطبیق کلمات کلیدی (Real-Time Keyword Matcher)
                </h4>
              </div>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                تست بدون ارسال
              </span>
            </div>

            <p className="text-xs text-slate-400">
              یک متن پیام کاربر (مثلا در مورد ترید، اینستا، پینگ گیمینگ یا ChatGPT) تایپ کنید تا فوراً نحوه شناسایی کلمات و دسته‌بندی را مشاهده نمایید:
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={customTestMessage}
                onChange={(e) => setCustomTestMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunSimulation()}
                placeholder="متن پیام کاربر در گروه را اینجا بنویسید..."
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>بررسی تطبیق کلمات</span>
              </button>
            </div>

            {simulationResult && (
              <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>نتیجه تحلیل هوشمند: {simulationResult.isLead ? '✅ لید و مشتری بالقوه شناسایی شد' : '❌ بدون تقاضا'}</span>
                  </span>
                  <span className="text-[11px] bg-purple-950 text-purple-200 px-2 py-0.5 rounded-full font-bold">
                    دسته‌بندی: {simulationResult.detectedCategory}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold">کلمات کلیدی منطبق شده:</span>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {simulationResult.matchedKeywords && simulationResult.matchedKeywords.length > 0 ? (
                        simulationResult.matchedKeywords.map((k: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-xs border border-purple-500/30">
                            {k}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">کلمه کلیدی خاصی در متن یافت نشد</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold">پاسخ پیشنهادی جهت ریپلای گروه:</span>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">{simulationResult.groupReplyText || 'بدون پاسخ گروهی'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PANEL: INBOUND PV CONVERSATIONS & SUPPORT HANDOFF */}
      {/* ========================================================================= */}
      {selectedSubTab === 'inbound' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6 animate-in fade-in duration-200">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  سامانه پاسخگویی خودکار به پی‌وی و پشتیبانی هوشمند (Inbound PV Engine)
                </h3>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                  config.strategy2.autoReplyInboundPv !== false
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {config.strategy2.autoReplyInboundPv !== false ? '● آماده شنود و پاسخگویی آنی' : '○ متوقف شده (دستی)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ربات پیام‌های کاربران در پی‌وی را بلافاصله دریافت کرده و با هوش مصنوعی دوستانه، سوالات آنها را پاسخ داده و به پشتیبانی هدایت می‌کند.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {config.inboundPvConversations && config.inboundPvConversations.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('آیا از پاکسازی گفتگوهای ورودی مطمئن هستید؟')) {
                      await fetch('/api/strategy/strategy2/clear-inbound-conversations', { method: 'POST' });
                      if (onUpdateStrategyConfig) {
                        await onUpdateStrategyConfig({ inboundPvConversations: [] });
                      }
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 shrink-0 px-2 py-1 rounded bg-slate-950 border border-slate-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>پاکسازی تاریخچه</span>
                </button>
              )}
            </div>
          </div>

          {/* MASTER TOGGLE & ISOLATION SAFETY CONTROLS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Master PV Auto-Reply Switch */}
            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              config.strategy2.autoReplyInboundPv !== false
                ? 'bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
                : 'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-bold text-white">
                      کنترل دستی پاسخگویی خودکار به پی‌وی
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    با این کلید می‌توانید در هر لحظه پاسخگویی خودکار ربات به پی‌وی را فعال یا غیرفعال کنید.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleMasterPvReply(config.strategy2.autoReplyInboundPv === false)}
                  disabled={isTogglingPvMaster}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                    config.strategy2.autoReplyInboundPv !== false
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 hover:bg-emerald-400 font-black shadow-md shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Power className={`w-4 h-4 ${isTogglingPvMaster ? 'animate-spin' : ''}`} />
                  <span>{config.strategy2.autoReplyInboundPv !== false ? 'روشن (فعال)' : 'خاموش (دستی)'}</span>
                </button>
              </div>

              {/* Scope Selection */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 block">
                  دامنه پیام‌های ورودی پی‌وی برای پاسخگویی خودکار:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleChangeInboundPvScope('all_messages')}
                    className={`p-2 rounded-xl border text-right transition-all flex items-center justify-between ${
                      (config.strategy2.inboundPvScope || 'all_messages') === 'all_messages'
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="block text-[11px]">پاسخ به تمام پیام‌ها</span>
                      <span className="text-[10px] text-slate-400 font-normal">تست آنی و راهنمایی تمام پیام‌ها</span>
                    </div>
                    {(config.strategy2.inboundPvScope || 'all_messages') === 'all_messages' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangeInboundPvScope('product_inquiries_only')}
                    className={`p-2 rounded-xl border text-right transition-all flex items-center justify-between ${
                      config.strategy2.inboundPvScope === 'product_inquiries_only'
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="block text-[11px]">فقط استعلامات سرویس</span>
                      <span className="text-[10px] text-slate-400 font-normal">پیام‌های شخصی مسکوت می‌ماند</span>
                    </div>
                    {config.strategy2.inboundPvScope === 'product_inquiries_only' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Target Group Strict Isolation Shield */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-950 border border-indigo-500/30 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-bold text-white">
                      سپر ایزولاسیون ۱۰۰٪ امن گروه‌های هدف
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.2 rounded-full font-bold">
                      Strict Isolation
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    تضمین قطعی عدم مداخله در گروه‌های شخصی، کاری و خانوادگی شما:
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-xl p-3 border border-indigo-500/20 space-y-2 text-[11px] text-slate-300">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>تطبیق دقیق شناسه عددی با لیست گروه‌های هدف (Target Whitelist)</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-300 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>قفل کامل ارسال پیام به گروه‌ها برای اکانت شخصی</span>
                </div>
                <div className="flex items-center gap-2 text-purple-300 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>عدم شنود و نادیده‌گرفتن مطلق پیام‌ها در گروه‌های شخصی و ناشناس</span>
                </div>
              </div>
            </div>
          </div>

          {/* PER-ACCOUNT PV AUTO-REPLY STATUS & TOGGLES */}
          <div className="bg-slate-950 rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white">
                  وضعیت تفکیک‌شده اکانت‌ها برای پاسخگویی به پی‌وی و ایزولاسیون:
                </h4>
              </div>
              <span className="text-[10px] text-slate-400">کنترل آنی با یک کلیک</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(accounts || []).map((acc) => {
                const isPersonal = Boolean(acc.isPersonalAccount);
                const isPvEnabled = acc.enableForPvReply !== false;
                const isOperating = isTogglingAccountAction === acc.id;

                return (
                  <div
                    key={acc.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isPersonal
                        ? 'bg-purple-950/20 border-purple-500/40 ring-1 ring-purple-500/20'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isPersonal ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {isPersonal ? '🛡️' : '👤'}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">
                            {acc.userProfile?.firstName || acc.phoneNumber || acc.id}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono" dir="ltr">
                            {acc.phoneNumber}
                          </span>
                        </div>
                      </div>

                      {isPersonal && (
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-bold shrink-0">
                          اکانت شخصی
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">پاسخ به پی‌وی:</span>
                      <button
                        type="button"
                        onClick={() => handleAccountPvToggle(acc.id, isPvEnabled)}
                        disabled={isOperating}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border ${
                          isPvEnabled
                            ? 'bg-purple-500/20 text-purple-200 border-purple-500/40 hover:bg-purple-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <Power className={`w-3 h-3 ${isOperating ? 'animate-spin' : ''}`} />
                        <span>{isPvEnabled ? 'فعال (بات پاسخ می‌دهد)' : 'غیرفعال (شخصی)'}</span>
                      </button>
                    </div>

                    {isPersonal && (
                      <div className="mt-2 text-[10px] text-emerald-400/90 flex items-center gap-1 bg-emerald-950/20 rounded p-1 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>گروه‌های شخصی ۱۰۰٪ ایزوله و محافظت‌شده هستند.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">گفتگوهای ورودی پی‌وی</span>
              <div className="text-base font-black text-emerald-400 mt-1 font-mono">
                {(config.inboundPvConversations?.length || 0).toLocaleString('fa-IR')}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">کل پاسخ‌های ارسالی</span>
              <div className="text-base font-black text-sky-400 mt-1 font-mono">
                {(config.strategy2.totalInboundPvRepliesSent || 0).toLocaleString('fa-IR')}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">آیدی پشتیبانی متصل</span>
              <div className="text-xs font-bold text-indigo-400 mt-1 font-mono truncate" dir="ltr">
                {config.strategy2.supportContactHandle || '@Nova_vpn10'}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400">وضعیت پاسخ‌دهنده</span>
              <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>هوش مصنوعی فعال</span>
              </div>
            </div>
          </div>

          {/* Inbound Simulator / Test Box */}
          <div className="bg-gradient-to-br from-emerald-950/30 via-slate-950 to-slate-950 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white">
                  شبیه‌ساز و تست زنده پاسخ به پیام کاربر در پی‌وی
                </h4>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                تست هوش مصنوعی
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              یک سوال یا پاسخ احتمالی که ممکن است کاربر در پی‌وی بفرستد را وارد کنید تا ببینید سیستم چطور در قالب حباب‌های مجزا او را راهنمایی و به پشتیبانی معرفی می‌کند:
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={inboundTestInput}
                onChange={(e) => setInboundTestInput(e.target.value)}
                placeholder="مثال: قیمت اشتراک چنده؟ اکانت تست هم دارید؟"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleTestInboundReply}
                disabled={isInboundTesting || !inboundTestInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-emerald-600/20"
              >
                {isInboundTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>تولید پاسخ هوشمند...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>شبیه‌سازی پاسخ پی‌وی</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick pre-set test prompts */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-slate-500">سوالات آماده برای تست:</span>
              {[
                'قیمت اشتراک چنده؟',
                'برای آیفون هم کار میکنه؟ تست دارید؟',
                'روی همراه اول وصل میشه؟',
                'دمت گرم داداش ممنون',
                'نه ممنون نیازی ندارم',
              ].map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  onClick={() => setInboundTestInput(promptText)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] px-2.5 py-1 rounded-lg transition-colors"
                >
                  {promptText}
                </button>
              ))}
            </div>

            {/* Inbound Test Results Display */}
            {inboundTestResult && (
              <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    پاسخ هوشمند تولید شد ({inboundTestResult.bubbles?.length || 1} حباب پیام مجزا)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    هدف: راهنمایی و هدایت به {config.strategy2.supportContactHandle || '@Nova_vpn10'}
                  </span>
                </div>

                {/* User Message Bubble */}
                <div className="flex justify-start">
                  <div className="bg-sky-600/20 border border-sky-500/30 text-sky-200 text-xs px-3.5 py-2 rounded-2xl rounded-tr-sm max-w-md">
                    <span className="text-[10px] text-sky-400 block font-bold mb-0.5">پیام دریافتی از کاربر (امین):</span>
                    {inboundTestInput}
                  </div>
                </div>

                {/* Bot Response Bubbles */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] text-emerald-400 font-bold block">
                    پاسخ ربات (ارسال بصورت حباب‌های پشت‌سرهم با تایپینگ طبیعی):
                  </span>
                  <div className="space-y-1.5 max-w-lg">
                    {inboundTestResult.bubbles?.map((bubble: string, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-sm p-2.5 text-xs text-slate-200 shadow-sm"
                      >
                        <span className="text-[9px] text-emerald-400 block font-bold mb-0.5">
                          حباب {idx + 1}:
                        </span>
                        {bubble}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Conversations List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>تاریخچه گفتگوهای اخیر در پی‌وی</span>
            </h4>

            {config.inboundPvConversations && config.inboundPvConversations.length > 0 ? (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {config.inboundPvConversations.map((conv) => (
                  <div
                    key={conv.userId}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 hover:border-slate-700 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {conv.firstName || 'کاربر'} {conv.username ? `(@${conv.username})` : ''}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">ID: {conv.userId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                          {conv.status === 'handed_off' ? 'معرفی به پشتیبانی شد' : 'گفتگوی فعال'}
                        </span>
                        <span className="text-slate-400">
                          {new Date(conv.lastMessageAt).toLocaleTimeString('fa-IR')}
                        </span>
                      </div>
                    </div>

                    {/* Messages in Conversation */}
                    <div className="space-y-1.5 pt-1">
                      {conv.messages.slice(-4).map((msg) => (
                        <div
                          key={msg.id}
                          className={`text-xs p-2.5 rounded-xl ${
                            msg.sender === 'user'
                              ? 'bg-sky-950/40 border border-sky-900/40 text-sky-200 mr-4'
                              : 'bg-slate-900 border border-slate-800 text-slate-300 ml-4'
                          }`}
                        >
                          <span className="text-[10px] font-bold block mb-0.5 opacity-70">
                            {msg.sender === 'user' ? (conv.firstName || 'کاربر') : 'ربات'}:
                          </span>
                          {msg.text}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                <UserCheck className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-xs font-bold text-slate-300">هنوز گفتگوی خصوصی از طرف کاربران دریافت نشده است</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  هنگامی که ربات در پی‌وی به کاربران پیام می‌دهد، به محض پاسخ کاربر، ربات پیام را پردازش کرده و تاریخچه گفتگو اینجا نمایش داده می‌شود.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUB-PANEL: RECENT LEADS & ACTIVITY FEED */}
      {/* ========================================================================= */}
      {selectedSubTab === 'leads' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                فید زنده لیدها و متقاضیان شناسایی‌شده در گروه‌ها
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                گزارش شفاف کاربرانی که پیام مرتبط با فیلترشکن، اینترنت یا هوش مصنوعی ارسال کردند و وضعیت پاسخگویی
              </p>
            </div>

            {onClearLeads && config.recentLeads && config.recentLeads.length > 0 && (
              <button
                type="button"
                onClick={onClearLeads}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>پاکسازی تاریخچه</span>
              </button>
            )}
          </div>

          {config.recentLeads && config.recentLeads.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {config.recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">
                        {lead.userFirstName || 'کاربر تلگرام'} {lead.userUsername ? `(@${lead.userUsername})` : ''}
                      </span>
                      <span className="text-slate-500">در</span>
                      <span className="text-sky-400 font-bold">{lead.groupTitle || 'گروه'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                        {lead.detectedCategory}
                      </span>
                      <span>{new Date(lead.timestamp).toLocaleTimeString('fa-IR')}</span>
                    </div>
                  </div>

                  {/* Original Message */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                    <span className="text-[10px] text-slate-500 block mb-0.5">پیام شناسایی‌شده کاربر:</span>
                    «{lead.originalMessageText}»
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] pt-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        {lead.groupReplySent ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            ریپلای در گروه: انجام شد
                          </span>
                        ) : (
                          <span className="text-slate-500">ریپلای گروه: -</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {lead.pvSent ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            ارسال به پی‌وی: با موفقیت انجام شد {lead.sentByAccountPhone ? `(اکانت ${lead.sentByAccountPhone})` : ''} {lead.pvHasBanner ? '(همراه بنر)' : ''}
                          </span>
                        ) : lead.pvError && (lead.pvError.includes('سابقه') || lead.pvError.includes('ریپورت') || lead.pvError.includes('لغو شد')) ? (
                          <span className="text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium text-[10px]">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            سپر ضد ریپورت: {lead.pvError}
                          </span>
                        ) : (
                          <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px]">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            ارسال پی‌وی: {lead.pvError || 'ناموفق'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Retry Button if PV failed and not shield-prevented */}
                    {!lead.pvSent && (!lead.pvError || (!lead.pvError.includes('سابقه') && !lead.pvError.includes('ریپورت') && !lead.pvError.includes('لغو شد'))) && (
                      <button
                        onClick={() => handleRetryLeadPv(lead.id)}
                        disabled={retryingLeadId === lead.id}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40 text-[10px] font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${retryingLeadId === lead.id ? 'animate-spin' : ''}`} />
                        <span>{retryingLeadId === lead.id ? 'در حال ارسال مجدد...' : 'تلاش مجدد با اکانت سالم'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-xs font-bold text-slate-300">هنوز پیام یا لیدی ثبت نشده است</div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                هنگامی که استراتژی دوم یا حالت ترکیبی فعال باشد، هر پیام مرتبط با فیلترشکن و اینترنت در این بخش به صورت زنده ثبت می‌شود.
              </p>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUB-PANEL: COMPREHENSIVE JSON AUDIT & SWOT PERFORMANCE ANALYTICS */}
      {/* ========================================================================= */}
      {selectedSubTab === 'audit_export' && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-6 animate-in fade-in duration-200">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
                <HardDriveDownload className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white">خروجی هوشمند JSON، ارزیابی عملکرد و تحلیل نقاط قوت و ضعف</h3>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    SWOT & Telemetry Engine
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  استخراج تمام داده‌های رفتاری، ریزلاگ‌ها، نرخ موفقیت، سپر ضد ریپورت، وضعیت اکانت‌ها و راهکارهای اصلاحی در قالب فایل JSON استاندارد
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleFetchAudit}
                disabled={isLoadingAudit}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                <span>{isLoadingAudit ? 'در حال پایش...' : 'بروزرسانی داده‌ها'}</span>
              </button>

              <a
                href="/api/strategy/group-promotion/download-audit"
                download="group_promotion_audit_report.json"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>دانلود خروجی کامل JSON</span>
              </a>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400 block">نرخ موفقیت ارسال دوره‌ای</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {auditReport?.executiveSummary?.broadcastSuccessRatePercent ?? (config.strategy1.totalGroupsReached > 0 ? 100 : 0)}٪
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                {auditReport?.executiveSummary?.totalMessagesDelivered ?? config.strategy1.totalGroupsReached} ارسال موفق ثبت‌شده
              </span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400 block">شکار لید در استراتژی ۲</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-purple-400 font-mono">
                  {auditReport?.executiveSummary?.totalLeadsIdentified ?? (config.strategy2.totalLeadsDetected || 0)}
                </span>
                <span className="text-xs text-slate-400">مشتری</span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                {auditReport?.executiveSummary?.totalDirectMessagesDelivered ?? (config.strategy2.totalPvMessagesSent || 0)} پیام پی‌وی موفق
              </span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400 block">سپر ضد ریپورت و حافظه دائم</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-amber-400 font-mono">
                  {auditReport?.executiveSummary?.antiReportProtectionsTriggered ?? (config.strategy2.totalPvRepeatsPrevented || 0)}
                </span>
                <span className="text-xs text-slate-400">محافظت</span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                {auditReport?.executiveSummary?.totalUniqueUsersShielded ?? 0} کاربر یکتا در لیست سفید
              </span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400 block">اکانت‌های متصل به مخزن</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-sky-400 font-mono">
                  {accounts.filter(a => a.isActive).length}
                </span>
                <span className="text-xs text-slate-400">اکانت</span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                {auditReport?.executiveSummary?.fullyReadyGroupsCount ?? readyGroups.length} گروه ۱۰۰٪ آماده
              </span>
            </div>
          </div>

          {/* SWOT ANALYSIS CARDS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-white">تحلیل ساختاری عملکرد و عارضه‌یابی استراتژیک (SWOT Analysis)</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Strengths */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>نقاط قوت کلیدی بات (Strengths)</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  {(auditReport?.swotAnalysis?.strengths && auditReport.swotAnalysis.strengths.length > 0) ? (
                    auditReport.swotAnalysis.strengths.map((s: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span className="leading-relaxed">توزیع بار همزمان بین چند اکانت تلگرام جهت جلوگیری از فلود ویت</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span className="leading-relaxed">سپر دائمی ضد ریپورت جهت جلوگیری مطلق از ارسال پیام تکراری به کاربر</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span className="leading-relaxed">تولید کپشن‌های متنوع با هوش مصنوعی Gemini و دور زدن شناسایی تکرار</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {/* Weaknesses */}
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-black">
                  <ShieldAlert className="w-4 h-4" />
                  <span>نقاط ضعف و گلوگاه‌ها (Weaknesses)</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  {(auditReport?.swotAnalysis?.weaknesses && auditReport.swotAnalysis.weaknesses.length > 0) ? (
                    auditReport.swotAnalysis.weaknesses.map((w: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold shrink-0">✕</span>
                        <span className="leading-relaxed">{w}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold shrink-0">✕</span>
                        <span className="leading-relaxed">وجود گروه‌های با محدودیت ادمین (Admin Only) در دیتابیس بدون مجوز ارسال</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold shrink-0">✕</span>
                        <span className="leading-relaxed">ریسک فلود ویت روی اکانت‌های با سابقه ارسال بالا</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {/* Opportunities */}
              <div className="bg-sky-950/20 border border-sky-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sky-400 text-xs font-black">
                  <Lightbulb className="w-4 h-4" />
                  <span>فرصت‌های افزایش بازدهی و فروش (Opportunities)</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  {(auditReport?.swotAnalysis?.opportunities && auditReport.swotAnalysis.opportunities.length > 0) ? (
                    auditReport.swotAnalysis.opportunities.map((o: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-sky-400 font-bold shrink-0">✦</span>
                        <span className="leading-relaxed">{o}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-sky-400 font-bold shrink-0">✦</span>
                        <span className="leading-relaxed">فعال‌سازی حالت ترکیبی (Hybrid) جهت جذب همزمان ترافیک عمومی و خریداران فوری</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-sky-400 font-bold shrink-0">✦</span>
                        <span className="leading-relaxed">افزودن کلمات کلیدی عامیانه برای شکار لیدهای غیرمستقیم اینترنت</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {/* Threats & Risks */}
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-black">
                  <AlertCircle className="w-4 h-4" />
                  <span>هشدارها و ریسک‌های تلگرام (Threats & Risks)</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  {(auditReport?.swotAnalysis?.threatsAndRisks && auditReport.swotAnalysis.threatsAndRisks.length > 0) ? (
                    auditReport.swotAnalysis.threatsAndRisks.map((t: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold shrink-0">⚠</span>
                        <span className="leading-relaxed">{t}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold shrink-0">⚠</span>
                        <span className="leading-relaxed">سقف روزانه بیش از ۴۰ پیام برای اکانت‌های بدون اشتراک پریمیوم تلگرام</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold shrink-0">⚠</span>
                        <span className="leading-relaxed">ارسال سریع بدون تاخیر شبیه‌سازی تایپ منجر به محدودیت PEER_FLOOD می‌شود</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>اقدامات پیشنهادی و راهکارهای اصلاحی جهت تقویت بات</span>
            </h4>
            <div className="space-y-2">
              {(auditReport?.swotAnalysis?.actionableRecommendations || [
                'گروه‌های دارای محدودیت سلب دسترسی را از دیتابیس پاکسازی کنید تا نرخ خطا کاهش یابد.',
                'زمان تنفس بین ریپلای در هر گروه را روی حداقل ۵ دقیقه تنظیم نمایید تا حساسیت مدیران گروه به حداقل برسد.',
                'ارسال چندحبابی صمیمانه همراه با عکس تعرفه را در استراتژی ۲ فعال نگه‌دارید تا لیدها حس گفتگوی واقعی داشته باشند.',
              ]).map((rec: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300">
                  <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bot Capabilities Matrix */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-sky-400" />
              <span>ماتریس توانمندی‌ها و ماژول‌های فعال بات در بخش تبلیغات گروهی</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">ارسال چنداکانته موازی</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">فعال</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">بازنویسی هوش مصنوعی Gemini</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.strategy1.useGeminiRewriting !== false ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                  {config.strategy1.useGeminiRewriting !== false ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">حل کپچای ریاضی ربات‌ها</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">فعال</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">بررسی ماندگاری پیام (Anti-Delete)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">فعال</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">چت چندحبابی پی‌وی (Multi-Bubble)</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.strategy2.multiBubblePv !== false ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                  {config.strategy2.multiBubblePv !== false ? 'فعال' : 'تک‌حبابی'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">سپر حافظه دائم ضد ریپورت</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">فعال</span>
              </div>
            </div>
          </div>

          {/* Raw JSON Structure Preview & Copy Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white">پیش‌نمایش زنده ساختار خروجی JSON</h4>
                <span className="text-[10px] text-slate-500 font-mono">group_promotion_audit_report.json</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAuditJson}
                  disabled={!auditReport}
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 disabled:opacity-40"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedJson ? 'کپی شد!' : 'کپی کل JSON'}</span>
                </button>
                <a
                  href="/api/strategy/group-promotion/download-audit"
                  download="group_promotion_audit_report.json"
                  className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود فایل</span>
                </a>
              </div>
            </div>

            <div className="bg-slate-900/90 rounded-xl p-3 max-h-72 overflow-y-auto font-mono text-[11px] text-amber-300/90 dir-ltr border border-slate-800/80">
              {auditReport ? (
                <pre>{JSON.stringify(auditReport, null, 2)}</pre>
              ) : (
                <div className="text-slate-500 text-center py-6 font-sans text-xs">
                  داده‌های اولیه آماده است. روی «بروزرسانی داده‌ها» کلیک کنید یا با دکمه بالا مستقیماً فایل JSON را دریافت نمایید.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
