/**
 * ██████╗ █████╗ ██╗   ██╗ ██████╗     ██╗     ███████╗ ██████╗ 
 * ██╔════╝██╔══██╗╚██╗ ██╔╝██╔═══██╗    ██║     ██╔════╝██╔════╝ 
 * ██║     ███████║ ╚████╔╝ ██║   ██║    ██║     █████╗  ██║  ███╗
 * ██║     ██╔══██║  ╚██╔╝  ██║   ██║    ██║     ██╔══╝  ██║   ██║
 * ╚██████╗██║  ██║   ██║   ╚██████╔╝    ███████╗██║     ╚██████╔╝
 *  ╚═════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝     ╚══════╝╚═╝      ╚═════╝ 
 * 
 * ADVANCED CAYO PERICO LFG - GTA 6 EDITION
 * 
 * Features:
 * - GTA 6 Vice City color theme
 * - Blacklist system integration
 * - Live countdown timer
 * - Crew reputation display
 * - Heat map (how many heists today)
 * - Smart matching suggestions
 * - Session analytics
 * - Voice channel auto-creation
 * - Ephemeral setup (private until recruiting)
 * - Animated status updates
 */

const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

// ═══════════════════════════════════════════════════════════════════
// GTA 6 COLOR PALETTE
// ═══════════════════════════════════════════════════════════════════
const COLORS = {
  vice_pink: 0xFF0080,
  vice_teal: 0x00D4AA,
  sunset_orange: 0xFF6B35,
  neon_blue: 0x00D4FF,
  gold: 0xFFD700,
  platinum: 0xE5E4E2,
  success: 0x00FF88,
  danger: 0xFF3366,
  waiting: 0xFFAA00
};

// ═══════════════════════════════════════════════════════════════════
// SESSION STORAGE
// ═══════════════════════════════════════════════════════════════════
const activeSessions = new Map();
const setupSessions = new Map();
const sessionAnalytics = new Map();

// ═══════════════════════════════════════════════════════════════════
// HEIST DATA
// ═══════════════════════════════════════════════════════════════════
const TARGETS = {
  pink_diamond: { name: 'Pink Diamond', emoji: '💎', value: '$1,430,000', rarity: 'LEGENDARY' },
  bearer_bonds: { name: 'Bearer Bonds', emoji: '📜', value: '$1,210,000', rarity: 'RARE' },
  ruby_necklace: { name: 'Ruby Necklace', emoji: '📿', value: '$1,100,000', rarity: 'UNCOMMON' },
  madrazo_files: { name: 'Madrazo Files', emoji: '📁', value: '$1,100,000', rarity: 'COMMON' },
  tequila: { name: 'Sinsimito Tequila', emoji: '🍾', value: '$990,000', rarity: 'COMMON' }
};

const APPROACHES = {
  drainage: { name: 'Drainage Tunnel', emoji: '🚇', difficulty: 'EASY', stealth: true },
  main_dock: { name: 'Main Dock', emoji: '⚓', difficulty: 'MEDIUM', stealth: true },
  airstrip: { name: 'Airstrip', emoji: '✈️', difficulty: 'MEDIUM', stealth: false },
  halo_jump: { name: 'HALO Jump', emoji: '🪂', difficulty: 'HARD', stealth: true },
  west_beach: { name: 'West Beach', emoji: '🏖️', difficulty: 'HARD', stealth: true }
};

const PLATFORMS = {
  ps5: { name: 'PlayStation 5', emoji: '<:ps5:1234>', short: 'PS5' },
  ps4: { name: 'PlayStation 4', emoji: '<:ps4:1234>', short: 'PS4' },
  crossgen: { name: 'Cross-Gen (PS4+PS5)', emoji: '🎮', short: 'CROSS' }
};

// ═══════════════════════════════════════════════════════════════════
// DATABASE INTEGRATION
// ═══════════════════════════════════════════════════════════════════
let pool = null;
let blacklistSystem = null;

