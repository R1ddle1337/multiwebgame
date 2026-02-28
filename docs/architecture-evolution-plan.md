# 架构演进初版计划（v0.1）

更新时间：2026-02-28  
适用范围：`apps/api`、`apps/realtime`、`apps/web`、`packages/game-engines`、`packages/shared-types`

## 1. 现状痛点

### 1.1 运行时与协议处理耦合过重

- `apps/realtime/src/server.ts` 约 1490 行，单文件同时承担：
  - WS 鉴权与连接生命周期
  - 协议解析与校验（Zod）
  - 房间订阅、匹配、重连、超时
  - 对局状态推进、落库、广播
- 结果：新增一个游戏类型时，必须在同一文件内多点改动，回归风险高。

### 1.2 数据访问与业务规则耦合过重

- `apps/api/src/store/postgres-store.ts` 约 1210 行。
- `apps/realtime/src/repository.ts` 约 905 行。
- 两侧都包含房间生命周期、评分常量、DTO 映射等逻辑，存在重复实现和漂移风险。

### 1.3 游戏扩展路径分散，缺少统一 SDK 契约

- 当前游戏接入依赖多处显式分支：
  - `shared-types` 的联合类型
  - realtime 的 `createRuntime/handleMove/replayMoves` 分支
  - web `RoomPage` 的按 `gameType` 条件渲染
- 没有统一的“游戏适配器”接口，导致接入流程高度依赖人工记忆。

### 1.4 跨层契约演进缺少版本化抓手

- API/WS/回放字段目前以“直接改类型 + 全量升级”为主。
- 对历史回放/历史 move payload 的兼容策略没有统一规范，长期会影响回溯与重放可靠性。

### 1.5 可观测性与回归边界不清晰

- 缺少按“用例层”和“游戏适配层”划分的指标/日志与契约测试分层。
- 结果是定位问题时常落到“读大文件 + 全链路猜测”。

## 2. 目标分层架构

### 2.1 分层目标

通过“协议层 -> 应用层 -> 游戏域层 -> 基础设施层”分离，达到：

- 接入新游戏时，主流程以“注册 + 适配器实现”为核心，不再在多处硬编码分支。
- API 与 Realtime 对房间/对局规则共享同一套领域服务边界。
- 协议演进可版本化，回放数据可长期兼容。

### 2.2 目标结构（逻辑）

```text
L0 Contracts（共享契约层）
  packages/shared-types
  - DTO / WS Envelope / 错误码 / 协议版本
  - Game SDK 类型定义（接口，不含实现）

L1 Application（应用编排层）
  apps/api
  - Route Controller -> UseCase -> Domain Service
  apps/realtime
  - WS Transport -> Message Handler -> UseCase

L2 Domain（领域与游戏层）
  packages/game-engines
  - 各游戏纯规则引擎
  packages/game-sdk (规划新增)
  - GameAdapter 接口、通用测试夹具、Registry

L3 Infrastructure（基础设施层）
  Postgres / Redis / WS / JWT / 外部配置
  - Repository、缓存、消息广播、持久化
```

### 2.3 责任边界

- Contracts 层：只能定义类型、错误码、协议版本；不含业务副作用。
- Application 层：负责流程编排、权限校验、事务边界，不直接写游戏规则。
- Domain/Game 层：纯函数、可重放、可测试，不访问 DB/网络。
- Infrastructure 层：只处理 IO，不承载玩法规则。

## 3. Game SDK 接入规范

### 3.1 目标

建立统一“游戏适配器”规范，让新增游戏按模板接入，减少跨服务改动面。

### 3.2 推荐接口（草案）

```ts
export interface GameAdapter<
  TGameType extends string,
  TState,
  TMove,
  TResultPayload extends Record<string, unknown> | null
> {
  gameType: TGameType;
  protocolVersion: number;
  mode: 'realtime_turn' | 'solo_local';

  createInitialState(): TState;

  parseClientMove(
    input: unknown,
    ctx: { actorUserId: string }
  ):
    | {
        ok: true;
        move: TMove;
      }
    | {
        ok: false;
        reason: string;
      };

  applyMove(
    state: TState,
    move: TMove
  ): {
    accepted: boolean;
    reason?: string;
    nextState: TState;
    persistedMoveType: string;
    persistedPayload: Record<string, unknown>;
  };

  deriveCompletion(
    state: TState,
    seats: string[]
  ):
    | {
        completed: false;
      }
    | {
        completed: true;
        winnerUserId: string | null;
        resultPayload: TResultPayload;
        status: 'completed' | 'abandoned';
      };

  projectRoomState(state: TState, viewerRole: 'player' | 'spectator'): unknown;
  replayFromMoves(initial: TState, moves: Array<Record<string, unknown>>): TState;
}
```

### 3.3 规范要求

- 必须纯函数：禁止 `Date.now()/Math.random()` 非受控使用。
- 必须可回放：`replayFromMoves` 对同一输入得到同一状态。
- 必须定义持久化 payload 结构：用于 `match_moves.payload` 与回放兼容。
- 必须定义错误码：非法走子返回稳定错误字符串，供前后端统一 i18n。
- 必须提供最小测试集：
  - 合法走子
  - 非法走子
  - 终局判定
  - 回放一致性
  - 协议解码失败路径

### 3.4 注册机制（目标态）

