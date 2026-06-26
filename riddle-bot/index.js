require('dotenv').config();
const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: ['CHANNEL', 'MESSAGE'],
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Active riddle sessions: userId -> { riddle, answer, type, difficulty, attempts }
const activeSessions = new Map();

// Riddle types and difficulties
const TYPES = {
  normal: 'Normal Riddle',
  complex: 'Complex Riddle',
  strategic: 'Strategic Question (Multiple Choice)',
  overthink: 'Overthinking Trap',
  mindbreak: 'Mind-Breaking Simple Answer',
  math: 'Math Challenge',
};

const DIFFICULTIES = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Hard',
  ultra: '💀 Ultra Hard',
  impossible: '☠️ Impossible',
};

const DIFFICULTY_DESC = {
  easy: 'Straightforward, great for beginners.',
  medium: 'Requires some thought.',
  hard: 'Will seriously challenge you.',
  ultra: 'Only the sharpest minds will solve this.',
  impossible: 'Near-unsolvable. Good luck.',
};

// Slash commands definition
const commands = [
  new SlashCommandBuilder()
    .setName('riddle')
    .setDescription('Get a riddle sent to your DMs!')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Type of riddle')
        .setRequired(true)
        .addChoices(
          { name: '🧩 Normal Riddle', value: 'normal' },
          { name: '🌀 Complex Riddle', value: 'complex' },
          { name: '🎯 Strategic (Multiple Choice)', value: 'strategic' },
          { name: '🤯 Overthinking Trap', value: 'overthink' },
          { name: '💡 Mind-Breaking Simple Answer', value: 'mindbreak' },
          { name: '🔢 Math Challenge', value: 'math' },
        )
    )
    .addStringOption(opt =>
      opt.setName('difficulty')
        .setDescription('Difficulty level')
        .setRequired(true)
        .addChoices(
          { name: '🟢 Easy', value: 'easy' },
          { name: '🟡 Medium', value: 'medium' },
          { name: '🔴 Hard', value: 'hard' },
          { name: '💀 Ultra Hard', value: 'ultra' },
          { name: '☠️ Impossible', value: 'impossible' },
        )
    ),
  new SlashCommandBuilder()
    .setName('riddlestats')
    .setDescription('See riddle type and difficulty descriptions.'),
];

// Register slash commands
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

// Generate riddle via Claude API
async function generateRiddle(type, difficulty) {
  const prompts = {
    normal: `Generate a ${difficulty} difficulty classic riddle. It should be clever and have a clear single answer.`,
    complex: `Generate a ${difficulty} difficulty complex riddle with multiple layers of meaning. It should require deep thinking and abstract reasoning.`,
    strategic: `Generate a ${difficulty} difficulty strategic question with exactly 4 multiple choice options labeled A, B, C, D. One is correct. Make it thought-provoking.`,
    overthink: `Generate a ${difficulty} difficulty riddle specifically designed to make people overthink. The answer should be simpler than it seems, and people will second-guess themselves.`,
    mindbreak: `Generate a ${difficulty} difficulty riddle where the answer is deceptively simple but the question is designed to break your mind. The wording should confuse even though the answer is obvious once revealed.`,
    math: `Generate a ${difficulty} difficulty math riddle or puzzle. It can involve logic, number patterns, or tricky arithmetic. Avoid trivially simple calculations.`,
  };

  const systemPrompt = `You are a master riddle creator. Always respond in this exact JSON format with no extra text:
{
  "riddle": "The riddle text here",
  "answer": "The exact answer",
  "hint": "A subtle hint without giving it away",
  "explanation": "Brief explanation of why this is the answer"
}
For strategic type, include the options inside the riddle text itself (A) B) C) D)).`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompts[type] }],
  });

  const text = response.content[0].text.trim();
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

// Check answer via Claude
async function checkAnswer(riddle, correctAnswer, userAnswer, type) {
  const isStrategic = type === 'strategic';
  const prompt = isStrategic
    ? `The correct answer to this multiple choice riddle is: "${correctAnswer}". The user answered: "${userAnswer}". Did they get it right? Consider letter-only answers (A, B, C, D) and full answer text. Respond ONLY with "correct" or "incorrect".`
    : `The riddle is: "${riddle}". The correct answer is: "${correctAnswer}". The user's answer is: "${userAnswer}". Is this essentially correct (allow for minor variations, synonyms, slight misspellings)? Respond ONLY with "correct" or "incorrect".`;

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 10,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0].text.trim().toLowerCase().includes('correct');
}

// Build riddle embed
function buildRiddleEmbed(riddleData, type, difficulty) {
  const typeEmojis = {
    normal: '🧩', complex: '🌀', strategic: '🎯',
    overthink: '🤯', mindbreak: '💡', math: '🔢',
  };

  return new EmbedBuilder()
    .setColor(getDifficultyColor(difficulty))
    .setTitle(`${typeEmojis[type]} ${TYPES[type]}`)
    .setDescription(`**${DIFFICULTIES[difficulty]}**\n\n${riddleData.riddle}`)
    .setFooter({ text: 'Reply with your answer in this DM!' })
    .setTimestamp();
}