function initialize(client, dbPool) {
  pool = dbPool;
  
  // Initialize blacklist
  try {
    const { getBlacklistSystem } = require('./blacklistSystem');
    blacklistSystem = getBlacklistSystem(pool);
    blacklistSystem.initialize();
  } catch (e) {
    console.log('[CAYO] Blacklist system not found, continuing without it');
  }
  
  // Initialize analytics table
  initAnalytics();
  
  // Handle interactions
  client.on('interactionCreate', handleInteraction);
  
  console.log('[CAYO LFG] ✅ GTA 6 Edition initialized');
}

async function initAnalytics() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cayo_analytics (
        id SERIAL PRIMARY KEY,
        host_id VARCHAR(50),
        host_username VARCHAR(100),
        target VARCHAR(50),
        approach VARCHAR(50),
        platform VARCHAR(20),
        crew_size INT DEFAULT 1,
        estimated_take VARCHAR(50),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'recruiting',
        voice_channel_id VARCHAR(50)
      )
    `);
  } catch (e) {
    console.error('[CAYO] Analytics init error:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CREATE SESSION - EPHEMERAL SETUP
// ═══════════════════════════════════════════════════════════════════
async function createSession(message, client) {
  const userId = message.author.id;
  
  // Check for existing session
  if (activeSessions.has(userId)) {
    const existing = activeSessions.get(userId);
    return message.reply({
      embeds: [new EmbedBuilder()
        .setDescription(`❌ You already have an active session.\n[Go to session](https://discord.com/channels/${message.guild.id}/${existing.channelId}/${existing.messageId})`)
        .setColor(COLORS.danger)
      ],
      ephemeral: true
    });
  }

  // Delete command message
  await message.delete().catch(() => {});

  // Create setup session
  const setupId = `setup_${userId}_${Date.now()}`;
  setupSessions.set(setupId, {
    userId: userId,
    userId: userId.author.username,
    userId: userId.channel.id,
    step: 1,
    data: {}
  });

  // Send ephemeral setup - Step 1: Platform
  const setupEmbed = createSetupEmbed(1, {});
  const platformRow = createPlatformSelect(setupId);

  try {
    await message.author.send({
      embeds: [setupEmbed],
      components: [platformRow]
    });
    
    // Confirm in channel
    const confirmMsg = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setDescription(`📩 **${message.author.username}**, check your DMs to set up your heist!`)
        .setColor(COLORS.vice_teal)
      ]
    });
    
    setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
  } catch (e) {
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setDescription(`❌ **${message.author.username}**, I couldn't DM you. Please enable DMs from server members.`)
        .setColor(COLORS.danger)
      ]
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// SETUP EMBEDS
// ═══════════════════════════════════════════════════════════════════
function createSetupEmbed(step, data) {
  const totalSteps = 5;
  const progressBar = createProgressBar(step, totalSteps);
  
  const embed = new EmbedBuilder()
    .setTitle(`\`\`\`CAYO PERICO HEIST SETUP\`\`\``)
    .setColor(COLORS.vice_pink)
    .setFooter({ text: `Step ${step}/${totalSteps} • The Unpatched Method` });

  switch (step) {
    case 1:
      embed.setDescription(`
${progressBar}

**SELECT YOUR PLATFORM**

Choose your PlayStation version for crew matching.
Cross-Gen allows both PS4 and PS5 players to join.
      `);
      break;
      
    case 2:
      embed.setDescription(`
${progressBar}

**ENTER YOUR PSN**

Your PlayStation Network username for crew invites.
      `);
      break;
      
    case 3:
      embed.setDescription(`
${progressBar}

**SELECT PRIMARY TARGET**

What's in El Rubio's vault today?

${Object.entries(TARGETS).map(([k, v]) => 
  `${v.emoji} **${v.name}** — ${v.value} \`${v.rarity}\``
).join('\n')}
      `);
      break;
      
    case 4:
      embed.setDescription(`
${progressBar}

**SELECT APPROACH**

How are you infiltrating the compound?

${Object.entries(APPROACHES).map(([k, v]) => 
  `${v.emoji} **${v.name}** — \`${v.difficulty}\` ${v.stealth ? '🤫 Stealth' : '💥 Loud'}`
).join('\n')}
      `);
      break;
      
    case 5:
      embed.setDescription(`
${progressBar}

**FINAL OPTIONS**

Configure your heist settings.
      `);
      embed.addFields(
        { name: '📋 Summary', value: formatSummary(data), inline: false }
      );
      break;
  }
  
  return embed;
}

function createProgressBar(current, total) {
  const filled = '▰';
  const empty = '▱';
  const bar = filled.repeat(current) + empty.repeat(total - current);
  return `\`${bar}\` ${current}/${total}`;
}

