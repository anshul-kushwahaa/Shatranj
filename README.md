# ♟ Shatranj

A full-featured chess game built from scratch with **vanilla HTML, CSS, and JavaScript** — no libraries, no frameworks. Play against a self-built AI bot or a friend on the same device, with all the polish of a modern chess app.

> **Shatranj** (शतरंज) is the historical name for chess, originating in ancient India.

🔗 **Live Demo:** [anshul-kushwahaa.github.io/Shatranj](https://anshul-kushwahaa.github.io/Shatranj/)

---

## ✨ Features

### Game Modes
- 🤖 **vs Bot** — three difficulty levels (Easy / Medium / Hard)
- 👥 **vs Friend** — local two-player on the same board
- ⏱ **Time controls** — Bullet (1 min), Blitz (3+2, 5+3), Rapid (10 min), or No Timer, with increment support

### Full Chess Rules
- All piece movement, captures, and turn order
- ♚ **Castling** (king-side & queen-side, with rights tracking)
- 👻 **En passant**
- 👑 **Pawn promotion** — choose your piece, or enable **Auto-Queen**
- Check, checkmate, and stalemate detection
- Draw detection: **50-move rule**, **threefold repetition**, and **insufficient material**

### The Bot 🧠
- Built by hand using the **Minimax** algorithm with **Alpha-Beta pruning**
- Search depth scales with difficulty (1 / 2 / 3 ply)
- Position evaluation using material values **and piece-square tables**

### Board & Interaction
- 🖐 **Hold-to-drag** pieces (pointer-based, works with mouse *and* touch)
- 👆 **Click-to-move** as an alternative
- ➡️ **Pre-move** — queue your reply while the bot is thinking; it plays instantly if still legal
- 💡 **Hint** — the engine suggests a strong move with an arrow
- 🎯 **Right-click arrows & square highlights** for planning
- 🔄 **Flip board**, ↩ **Undo**, 🏳 **Resign**, ½ **Offer draw**
- ⌨ **Keyboard navigation** (← → to review moves, Esc to exit review) + on-screen nav buttons

### Info & Polish
- 📊 **Evaluation bar** showing who's ahead
- 📜 **Move history** in standard algebraic notation (with `+`, `#`, `=Q`, `O-O`, disambiguation)
- 📋 **Copy PGN** to clipboard
- ⚖ **Material score** and **captured pieces** display
- ♟ **Opening name detection** for common openings
- 🎨 **Four board themes** — Classic, Green, Dark, Blue (saved between sessions)
- 🔊 **Sound effects** via the Web Audio API (no audio files)
- 🎉 **Confetti** celebration on a win
- 🏆 **Score tracking** persisted with `localStorage`
- 🎬 Smooth piece-move animation and low-time timer warnings

---

## 🚀 Getting Started

No build step or dependencies — it's plain static files.

### Option 1 — VS Code Live Server (recommended)
1. Clone the repo:
   ```bash
   git clone https://github.com/anshul-kushwahaa/Shatranj.git
   cd Shatranj
   ```
2. Open the folder in **VS Code**.
3. Install the **Live Server** extension.
4. Right-click `index.html` → **Open with Live Server**.

### Option 2 — Open directly
Just open `index.html` in any modern browser (Chrome, Firefox, or Edge).

---

## 📁 Project Structure

```
Shatranj/
├── index.html        # Screens & layout (home, difficulty, time control, game, game over)
├── style.css         # Themes, board, animations, responsive layout
├── script.js         # All game logic: rules, bot, input, UI
├── requirements.txt  # Tech stack reference
└── README.md
```

---

## 🎮 Controls

| Action | How |
|---|---|
| Move a piece | Drag it, or click it then click the target |
| Pre-move (vs Bot) | Drag/click your piece during the bot's turn |
| Draw an arrow | Right-click and drag |
| Highlight a square | Right-click a single square |
| Review previous moves | `←` / `→` arrow keys, or the ⏮ ◀ ▶ ⏭ buttons |
| Exit move review | `Esc`, or click the board |

---

## 🛠 Tech Stack

**Phase 1 (this repo):** HTML5 · CSS3 · Vanilla JavaScript
**Bot:** Minimax + Alpha-Beta pruning + piece-square tables
**Hosting:** GitHub Pages
**Version control:** Git & GitHub

---

## 🗺 Roadmap

- [x] **Phase 1** — Web app with full rules, bot, and chess.com-style features
- [ ] **Phase 2** — Mobile app with **React Native** (Android & iOS)
- [ ] Online multiplayer
- [ ] Stronger bot (deeper search, opening book, endgame heuristics)

---

## 👤 Author

**Anshul Kushwaha**
Built as a learning project — chess engine and UI written from the ground up.

---

*Made with ♟ and vanilla JavaScript.*
