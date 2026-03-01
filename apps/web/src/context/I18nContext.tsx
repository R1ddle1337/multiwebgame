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
    'lobby.create.santorini': '创建圣托里尼房间',
    'lobby.create.onitama': '创建御圣棋房间',
    'lobby.create.love_letter': '创建情书房间',
    'lobby.create.codenames_duet': '创建代号：双人版房间',
    'lobby.create.backgammon': '创建双陆棋房间',
    'lobby.create.cards': '创建 Crazy Eights 房间',
    'lobby.create.liars_dice': '创建吹牛骰子房间',
    'lobby.create.quoridor': '创建步步为营房间',
    'lobby.create.hex': '创建六角棋房间',
    'lobby.create.connect4': '创建四子棋房间',
    'lobby.create.reversi': '创建黑白棋房间',
    'lobby.create.dots': '创建点格棋房间',
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
    'room.invite_link.title': '邀请链接',
    'room.invite_link.hint': '可重复使用，直到该房间对局结束或房间关闭。',
    'room.invite_link.generate': '生成邀请链接',
    'room.invite_link.copy': '复制链接',
    'room.invite_link.copied': '已复制到剪贴板',
    'room.invite_link.copy_manual': '复制失败，请手动复制链接',
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
    'room.reversi.counts': '子数 • 黑: {black} • 白: {white}',
    'room.dots.scores': '得分 • 黑: {black} • 白: {white}',
    'room.santorini.setup': '部署工人阶段',
    'room.santorini.place': '放置工人',
    'room.santorini.move_build': '移动并建造',
    'room.onitama.waiting_rng': '等待双方完成随机承诺与揭示后抽取动作卡',
    'room.onitama.move': '走子',
    'room.love_letter.waiting_rng': '等待双方完成随机承诺与揭示后洗牌发牌',
    'room.love_letter.play': '出牌',
    'room.love_letter.draw_pile': '牌堆剩余: {count}',
    'room.love_letter.hand_counts': '手牌数 • 黑: {black} • 白: {white}',
    'room.love_letter.hidden_hand': '当前视角不可见手牌。',
    'room.love_letter.your_hand': '你的手牌: {cards}',
    'room.codenames.waiting_rng': '等待双方完成随机承诺与揭示后生成词板与密钥',
    'room.codenames.submit_clue': '提交提示',
    'room.codenames.submit_guess': '猜词',
    'room.codenames.end_guesses': '结束猜词',
    'room.codenames.turns_remaining': '剩余回合: {turns}',
    'room.codenames.targets': '目标进度: {found}/{total}',
    'room.codenames.phase_clue': '提示阶段',
    'room.codenames.phase_guess': '猜词阶段',
    'room.codenames.outcome.success': '合作成功，已找出全部目标词',
    'room.codenames.outcome.assassin': '踩中黑词，合作失败',
    'room.codenames.outcome.out_of_turns': '回合耗尽，合作失败',
    'room.cards.waiting_rng': '等待双方完成随机承诺与揭示后发牌',
    'room.cards.top': '弃牌堆顶: {card}',
    'room.cards.active_suit': '当前花色: {suit}',
    'room.cards.hand_counts': '手牌数 • 黑: {black} • 白: {white}',
    'room.cards.draw_pile': '牌库剩余: {count}',
    'room.cards.discard_pile': '弃牌堆数量: {count}',
    'room.cards.your_hand': '你的手牌',
    'room.cards.hidden_hand': '你当前不可见手牌（观战或对手手牌）。',
    'room.cards.draw': '摸 1 张',
    'room.cards.end_turn': '结束回合',
    'room.cards.pending_draw_play': '你已摸到可出的牌，可立即出牌或结束回合。',
    'room.liars.waiting_rng': '等待双方完成随机承诺与揭示后掷骰',
    'room.liars.dice_counts': '剩余骰子 • 黑: {black} • 白: {white}',
    'room.liars.your_dice': '你的骰子: {dice}',
    'room.liars.hidden_dice': '当前视角不可见骰子点数。',
    'room.liars.current_bid': '当前出价: {quantity} 个 {face}',
    'room.liars.no_bid': '当前还没有出价。',
    'room.liars.bid_history': '出价链: {chain}',
    'room.liars.bid_input': '出价（数量/点数）',
    'room.liars.face': '点数',
    'room.liars.bid_submit': '提交出价',
    'room.liars.call_liar': '叫 Liar',
    'room.liars.last_round': '上轮结算: 出价 {quantity} 个 {face}，匹配 {total}，输家 {loser}',
    'room.quoridor.walls_remaining': '剩余墙数 • 黑: {black} • 白: {white}',
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
    'replay.liars.round': '第 {round} 轮: 出价 {quantity} 个 {face}，匹配 {total}',
    'replay.liars.dice': '黑骰: {black} | 白骰: {white}',
    'replay.liars.bids': '出价链: {chain}',
    'invite.title': '邀请链接加入',
    'invite.processing': '正在处理邀请链接，请稍候...',
    'invite.failed': '邀请处理失败',
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
    'enum.color.yellow': '黄',
    'enum.game.connect4': '四子棋',
    'enum.game.reversi': '黑白棋',
    'enum.game.dots': '点格棋',
    'enum.game.gomoku': '五子棋',
    'enum.game.santorini': '圣托里尼',
    'enum.game.onitama': '御圣棋',
    'enum.game.love_letter': '情书',
    'enum.game.codenames_duet': '代号：双人版',
    'enum.game.backgammon': '双陆棋',
    'enum.game.cards': '扑克（Crazy Eights）',
    'enum.game.liars_dice': '吹牛骰子',
    'enum.game.quoridor': '步步为营',
    'enum.game.hex': '六角棋',
    'enum.game.go': '围棋',
    'enum.game.xiangqi': '象棋',
    'enum.game.single_2048': '2048',
    'enum.suit.clubs': '梅花',
    'enum.suit.diamonds': '方片',
    'enum.suit.hearts': '红桃',
    'enum.suit.spades': '黑桃',
    'error.room_not_found': '房间不存在',
    'error.room_access_denied': '无权加入该房间',
    'error.room_capacity': '房间已满',
    'error.room_closed': '房间已关闭',
    'error.no_active_match': '当前没有可进行的对局',
    'error.match_not_active': '当前对局未处于进行状态',
    'error.not_a_match_player': '你不是当前对局玩家',
    'error.room_not_subscribed': '请先进入房间后再操作',
    'error.room_join_failed': '加入房间失败，请稍后重试',
    'error.invite_invalid': '邀请链接已失效或不可用',
    'error.game_type_mismatch': '游戏类型不匹配',
    'error.out_of_bounds': '坐标超出棋盘范围',
    'error.out_of_turn': '未轮到你落子',
    'error.column_full': '该列已满',
    'error.line_already_drawn': '该线已被画过',
    'error.wall_crossing': '墙体不可交叉',
    'error.occupied_wall': '该位置已有墙',
    'error.blocks_all_paths': '放墙后必须保留双方到终点的路径',
    'error.no_walls_remaining': '你的墙已用完',
    'error.piece_not_owned': '只能操作己方棋子',
    'error.bid_not_higher': '出价必须严格高于上一手',
    'error.no_bid_to_call': '当前没有可叫 liar 的出价',
    'error.invalid_bid_quantity': '出价数量不合法',
    'error.invalid_bid_face': '出价点数必须在 1 到 6',
    'error.bid_exceeds_total_dice': '出价数量不能超过场上总骰子数',
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
    'lobby.create.santorini': 'Create Santorini Room',
    'lobby.create.onitama': 'Create Onitama Room',
    'lobby.create.love_letter': 'Create Love Letter Room',
    'lobby.create.codenames_duet': 'Create Codenames Duet Room',
    'lobby.create.backgammon': 'Create Backgammon Room',
    'lobby.create.cards': 'Create Crazy Eights Room',
    'lobby.create.liars_dice': "Create Liar's Dice Room",
    'lobby.create.quoridor': 'Create Quoridor Room',
    'lobby.create.hex': 'Create Hex Room',
    'lobby.create.connect4': 'Create Connect Four Room',
    'lobby.create.reversi': 'Create Reversi Room',
    'lobby.create.dots': 'Create Dots Room',
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
    'room.invite_link.title': 'Invite Link',
    'room.invite_link.hint': 'Reusable until the room match ends or the room is closed.',
    'room.invite_link.generate': 'Generate Invite Link',
    'room.invite_link.copy': 'Copy Link',
    'room.invite_link.copied': 'Copied to clipboard',
    'room.invite_link.copy_manual': 'Copy failed. Please copy the link manually.',
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
    'room.reversi.counts': 'Discs • Black: {black} • White: {white}',
    'room.dots.scores': 'Score • Black: {black} • White: {white}',
    'room.santorini.setup': 'Worker placement phase',
    'room.santorini.place': 'Place Worker',
    'room.santorini.move_build': 'Move + Build',
    'room.onitama.waiting_rng': 'Waiting for commit-reveal to finish before drawing move cards.',
    'room.onitama.move': 'Move',
    'room.love_letter.waiting_rng': 'Waiting for commit-reveal to finish before shuffling and dealing.',
    'room.love_letter.play': 'Play Card',
    'room.love_letter.draw_pile': 'Deck left: {count}',
    'room.love_letter.hand_counts': 'Hand count • Black: {black} • White: {white}',
    'room.love_letter.hidden_hand': 'Hand is hidden for this view.',
    'room.love_letter.your_hand': 'Your hand: {cards}',
    'room.codenames.waiting_rng': 'Waiting for commit-reveal to finish before generating words and keys.',
    'room.codenames.submit_clue': 'Submit Clue',
    'room.codenames.submit_guess': 'Guess',
    'room.codenames.end_guesses': 'End Guesses',
    'room.codenames.turns_remaining': 'Turns left: {turns}',
    'room.codenames.targets': 'Targets: {found}/{total}',
    'room.codenames.phase_clue': 'Clue phase',
    'room.codenames.phase_guess': 'Guess phase',
    'room.codenames.outcome.success': 'Co-op success: all target words found.',
    'room.codenames.outcome.assassin': 'Assassin hit: mission failed.',
    'room.codenames.outcome.out_of_turns': 'No turns left: mission failed.',
    'room.cards.waiting_rng': 'Waiting for commit-reveal to finish before dealing cards.',
    'room.cards.top': 'Top discard: {card}',
    'room.cards.active_suit': 'Active suit: {suit}',
    'room.cards.hand_counts': 'Hand count • Black: {black} • White: {white}',
    'room.cards.draw_pile': 'Draw pile: {count}',
    'room.cards.discard_pile': 'Discard pile: {count}',
    'room.cards.your_hand': 'Your hand',
    'room.cards.hidden_hand': 'Hand is hidden for this view.',
    'room.cards.draw': 'Draw 1',
    'room.cards.end_turn': 'End Turn',
    'room.cards.pending_draw_play': 'You drew a playable card. Play now or end your turn.',
    'room.liars.waiting_rng': 'Waiting for commit-reveal to finish before rolling dice.',
    'room.liars.dice_counts': 'Dice left • Black: {black} • White: {white}',
    'room.liars.your_dice': 'Your dice: {dice}',
    'room.liars.hidden_dice': 'Dice values are hidden for this view.',
    'room.liars.current_bid': 'Current bid: {quantity} of face {face}',
    'room.liars.no_bid': 'No active bid yet.',
    'room.liars.bid_history': 'Bid chain: {chain}',
    'room.liars.bid_input': 'Bid (quantity/face)',
    'room.liars.face': 'Face',
    'room.liars.bid_submit': 'Submit Bid',
    'room.liars.call_liar': 'Call Liar',
    'room.liars.last_round': 'Last round: bid {quantity} of face {face}, matched {total}, loser {loser}',
    'room.quoridor.walls_remaining': 'Walls left • Black: {black} • White: {white}',
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
    'replay.liars.round': 'Round {round}: bid {quantity} of face {face}, matched {total}',
    'replay.liars.dice': 'Black dice: {black} | White dice: {white}',
    'replay.liars.bids': 'Bid chain: {chain}',
    'invite.title': 'Join Via Invite Link',
    'invite.processing': 'Processing invite link...',
    'invite.failed': 'Unable to join from invite link',
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
    'enum.color.yellow': 'yellow',
    'enum.game.connect4': 'connect4',
    'enum.game.reversi': 'reversi',
    'enum.game.dots': 'dots',
    'enum.game.gomoku': 'gomoku',
    'enum.game.santorini': 'santorini',
    'enum.game.onitama': 'onitama',
    'enum.game.love_letter': 'love_letter',
    'enum.game.codenames_duet': 'codenames_duet',
    'enum.game.backgammon': 'backgammon',
    'enum.game.cards': 'cards',
    'enum.game.liars_dice': 'liars_dice',
    'enum.game.quoridor': 'quoridor',
    'enum.game.hex': 'hex',
    'enum.game.go': 'go',
    'enum.game.xiangqi': 'xiangqi',
    'enum.game.single_2048': '2048',
    'enum.suit.clubs': 'clubs',
    'enum.suit.diamonds': 'diamonds',
    'enum.suit.hearts': 'hearts',
    'enum.suit.spades': 'spades',
    'error.room_not_found': 'Room not found',
    'error.room_access_denied': 'Room access denied',
    'error.room_capacity': 'Room capacity reached',
    'error.room_closed': 'Room is closed',
    'error.no_active_match': 'No active match',
    'error.match_not_active': 'Match is not active',
    'error.not_a_match_player': 'Not a match player',
    'error.room_not_subscribed': 'Join the room before sending actions',
    'error.room_join_failed': 'Failed to join room. Please retry.',
    'error.invite_invalid': 'Invite link is invalid or expired',
    'error.game_type_mismatch': 'Game type mismatch',
    'error.out_of_bounds': 'Move coordinates are out of bounds',
    'error.out_of_turn': 'It is not your turn',
    'error.column_full': 'Selected column is full',
    'error.line_already_drawn': 'Selected line is already drawn',
    'error.wall_crossing': 'Walls cannot cross',
    'error.occupied_wall': 'Wall already exists at this anchor',
    'error.blocks_all_paths': 'Wall placement must keep both players with a path',
    'error.no_walls_remaining': 'No walls remaining',
    'error.piece_not_owned': 'You can only move your own piece',
    'error.bid_not_higher': 'Bid must be strictly higher than the previous bid',
    'error.no_bid_to_call': 'No bid to challenge right now',
    'error.invalid_bid_quantity': 'Bid quantity is invalid',
    'error.invalid_bid_face': 'Bid face must be between 1 and 6',
    'error.bid_exceeds_total_dice': 'Bid cannot exceed total dice in play',
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
      if (normalized.includes('invite_invalid') || normalized.includes('match_ended')) {
        return withCode('error.invite_invalid');
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
      if (normalized.includes('out_of_bounds')) {
        return withCode('error.out_of_bounds');
      }
      if (normalized.includes('out_of_turn')) {
        return withCode('error.out_of_turn');
      }
      if (normalized.includes('piece_not_owned')) {
        return withCode('error.piece_not_owned');
      }
      if (normalized.includes('bid_not_higher')) {
        return withCode('error.bid_not_higher');
      }
      if (normalized.includes('no_bid_to_call')) {
        return withCode('error.no_bid_to_call');
      }
      if (normalized.includes('invalid_bid_quantity')) {
        return withCode('error.invalid_bid_quantity');
      }
      if (normalized.includes('invalid_bid_face')) {
        return withCode('error.invalid_bid_face');
      }
      if (normalized.includes('bid_exceeds_total_dice')) {
        return withCode('error.bid_exceeds_total_dice');
      }
      if (
        normalized.includes('card_not_in_hand') ||
        normalized.includes('card_not_playable') ||
        normalized.includes('choose_suit_required') ||
        normalized.includes('draw_not_allowed_when_playable') ||
        normalized.includes('must_resolve_draw_play') ||
        normalized.includes('end_turn_not_allowed')
      ) {
        return withCode('error.invalid_move');
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