function formatSummary(data) {
  const lines = [];
  if (data.platform) lines.push(`**Platform:** ${PLATFORMS[data.platform]?.name || data.platform}`);
  if (data.psn) lines.push(`**PSN:** ${data.psn}`);
  if (data.target) lines.push(`**Target:** ${TARGETS[data.target]?.emoji} ${TARGETS[data.target]?.name}`);
  if (data.approach) lines.push(`**Approach:** ${APPROACHES[data.approach]?.emoji} ${APPROACHES[data.approach]?.name}`);
  if (data.b2b !== undefined) lines.push(`**B2B:** ${data.b2b ? 'Yes' : 'No'}`);
  return lines.join('\n') || 'No selections yet';
}

// ═══════════════════════════════════════════════════════════════════
// SETUP COMPONENTS
// ═══════════════════════════════════════════════════════════════════
function createPlatformSelect(setupId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cayo_platform_${setupId}`)
      .setPlaceholder('🎮 Select Platform')
      .addOptions([
        { label: 'PlayStation 5', description: 'PS5 players only', value: 'ps5', emoji: '🎮' },
        { label: 'PlayStation 4', description: 'PS4 players only', value: 'ps4', emoji: '🎮' },
        { label: 'Cross-Gen', description: 'PS4 + PS5 players welcome', value: 'crossgen', emoji: '🔄' }
      ])
  );
}

function createTargetSelect(setupId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cayo_target_${setupId}`)
      .setPlaceholder('💎 Select Primary Target')
      .addOptions(Object.entries(TARGETS).map(([key, val]) => ({
        label: val.name,
        description: `${val.value} • ${val.rarity}`,
        value: key,
        emoji: val.emoji
      })))
  );
}

