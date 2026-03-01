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

## Santorini (2-player, no god powers)

Implemented rules (base game only, no powers):

- board is fixed at `5x5`
- setup phase alternates worker placement until all four workers are placed (`black.a`, `black.b`, `white.a`, `white.b`)
- each turn is exactly `move` then `build` with the same worker
- movement constraints:
  - destination must be adjacent
  - destination must be empty
  - destination level must be `< 4` (no dome)
  - climb is limited to `+1` level
- build constraints:
  - build cell must be adjacent to worker's new location
  - build cell cannot contain a worker
  - domes (`level 4`) cannot be built on further
- win/loss:
  - moving onto level `3` wins immediately
  - if the player to move has no legal move+build sequence, they lose (`loserReason: "no_legal_move"`)

## Onitama (2-player, full base card pool)

Implemented rules:

- board is fixed at `5x5` with standard initial piece layout (`4` students + `1` master per side)
- card pool is full base set of `16` cards:
  - `tiger`, `dragon`, `frog`, `rabbit`, `crab`, `elephant`, `goose`, `rooster`
  - `monkey`, `mantis`, `horse`, `ox`, `crane`, `boar`, `eel`, `cobra`
- opening setup:
  - RNG samples `5` unique cards
  - black gets first `2`, white gets next `2`, final card is side card
- turn loop:
  - move one own piece using one card's movement pattern
  - cannot move off-board or onto own piece
  - used card swaps with side card
- win conditions:
  - capture opponent master
  - or move own master to opponent temple square

Randomness + verification:

- opening card sampling uses commit-reveal verifiable RNG
- gameplay is blocked until RNG phase is `ready`
- completed result payload includes full RNG proof transcript for replay verification

## Battleship (2-player, 10x10)

Implemented rules:

- board is fixed at `10x10`
- fleet lengths are fixed at `5/4/3/3/2`
- placement phase:
  - each player submits full fleet
  - ships must be in bounds, exact lengths, and non-overlapping
- firing phase:
  - players alternate one shot per turn
  - shot result is `miss` / `hit` / `sunk`
  - repeated shot at the same cell is rejected
- match ends immediately when one side has all ships sunk

Visibility policy:

- during active play, player view reveals only own fleet layout
- spectators do not receive either fleet layout during active play
- completed projection/replay can reveal both fleets

## Yahtzee (2-player score duel)

Implemented rules:

- each player scores the standard 13 categories once:
  - upper: `ones..sixes`
  - lower: `three_of_a_kind`, `four_of_a_kind`, `full_house`, `small_straight`, `large_straight`, `yahtzee`, `chance`
- per turn:
  - up to 3 rolls
  - after first roll, optional 5-slot hold mask for rerolls
  - then score exactly one unused category
- standard category scoring is used (`full_house=25`, `small_straight=30`, `large_straight=40`, `yahtzee=50`)
- upper section bonus is implemented:
  - upper subtotal `>= 63` grants `+35`
  - final total = raw category sum + upper bonus
- match ends when both players complete all 13 categories; higher total wins (tie allowed)

Randomness + verification:

- all dice rolls use commit-reveal verifiable RNG
- gameplay is blocked until RNG phase is `ready`
- completed result payload includes totals, upper subtotals/bonus, and RNG proof transcript

## Domination (2-player, 9x9)

Implemented rules (self-authored mode, intentionally not aligned to external game rules):

- board is fixed at `9x9`
- players alternate placing one stone on empty cells (`black` first)
- score is recomputed each move:
  - `pieceCounts`: own stones on board
  - `controlCounts`: empty cells controlled by strictly greater orthogonal adjacency
  - `scores = pieceCounts + controlCounts`
- out-of-bounds / occupied / out-of-turn moves are rejected
- game ends on full board; higher score wins (tie allowed)

## Codenames Duet (2-player co-op, 5x5)

Implemented rules (faithful duet loop + hidden information):

- word board is `5x5` (`25` unique words) from fixed pool
- key generation uses duet-style composition:
  - each player key has `9` contacts (`agent`) and `3` assassins
  - union constraints are fixed at `15` total contacts with `3` shared contacts
  - assassin union is fixed at `5` cells (one shared assassin + side-specific assassins)
- turn loop:
  - current clue-giver submits clue (`word`, `count`)
  - partner guesses up to `count + 1` or ends guesses manually
  - guess handling:
    - assassin: immediate loss
    - non-contact on clue-giver key: turn ends
    - contact on clue-giver key: guesser may continue while guesses remain
- win/loss:
  - win when all `15` contact cells are revealed
  - lose on assassin reveal or when clue rounds run out

Randomness + verification:

- words and key pair are generated from commit-reveal verifiable RNG
- gameplay is blocked until RNG phase is `ready`
- completed result payload includes cooperative outcome, target counts, and RNG proof transcript

Visibility policy:

- active player sees only own key during live play
- spectators see no key during live play
- completed projection/replay can reveal both keys

## Love Letter (2-player, 2nd-edition style match flow)

Implemented rules:

- base 16-card deck (`guard/priest/baron/handmaid/prince/king/countess/princess`)
- two-player round setup:
  - remove `1` facedown card
  - remove `3` face-up cards (`removedFaceUp` in state)
  - deal `1` card to each player
  - round starter draws one additional card (starts with `2` cards)
- card effect legality is enforced for all base cards, including:
  - Countess forced play with King/Prince
  - Princess self-elimination on play/discard
  - Handmaid protection targeting restrictions
- round end:
  - elimination -> survivor wins round
  - if deck exhausts, compare remaining hand value
  - showdown tie-break uses discard-value sum; exact tie awards both players a token
- match scoring:
  - tokens of affection tracked across rounds
  - default two-player target is `7` tokens
  - round winner starts next round; match ends only when token target is reached

Randomness + verification:

- each round deck shuffle uses commit-reveal verifiable RNG
- gameplay is blocked until RNG phase is `ready`
- completed result payload includes round/token state and full RNG proof transcript

Visibility policy:

- live player view reveals only own hand
- spectators do not receive hidden hands during active play
- replay after completion can reconstruct and reveal full round progression

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

## Liar's Dice (2-player)

Implemented rules (v1 two-player):

- each player starts with 5 dice
- each round both players roll hidden dice
- players alternate:
  - bid (`quantity`, `face`)
  - or call `liar` against current bid
- bid must be strictly higher than previous bid (quantity first, then face)
- `liar` resolution:
  - if actual matching dice count `< bid.quantity`: bidder is liar and loses one die
  - otherwise caller loses one die
- loser of a round starts the next round
- match ends when one player reaches 0 dice

Randomness + verification:

- round dice are generated from existing commit-reveal verifiable RNG
- gameplay remains blocked until RNG phase is `ready`
- completed payload includes RNG proof transcript and full per-round reveal log (dice + bid chain) for replay verification

Visibility policy:

- during live play, each player only sees their own current dice
- spectators do not see current dice
- replay after completion can reveal full round dice and bid chain

## Rating Formula

Per-mode rating update uses ELO:

- expected score: `1 / (1 + 10^((opponent - player) / 400))`
- update: `new = round(old + K * (actual - expected))`
- v1 K-factor: `24` for all modes listed in ratings metadata
- initial rating: `1200`
