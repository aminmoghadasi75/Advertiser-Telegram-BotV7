import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  Megaphone,
  Play,
  Square,
  StopCircle,
  Send,
  Power,
  Sparkles,
  Clock,
  RefreshCw,
  Layers,
  CheckCircle2,
  ChevronLeft,
  AlertTriangle,
  Radio,
  Eye,
  Zap,
} from 'lucide-react';
import {
  TargetGroup,
  TelegramAccount,
  SchedulerConfig,
  GroupPromotionStrategyConfig,
} from '../types';

interface UnifiedAntiBanCommandBarProps {
  groups: TargetGroup[];
  accounts: TelegramAccount[];
  scheduler: SchedulerConfig;
  groupPromotionStrategy?: GroupPromotionStrategyConfig;
  isBroadcastingActive: boolean;
  isStoppingBroadcast: boolean;
  activeGroupJoinProgress?: any;
  onToggleAutoRun: (active: boolean) => Promise<void> | void;
  onStartBroadcast: () => Promise<void> | void;
  onStopBroadcast: () => Promise<void> | void;
  onSendNow: () => Promise<void> | void;
  onStartSmartJoin: () => Promise<void> | void;
  onStopSmartJoin: () => Promise<void> | void;
  onSwitchStrategy: (strategy: 'periodic_broadcast' | 'smart_listener_reply' | 'hybrid_both') => Promise<void> | void;
  onToggleListener?: (active: boolean) => Promise<void> | void;
  onNavigateTab?: (subTab: string) => void;
}