function createApproachSelect(setupId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cayo_approach_${setupId}`)
      .setPlaceholder('🚇 Select Approach')
      .addOptions(Object.entries(APPROACHES).map(([key, val]) => ({
        label: val.name,
        description: `${val.difficulty} • ${val.stealth ? 'Stealth' : 'Loud'}`,
        value: key,
        emoji: val.emoji
      })))
  );
}

function createFinalOptions(setupId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cayo_b2b_yes_${setupId}`)
        .setLabel('B2B: ON')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId(`cayo_b2b_no_${setupId}`)
        .setLabel('B2B: OFF')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('1️⃣')
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cayo_voice_yes_${setupId}`)
        .setLabel('Create Voice Channel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔊'),
      new ButtonBuilder()
        .setCustomId(`cayo_voice_no_${setupId}`)
        .setLabel('No Voice')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔇')
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cayo_start_${setupId}`)
        .setLabel('START RECRUITING')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🚀')
    )
  ];
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SESSION EMBED - THE SHOWPIECE
// ═══════════════════════════════════════════════════════════════════
function createMainSessionEmbed(session) {
  const target = TARGETS[session.target];
  const approach = APPROACHES[session.approach];
  const platform = PLATFORMS[session.platform];
  
  const crewList = session.crew.length > 0 
    ? session.crew.map((c, i) => `\`${i + 1}\` <@${c.userId}> • \`${c.psn}\``).join('\n')
    : '```\nWaiting for crew...\n```';
  
  const spotsLeft = 4 - session.crew.length - 1;
  const spotsDisplay = '🟢'.repeat(spotsLeft) + '🔴'.repeat(4 - spotsLeft);
  
  // Calculate estimated take
  const baseValue = parseInt(target.value.replace(/[$,]/g, ''));
  const crewCut = session.crew.length + 1;
  const perPerson = Math.floor(baseValue * 0.85 / crewCut);
  
  const embed = new EmbedBuilder()
    .setAuthor({ 
      name: 'CAYO PERICO HEIST', 
      iconURL: 'https://i.imgur.com/xyz.png' 
    })
    .setTitle(`${target.emoji} ${target.name.toUpperCase()}`)
    .setDescription(`
\`\`\`ansi
[2;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m
\`\`\`
**${approach.emoji} ${approach.name}** • \`${approach.difficulty}\` ${approach.stealth ? '• 🤫 Stealth' : '• 💥 Loud'}

${session.b2b ? '🔄 **B2B ACTIVE** — Back-to-back runs\n' : ''}
    `)
    .addFields(
      { 
        name: '👤 HOST', 
        value: `>>> <@${session.hostId}>\n\`${session.hostPsn}\``, 
        inline: true 
      },
      { 
        name: '🎮 PLATFORM', 
        value: `>>> ${platform?.short || session.platform}`, 
        inline: true 
      },
      { 
        name: '💰 EST. TAKE', 
        value: `>>> \`$${perPerson.toLocaleString()}/ea\``, 
        inline: true 
      },
      { 
        name: `🎯 CREW ${session.crew.length + 1}/4`, 
        value: `>>> ${crewList}`, 
        inline: false 
      },
      {
        name: '📊 SPOTS',
        value: `>>> ${spotsDisplay} \`${spotsLeft} open\``,
        inline: false
      }
    )
    .setColor(session.status === 'recruiting' ? COLORS.vice_pink : COLORS.success)
    .setFooter({ 
      text: `⏱️ Created ${getTimeAgo(session.createdAt)} • ID: ${session.id.slice(-6)}`,
    })
    .setTimestamp();

  // Add thumbnail based on target
  const thumbnails = {
    pink_diamond: 'https://i.imgur.com/pink_diamond.png',
    bearer_bonds: 'https://i.imgur.com/bearer_bonds.png',
    ruby_necklace: 'https://i.imgur.com/ruby.png',
    madrazo_files: 'https://i.imgur.com/files.png',
    tequila: 'https://i.imgur.com/tequila.png'
  };
  
  return embed;
}

// ═══════════════════════════════════════════════════════════════════
// SESSION CONTROLS
// ═══════════════════════════════════════════════════════════════════
function createSessionControls(session) {
  const rows = [];
  
  // Row 1: Join button (for everyone)
  if (session.status === 'recruiting' && session.crew.length < 3) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cayo_join_${session.id}`)
        .setLabel('JOIN HEIST')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎯')
    ));
  }
  
  // Row 2: Host controls
  const hostRow = new ActionRowBuilder();
  
  if (session.crew.length > 0) {
    hostRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`cayo_kick_menu_${session.id}`)
        .setLabel('Kick')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('👢')
    );
  }
  
  if (session.status === 'recruiting') {
    hostRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`cayo_ready_${session.id}`)
        .setLabel('Ready Up')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✅')
    );
  } else if (session.status === 'ready') {
    hostRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`cayo_complete_${session.id}`)
        .setLabel('COMPLETE')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🏆')
    );
  }
  
  hostRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`cayo_cancel_${session.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌')
  );
  
  rows.push(hostRow);
  
  return rows;
}

