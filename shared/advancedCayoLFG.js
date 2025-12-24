/**
 * ██████╗ █████╗ ██╗   ██╗ ██████╗     ██╗     ███████╗ ██████╗ 
 * ██╔════╝██╔══██╗╚██╗ ██╔╝██╔═══██╗    ██║     ██╔════╝██╔════╝ 
 * ██║     ███████║ ╚████╔╝ ██║   ██║    ██║     █████╗  ██║  ███╗
 * ██║     ██╔══██║  ╚██╔╝  ██║   ██║    ██║     ██╔══╝  ██║   ██║
 * ╚██████╗██║  ██║   ██║   ╚██████╔╝    ███████╗██║     ╚██████╔╝
 *  ╚═════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝     ╚══════╝╚═╝      ╚═════╝ 
 * 
 * ADVANCED CAYO PERICO LFG SYSTEM
 * The most sophisticated heist matchmaking ever built
 */

const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

// ============================================
// CAYO PERICO CONFIGURATION
// ============================================

const CAYO_CONFIG = {
  // Primary Targets with payouts (Hard Mode)
  targets: {
    'pink_diamond': { name: '💎 Pink Diamond', payout: 1430000, emoji: '💎' },
    'bearer_bonds': { name: '📜 Bearer Bonds', payout: 1210000, emoji: '📜' },
    'ruby_necklace': { name: '💍 Ruby Necklace', payout: 1100000, emoji: '💍' },
    'madrazo_files': { name: '📁 Madrazo Files', payout: 1210000, emoji: '📁' },
    'tequila': { name: '🍾 Sinsimito Tequila', payout: 990000, emoji: '🍾' }
  },
  
  // Approach routes
  approaches: {
    'drainage': { name: '🚿 Drainage Tunnel', description: 'Fastest entry - swim in through drainage' },
    'main_dock': { name: '🚢 Main Dock', description: 'Boat approach to main dock' },
    'north_dock': { name: '⚓ North Dock', description: 'Stealth approach from north' },
    'airstrip': { name: '✈️ Airstrip', description: 'Fly in via Velum' },
    'halo_jump': { name: '🪂 HALO Jump', description: 'Parachute onto the island' }
  },
  
  // Secondary loot
  secondary: {
    'gold': { name: '🥇 Gold', value: 'Best - fill bags' },
    'cocaine': { name: '❄️ Cocaine', value: 'Great value' },
    'weed': { name: '🌿 Weed', value: 'Good value' },
    'cash': { name: '💵 Cash', value: 'Lowest value' }
  },
  
  // Session settings
  minPlayers: 2,
  maxPlayers: 4,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  voiceChannelTimeout: 10 * 60 * 1000 // Delete VC 10 mins after session ends
};

// Active sessions storage
const activeSessions = new Map();
const userCooldowns = new Map();

// ============================================
// INITIALIZE LFG SYSTEM
// ============================================

function initialize(client) {
  console.log('[CAYO LFG] Initializing advanced Cayo Perico LFG system...');
  
  // Handle button interactions
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
      await handleButton(interaction, client);
    }
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction, client);
    }
  });
  
  // Session timeout checker
  setInterval(() => checkSessionTimeouts(client), 60000);
  
  console.log('[CAYO LFG] ✅ Advanced Cayo LFG system initialized');
}

// ============================================
// CREATE NEW SESSION
// ============================================

