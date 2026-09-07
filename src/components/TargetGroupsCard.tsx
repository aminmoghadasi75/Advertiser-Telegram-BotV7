import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  ShieldAlert,
  Send,
  Layers,
  ListPlus,
  RefreshCw,
  LayoutList,
  LayoutGrid,
  Globe,
  Radio,
  Sparkles,
  Eye,
  UserCheck,
  UserPlus,
  Play,
  Square,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  Cpu,
  Check,
  Settings2,
  Bot,
  Shield,
  Ban,
  Divide,
  Zap,
  Calendar,
  Sliders,
  PauseCircle,
  PlayCircle,
  UserX,
  HelpCircle,
  CheckCheck,
  LogOut,
  EyeOff,
  Scale,
} from 'lucide-react';
import {
  TargetGroup,
  TelegramAccount,
  ActiveGroupJoinProgress,
  GroupJoinStrategy,
  AccountTerritorySummary,
  DripJoinConfig,
  TerritoryAuditReport,
} from '../types';

interface TargetGroupsCardProps {
  groups: TargetGroup[];
  accounts?: TelegramAccount[];
  dripJoinConfig?: DripJoinConfig;
  activeGroupJoinProgress?: ActiveGroupJoinProgress;
  groupJoinStrategy?: GroupJoinStrategy;
  onAddGroup: (title: string, usernameOrLink: string, category?: string) => Promise<void>;
  onAddBulkGroups: (bulkText: string, category?: string) => Promise<number>;
  onToggleGroup: (id: string, isActive: boolean) => Promise<void>;
  onToggleAllGroups: (isActive: boolean) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onDeletePostedGroups?: () => Promise<void>;
  onDeleteBulkGroupsByIds?: (ids: string[]) => Promise<void>;
  onTestSendTarget?: (target: string) => Promise<void>;
  onSyncGroups?: () => Promise<void>;
  onSyncRealtimeMemberships?: (accountIds?: string[]) => Promise<void>;
  onStartSmartJoin?: (options?: any) => Promise<void>;
  onStopSmartJoin?: () => Promise<void>;
  onJoinSingleGroup?: (groupId: string, accountId?: string) => Promise<void>;
  onUpdateJoinStrategy?: (strategy: GroupJoinStrategy) => Promise<void>;
  onAuditAndPurgeNonPersian?: (options?: { deleteFromDatabase?: boolean; scanDialogs?: boolean }) => Promise<any>;
}