export const UnifiedAntiBanCommandBar: React.FC<UnifiedAntiBanCommandBarProps> = ({
  groups,
  accounts,
  scheduler,
  groupPromotionStrategy,
  isBroadcastingActive,
  isStoppingBroadcast,
  activeGroupJoinProgress,
  onToggleAutoRun,
  onStartBroadcast,
  onStopBroadcast,
  onSendNow,
  onStartSmartJoin,
  onStopSmartJoin,
  onSwitchStrategy,
  onToggleListener,
  onNavigateTab,
}) => {
  const [isSwitchingStrat, setIsSwitchingStrat] = useState(false);
  const [isSendingImmediate, setIsSendingImmediate] = useState(false);

  // Group membership stats
  const joinedGroups = groups.filter(g => g.status === 'joined' || g.membershipStatus === 'joined');
  const unjoinedGroups = groups.filter(g => g.status !== 'joined' && g.membershipStatus !== 'joined');
  const readyGroups = groups.filter(g => g.status === 'joined' && g.readinessStatus === 'ready');
  const activeGroups = groups.filter(g => g.isActive);

  // Accounts stats
  const activeConnectedAccounts = accounts.filter(
    a => a.isActive && a.status !== 'disabled' && a.status !== 'session_expired' && Boolean(a.sessionString)
  );

  const isJoinRunning = Boolean(activeGroupJoinProgress?.isRunning);
  const activeStrat = groupPromotionStrategy?.activeStrategy || 'hybrid_both';
  const isListenerActive = Boolean(groupPromotionStrategy?.strategy2?.isListeningActive);
  const totalScanned = groupPromotionStrategy?.strategy2?.totalMessagesScanned || 0;
  const totalLeads = groupPromotionStrategy?.strategy2?.totalLeadsDetected || 0;

  const handleStratChange = async (strategy: 'periodic_broadcast' | 'smart_listener_reply' | 'hybrid_both') => {
    if (strategy === activeStrat) return;
    setIsSwitchingStrat(true);
    try {
      await onSwitchStrategy(strategy);
    } finally {
      setIsSwitchingStrat(false);
    }
  };

  const handleImmediateSendClick = async () => {
    setIsSendingImmediate(true);
    try {
      await onSendNow();
    } finally {
      setIsSendingImmediate(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 relative overflow-hidden">
      
      {/* Subtle Background Glow Accent */}
      <div className="absolute top-0 left-1/4 w-96 h-48 bg-sky-500/5 blur-3xl pointer-events-none rounded-full"></div>
      <div className="absolute top-0 right-1/4 w-96 h-48 bg-indigo-500/5 blur-3xl pointer-events-none rounded-full"></div>

      {/* 1. Header Bar: Title & Global Status */}
      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6 text-sky-200" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                مرکز فرماندهی یکپارچه ضد مسدودی تبلیغات گروه‌ها
              </h2>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ۳ مرحله ایمن‌سازی ضد اسپم
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تمام دکمه‌های اجرای عضویت، شنود پیام‌ها و ارسال بنر بر اساس استراتژی ضد مسدودی تلگرام در ۳ مرحله منظم شده‌اند.
            </p>
          </div>
        </div>

        {/* Live Global Health Readout */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="text-slate-400">اکانت‌های عملیاتی:</span>
            <span className="font-bold text-sky-400 font-mono">
              {activeConnectedAccounts.length.toLocaleString('fa-IR')}
            </span>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="text-slate-400">گروه‌های عضو شده:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {joinedGroups.length.toLocaleString('fa-IR')} از {groups.length.toLocaleString('fa-IR')}
            </span>
          </div>
        </div>
      </div>

      {/* 2. THREE CHRONOLOGICAL ANTI-BAN PHASES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative">
        
        {/* ========================================================================= */}
        {/* PHASE 1: SAFE MEMBERSHIP ENGINE (مرحله ۱: عضویت امن و قطره‌چکانی) */}
        {/* ========================================================================= */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 hover:border-slate-700 transition-colors">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 text-xs font-black flex items-center justify-center border border-sky-500/20">
                  ۱
                </span>
                <span className="text-xs font-bold text-white">مرحله ۱: عضویت امن در گروه‌ها</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                isJoinRunning
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                  : joinedGroups.length > 0
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isJoinRunning ? 'در حال عضویت...' : `${joinedGroups.length} عضو شده`}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              عضویت قطره‌چکانی با تاخیر انسانی بین اکانت‌ها، بدون ارسال پیام تا از مسدودی و ریپورت جلوگیری شود.
            </p>

            {/* Micro Stats */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] block">عضو شده</span>
                <span className="font-bold text-emerald-400 text-xs font-mono">{joinedGroups.length}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] block">باقیمانده</span>
                <span className="font-bold text-amber-400 text-xs font-mono">{unjoinedGroups.length}</span>
              </div>
            </div>
          </div>

          {/* Unified Join Action Button */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
            {isJoinRunning ? (
              <button
                type="button"
                onClick={() => onStopSmartJoin()}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 animate-pulse"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>توقف عضویت هوشمند</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStartSmartJoin()}
                disabled={unjoinedGroups.length === 0 || activeConnectedAccounts.length === 0}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                  unjoinedGroups.length > 0 && activeConnectedAccounts.length > 0
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/20'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {unjoinedGroups.length > 0
                    ? `شروع عضویت هوشمند (${unjoinedGroups.length} گروه)`
                    : 'همه گروه‌ها عضو شده‌اند ✓'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PHASE 2: STRATEGY ORCHESTRATION (مرحله ۲: استراتژی فعالیت) */}
        {/* ========================================================================= */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 hover:border-slate-700 transition-colors">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-black flex items-center justify-center border border-amber-500/20">
                  ۲
                </span>
                <span className="text-xs font-bold text-white">مرحله ۲: استراتژی فعالیت</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {activeStrat === 'periodic_broadcast' && 'دوره‌ای (بنر)'}
                {activeStrat === 'smart_listener_reply' && 'شنود هوشمند'}
                {activeStrat === 'hybrid_both' && 'ترکیبی ۱+۲'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              روش فعالیت ربات در گروه‌ها را تعیین کنید؛ ارسال بنر، یا فقط شنود زنده پیام‌ها و جذب لید بدون اسپم.
            </p>

            {/* Quick 3-Way Strategy Selector Buttons */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleStratChange('periodic_broadcast')}
                disabled={isSwitchingStrat}
                className={`p-2 rounded-xl text-[10px] font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                  activeStrat === 'periodic_broadcast'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-200 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>۱. دوره‌ای</span>
              </button>

              <button
                type="button"
                onClick={() => handleStratChange('smart_listener_reply')}
                disabled={isSwitchingStrat}
                className={`p-2 rounded-xl text-[10px] font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                  activeStrat === 'smart_listener_reply'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-200 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>۲. شنود زنده</span>
              </button>

              <button
                type="button"
                onClick={() => handleStratChange('hybrid_both')}
                disabled={isSwitchingStrat}
                className={`p-2 rounded-xl text-[10px] font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                  activeStrat === 'hybrid_both'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>۳. ترکیبی</span>
              </button>
            </div>

            {/* Listener Telemetry Status Pill */}
            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Radio className={`w-3.5 h-3.5 ${isListenerActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <span>شنود زنده پیام‌ها:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-300">
                  {totalScanned.toLocaleString('fa-IR')} پیام
                </span>
                {totalLeads > 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold font-mono">
                    {totalLeads} لید
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Jump to Strategy Tuning Link */}
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('strategies')}
              className="pt-2 border-t border-slate-800/80 w-full text-center text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center justify-center gap-1 transition-colors"
            >
              <span>تنظیم جزئیات پیام‌ها و هوش مصنوعی</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PHASE 3: EXECUTION & SCHEDULER DISPATCH (مرحله ۳: فرماندهی ارسال و اجرا) */}
        {/* ========================================================================= */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 hover:border-slate-700 transition-colors">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-black flex items-center justify-center border border-emerald-500/20">
                  ۳
                </span>
                <span className="text-xs font-bold text-white">مرحله ۳: اجرای ارسال و زمان‌بندی</span>
              </div>
              
              {/* Auto Run Master Toggle Button */}
              <button
                type="button"
                onClick={() => onToggleAutoRun(!scheduler.isAutoRunActive)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                  scheduler.isAutoRunActive
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Power className="w-3 h-3" />
                <span>زمان‌بندی: {scheduler.isAutoRunActive ? 'روشن ✓' : 'خاموش'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              ارسال بنرها در گروه‌های آماده با رعایت فاصله زمانی (هر {scheduler.intervalMinutes} دقیقه) و تاخیر شناور.
            </p>

            {/* Broadcasting Status Banner */}
            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">سهمیه ۲۴ ساعته:</span>
              <span className="font-mono text-indigo-300 font-bold">
                {(scheduler.dailySentCount || 0).toLocaleString('fa-IR')} / {scheduler.dailyLimit.toLocaleString('fa-IR')} ارسال
              </span>
            </div>
          </div>

          {/* Master Action Buttons Cluster */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
            {isBroadcastingActive ? (
              <button
                type="button"
                onClick={() => onStopBroadcast()}
                disabled={isStoppingBroadcast}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all active:scale-95 animate-pulse"
              >
                <StopCircle className="w-4 h-4" />
                <span>{isStoppingBroadcast ? 'در حال لغو...' : 'توقف فوری ارسال'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full">
                {/* Primary Start Broadcast */}
                <button
                  type="button"
                  onClick={() => handleImmediateSendClick()}
                  disabled={isSendingImmediate || activeConnectedAccounts.length === 0 || activeGroups.length === 0}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                    activeConnectedAccounts.length > 0 && activeGroups.length > 0
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  {isSendingImmediate ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {activeStrat === 'smart_listener_reply'
                      ? 'ارسال تست بنر در گروه‌ها'
                      : 'شروع ارسال به گروه‌ها'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
