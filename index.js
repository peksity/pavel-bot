/**
 * ██████╗  █████╗ ██╗   ██╗███████╗██╗         ██╗   ██╗██╗  ████████╗██╗███╗   ███╗ █████╗ ████████╗███████╗
 * ██╔══██╗██╔══██╗██║   ██║██╔════╝██║         ██║   ██║██║  ╚══██╔══╝██║████╗ ████║██╔══██╗╚══██╔══╝██╔════╝
 * ██████╔╝███████║██║   ██║█████╗  ██║         ██║   ██║██║     ██║   ██║██╔████╔██║███████║   ██║   █████╗  
 * ██╔═══╝ ██╔══██║╚██╗ ██╔╝██╔══╝  ██║         ██║   ██║██║     ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██╔══╝  
 * ██║     ██║  ██║ ╚████╔╝ ███████╗███████╗    ╚██████╔╝███████╗██║   ██║██║ ╚═╝ ██║██║  ██║   ██║   ███████╗
 * ╚═╝     ╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝     ╚═════╝ ╚══════╝╚═╝   ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
 * 
 * ULTIMATE EDITION - ALL SYSTEMS INTEGRATED + ADVANCED CAYO LFG
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, Events } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');

// ═══════════════════════════════════════════════════════════════════════════════
// CORE SYSTEMS - Optional loading for flexibility
// ═══════════════════════════════════════════════════════════════════════════════
let NexusLFG = null;
try { NexusLFG = require('./nexus/lfg'); } catch (e) {}
let VoiceSystem = null, VoiceChatHandler = null;
try { const v = require('./shared/voiceSystem'); VoiceSystem = v.VoiceSystem; VoiceChatHandler = v.VoiceChatHandler; } catch (e) {}
let UltimateBotIntelligence = null;
try { UltimateBotIntelligence = require('./shared/ultimateIntelligence').UltimateBotIntelligence; } catch (e) {}
let FreeRoamSystem = null;
try { FreeRoamSystem = require('./freeroam'); } catch (e) {}
let TheBrain = null;
try { TheBrain = require('./sentient').TheBrain; } catch (e) {}
let ApexBrain = null;
try { ApexBrain = require('./apex').ApexBrain; } catch (e) {}
let autonomousChat = null;
try { autonomousChat = require('./shared/autonomousChat'); } catch (e) {}
let mediaGenerator = null;
try { mediaGenerator = require('./shared/mediaGenerator'); } catch (e) {}

// ADVANCED CAYO LFG SYSTEM
const advancedCayoLFG = require('./shared/advancedCayoLFG');

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
- Know about GTA Online money-making methods
- Familiar with grinding techniques and efficiency

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

// Make db available to handlers
client.db = pool;

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
  if (UltimateBotIntelligence) {
    try {
      intelligence = new UltimateBotIntelligence(pool, client, MY_BOT_ID);
      await intelligence.initialize();
      console.log('🧠 V6 Ultimate Intelligence: ONLINE');
    } catch (e) { console.error('V6 Intelligence init error:', e.message); }
  }

  // Initialize Sentient Brain
  if (TheBrain) {
    try {
      sentientBrain = new TheBrain(MY_BOT_ID, pool);
      console.log('🧬 Sentient Brain: ONLINE');
    } catch (e) { console.error('Sentient Brain init error:', e.message); }
  }

  // Initialize Apex Brain
  if (ApexBrain) {
    try {
      apexBrain = new ApexBrain(MY_BOT_ID, pool);
      console.log('⚡ Apex Brain: ONLINE');
    } catch (e) { console.error('Apex Brain init error:', e.message); }
  }

  // Initialize FreeRoam
  if (FreeRoamSystem) {
    try {
      freeRoam = new FreeRoamSystem(MY_BOT_ID, client.user.id, PAVEL_SYSTEM, pool);
      console.log('🚀 FreeRoam System: ONLINE');
    } catch (e) { console.error('FreeRoam init error:', e.message); }
  }

  // Initialize NEXUS LFG (legacy)
  if (NexusLFG) {
    try {
      nexusLFG = new NexusLFG(pool, anthropic, client, MY_BOT_ID);
      await nexusLFG.initialize();
      client.nexusLFG = nexusLFG;
      console.log('🎮 NEXUS LFG System: ONLINE');
    } catch (e) { console.error('NEXUS LFG init error:', e.message); }
  }

  // Initialize Voice System
  if (VoiceSystem && process.env.ELEVENLABS_API_KEY) {
    try {
      voiceSystem = new VoiceSystem(MY_BOT_ID, process.env.ELEVENLABS_API_KEY);
      voiceChatHandler = new VoiceChatHandler(client, voiceSystem, PAVEL_SYSTEM, anthropic);
      voiceChatHandler.setupListeners();
      client.voice = voiceSystem;
      console.log('🎙️ Voice System: ONLINE');
    } catch (e) { console.error('Voice init error:', e.message); }
  }

  // Initialize ADVANCED CAYO LFG
  try {
    advancedCayoLFG.initialize(client);
    await advancedCayoLFG.createTables(client);
    console.log('🏝️ Advanced Cayo LFG: ONLINE');
  } catch (e) {
    console.error('Cayo LFG init error:', e.message);
  }

  // Set presence
  client.user.setPresence({
    activities: [{ name: 'planning the Cayo Perico heist | ?cayo', type: 0 }],
    status: 'online'
  });

  // Start autonomous chat
  if (autonomousChat && ALLOWED_CHANNEL_IDS.length > 0) {
    setTimeout(() => {
      try {
        autonomousChat.startAutonomous(
          ALLOWED_CHANNEL_IDS.map(id => client.channels.cache.get(id)).filter(Boolean),
          { botId: MY_BOT_ID, botName: BOT_NAME, client, anthropic, pool, intelligence, personality: PAVEL_SYSTEM, otherBotIds: OTHER_BOT_IDS }
        );
      } catch (e) {}
    }, 20000);
  }

  // Broadcast online to other bots
  if (intelligence) {
    await intelligence.broadcastToOtherBots('bot_online', { botId: MY_BOT_ID, timestamp: new Date().toISOString() });
  }

  // Maintenance interval
  setInterval(() => {
    if (intelligence) intelligence.runMaintenance().catch(console.error);
  }, 6 * 60 * 60 * 1000);

  console.log('[PAVEL] ALL SYSTEMS ONLINE - Kapitan, we are ready!');
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function isOtherBot(userId) {
  return OTHER_BOT_IDS.includes(userId);
}

function isInActiveConversation(channelId, odId) {
  const conv = activeConversations.get(channelId);
  if (!conv) return false;
  if (Date.now() - conv.lastTime > 60000) {
    activeConversations.delete(channelId);
    return false;
  }
  return conv.odId === odId;
}

function trackConversation(channelId, odId) {
  activeConversations.set(channelId, { odId, lastTime: Date.now() });
}

async function checkShouldRespond(message) {
  // NEVER respond in counting channel
  if (message.channel.name === 'counting') return false;
  
  // NEVER respond in OTHER bots' talk-to channels
  const channelName = message.channel.name;
  if (channelName.startsWith('talk-to-') && channelName !== 'talk-to-pavel') return false;
  
  // Always respond in dedicated channel
  if (channelName === 'talk-to-pavel') return true;
  
  // Continue active conversations
  if (isInActiveConversation(message.channel.id, message.author.id)) return true;
  
  // Direct mentions
  if (message.mentions.has(client.user)) return true;
  
  // Keyword triggers
  const content = message.content.toLowerCase();
  if (content.includes('pavel') || content.includes('kapitan') || content.includes('submarine') || content.includes('cayo') || content.includes('kosatka')) return true;
  
  // Skip log/staff channels
  if (channelName.includes('lfg') || channelName.includes('log') || channelName.includes('staff')) return false;
  
  // FreeRoam decision
  if (freeRoam) {
    const decision = await freeRoam.shouldRespond(message);
    if (decision.respond) return true;
  }
  
  // Respond to other bots sometimes
  if (isOtherBot(message.author.id)) return Math.random() < 0.35;
  
  // Random chance
  return Math.random() < 0.20;
}

async function generateResponse(message) {
  const odId = message.author.id;
  const history = conversationMemory.get(odId) || [];
  
  history.push({ role: 'user', content: message.content });
  while (history.length > 20) history.shift();
  
  try {
    await message.channel.sendTyping();
    
    // Get intelligence context
    let intelligencePrompt = '';
    let ctx = null;
    if (intelligence) {
      ctx = await intelligence.processIncoming(message);
      intelligencePrompt = intelligence.buildPromptContext(ctx);
    }
    
    // Generate response
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: PAVEL_SYSTEM + (intelligencePrompt ? '\n\n' + intelligencePrompt : ''),
      messages: history
    });
    
    let reply = response.content[0].text;
    
    // Post-process with intelligence
    if (intelligence && ctx) {
      reply = await intelligence.processOutgoing(message, reply, ctx);
      await intelligence.storeConversationMemory(message, reply);
    }
    
    // Update history
    history.push({ role: 'assistant', content: reply });
    conversationMemory.set(odId, history);
    
    // Human-like delay
    await new Promise(r => setTimeout(r, Math.min(reply.length * 30, 3000)));
    
    // Send reply
    const sent = await message.reply(reply);
    trackConversation(message.channel.id, odId);
    
    // Learning
    if (intelligence?.learning) {
      await intelligence.learning.recordResponse(sent.id, message.channel.id, odId, 'reply', 'general', reply.length);
    }
    
    // Media generation
    if (mediaGenerator) {
      try { await mediaGenerator.handleBotMedia(MY_BOT_ID, reply, message.channel); } catch (e) {}
    }
    
  } catch (e) {
    console.error('Response error:', e);
    await message.reply("Ah, Kapitan... technical difficulties with the submarine systems. One moment, yes?");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
client.on(Events.MessageCreate, async (message) => {
  // Skip other bots (except our network)
  if (message.author.bot && !isOtherBot(message.author.id)) return;
  if (message.author.id === client.user.id) return;
  
  // DMs
  if (!message.guild) {
    await generateResponse(message);
    return;
  }
  
  const content = message.content;
  const channelName = message.channel.name;

  // NEVER respond in counting
  if (channelName === 'counting') return;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAYO LFG CHANNEL - Use ADVANCED system
  // ═══════════════════════════════════════════════════════════════════════════
  if (channelName === 'cayo-lfg') {
    const requiredRoles = ['Cayo Grinder', 'Los Santos Hustler', '💰 Los Santos Hustler', '🏝️ Cayo Grinder'];
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
            `• \`?cayo\` - Start a Cayo Perico heist crew`
          );
        } catch (e) {}
      } catch (e) {}
      return;
    }
    
    // Handle commands
    if (content.startsWith(PREFIX)) {
      const args = content.slice(PREFIX.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();
      
      // ADVANCED CAYO LFG COMMANDS
      if (command === 'cayo' || command === 'heist' || command === 'perico') {
        await advancedCayoLFG.createSession(message, client);
        return;
      }
      
      if (command === 'endcayo') {
        await message.reply('Kapitan, use the End Session button on your active heist!');
        return;
      }
      
      // Legacy commands fallback
      if (['done', 'cancel'].includes(command) && nexusLFG) {
        await nexusLFG.handleCommand(message, command, args);
        return;
      }
    }
    
    // Natural language LFG detection
    if (nexusLFG) {
      const lfgIntent = await nexusLFG.detectLFGIntent(message);
      if (lfgIntent) {
        await advancedCayoLFG.createSession(message, client);
        return;
      }
    }
    
    // Not LFG - delete
    try {
      await message.delete();
      const warning = await message.channel.send(
        `<@${message.author.id}> Kapitan, this channel is for LFG commands only! Use \`?cayo\` to start a heist.`
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
              name: '🏝️ Cayo LFG (Use in #cayo-lfg)',
              value: 
                '`?cayo` - Start a Cayo Perico heist session\n' +
                '• Select primary target (Pink Diamond, Bearer Bonds, etc.)\n' +
                '• Choose approach (Drainage, Main Dock, etc.)\n' +
                '• Toggle B2B mode on/off\n' +
                '• Auto voice channel creation\n' +
                '• Live earnings tracker'
            },
            {
              name: '📊 Session Features',
              value: '• Platform matching (PS4/PS5)\n• Run completion counter\n• Estimated payouts\n• Session timer'
            },
            {
              name: '🎙️ Voice',
              value: '`?voice join` - Join your voice channel\n`?voice leave` - Leave voice'
            }
          )
          .setColor(0x5865F2)
          .setFooter({ text: 'ULTIMATE Edition + Advanced LFG' });
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
        if (!voiceSystem?.isConnected?.()) return message.reply("Kapitan, Pavel is not in voice. Use `?voice join` first!");
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
    
    // Allow ?cayo in GTA channels too
    if ((command === 'cayo' || command === 'heist') && (channelName.includes('gta') || channelName.includes('los-santos'))) {
      const lfgChannel = message.guild.channels.cache.find(c => c.name === 'cayo-lfg');
      if (lfgChannel) {
        await message.reply(`Kapitan! Head to <#${lfgChannel.id}> for heist planning, yes?`);
      } else {
        await advancedCayoLFG.createSession(message, client);
      }
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
  // Legacy nexus buttons
  if (interaction.isButton() && interaction.customId.startsWith('lfg_') && nexusLFG) {
    await nexusLFG.handleButton(interaction);
  }
  // Note: Advanced Cayo LFG handles its own interactions via the initialize() listener
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  
  if (reaction.partial) {
    try { await reaction.fetch(); } catch (e) { return; }
  }
  
  // LFG reactions (legacy)
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
