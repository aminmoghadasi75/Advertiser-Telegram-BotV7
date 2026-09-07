import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Power,
  CheckCircle,
  Clock,
  Zap,
  Phone,
  Sparkles,
  Layers,
  ShieldAlert,
  Cpu,
  Radio,
  MessageSquare,
  Megaphone,
  Check,
  X,
  Key,
  Lock,
  Activity,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  MessageCircle,
} from 'lucide-react';
import { TelegramAccount } from '../types';

interface AccountManagerCardProps {
  accounts: TelegramAccount[];
  activeAccountId?: string;
  instanceSharding?: {
    currentShard: number;
    totalShards: number;
    isEnabled: boolean;
    instanceLabel?: string;
  };
  enableFailoverRedistribution?: boolean;
  onToggleFailoverRedistribution?: (enabled: boolean) => Promise<void>;
  onUpdateSharding?: (config: { isEnabled: boolean; currentShard: number; totalShards: number; instanceLabel?: string }) => Promise<void>;
  onAutoBalanceTerritories?: (forceAll?: boolean) => Promise<any>;
  onUpdateAccountSettings?: (accountId: string, settings: Partial<TelegramAccount>) => Promise<void>;
  onSelectActiveAccount: (id: string) => Promise<void>;
  onToggleAccountActive: (id: string, isActive: boolean) => Promise<void>;
  onToggleModule?: (id: string, module: 'group_broadcast' | 'anonymous_bot' | 'pv_reply' | 'personal_account' | 'strict_isolation', enabled: boolean) => Promise<void>;
  onBulkToggleModule?: (module: 'group_broadcast' | 'anonymous_bot' | 'pv_reply', enabled: boolean) => Promise<void>;
  onVerifyAllAccounts?: () => Promise<void>;
  onVerifySingleAccount?: (id: string) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onReauthAccount?: (acc: TelegramAccount) => void;
  onOpenAddAccountModal: () => void;
}