function getDifficultyColor(difficulty) {
  const colors = { easy: 0x00ff00, medium: 0xffff00, hard: 0xff4444, ultra: 0x9900ff, impossible: 0x000000 };
  return colors[difficulty] || 0x5865F2;
}

// Build try-again buttons
function buildRetryButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('try_again').setLabel('🔄 Try Again').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('get_answer').setLabel('💡 Reveal Answer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('get_hint').setLabel('🗝️ Get a Hint').setStyle(ButtonStyle.Success),
  );
}

// Handle /riddle command
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'riddle') {
    await interaction.reply({ content: '🎲 Generating your riddle... check your DMs!', ephemeral: true });

    const type = interaction.options.getString('type');
    const difficulty = interaction.options.getString('difficulty');

    try {
      const riddleData = await generateRiddle(type, difficulty);
      const embed = buildRiddleEmbed(riddleData, type, difficulty);

      const dmChannel = await interaction.user.createDM();
      await dmChannel.send({ embeds: [embed] });

      // Store session
      activeSessions.set(interaction.user.id, {
        riddle: riddleData.riddle,
        answer: riddleData.answer,
        hint: riddleData.hint,
        explanation: riddleData.explanation,
        type,
        difficulty,
        attempts: 0,
        hintUsed: false,
      });
    } catch (err) {
      console.error('Error generating riddle:', err);
      await interaction.followUp({ content: '❌ Something went wrong generating your riddle. Try again!', ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'riddlestats') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Riddle Bot — Types & Difficulties')
      .addFields(
        { name: '🧩 Types', value: Object.entries(TYPES).map(([k, v]) => `**${v}** — \`/riddle type:${k}\``).join('\n') },
        { name: '⚡ Difficulties', value: Object.entries(DIFFICULTIES).map(([k, v]) => `${v} — ${DIFFICULTY_DESC[k]}`).join('\n') },
      )
      .setFooter({ text: 'Use /riddle to start!' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Button interactions in DMs
  if (interaction.isButton()) {
    const userId = interaction.user.id;
    const session = activeSessions.get(userId);

    if (!session) {
      await interaction.reply({ content: "No active riddle session. Use `/riddle` in a server to get one!", ephemeral: true });
      return;
    }

    if (interaction.customId === 'try_again') {
      await interaction.update({ content: '🔄 Give it another shot! Reply with your answer.', components: [] });
    }

    if (interaction.customId === 'get_hint') {
      session.hintUsed = true;
      await interaction.update({
        content: `🗝️ **Hint:** ${session.hint}\n\nReply with your answer!`,
        components: [buildRetryButtons()],
      });
    }

    if (interaction.customId === 'get_answer') {
      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('💡 Answer Revealed')
        .addFields(
          { name: '✅ Answer', value: session.answer },
          { name: '📖 Explanation', value: session.explanation },
        )
        .setFooter({ text: 'Use /riddle to try another one!' });

      await interaction.update({ content: '', embeds: [embed], components: [] });
      activeSessions.delete(userId);
    }
  }
});

// Handle DM messages (answer attempts)
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (message.guild) return; // Only DMs

  const userId = message.author.id;
  const session = activeSessions.get(userId);
  if (!session) {
    await message.reply("You don't have an active riddle! Use `/riddle` in a server to get one. 🎲");
    return;
  }

  session.attempts++;
  const userAnswer = message.content.trim();

  try {
    const isCorrect = await checkAnswer(session.riddle, session.answer, userAnswer, session.type);

    if (isCorrect) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎉 Correct!')
        .setDescription(`**"${session.answer}"** was right!`)
        .addFields(
          { name: '📖 Explanation', value: session.explanation },
          { name: '📊 Stats', value: `Attempts: **${session.attempts}** | Hint used: **${session.hintUsed ? 'Yes' : 'No'}** | Difficulty: **${DIFFICULTIES[session.difficulty]}**` },
        )
        .setFooter({ text: 'Use /riddle to try another!' });

      await message.reply({ embeds: [embed] });
      activeSessions.delete(userId);
    } else {
      const embed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('❌ Not quite right!')
        .setDescription(`**"${userAnswer}"** isn't the answer. What would you like to do?`)
        .setFooter({ text: `Attempts so far: ${session.attempts}` });

      await message.reply({ embeds: [embed], components: [buildRetryButtons()] });
    }
  } catch (err) {
    console.error('Error checking answer:', err);
    await message.reply('⚠️ Error checking your answer. Please try again.');
  }
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.login(process.env.DISCORD_TOKEN);