async function createSession(message, client) {
  const userId = message.author.id;
  const guild = message.guild;
  
  // Check cooldown (5 minutes between sessions)
  const cooldown = userCooldowns.get(userId);
  if (cooldown && Date.now() - cooldown < 5 * 60 * 1000) {
    const remaining = Math.ceil((5 * 60 * 1000 - (Date.now() - cooldown)) / 1000);
    return message.reply(`⏳ Kapitan, you must wait ${remaining} seconds before hosting another heist.`);
  }
  
  // Check if user already has active session
  for (const [sessionId, session] of activeSessions) {
    if (session.host === userId) {
      return message.reply(`❌ You already have an active session! End it first with \`?endcayo\``);
    }
  }
  
  // Get user's platform
  const member = await guild.members.fetch(userId);
  const isPS5 = member.roles.cache.some(r => r.name.includes('PS5') || r.name.includes('Primary: PS5'));
  const isPS4 = member.roles.cache.some(r => r.name.includes('PS4') || r.name.includes('Primary: PS4'));
  const platform = isPS5 ? 'PS5' : isPS4 ? 'PS4' : 'Unknown';
  
  // Create session ID
  const sessionId = `cayo_${Date.now()}_${userId}`;
  
  // Create session object
  const session = {
    id: sessionId,
    host: userId,
    hostName: message.author.username,
    platform: platform,
    players: [{ userId: userId, name: message.author.username }],
    target: null,
    approach: null,
    secondary: null,
    b2b: true,
    status: 'setup', // setup, recruiting, in_progress, completed
    voiceChannel: null,
    messageId: null,
    channelId: message.channel.id,
    createdAt: Date.now(),
    startedAt: null,
    totalEarnings: 0,
    runsCompleted: 0
  };
  
  // Send setup embed
  const setupEmbed = await createSetupEmbed(session, guild);
  const setupComponents = createSetupComponents(sessionId);
  
  const msg = await message.channel.send({ 
    embeds: [setupEmbed], 
    components: setupComponents 
  });
  
  session.messageId = msg.id;
  activeSessions.set(sessionId, session);
  
  return session;
}

// ============================================
// SETUP EMBED (Target/Approach Selection)
// ============================================

async function createSetupEmbed(session, guild) {
  const host = await guild.members.fetch(session.host).catch(() => null);
  
  const embed = new EmbedBuilder()
    .setTitle('🏝️ CAYO PERICO HEIST - SETUP')
    .setDescription(`**Host:** ${host?.user.tag || 'Unknown'}\n**Platform:** ${session.platform}\n\n*Select your heist configuration below*`)
    .addFields(
      { name: '🎯 Primary Target', value: session.target ? CAYO_CONFIG.targets[session.target].name : '❓ Not selected', inline: true },
      { name: '🚀 Approach', value: session.approach ? CAYO_CONFIG.approaches[session.approach].name : '❓ Not selected', inline: true },
      { name: '💰 Secondary Loot', value: session.secondary ? CAYO_CONFIG.secondary[session.secondary].name : '❓ Not selected', inline: true }
    )
    .setColor(0x00D4FF)
    .setFooter({ text: 'Configure your heist, then click "Start Recruiting"' })
    .setTimestamp();
  
  if (session.target) {
    const estimatedPayout = CAYO_CONFIG.targets[session.target].payout;
    embed.addFields({ name: '💵 Estimated Payout', value: `$${estimatedPayout.toLocaleString()} per run`, inline: false });
  }
  
  return embed;
}

// ============================================
// RECRUITING EMBED (Live updating)
// ============================================

async function createRecruitingEmbed(session, guild) {
  const host = await guild.members.fetch(session.host).catch(() => null);
  const elapsed = session.startedAt ? formatTime(Date.now() - session.startedAt) : '0:00';
  
  // Build player list
  let playerList = '';
  for (let i = 0; i < CAYO_CONFIG.maxPlayers; i++) {
    if (session.players[i]) {
      const player = session.players[i];
      const isHost = player.userId === session.host;
      playerList += `${i + 1}. ${isHost ? '👑' : '🎮'} **${player.name}** ${isHost ? '(Host)' : ''}\n`;
    } else {
      playerList += `${i + 1}. ⬜ *Empty Slot*\n`;
    }
  }
  
  const targetInfo = CAYO_CONFIG.targets[session.target];
  const approachInfo = CAYO_CONFIG.approaches[session.approach];
  
  const embed = new EmbedBuilder()
    .setTitle(`🏝️ CAYO PERICO HEIST - ${session.b2b ? 'B2B ' : ''}RECRUITING`)
    .setDescription(`
**━━━━━━━━━━━━━━━━━━━━━━━━━━━━**
${targetInfo.emoji} **Target:** ${targetInfo.name}
🚀 **Approach:** ${approachInfo.name}
💰 **Est. Payout:** $${targetInfo.payout.toLocaleString()}
🎮 **Platform:** ${session.platform} Only
**━━━━━━━━━━━━━━━━━━━━━━━━━━━━**
    `)
    .addFields(
      { name: `👥 Players (${session.players.length}/${CAYO_CONFIG.maxPlayers})`, value: playerList, inline: false }
    )
    .setColor(session.players.length >= CAYO_CONFIG.minPlayers ? 0x00FF00 : 0xFFAA00)
    .setFooter({ text: `Session ID: ${session.id.slice(-8)} • ⏱️ ${elapsed}` })
    .setTimestamp();
  
  if (session.voiceChannel) {
    embed.addFields({ name: '🔊 Voice Channel', value: `<#${session.voiceChannel}>`, inline: true });
  }
  
  if (session.runsCompleted > 0) {
    embed.addFields(
      { name: '🔄 Runs Completed', value: `${session.runsCompleted}`, inline: true },
      { name: '💵 Total Earnings', value: `$${session.totalEarnings.toLocaleString()}`, inline: true }
    );
  }
  
  return embed;
}