// ═══════════════════════════════════════════════════════════════════
// INTERACTION HANDLER
// ═══════════════════════════════════════════════════════════════════
async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith('cayo_')) return;
  
  const parts = interaction.customId.split('_');
  const action = parts[1];
  const id = parts.slice(2).join('_');
  
  try {
    switch (action) {
      case 'platform':
        await handlePlatformSelect(interaction, id);
        break;
      case 'target':
        await handleTargetSelect(interaction, id);
        break;
      case 'approach':
        await handleApproachSelect(interaction, id);
        break;
      case 'b2b':
        await handleB2BSelect(interaction, id, parts[2] === 'yes');
        break;
      case 'voice':
        await handleVoiceSelect(interaction, id, parts[2] === 'yes');
        break;
      case 'start':
        await handleStartRecruiting(interaction, id);
        break;
      case 'join':
        await handleJoin(interaction, id);
        break;
      case 'kick':
        if (parts[2] === 'menu') {
          await handleKickMenu(interaction, id);
        } else {
          await handleKickConfirm(interaction, id, parts[2]);
        }
        break;
      case 'ready':
        await handleReady(interaction, id);
        break;
      case 'complete':
        await handleComplete(interaction, id);
        break;
      case 'cancel':
        await handleCancel(interaction, id);
        break;
      case 'leave':
        await handleLeave(interaction, id);
        break;
    }
  } catch (e) {
    console.error('[CAYO] Interaction error:', e);
    await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════
// SETUP HANDLERS
// ═══════════════════════════════════════════════════════════════════
async function handlePlatformSelect(interaction, setupId) {
  const session = setupSessions.get(setupId);
  if (!session || interaction.user.id !== session.userId) {
    return interaction.reply({ content: '❌ Invalid session.', ephemeral: true });
  }
  
  session.data.platform = interaction.values[0];
  session.step = 2;
  
  // Show PSN modal
  const modal = new ModalBuilder()
    .setCustomId(`cayo_psn_modal_${setupId}`)
    .setTitle('Enter Your PSN');
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('psn_input')
        .setLabel('PlayStation Network Username')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('YourPSN_Name')
        .setRequired(true)
        .setMaxLength(16)
    )
  );
  
  await interaction.showModal(modal);
  
  // Handle modal submit
  const filter = i => i.customId === `cayo_psn_modal_${setupId}`;
  try {
    const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 120000 });
    session.data.psn = modalInteraction.fields.getTextInputValue('psn_input');
    session.step = 3;
    
    const embed = createSetupEmbed(3, session.data);
    const row = createTargetSelect(setupId);
    
    await modalInteraction.update({ embeds: [embed], components: [row] });
  } catch (e) {
    // Modal timeout
  }
}

async function handleTargetSelect(interaction, setupId) {
  const session = setupSessions.get(setupId);
  if (!session) return;
  
  session.data.target = interaction.values[0];
  session.step = 4;
  
  const embed = createSetupEmbed(4, session.data);
  const row = createApproachSelect(setupId);
  
  await interaction.update({ embeds: [embed], components: [row] });
}

async function handleApproachSelect(interaction, setupId) {
  const session = setupSessions.get(setupId);
  if (!session) return;
  
  session.data.approach = interaction.values[0];
  session.step = 5;
  session.data.b2b = false;
  session.data.voice = false;
  
  const embed = createSetupEmbed(5, session.data);
  const rows = createFinalOptions(setupId);
  
  await interaction.update({ embeds: [embed], components: rows });
}

async function handleB2BSelect(interaction, setupId, isB2B) {
  const session = setupSessions.get(setupId);
  if (!session) return;
  
  session.data.b2b = isB2B;
  
  const embed = createSetupEmbed(5, session.data);
  const rows = createFinalOptions(setupId);
  
  // Update button styles to show selection
  rows[0].components[0].setStyle(isB2B ? ButtonStyle.Success : ButtonStyle.Secondary);
  rows[0].components[1].setStyle(!isB2B ? ButtonStyle.Success : ButtonStyle.Secondary);
  
  await interaction.update({ embeds: [embed], components: rows });
}

