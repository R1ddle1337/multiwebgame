# Game Rulesets and Adjudication Policy (v1)

This document is the implementation reference for server-authoritative adjudication in Phase 0-4 completion.

## Gomoku

Engine supports configurable rulesets:

- `freestyle`
  - Any line length `>= 5` wins.

- `renju` (restricted mode)
  - Black forbidden moves are rejected:
    - overline (`> 5` in a row)
    - double-three
    - double-four
  - Black wins only on exact five.
  - White wins on line length `>= 5`.

Common legality:

- turn order enforced
- bounds enforced
- occupied-cell moves rejected
- draw declared on board fill without winner

## Xiangqi (Chinese Chess)

Implemented movement/legality:

- palace constraints (general/advisor)
- facing generals rule via check legality
- horse-leg blocking
- elephant-eye blocking + river restriction
- cannon screen capture logic
- self-check prevention for all moves
- legal move generation is derived from piece movement + post-move check validation to prevent illegal board states

End-state adjudication:

- general capture -> immediate win (`capture_general`)
- checkmate -> win for attacker (`checkmate`)
- stalemate -> win for attacker (`stalemate`)

Deterministic repetition policy (v1):

- position hash includes board + side-to-move
- on the 3rd occurrence of the same hash:
  - if side-to-move is in check after the repeating move, the repeating mover loses (`perpetual_check_violation`)
  - otherwise result is draw (`draw_repetition`)

This policy is an explicit deterministic v1 strategy for perpetual-check/perpetual-chase handling.

## Go (Weiqi)

Implemented core legality:

- capture removal
- suicide prohibition
- simple ko prohibition (`koPoint`)
- pass move support

Match completion:

- two consecutive passes end the game

Scoring (implemented ruleset):

- Chinese area scoring
- configurable komi (default `7.5`)

Scoring breakdown includes:

- stones on board per color
- territory per color
- captures per color (metadata)
- komi applied to white
- total points, winner, and margin

Persistence:

- Go score breakdown is stored in `matches.result_payload` on match completion.

## Quoridor (2-player, 9x9)

Implemented rules:

- default board `9x9`, each player starts with `10` walls.
- pawn move legality:
  - orthogonal step with wall blocking checks
  - jump over adjacent opponent when space behind is open
  - diagonal sidestep when direct jump is blocked by wall/edge
- wall placement legality:
  - anchor range `0..7` for both axes on a 9x9 board
  - wall overlap rejected
  - wall crossing rejected
  - placement rejected when either player would have no path to goal row
- match ends immediately when black reaches bottom row or white reaches top row.

## Hex (2-player, 11x11)

Implemented rules:

- default board size `11x11`.
- players alternate placing one stone on an empty cell.
- black wins by connecting top edge to bottom edge.
- white wins by connecting left edge to right edge.
- no draw state (Hex theorem): terminal state is winner-only in adjudication.

## 2048

Implemented deterministic mechanics:

- directional normalization and compression
- each tile merges at most once per move
- deterministic spawn support for replay (`forcedSpawn`)
- no spawn when move has no board effect

Terminal adjudication:

- `won` once tile `>= 2048`
- `lost` when no legal moves remain

## Cards (Crazy Eights, 2-player)

Implemented rules:

- standard 52-card deck
- 5-card opening hand for each player
- one opening discard on table
- legal play: same suit OR same rank as top discard
- rank `8` is wild and must choose next active suit
- when no legal play exists:
  - draw exactly one card
  - if playable, player may immediately play it or end turn
  - if not playable, turn ends
- first player to empty hand wins

Randomness + verification:

- shuffle uses commit-reveal verifiable RNG seed
- completed match payload includes RNG proof transcript (`serverSeed`, commits/nonces, derived `rngSeed`)

## Rating Formula

Per-mode rating update uses ELO:

- expected score: `1 / (1 + 10^((opponent - player) / 400))`
- update: `new = round(old + K * (actual - expected))`
- v1 K-factor: `24` for all modes listed in ratings metadata
- initial rating: `1200`