// ============================================
// SETUP COMPONENTS (Dropdowns & Buttons)
// ============================================

function createSetupComponents(sessionId) {
  // Target selection dropdown
  const targetSelect = new StringSelectMenuBuilder()
    .setCustomId(`cayo_target_${sessionId}`)
    .setPlaceholder('🎯 Select Primary Target')
    .addOptions(
      Object.entries(CAYO_CONFIG.targets).map(([key, value]) => ({
        label: value.name.replace(/[^\w\s]/g, '').trim(),
        description: `Payout: $${value.payout.toLocaleString()}`,
        value: key,
        emoji: value.emoji
      }))
    );
  
  // Approach selection dropdown
  const approachSelect = new StringSelectMenuBuilder()
    .setCustomId(`cayo_approach_${sessionId}`)
    .setPlaceholder('🚀 Select Approach')
    .addOptions(
      Object.entries(CAYO_CONFIG.approaches).map(([key, value]) => ({
        label: value.name.replace(/[^\w\s]/g, '').trim(),
        description: value.description,
        value: key
      }))
    );
  
  // Secondary loot dropdown
  const secondarySelect = new StringSelectMenuBuilder()
    .setCustomId(`cayo_secondary_${sessionId}`)
    .setPlaceholder('💰 Select Secondary Loot Priority')
    .addOptions(
      Object.entries(CAYO_CONFIG.secondary).map(([key, value]) => ({
        label: value.name.replace(/[^\w\s]/g, '').trim(),
        description: value.value,
        value: key
      }))
    );
  
  // Action buttons
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cayo_b2b_${sessionId}`)
      .setLabel('B2B: ON')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId(`cayo_start_${sessionId}`)
      .setLabel('Start Recruiting')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🚀'),
    new ButtonBuilder()
      .setCustomId(`cayo_cancel_${sessionId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );
  
  return [
    new ActionRowBuilder().addComponents(targetSelect),
    new ActionRowBuilder().addComponents(approachSelect),
    new ActionRowBuilder().addComponents(secondarySelect),
    buttons
  ];
}

// ============================================
// RECRUITING COMPONENTS (Join/Leave/Actions)
// ============================================

function createRecruitingComponents(sessionId, session) {
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cayo_join_${sessionId}`)
      .setLabel(`Join Heist (${session.players.length}/${CAYO_CONFIG.maxPlayers})`)
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
      .setDisabled(session.players.length >= CAYO_CONFIG.maxPlayers),
    new ButtonBuilder()
      .setCustomId(`cayo_leave_${sessionId}`)
      .setLabel('Leave')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚪'),
    new ButtonBuilder()
      .setCustomId(`cayo_ready_${sessionId}`)
      .setLabel('Ready Up')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎮')
      .setDisabled(session.players.length < CAYO_CONFIG.minPlayers)
  );
  
  const hostButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cayo_complete_${sessionId}`)
      .setLabel('Run Complete (+$)')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💰'),
    new ButtonBuilder()
      .setCustomId(`cayo_voice_${sessionId}`)
      .setLabel('Create Voice')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔊')
      .setDisabled(session.voiceChannel !== null),
    new ButtonBuilder()
      .setCustomId(`cayo_end_${sessionId}`)
      .setLabel('End Session')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🛑')
  );
  
  return [buttons, hostButtons];
}