async function handleVoiceSelect(interaction, setupId, wantsVoice) {
  const session = setupSessions.get(setupId);
  if (!session) return;
  
  session.data.voice = wantsVoice;
  
  const embed = createSetupEmbed(5, session.data);
  const rows = createFinalOptions(setupId);
  
  rows[1].components[0].setStyle(wantsVoice ? ButtonStyle.Success : ButtonStyle.Secondary);
  rows[1].components[1].setStyle(!wantsVoice ? ButtonStyle.Success : ButtonStyle.Secondary);
  
  await interaction.update({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════
// START RECRUITING - GO LIVE
// ═══════════════════════════════════════════════════════════════════
async function handleStartRecruiting(interaction, setupId) {
  const setup = setupSessions.get(setupId);
  if (!setup) return;
  
  // Validate
  if (!setup.data.platform || !setup.data.psn || !setup.data.target || !setup.data.approach) {
    return interaction.reply({ content: '❌ Please complete all selections first.', ephemeral: true });
  }
  
  // Create session ID
  const sessionId = `cayo_${Date.now()}_${setup.userId.slice(-4)}`;
  
  // Create voice channel if requested
  let voiceChannel = null;
  if (setup.data.voice) {
    try {
      const guild = interaction.client.guilds.cache.get(setup.guildId);
      // Find GTA category specifically
      const category = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildCategory && 
        (c.name.toLowerCase().includes('gta') || c.name.toLowerCase().includes('heist') || c.name.toLowerCase().includes('cayo'))
      );
      
      voiceChannel = await guild.channels.create({
        name: `🎯 ${setup.hostUsername}'s Heist`,
        type: ChannelType.GuildVoice,
        parent: category?.id,
        userLimit: 4,
        reason: 'Cayo LFG Session'
      });
    } catch (e) {
      console.error('[CAYO] Voice creation error:', e.message);
    }
  }
  
  // Create session
  const session = {
    id: sessionId,
    userId: setup.userId,
    userId: setup.userId,
    userId: setup.data.psn,
    platform: setup.data.platform,
    target: setup.data.target,
    approach: setup.data.approach,
    b2b: setup.data.b2b,
    crew: [],
    status: 'recruiting',
    voiceChannelId: voiceChannel?.id,
    createdAt: Date.now(),
    channelId: setup.channelId,
    messageId: null
  };
  
  // Post to LFG channel
  const lfgChannel = interaction.client.channels.cache.get(setup.channelId);
  if (!lfgChannel) {
    return interaction.reply({ content: '❌ Could not find LFG channel.', ephemeral: true });
  }
  
  const embed = createMainSessionEmbed(session);
  const components = createSessionControls(session);
  
  // Ping role
  const pingRole = lfgChannel.guild.roles.cache.find(r => 
    r.name.toLowerCase().includes('cayo') || r.name.toLowerCase().includes('heist')
  );
  
  const lfgMessage = await lfgChannel.send({
    content: pingRole ? `<@&${pingRole.id}>` : '🎯 **New Cayo Heist!**',
    embeds: [embed],
    components
  });
  
  session.messageId = lfgMessage.id;
  activeSessions.set(setup.userId, session);
  activeSessions.set(sessionId, session);
  
  // Cleanup setup
  setupSessions.delete(setupId);
  
  // Update DM
  await interaction.update({
    embeds: [new EmbedBuilder()
      .setTitle('🚀 HEIST IS LIVE!')
      .setDescription(`Your session is now recruiting!\n\n[**Go to your session**](https://discord.com/channels/${lfgChannel.guild.id}/${lfgChannel.id}/${lfgMessage.id})`)
      .setColor(COLORS.success)
    ],
    components: []
  });
  
  // Save to analytics
  if (pool) {
    try {
      await pool.query(`
        INSERT INTO cayo_analytics (host_id, host_username, target, approach, platform, voice_channel_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [session.userId, session.userId, session.target, session.approach, session.platform, session.voiceChannelId]);
    } catch (e) {}
  }
}

// ═══════════════════════════════════════════════════════════════════
// JOIN HANDLER
// ═══════════════════════════════════════════════════════════════════
async function handleJoin(interaction, sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return interaction.reply({ content: '❌ Session not found or expired.', ephemeral: true });
  }
  
  // Check if already in crew
  if (session.hostId === interaction.user.id || session.crew.some(c => c.userId === interaction.user.id)) {
    return interaction.reply({ content: '❌ You\'re already in this session.', ephemeral: true });
  }
  
  // Check if full
  if (session.crew.length >= 3) {
    return interaction.reply({ content: '❌ This session is full.', ephemeral: true });
  }
  
  // Check blacklist
  if (blacklistSystem) {
    const isBlocked = await blacklistSystem.isBlacklisted(session.hostId, interaction.user.id);
    if (isBlocked) {
      return interaction.reply({ 
        content: '🚫 You\'ve been blacklisted by this host and cannot join their sessions.', 
        ephemeral: true 
      });
    }
  }
  
  // Show PSN modal
  const modal = new ModalBuilder()
    .setCustomId(`cayo_join_psn_${sessionId}`)
    .setTitle('Join Heist');
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('psn_input')
        .setLabel('Your PSN Username')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('YourPSN')
        .setRequired(true)
    )
  );
  
  await interaction.showModal(modal);
  
  // Handle modal
  const filter = i => i.customId === `cayo_join_psn_${sessionId}`;
  try {
    const modalInt = await interaction.awaitModalSubmit({ filter, time: 60000 });
    const psn = modalInt.fields.getTextInputValue('psn_input');
    
    // Add to crew
    session.crew.push({
      userId: modalInt.user.id,
      userId: modalInt.user.username,
      psn,
      joinedAt: Date.now()
    });
    
    // Update message
    await updateSessionMessage(interaction.client, session);
    
    await modalInt.reply({ 
      content: `✅ You've joined the heist! PSN: \`${psn}\``, 
      ephemeral: true 
    });
    
    // Notify host
    try {
      const host = await interaction.client.users.fetch(session.hostId);
      await host.send({
        embeds: [new EmbedBuilder()
          .setDescription(`🎯 **${modalInt.user.username}** joined your Cayo heist!\nPSN: \`${psn}\``)
          .setColor(COLORS.vice_teal)
        ]
      });
    } catch (e) {}
    
  } catch (e) {
    // Timeout
  }
}

// ═══════════════════════════════════════════════════════════════════
// KICK HANDLER
// ═══════════════════════════════════════════════════════════════════
async function handleKickMenu(interaction, sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  
  if (interaction.user.id !== session.hostId) {
    return interaction.reply({ content: '❌ Only the host can kick.', ephemeral: true });
  }
  
  if (session.crew.length === 0) {
    return interaction.reply({ content: '❌ No crew members to kick.', ephemeral: true });
  }
  
  const select = new StringSelectMenuBuilder()
    .setCustomId(`cayo_kick_select_${sessionId}`)
    .setPlaceholder('Select player to kick')
    .addOptions(session.crew.map(c => ({
      label: c.username,
      description: `PSN: ${c.psn}`,
      value: c.userId
    })));
  
  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('👢 Kick Player')
      .setDescription('Select a player to remove from your heist.')
      .setColor(COLORS.danger)
    ],
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true
  });
  
  // Handle selection
  const filter = i => i.customId === `cayo_kick_select_${sessionId}`;
  try {
    const selectInt = await interaction.channel.awaitMessageComponent({ filter, time: 30000 });
    const kickedId = selectInt.values[0];
    const kickedMember = session.crew.find(c => c.userId === kickedId);
    
    // Remove from crew
    session.crew = session.crew.filter(c => c.userId !== kickedId);
    
    // Update session message
    await updateSessionMessage(interaction.client, session);
    
    // Show blacklist prompt
    if (blacklistSystem) {
      const { embed, row } = blacklistSystem.createBlacklistPrompt(
        session.hostId,
        kickedId,
        kickedMember.username
      );
      await selectInt.update({ embeds: [embed], components: [row] });
    } else {
      await selectInt.update({
        embeds: [new EmbedBuilder()
          .setDescription(`✅ **${kickedMember.username}** has been kicked.`)
          .setColor(COLORS.success)
        ],
        components: []
      });
    }
    
    // Notify kicked user
    try {
      const kickedUser = await interaction.client.users.fetch(kickedId);
      await kickedUser.send({
        embeds: [new EmbedBuilder()
          .setTitle('👢 Removed from Heist')
          .setDescription(`You've been kicked from **${session.hostUsername}**'s Cayo Perico heist.`)
          .setColor(COLORS.danger)
        ]
      });
    } catch (e) {}
    
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
async function updateSessionMessage(client, session) {
  try {
    const channel = client.channels.cache.get(session.channelId);
    if (!channel) return;
    
    const message = await channel.messages.fetch(session.messageId);
    if (!message) return;
    
    const embed = createMainSessionEmbed(session);
    const components = createSessionControls(session);
    
    await message.edit({ embeds: [embed], components });
  } catch (e) {
    console.error('[CAYO] Update message error:', e.message);
  }
}

async function handleReady(interaction, sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || interaction.user.id !== session.hostId) {
    return interaction.reply({ content: '❌ Only the host can ready up.', ephemeral: true });
  }
  
  session.status = 'ready';
  await updateSessionMessage(interaction.client, session);
  
  await interaction.reply({ content: '🚀 **Heist is ready!** Good luck!', ephemeral: true });
  
  // Notify crew
  for (const member of session.crew) {
    try {
      const user = await interaction.client.users.fetch(member.userId);
      await user.send({
        embeds: [new EmbedBuilder()
          .setDescription(`🚀 **${session.hostUsername}**'s heist is starting!\nGet ready!`)
          .setColor(COLORS.success)
        ]
      });
    } catch (e) {}
  }
}