export const AccountManagerCard: React.FC<AccountManagerCardProps> = ({
  accounts = [],
  activeAccountId,
  instanceSharding,
  enableFailoverRedistribution = false,
  onToggleFailoverRedistribution,
  onUpdateSharding,
  onAutoBalanceTerritories,
  onUpdateAccountSettings,
  onSelectActiveAccount,
  onToggleAccountActive,
  onToggleModule,
  onBulkToggleModule,
  onVerifyAllAccounts,
  onVerifySingleAccount,
  onDeleteAccount,
  onReauthAccount,
  onOpenAddAccountModal,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [selectedPersonaAccId, setSelectedPersonaAccId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [floodCheckLoading, setFloodCheckLoading] = useState<string | null>(null);
  const [floodCheckResult, setFloodCheckResult] = useState<{ [id: string]: any }>({});
  const [showSmartTips, setShowSmartTips] = useState<{ [id: string]: boolean }>({});

  React.useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCheckFloodWait = async (accountId: string) => {
    setFloodCheckLoading(accountId);
    try {
      const res = await fetch('/api/accounts/check-flood-wait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, probeTelegram: true }),
      });
      const data = await res.json();
      setFloodCheckResult(prev => ({ ...prev, [accountId]: data }));
      if (data.status === 'cleared') {
        setVerifyMessage('🎉 محدودیت تلگرام به پایان رسید و این اکانت مجدداً فعال گردید!');
        setTimeout(() => setVerifyMessage(null), 5000);
        if (onVerifyAllAccounts) onVerifyAllAccounts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFloodCheckLoading(null);
    }
  };

  const activeAccountsCount = accounts.filter(
    a => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled' && (!a.floodWaitUntil || a.floodWaitUntil < Date.now())
  ).length;

  const groupBroadcastCount = accounts.filter(
    a => a.enableForGroupBroadcast !== false && a.isActive && a.status !== 'session_expired'
  ).length;

  const anonBotCount = accounts.filter(
    a => a.enableForAnonymousBot !== false && a.isActive && a.status !== 'session_expired'
  ).length;

  const pvReplyCount = accounts.filter(
    a => a.enableForPvReply !== false && a.isActive && a.status !== 'session_expired'
  ).length;

  const expiredSessionsCount = accounts.filter(
    a => a.requiresReauth || a.status === 'session_expired'
  ).length;

  const handleSelectActive = async (id: string) => {
    setLoadingId(id);
    try {
      await onSelectActiveAccount(id);
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    setLoadingId(id);
    try {
      await onToggleAccountActive(id, !current);
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggleModuleAction = async (id: string, module: 'group_broadcast' | 'anonymous_bot' | 'pv_reply' | 'personal_account' | 'strict_isolation', current: boolean) => {
    if (!onToggleModule) return;
    setLoadingId(`${id}_${module}`);
    try {
      await onToggleModule(id, module, !current);
    } finally {
      setLoadingId(null);
    }
  };

  const handleBulkToggle = async (module: 'group_broadcast' | 'anonymous_bot' | 'pv_reply', enable: boolean) => {
    if (!onBulkToggleModule) return;
    setIsVerifyingAll(true);
    try {
      await onBulkToggleModule(module, enable);
    } finally {
      setIsVerifyingAll(false);
    }
  };

  const handleVerifySingle = async (id: string) => {
    if (!onVerifySingleAccount) return;
    setLoadingId(`verify_${id}`);
    try {
      await onVerifySingleAccount(id);
    } finally {
      setLoadingId(null);
    }
  };

  const handleVerifyAll = async () => {
    if (!onVerifyAllAccounts) return;
    setIsVerifyingAll(true);
    setVerifyMessage('در حال اعتبارسنجی زنده و ۱۰۰٪ ارتباط تمام اکانت‌ها با سرورهای MTProto تلگرام...');
    try {
      await onVerifyAllAccounts();
      setVerifyMessage('پایش زنده با موفقیت تکمیل گردید.');
      setTimeout(() => setVerifyMessage(null), 4000);
    } catch (e: any) {
      setVerifyMessage('خطا در پایش زنده اکانت‌ها');
      setTimeout(() => setVerifyMessage(null), 4000);
    } finally {
      setIsVerifyingAll(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('آیا از حذف کامل این اکانت از سیستم اطمینان دارید؟ تمامی اطلاعات جلسه و کلیدها حذف خواهند شد.')) {
      setLoadingId(id);
      try {
        await onDeleteAccount(id);
      } finally {
        setLoadingId(null);
      }
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-xl space-y-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white flex items-center gap-2 flex-wrap">
              <span>مدیریت یکپارچه اکانت‌ها و پایش زنده سلامت (Live MTProto Health)</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">
                {accounts.length.toLocaleString('fa-IR')} اکانت ثبت‌شده
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              تضمین قطعی ۱۰۰٪ اتصال نشست، تفکیک نقش در چت ناشناس و ارسال گروهی، و ذخیره‌سازی دائمی کلیدها
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onVerifyAllAccounts && (
            <button
              onClick={handleVerifyAll}
              disabled={isVerifyingAll || accounts.length === 0}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
              title="تست و پایش اعتبار زنده نشست تمامی اکانت‌ها با دریافت مستقیم مشخصات از تلگرام"
            >
              <Activity className={`w-3.5 h-3.5 ${isVerifyingAll ? 'animate-spin' : ''}`} />
              <span>{isVerifyingAll ? 'در حال پایش زنده...' : 'پایش سلامت زنده همه'}</span>
            </button>
          )}

          <button
            onClick={onOpenAddAccountModal}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>افزودن اکانت جدید</span>
          </button>
        </div>
      </div>

      {/* Verify feedback notification */}
      {verifyMessage && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-2.5 text-xs text-sky-200 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>{verifyMessage}</span>
          </div>
        </div>
      )}

      {/* Expired Sessions Alert Warning Banner */}
      {expiredSessionsCount > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-pulse">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <strong className="text-rose-100 block">
                توجه: تعداد {expiredSessionsCount.toLocaleString('fa-IR')} اکانت نیاز به تمدید نشست (Re-Auth) دارند!
              </strong>
              <span className="text-rose-300/90 text-[11px]">
                نشست این اکانت‌ها به دلیل خروج از دستگاه دیگر یا انقضای کلید غیرفعال شده است. با زدن دکمه تمدید نشست، کد جدید بگیرید.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5-Node Google AI Studio Sharding & Failover Orchestrator */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950 border border-indigo-500/30 rounded-xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-xs text-indigo-200 flex items-center gap-2">
                <span>توزیع بار چندنودی و تفکیک ۵ محیط Google AI Studio (Sharding Engine)</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-mono">
                  {instanceSharding?.isEnabled ? `نود فعال: ${instanceSharding.currentShard} از ${instanceSharding.totalShards}` : 'تک‌نود (پیش‌فرض)'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                اگر ۵ اکانت مختلف را روی ۵ تب/محیط مختلف هوش مصنوعی اجرا می‌کنید، هر نود فقط مسئول ۱/۵ از گروه‌ها و کاربران هدف خواهد بود تا تداخلی رخ ندهد.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onAutoBalanceTerritories && (
              <>
                <button
                  onClick={async () => {
                    setIsRebalancing(true);
                    try {
                      const res = await onAutoBalanceTerritories(false);
                      setVerifyMessage(`✅ ${res?.totalGroups || 'گروه‌ها'} با موفقیت بین اکانت‌های فعال تفکیک شدند.`);
                      setTimeout(() => setVerifyMessage(null), 4000);
                    } finally {
                      setIsRebalancing(false);
                    }
                  }}
                  disabled={isRebalancing || activeAccountsCount === 0}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold transition-all flex items-center gap-1.5"
                  title="تخصیص گروه‌های جدید یا بدون مالک به اکانت‌های فعال"
                >
                  <Layers className={`w-3.5 h-3.5 ${isRebalancing ? 'animate-spin' : ''}`} />
                  <span>{isRebalancing ? 'در حال پردازش...' : 'تعادل گروه‌های بی‌صاحب'}</span>
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('آیا می‌خواهید تمام گروه‌ها به طور کاملاً مساوی و ۵۰-۵۰ بین همه اکانت‌های فعال بازتوزیع شوند؟')) return;
                    setIsRebalancing(true);
                    try {
                      const res = await onAutoBalanceTerritories(true);
                      setVerifyMessage(`✅ تمام ${res?.totalGroups || ''} گروه فعال به صورت کاملاً مساوی بین ${res?.totalAccounts || ''} اکانت تقسیم شدند.`);
                      setTimeout(() => setVerifyMessage(null), 4000);
                    } finally {
                      setIsRebalancing(false);
                    }
                  }}
                  disabled={isRebalancing || activeAccountsCount === 0}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5"
                  title="بازتوزیع و تقسیم ۵۰-۵۰ تمام گروه‌های فعال بین اکانت‌های فعال"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRebalancing ? 'animate-spin' : ''}`} />
                  <span>تقسیم مساوی ۵۰-۵۰ همه گروه‌ها</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Failover Policy & Territory Isolation Settings */}
        {onToggleFailoverRedistribution && (
          <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">سیاست در زمان مسدودی موقت حساب (Failover Policy):</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${enableFailoverRedistribution ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                  {enableFailoverRedistribution ? 'پخش خودکار وظایف بین سایر اکانت‌ها' : 'حفظ قلمرو و عدم جابجایی (ایزوله و امن)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {enableFailoverRedistribution
                  ? 'اگر اکانتی دچار محدودیت تلگرام شود، گروه‌های آن سریعاً به سایر اکانت‌های فعال واگذار می‌شود تا تبلیغات متوقف نشود.'
                  : 'اگر اکانتی مسدود شود، گروه‌هایش متوقف می‌مانند تا خود آن اکانت آزاد شود و به اکانت‌های دیگر منتقل نمی‌شوند (پیشنهادی برای جلوگیری از بن دومینویی).'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onToggleFailoverRedistribution(!enableFailoverRedistribution)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  enableFailoverRedistribution
                    ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {enableFailoverRedistribution ? 'غیرفعال‌سازی پخش خودکار' : 'فعال‌سازی پخش خودکار'}
              </button>
            </div>
          </div>
        )}

        {/* Shard Selection Selector */}
        {onUpdateSharding && (
          <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={instanceSharding?.isEnabled ?? true}
                  onChange={(e) => {
                    onUpdateSharding({
                      isEnabled: e.target.checked,
                      currentShard: instanceSharding?.currentShard || 1,
                      totalShards: instanceSharding?.totalShards || 5,
                      instanceLabel: instanceSharding?.instanceLabel || `Node-${instanceSharding?.currentShard || 1}`,
                    });
                  }}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-bold">فعال‌سازی تقسیم کار بین چند Google AI Studio (Sharding)</span>
              </label>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400">این محیط، نود شماره:</span>
              {[1, 2, 3, 4, 5].map((nodeNum) => {
                const isSelected = (instanceSharding?.currentShard || 1) === nodeNum;
                return (
                  <button
                    key={nodeNum}
                    type="button"
                    onClick={() => {
                      onUpdateSharding({
                        isEnabled: true,
                        currentShard: nodeNum,
                        totalShards: instanceSharding?.totalShards || 5,
                        instanceLabel: `Node-${nodeNum}`,
                      });
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    #{nodeNum}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Unified Role Allocation & Quick Bulk Action Controls */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-200">
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span>مدیریت سریع تخصیص نقش اکانت‌ها در بخش‌های مختلف برنامه:</span>
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              📢 {groupBroadcastCount} اکانت فعال در تبلیغات گروهی
            </span>
            <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[10px] font-bold">
              💬 {anonBotCount} اکانت فعال در چت ناشناس
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-bold">
              📥 {pvReplyCount} اکانت فعال در پاسخ به پی‌وی (PV)
            </span>
          </div>
        </div>

        {/* Quick Bulk Action Buttons */}
        {onBulkToggleModule && accounts.length > 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>تبلیغات در گروه‌ها:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleBulkToggle('group_broadcast', true)}
                  className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold transition-all"
                >
                  فعال‌سازی همه
                </button>
                <button
                  onClick={() => handleBulkToggle('group_broadcast', false)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-all"
                >
                  غیرفعال‌سازی همه
                </button>
              </div>
            </div>

            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>اتوماسیون ربات ناشناس:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleBulkToggle('anonymous_bot', true)}
                  className="px-2 py-1 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 font-bold transition-all"
                >
                  فعال‌سازی همه
                </button>
                <button
                  onClick={() => handleBulkToggle('anonymous_bot', false)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-all"
                >
                  غیرفعال‌سازی همه
                </button>
              </div>
            </div>

            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-300 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>پاسخ خودکار پی‌وی (PV):</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleBulkToggle('pv_reply', true)}
                  className="px-2 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-bold transition-all"
                >
                  فعال‌سازی همه
                </button>
                <button
                  onClick={() => handleBulkToggle('pv_reply', false)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-all"
                >
                  غیرفعال‌سازی همه
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <div className="text-center py-8 bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs space-y-2">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <p>هنوز اکانتی اضافه نشده است.</p>
          <button
            onClick={onOpenAddAccountModal}
            className="text-indigo-400 hover:text-indigo-300 underline font-bold"
          >
            کلیک کنید تا اولین اکانت متصل شود
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accounts.map((acc) => {
            const isPrimary = acc.id === activeAccountId;
            const isExpired = acc.requiresReauth || acc.status === 'session_expired';
            const isFloodWait = acc.status === 'flood_wait' || (acc.floodWaitUntil && acc.floodWaitUntil > Date.now());
            const isLiveHealthy = acc.isVerifiedLive && !isExpired && !isFloodWait && acc.status !== 'disabled';
            const fullName = [acc.userProfile?.firstName, acc.userProfile?.lastName].filter(Boolean).join(' ') || 'کاربر تلگرام';

            const isGroupBroadcastEnabled = acc.enableForGroupBroadcast !== false;
            const isAnonymousBotEnabled = acc.enableForAnonymousBot !== false;
            const isPvReplyEnabled = acc.enableForPvReply !== false;
            const isSupportAccount = Boolean(
              (acc.userProfile?.username && acc.userProfile.username.toLowerCase().includes('nova')) ||
              (acc.userProfile?.firstName && acc.userProfile.firstName.toLowerCase().includes('nova'))
            );

            return (
              <div
                key={acc.id}
                className={`bg-slate-950 rounded-xl p-3.5 border transition-all space-y-3 relative ${
                  isExpired
                    ? 'border-rose-500/60 bg-rose-950/10'
                    : isPrimary
                    ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Primary Badge */}
                {isPrimary && (
                  <span className="absolute -top-2.5 left-3 bg-indigo-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                    اکانت اصلی سیستم
                  </span>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-indigo-900 border border-slate-700 flex items-center justify-center font-bold text-white text-sm shrink-0">
                      {fullName.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white flex items-center gap-1.5">
                        <span>{fullName}</span>
                        {acc.userProfile?.username && (
                          <span className="text-[11px] text-indigo-400 font-normal dir-ltr">
                            (@{acc.userProfile.username})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono dir-ltr">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{acc.phoneNumber}</span>
                      </div>
                    </div>
                  </div>

                  {/* 100% Reliable Status Indicator */}
                  <div>
                    {isExpired ? (
                      <span className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>نیاز به تمدید نشست</span>
                      </span>
                    ) : isFloodWait ? (
                      <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>محدودیت FloodWait</span>
                      </span>
                    ) : isLiveHealthy ? (
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>متصل و فعال (۱۰۰٪ قطعی)</span>
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-medium">
                        غیرفعال
                      </span>
                    )}
                  </div>
                </div>

                {/* Dynamic Live FloodWait Monitor & Smart Recovery */}
                {isFloodWait && (() => {
                  const remainMs = Math.max(0, (acc.floodWaitUntil || 0) - nowTs);
                  const remainHours = Math.floor(remainMs / (3600 * 1000));
                  const remainMins = Math.floor((remainMs % (3600 * 1000)) / (60 * 1000));
                  const remainSecs = Math.floor((remainMs % (60 * 1000)) / 1000);
                  const formattedUnlockTime = acc.floodWaitUntil
                    ? new Date(acc.floodWaitUntil).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '';

                  return (
                    <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/40 rounded-xl p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-amber-300 font-bold">
                          <Clock className="w-4 h-4 animate-spin text-amber-400" />
                          <span>پایش داینامیک رفع محدودیت FloodWait:</span>
                        </div>
                        <div className="bg-amber-500/20 border border-amber-500/40 text-amber-200 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold">
                          {remainHours > 0 ? `${remainHours}h ` : ''}{remainMins}m {remainSecs}s باقی‌مانده
                        </div>
                      </div>

                      <div className="text-[11px] text-amber-200/90 flex items-center justify-between gap-2 flex-wrap">
                        <span>زمان تخمینی آزادی اکانت: <strong className="font-mono text-white">ساعت {formattedUnlockTime}</strong></span>
                        <button
                          type="button"
                          onClick={() => handleCheckFloodWait(acc.id)}
                          disabled={floodCheckLoading === acc.id}
                          className="px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/40 border border-amber-500/50 text-amber-100 text-[11px] font-bold transition-all flex items-center gap-1.5"
                        >
                          <Activity className={`w-3.5 h-3.5 ${floodCheckLoading === acc.id ? 'animate-spin' : ''}`} />
                          <span>{floodCheckLoading === acc.id ? 'در حال استعلام از سرور...' : 'استعلام زنده رفع محدودیت'}</span>
                        </button>
                      </div>

                      {/* Smart Recovery & Prevention Guide */}
                      <div className="pt-1.5 border-t border-amber-500/20">
                        <button
                          type="button"
                          onClick={() => setShowSmartTips(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                          className="text-[10px] text-amber-400 hover:text-amber-300 underline flex items-center gap-1 font-medium"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{showSmartTips[acc.id] ? 'بستن راهکارهای هوشمندانه آزادسازی' : 'راهکارهای هوشمندانه و حرفه‌ای آزادسازی و پیشگیری'}</span>
                        </button>

                        {showSmartTips[acc.id] && (
                          <div className="mt-2 p-2.5 bg-slate-950/90 rounded-lg border border-amber-500/30 text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
                            <p className="font-bold text-amber-300">💡 راهکارهای حرفه‌ای برای مدیریت و رفع محدودیت تلگرام:</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-300 text-[10px]">
                              <li><strong>استعلام مستقیم از @SpamBot تلگرام:</strong> با این اکانت به ربات رسمی SpamBot پیام دهید؛ تاریخ دقیق رفع محدودیت نمایش داده شده و با کلیک روی <span className="font-mono text-amber-200">This is a mistake</span> می‌توانید درخواست بازبینی ثبت کنید.</li>
                              <li><strong>ایزوله‌سازی قلمرو گروه‌ها:</strong> گروه‌های این اکانت به اکانت دیگر واگذار نشده‌اند و در حالت آماده‌باش ایمن هستند تا از سرایت مسدودیت به سایر حساب‌ها جلوگیری شود.</li>
                              <li><strong>کش کشویی Peer و سیستم وقفه ۵ ثانیه‌ای:</strong> سیستم در سرور مجهز به کش پایدار شناسه گروه‌ها شده تا بعد از رفع مسدودی، درخواست‌های مکرر به تلگرام داده نشود.</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Stored Hash & ID Credentials Status Bar */}
                <div className="bg-slate-900/90 rounded-lg p-2 flex items-center justify-between text-[11px] text-slate-300 border border-slate-800 flex-wrap gap-1">
                  <div className="flex items-center gap-1 text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>کلیدها و نشست:</span>
                    <span className="text-indigo-300 font-mono text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      ID: {acc.apiId || '2040'} | Hash: ذخیره‌شده
                    </span>
                  </div>

                  {/* Territory & Shift status */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                      👥 {acc.assignedGroupCount || 0} گروه تحت مدیریت
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                      📨 {acc.dailySentCount || 0} پیام امروز
                    </span>
                  </div>
                </div>

                {/* Persona Tone & Intelligence Settings */}
                <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-800/60 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>لحن و پرسونا:</span>
                    <select
                      value={acc.personaTone || 'friendly'}
                      onChange={(e) => {
                        if (onUpdateAccountSettings) {
                          onUpdateAccountSettings(acc.id, { personaTone: e.target.value as any });
                        }
                      }}
                      className="bg-slate-950 border border-slate-700 text-[11px] rounded px-2 py-0.5 text-slate-200 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="friendly">صمیمی و دوستانه (فرد عادی)</option>
                      <option value="expert_advisor">مشاور تخصصی و فنی</option>
                      <option value="concise_direct">ساده، سریع و مستقیم</option>
                      <option value="energetic_buyer">خریدار/عضو پرانرژی گروه</option>
                      <option value="supportive_polite">پشتیبان رسمی و محترمانه</option>
                    </select>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    سقف روزانه: {acc.dailyMessageQuota || 25}
                  </span>
                </div>

                {/* Personal Account & Strict Isolation Safety Shield */}
                {(() => {
                  const isPersonal = Boolean(acc.isPersonalAccount);
                  const isStrictIso = Boolean(acc.strictIsolationMode);
                  return (
                    <div className={`p-3 rounded-xl border transition-all ${
                      isPersonal
                        ? 'bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-950 border-purple-500/40 shadow-sm shadow-purple-950/50'
                        : 'bg-slate-900/40 border-slate-800/80'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-start sm:items-center gap-2">
                          <ShieldCheck className={`w-4 h-4 mt-0.5 sm:mt-0 shrink-0 ${isPersonal ? 'text-purple-400' : 'text-slate-500'}`} />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-200">
                                {isPersonal ? '🛡️ اکانت شخصی امن (حالت ایزولاسیون ۱۰۰٪ فعال)' : 'حالت کاربری اکانت:'}
                              </span>
                              {isPersonal && (
                                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.2 rounded-full font-bold">
                                  عدم مداخله در گروه‌های شخصی
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                              {isPersonal
                                ? 'این اکانت به عنوان حساب شخصی شما تنظیم شده است؛ ارسال پیام و شنود در تمام گروه‌های شخصی، کاری و خانوادگی شما کاملاً مسدود و قفل است.'
                                : 'این اکانت به عنوان حساب ربات کاری تنظیم شده و در ارسال تبلیغات به گروه‌ها مشارکت می‌کند.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleModuleAction(acc.id, 'personal_account', isPersonal)}
                            disabled={loadingId === `${acc.id}_personal_account`}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                              isPersonal
                                ? 'bg-purple-600/30 border-purple-500/60 text-purple-200 hover:bg-purple-600/40'
                                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{isPersonal ? 'حالت شخصی (ایزوله)' : 'تبدیل به اکانت شخصی'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Granular Module Participation Checkboxes */}
                <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 block">
                      فعال‌سازی دستی قابلیت‌ها برای این اکانت:
                    </span>
                    <span className="text-[10px] text-slate-500">کنترل تفکیک‌شده</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {/* Inbound PV Auto-Reply Toggle (Prominent) */}
                    <button
                      type="button"
                      onClick={() => handleToggleModuleAction(acc.id, 'pv_reply', isPvReplyEnabled)}
                      disabled={loadingId === `${acc.id}_pv_reply`}
                      title={isPvReplyEnabled ? 'پاسخگویی خودکار به پی‌وی فعال است' : 'پاسخگویی خودکار خاموش است'}
                      className={`p-2.5 rounded-lg border text-right transition-all flex items-center justify-between ${
                        isPvReplyEnabled
                          ? 'bg-purple-500/15 border-purple-500/50 text-purple-200 font-bold shadow-sm shadow-purple-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <span className="text-[11px] block">پاسخ به پی‌وی (PV)</span>
                          <span className="text-[9px] text-slate-400 font-normal">
                            {isPvReplyEnabled ? 'هوش مصنوعی پاسخ می‌دهد' : 'خاموش (پاسخ دستی)'}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isPvReplyEnabled ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40' : 'bg-slate-800 text-slate-400'}`}>
                        {isPvReplyEnabled ? 'روشن' : 'خاموش'}
                      </span>
                    </button>

                    {/* Group Broadcast Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleModuleAction(acc.id, 'group_broadcast', isGroupBroadcastEnabled)}
                      disabled={loadingId === `${acc.id}_group_broadcast`}
                      className={`p-2.5 rounded-lg border text-right transition-all flex items-center justify-between ${
                        isGroupBroadcastEnabled
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Megaphone className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="text-[11px] block">ارسال به گروه‌ها</span>
                          <span className="text-[9px] text-slate-400 font-normal">
                            {isGroupBroadcastEnabled ? 'مجاز در گروه‌های هدف' : 'قفل شده (ایمن)'}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isGroupBroadcastEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                        {isGroupBroadcastEnabled ? 'روشن' : 'خاموش'}
                      </span>
                    </button>

                    {/* Anonymous Bot Automator Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleModuleAction(acc.id, 'anonymous_bot', isAnonymousBotEnabled)}
                      disabled={loadingId === `${acc.id}_anonymous_bot`}
                      className={`p-2.5 rounded-lg border text-right transition-all flex items-center justify-between ${
                        isAnonymousBotEnabled
                          ? 'bg-sky-500/10 border-sky-500/40 text-sky-200 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <span className="text-[11px] block">ربات ناشناس</span>
                          <span className="text-[9px] text-slate-400 font-normal">
                            {isAnonymousBotEnabled ? 'چت و تبلیغ فعال' : 'خاموش'}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isAnonymousBotEnabled ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'}`}>
                        {isAnonymousBotEnabled ? 'روشن' : 'خاموش'}
                      </span>
                    </button>
                  </div>

                  {/* Status Helper & Explanation */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/40 text-[10px] flex-wrap">
                    <div className={isPvReplyEnabled ? "text-purple-300 flex items-center gap-1 font-medium" : "text-slate-400 flex items-center gap-1"}>
                      {isPvReplyEnabled ? (
                        <>
                          <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                          <span>پاسخگویی خودکار ربات به پیام‌های ورودی پی‌وی این اکانت فعال و بیدار است.</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>پاسخگویی خودکار به پی‌وی خاموش است و پیام‌های شخصی را خودتان دستی جواب می‌دهید.</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Specific Support Account Notice */}
                  {isSupportAccount && (
                    <div className={`text-[10px] rounded-lg p-2 border flex items-center justify-between gap-2 mt-1 ${
                      isPvReplyEnabled
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>
                          {isPvReplyEnabled
                            ? '⚠️ اکانت پشتیبانی نوا: برای اینکه به پیام‌های ورودی پاسخ ندهد و خودتان شخصاً جواب دهید، دکمه «پاسخ به پی‌وی (PV)» را غیرفعال کنید.'
                            : '✅ تنظیم شده: اکانت به پیام‌های ورودی پی‌وی پاسخ نمی‌دهد (تا خودتان جواب دهید)، اما در صورت نیاز به تبلیغات، ریپلای در گروه یا ارسال پیام به پی‌وی لیدها بدون مانع عمل می‌کند.'}
                        </span>
                      </div>
                      {isPvReplyEnabled && (
                        <button
                          type="button"
                          onClick={() => handleToggleModuleAction(acc.id, 'pv_reply', true)}
                          className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-[10px] font-bold shrink-0 transition-all"
                        >
                          غیرفعال‌سازی سریع
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Account Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {!isPrimary && (
                      <button
                        onClick={() => handleSelectActive(acc.id)}
                        disabled={loadingId === acc.id}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-all"
                        title="انتخاب به عنوان اکانت پیش‌فرض برنامه"
                      >
                        اکانت اصلی
                      </button>
                    )}

                    {onVerifySingleAccount && (
                      <button
                        onClick={() => handleVerifySingle(acc.id)}
                        disabled={loadingId === `verify_${acc.id}`}
                        className="px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-bold transition-all flex items-center gap-1"
                        title="تست زنده اتصال نشست با تلگرام"
                      >
                        <Activity className={`w-3 h-3 ${loadingId === `verify_${acc.id}` ? 'animate-spin' : ''}`} />
                        <span>تست زنده</span>
                      </button>
                    )}

                    {/* Re-Auth / Renew Session Button */}
                    {onReauthAccount && (
                      <button
                        onClick={() => onReauthAccount(acc)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border ${
                          isExpired
                            ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30 animate-pulse'
                            : 'bg-indigo-600/20 hover:bg-indigo-600/30 border-indigo-500/30 text-indigo-300'
                        }`}
                        title="درخواست کد جدید ۵ رقمی تلگرام و تمدید نشست"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{isExpired ? 'تمدید فوری نشست' : 'تمدید نشست'}</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(acc.id)}
                    disabled={loadingId === acc.id}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="حذف کامل این اکانت از سیستم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};