- Realtime 通过 `GameRegistry` 进行 `gameType -> adapter` 查找，不再在 `server.ts` 中硬编码分支。
- Web 通过 `GameViewRegistry` 进行 `gameType -> 页面组件/操作映射` 查找，降低 `RoomPage` 条件分支复杂度。

## 4. M1/M2/M3 里程碑

### 4.1 M1：边界固化与骨架拆分（预计 2 周）

- 目标：
  - 固化分层边界与 SDK 接口草案。
  - 将 realtime 的“传输层/应用层/游戏层”拆出骨架（先不改行为）。
- 交付：
  - `GameAdapter` 与 `GameRegistry` 类型定义（可先落在 `shared-types` 或新 `packages/game-sdk`）。
  - Realtime handler 分目录（auth/room/matchmaking/move）结构。
  - 契约测试基线（协议回归 + 回放回归）。
- 完成标准：
  - 现有游戏功能无行为变化；
  - 文档同步更新（`docs/architecture.md`、协议文档）。

### 4.2 M2：存量游戏适配器化与前端解耦（预计 3 周）

- 目标：
  - Gomoku/Go/Xiangqi/2048 完成统一适配器封装。
  - 前端房间页引入游戏视图注册机制。
- 交付：
  - 统一 `move` 处理管线（parse/apply/persist/broadcast/finish）。
  - API/Realtime 共享领域服务（如房间生命周期、评分公式）抽象方案。
  - 回放 payload 版本字段与兼容策略。
- 完成标准：
  - 新增或调整游戏规则时，改动集中在引擎 + 适配器 + 注册；
  - 主要回归测试覆盖通过。

### 4.3 M3：新游戏试点与工程化收敛（预计 2 周）

- 目标：
  - 用一个新游戏做端到端试点，验证接入效率。
  - 补齐可观测性与发布治理。
- 交付：
  - 新游戏试点（示例：`connect4`）从规则到前端上线演练。
  - 指标与日志分层（transport/usecase/game）。
  - 接入模板与 Checklist 文档化。
- 完成标准：
  - 新游戏接入可在 1 个迭代内完成并可回放；
  - 回滚与兼容策略可执行。

## 5. P0/P1/P2 任务清单

### 5.1 P0（必须优先，阻塞后续）

- 定义并冻结 `GameAdapter` 最小接口（含错误码规范）。
- 梳理并固定现有 WS/API 契约的兼容策略（新增字段只增不删、保留默认值）。
- realtime 拆分 `server.ts` 为 transport + handlers + runtime service（先搬迁再优化）。
- 建立“回放一致性”测试基线（每个游戏至少一条完整对局快照回放）。
- 统一房间生命周期规则来源，避免 API 与 realtime 双份规则漂移。

### 5.2 P1（重要，但可并行推进）

- 引入 `GameRegistry` 与 `GameViewRegistry`，替换主要硬编码分支。
- 将评分公式、默认房间容量等规则下沉到共享领域配置。
- 为 `match_moves.payload/result_payload` 增加 schema version 字段。
- 建立协议变更模板（包含 `docs/api.md`、`docs/realtime-protocol.md` 同步检查项）。
- 增加按游戏维度的运行指标（请求量、非法走子率、对局完成率）。

### 5.3 P2（增强项）

- 生成式脚手架：`create-game-adapter`（模板 + 测试样板）。
- 插件化装载能力（按配置启用/禁用游戏模式）。
- 回放兼容性自动巡检任务（历史样本重放 diff）。
- 压测与容量建模（按游戏类型拆分）。

## 6. 示例：新游戏接入流程（以 Connect Four 为例）

### 6.1 流程步骤

1. 需求与规则冻结  
   在 `docs/rulesets.md` 增补 `connect4` 规则、终局判定、平局条件、回放字段。

2. 契约定义  
   在 `packages/shared-types` 增加 `connect4` 的 state/move/result DTO 与错误码，并更新 `GameType`。

3. 引擎实现  
   在 `packages/game-engines` 新增纯函数引擎：`createConnect4State`、`applyConnect4Move`。

4. SDK 适配器实现  
   新增 `Connect4Adapter`，实现 parse/apply/replay/deriveCompletion/projectRoomState。

5. Realtime 接入  
   在 `GameRegistry` 注册 `connect4`，确保房间创建、订阅、move、完成广播走统一管线。

6. API 接入  
   放开建房 `gameType` 白名单，补齐 rating formula 与历史查询返回结构。

7. Web 接入  
   新增 `Connect4Board` 与视图注册项，房间页通过 registry 渲染并发送 move。

8. 验证与文档  
   至少执行：`npm run lint`、`npm run typecheck`、`npm run test`；同步更新 API/Realtime/Architecture 文档。

### 6.2 期望改动面（目标态）

- 主要新增文件集中于：
  - `packages/game-engines`（规则实现）
  - `packages/game-sdk`（适配器实现）
  - `apps/web/src/games/connect4/*`（展示与交互）
- 既有核心文件（如 realtime 主入口）只做“注册项”变更，不再出现大段 `if (gameType === ...)`。

## 7. 非目标（本阶段不做）

- 不引入微服务拆分或跨进程游戏运行时。
- 不在本计划阶段重写数据库模型。
- 不变更 v1 对外协议语义，仅做结构化重组与可扩展性增强。
