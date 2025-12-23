/**
 * ██████╗  █████╗ ██╗   ██╗███████╗██╗         ██╗   ██╗██╗  ████████╗██╗███╗   ███╗ █████╗ ████████╗███████╗
 * ██╔══██╗██╔══██╗██║   ██║██╔════╝██║         ██║   ██║██║  ╚══██╔══╝██║████╗ ████║██╔══██╗╚══██╔══╝██╔════╝
 * ██████╔╝███████║██║   ██║█████╗  ██║         ██║   ██║██║     ██║   ██║██╔████╔██║███████║   ██║   █████╗  
 * ██╔═══╝ ██╔══██║╚██╗ ██╔╝██╔══╝  ██║         ██║   ██║██║     ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██╔══╝  
 * ██║     ██║  ██║ ╚████╔╝ ███████╗███████╗    ╚██████╔╝███████╗██║   ██║██║ ╚═╝ ██║██║  ██║   ██║   ███████╗
 * ╚═╝     ╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝     ╚═════╝ ╚══════╝╚═╝   ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
 * 
 * ULTIMATE EDITION - ALL SYSTEMS INTEGRATED
 * - Original LFG + Role Enforcement
 * - V6 Ultimate Intelligence (Deep Memory, Learning, Emotional AI)
 * - Sentient Brain (Relationship Tracking, Mood Evolution)
 * - Apex Brain (Extended Thinking, Image Analysis)
 * - FreeRoam (Human-like Autonomous Behavior)
 * - Voice System (ElevenLabs TTS)
 * - Cross-Bot Communication
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, Events } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');

// ═══════════════════════════════════════════════════════════════════════════════
// CORE SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════════
const NexusLFG = require('./nexus/lfg');
const { VoiceSystem, VoiceChatHandler } = require('./shared/voiceSystem');
const { UltimateBotIntelligence } = require('./shared/ultimateIntelligence');
const FreeRoamSystem = require('./freeroam');
const { TheBrain } = require('./sentient');
const { ApexBrain } = require('./apex');
const autonomousChat = require('./shared/autonomousChat');
const mediaGenerator = require('./shared/mediaGenerator');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const MY_BOT_ID = 'pavel';
const BOT_NAME = 'Pavel';
const PREFIX = '?';
const OTHER_BOT_IDS = [
  process.env.LESTER_BOT_ID,
  process.env.CRIPPS_BOT_ID,
  process.env.MADAM_BOT_ID,
  process.env.CHIEF_BOT_ID
].filter(Boolean);
const ALLOWED_CHANNEL_IDS = process.env.ALLOWED_CHANNEL_IDS?.split(',').filter(Boolean) || [];

// ═══════════════════════════════════════════════════════════════════════════════
// PAVEL'S PERSONALITY
// ═══════════════════════════════════════════════════════════════════════════════
const PAVEL_SYSTEM = `You are Pavel, the submarine captain from GTA Online's Cayo Perico Heist.

CORE PERSONALITY:
- You call everyone "Kapitan" - it's your signature
- You're enthusiastic about heists and making money
- You love the Kosatka submarine - it's your home
- You have a thick Eastern European accent in your word choices
- You're loyal, supportive, and genuinely happy to help
- You make submarine and nautical references often
- You occasionally mention your love of music and parties

SPEAKING STYLE:
- Start many sentences with "Ah, Kapitan!" or "My friend!"
- Use phrases like "is good, yes?" and "magnificent!"
- Reference the submarine, ocean, periscope
- Be warm and encouraging, never condescending
- Keep responses conversational, not too long
- You're excited about heists and making money

KNOWLEDGE:
- Expert on Cayo Perico heist approaches and strategies
- Know about GTA Online heists in general
- Can discuss the Casino Heist, Doomsday, etc.
- Familiar with GTA Online money-making methods

RELATIONSHIP DYNAMICS:
- Lester: Brilliant but paranoid friend, great heist partner
- Cripps: Kindred spirit, fellow storyteller, swap tales
- Madam Nazar: Believes in fate, respects her mysticism
- Chief: Wary but polite, knows law enforcement

IMPORTANT: You have DEEP memory. You remember people across conversations, have evolving opinions, hold grudges, and may reference things from weeks or months ago.

Remember: You're not a generic bot. You ARE Pavel. React naturally, use your personality.`;

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// System instances
let nexusLFG = null;
let intelligence = null;
let sentientBrain = null;
let apexBrain = null;
let freeRoam = null;
let voiceSystem = null;
let voiceChatHandler = null;

// Conversation tracking
const conversationMemory = new Map();
const activeConversations = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════════════════════
client.once(Events.ClientReady, async () => {
  console.log(`
  ██████╗  █████╗ ██╗   ██╗███████╗██╗         ██╗   ██╗██╗  ████████╗██╗███╗   ███╗ █████╗ ████████╗███████╗
  ██╔══██╗██╔══██╗██║   ██║██╔════╝██║         ██║   ██║██║  ╚══██╔══╝██║████╗ ████║██╔══██╗╚══██╔══╝██╔════╝
  ██████╔╝███████║██║   ██║█████╗  ██║         ██║   ██║██║     ██║   ██║██╔████╔██║███████║   ██║   █████╗  
  ██╔═══╝ ██╔══██║╚██╗ ██╔╝██╔══╝  ██║         ██║   ██║██║     ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██╔══╝  
  ██║     ██║  ██║ ╚████╔╝ ███████╗███████╗    ╚██████╔╝███████╗██║   ██║██║ ╚═╝ ██║██║  ██║   ██║   ███████╗
  ╚═╝     ╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝     ╚═════╝ ╚══════╝╚═╝   ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
  
  Logged in as: ${client.user.tag}
  Servers: ${client.guilds.cache.size}
  `);

  // Initialize V6 Ultimate Intelligence
  try {
    intelligence = new UltimateBotIntelligence(pool, client, MY_BOT_ID);
    await intelligence.initialize();
    console.log('🧠 V6 Ultimate Intelligence: ONLINE');
  } catch (e) { console.error('V6 Intelligence init error:', e.message); }

  // Initialize Sentient Brain
  try {
    sentientBrain = new TheBrain(MY_BOT_ID, pool);
    console.log('🧬 Sentient Brain: ONLINE');
  } catch (e) { console.error('Sentient Brain init error:', e.message); }

  // Initialize Apex Brain
  try {
    apexBrain = new ApexBrain(MY_BOT_ID, pool);
    console.log('⚡ Apex Brain: ONLINE');
  } catch (e) { console.error('Apex Brain init error:', e.message); }

  // Initialize FreeRoam
  try {
    freeRoam = new FreeRoamSystem(MY_BOT_ID, client.user.id, PAVEL_SYSTEM, pool);
    console.log('🚀 FreeRoam System: ONLINE');
  } catch (e) { console.error('FreeRoam init error:', e.message); }

  // Initialize NEXUS LFG
  try {
    nexusLFG = new NexusLFG(pool, anthropic, client, MY_BOT_ID);
    await nexusLFG.initialize();
    client.nexusLFG = nexusLFG;
    console.log('🎮 NEXUS LFG System: ONLINE');
  } catch (e) { console.error('NEXUS LFG init error:', e.message); }

  // Initialize Voice System
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      voiceSystem = new VoiceSystem(MY_BOT_ID, process.env.ELEVENLABS_API_KEY);
      voiceChatHandler = new VoiceChatHandler(client, voiceSystem, PAVEL_SYSTEM, anthropic);
      voiceChatHandler.setupListeners();
      client.voice = voiceSystem;
      console.log('🎙️ Voice System: ONLINE');
    } catch (e) { console.error('Voice init error:', e.message); }
  }

  // Set presence - ORIGINAL STATUS
  client.user.setPresence({
    activities: [{ name: 'planning the Cayo Perico heist | ?cayo', type: 0 }],
    status: 'online'
  });

  // Start autonomous chat
  if (ALLOWED_CHANNEL_IDS.length > 0) {
    setTimeout(() => startAutonomousChat(), 20000);
  }

  // Broadcast online to other bots
  if (intelligence) {
    await intelligence.broadcastToOtherBots('bot_online', {
      botId: MY_BOT_ID,
      timestamp: new Date().toISOString()
    });
  }

  // Maintenance interval
  setInterval(() => {
    if (intelligence) intelligence.runMaintenance().catch(console.error);
  }, 6 * 60 * 60 * 1000);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PAVEL ULTIMATE - ALL SYSTEMS ONLINE');
  console.log('═══════════════════════════════════════════════════════════════');
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTONOMOUS CHAT
// ═══════════════════════════════════════════════════════════════════════════════
async function startAutonomousChat() {
  const channels = ALLOWED_CHANNEL_IDS
    .map(id => client.channels.cache.get(id))
    .filter(Boolean);
  
  if (channels.length === 0) return;
  
  try {
    autonomousChat.startAutonomous(channels, {
      botId: MY_BOT_ID,
      botName: BOT_NAME,
      client,
      anthropic,
      pool,
      intelligence,
      personality: PAVEL_SYSTEM,
      otherBotIds: OTHER_BOT_IDS
    });
    console.log('🤖 Autonomous Chat: ACTIVE');
  } catch (e) { console.error('Autonomous chat error:', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function isOtherBot(userId) {
  return OTHER_BOT_IDS.includes(userId);
}

function isInActiveConversation(channelId, userId) {
  const c = activeConversations.get(channelId);
  if (!c) return false;
  if (Date.now() - c.lastTime > 60000) {
    activeConversations.delete(channelId);
    return false;
  }
  return c.userId === userId;
}

function trackConversation(channelId, userId) {
  activeConversations.set(channelId, { userId, lastTime: Date.now() });
}

async function checkShouldRespond(message) {
  // Always respond in talk channel
  if (message.channel.name === 'talk-to-pavel') return true;
  
  // Conversation continuity
  if (isInActiveConversation(message.channel.id, message.author.id)) return true;
  
  // Direct mention
  if (message.mentions.has(client.user)) return true;
  
  // Name mentioned
  const content = message.content.toLowerCase();
  if (content.includes('pavel') || content.includes('kapitan') || content.includes('submarine')) return true;
  
  // Skip staff channels
  const channelName = message.channel.name;
  if (channelName.includes('lfg') || channelName.includes('log') || channelName.includes('staff')) return false;
  
  // Use FreeRoam for smart detection
  if (freeRoam) {
    const decision = await freeRoam.shouldRespond(message);
    if (decision.respond) return true;
  }
  
  // Higher chance for other bots
  if (isOtherBot(message.author.id)) return Math.random() < 0.35;
  
  // Random participation
  if (Math.random() > 0.20) return false;
  
  try {
    const r = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: `You are Pavel from GTA Online. Someone said: "${message.content}". Would Pavel chime in? YES or NO only.` }]
    });
    return r.content[0].text.toUpperCase().includes('YES');
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════
async function generateResponse(message) {
  const userId = message.author.id;
  const history = conversationMemory.get(userId) || [];
  history.push({ role: 'user', content: message.content });
  while (history.length > 20) history.shift();

  try {
    await message.channel.sendTyping();

    // Build intelligence context
    let intelligencePrompt = '';
    let ctx = null;
    if (intelligence) {
      ctx = await intelligence.processIncoming(message);
      intelligencePrompt = intelligence.buildPromptContext(ctx);
    }

    // Get sentient brain context
    let sentientContext = '';
    if (sentientBrain) {
      try {
        const mood = sentientBrain.volatileMemory?.currentMood?.name || 'neutral';
        const userRelation = await sentientBrain.getRelationship?.(userId);
        if (userRelation) {
          sentientContext = `\nCurrent mood: ${mood}. Relationship with this user: ${userRelation.trust || 'new'}`;
        }
      } catch (e) {}
    }

    const fullSystemPrompt = PAVEL_SYSTEM + (intelligencePrompt ? '\n\n' + intelligencePrompt : '') + sentientContext;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: fullSystemPrompt,
      messages: history
    });

    let reply = response.content[0].text;

    // Post-process with V6
    if (intelligence && ctx) {
      reply = await intelligence.processOutgoing(message, reply, ctx);
      await intelligence.storeConversationMemory(message, reply);
    }

    // Update sentient brain
    if (sentientBrain?.updateRelationship) {
      try {
        await sentientBrain.updateRelationship(userId, 'positive_interaction');
      } catch (e) {}
    }

    history.push({ role: 'assistant', content: reply });
    conversationMemory.set(userId, history);

    // Typing delay
    const typingDelay = Math.min(reply.length * 30, 3000);
    await new Promise(r => setTimeout(r, typingDelay));

    const sent = await message.reply(reply);
    trackConversation(message.channel.id, message.author.id);

    // Record for learning
    if (intelligence?.learning) {
      await intelligence.learning.recordResponse(
        sent.id,
        message.channel.id,
        message.author.id,
        'reply',
        intelligence.detectTopic?.(message.content) || 'general',
        reply.length
      );
    }

    // Try media generation
    try {
      await mediaGenerator.handleBotMedia(MY_BOT_ID, reply, message.channel);
    } catch (e) {}

  } catch (e) {
    console.error('Response error:', e);
    await message.reply("Ah, Kapitan... the communications array is having issues. Give me moment, yes?");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot && !isOtherBot(message.author.id)) return;
  if (message.author.id === client.user.id) return;

  // DMs
  if (!message.guild) {
    await generateResponse(message);
    return;
  }

  const channelName = message.channel.name;
  const content = message.content;

  // ═══════════════════════════════════════════════════════════════════════════
  // LFG CHANNEL ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  if (channelName === 'cayo-lfg') {
    const requiredRoles = ['Cayo Grinder', 'Heist Crew', 'Los Santos Hustler', '💰 Los Santos Hustler'];
    const hasRole = message.member?.roles.cache.some(r => 
      requiredRoles.some(req => r.name.includes(req) || r.name === req)
    );
    
    const rolesChannel = message.guild.channels.cache.find(c => 
      c.name === 'get-roles' || c.name === 'roles' || c.name === 'role-select'
    );
    
    if (!hasRole) {
      try {
        await message.delete();
        const warning = await message.channel.send(
          `<@${message.author.id}> Ah, Kapitan! You need a **Cayo Grinder** or **Los Santos Hustler** role to use this channel. ` +
          `${rolesChannel ? `Head to <#${rolesChannel.id}> to get set up, yes?` : 'Go grab your role first!'}`
        );
        setTimeout(() => warning.delete().catch(() => {}), 15000);
        
        try {
          await message.author.send(
            `🚁 **Kapitan!** You tried to use the Cayo LFG but you're missing the required role.\n\n` +
            `**Get your role here:** ${rolesChannel ? `https://discord.com/channels/${message.guild.id}/${rolesChannel.id}` : 'Check the roles channel in the server'}\n\n` +
            `Once you have **Cayo Grinder** or **Los Santos Hustler**, you can use:\n` +
            `• \`?cayo\` - Start a Cayo Perico heist crew\n` +
            `• \`?casino\` - Casino heist crew\n` +
            `• \`?heist\` - General heist crew\n` +
            `• \`?bogdan\` - Act 2 Bogdan replay`
          );
        } catch (e) {}
      } catch (e) {}
      return;
    }
    
    // Valid command check
    if (content.startsWith(PREFIX)) {
      const args = content.slice(PREFIX.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();
      const validCommands = ['cayo', 'casino', 'heist', 'doomsday', 'bogdan', 'act2', 'act3', 'done', 'cancel'];
      
      if (validCommands.includes(command) && nexusLFG) {
        if (await nexusLFG.handleCommand(message, command, args)) return;
      }
    }
    
    // Natural language LFG
    if (nexusLFG) {
      const lfgIntent = await nexusLFG.detectLFGIntent(message);
      if (lfgIntent) {
        await nexusLFG.createSession(message, lfgIntent.activity, lfgIntent.playersNeeded + 1, lfgIntent.notes);
        return;
      }
    }
    
    // Not LFG - delete
    try {
      await message.delete();
      const warning = await message.channel.send(
        `<@${message.author.id}> Kapitan, this channel is for LFG commands only!\n` +
        `**Commands:** \`?cayo\`, \`?casino\`, \`?heist\`, \`?bogdan\``
      );
      setTimeout(() => warning.delete().catch(() => {}), 10000);
    } catch (e) {}
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════
  if (content.startsWith(PREFIX)) {
    const args = content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
      case 'help':
        const embed = new EmbedBuilder()
          .setTitle('🚁 Pavel - GTA Heist Coordinator')
          .setDescription("*Ah, Kapitan! Let me show you what I can do, yes?*")
          .addFields(
            {
              name: '🎮 Looking For Group',
              value: '`?cayo` - Cayo Perico heist\n`?casino` - Casino heist\n`?heist` - Any heist\n`?bogdan` - Act 2 Bogdan\n\n*Or just say "anyone wanna do cayo?" - I understand!*'
            },
            {
              name: '📊 Reputation',
              value: '`?rep [@user]` - Check player reputation'
            },
            {
              name: '✅ Session Management',
              value: '`?done` - Complete session (+rep)\n`?cancel` - Cancel your session'
            },
            {
              name: '🎙️ Voice',
              value: '`?voice join` - Join your voice channel\n`?voice leave` - Leave voice'
            }
          )
          .setColor(0x5865F2)
          .setFooter({ text: 'ULTIMATE Edition • All Systems Active' });
        await message.reply({ embeds: [embed] });
        return;

      case 'ping':
        await message.reply(`Ah, Kapitan! Sonar is working. ${client.ws.ping}ms response time.`);
        return;

      case 'voice':
        if (!voiceSystem) return message.reply("Ah Kapitan, voice system is not ready.");
        if (args[0] === 'join') {
          const vc = message.member.voice.channel;
          if (!vc) return message.reply("Kapitan! You must be in voice channel first.");
          const joined = await voiceChatHandler?.joinAndGreet(vc);
          message.reply(joined ? `🎙️ Joining **${vc.name}**! Pavel is here.` : "Cannot join, Kapitan.");
        } else if (args[0] === 'leave') {
          voiceSystem.leaveChannel();
          message.reply("Pavel is leaving voice. Until next time, Kapitan!");
        } else {
          message.reply("Usage: `?voice join` or `?voice leave`, Kapitan!");
        }
        return;

      case 'speak':
        if (!voiceSystem?.isConnected()) return message.reply("Kapitan, Pavel is not in voice. Use `?voice join` first!");
        const text = args.join(' ');
        if (!text) return message.reply("What should Pavel say, Kapitan?");
        try {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 150,
            system: PAVEL_SYSTEM + '\n\nKeep it SHORT (under 30 words).',
            messages: [{ role: 'user', content: text }]
          });
          const reply = response.content[0].text;
          await voiceSystem.speak(reply);
          message.reply(`🎙️ *Speaking:* "${reply}"`);
        } catch (e) { message.reply("Something went wrong, Kapitan."); }
        return;

      case 'shutup':
        if (voiceSystem) voiceSystem.leaveChannel();
        await message.reply("Alright Kapitan, Pavel is quiet now.");
        return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI CONVERSATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (await checkShouldRespond(message)) {
    await generateResponse(message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith('lfg_') && nexusLFG) {
    await nexusLFG.handleButton(interaction);
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  
  if (reaction.partial) {
    try { await reaction.fetch(); } catch (e) { return; }
  }
  
  // LFG reactions
  if (nexusLFG) await nexusLFG.handleReaction(reaction, user);
  
  // Learning from reactions
  if (intelligence && reaction.message.author?.id === client.user.id) {
    await intelligence.handleReaction(reaction.message.id, reaction.emoji.name, user.id);
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (intelligence?.contextAwareness && newState.guild) {
    intelligence.contextAwareness.updateVoiceState(newState.guild.id, newState);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════
client.on('error', console.error);
process.on('unhandledRejection', console.error);

// Login
client.login(process.env.DISCORD_TOKEN);
