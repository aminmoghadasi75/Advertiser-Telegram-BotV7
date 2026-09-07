import React, { useState } from 'react';
import {
  ShieldCheck,
  Bot,
  UserPlus,
  Link,
  Check,
  Sparkles,
  Sliders,
  MessageSquare,
  Zap,
  Shuffle,
  Eye,
  Cpu,
  Hash,
  ShieldAlert,
  Shield,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
  EyeOff,
  LogOut,
  Trash2,
} from 'lucide-react';
import { AntiBotSettings } from '../types';

interface AntiBotSettingsCardProps {
  settings?: AntiBotSettings;
  onSaveAntiBotSettings: (settings: AntiBotSettings) => Promise<void>;
}

export const AntiBotSettingsCard: React.FC<AntiBotSettingsCardProps> = ({
  settings,
  onSaveAntiBotSettings,
}) => {
  // Safe defaults based on audit
  const [autoClickCaptcha, setAutoClickCaptcha] = useState(settings?.autoClickCaptcha ?? true);
  const [autoForceJoinChannels, setAutoForceJoinChannels] = useState(settings?.autoForceJoinChannels ?? true);
  const [autoInviteContacts, setAutoInviteContacts] = useState(settings?.autoInviteContacts ?? false);
  const [autoForceAddBypass, setAutoForceAddBypass] = useState(settings?.autoForceAddBypass ?? false);
  const [contactsToInviteCount, setContactsToInviteCount] = useState(settings?.contactsToInviteCount ?? 3);
  const [safeContactShield, setSafeContactShield] = useState(settings?.safeContactShield ?? true);
  const [sendGreetingFirst, setSendGreetingFirst] = useState(settings?.sendGreetingFirst ?? false);
  const [greetingMode, setGreetingMode] = useState<string>(settings?.greetingMode ?? 'stealth_silent');
  const [greetingMessage, setGreetingMessage] = useState(settings?.greetingMessage ?? 'سلام بچه ها');
  const [autoSolveMathCaptcha, setAutoSolveMathCaptcha] = useState(settings?.autoSolveMathCaptcha ?? true);
  const [safeMembershipRetention, setSafeMembershipRetention] = useState(settings?.safeMembershipRetention ?? true);
  const [enableFailoverRedistribution, setEnableFailoverRedistribution] = useState(settings?.enableFailoverRedistribution ?? false);
  const [supportForumTopics, setSupportForumTopics] = useState(settings?.supportForumTopics ?? true);
  const [autoLeaveAndPurgeAfterPost, setAutoLeaveAndPurgeAfterPost] = useState(settings?.autoLeaveAndPurgeAfterPost ?? false);
  const [autoPurgeDeletedGroupsFromTelegram, setAutoPurgeDeletedGroupsFromTelegram] = useState(settings?.autoPurgeDeletedGroupsFromTelegram ?? true);

  // 4 Core Upgrade Capabilities
  const [simulateTyping, setSimulateTyping] = useState(true); // Locked on in UI & Backend
  const [typingDurationSeconds, setTypingDurationSeconds] = useState(settings?.typingDurationSeconds ?? 2.5);
  const [enableSpintax, setEnableSpintax] = useState(settings?.enableSpintax ?? true);
  const [cacheMediaInput, setCacheMediaInput] = useState(true); // Locked on in UI & Backend
  const [verifyMessagePersistence, setVerifyMessagePersistence] = useState(settings?.verifyMessagePersistence ?? true);
  const [persistenceCheckDelaySeconds, setPersistenceCheckDelaySeconds] = useState(settings?.persistenceCheckDelaySeconds ?? 15);

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Interactive Live Force-Add Bypass Testing
  const [manualBypassTarget, setManualBypassTarget] = useState('@CocSeinor');
  const [isTestingBypass, setIsTestingBypass] = useState(false);
  const [bypassTestResult, setBypassTestResult] = useState<{ success: boolean; message: string; invitedCount?: number } | null>(null);

  const handleExecuteManualBypass = async () => {
    if (!manualBypassTarget.trim()) return;
    setIsTestingBypass(true);
    setBypassTestResult(null);
    try {
      const res = await fetch('/api/groups/bypass-force-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrLink: manualBypassTarget.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBypassTestResult({
          success: true,
          message: data.message || `قفل گروه با موفقیت شکسته شد.`,
          invitedCount: data.invitedCount,
        });
      } else {
        setBypassTestResult({
          success: false,
          message: data.error || 'خطا در عملیات رفع قفل گروه',
        });
      }
    } catch (err: any) {
      setBypassTestResult({
        success: false,
        message: err?.message || 'خطای شبکه در برقراری ارتباط با سرور',
      });
    } finally {
      setIsTestingBypass(false);
    }
  };

  // Auto-save whenever settings change
  const triggerAutoSave = async (overrides?: Partial<AntiBotSettings>) => {
    setIsSaving(true);
    try {
      await onSaveAntiBotSettings({
        autoClickCaptcha,
        autoForceJoinChannels,
        autoInviteContacts,
        autoForceAddBypass,
        contactsToInviteCount,
        safeContactShield: true,
        sendGreetingFirst,
        greetingMode: (greetingMode as any) || 'stealth_silent',
        greetingMessage,
        autoSolveMathCaptcha: true,
        safeMembershipRetention: true,
        enableFailoverRedistribution,
        supportForumTopics,
        simulateTyping: true,
        typingDurationSeconds,
        enableSpintax,
        cacheMediaInput: true,
        verifyMessagePersistence,
        persistenceCheckDelaySeconds,
        autoLeaveAndPurgeAfterPost,
        autoPurgeDeletedGroupsFromTelegram,
        ...overrides,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Presets
  const applyPreset = (preset: 'maximum_safety' | 'high_speed' | 'bypass_all') => {
    if (preset === 'maximum_safety') {
      const updates = {
        safeContactShield: true,
        safeMembershipRetention: true,
        simulateTyping: true,
        typingDurationSeconds: 2.5,
        enableSpintax: true,
        autoSolveMathCaptcha: true,
        autoClickCaptcha: true,
        supportForumTopics: true,
        cacheMediaInput: true,
        sendGreetingFirst: false,
        greetingMode: 'stealth_silent' as const,
        autoInviteContacts: false,
        autoForceAddBypass: false,
        verifyMessagePersistence: true,
      };
      setSafeContactShield(true);
      setSafeMembershipRetention(true);
      setSimulateTyping(true);
      setTypingDurationSeconds(2.5);
      setEnableSpintax(true);
      setAutoSolveMathCaptcha(true);
      setAutoClickCaptcha(true);
      setSupportForumTopics(true);
      setCacheMediaInput(true);
      setSendGreetingFirst(false);
      setGreetingMode('stealth_silent');
      setAutoInviteContacts(false);
      setAutoForceAddBypass(false);
      setVerifyMessagePersistence(true);
      triggerAutoSave(updates);
    } else if (preset === 'high_speed') {
      const updates = {
        cacheMediaInput: true,
        simulateTyping: true,
        typingDurationSeconds: 1.5,
        enableSpintax: true,
        autoClickCaptcha: true,
        supportForumTopics: true,
        autoSolveMathCaptcha: true,
        verifyMessagePersistence: false,
        safeContactShield: true,
        safeMembershipRetention: true,
        sendGreetingFirst: false,
        autoInviteContacts: false,
      };
      setCacheMediaInput(true);
      setSimulateTyping(true);
      setTypingDurationSeconds(1.5);
      setEnableSpintax(true);
      setAutoClickCaptcha(true);
      setSupportForumTopics(true);
      setAutoSolveMathCaptcha(true);
      setVerifyMessagePersistence(false);
      setSendGreetingFirst(false);
      setAutoInviteContacts(false);
      triggerAutoSave(updates);
    } else if (preset === 'bypass_all') {
      const updates = {
        autoClickCaptcha: true,
        autoSolveMathCaptcha: true,
        autoForceJoinChannels: true,
        supportForumTopics: true,
        simulateTyping: true,
        typingDurationSeconds: 2,
        safeMembershipRetention: true,
        cacheMediaInput: true,
        verifyMessagePersistence: true,
        sendGreetingFirst: false,
      };
      setAutoClickCaptcha(true);
      setAutoSolveMathCaptcha(true);
      setAutoForceJoinChannels(true);
      setSupportForumTopics(true);
      setSimulateTyping(true);
      setTypingDurationSeconds(2);
      setSafeMembershipRetention(true);
      setCacheMediaInput(true);
      setVerifyMessagePersistence(true);
      triggerAutoSave(updates);
    }
  };

  // Reusable Switch Component
  const ToggleSwitch = ({
    checked,
    onChange,
    disabled = false,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-indigo-600' : 'bg-slate-800'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? '-translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-xl space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              سیستم هوشمند ضد اسپم و سپر امنیتی اکانت
              <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                حفاظت فعال
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تنظیمات خودکار شبیه‌سازی رفتار انسان، خنثی‌سازی ربات‌های ناظر، کش مدیا و پیشگیری قطعی از ریپورت
            </p>
          </div>
        </div>

        {/* Action / Save Status */}
        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 animate-in fade-in duration-200">
              <Check className="w-3.5 h-3.5" /> ذخیره شد
            </span>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => triggerAutoSave()}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</span>
          </button>
        </div>
      </div>

      {/* 1. Core Always-Active Protections (Reassuring Banner) */}
      <div className="bg-emerald-950/20 border border-emerald-500/25 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-emerald-300 font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>محافظت‌های بنیادی سیستم (همواره فعال به صورت سیستمی):</span>
          </span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold">
            100% Anti-Ban
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="text-slate-200 font-medium">شبیه‌سازی تایپینگ انسان</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="text-slate-200 font-medium">کش فایل و کاهش ترافیک</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="text-slate-200 font-medium">حل خودکار آزمون‌های ریاضی</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="text-slate-200 font-medium">سپر محافظت از مخاطبین</span>
          </div>
        </div>
      </div>

      {/* 2. Quick 1-Click Profile Presets */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>پروفایل‌های پیشنهادی (انتخاب سریع با یک کلیک):</span>
          </span>
          <span className="text-[11px] text-slate-500">پیکربندی هوشمند همه گزینه‌ها</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => applyPreset('maximum_safety')}
            className="px-3 py-2.5 rounded-xl bg-slate-900 border border-emerald-500/40 hover:border-emerald-500 text-right transition-all group flex items-center justify-between"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>حداکثر امنیت و ضد بن</span>
              </div>
              <div className="text-[10px] text-slate-400">بدون پیام تست، حالت استتار کامل</div>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">
              پیشنهادی
            </span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('high_speed')}
            className="px-3 py-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 hover:border-cyan-500 text-right transition-all group flex items-center justify-between"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-cyan-300 group-hover:text-cyan-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>حداکثر سرعت و بهره‌وری</span>
              </div>
              <div className="text-[10px] text-slate-400">کش سریع فایل و کمترین تاخیر</div>
            </div>
            <span className="text-[10px] bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 rounded font-mono font-bold">
              Fast Mode
            </span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('bypass_all')}
            className="px-3 py-2.5 rounded-xl bg-slate-900 border border-indigo-500/30 hover:border-indigo-500 text-right transition-all group flex items-center justify-between"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                <span>خنثی‌سازی کامل موانع</span>
              </div>
              <div className="text-[10px] text-slate-400">عبور از انواع ربات‌های خوش‌آمدگو</div>
            </div>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">
              AI Solver
            </span>
          </button>
        </div>
      </div>

      {/* 3. Essential User Controls */}
      <div className="space-y-3">
        {/* Spintax & Dynamic Masking */}
        <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 mt-0.5">
              <Shuffle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-white flex items-center gap-2">
                <span>تنوع‌بخشی به متن پیام‌ها با Spintax و متغیرهای پویا</span>
                <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono">
                  Anti-Fingerprint
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                جلوگیری از ارسال متن تکراری با تعویض هوشمند کلمات مشابه، درج ساعت و نام گروه.
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={enableSpintax}
            onChange={(checked) => {
              setEnableSpintax(checked);
              triggerAutoSave({ enableSpintax: checked });
            }}
          />
        </div>

        {/* Click Captcha Inline Buttons */}
        <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-white flex items-center gap-2">
                <span>کلیک خودکار دکمه‌های تایید ربات‌های ناظر گروه</span>
                <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1.5 py-0.2 rounded font-mono">
                  Inline Captcha
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                کلیک خودکار روی دکمه‌های شیشه‌ای «من ربات نیستم» و قوانین گروه در ربات‌های مدیریت (Rose, GroupHelp...).
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={autoClickCaptcha}
            onChange={(checked) => {
              setAutoClickCaptcha(checked);
              triggerAutoSave({ autoClickCaptcha: checked });
            }}
          />
        </div>

        {/* Force Join Channels */}
        <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
              <Link className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-white flex items-center gap-2">
                <span>عضویت خودکار در کانال‌های اجباری قفل گروه</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                  Channel Unlock
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                عضویت اتوماتیک در کانال اسپانسر گروه برای باز شدن قفل چت و ادامه ارسال پیام.
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={autoForceJoinChannels}
            onChange={(checked) => {
              setAutoForceJoinChannels(checked);
              triggerAutoSave({ autoForceJoinChannels: checked });
            }}
          />
        </div>

        {/* Manual Test Single Group Bypass */}
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>تست زنده خنثی‌سازی موانع روی یک گروه مشخص:</span>
            </span>
            {bypassTestResult && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                bypassTestResult.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {bypassTestResult.success ? 'موفق' : 'خطا'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manualBypassTarget}
              onChange={(e) => setManualBypassTarget(e.target.value)}
              placeholder="مثلاً @CocSeinor یا لینک گروه"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono text-left focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={handleExecuteManualBypass}
              disabled={isTestingBypass || !manualBypassTarget.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shadow-sm"
            >
              {isTestingBypass ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>در حال بررسی...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>تست رفع موانع</span>
                </>
              )}
            </button>
          </div>
          {bypassTestResult && (
            <div className={`p-2 rounded text-[11px] leading-relaxed flex items-start gap-1.5 ${
              bypassTestResult.success
                ? 'bg-emerald-950/50 border border-emerald-800/60 text-emerald-200'
                : 'bg-rose-950/50 border border-rose-800/60 text-rose-200'
            }`}>
              {bypassTestResult.success ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{bypassTestResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3b. Zero-Trace Telegram Clean & Automatic Purge */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/20 via-slate-900/60 to-purple-950/20 border border-rose-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <EyeOff className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <span>پاک‌سازی خودکار و ریشه‌ای از محیط تلگرام (Zero-Trace Telegram)</span>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                  محوسازی ۱۰۰٪
                </span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                خروج، پاک‌سازی تاریخچه و حذف کامل دیالوگ از داخل کلاینت تلگرام شما جوری که هرگز اثری از گروه نبینید.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          {/* Toggle 1: Auto purge when deleting from dashboard */}
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
            <div>
              <span className="text-xs font-semibold text-slate-200">خروج و محوسازی خودکار از تلگرام هنگام حذف از سامانه</span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                با زدن دکمه حذف هر گروه، اکانت‌ها بلافاصله لفت داده و چت و دیالوگ آن به صورت ریشه‌ای از محیط تلگرام پاک می‌شود.
              </p>
            </div>
            <ToggleSwitch
              checked={autoPurgeDeletedGroupsFromTelegram}
              onChange={(checked) => {
                setAutoPurgeDeletedGroupsFromTelegram(checked);
                triggerAutoSave({ autoPurgeDeletedGroupsFromTelegram: checked });
              }}
            />
          </div>

          {/* Toggle 2: Auto leave immediately after successful broadcast */}
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
            <div>
              <span className="text-xs font-semibold text-slate-200">خروج و پاک‌سازی خودکار از تلگرام بلافاصله پس از ارسال موفق</span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                به محض اینکه آگهی در گروه ارسال شد، اکانت همان لحظه لفت داده و چت را پاک می‌کند تا تلگرام شما شلوغ نشود.
              </p>
            </div>
            <ToggleSwitch
              checked={autoLeaveAndPurgeAfterPost}
              onChange={(checked) => {
                setAutoLeaveAndPurgeAfterPost(checked);
                triggerAutoSave({ autoLeaveAndPurgeAfterPost: checked });
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Collapsible Advanced Technical Settings */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900/60 transition-all text-right"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>تنظیمات پیشرفته و مهندسی ضد اسپم (اختیاری)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="text-[11px] font-normal">{isAdvancedOpen ? 'بستن' : 'مشاهده جزییات فنی'}</span>
            {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isAdvancedOpen && (
          <div className="p-4 space-y-3.5 border-t border-slate-800/80 bg-slate-950/90 animate-in fade-in duration-200">
            
            {/* Typing Duration */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-white">مدت زمان شبیه‌سازی تایپینگ (Typing Mimicry):</span>
                <p className="text-[11px] text-slate-400 mt-0.5">مدت ارسال وضعیت «در حال نوشتن...» قبل از انتشار پیام</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={8}
                  step={0.5}
                  value={typingDurationSeconds}
                  onChange={(e) => setTypingDurationSeconds(parseFloat(e.target.value) || 2.5)}
                  onBlur={() => triggerAutoSave()}
                  className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <span className="text-xs text-slate-400">ثانیه</span>
              </div>
            </div>

            {/* Persistence Check Delay */}
            <div className="flex items-center justify-between gap-3 text-xs pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-semibold text-white">تاخیر بررسی ماندگاری پیام (Persistence Audit Delay):</span>
                <p className="text-[11px] text-slate-400 mt-0.5">بررسی وضعیت پاک نشدن پیام توسط ربات‌های حذف خودکار</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={60}
                  step={5}
                  value={persistenceCheckDelaySeconds}
                  onChange={(e) => setPersistenceCheckDelaySeconds(parseInt(e.target.value, 10) || 15)}
                  onBlur={() => triggerAutoSave()}
                  className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <span className="text-xs text-slate-400">ثانیه</span>
              </div>
            </div>

            {/* Forum Topics Support */}
            <div className="flex items-center justify-between gap-3 text-xs pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-semibold text-white">پشتیبانی از سوپرگروه‌های فروم و تاپیک‌های تلگرام</span>
                <p className="text-[11px] text-slate-400 mt-0.5">شناسایی خودکار تاپیک عمومی/تبلیغات در گروه‌های تاپیک‌دار</p>
              </div>
              <ToggleSwitch
                checked={supportForumTopics}
                onChange={(checked) => {
                  setSupportForumTopics(checked);
                  triggerAutoSave({ supportForumTopics: checked });
                }}
              />
            </div>

            {/* Initial Greeting vs Stealth Mode */}
            <div className="flex items-center justify-between gap-3 text-xs pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-semibold text-white">ارسال پیام احوالپرسی اولیه (توصیه: خاموش برای استتار)</span>
                <p className="text-[11px] text-slate-400 mt-0.5">در حالت خاموش، ربات به صورت کاملاً بی‌صدا و بدون پیام آزمایشی عمل می‌کند</p>
              </div>
              <ToggleSwitch
                checked={sendGreetingFirst}
                onChange={(checked) => {
                  setSendGreetingFirst(checked);
                  triggerAutoSave({ sendGreetingFirst: checked, greetingMode: checked ? 'natural_greeting' : 'stealth_silent' });
                }}
              />
            </div>

            {/* Dangerous Option: Auto Invite Contacts */}
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-2 mt-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-xs text-rose-300">شکستن قفل با افزودن مخاطب (ریسک بالای ریپورت تلگرام)</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      ⚠️ تلگرام به افزودن مخاطب به گروه‌ها بسیار حساس است. جهت جلوگیری از خطای PEER_FLOOD و مسدودیت اکانت، این گزینه باید خاموش باشد.
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={autoInviteContacts}
                  onChange={(checked) => {
                    setAutoInviteContacts(checked);
                    setAutoForceAddBypass(checked);
                    triggerAutoSave({ autoInviteContacts: checked, autoForceAddBypass: checked });
                  }}
                />
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>تمامی فرآیندها به‌صورت هوشمند و شبیه‌سازی رفتار طبیعی انسان در تلگرام اجرا می‌گردند.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400">سپر دفاعی چندلایه فعال است</span>
        </div>
      </div>
    </div>
  );
};
