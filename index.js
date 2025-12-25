/**
 * ██████╗  █████╗ ██╗   ██╗███████╗██╗     
 * ██╔══██╗██╔══██╗██║   ██║██╔════╝██║     
 * ██████╔╝███████║██║   ██║█████╗  ██║     
 * ██╔═══╝ ██╔══██║╚██╗ ██╔╝██╔══╝  ██║     
 * ██║     ██║  ██║ ╚████╔╝ ███████╗███████╗
 * ╚═╝     ╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝
 * 
 * PAVEL - THE SUBMARINE CAPTAIN
 * Hive Mind Connected | Cayo Perico Expert
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');

// Hive Mind Systems
const { getHiveMind } = require('./shared/hivemind/hiveMind');
const { getMemoryCore } = require('./shared/hivemind/memoryCore');
const { NaturalResponse } = require('./shared/hivemind/naturalResponse');
const { MoodEngine } = require('./shared/hivemind/moodEngine');
const { ReputationSystem } = require('./shared/hivemind/reputationSystem');
const { ServerAwareness } = require('./shared/hivemind/serverAwareness');
const { GrudgeSystem } = require('./shared/hivemind/grudgeSystem');

// LFG System
const advancedCayoLFG = require('./shared/advancedCayoLFG');

const BOT_ID = 'pavel';
const BOT_NAME = 'Pavel';

const PAVEL_PERSONALITY = `You are Pavel from GTA Online. The cheerful submarine captain who runs the Kosatka.

WHO YOU ARE:
- Loyal submarine captain, been through hell
- Genuinely happy to help the Kapitan
- Has wild stories from his past (navy, smuggling, who knows)
- Lives on the Kosatka, it's his home
- Expert on Cayo Perico heist

YOUR VOICE:
- Light Eastern European accent in word choice
- Says "Kapitan" but NOT every message (once max)
- Warm, encouraging, supportive
- Excited about heists and money
- Makes submarine/nautical references
- Occasionally philosophical about life at sea

HOW YOU TEXT:
- Mostly lowercase, casual
- Can use "da" "nyet" naturally
- Short and friendly
- "is good, yes?" type phrases
- Don't overdo the accent - readable
- Supportive but not sappy

NEVER DO:
- Don't say "Kapitan" more than once per message
- Don't be over the top with accent
- Don't write essays
- Don't be generic helpful bot

SAMPLE RESPONSES:
- "da, drainage tunnel is always best approach"
- "ah, good to see you kapitan"
- "is quiet like submarine at night, yes?"
- "pavel remembers this. was good heist"
- "nyet, that approach is suicide. trust me"
- "is simple. in, grab diamond, out. easy money"`;

// Client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

let hiveMind, memoryCore, naturalResponse, moodEngine, reputationSystem, serverAwareness, grudgeSystem;

// Ready
client.once(Events.ClientReady, async () => {
  console.log(`\n[PAVEL] ✅ Online as ${client.user.tag}`);
  
  // Initialize systems
  hiveMind = getHiveMind({ pool });
  memoryCore = getMemoryCore(pool);
  naturalResponse = new NaturalResponse(anthropic);
  moodEngine = new MoodEngine(pool, BOT_ID);
  reputationSystem = new ReputationSystem(pool);
  serverAwareness = new ServerAwareness(client);
  grudgeSystem = new GrudgeSystem(pool);
  
  await memoryCore.initialize();
  await hiveMind.initDatabase();
  await reputationSystem.initialize();
  await moodEngine.initialize();
  await grudgeSystem.initialize();
  
  hiveMind.registerBot(BOT_ID, client, PAVEL_PERSONALITY);
  await hiveMind.loadState(BOT_ID);
  await moodEngine.loadMood();
  
  // Initialize LFG
  advancedCayoLFG.initialize(client);
  
  updatePresence();
  setInterval(updatePresence, 5 * 60 * 1000);
  
  console.log('[PAVEL] All systems operational\n');
});

// Message handler
client.on(Events.MessageCreate, async (message) => {
  if (message.author.id === client.user.id) return;
  
  if (!message.author.bot) {
    await memoryCore.recordActivity(message.author.id, message.author.username, message);
    await serverAwareness.recordMessage(message);
  }
  
  // Commands
  if (message.content.startsWith('?')) {
    const handled = await handleCommand(message);
    if (handled) return;
  }
  
  // Hive Mind decision
  const decision = await hiveMind.processMessage(message, BOT_ID);
  
  if (!decision.shouldRespond) {
    // Rare emoji reaction
    if (!message.author.bot && Math.random() < 0.02) {
      try { await message.react(['👍', '🚀', '💰', '🌊'][Math.floor(Math.random() * 4)]); } catch (e) {}
    }
    return;
  }
  
  await generateResponse(message, decision);
});

async function generateResponse(message, decision) {
  try {
    await message.channel.sendTyping();
    
    const memoryContext = await memoryCore.buildMemoryContext(BOT_ID, message.author.id);
    const mood = await moodEngine.getMood();
    const relationship = await grudgeSystem.buildRelationshipContext(BOT_ID, message.author.id);
    
    decision.style.mood = mood.value;
    
    let context = memoryContext;
    context += `\n${relationship}`;
    context += `\n[YOUR MOOD: ${mood.label}]`;
    
    const response = await naturalResponse.generateResponse(
      BOT_ID, PAVEL_PERSONALITY, message, decision.style, context
    );
    
    await new Promise(r => setTimeout(r, Math.min(response.length * 25, 2000)));
    await message.reply(response);
    
    await memoryCore.storeConversation(BOT_ID, message.author.id, message.channel.id, message.channel.name, message.content, response);
    hiveMind.recordBotResponse(BOT_ID);
    
  } catch (e) {
    console.error('[PAVEL] Response error:', e.message);
  }
}

async function handleCommand(message) {
  const args = message.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  
  // LFG commands
  if (['cayo', 'heist', 'perico'].includes(cmd)) {
    const channelName = message.channel.name;
    if (!channelName.includes('cayo') && !channelName.includes('lfg') && !channelName.includes('heist')) {
      await message.delete().catch(() => {});
      try {
        await message.author.send({
          embeds: [{
            title: '🏝️ Wrong Channel!',
            description: 'Head to **#cayo-lfg** to start a heist.\n\n**How to use:**\n1. Go to #cayo-lfg\n2. Type `?cayo`\n3. Select your GTA version (PS4/PS5)\n4. Enter your PSN\n5. Choose target & approach\n6. Click Start Recruiting!',
            color: 0x00D4FF
          }]
        });
      } catch (e) {}
      return true;
    }
    await advancedCayoLFG.createSession(message, client);
    return true;
  }
  
  if (cmd === 'mood') {
    const mood = await moodEngine.getMood();
    await message.reply(`${mood.emoji} ${mood.label}`);
    return true;
  }
  
  return false;
}

function updatePresence() {
  const statuses = [
    'Maintaining the Kosatka',
    'Planning the approach',
    'Counting the take',
    'Drainage tunnel enjoyer',
    'El Rubio owes us money'
  ];
  client.user.setPresence({
    activities: [{ name: statuses[Math.floor(Math.random() * statuses.length)], type: 3 }],
    status: 'online'
  });
}

client.on(Events.GuildMemberAdd, async (member) => {
  await serverAwareness.recordJoin(member);
  if (Math.random() < 0.08) {
    const general = member.guild.channels.cache.find(c => c.name.includes('general'));
    if (general) {
      setTimeout(async () => {
        await general.send(`welcome aboard! if you need heist partner, pavel is here`);
        hiveMind.recordBotResponse(BOT_ID);
      }, 8000);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