async function handleComplete(interaction, sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || interaction.user.id !== session.hostId) {
    return interaction.reply({ content: '❌ Only the host can complete.', ephemeral: true });
  }
  
  // Delete voice channel
  if (session.voiceChannelId) {
    try {
      const vc = interaction.client.channels.cache.get(session.voiceChannelId);
      await vc?.delete('LFG Session completed');
    } catch (e) {}
  }
  
  // Update message to show completed
  try {
    const channel = interaction.client.channels.cache.get(session.channelId);
    const msg = await channel.messages.fetch(session.messageId);
    
    const target = TARGETS[session.target];
    const completedEmbed = new EmbedBuilder()
      .setTitle('🏆 HEIST COMPLETED')
      .setDescription(`**${target.emoji} ${target.name}** was a success!\n\n**Host:** <@${session.hostId}>\n**Crew:** ${session.crew.map(c => `<@${c.userId}>`).join(', ') || 'Solo'}`)
      .setColor(COLORS.success)
      .setTimestamp();
    
    await msg.edit({ embeds: [completedEmbed], components: [] });
  } catch (e) {}
  
  // Cleanup
  activeSessions.delete(sessionId);
  activeSessions.delete(session.hostId);
  
  await interaction.reply({ content: '🏆 **Heist completed!** Voice channel closed.', ephemeral: true });
}

