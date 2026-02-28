import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { storage } from '../lib/api';
import { classifyTransportErrorMessage, isAuthInvalidMessage } from '../lib/errorHandling';

export type AppLocale = 'zh-CN' | 'en-US';

type Vars = Record<string, string | number>;

const messages: Record<AppLocale, Record<string, string>> = {
  'zh-CN': {
    'common.language': '语言',
    'common.lang.zh': '中文',
    'common.lang.en': 'English',
    'common.loading': '加载中...',
    'common.join': '加入',
    'common.spectate': '观战',
    'common.accept': '接受',
    'common.decline': '拒绝',
    'common.replay': '回放',
    'common.report': '举报',
    'common.retry': '重试',
    'common.error_generic': '操作失败，请重试',
    'common.status.connected': '已连接',
    'common.status.connecting': '连接中',
    'common.status.disconnected': '已断开',
    'auth.title': 'Multi Web Game',
    'auth.subtitle': '游客登录、账号模式、实时房间、观战与训练模式',
    'auth.mode.guest': '游客',
    'auth.mode.login': '登录',
    'auth.mode.register': '注册',
    'auth.display_name': '昵称',
    'auth.display_name_placeholder': '玩家昵称',
    'auth.email': '邮箱',
    'auth.email_placeholder': 'you@example.com',
    'auth.password': '密码',
    'auth.password_placeholder': '********',
    'auth.submit.guest': '进入大厅',
    'auth.submit.login': '登录',
    'auth.submit.register': '创建账号',
    'auth.loading_session': '正在恢复会话...',
    'auth.network_retry': '网络请求失败，请稍后重试。若持续失败，可手动重置会话。',
    'auth.cors_retry': '请求被浏览器跨域策略拦截（CORS）。请刷新后重试；若持续失败可手动重置会话。',
    'auth.retry_restore_session': '重试恢复会话',
    'auth.reset_session': '重置会话',
    'auth.session_reset_done': '会话已重置，请重试。',
    'auth.session_restore_failed': '无法恢复会话，请重试。',
    'auth.session_restore_delayed': '会话恢复超时较久，建议重试或重置会话。',
    'auth.session_restore_network': '无法恢复会话：网络请求失败。请重试；若持续失败可手动重置会话。',
    'auth.session_restore_cors':
      '无法恢复会话：请求被跨域策略拦截（CORS）。请刷新后重试；若持续失败可手动重置会话。',
    'shell.nav.lobby': '大厅',
    'shell.nav.training': '训练',
    'shell.nav.2048': '2048',
    'shell.nav.logout': '退出',
    'shell.upgrade.title': '升级游客账号',
    'shell.upgrade.submit': '升级',
    'shell.upgrade.submitting': '升级中...',
    'lobby.title': '大厅',
    'lobby.subtitle': '开放房间、实时观战、多模式匹配',
    'lobby.create.gomoku': '创建五子棋房间',
    'lobby.create.go': '创建围棋房间',
    'lobby.create.xiangqi': '创建象棋房间',
    'lobby.training': '训练模式',
    'lobby.solo_2048': '2048 单人',
    'lobby.matchmaking': '匹配队列',
    'lobby.queue.gomoku': '五子棋',
    'lobby.queue.go': '围棋',
    'lobby.queue.xiangqi': '象棋',
    'lobby.queue.join': '加入{game}队列',
    'lobby.queue.leave': '离开{game}队列',
    'lobby.timeout': '{game}匹配超时',
    'lobby.rooms': '开放与进行中房间',
    'lobby.rooms.loading': '正在加载房间...',
    'lobby.rooms.empty': '暂无开放房间',
    'lobby.participants': '{count}/{max} 人 • {status}',
    'lobby.presence.title': '在线、积分、管理',
    'lobby.online': '在线用户',
    'lobby.online.empty': '暂无在线用户',
    'lobby.block.title': '屏蔽用户',
    'lobby.block.placeholder': '用户 UUID',
    'lobby.block.submit': '屏蔽',
    'lobby.invites': '待处理邀请',
    'lobby.invites.empty': '暂无邀请',
    'lobby.ratings': '我的积分',
    'lobby.ratings.loading': '正在加载积分...',
    'lobby.ratings.empty': '暂无积分记录',
    'lobby.formula': '积分公式',
    'lobby.formula.unavailable': '暂无法获取公式信息',
    'lobby.admin.queue': '管理员举报队列',
    'lobby.admin.loading': '正在加载举报...',
    'lobby.admin.empty': '暂无待处理举报',
    'lobby.admin.review': '标记已查看',
    'lobby.admin.resolve': '解决',
    'lobby.admin.dismiss': '驳回',
    'lobby.history': '对局历史',
    'lobby.history.loading': '正在加载历史...',
    'lobby.history.empty': '暂无历史对局',
    'lobby.report_submitted': '举报已提交',
    'lobby.user_blocked': '用户已屏蔽',
    'room.loading': '正在加载房间...',
    'room.title': '房间 {id}',
    'room.meta': '游戏: {game} • 状态: {status} • 视角: {role}',
    'room.leave': '离开房间',
    'room.try_join_player': '尝试成为玩家',
    'room.participants': '参与者 ({count}/{max})',
    'room.invite.title': '按用户 ID 邀请',
    'room.invite.placeholder': '目标用户 UUID',
    'room.invite.submit': '发送邀请',
    'room.game.title': '对局',
    'room.waiting_for_opponent': '等待对手加入后开始',
    'room.next_turn': '下一手: {player} • 状态: {status}',
    'room.turn_alert.your_turn': '轮到你落子',
    'room.turn_alert.your_turn_hint': '请在棋盘上选择并提交你的这一步。',
    'room.turn_alert.waiting': '等待对手操作',
    'room.turn_alert.waiting_hint': '当前不是你的回合，请留意棋盘变化。',
    'room.turn_alert.notification_title': '轮到你了',
    'room.turn_alert.notification_body': '房间内已轮到你行动，快回来下棋。',
    'room.last_move.title': '上一步',
    'room.last_move.player': '执子方',
    'room.last_move.action': '操作',
    'room.last_move.action.pass': '停一手',
    'room.last_move.action.place': '落子 {point}',
    'room.last_move.action.move': '从 {from} 到 {to}',
    'room.last_move.result': '局面',
    'room.last_move.empty': '暂无',
    'room.last_move.black_perspective': '注：当前按黑方视角展示坐标。',
    'room.result.winner': '结果: 胜方 {winner}',
    'room.result.draw': '结果: 和局',
    'room.pass': '停一手',
    'room.single_2048': '该房间为 2048 单人模式，请打开 2048 页面',
    'room.open_2048': '打开 2048',
    'room.go.scoring': '中国规则 • 黑: {black} • 白: {white} (贴目 {komi}) • 胜方: {winner}',
    'replay.loading': '正在加载回放...',
    'replay.title': '回放 {id}',
    'replay.meta': '游戏: {game} • 步数 {step}/{max}',
    'replay.start': '开局',
    'replay.prev': '上一步',
    'replay.play': '播放',
    'replay.pause': '暂停',
    'replay.next': '下一步',
    'replay.end': '终局',
    'replay.speed': '速度',
    'replay.score': '分数: {score} • 状态: {status}',
    'replay.moves.title': '着法列表',
    'replay.moves.round': '回合',
    'replay.moves.red': '红方',
    'replay.moves.black': '黑方',
    'replay.moves.empty': '—',
    'enum.role.player': '玩家',
    'enum.role.spectator': '观战',
    'enum.status.open': '开放',
    'enum.status.in_match': '对局中',
    'enum.status.closed': '已关闭',
    'enum.status.active': '进行中',
    'enum.status.abandoned': '已中止',
    'enum.status.playing': '进行中',
    'enum.status.completed': '已结束',
    'enum.status.draw': '和局',
    'enum.status.lost': '失败',
    'enum.status.won': '胜利',
    'enum.color.black': '黑',
    'enum.color.white': '白',
    'enum.color.red': '红',
    'enum.game.gomoku': '五子棋',
    'enum.game.go': '围棋',
    'enum.game.xiangqi': '象棋',
    'enum.game.single_2048': '2048',
    'error.room_not_found': '房间不存在',
    'error.room_access_denied': '无权加入该房间',
    'error.room_capacity': '房间已满',
    'error.room_closed': '房间已关闭',
    'error.no_active_match': '当前没有可进行的对局',
    'error.match_not_active': '当前对局未处于进行状态',
    'error.not_a_match_player': '你不是当前对局玩家',
    'error.room_not_subscribed': '请先进入房间后再操作',
    'error.room_join_failed': '加入房间失败，请稍后重试',
    'error.game_type_mismatch': '游戏类型不匹配',
    'error.out_of_turn': '未轮到你落子',
    'error.piece_not_owned': '只能操作己方棋子',
    'error.invalid_move': '非法落子',
    'error.realtime_unstable': '实时连接不稳定，正在尝试重连',
    'error.network': '网络请求失败，请稍后重试',
    'error.cors': '请求被浏览器跨域策略拦截（CORS），请刷新后重试',
    'error.auth_failed': '认证失败'
  },
  'en-US': {
    'common.language': 'Language',
    'common.lang.zh': '中文',
    'common.lang.en': 'English',
    'common.loading': 'Loading...',
    'common.join': 'Join',
    'common.spectate': 'Spectate',
    'common.accept': 'Accept',
    'common.decline': 'Decline',
    'common.replay': 'Replay',
    'common.report': 'Report',
    'common.retry': 'Retry',
    'common.error_generic': 'Operation failed. Please try again.',
    'common.status.connected': 'connected',
    'common.status.connecting': 'connecting',
    'common.status.disconnected': 'disconnected',
    'auth.title': 'Multi Web Game',
    'auth.subtitle': 'Guest entry, account mode, realtime rooms, spectators, and training mode.',
    'auth.mode.guest': 'Guest',
    'auth.mode.login': 'Login',
    'auth.mode.register': 'Register',
    'auth.display_name': 'Display Name',
    'auth.display_name_placeholder': 'Player Name',
    'auth.email': 'Email',
    'auth.email_placeholder': 'you@example.com',
    'auth.password': 'Password',
    'auth.password_placeholder': '********',
    'auth.submit.guest': 'Enter Lobby',
    'auth.submit.login': 'Sign In',
    'auth.submit.register': 'Create Account',
    'auth.loading_session': 'Loading session...',
    'auth.network_retry':
      'Network request failed. Please retry. If it keeps failing, reset session manually.',
    'auth.cors_retry':
      'Request blocked by browser CORS policy. Refresh and retry. If it keeps failing, reset session manually.',
    'auth.retry_restore_session': 'Retry session restore',
    'auth.reset_session': 'Reset session',
    'auth.session_reset_done': 'Session has been reset. Please retry.',
    'auth.session_restore_failed': 'Unable to restore session. Please retry.',
    'auth.session_restore_delayed': 'Session restore is taking too long. Retry or reset session.',
    'auth.session_restore_network':
      'Unable to restore session: network request failed. Retry, or reset session if this persists.',
    'auth.session_restore_cors':
      'Unable to restore session: blocked by browser CORS policy. Refresh and retry, or reset session if this persists.',
    'shell.nav.lobby': 'Lobby',
    'shell.nav.training': 'Training',
    'shell.nav.2048': '2048',
    'shell.nav.logout': 'Logout',
    'shell.upgrade.title': 'Upgrade Guest Account',
    'shell.upgrade.submit': 'Upgrade',
    'shell.upgrade.submitting': 'Upgrading...',
    'lobby.title': 'Lobby',
    'lobby.subtitle': 'Open rooms, live spectators, and multi-mode matchmaking.',
    'lobby.create.gomoku': 'Create Gomoku Room',
    'lobby.create.go': 'Create Go Room',
    'lobby.create.xiangqi': 'Create Xiangqi Room',
    'lobby.training': 'Training Mode',
    'lobby.solo_2048': '2048 Solo',
    'lobby.matchmaking': 'Matchmaking',
    'lobby.queue.gomoku': 'Gomoku',
    'lobby.queue.go': 'Go',
    'lobby.queue.xiangqi': 'Xiangqi',
    'lobby.queue.join': 'Queue {game}',
    'lobby.queue.leave': 'Leave {game} Queue',
    'lobby.timeout': 'Matchmaking timed out for {game}.',
    'lobby.rooms': 'Open & Live Rooms',
    'lobby.rooms.loading': 'Loading rooms...',
    'lobby.rooms.empty': 'No open rooms yet.',
    'lobby.participants': '{count}/{max} participants • {status}',
    'lobby.presence.title': 'Presence, Ratings, Moderation',
    'lobby.online': 'Online',
    'lobby.online.empty': 'No users online',
    'lobby.block.title': 'Block User',
    'lobby.block.placeholder': 'user UUID',
    'lobby.block.submit': 'Block',
    'lobby.invites': 'Pending Invites',
    'lobby.invites.empty': 'No pending invites.',
    'lobby.ratings': 'Your Ratings',
    'lobby.ratings.loading': 'Loading ratings...',
    'lobby.ratings.empty': 'No ratings yet.',
    'lobby.formula': 'Rating Formula',
    'lobby.formula.unavailable': 'Formula metadata unavailable.',
    'lobby.admin.queue': 'Admin Report Queue',
    'lobby.admin.loading': 'Loading reports...',
    'lobby.admin.empty': 'No open reports.',
    'lobby.admin.review': 'Mark Reviewed',
    'lobby.admin.resolve': 'Resolve',
    'lobby.admin.dismiss': 'Dismiss',
    'lobby.history': 'Match History',
    'lobby.history.loading': 'Loading history...',
    'lobby.history.empty': 'No match history yet.',
    'lobby.report_submitted': 'Report submitted.',
    'lobby.user_blocked': 'User blocked.',
    'room.loading': 'Loading room...',
    'room.title': 'Room {id}',
    'room.meta': 'Game: {game} • Status: {status} • View: {role}',
    'room.leave': 'Leave Room',
    'room.try_join_player': 'Try Join As Player',
    'room.participants': 'Participants ({count}/{max})',
    'room.invite.title': 'Invite User By ID',
    'room.invite.placeholder': 'target user UUID',
    'room.invite.submit': 'Send Invite',
    'room.game.title': 'Game',
    'room.waiting_for_opponent': 'Waiting for an opponent to join before the match starts.',
    'room.next_turn': 'Next turn: {player} • Status: {status}',
    'room.turn_alert.your_turn': 'Your turn',
    'room.turn_alert.your_turn_hint': 'Select and submit your move on the board.',
    'room.turn_alert.waiting': 'Opponent is thinking',
    'room.turn_alert.waiting_hint': 'It is not your turn yet.',
    'room.turn_alert.notification_title': 'Your turn',
    'room.turn_alert.notification_body': 'It is your move in the room.',
    'room.last_move.title': 'Last Move',
    'room.last_move.player': 'Player',
    'room.last_move.action': 'Action',
    'room.last_move.action.pass': 'Pass',
    'room.last_move.action.place': 'Place at {point}',
    'room.last_move.action.move': 'Move {from} -> {to}',
    'room.last_move.result': 'Result',
    'room.last_move.empty': 'No moves yet',
    'room.last_move.black_perspective': 'Coordinates are shown from black perspective.',
    'room.result.winner': 'Result: winner {winner}',
    'room.result.draw': 'Result: draw',
    'room.pass': 'Pass',
    'room.single_2048': 'This room uses solo 2048 mode. Open the 2048 page.',
    'room.open_2048': 'Open 2048',
    'room.go.scoring': 'Chinese score • Black: {black} • White: {white} (komi {komi}) • Winner: {winner}',
    'replay.loading': 'Loading replay...',
    'replay.title': 'Replay {id}',
    'replay.meta': 'Game: {game} • Step {step}/{max}',
    'replay.start': 'Start',
    'replay.prev': 'Prev',
    'replay.play': 'Play',
    'replay.pause': 'Pause',
    'replay.next': 'Next',
    'replay.end': 'End',
    'replay.speed': 'Speed',
    'replay.score': 'Score: {score} • Status: {status}',
    'replay.moves.title': 'Move List',
    'replay.moves.round': 'Round',
    'replay.moves.red': 'Red',
    'replay.moves.black': 'Black',
    'replay.moves.empty': '—',
    'enum.role.player': 'player',
    'enum.role.spectator': 'spectator',
    'enum.status.open': 'open',
    'enum.status.in_match': 'in_match',
    'enum.status.closed': 'closed',
    'enum.status.active': 'active',
    'enum.status.abandoned': 'abandoned',
    'enum.status.playing': 'playing',
    'enum.status.completed': 'completed',
    'enum.status.draw': 'draw',
    'enum.status.lost': 'lost',
    'enum.status.won': 'won',
    'enum.color.black': 'black',
    'enum.color.white': 'white',
    'enum.color.red': 'red',
    'enum.game.gomoku': 'gomoku',
    'enum.game.go': 'go',
    'enum.game.xiangqi': 'xiangqi',
    'enum.game.single_2048': '2048',
    'error.room_not_found': 'Room not found',
    'error.room_access_denied': 'Room access denied',
    'error.room_capacity': 'Room capacity reached',
    'error.room_closed': 'Room is closed',
    'error.no_active_match': 'No active match',
    'error.match_not_active': 'Match is not active',
    'error.not_a_match_player': 'Not a match player',
    'error.room_not_subscribed': 'Join the room before sending actions',
    'error.room_join_failed': 'Failed to join room. Please retry.',
    'error.game_type_mismatch': 'Game type mismatch',
    'error.out_of_turn': 'It is not your turn',
    'error.piece_not_owned': 'You can only move your own piece',
    'error.invalid_move': 'Invalid move',
    'error.realtime_unstable': 'Realtime connection is unstable. Reconnecting…',
    'error.network': 'Network request failed. Please retry.',
    'error.cors': 'Request blocked by browser CORS policy. Please refresh and retry.',
    'error.auth_failed': 'Authentication failed'
  }
};

