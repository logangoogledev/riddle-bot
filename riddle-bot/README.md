# 🧩 Riddle Bot — Discord Bot

A Discord bot that DMs users riddles powered by Claude AI, with difficulty levels, multiple riddle types, hint systems, and answer checking.

---

## ✨ Features

| Feature | Details |
|---|---|
| 6 Riddle Types | Normal, Complex, Strategic (MCQ), Overthinking Trap, Mind-Breaker, Math |
| 5 Difficulty Levels | Easy, Medium, Hard, Ultra Hard, Impossible |
| Private DMs | Riddles are sent directly to the user's DMs |
| Smart Answer Checking | Claude AI verifies answers, allowing synonyms & typos |
| Hint System | Button to get a hint without fully giving up |
| Reveal Answer | Button to see the answer + explanation |
| Try Again | Button to attempt the riddle again |

---

## 🚀 Setup Guide

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it (e.g. "Riddle Bot")
3. Go to **Bot** tab → click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - ✅ Message Content Intent
   - ✅ Direct Messages (enabled by default)
5. Copy your **Bot Token** (you'll need this)
6. Go to **OAuth2 → General** and copy your **Client ID**

### 2. Invite the Bot to Your Server

Use this URL (replace `YOUR_CLIENT_ID`):
```
https://discord.com/oauth2/authorize?client_id=1520090878096572569&scope=bot+applications.commands&permissions=2048
```

Required permissions:
- Send Messages
- Use Slash Commands
- Send Messages in DMs (handled automatically)

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:
```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Get your Anthropic API key at [console.anthropic.com](https://console.anthropic.com)

### 4. Install & Run

```bash
npm install
node index.js
```

You should see:
```
✅ Logged in as YourBot#1234
Registering slash commands...
✅ Slash commands registered.
```

---

## 🎮 Commands

### `/riddle type:<type> difficulty:<level>`
Sends you a riddle in your DMs.

**Types:**
- `normal` — Classic riddles
- `complex` — Multi-layered, deep thinking required
- `strategic` — Multiple choice (A/B/C/D)
- `overthink` — Designed to make you second-guess yourself
- `mindbreak` — Simple answer, mind-bending question
- `math` — Math puzzles and number challenges

**Difficulties:**
- `easy` 🟢 — Great for beginners
- `medium` 🟡 — Requires some thought
- `hard` 🔴 — Seriously challenging
- `ultra` 💀 — Only the sharpest minds
- `impossible` ☠️ — Near-unsolvable

### `/riddlestats`
Shows all riddle types and difficulty descriptions.

---

## 🔄 How It Works

1. User runs `/riddle type:math difficulty:hard` in a server
2. Bot replies (privately) "Check your DMs!"
3. Bot sends the riddle in a DM
4. User replies in DM with their answer
5. Claude AI checks if the answer is correct (allows synonyms/typos)
6. **If correct** → 🎉 Celebration embed with explanation and stats
7. **If wrong** → ❌ Embed with 3 buttons:
   - 🔄 Try Again
   - 🗝️ Get a Hint
   - 💡 Reveal Answer

---

## 📁 File Structure

```
riddle-bot/
├── index.js        # Main bot logic
├── .env            # Your secrets (never commit this)
├── .env.example    # Template for environment variables
├── .gitignore
├── package.json
└── README.md
```

---

## 🛠️ Troubleshooting

**Bot doesn't respond to /riddle**
- Make sure slash commands are registered (wait ~1 min after first start)
- Ensure the bot has `applications.commands` scope in your server invite

**Bot can't DM the user**
- The user must allow DMs from server members (Discord Privacy Settings)

**Answer always wrong**
- Double-check your `ANTHROPIC_API_KEY` is valid and has credits