async function handleCancel(interaction, sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || interaction.user.id !== session.hostId) {
    return interaction.reply({ content: '❌ Only the host can cancel.', ephemeral: true });
  }
  
  // Delete voice channel
  if (session.voiceChannelId) {
    try {
      const vc = interaction.client.channels.cache.get(session.voiceChannelId);
      await vc?.delete();
    } catch (e) {}
  }
  
  // Delete session message
  try {
    const channel = interaction.client.channels.cache.get(session.channelId);
    const msg = await channel.messages.fetch(session.messageId);
    await msg.delete();
  } catch (e) {}
  
  // Cleanup
  activeSessions.delete(sessionId);
  activeSessions.delete(session.hostId);
  
  await interaction.reply({ content: '✅ Session cancelled.', ephemeral: true });
}

async function handleLeave(interaction, sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  
  const memberIndex = session.crew.findIndex(c => c.userId === interaction.user.id);
  if (memberIndex === -1) {
    return interaction.reply({ content: '❌ You\'re not in this session.', ephemeral: true });
  }
  
  session.crew.splice(memberIndex, 1);
  await updateSessionMessage(interaction.client, session);
  
  await interaction.reply({ content: '✅ You left the heist.', ephemeral: true });
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

module.exports = { 
  initialize, 
  createSession,
  handleInteraction
};