// ============================================
// BUTTON HANDLERS
// ============================================

async function handleButton(interaction, client) {
  const customId = interaction.customId;
  
  if (!customId.startsWith('cayo_')) return;
  
  const parts = customId.split('_');
  const action = parts[1];
  const sessionId = parts.slice(2).join('_');
  
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return interaction.reply({ content: '❌ Session not found or expired.', ephemeral: true });
  }
  
  try {
    switch (action) {
      case 'b2b':
        await handleB2BToggle(interaction, session, sessionId);
        break;
      case 'start':
        await handleStartRecruiting(interaction, session, sessionId, client);
        break;
      case 'cancel':
        await handleCancelSession(interaction, session, sessionId, client);
        break;
      case 'join':
        await handleJoinSession(interaction, session, sessionId, client);
        break;
      case 'leave':
        await handleLeaveSession(interaction, session, sessionId, client);
        break;
      case 'ready':
        await handleReadyUp(interaction, session, sessionId, client);
        break;
      case 'complete':
        await handleRunComplete(interaction, session, sessionId, client);
        break;
      case 'voice':
        await handleCreateVoice(interaction, session, sessionId, client);
        break;
      case 'end':
        await handleEndSession(interaction, session, sessionId, client);
        break;
    }
  } catch (error) {
    console.error('[CAYO LFG] Button error:', error);
    interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
  }
}

async function handleB2BToggle(interaction, session, sessionId) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the host can change settings.', ephemeral: true });
  }
  
  session.b2b = !session.b2b;
  
  const components = interaction.message.components.map(row => {
    const newRow = ActionRowBuilder.from(row);
    newRow.components = row.components.map(component => {
      if (component.customId === `cayo_b2b_${sessionId}`) {
        return ButtonBuilder.from(component)
          .setLabel(`B2B: ${session.b2b ? 'ON' : 'OFF'}`)
          .setStyle(session.b2b ? ButtonStyle.Success : ButtonStyle.Secondary);
      }
      return component;
    });
    return newRow;
  });
  
  await interaction.update({ components });
}

async function handleStartRecruiting(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the host can start recruiting.', ephemeral: true });
  }
  
  if (!session.target || !session.approach) {
    return interaction.reply({ content: '❌ Please select a target and approach first!', ephemeral: true });
  }
  
  session.status = 'recruiting';
  session.startedAt = Date.now();
  
  const embed = await createRecruitingEmbed(session, interaction.guild);
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
  
  // Notify in channel
  await interaction.channel.send({
    content: `🏝️ **CAYO HEIST OPEN!** ${CAYO_CONFIG.targets[session.target].emoji} ${CAYO_CONFIG.targets[session.target].name} | ${session.platform} | Click below to join!`,
    allowedMentions: { parse: [] }
  });
}

async function handleCancelSession(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the host can cancel.', ephemeral: true });
  }
  
  await cleanupSession(session, client);
  activeSessions.delete(sessionId);
  
  const embed = new EmbedBuilder()
    .setTitle('❌ Heist Cancelled')
    .setDescription('The host cancelled this session.')
    .setColor(0xFF0000);
  
  await interaction.update({ embeds: [embed], components: [] });
}