export const TargetGroupsCard: React.FC<TargetGroupsCardProps> = ({
  groups,
  accounts = [],
  activeGroupJoinProgress,
  groupJoinStrategy,
  onAddGroup,
  onAddBulkGroups,
  onToggleGroup,
  onToggleAllGroups,
  onDeleteGroup,
  onDeletePostedGroups,
  onDeleteBulkGroupsByIds,
  onTestSendTarget,
  onSyncGroups,
  onSyncRealtimeMemberships,
  onStartSmartJoin,
  onStopSmartJoin,
  onJoinSingleGroup,
  onUpdateJoinStrategy,
  onAuditAndPurgeNonPersian,
}) => {
  // Navigation: Phase 1 (Territory Sharding & Safe Drip Join) vs Phase 2 (Smart Join Engine) vs Phase 3 (Group List & Ad Broadcast)
  const [activeTab, setActiveTab] = useState<'territory_hub' | 'join_hub' | 'groups_list'>('territory_hub');

  // Modals & State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPostedModal, setShowPostedModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [postedSearch, setPostedSearch] = useState('');
  const [selectedPostedIds, setSelectedPostedIds] = useState<string[]>([]);
  const [isDeletingPosted, setIsDeletingPosted] = useState(false);

  // Territory & Zero-Overlap Management State
  const [territoryReport, setTerritoryReport] = useState<TerritoryAuditReport | null>(null);
  const [isLoadingTerritory, setIsLoadingTerritory] = useState<boolean>(false);
  const [isBalancingTerritory, setIsBalancingTerritory] = useState<boolean>(false);
  const [dripConfig, setDripConfig] = useState<DripJoinConfig | null>(null);
  const [isTogglingDrip, setIsTogglingDrip] = useState<boolean>(false);
  const [isTriggeringDrip, setIsTriggeringDrip] = useState<boolean>(false);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [leavingDuplicateId, setLeavingDuplicateId] = useState<string | null>(null);
  const [showDripSettingsModal, setShowDripSettingsModal] = useState<boolean>(false);
  const [dripMaxJoins, setDripMaxJoins] = useState<number>(8);
  const [dripInterval, setDripInterval] = useState<number>(20);

  // Group Form State
  const [addMode, setAddMode] = useState<'bulk' | 'single'>('bulk');
  const [newTitle, setNewTitle] = useState('');
  const [newLink, setNewLink] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [newCategory, setNewCategory] = useState('عمومی');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [membershipFilter, setMembershipFilter] = useState<'all' | 'ready' | 'captcha_required' | 'unjoined' | 'no_permission_left' | 'active' | 'persian_verified' | 'purged_non_persian'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('همه');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Loading & In-Flight Status
  const [loading, setLoading] = useState(false);
  const [isSyncingMemberships, setIsSyncingMemberships] = useState(false);
  const [isStartingJoin, setIsStartingJoin] = useState(false);
  const [isStoppingJoin, setIsStoppingJoin] = useState(false);
  const [joiningSingleId, setJoiningSingleId] = useState<string | null>(null);
  const [isVerifyingPersistence, setIsVerifyingPersistence] = useState(false);
  const [testingTarget, setTestingTarget] = useState<string | null>(null);
  const [isPurgingInvalid, setIsPurgingInvalid] = useState(false);
  const [isAuditingPersian, setIsAuditingPersian] = useState(false);
  const [solvingCaptchaGroup, setSolvingCaptchaGroup] = useState<TargetGroup | null>(null);
  const [manualCustomReply, setManualCustomReply] = useState<string>('');
  const [isRetryingCaptcha, setIsRetryingCaptcha] = useState<boolean>(false);

  // Telegram Zero-Trace Leave & Purge State
  const [selectedTargetGroupIds, setSelectedTargetGroupIds] = useState<string[]>([]);
  const [leavingTelegramGroupId, setLeavingTelegramGroupId] = useState<string | null>(null);
  const [isBulkLeavingTelegram, setIsBulkLeavingTelegram] = useState<boolean>(false);
  const [isDeletingWithTelegramPurge, setIsDeletingWithTelegramPurge] = useState<boolean>(false);
  const [actionNotification, setActionNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setActionNotification({ type, message });
    setTimeout(() => {
      setActionNotification(null);
    }, 6000);
  };

  // Single group leave & purge from Telegram
  const handleLeaveTelegramGroup = async (group: TargetGroup, deleteFromApp: boolean = false) => {
    setLeavingTelegramGroupId(group.id);
    try {
      if (deleteFromApp) {
        await onDeleteGroup(group.id);
        if (onSyncGroups) await onSyncGroups();
        showNotification('success', `🗑️ گروه "${group.title}" با موفقیت حذف گردید و از تلگرام نیز لفت داده و محو شد.`);
      } else {
        const res = await fetch('/api/groups/leave-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: group.id, deleteFromApp: false }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (onSyncGroups) await onSyncGroups();
          showNotification('success', `✅ ${data.message || 'گروه با موفقیت از محیط تلگرام لفت داده شد و چت آن پاک گردید.'}`);
        } else {
          showNotification('error', `خطا: ${data.error || 'عملیات ناموفق بود'}`);
        }
      }
    } catch (err: any) {
      showNotification('error', `خطا در لفت و پاکسازی از تلگرام: ${err.message || err}`);
    } finally {
      setLeavingTelegramGroupId(null);
    }
  };

  // Bulk leave & purge from Telegram
  const handleBulkLeaveTelegram = async (deleteFromApp: boolean = false) => {
    if (selectedTargetGroupIds.length === 0) return;
    const count = selectedTargetGroupIds.length;

    setIsBulkLeavingTelegram(true);
    try {
      if (deleteFromApp && onDeleteBulkGroupsByIds) {
        await (onDeleteBulkGroupsByIds as any)(selectedTargetGroupIds);
        setSelectedTargetGroupIds([]);
        if (onSyncGroups) await onSyncGroups();
        showNotification('success', `🗑️ تعداد ${count} گروه با موفقیت حذف شده و از محیط تلگرام نیز محو گردیدند.`);
      } else {
        const res = await fetch('/api/groups/leave-bulk-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupIds: selectedTargetGroupIds, deleteFromApp: false }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSelectedTargetGroupIds([]);
          if (onSyncGroups) await onSyncGroups();
          showNotification('success', `✅ ${data.message || `تعداد ${data.successCount} گروه با موفقیت از محیط تلگرام پاکسازی شدند.`}`);
        } else {
          showNotification('error', `خطا: ${data.error || 'عملیات ناموفق بود'}`);
        }
      }
    } catch (err: any) {
      showNotification('error', `خطا در لفت دسته‌جمعی از تلگرام: ${err.message || err}`);
    } finally {
      setIsBulkLeavingTelegram(false);
    }
  };

  // Toggle selection for a group
  const toggleSelectGroup = (id: string) => {
    if (selectedTargetGroupIds.includes(id)) {
      setSelectedTargetGroupIds(selectedTargetGroupIds.filter(gId => gId !== id));
    } else {
      setSelectedTargetGroupIds([...selectedTargetGroupIds, id]);
    }
  };

  // Select/Deselect all filtered groups
  const toggleSelectAllFiltered = () => {
    if (selectedTargetGroupIds.length === filteredGroups.length && filteredGroups.length > 0) {
      setSelectedTargetGroupIds([]);
    } else {
      setSelectedTargetGroupIds(filteredGroups.map(g => g.id));
    }
  };

  // Fetch Territory Audit & Drip Config
  const fetchTerritoryAudit = async () => {
    setIsLoadingTerritory(true);
    try {
      const res = await fetch('/api/groups/territory-audit');
      const data = await res.json();
      if (data.report) {
        setTerritoryReport(data.report);
      }
    } catch (e) {
      console.error('Failed to fetch territory audit:', e);
    } finally {
      setIsLoadingTerritory(false);
    }
  };

  const fetchDripStatus = async () => {
    try {
      const res = await fetch('/api/groups/drip-join/status');
      const data = await res.json();
      if (data.config) {
        setDripConfig(data.config);
        setDripMaxJoins(data.config.maxJoinsPerAccountPerDay || 8);
        setDripInterval(data.config.intervalMinutes || 20);
      }
    } catch (e) {
      console.error('Failed to fetch drip status:', e);
    }
  };

  useEffect(() => {
    fetchTerritoryAudit();
    fetchDripStatus();
    const interval = setInterval(() => {
      fetchTerritoryAudit();
      fetchDripStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchTerritoryAudit();
  }, [groups]);

  const handleAutoBalanceTerritories = async () => {
    setIsBalancingTerritory(true);
    try {
      const res = await fetch('/api/groups/auto-balance-territories', { method: 'POST' });
      const data = await res.json();
      if (data.report) setTerritoryReport(data.report);
      if (onSyncGroups) await onSyncGroups();
      showNotification('success', data.message || '✅ تفکیک و توازن قلمروها با موفقیت انجام شد.');
    } catch (err: any) {
      showNotification('error', 'خطا در توازن قلمروها: ' + (err.message || err));
    } finally {
      setIsBalancingTerritory(false);
    }
  };

  const handleToggleDripJoin = async () => {
    setIsTogglingDrip(true);
    try {
      const res = await fetch('/api/groups/drip-join/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.config) setDripConfig(data.config);
      await fetchTerritoryAudit();
    } catch (err: any) {
      alert('خطا در تغییر وضعیت عضویت قطره‌چکانی: ' + (err.message || err));
    } finally {
      setIsTogglingDrip(false);
    }
  };

  const handleSaveDripSettings = async () => {
    try {
      const res = await fetch('/api/groups/drip-join/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxJoinsPerAccountPerDay: Number(dripMaxJoins),
          intervalMinutes: Number(dripInterval),
        }),
      });
      const data = await res.json();
      if (data.config) setDripConfig(data.config);
      setShowDripSettingsModal(false);
      alert('تنظیمات عضویت امن و قطره‌چکانی با موفقیت ذخیره شد.');
    } catch (err: any) {
      alert('خطا در ذخیره تنظیمات: ' + (err.message || err));
    }
  };

  const handleTriggerDripNow = async () => {
    setIsTriggeringDrip(true);
    try {
      const res = await fetch('/api/groups/drip-join/trigger-now', { method: 'POST' });
      const data = await res.json();
      if (data.config) setDripConfig(data.config);
      await fetchTerritoryAudit();
      if (onSyncGroups) await onSyncGroups();
      alert('✅ یک نوبت بررسی عضویت قطره‌چکانی با موفقیت اجرا شد.');
    } catch (err: any) {
      alert('خطا در اجرای مرحله قطره‌چکانی: ' + (err.message || err));
    } finally {
      setIsTriggeringDrip(false);
    }
  };

  const handleLeaveDuplicate = async (groupId: string, accountIdToLeave: string) => {
    setLeavingDuplicateId(`${groupId}_${accountIdToLeave}`);
    try {
      const res = await fetch('/api/groups/leave-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, accountIdToLeave }),
      });
      const data = await res.json();
      if (data.report) setTerritoryReport(data.report);
      if (onSyncGroups) await onSyncGroups();
      showNotification('success', data.message || 'اکانت با موفقیت از گروه تکراری خارج شد.');
    } catch (err: any) {
      showNotification('error', 'خطا در خروج از گروه تکراری: ' + (err.message || err));
    } finally {
      setLeavingDuplicateId(null);
    }
  };

  const [isResolvingOverlaps, setIsResolvingOverlaps] = useState(false);
  const [balanceResultBanner, setBalanceResultBanner] = useState<string | null>(null);

  const handleResolveAllOverlapsBalanced = async () => {
    setIsResolvingOverlaps(true);
    setBalanceResultBanner(null);
    try {
      const res = await fetch('/api/groups/resolve-all-overlaps-balanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در رفع تداخل‌ها');
      }
      if (data.report) setTerritoryReport(data.report);
      if (onSyncGroups) await onSyncGroups();
      setBalanceResultBanner(data.message || 'تمام تداخل‌ها با موفقیت رفع و بار اکانت‌ها متوازن گردید.');
      showNotification('success', `✅ ${data.message || 'تمام تداخل‌ها با موفقیت رفع شد.'}`);
    } catch (err: any) {
      showNotification('error', 'خطا در رفع خودکار تداخل‌ها: ' + (err.message || err));
    } finally {
      setIsResolvingOverlaps(false);
    }
  };

  // Persian Audience Screening & Blacklist Management
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [blacklistItems, setBlacklistItems] = useState<string[]>([]);
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [isLoadingBlacklist, setIsLoadingBlacklist] = useState(false);
  const [isCleaningPurgedDb, setIsCleaningPurgedDb] = useState(false);
  const [persianStats, setPersianStats] = useState<{
    totalPersianVerified?: number;
    totalPurgedNonPersian?: number;
    blacklistCount?: number;
  } | null>(null);

  const fetchPersianStats = async () => {
    try {
      const res = await fetch('/api/groups/persian-stats');
      const data = await res.json();
      setPersianStats(data);
    } catch (e) {
      console.error('Failed to fetch persian stats:', e);
    }
  };

  useEffect(() => {
    fetchPersianStats();
  }, [groups]);

  const handleOpenBlacklistModal = async () => {
    setShowBlacklistModal(true);
    setIsLoadingBlacklist(true);
    try {
      const res = await fetch('/api/groups/non-persian-blacklist');
      const data = await res.json();
      setBlacklistItems(data.blacklist || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingBlacklist(false);
    }
  };

  const handleClearBlacklist = async () => {
    if (!window.confirm('آیا از پاک کردن کامل لیست سیاه گروه‌های مسدود غیرایرانی اطمینان دارید؟')) return;
    try {
      await fetch('/api/groups/non-persian-blacklist/clear', { method: 'POST' });
      setBlacklistItems([]);
      await fetchPersianStats();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCleanPurgedFromDb = async () => {
    if (!window.confirm(`آیا مایلید تمام ${purgedNonPersianCount} گروه غیرفارسی اخراج‌شده به طور کامل از دیتابیس حذف شوند تا فضای جدول گروه‌ها پاک و منظم شود؟`)) return;
    setIsCleaningPurgedDb(true);
    try {
      const resp = await fetch('/api/groups/clean-purged-from-db', { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        if (onSyncGroups) await onSyncGroups();
        await fetchPersianStats();
        alert(`تعداد ${data.removedCount || 0} گروه غیرایرانی اخراج‌شده با موفقیت و به طور کامل از پایگاه داده حذف شدند.`);
      }
    } catch (e: any) {
      alert('خطا در پاکسازی از دیتابیس: ' + (e?.message || e));
    } finally {
      setIsCleaningPurgedDb(false);
    }
  };

  // Custom Join Strategy form state
  const [strategyMode, setStrategyMode] = useState<'balanced_distribution' | 'redundant_all_accounts'>(
    groupJoinStrategy?.mode === 'redundant_all_accounts' ? 'redundant_all_accounts' : 'balanced_distribution'
  );
  const [delaySeconds, setDelaySeconds] = useState<number>(groupJoinStrategy?.delayBetweenJoinsSeconds || 10);
  const [autoAntibot, setAutoAntibot] = useState<boolean>(groupJoinStrategy?.autoResolveAntibotOnJoin ?? true);
  const [leaveIfNoSendPermission, setLeaveIfNoSendPermission] = useState<boolean>(groupJoinStrategy?.leaveIfNoSendPermission ?? true);
  const [enforcePersianIranianOnly, setEnforcePersianIranianOnly] = useState<boolean>(groupJoinStrategy?.enforcePersianIranianOnly ?? true);
  const [sendGreetingTest, setSendGreetingTest] = useState<boolean>(groupJoinStrategy?.sendGreetingTest ?? true);
  const [greetingMessage, setGreetingMessage] = useState<string>(groupJoinStrategy?.greetingMessage || 'سلام بچه ها');
  const [verifyGreetingSurvival, setVerifyGreetingSurvival] = useState<boolean>(groupJoinStrategy?.verifyGreetingSurvival ?? true);
  const [autoSolveAllCaptchas, setAutoSolveAllCaptchas] = useState<boolean>(groupJoinStrategy?.autoSolveAllCaptchas ?? true);

  // Computed 4-State Lifecycle Metrics
  const totalGroupsCount = groups.length;
  const readyGroups = groups.filter((g) => g.readinessStatus === 'ready');
  const captchaRequiredGroups = groups.filter((g) => g.readinessStatus === 'captcha_required');
  const unjoinedGroups = groups.filter(
    (g) =>
      g.readinessStatus === 'unjoined' ||
      (!g.readinessStatus && g.membershipStatus !== 'joined' && (!g.joinedAccountIds || g.joinedAccountIds.length === 0))
  );
  const invalidGroups = groups.filter((g) => g.readinessStatus === 'no_permission_left');
  const joinedGroups = groups.filter((g) => g.membershipStatus === 'joined' || (g.joinedAccountIds && g.joinedAccountIds.length > 0));
  const persianVerifiedCount = groups.filter((g) => g.isPersianVerified).length;
  const purgedNonPersianCount = groups.filter((g) => g.status === 'purged_non_persian' || g.readinessStatus === 'non_persian_purged').length;
  const activeCount = groups.filter((g) => g.isActive).length;
  const isJoinEngineRunning = Boolean(activeGroupJoinProgress?.isRunning);

  // Available Active Accounts
  const availableAccounts = accounts.filter(
    (a) => a.isActive && a.status !== 'session_expired' && a.status !== 'disabled' && a.enableForGroupBroadcast !== false
  );

  // Filtered Groups
  const categories = ['همه', ...Array.from(new Set(groups.map((g) => g.category || 'عمومی')))];

  const filteredGroups = groups.filter((g) => {
    const matchesSearch =
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.usernameOrLink.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'همه' || g.category === selectedCategory;

    let matchesMembership = true;
    if (membershipFilter === 'ready') {
      matchesMembership = g.readinessStatus === 'ready';
    } else if (membershipFilter === 'captcha_required') {
      matchesMembership = g.readinessStatus === 'captcha_required';
    } else if (membershipFilter === 'unjoined') {
      matchesMembership =
        g.readinessStatus === 'unjoined' ||
        (!g.readinessStatus && g.membershipStatus !== 'joined' && (!g.joinedAccountIds || g.joinedAccountIds.length === 0));
    } else if (membershipFilter === 'no_permission_left') {
      matchesMembership = g.readinessStatus === 'no_permission_left';
    } else if (membershipFilter === 'active') {
      matchesMembership = g.isActive;
    } else if (membershipFilter === 'persian_verified') {
      matchesMembership = Boolean(g.isPersianVerified);
    } else if (membershipFilter === 'purged_non_persian') {
      matchesMembership = g.status === 'purged_non_persian' || g.readinessStatus === 'non_persian_purged';
    }

    const matchesAccount =
      selectedAccountFilter === 'all'
        ? true
        : selectedAccountFilter === 'overlaps'
        ? Boolean(g.hasOverlap || (g.duplicateAccountIds && g.duplicateAccountIds.length > 1))
        : selectedAccountFilter === 'unassigned'
        ? !g.assignedAccountId
        : g.assignedAccountId === selectedAccountFilter;

    return matchesSearch && matchesCategory && matchesMembership && matchesAccount;
  });

  const postedGroups = groups.filter(
    (g) => g.lastPostedAt && (!g.errorMessage || g.errorMessage.trim() === '')
  );

  const filteredPostedGroups = postedGroups.filter(
    (g) =>
      g.title.toLowerCase().includes(postedSearch.toLowerCase()) ||
      g.usernameOrLink.toLowerCase().includes(postedSearch.toLowerCase())
  );

  // Handlers
  const handleSyncMemberships = async () => {
    if (isSyncingMemberships) return;
    setIsSyncingMemberships(true);
    try {
      if (onSyncRealtimeMemberships) {
        await onSyncRealtimeMemberships();
      } else if (onSyncGroups) {
        await onSyncGroups();
      }
      await fetchTerritoryAudit();
    } finally {
      setIsSyncingMemberships(false);
    }
  };

  const handleStartSmartJoinClick = async () => {
    if (!onStartSmartJoin || isStartingJoin) return;
    setIsStartingJoin(true);
    try {
      await onStartSmartJoin({
        mode: strategyMode,
        delaySeconds: delaySeconds,
        autoResolveAntibot: autoAntibot,
      });
    } finally {
      setIsStartingJoin(false);
    }
  };

  const handleStopSmartJoinClick = async () => {
    if (!onStopSmartJoin || isStoppingJoin) return;
    setIsStoppingJoin(true);
    try {
      await onStopSmartJoin();
    } finally {
      setIsStoppingJoin(false);
    }
  };

  const handleJoinSingle = async (groupId: string) => {
    if (!onJoinSingleGroup || joiningSingleId) return;
    setJoiningSingleId(groupId);
    try {
      await onJoinSingleGroup(groupId);
    } finally {
      setJoiningSingleId(null);
    }
  };

  const handleSaveStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateJoinStrategy) {
      await onUpdateJoinStrategy({
        mode: strategyMode,
        delayBetweenJoinsSeconds: delaySeconds,
        maxJoinsPerAccountPerHour: 15,
        autoResolveAntibotOnJoin: autoAntibot,
        leaveIfNoSendPermission,
        enforcePersianIranianOnly,
        sendGreetingTest,
        greetingMessage,
        verifyGreetingSurvival,
        autoSolveAllCaptchas,
      });
    }
    setShowStrategyModal(false);
  };

  const handleAuditAndPurgeNonPersianClick = async () => {
    if (isAuditingPersian) return;
    const confirmMsg =
      'آیا مایلید تمام گروه‌ها از نظر زبان، کاراکترها و مخاطبان ایرانی غربالگری ۵ لایه شوند و هر گروه غیرایرانی (هندی، روسی، عربی، انگلیسی و...) از تمام اکانت‌های متصل لفت داده و چت آن پاک شود؟\n\nهمچنین کل پیام‌های گفت‌وگوهای اکانت‌های تلگرام نیز پایش شده و گروه‌های خارجی اخراج خواهند شد.';
    if (!window.confirm(confirmMsg)) return;

    const deleteFromDb = window.confirm(
      'آیا مایلید گروه‌های غیرایرانی علاوه بر لفت از تلگرام، مستقیماً از لیست دیتابیس نیز به طور کامل پاک شوند؟\n\n[OK] = لفت از تلگرام + حذف دائمی از پایگاه داده\n[Cancel] = فقط لفت از تلگرام و علامت‌گذاری به عنوان غیرفارسی'
    );

    setIsAuditingPersian(true);
    try {
      let res: any = null;
      if (onAuditAndPurgeNonPersian) {
        res = await onAuditAndPurgeNonPersian({ deleteFromDatabase: deleteFromDb, scanDialogs: true });
      } else {
        const resp = await fetch('/api/groups/audit-and-purge-non-persian', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deleteFromDatabase: deleteFromDb, scanDialogs: true }),
        });
        res = await resp.json();
        if (onSyncGroups) await onSyncGroups();
      }

      await fetchPersianStats();

      if (res?.success) {
        alert(
          `غربالگری با موفقیت انجام شد:\n` +
          `🇮🇷 ${res.totalPersianVerified || 0} گروه ۱۰۰٪ فارسی و ایرانی تایید شدند\n` +
          `🚫 ${res.totalPurged || 0} گروه غیرایرانی از تلگرام لفت داده و مسدود شدند\n` +
          (deleteFromDb ? `🗑️ رکوردهای اخراج‌شده از پایگاه داده نیز پاک شدند.` : `🏷️ رکوردهای اخراج‌شده برچسب غیرایرانی دریافت کردند.`)
        );
      }
    } catch (e: any) {
      alert('خطا در غربالگری گروه‌های غیرفارسی: ' + (e?.message || e));
    } finally {
      setIsAuditingPersian(false);
    }
  };

  const handlePurgeInvalidGroups = async () => {
    if (invalidGroups.length === 0) return;
    if (!window.confirm(`آیا از پاکسازی و حذف کامل ${invalidGroups.length} گروه فاقد اجازه ارسال اطمینان دارید؟`)) return;
    setIsPurgingInvalid(true);
    try {
      const resp = await fetch('/api/groups/purge-invalid', { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        if (onSyncGroups) await onSyncGroups();
      }
    } catch (e: any) {
      alert('خطا در پاکسازی گروه‌ها: ' + (e?.message || e));
    } finally {
      setIsPurgingInvalid(false);
    }
  };

  const [isReverifyingAll, setIsReverifyingAll] = useState(false);

  const handleRetryCaptchaVerification = async (
    groupId: string,
    options?: {
      customReply?: string;
      buttonRow?: number;
      buttonCol?: number;
      joinSponsorUrl?: string;
    }
  ) => {
    setIsRetryingCaptcha(true);
    try {
      const resp = await fetch('/api/groups/retry-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          customReply: options?.customReply,
          buttonRow: options?.buttonRow,
          buttonCol: options?.buttonCol,
          joinSponsorUrl: options?.joinSponsorUrl,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        if (onSyncGroups) await onSyncGroups();
        if (data.verification?.isClear) {
          alert('تبریک! چالش برطرف شد و گروه ۱۰۰٪ آماده ارسال تبلیغات گردید.');
          setSolvingCaptchaGroup(null);
        } else {
          if (data.group) {
            setSolvingCaptchaGroup(data.group);
          }
          alert(data.verification?.statusMessage || 'چالش ربات محافظ ارزیابی شد. در صورت وجود دکمه یا قفل اسپانسر، آن را اعمال نمایید.');
        }
      } else {
        alert(data.error || 'خطا در ارزیابی مجدد');
      }
    } catch (e: any) {
      alert('خطا: ' + (e?.message || e));
    } finally {
      setIsRetryingCaptcha(false);
    }
  };

  const handleReverifyAllGroups = async (filterType: 'all' | 'ready_only' | 'captcha_only' = 'ready_only') => {
    if (!confirm(filterType === 'ready_only' 
      ? 'آیا مایلید تمام گروه‌های «۱۰۰٪ آماده» را راستی‌آزمایی مجدد کنید تا از سلامت کامل و امکان ارسال پیام مطمئن شوید؟' 
      : 'آیا مایلید تمام گروه‌ها را راستی‌آزمایی مجدد نمایید؟')) {
      return;
    }
    setIsReverifyingAll(true);
    try {
      const resp = await fetch('/api/groups/reverify-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterType }),
      });
      const data = await resp.json();
      alert(data.message || 'عملیات راستی‌آزمایی آغاز شد.');
      if (onSyncGroups) await onSyncGroups();
    } catch (e: any) {
      alert('خطا: ' + (e?.message || e));
    } finally {
      setIsReverifyingAll(false);
    }
  };

  const [isBypassingForceAdd, setIsBypassingForceAdd] = useState(false);

  const handleBypassForceAdd = async (groupId: string, usernameOrLink?: string) => {
    setIsBypassingForceAdd(true);
    try {
      const resp = await fetch('/api/groups/bypass-force-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, usernameOrLink }),
      });
      const data = await resp.json();
      if (data.success) {
        if (onSyncGroups) await onSyncGroups();
        alert(data.message || 'قفل اد اجباری گروه با موفقیت شکسته شد و چت برای ارسال پیام آزاد گردید.');
        setSolvingCaptchaGroup(null);
      } else {
        alert(data.error || 'خطا در شکستن قفل اد اجباری');
      }
    } catch (e: any) {
      alert('خطا: ' + (e?.message || e));
    } finally {
      setIsBypassingForceAdd(false);
    }
  };

  const handleVerifyAllPersistence = async () => {
    setIsVerifyingPersistence(true);
    try {
      const resp = await fetch('/api/groups/verify-persistence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkAll: true }),
      });
      const data = await resp.json();
      if (data.message) {
        alert(data.message);
      }
      if (onSyncGroups) {
        await onSyncGroups();
      }
    } catch (err: any) {
      alert('خطا در پایش ماندگاری پیام‌ها: ' + (err.message || err));
    } finally {
      setIsVerifyingPersistence(false);
    }
  };

  const handleDeleteAllPosted = async () => {
    if (!onDeletePostedGroups) return;
    if (postedGroups.length === 0) return;
    if (!window.confirm(`آیا از حذف تمامی ${postedGroups.length} گروه که پیام در آن‌ها با موفقیت ۱۰۰٪ ارسال شده است، اطمینان دارید؟`)) {
      return;
    }

    setIsDeletingPosted(true);
    try {
      await onDeletePostedGroups();
      setShowPostedModal(false);
      setSelectedPostedIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeletingPosted(false);
    }
  };

  const handleDeleteSelectedPosted = async () => {
    if (!onDeleteBulkGroupsByIds || selectedPostedIds.length === 0) return;
    if (!window.confirm(`آیا از حذف ${selectedPostedIds.length} گروه انتخاب‌شده اطمینان دارید؟`)) return;

    setIsDeletingPosted(true);
    try {
      if (typeof onDeleteBulkGroupsByIds === 'function') {
        await (onDeleteBulkGroupsByIds as any)(selectedPostedIds);
      }
      setSelectedPostedIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeletingPosted(false);
    }
  };

  const handleSingleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.trim()) return;

    setLoading(true);
    try {
      await onAddGroup(newTitle.trim() || newLink.trim(), newLink.trim(), newCategory);
      setNewTitle('');
      setNewLink('');
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;

    setLoading(true);
    try {
      await onAddBulkGroups(bulkInput, newCategory);
      setBulkInput('');
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleTest = async (target: string) => {
    if (!onTestSendTarget) return;
    setTestingTarget(target);
    try {
      await onTestSendTarget(target);
    } finally {
      setTestingTarget(null);
    }
  };

  const getTelegramUrl = (raw: string) => {
    let clean = raw.trim();
    if (clean.startsWith('http')) return clean;
    if (clean.startsWith('t.me/')) return 'https://' + clean;
    if (clean.startsWith('@')) return `https://t.me/${clean.substring(1)}`;
    return `https://t.me/${clean}`;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 text-slate-100 shadow-xl backdrop-blur-md flex flex-col space-y-4">
      
      {/* Top Header & Strategy Stage Segmented Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-white">مرکز هوشمند گروه‌ها و عضویت</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                استراتژی تفکیک دو فاز
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تفکیک کامل فرآیند ۱: عضویت هوشمند و همگام‌سازی واقعی | فرآیند ۲: صف ارسال تبلیغات
            </p>
          </div>
        </div>

        {/* Global Sync, Blacklist and Persian Audit Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleAuditAndPurgeNonPersianClick}
            disabled={isAuditingPersian || isSyncingMemberships}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-600/20 hover:from-emerald-500/30 hover:to-teal-600/30 text-emerald-300 font-bold text-xs border border-emerald-500/40 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            title="بررسی ۱۰۰٪ گروه‌ها با هوش مصنوعی و الگوهای زبانی و خروج و حذف خودکار گروه‌های غیرایرانی و غیرفارسی از تلگرام"
          >
            <ShieldCheck className={`w-3.5 h-3.5 text-emerald-400 ${isAuditingPersian ? 'animate-spin' : ''}`} />
            <span>{isAuditingPersian ? 'در حال غربالگری...' : '🇮🇷 غربالگری و پاکسازی غیرفارسی'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenBlacklistModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs border border-amber-500/30 transition-all active:scale-95 shadow-sm"
            title="مشاهده و مدیریت اهداف مسدود در لیست سیاه دائمی گروه‌های غیرایرانی"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>لیست سیاه ({persianStats?.blacklistCount ?? 0})</span>
          </button>

          <button
            onClick={handleSyncMemberships}
            disabled={isSyncingMemberships || isJoinEngineRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-blue-600/20 hover:from-sky-500/30 hover:to-blue-600/30 text-sky-300 font-bold text-xs border border-sky-500/30 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            title="استعلام و همگام‌سازی دقیق ۱۰۰٪ گفت‌وگوها و وضعیت واقعی عضویت در تمام اکانت‌های تلگرام"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMemberships ? 'animate-spin' : ''}`} />
            <span>{isSyncingMemberships ? 'در حال استعلام تلگرام...' : 'همگام‌سازی واقعی با تلگرام'}</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotification && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg ${
            actionNotification.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
              : actionNotification.type === 'error'
              ? 'bg-rose-950/50 border-rose-500/50 text-rose-200'
              : 'bg-indigo-950/50 border-indigo-500/50 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {actionNotification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {actionNotification.type === 'info' && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />}
            <span>{actionNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotification(null)}
            className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      )}

      {/* Three-Phase Tab Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('territory_hub')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'territory_hub'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Divide className="w-4 h-4" />
          <span>تفکیک قلمرو و عضویت امن ({territoryReport?.totalOverlapsDetected ? `${territoryReport.totalOverlapsDetected} تداخل ⚠️` : 'بدون تداخل ✅'})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('join_hub')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'join_hub'
              ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>فاز ۲: عضویت دسته‌ای هوشمند ({unjoinedGroups.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('groups_list')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'groups_list'
              ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>فاز ۳: لیست گروه‌ها و ارسال ({activeCount} فعال)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TERRITORY SHARDING, ZERO-OVERLAP & SAFE DRIP JOIN HUB */}
      {/* ========================================================================= */}
      {activeTab === 'territory_hub' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          
          {/* Informative Header / Policy Callout */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-white">
                  معماری تفکیک قلمرو بدون همپوشانی (Zero-Overlap Territory Sharding)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                  ویژه اکانت‌های عادی تلگرام
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                با توجه به محدودیت‌های سهمیه روزانه اکانت‌های معمولی تلگرام، هر گروه دقیقاً به یک اکانت اختصاص داده می‌شود تا از عضویت تکراری یا هدررفت ظرفیت جلوگیری گردد. در صورت بروز محدودیت موقت (FloodWait)، قلمرو اکانت قرنطینه مانده و منابع اکانت‌های دیگر هدر نخواهد رفت.
              </p>
            </div>

            {/* Quick Balance Button */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <button
                type="button"
                disabled={isBalancingTerritory}
                onClick={handleAutoBalanceTerritories}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 w-full md:w-auto"
                title="توازن و سهمیه‌بندی عادلانه گروه‌های باقیمانده بدون دستکاری گروه‌های عضو شده"
              >
                <Divide className={`w-4 h-4 ${isBalancingTerritory ? 'animate-spin' : ''}`} />
                <span>{isBalancingTerritory ? 'در حال تفکیک و توازن...' : 'توازن و تفکیک عادلانه قلمروها'}</span>
              </button>
            </div>
          </div>

          {/* 4 Metric Status Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Target Groups */}
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">کل گروه‌های هدف</div>
                  <div className="text-base font-bold text-sky-400 mt-0.5 font-mono">
                    {groups.length.toLocaleString('fa-IR')} <span className="text-[10px] text-slate-500 font-sans">گروه</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Unique Joined Groups */}
            <div className="bg-slate-950/80 border border-emerald-500/30 p-3.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">عضو شده‌های قطعی</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5 font-mono">
                    {joinedGroups.length.toLocaleString('fa-IR')} <span className="text-[10px] text-slate-500 font-sans">گروه</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                آماده ارسال ✓
              </span>
            </div>

            {/* Pending Unjoined Groups */}
            <div className="bg-slate-950/80 border border-amber-500/30 p-3.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">در صف پیوستن تدریجی</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5 font-mono">
                    {unjoinedGroups.length.toLocaleString('fa-IR')} <span className="text-[10px] text-slate-500 font-sans">گروه</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">
                سهمیه‌بندی شده
              </span>
            </div>

            {/* Overlap Status Card */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                (territoryReport?.totalOverlapsDetected || 0) > 0
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                    (territoryReport?.totalOverlapsDetected || 0) > 0
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-slate-800/40 text-emerald-400 border-slate-700/60'
                  }`}
                >
                  {(territoryReport?.totalOverlapsDetected || 0) > 0 ? (
                    <AlertCircle className="w-5 h-5 animate-pulse" />
                  ) : (
                    <CheckCheck className="w-5 h-5 text-emerald-400" />
                  )}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">تداخل مشترک</div>
                  <div className="text-base font-bold mt-0.5 font-mono">
                    {(territoryReport?.totalOverlapsDetected || 0).toLocaleString('fa-IR')}{' '}
                    <span className="text-[10px] text-slate-500 font-sans">گروه</span>
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  (territoryReport?.totalOverlapsDetected || 0) > 0
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {(territoryReport?.totalOverlapsDetected || 0) > 0 ? 'نیاز به آزادسازی' : 'صفر تداخل ✓'}
              </span>
            </div>
          </div>

          {/* Drip-Feed Join Controller & Safe Pace Settings Bar */}
          <div className="bg-slate-950/90 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isTogglingDrip}
                onClick={handleToggleDripJoin}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  dripConfig?.enabled ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
                title="روشن یا خاموش کردن عضویت تدریجی خودکار در پس‌زمینه"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    dripConfig?.enabled ? 'translate-x-0' : '-translate-x-5'
                  }`}
                />
              </button>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>سیستم عضویت امن و قطره‌چکانی روزانه (Drip-Feed Join)</span>
                  <span
                    className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                      dripConfig?.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {dripConfig?.enabled ? 'فعال و خودکار در حال اجرا 🟢' : 'غیرفعال ⏸️'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  سقف روزانه هر اکانت: <span className="text-sky-400 font-bold font-mono">{dripConfig?.maxJoinsPerAccountPerDay ?? 8}</span> گروه • فاصله بین عضویت‌ها: <span className="text-sky-400 font-bold font-mono">{dripConfig?.intervalMinutes ?? 20}</span> دقیقه
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={isTriggeringDrip}
                onClick={handleTriggerDripNow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                title="بررسی و اجرای فوری یک نوبت پیوستن به گروه برای اکانت‌های دارای ظرفیت"
              >
                <PlayCircle className={`w-3.5 h-3.5 ${isTriggeringDrip ? 'animate-spin' : ''}`} />
                <span>{isTriggeringDrip ? 'در حال اجرا...' : 'اجرای دستی ۱ مرحله'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDripSettingsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium transition-all"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span>تنظیم سقف و فواصل</span>
              </button>
            </div>
          </div>

          {/* Account Territory Breakdown Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>وضعیت قلمرو و سهمیه هر اکانت تلگرام ({territoryReport?.accounts?.length || accounts.length} اکانت)</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                هر اکانت فقط مسئول گروه‌های حوزه اختصاصی خود است
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(territoryReport?.accounts && territoryReport.accounts.length > 0
                ? territoryReport.accounts
                : accounts.map((a) => {
                    const accJoined = groups.filter((g) => g.joinedAccountIds?.includes(a.id)).length;
                    const accAssigned = groups.filter((g) => g.assignedAccountId === a.id).length;
                    return {
                      accountId: a.id,
                      accountPhone: a.phoneNumber,
                      accountName: a.userProfile?.firstName,
                      isActive: a.isActive,
                      status: 'active' as const,
                      totalAssignedGroups: accAssigned,
                      joinedGroupsCount: accJoined,
                      pendingJoinCount: Math.max(0, accAssigned - accJoined),
                      overlapCount: 0,
                      dailyJoinsCompletedToday: 0,
                      dailyJoinQuotaRemaining: 8,
                    };
                  })
              ).map((accSummary, idx) => {
                const percentJoined =
                  accSummary.totalAssignedGroups > 0
                    ? Math.min(100, Math.round((accSummary.joinedGroupsCount / accSummary.totalAssignedGroups) * 100))
                    : 0;

                const isFloodWait = accSummary.status === 'flood_wait';
                const isDailyFull = accSummary.dailyJoinQuotaRemaining <= 0;

                return (
                  <div
                    key={accSummary.accountId}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3"
                  >
                    {/* Account Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{accSummary.accountName || `اکانت ${idx + 1}`}</span>
                            <span className="font-mono text-[11px] text-indigo-300 dir-ltr">
                              {accSummary.accountPhone}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            شناسه قلمرو: {accSummary.accountId.substring(0, 14)}...
                          </div>
                        </div>
                      </div>

                      {/* Status Tag */}
                      {isFloodWait ? (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1" title={accSummary.statusMessage}>
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          قرنطینه موقت (FloodWait)
                        </span>
                      ) : isDailyFull ? (
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCheck className="w-3 h-3 text-purple-400" />
                          سقف امروز تکمیل شد
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          فعال و آماده
                        </span>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400">قلمرو اختصاصی</div>
                        <div className="text-xs font-bold text-white mt-0.5 font-mono">
                          {accSummary.totalAssignedGroups} <span className="text-[9px] text-slate-500 font-sans">گروه</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">عضو شده قطعی</div>
                        <div className="text-xs font-bold text-emerald-400 mt-0.5 font-mono">
                          {accSummary.joinedGroupsCount} <span className="text-[9px] text-slate-500 font-sans">گروه</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">نیازمند عضویت</div>
                        <div className="text-xs font-bold text-amber-400 mt-0.5 font-mono">
                          {accSummary.pendingJoinCount} <span className="text-[9px] text-slate-500 font-sans">گروه</span>
                        </div>
                      </div>
                    </div>

                    {/* Daily Quota & Drip Join Pace */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>سهمیه پیوستن امروز:</span>
                      <span className="font-mono text-white">
                        <strong className="text-sky-400">{accSummary.dailyJoinsCompletedToday}</strong> / {dripConfig?.maxJoinsPerAccountPerDay ?? 8} گروه
                        <span className="text-slate-500 text-[10px] mr-1 font-sans">
                          ({accSummary.dailyJoinQuotaRemaining} باقیمانده)
                        </span>
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>پیشرفت پوشش قلمرو: {percentJoined}٪</span>
                        <span>{accSummary.joinedGroupsCount} از {accSummary.totalAssignedGroups}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                          style={{ width: `${percentJoined}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Filter Link to this Account's groups */}
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAccountFilter(accSummary.accountId);
                          setActiveTab('groups_list');
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>مشاهده و بررسی گروه‌های این قلمرو در لیست</span>
                      </button>

                      {accSummary.pendingJoinCount > 0 && (
                        <span className="text-[10px] text-slate-500">
                          عضویت تدریجی: خودکار هر {dripConfig?.intervalMinutes ?? 20} دقیقه
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overlap Resolution Center (Rendered only when overlaps exist) */}
          {(territoryReport?.totalOverlapsDetected || 0) > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-slate-950 to-indigo-950/40 border border-amber-500/50 space-y-3.5 animate-in fade-in duration-200 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-amber-500/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
                      <Scale className="w-4 h-4 text-amber-400" />
                    </div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>مرکز رفع تداخل و توزیع کاملاً متوازن بار</span>
                      <span className="text-[10px] bg-amber-500/30 text-amber-200 border border-amber-500/40 px-2 py-0.2 rounded-full font-mono font-bold">
                        {territoryReport?.totalOverlapsDetected} گروه مشترک
                      </span>
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    با اجرای این عملیات، اکانت‌های اضافی از تلگرام لفت داده و تاریخچه آن‌ها پاک می‌شود و مسئولیت تمام گروه‌ها به صورت کاملاً برابر و عادلانه بین اکانت‌های فعال تقسیم می‌گردد.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isResolvingOverlaps}
                  onClick={handleResolveAllOverlapsBalanced}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-rose-600 to-indigo-600 hover:from-amber-600 hover:via-rose-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                  title="رفع اتوماتیک همه تداخل‌ها، لفت دادن اکانت‌های اضافی از تلگرام و تقسیم کاملاً مساوی بار بین اکانت‌ها"
                >
                  <Scale className={`w-4 h-4 ${isResolvingOverlaps ? 'animate-spin' : ''}`} />
                  <span>
                    {isResolvingOverlaps
                      ? 'در حال خروج از تلگرام و متعادل‌سازی...'
                      : `رفع هوشمند تمام ${(territoryReport?.totalOverlapsDetected || 0).toLocaleString('fa-IR')} تداخل با توزیع مساوی بار`}
                  </span>
                </button>
              </div>

              {balanceResultBanner && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{balanceResultBanner}</span>
                </div>
              )}

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(territoryReport?.overlapGroups || []).map((overlap) => {
                  const grp = groups.find((g) => g.id === overlap.groupId);
                  const duplicateIds = (overlap.joinedAccountIds || []).filter(
                    (id) => id !== overlap.primaryOwnerAccountId
                  );

                  return (
                    <div
                      key={overlap.groupId}
                      className="p-2.5 rounded-lg bg-slate-950/90 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{overlap.groupTitle}</span>
                          <span className="text-sky-400 font-mono text-[11px] dir-ltr">
                            {overlap.usernameOrLink}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          اکانت مالک پیشنهادی: <span className="text-emerald-300 font-mono">{overlap.primaryOwnerAccountId}</span> • اکانت‌های اضافی خروجی: <span className="text-amber-300 font-mono">{duplicateIds.join(', ')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {duplicateIds.map((dupId) => (
                          <button
                            key={dupId}
                            type="button"
                            disabled={leavingDuplicateId === `${overlap.groupId}_${dupId}`}
                            onClick={() => handleLeaveDuplicate(overlap.groupId, dupId)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-all disabled:opacity-50"
                          >
                            {leavingDuplicateId === `${overlap.groupId}_${dupId}`
                              ? 'در حال خروج...'
                              : `خروج اکانت اضافی (${dupId.substring(0, 8)}...)`}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Drip-Feed Join Settings Modal */}
      {showDripSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">تنظیمات عضویت امن و قطره‌چکانی</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDripSettingsModal(false)}
                className="text-slate-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400 leading-relaxed text-[11px]">
                برای پیشگیری قطعی از مسدود شدن یا محدودیت‌های تلگرام روی اکانت‌های معمولی، این موتور در طول شبانه‌روز گروه‌های تخصیص‌یافته به هر اکانت را به‌صورت گام‌به‌گام و با فواصل زمانی ایمن عضو می‌کند.
              </p>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block">
                  سقف مجاز عضویت روزانه هر اکانت (تعداد گروه در روز):
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={dripMaxJoins}
                  onChange={(e) => setDripMaxJoins(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-sky-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  پیشنهاد ایمن برای اکانت معمولی: ۵ الی ۸ گروه در روز.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block">
                  فاصله زمانی میان هر عضویت (دقیقه):
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={dripInterval}
                  onChange={(e) => setDripInterval(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-sky-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  پیشنهاد: ۱۵ الی ۳۰ دقیقه (همراه با انحراف تصادفی ±۵ دقیقه جهت رفتار انسانی).
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDripSettingsModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveDripSettings}
                className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-md shadow-sky-500/20"
              >
                ذخیره تنظیمات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PHASE 2 - REAL-TIME SYNC & MULTI-ACCOUNT SMART JOIN ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'join_hub' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          
          {/* Ground Truth Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Joined Groups Card */}
            <div className="bg-slate-950/80 border border-emerald-500/30 p-3.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">گروه‌های عضو شده (قطعی)</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5 font-mono">
                    {joinedGroups.length.toLocaleString('fa-IR')} <span className="text-[11px] text-slate-500 font-sans">گروه</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                آماده ارسال ✓
              </span>
            </div>

            {/* Unjoined Groups Card */}
            <div className="bg-slate-950/80 border border-amber-500/30 p-3.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">نیازمند عضویت در تلگرام</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5 font-mono">
                    {unjoinedGroups.length.toLocaleString('fa-IR')} <span className="text-[11px] text-slate-500 font-sans">گروه</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">
                در نوبت عضویت ⏳
              </span>
            </div>

            {/* Active Accounts in Pool Card */}
            <div className="bg-slate-950/80 border border-sky-500/30 p-3.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">اکانت‌های آماده برای تقسیم کار</div>
                  <div className="text-base font-bold text-sky-400 mt-0.5 font-mono">
                    {availableAccounts.length.toLocaleString('fa-IR')} <span className="text-[11px] text-slate-500 font-sans">اکانت</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStrategyModal(true)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 transition-colors"
                title="تنظیمات استراتژی تقسیم کار و سرعت عضویت"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Persian & Iranian Audience Shield Banner */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-950 to-teal-950/30 border border-emerald-500/30 rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                  🇮🇷
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-white">سپر هوشمند و پالایش مخاطبان ایرانی (Persian Audience Shield)</h4>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                      ۵ لایه اعتبارسنجی زبانی و هویتی
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    بررسی خطوط نوشتاری (حذف خطوط هندی/عربی/روسی)، سنجش کلمات ایرانی، لفت خودکار از تلگرام و بلاک‌لیست دائمی جهت بهینه‌سازی ۱۰۰٪ مصرف منابع.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleAuditAndPurgeNonPersianClick}
                  disabled={isAuditingPersian}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  title="غربالگری کامل گروه‌ها و لفت از تلگرام"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${isAuditingPersian ? 'animate-spin' : ''}`} />
                  <span>{isAuditingPersian ? 'در حال غربالگری...' : 'غربالگری فوری غیرفارسی‌ها'}</span>
                </button>

                {purgedNonPersianCount > 0 && (
                  <button
                    type="button"
                    onClick={handleCleanPurgedFromDb}
                    disabled={isCleaningPurgedDb}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                    title="پاکسازی کامل رکوردهای غیرفارسی از پایگاه داده"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف {purgedNonPersianCount} گروه اخراج‌شده از دیتابیس</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleOpenBlacklistModal}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>لیست سیاه ({persianStats?.blacklistCount ?? 0})</span>
                </button>
              </div>
            </div>

            {/* Sub-Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <div className="flex items-center justify-between bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-800/50">
                <span className="text-slate-400 text-[11px]">گروه‌های تاییدشده ایرانی:</span>
                <span className="font-bold text-emerald-400 font-mono text-xs">{persianVerifiedCount} گروه</span>
              </div>
              <div className="flex items-center justify-between bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-800/50">
                <span className="text-slate-400 text-[11px]">غیرایرانی اخراج‌شده از تلگرام:</span>
                <span className="font-bold text-rose-400 font-mono text-xs">{purgedNonPersianCount} گروه</span>
              </div>
              <div className="flex items-center justify-between bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-800/50">
                <span className="text-slate-400 text-[11px]">مسدود در لیست سیاه دائمی:</span>
                <span className="font-bold text-amber-400 font-mono text-xs">{persianStats?.blacklistCount ?? 0} شناسه</span>
              </div>
            </div>
          </div>

          {/* Smart Join Engine Action Panel */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-950 to-indigo-950/30 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-xs text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  موتور هوشمند عضویت خودکار و تقسیم کار در گروه‌ها
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  گروه‌های نیازمند عضویت را بر اساس استراتژی هوشمند (
                  {strategyMode === 'balanced_distribution' ? 'تقسیم متوازن و مساوی بین اکانت‌ها' : 'عضویت در تمام اکانت‌ها'}
                  ) با وقفه {delaySeconds} ثانیه و دور زدن ربات‌های آنتی‌بات عضو می‌کند.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowStrategyModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>تنظیمات هوشمند</span>
                </button>

                {isJoinEngineRunning ? (
                  <button
                    type="button"
                    onClick={handleStopSmartJoinClick}
                    disabled={isStoppingJoin}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95 animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>{isStoppingJoin ? 'در حال لغو...' : 'توقف عضویت هوشمند'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartSmartJoinClick}
                    disabled={isStartingJoin || unjoinedGroups.length === 0 || availableAccounts.length === 0}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                      unjoinedGroups.length > 0 && availableAccounts.length > 0
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/25'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>شروع عضویت هوشمند ({unjoinedGroups.length} گروه)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Progress Bar & Workers Telemetry (If Running or Finished) */}
            {activeGroupJoinProgress && (activeGroupJoinProgress.isRunning || activeGroupJoinProgress.totalToJoin > 0) && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                {/* Overall Progress Bar */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Radio className={`w-3.5 h-3.5 ${activeGroupJoinProgress.isRunning ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
                    پیشرفت کل عضویت:
                  </span>
                  <span className="font-mono text-sky-400 font-bold">
                    {activeGroupJoinProgress.completedCount} از {activeGroupJoinProgress.totalToJoin} (موفق: {activeGroupJoinProgress.successCount} | خطا: {activeGroupJoinProgress.failedCount})
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((activeGroupJoinProgress.completedCount || 0) / Math.max(1, activeGroupJoinProgress.totalToJoin || 1)) * 100)
                      )}%`,
                    }}
                  />
                </div>

                {/* Individual Worker Cards */}
                {activeGroupJoinProgress.workers && activeGroupJoinProgress.workers.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {activeGroupJoinProgress.workers.map((worker) => (
                      <div
                        key={worker.accountId}
                        className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            {worker.accountName || worker.accountPhone}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            worker.status === 'joining' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 animate-pulse' :
                            worker.status === 'cooldown' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                            worker.status === 'flood_waited' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                            worker.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {worker.status === 'joining' ? 'در حال ارسال درخواست عضویت...' :
                             worker.status === 'cooldown' ? 'وقفه امنیتی (ضداسپم)' :
                             worker.status === 'antibot' ? 'حل تست ربات' :
                             worker.status === 'flood_waited' ? 'محدودیت FloodWait' :
                             worker.status === 'completed' ? 'پایان یافته ✓' : 'آماده'}
                          </span>
                        </div>

                        <div className="text-slate-400 text-[10px] truncate" title={worker.lastAction}>
                          {worker.lastAction || 'در حال آماده‌سازی...'}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>موفق: <strong className="text-emerald-400">{worker.successCount}</strong></span>
                          <span>خطا: <strong className="text-rose-400">{worker.failedCount}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detailed Membership Breakdown Per Group List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <LayoutList className="w-3.5 h-3.5 text-sky-400" />
                لیست گروه‌ها و وضعیت استعلام تلگرام ({unjoinedGroups.length} نیازمند عضویت)
              </span>
              <span className="text-[11px] text-slate-400">
                با کلیک روی «عضویت دستی»، اکانت‌ها می‌توانند به صورت تکی نیز عضو شوند.
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
              {groups.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  هیچ گروهی ثبت نشده است. با دکمه «افزودن گروه» یا «همگام‌سازی واقعی با تلگرام» شروع کنید.
                </div>
              ) : (
                groups.map((group) => {
                  const isJoined = group.membershipStatus === 'joined' || (group.joinedAccountIds && group.joinedAccountIds.length > 0);
                  const isJoiningThis = joiningSingleId === group.id;

                  return (
                    <div
                      key={group.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isJoined
                          ? 'bg-slate-950/70 border-emerald-500/20'
                          : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs text-white truncate max-w-[220px]" title={group.title}>
                            {group.title}
                          </h4>
                          {isJoined ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400" />
                              عضو تلگرام
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              نیازمند عضویت
                            </span>
                          )}
                          {group.category && (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                              {group.category}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
                          <span className="dir-ltr text-sky-400 font-mono">{group.usernameOrLink}</span>
                          {group.joinedAccountPhones && group.joinedAccountPhones.length > 0 && (
                            <span className="text-emerald-300 dir-ltr text-[10px] font-mono">
                              عضو در: {group.joinedAccountPhones.join(', ')}
                            </span>
                          )}
                          {group.assignedAccountPhone && !isJoined && (
                            <span className="text-indigo-300 dir-ltr text-[10px] font-mono">
                              تخصیص به: {group.assignedAccountPhone}
                            </span>
                          )}
                          {group.lastJoinError && (
                            <span className="text-rose-400 text-[10px]">
                              خطا: {group.lastJoinError}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Action: Single Join or External Link */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isJoined && onJoinSingleGroup && (
                          <button
                            type="button"
                            onClick={() => handleJoinSingle(group.id)}
                            disabled={isJoiningThis || isJoinEngineRunning}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all disabled:opacity-50"
                            title="عضویت دستی در این گروه توسط اکانت متصل"
                          >
                            {isJoiningThis ? 'در حال عضویت...' : 'عضویت فوری'}
                          </button>
                        )}

                        <a
                          href={getTelegramUrl(group.usernameOrLink)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 transition-colors"
                          title="مشاهده در تلگرام"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PHASE 2 - GROUP ADS QUEUE & MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'groups_list' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          
          {/* Top Actions & Sub-header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pb-1">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="جستجوی نام یا آیدی گروه..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl pr-9 pl-8 py-1.5 text-xs text-white focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                disabled={isReverifyingAll}
                onClick={() => handleReverifyAllGroups('ready_only')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 font-medium text-xs border border-indigo-500/30 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                title="راستی‌آزمایی ارسال و سلامت واقعی گروه‌های دسته ۱۰۰٪ آماده"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isReverifyingAll ? 'animate-spin' : ''}`} />
                <span>{isReverifyingAll ? 'در حال راستی‌آزمایی...' : 'راستی‌آزمایی سلامت آماده‌ها'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPostedIds([]);
                  setShowPostedModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-medium text-xs border border-emerald-500/30 transition-all active:scale-95 shadow-sm"
                title="مشاهده لیست گروه‌هایی که پیام تبلیغات به‌صورت قطعی در آن‌ها ارسال شده است"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>ارسال‌شده‌های موفق</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950 font-mono">
                  {postedGroups.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن گروه جدید</span>
              </button>
            </div>
          </div>

          {/* Membership & Category Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* 4-State Lifecycle Membership Filter Chips */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
              <button
                type="button"
                onClick={() => setMembershipFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs ${
                  membershipFilter === 'all' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                همه ({groups.length})
              </button>
              <button
                type="button"
                onClick={() => setMembershipFilter('ready')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                  membershipFilter === 'ready' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>۱۰۰٪ آماده ارسال</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                  {readyGroups.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMembershipFilter('captcha_required')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                  membershipFilter === 'captcha_required' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                <ShieldAlert className={`w-3.5 h-3.5 text-amber-400 ${captchaRequiredGroups.length > 0 ? 'animate-pulse' : ''}`} />
                <span>نیازمند اقدام دستی</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                  {captchaRequiredGroups.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMembershipFilter('unjoined')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                  membershipFilter === 'unjoined' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>هنوز عضو نشده</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                  {unjoinedGroups.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMembershipFilter('persian_verified')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                  membershipFilter === 'persian_verified' ? 'bg-teal-500/20 text-teal-300 font-bold border border-teal-500/40' : 'text-slate-400 hover:text-teal-300'
                }`}
              >
                <span>🇮🇷 فارسی تایید شده</span>
                <span className="px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-mono">
                  {persianVerifiedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMembershipFilter('purged_non_persian')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                  membershipFilter === 'purged_non_persian' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40' : 'text-slate-400 hover:text-rose-300'
                }`}
              >
                <span>🚫 غیرایرانی (پاکسازی شده)</span>
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono">
                  {purgedNonPersianCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMembershipFilter('no_permission_left')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                  membershipFilter === 'no_permission_left' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40' : 'text-slate-400 hover:text-rose-300'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>فاقد اجازه ارسال</span>
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono">
                  {invalidGroups.length}
                </span>
              </button>

              {purgedNonPersianCount > 0 && (
                <button
                  type="button"
                  onClick={handleCleanPurgedFromDb}
                  disabled={isCleaningPurgedDb}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-1 transition-all shrink-0 shadow-sm"
                  title="پاکسازی کامل رکوردهای غیرایرانی اخراج‌شده از پایگاه داده"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>{isCleaningPurgedDb ? 'در حال حذف...' : `حذف ${purgedNonPersianCount} غیرفارسی از دیتابیس`}</span>
                </button>
              )}

              {invalidGroups.length > 0 && (
                <button
                  type="button"
                  onClick={handlePurgeInvalidGroups}
                  disabled={isPurgingInvalid}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-1 transition-all shrink-0 shadow-sm"
                  title="پاکسازی دائمی تمامی گروه‌هایی که دسترسی ارسال پیام نداشتند و لفت داده شدند"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>{isPurgingInvalid ? 'در حال پاکسازی...' : `حذف ${invalidGroups.length} گروه نامعتبر`}</span>
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-sky-500/20 text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="نمای لیستی"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-sky-500/20 text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="نمای کارت‌بندی"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Account Territory Filter Chips Bar */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-[11px] text-slate-400 font-bold px-1.5 flex items-center gap-1">
              <Divide className="w-3.5 h-3.5 text-indigo-400" />
              فیلتر قلمرو اکانت:
            </span>
            <button
              type="button"
              onClick={() => setSelectedAccountFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedAccountFilter === 'all'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              همه قلمروها ({groups.length})
            </button>
            {accounts.map((acc, i) => {
              const count = groups.filter((g) => g.assignedAccountId === acc.id).length;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedAccountFilter(acc.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 dir-ltr font-mono ${
                    selectedAccountFilter === acc.id
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white bg-slate-900/60'
                  }`}
                >
                  <span>{acc.userProfile?.firstName || `اکانت ${i + 1}`}</span>
                  <span className="text-[10px] opacity-70">({acc.phoneNumber})</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] text-indigo-200">
                    {count}
                  </span>
                </button>
              );
            })}
            {(territoryReport?.totalOverlapsDetected || 0) > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAccountFilter('overlaps')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  selectedAccountFilter === 'overlaps'
                    ? 'bg-amber-600 text-white font-bold shadow-sm'
                    : 'text-amber-400 hover:text-amber-200 bg-amber-950/40 border border-amber-500/30'
                }`}
              >
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span>دارای تداخل ({territoryReport?.totalOverlapsDetected})</span>
              </button>
            )}
          </div>

          {/* Select All / Deselect / Persistence Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleAllGroups(true)}
                className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>انتخاب همه ({groups.length})</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleAllGroups(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 flex items-center gap-1 text-xs font-medium transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>غیرفعال‌سازی همه</span>
              </button>

              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  selectedTargetGroupIds.length === filteredGroups.length && filteredGroups.length > 0
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <CheckCheck className="w-3.5 h-3.5 text-rose-400" />
                <span>
                  {selectedTargetGroupIds.length === filteredGroups.length && filteredGroups.length > 0
                    ? 'لغو انتخاب دسته‌جمعی'
                    : `انتخاب چندتایی جهت محوسازی (${selectedTargetGroupIds.length})`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleVerifyAllPersistence}
                disabled={isVerifyingPersistence}
                className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 text-xs font-bold transition-colors disabled:opacity-50"
                title="پایش آنلاین ماندگاری پیام‌ها در تمام گروه‌ها"
              >
                <Eye className={`w-3.5 h-3.5 text-purple-400 ${isVerifyingPersistence ? 'animate-spin' : ''}`} />
                <span>{isVerifyingPersistence ? 'در حال پایش...' : 'پایش ماندگاری پیام‌ها'}</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400 font-medium">
              نمایش <span className="text-sky-400 font-bold">{filteredGroups.length}</span> گروه
            </span>
          </div>

          {/* Dedicated Bulk Telegram Purge Floating Toolbar */}
          {selectedTargetGroupIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-rose-950/60 via-slate-950/80 to-purple-950/60 border border-rose-500/40 my-2 shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white">
                    عملیات روی <span className="text-rose-400 font-mono text-sm">{selectedTargetGroupIds.length}</span> گروه انتخاب شده:
                  </span>
                  <p className="text-[10px] text-slate-400">
                    خروج، پاک‌سازی تاریخچه پیام‌ها و حذف دیالوگ از داخل خود تلگرام به صورت اتوماتیک
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleBulkLeaveTelegram(false)}
                  disabled={isBulkLeavingTelegram}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  title="لفت دادن اکانت‌ها و حذف چت و دیالوگ از محیط تلگرام بدون حذف رکورد از نرم‌افزار"
                >
                  <LogOut className={`w-3.5 h-3.5 ${isBulkLeavingTelegram ? 'animate-spin' : ''}`} />
                  <span>{isBulkLeavingTelegram ? 'در حال خروج...' : 'لفت و محوسازی از تلگرام'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkLeaveTelegram(true)}
                  disabled={isBulkLeavingTelegram}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  title="حذف کامل از نرم‌افزار به همراه لفت و محوسازی کامل از تلگرام"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف و پاک‌سازی کامل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTargetGroupIds([])}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          {/* Groups List Container */}
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-slate-800 rounded-xl p-4 text-center bg-slate-950/40 my-1">
              <Users className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400 font-medium">هیچ گروهی با این فیلترها یافت نشد.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                می‌توانید گروه‌های جدید را با دکمه «افزودن گروه» وارد فرمایید.
              </p>
            </div>
          ) : viewMode === 'list' ? (
            /* LIST VIEW */
            <div className="space-y-2 overflow-y-auto max-h-[420px] pr-1 my-1">
              {filteredGroups.map((group) => {
                const cleanTitle = group.title || 'گروه تلگرام';
                const initialLetter = cleanTitle.trim().charAt(0).toUpperCase();
                const isJoined = group.membershipStatus === 'joined' || (group.joinedAccountIds && group.joinedAccountIds.length > 0);

                return (
                  <div
                    key={group.id}
                    className={`group p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      group.isActive
                        ? 'bg-slate-950/90 border-slate-800 hover:border-slate-700/90 hover:bg-slate-950 shadow-sm'
                        : 'bg-slate-950/30 border-slate-800/40 opacity-50'
                    }`}
                  >
                    {/* Checkbox + Title & Status */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Selection checkbox for zero-trace purge operations */}
                      <input
                        type="checkbox"
                        checked={selectedTargetGroupIds.includes(group.id)}
                        onChange={() => toggleSelectGroup(group.id)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500 accent-rose-500 cursor-pointer flex-shrink-0"
                        title="انتخاب جهت لفت و محوسازی از تلگرام"
                      />

                      {/* Active toggle checkbox */}
                      <input
                        type="checkbox"
                        checked={group.isActive}
                        onChange={(e) => onToggleGroup(group.id, e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500 accent-sky-500 cursor-pointer flex-shrink-0"
                        title={group.isActive ? 'فعال در ارسال' : 'غیرفعال'}
                      />

                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                        {initialLetter}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs text-white truncate max-w-[200px] sm:max-w-[280px]" title={cleanTitle}>
                            {cleanTitle}
                          </h4>
                          {group.readinessStatus === 'ready' ? (
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ۱۰۰٪ آماده ارسال
                            </span>
                          ) : group.readinessStatus === 'captcha_required' ? (
                            <button
                              type="button"
                              onClick={() => setSolvingCaptchaGroup(group)}
                              className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 transition-all active:scale-95 shadow-sm"
                              title="مشاهده و حل چالش ربات ناظر"
                            >
                              <ShieldAlert className="w-3 h-3 text-amber-400" />
                              نیازمند اقدام دستی (حل چالش)
                            </button>
                          ) : group.status === 'purged_non_persian' || group.readinessStatus === 'non_persian_purged' ? (
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              غیرایرانی (لفت و پاکسازی شد)
                            </span>
                          ) : group.readinessStatus === 'no_permission_left' ? (
                            <span className="text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              فاقد اجازه ارسال (لفت داده شد)
                            </span>
                          ) : isJoined ? (
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium shrink-0">
                              عضو شده ✓
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3 text-slate-400" />
                              هنوز عضو نشده
                            </span>
                          )}
                          {group.isPersianVerified && (
                            <span className="text-[10px] bg-teal-500/15 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0" title="زبان فارسی و مخاطبان ایرانی این گروه با دقت ۱۰۰٪ تایید شده است">
                              🇮🇷 فارسی تایید شده
                            </span>
                          )}
                          {group.category && (
                            <span className="text-[10px] bg-slate-800/80 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded-full font-medium shrink-0">
                              {group.category}
                            </span>
                          )}
                          {/* Assigned Territory Account Badge */}
                          {group.assignedAccountPhone && (
                            <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono dir-ltr shrink-0 flex items-center gap-1" title="اکانت مسئول و مالک قلمرو این گروه">
                              <Users className="w-3 h-3 text-indigo-400" />
                              قلمرو: {group.assignedAccountName || group.assignedAccountPhone}
                            </span>
                          )}
                          {/* Overlap Warning & Duplicate Leave Action */}
                          {group.hasOverlap && group.duplicateAccountIds && group.duplicateAccountIds.length > 0 && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1" title="عضویت مشترک بیش از ۱ اکانت در این گروه">
                                <AlertCircle className="w-3 h-3 text-amber-400" />
                                تداخل ({group.joinedAccountPhones?.length || 2} اکانت)
                              </span>
                              {group.duplicateAccountIds.map((dupId) => (
                                <button
                                  key={dupId}
                                  type="button"
                                  disabled={leavingDuplicateId === `${group.id}_${dupId}`}
                                  onClick={() => handleLeaveDuplicate(group.id, dupId)}
                                  className="text-[10px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold transition-all disabled:opacity-50"
                                  title="خروج این اکانت اضافی جهت آزادسازی سهمیه روزانه"
                                >
                                  {leavingDuplicateId === `${group.id}_${dupId}` ? 'در حال خروج...' : 'لفت اکانت اضافی'}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-sans">
                          <span className="dir-ltr text-sky-400 font-mono font-medium truncate max-w-[160px]">
                            {group.usernameOrLink}
                          </span>
                          {group.memberCount && (
                            <span>• {group.memberCount.toLocaleString('fa-IR')} عضو</span>
                          )}
                          {group.lastPostedAt && (
                            <span className="text-slate-500">
                              • آخرین ارسال: {new Date(group.lastPostedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {group.lastPostedByAccountPhone && (
                            <span className="text-emerald-400 font-mono text-[10px] dir-ltr">
                              توسط: {group.lastPostedByAccountPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onTestSendTarget && (
                        <button
                          type="button"
                          onClick={() => handleSingleTest(group.usernameOrLink)}
                          disabled={testingTarget === group.usernameOrLink}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 transition-colors"
                          title="ارسال تستی به این گروه"
                        >
                          <Send className={`w-3.5 h-3.5 ${testingTarget === group.usernameOrLink ? 'animate-pulse text-sky-400' : ''}`} />
                        </button>
                      )}

                      <a
                        href={getTelegramUrl(group.usernameOrLink)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 transition-colors"
                        title="مشاهده در تلگرام"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {/* Zero-Trace Leave & Purge Dialog from Telegram */}
                      <button
                        type="button"
                        onClick={() => handleLeaveTelegramGroup(group, false)}
                        disabled={leavingTelegramGroupId === group.id}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                        title="لفت دادن و پاک‌سازی کامل چت و دیالوگ از داخل تلگرام"
                      >
                        <LogOut className={`w-3.5 h-3.5 ${leavingTelegramGroupId === group.id ? 'animate-spin text-rose-400' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLeaveTelegramGroup(group, true)}
                        disabled={leavingTelegramGroupId === group.id}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 transition-colors"
                        title="حذف گروه از سامانه و پاکسازی ریشه‌ای از تلگرام"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto max-h-[420px] pr-1 my-1">
              {filteredGroups.map((group) => {
                const cleanTitle = group.title || 'گروه تلگرام';
                const isJoined = group.membershipStatus === 'joined' || (group.joinedAccountIds && group.joinedAccountIds.length > 0);

                return (
                  <div
                    key={group.id}
                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                      group.isActive
                        ? 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/30 border-slate-800/40 opacity-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedTargetGroupIds.includes(group.id)}
                          onChange={() => toggleSelectGroup(group.id)}
                          className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500 accent-rose-500 cursor-pointer shrink-0"
                          title="انتخاب جهت لفت یا حذف از تلگرام"
                        />
                        <input
                          type="checkbox"
                          checked={group.isActive}
                          onChange={(e) => onToggleGroup(group.id, e.target.checked)}
                          className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500 accent-sky-500 cursor-pointer shrink-0"
                          title={group.isActive ? 'فعال در ارسال' : 'غیرفعال'}
                        />
                        <h4 className="font-bold text-xs text-white truncate" title={cleanTitle}>
                          {cleanTitle}
                        </h4>
                      </div>
                      {group.readinessStatus === 'ready' ? (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          آماده
                        </span>
                      ) : group.readinessStatus === 'captcha_required' ? (
                        <button
                          type="button"
                          onClick={() => setSolvingCaptchaGroup(group)}
                          className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold shrink-0 flex items-center gap-1"
                          title="حل چالش ربات ناظر"
                        >
                          <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                          اقدام دستی
                        </button>
                      ) : group.status === 'purged_non_persian' || group.readinessStatus === 'non_persian_purged' ? (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-bold shrink-0">
                          غیرایرانی (پاک شد)
                        </span>
                      ) : group.readinessStatus === 'no_permission_left' ? (
                        <span className="text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold shrink-0 flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5 text-rose-400" />
                          لفت داده شد
                        </span>
                      ) : isJoined ? (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-medium shrink-0">
                          عضو
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                          عضو نشده
                        </span>
                      )}
                      {group.isPersianVerified && (
                        <span className="text-[10px] bg-teal-500/15 text-teal-300 border border-teal-500/30 px-1.5 py-0.5 rounded font-bold shrink-0" title="فارسی تایید شده">
                          🇮🇷
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[11px] text-sky-400 font-mono dir-ltr truncate">
                      <span className="truncate">{group.usernameOrLink}</span>
                      {group.assignedAccountPhone && (
                        <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-sans shrink-0" title="اکانت مسئول">
                          قلمرو: {group.assignedAccountName || group.assignedAccountPhone}
                        </span>
                      )}
                    </div>
                    {group.hasOverlap && (
                      <div className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold flex items-center justify-between">
                        <span>تداخل {group.joinedAccountPhones?.length || 2} اکانت</span>
                        {group.duplicateAccountIds && group.duplicateAccountIds[0] && (
                          <button
                            type="button"
                            disabled={leavingDuplicateId === `${group.id}_${group.duplicateAccountIds[0]}`}
                            onClick={() => handleLeaveDuplicate(group.id, group.duplicateAccountIds![0])}
                            className="text-rose-300 hover:text-rose-200 underline"
                          >
                            لفت اکانت اضافی
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <span>{group.category || 'عمومی'}</span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={getTelegramUrl(group.usernameOrLink)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-sky-400"
                          title="مشاهده در تلگرام"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleLeaveTelegramGroup(group, false)}
                          disabled={leavingTelegramGroupId === group.id}
                          className="p-1 rounded bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="لفت و محوسازی از تلگرام"
                        >
                          <LogOut className={`w-3 h-3 ${leavingTelegramGroupId === group.id ? 'animate-spin text-rose-400' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLeaveTelegramGroup(group, true)}
                          disabled={leavingTelegramGroupId === group.id}
                          className="p-1 rounded bg-slate-900 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 transition-colors"
                          title="حذف از نرم‌افزار و پاکسازی کامل از تلگرام"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SMART JOIN STRATEGY CONFIGURATION MODAL */}
      {/* ========================================================================= */}
      {showStrategyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-sky-400" />
                تنظیمات استراتژی عضویت و توزیع هوشمند بین اکانت‌ها
              </h3>
              <button
                type="button"
                onClick={() => setShowStrategyModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStrategy} className="space-y-4 text-xs">
              {/* Distribution Strategy Mode */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-medium">الگوی تقسیم کار بین اکانت‌های متصل:</label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    strategyMode === 'balanced_distribution'
                      ? 'bg-sky-500/10 border-sky-500/40 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="radio"
                      name="strategyMode"
                      value="balanced_distribution"
                      checked={strategyMode === 'balanced_distribution'}
                      onChange={() => setStrategyMode('balanced_distribution')}
                      className="mt-0.5 accent-sky-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-sky-300">تقسیم متوازن و مساوی (پیشنهادی)</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        گروه‌ها به صورت مساوی و هوشمند بین تمام اکانت‌های فعال سرشکن می‌شوند تا از فلود و بلاک جلوگیری شود.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    strategyMode === 'redundant_all_accounts'
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="radio"
                      name="strategyMode"
                      value="redundant_all_accounts"
                      checked={strategyMode === 'redundant_all_accounts'}
                      onChange={() => setStrategyMode('redundant_all_accounts')}
                      className="mt-0.5 accent-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-indigo-300">عضویت سراسری در تمام اکانت‌ها (Redundant)</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        تمامی اکانت‌ها در تمامی گروه‌ها عضو می‌شوند تا هر اکانتی بتواند به عنوان رزرو ارسال کند.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Delay between joins */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-medium">
                  فاصله زمانی امنیتی بین هر عضویت: <strong className="text-sky-400">{delaySeconds} ثانیه</strong>
                </label>
                <input
                  type="range"
                  min="5"
                  max="45"
                  step="1"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>۵ ثانیه (سریع)</span>
                  <span>۱۵ ثانیه (استاندارد امن)</span>
                  <span>۴۵ ثانیه (فوق امن)</span>
                </div>
              </div>

              {/* Auto Antibot Toggle */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs">دور زدن خودکار آنتی‌بات در حین عضویت</div>
                  <div className="text-[11px] text-slate-400">کلیک روی دکمه‌های شیشه‌ای تایید و عضویت در کانال قفل</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoAntibot}
                  onChange={(e) => setAutoAntibot(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Leave if No Send Permission */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-rose-300 text-xs">خروج و حذف خودکار در صورت عدم دسترسی ارسال</div>
                  <div className="text-[11px] text-slate-400">در صورت نداشتن مجوز ارسال پیام، ربات از گروه خارج شده و تاریخچه را حذف می‌کند</div>
                </div>
                <input
                  type="checkbox"
                  checked={leaveIfNoSendPermission}
                  onChange={(e) => setLeaveIfNoSendPermission(e.target.checked)}
                  className="w-4 h-4 accent-rose-500 cursor-pointer"
                />
              </div>

              {/* Enforce 100% Persian & Iranian Audience */}
              <div className="p-3 bg-slate-950 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                    <span>🇮🇷</span>
                    <span>غربالگری ۱۰۰٪ فارسی و مخاطبان ایرانی</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    تشخیص هوشمند زبان فارسی و خروج و پاکسازی خودکار و کامل از تلگرام در صورت خارجی یا غیرفارسی بودن گروه
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enforcePersianIranianOnly}
                  onChange={(e) => setEnforcePersianIranianOnly(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Send Greeting Test */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-emerald-300 text-xs">ارسال پیام سلام اولیه ارگانیک</div>
                    <div className="text-[11px] text-slate-400">ارسال پیام کوتاه اولیه جهت راستی‌آزمایی و تحریک ربات ناظر برای نمایش چالش</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={sendGreetingTest}
                    onChange={(e) => setSendGreetingTest(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
                {sendGreetingTest && (
                  <div className="pt-1">
                    <label className="block text-[11px] text-slate-400 mb-1">متن پیام سلام ارگانیک:</label>
                    <input
                      type="text"
                      value={greetingMessage}
                      onChange={(e) => setGreetingMessage(e.target.value)}
                      placeholder="سلام بچه ها"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                )}
              </div>

              {/* Verify Greeting Survival */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sky-300 text-xs">پایش ماندگاری پیام (بررسی حذف نشدن پس از ۴ ثانیه)</div>
                  <div className="text-[11px] text-slate-400">اگر ربات ناظر پیام را پاک نکرد، گروه بدون چالش و ۱۰۰٪ آماده تایید می‌شود</div>
                </div>
                <input
                  type="checkbox"
                  checked={verifyGreetingSurvival}
                  onChange={(e) => setVerifyGreetingSurvival(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Auto Solve All Captchas */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-purple-300 text-xs">حل حداکثری و جامع کاپچا (هوش مصنوعی + سوالات ریاضی)</div>
                  <div className="text-[11px] text-slate-400">تلاش خودکار برای حل سوالات ریاضی، کپچاهای متنی و دکمه‌های تایید</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoSolveAllCaptchas}
                  onChange={(e) => setAutoSolveAllCaptchas(e.target.checked)}
                  className="w-4 h-4 accent-purple-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStrategyModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold"
                >
                  ذخیره تنظیمات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MANUAL CAPTCHA / CHALLENGE RESOLUTION MODAL */}
      {/* ========================================================================= */}
      {solvingCaptchaGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                حل چالش ربات ناظر برای گروه: {solvingCaptchaGroup.title}
              </h3>
              <button
                type="button"
                onClick={() => setSolvingCaptchaGroup(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>این گروه نیازمند اقدام دستی است</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  ربات محافظ این گروه پیام سلام آزمایشی را حذف کرده یا قفلی اعمال کرده که حل خودکار کامل آن نیازمند تایید شماست.
                </p>
                {solvingCaptchaGroup.lastJoinError && (
                  <div className="mt-1 p-2 bg-slate-950/60 rounded border border-amber-500/20 text-amber-200 font-mono text-[11px] dir-ltr">
                    {solvingCaptchaGroup.lastJoinError}
                  </div>
                )}
              </div>

              {/* Bot Challenge Message from Guardian Bot */}
              {solvingCaptchaGroup.captchaDetails?.challengeText && (
                <div className="p-3 bg-slate-950 rounded-xl border border-sky-500/30 space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-bold text-sky-400 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      <span>{solvingCaptchaGroup.captchaDetails.botName || 'ربات محافظ گروه'}</span>
                    </span>
                    <span className="text-[10px] text-slate-500">متن پیام قفل در گروه</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/90 rounded-lg text-slate-200 text-xs whitespace-pre-wrap leading-relaxed border border-slate-800 font-sans select-text">
                    {solvingCaptchaGroup.captchaDetails.challengeText}
                  </div>
                </div>
              )}

              {/* Inline Buttons from Guardian Bot */}
              {solvingCaptchaGroup.captchaDetails?.inlineButtons && solvingCaptchaGroup.captchaDetails.inlineButtons.length > 0 && (
                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                      <span>دکمه‌های شیشه‌ای ارسال‌شده توسط ربات:</span>
                    </span>
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-mono font-bold">
                      {solvingCaptchaGroup.captchaDetails.inlineButtons.length} دکمه
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    می‌توانید مستقیماً روی هر دکمه کلیک کنید تا اکانت تلگرام شما آن را تایید کند:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {solvingCaptchaGroup.captchaDetails.inlineButtons.map((btn, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-1">
                        {btn.url ? (
                          <div className="flex-1 flex gap-1">
                            <button
                              type="button"
                              disabled={isRetryingCaptcha}
                              onClick={() => handleRetryCaptchaVerification(solvingCaptchaGroup.id, { joinSponsorUrl: btn.url })}
                              className="flex-1 py-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-[11px] flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                              title="عضویت خودکار اکانت در این کانال اسپانسر"
                            >
                              <UserPlus className="w-3 h-3 text-sky-200" />
                              <span className="truncate">{btn.text} (عضویت خودکار)</span>
                            </button>
                            <a
                              href={btn.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                              title="باز کردن لینک اسپانسر در تلگرام"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isRetryingCaptcha}
                            onClick={() => handleRetryCaptchaVerification(solvingCaptchaGroup.id, { buttonRow: btn.row, buttonCol: btn.col })}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 border border-indigo-500/40 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3 text-indigo-300" />
                            <span className="truncate">{btn.text}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Telegram Link */}
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <div className="font-bold text-white text-xs">لینک گروه در تلگرام</div>
                  <div className="text-[11px] text-sky-400 font-mono dir-ltr">{solvingCaptchaGroup.usernameOrLink}</div>
                </div>
                <a
                  href={getTelegramUrl(solvingCaptchaGroup.usernameOrLink)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold flex items-center gap-1 text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>باز کردن در تلگرام</span>
                </a>
              </div>

              {/* Force-Add Bypass Section */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-purple-400" />
                    <span>رفع خودکار قفل ادد اجباری (Force-Add Bypass)</span>
                  </div>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                    خودکار
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  اگر ربات گروه اعلام کرده «برای ارسال پیام باید ۳ نفر اضافه کنید»، با فشردن این دکمه اعضا به طور خودکار به گروه دعوت شده و قفل ارسال پیام بازگشایی می‌گردد.
                </p>
                <button
                  type="button"
                  disabled={isBypassingForceAdd}
                  onClick={() => handleBypassForceAdd(solvingCaptchaGroup.id, solvingCaptchaGroup.usernameOrLink)}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  {isBypassingForceAdd ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>در حال شکستن قفل و افزودن اعضا به گروه...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>شکستن قفل ادد اجباری و آزادسازی گروه</span>
                    </>
                  )}
                </button>
              </div>

              {/* Custom Answer Input */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-medium">ارسال پاسخ متنی به چالش ربات (مثلاً پاسخ ریاضی یا دستور بات):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCustomReply}
                    onChange={(e) => setManualCustomReply(e.target.value)}
                    placeholder="مثال: 12 یا عدد یا کلمه تایید..."
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!manualCustomReply.trim() || isRetryingCaptcha}
                    onClick={() => handleRetryCaptchaVerification(solvingCaptchaGroup.id, { customReply: manualCustomReply.trim() })}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs disabled:opacity-50 flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>ارسال پاسخ</span>
                  </button>
                </div>
              </div>

              {/* Test and Verify Action */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSolvingCaptchaGroup(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  بستن
                </button>
                <button
                  type="button"
                  disabled={isRetryingCaptcha}
                  onClick={() => handleRetryCaptchaVerification(solvingCaptchaGroup.id)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetryingCaptcha ? 'animate-spin' : ''}`} />
                  <span>{isRetryingCaptcha ? 'در حال راستی‌آزمایی...' : 'راستی‌آزمایی مجدد و آماده‌سازی ۱۰۰٪'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD GROUPS MODAL (SINGLE / BULK) */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" />
                افزودن گروه‌های هدف جدید
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setAddMode('bulk')}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  addMode === 'bulk' ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                افزودن دسته‌جمعی (Bulk)
              </button>
              <button
                type="button"
                onClick={() => setAddMode('single')}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  addMode === 'single' ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                افزودن تکی
              </button>
            </div>

            {addMode === 'bulk' ? (
              <form onSubmit={handleBulkAddSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    لیست آیدی‌ها یا لینک‌های گروه‌ها (با Enter یا فاصله جدا کنید):
                  </label>
                  <textarea
                    rows={6}
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder={`@group_one\nt.me/group_two\nhttps://t.me/joinchat/...`}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl p-3 text-xs text-white font-mono dir-ltr focus:outline-none transition-colors"
                  />
                  <div className="text-[11px] text-slate-400 mt-1">
                    تعداد شناسایی شده: <strong className="text-sky-400 font-mono">
                      {bulkInput.split(/[\s,\n\r;]+/).filter(Boolean).length}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">دسته‌بندی (اختیاری):</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !bulkInput.trim()}
                    className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold disabled:opacity-50"
                  >
                    {loading ? 'در حال افزودن...' : 'ثبت و افزودن گروه‌ها'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSingleAddSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">نام یا عنوان گروه:</label>
                  <input
                    type="text"
                    placeholder="مثال: گروه تبلیغات تهران"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">آیدی یا لینک تلگرام:</label>
                  <input
                    type="text"
                    placeholder="@my_group یا t.me/joinchat/..."
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono dir-ltr focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">دسته‌بندی:</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !newLink.trim()}
                    className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold disabled:opacity-50"
                  >
                    {loading ? 'در حال ثبت...' : 'افزودن گروه'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SUCCESSFULLY POSTED GROUPS MODAL */}
      {/* ========================================================================= */}
      {showPostedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    گروه‌های با ارسال ۱۰۰٪ موفق و قطعی
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {postedGroups.length} گروه
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    لیست گروه‌هایی که پیام تبلیغاتی بدون هیچ‌گونه خطا در آن‌ها منتشر شده است
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPostedModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجو در ارسال‌شده‌ها..."
                  value={postedSearch}
                  onChange={(e) => setPostedSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                {selectedPostedIds.length > 0 && onDeleteBulkGroupsByIds && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedPosted}
                    disabled={isDeletingPosted}
                    className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>حذف انتخاب‌شده‌ها ({selectedPostedIds.length})</span>
                  </button>
                )}

                {onDeletePostedGroups && (
                  <button
                    type="button"
                    onClick={handleDeleteAllPosted}
                    disabled={isDeletingPosted || postedGroups.length === 0}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف تمامی {postedGroups.length} گروه با ۱ کلیک</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[50vh] space-y-2">
              {filteredPostedGroups.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-medium">هیچ گروه ارسال‌شده موفقی یافت نشد.</p>
                </div>
              ) : (
                filteredPostedGroups.map((group) => {
                  const isSelected = selectedPostedIds.includes(group.id);
                  const postedDateStr = group.lastPostedAt
                    ? new Date(group.lastPostedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) +
                      ' - ' +
                      new Date(group.lastPostedAt).toLocaleDateString('fa-IR')
                    : 'نامشخص';

                  return (
                    <div
                      key={group.id}
                      className="p-3 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPostedIds([...selectedPostedIds, group.id]);
                            } else {
                              setSelectedPostedIds(selectedPostedIds.filter((id) => id !== group.id));
                            }
                          }}
                          className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer shrink-0"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white truncate">{group.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium shrink-0">
                              ارسال موفق
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
                            <span className="dir-ltr text-sky-400 font-mono">{group.usernameOrLink}</span>
                            <span>•</span>
                            <span className="text-slate-400">آخرین ارسال: <strong className="text-slate-200">{postedDateStr}</strong></span>
                            {group.lastPostedByAccountPhone && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400">توسط: <strong className="text-emerald-300 dir-ltr">{group.lastPostedByAccountPhone}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={getTelegramUrl(group.usernameOrLink)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 transition-colors"
                          title="مشاهده در تلگرام"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => onDeleteGroup(group.id)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="حذف از لیست هدف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>تعداد گروه‌های نمایش داده شده: <strong className="text-emerald-400 font-mono">{filteredPostedGroups.length}</strong></span>
              <button
                type="button"
                onClick={() => setShowPostedModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
              >
                بستن
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Non-Persian Blacklist Modal */}
      {showBlacklistModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    لیست سیاه گروه‌های غیرایرانی مسدودشده
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                      {blacklistItems.length} گروه
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    این اهداف به دلیل زبان غیرفارسی مسدود شده‌اند تا هیچ تلاشی برای ارسال پیام یا جوین مجدد انجام نشود.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBlacklistModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Action Bar */}
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="جستجو در لیست سیاه..."
                  value={blacklistSearch}
                  onChange={(e) => setBlacklistSearch(e.target.value)}
                  className="w-full pl-3 pr-9 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {blacklistItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearBlacklist}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>پاکسازی لیست سیاه</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-800/40">
              {isLoadingBlacklist ? (
                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>در حال دریافت لیست سیاه...</span>
                </div>
              ) : blacklistItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <ShieldCheck className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
                  <span>لیست سیاه خالی است. هیچ گروه مسدودشده‌ای وجود ندارد.</span>
                </div>
              ) : (
                blacklistItems
                  .filter((item) =>
                    !blacklistSearch || item.toLowerCase().includes(blacklistSearch.toLowerCase())
                  )
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="pt-2 flex items-center justify-between text-xs hover:bg-slate-800/30 p-2 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[11px]">{idx + 1}.</span>
                        <span className="font-mono text-slate-200 dir-ltr text-left text-xs bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          {item}
                        </span>
                      </div>
                      <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        مسدود دائمی
                      </span>
                    </div>
                  ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>تعداد کل مسدودشده‌ها: <strong className="text-amber-400 font-mono">{blacklistItems.length}</strong></span>
              <button
                type="button"
                onClick={() => setShowBlacklistModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