const AUTH_ERROR_SIGNALS = ['invalid credentials', 'authenticate_first', 'authentication failed'];

export function normalizeLocale(input: string | null | undefined): AppLocale {
  if (!input) {
    return 'zh-CN';
  }

  const value = input.toLowerCase();
  if (value.startsWith('en')) {
    return 'en-US';
  }
  return 'zh-CN';
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(vars[key] ?? ''));
}

export function resolveInitialLocale(params?: {
  savedLocale?: string | null;
  navigatorLanguage?: string | null;
}): AppLocale {
  if (params?.savedLocale) {
    return normalizeLocale(params.savedLocale);
  }

  if (params?.navigatorLanguage) {
    const browser = normalizeLocale(params.navigatorLanguage);
    if (browser === 'zh-CN') {
      return browser;
    }
  }

  return 'zh-CN';
}

function detectDefaultLocale(): AppLocale {
  return resolveInitialLocale({
    savedLocale: storage.getLocale(),
    navigatorLanguage: typeof navigator !== 'undefined' ? navigator.language : null
  });
}

interface I18nValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, vars?: Vars) => string;
  translateError: (message: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => detectDefaultLocale());

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    storage.setLocale(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const template = messages[locale][key] ?? messages['en-US'][key] ?? key;
      return interpolate(template, vars);
    },
    [locale]
  );

  const translateError = useCallback(
    (message: string) => {
      const normalized = message.trim().toLowerCase();
      const withCode = (key: string) => {
        const translated = t(key);
        const isMachineCode = /^[a-z0-9_.:-]{3,80}$/.test(normalized);
        return isMachineCode ? `${translated} (${normalized})` : translated;
      };

      const transport = classifyTransportErrorMessage(normalized);
      if (transport === 'cors') {
        return t('error.cors');
      }
      if (transport === 'network') {
        return t('error.network');
      }

      if (normalized.includes('room_not_found') || normalized.includes('room not found')) {
        return t('error.room_not_found');
      }
      if (normalized.includes('room_access_denied')) {
        return t('error.room_access_denied');
      }
      if (normalized.includes('capacity')) {
        return t('error.room_capacity');
      }
      if (normalized.includes('room is closed') || normalized.includes('room_closed')) {
        return t('error.room_closed');
      }
      if (normalized.includes('no_active_match')) {
        return withCode('error.no_active_match');
      }
      if (normalized.includes('match_is_not_active')) {
        return withCode('error.match_not_active');
      }
      if (normalized.includes('not_a_match_player')) {
        return withCode('error.not_a_match_player');
      }
      if (normalized.includes('room_not_subscribed')) {
        return withCode('error.room_not_subscribed');
      }
      if (normalized.includes('room_join_failed')) {
        return withCode('error.room_join_failed');
      }
      if (normalized.includes('game_type_mismatch')) {
        return withCode('error.game_type_mismatch');
      }
      if (normalized.includes('out_of_turn')) {
        return withCode('error.out_of_turn');
      }
      if (normalized.includes('piece_not_owned')) {
        return withCode('error.piece_not_owned');
      }
      if (
        normalized.includes('pong_timeout') ||
        normalized.includes('heartbeat_timeout') ||
        normalized.includes('auth_timeout') ||
        normalized.includes('realtime_transport_error')
      ) {
        return withCode('error.realtime_unstable');
      }
      if (normalized.includes('invalid_move') || normalized.includes('illegal_')) {
        return withCode('error.invalid_move');
      }
      if (
        isAuthInvalidMessage(normalized) ||
        AUTH_ERROR_SIGNALS.some((signal) => normalized.includes(signal))
      ) {
        return t('error.auth_failed');
      }

      return locale === 'zh-CN' ? `${t('common.error_generic')}: ${message}` : message;
    },
    [locale, t]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      translateError
    }),
    [locale, setLocale, t, translateError]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return value;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-switcher" aria-label={t('common.language')}>
      <span>{t('common.language')}</span>
      <button
        type="button"
        className={locale === 'zh-CN' ? '' : 'secondary'}
        onClick={() => setLocale('zh-CN')}
      >
        {t('common.lang.zh')}
      </button>
      <button
        type="button"
        className={locale === 'en-US' ? '' : 'secondary'}
        onClick={() => setLocale('en-US')}
      >
        {t('common.lang.en')}
      </button>
    </div>
  );
}