async function handleJoinSession(interaction, session, sessionId, client) {
  const odIdFinal = interaction.user.id;
  const odIdActual = odIdFinal;
  const userId = odIdActual;
  
  // Check if already in session
  if (session.players.find(p => p.userId === userId)) {
    return interaction.reply({ content: '❌ You\'re already in this session!', ephemeral: true });
  }
  
  // Check platform match
  const member = await interaction.guild.members.fetch(userId);
  const isPS5 = member.roles.cache.some(r => r.name.includes('PS5') || r.name.includes('Primary: PS5'));
  const isPS4 = member.roles.cache.some(r => r.name.includes('PS4') || r.name.includes('Primary: PS4'));
  const userPlatform = isPS5 ? 'PS5' : isPS4 ? 'PS4' : 'Unknown';
  
  if (session.platform !== 'Unknown' && userPlatform !== 'Unknown' && session.platform !== userPlatform) {
    return interaction.reply({ 
      content: `❌ Platform mismatch! This session is for **${session.platform}** players only.`, 
      ephemeral: true 
    });
  }
  
  // Check max players
  if (session.players.length >= CAYO_CONFIG.maxPlayers) {
    return interaction.reply({ content: '❌ Session is full!', ephemeral: true });
  }
  
  // Add player
  session.players.push({
    userId: userId,
    name: interaction.user.username
  });
  
  // Update embed
  const embed = await createRecruitingEmbed(session, interaction.guild);
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
  
  // Notify
  await interaction.channel.send({
    content: `✅ **${interaction.user.username}** joined the heist! (${session.players.length}/${CAYO_CONFIG.maxPlayers})`,
    allowedMentions: { parse: [] }
  });
}

async function handleLeaveSession(interaction, session, sessionId, client) {
  const odIdFinal = interaction.user.id;
  const odIdActual = odIdFinal;
  const userId = odIdActual;
  
  // Host can't leave, must cancel
  if (userId === session.host) {
    return interaction.reply({ content: '❌ You\'re the host! Use "End Session" to close.', ephemeral: true });
  }
  
  // Find and remove player
  const playerIndex = session.players.findIndex(p => p.userId === userId);
  if (playerIndex === -1) {
    return interaction.reply({ content: '❌ You\'re not in this session.', ephemeral: true });
  }
  
  session.players.splice(playerIndex, 1);
  
  // Update embed
  const embed = await createRecruitingEmbed(session, interaction.guild);
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
}

async function handleReadyUp(interaction, session, sessionId, client) {
  if (session.players.length < CAYO_CONFIG.minPlayers) {
    return interaction.reply({ content: `❌ Need at least ${CAYO_CONFIG.minPlayers} players!`, ephemeral: true });
  }
  
  session.status = 'in_progress';
  
  const embed = await createRecruitingEmbed(session, interaction.guild);
  embed.setTitle('🏝️ CAYO PERICO HEIST - IN PROGRESS');
  embed.setColor(0x00FF00);
  
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
  
  // Ping all players
  const mentions = session.players.map(p => `<@${p.userId}>`).join(' ');
  await interaction.channel.send({
    content: `🚀 **HEIST STARTING!** ${mentions}\n\nGood luck, Kapitan! 🏝️`
  });
}

async function handleRunComplete(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the host can mark runs complete.', ephemeral: true });
  }
  
  const payout = CAYO_CONFIG.targets[session.target].payout;
  session.runsCompleted++;
  session.totalEarnings += payout;
  
  // Update embed
  const embed = await createRecruitingEmbed(session, interaction.guild);
  embed.setTitle('🏝️ CAYO PERICO HEIST - IN PROGRESS');
  embed.setColor(0x00FF00);
  
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
  
  // Record to database
  await recordCompletion(session, client);
  
  await interaction.channel.send({
    content: `💰 **RUN #${session.runsCompleted} COMPLETE!**\n+$${payout.toLocaleString()} | Total: $${session.totalEarnings.toLocaleString()}`,
    allowedMentions: { parse: [] }
  });
}

async function handleCreateVoice(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the host can create voice channels.', ephemeral: true });
  }
  
  try {
    // Find the GTA category
    const category = interaction.guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('gta')
    );
    
    // Create voice channel
    const voiceChannel = await interaction.guild.channels.create({
      name: `🏝️ Cayo - ${session.hostName}`,
      type: ChannelType.GuildVoice,
      parent: category?.id,
      userLimit: CAYO_CONFIG.maxPlayers,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.Connect]
        },
        ...session.players.map(p => ({
          id: p.userId,
          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
        }))
      ]
    });
    
    session.voiceChannel = voiceChannel.id;
    
    // Update embed
    const embed = await createRecruitingEmbed(session, interaction.guild);
    const components = createRecruitingComponents(sessionId, session);
    
    await interaction.update({ embeds: [embed], components });
    
    await interaction.channel.send({
      content: `🔊 Voice channel created! <#${voiceChannel.id}>`,
      allowedMentions: { parse: [] }
    });
    
  } catch (error) {
    console.error('[CAYO LFG] Voice channel error:', error);
    await interaction.reply({ content: '❌ Failed to create voice channel.', ephemeral: true });
  }
}

async function handleEndSession(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the host can end the session.', ephemeral: true });
  }
  
  session.status = 'completed';
  
  await cleanupSession(session, client);
  activeSessions.delete(sessionId);
  userCooldowns.set(session.host, Date.now());
  
  const embed = new EmbedBuilder()
    .setTitle('✅ HEIST SESSION COMPLETE')
    .setDescription(`
**Host:** ${session.hostName}
**Runs Completed:** ${session.runsCompleted}
**Total Earnings:** $${session.totalEarnings.toLocaleString()}
**Players:** ${session.players.map(p => p.name).join(', ')}
    `)
    .setColor(0x00FF00)
    .setFooter({ text: 'Thanks for using Pavel\'s LFG system!' })
    .setTimestamp();
  
  await interaction.update({ embeds: [embed], components: [] });
}

// ============================================
// SELECT MENU HANDLERS
// ============================================

async function handleSelectMenu(interaction, client) {
  const customId = interaction.customId;
  
  if (!customId.startsWith('cayo_')) return;
  
  const parts = customId.split('_');
  const type = parts[1]; // target, approach, secondary
  const sessionId = parts.slice(2).join('_');
  
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return interaction.reply({ content: '❌ Session not found or expired.', ephemeral: true });
  }
  
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the host can change settings.', ephemeral: true });
  }
  
  const value = interaction.values[0];
  
  switch (type) {
    case 'target':
      session.target = value;
      break;
    case 'approach':
      session.approach = value;
      break;
    case 'secondary':
      session.secondary = value;
      break;
  }
  
  const embed = await createSetupEmbed(session, interaction.guild);
  await interaction.update({ embeds: [embed] });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function cleanupSession(session, client) {
  // Delete voice channel if exists
  if (session.voiceChannel) {
    try {
      const channel = await client.channels.fetch(session.voiceChannel);
      if (channel) {
        await channel.delete();
      }
    } catch (e) {
      // Channel may already be deleted
    }
  }
}

function checkSessionTimeouts(client) {
  const now = Date.now();
  
  for (const [sessionId, session] of activeSessions) {
    if (now - session.createdAt > CAYO_CONFIG.sessionTimeout) {
      cleanupSession(session, client);
      activeSessions.delete(sessionId);
      console.log(`[CAYO LFG] Session ${sessionId} timed out`);
    }
  }
}

async function recordCompletion(session, client) {
  try {
    await client.db.query(
      `INSERT INTO cayo_completions (session_id, host_id, players, target, payout, completed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        session.id,
        session.host,
        JSON.stringify(session.players.map(p => p.odIdActual)),
        session.target,
        CAYO_CONFIG.targets[session.target].payout
      ]
    );
  } catch (e) {
    console.error('[CAYO LFG] Failed to record completion:', e);
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

// ============================================
// DATABASE SETUP
// ============================================

async function createTables(client) {
  try {
    await client.db.query(`
      CREATE TABLE IF NOT EXISTS cayo_completions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(64),
        host_id VARCHAR(32),
        players JSONB,
        target VARCHAR(32),
        payout INTEGER,
        completed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.db.query(`CREATE INDEX IF NOT EXISTS idx_cayo_host ON cayo_completions(host_id)`);
  } catch (e) {
    console.error('[CAYO LFG] Table creation error:', e);
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  initialize,
  createSession,
  createTables,
  CAYO_CONFIG
};
