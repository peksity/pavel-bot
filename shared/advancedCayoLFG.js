/**
 * ██████╗ █████╗ ██╗   ██╗ ██████╗     ██╗     ███████╗ ██████╗ 
 * ██╔════╝██╔══██╗╚██╗ ██╔╝██╔═══██╗    ██║     ██╔════╝██╔════╝ 
 * ██║     ███████║ ╚████╔╝ ██║   ██║    ██║     █████╗  ██║  ███╗
 * ██║     ██╔══██║  ╚██╔╝  ██║   ██║    ██║     ██╔══╝  ██║   ██║
 * ╚██████╗██║  ██║   ██║   ╚██████╔╝    ███████╗██║     ╚██████╔╝
 *  ╚═════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝     ╚══════╝╚═╝      ╚═════╝ 
 * 
 * ADVANCED CAYO PERICO LFG SYSTEM v2
 * - 4 players max (1 leader + 3 crew)
 * - Host can kick players
 * - Blacklist per session
 * - DM notifications
 * - Detailed descriptions
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
// CAYO CONFIGURATION
// ============================================

const CAYO_CONFIG = {
  // Primary Targets with descriptions
  targets: {
    'pink_diamond': { 
      name: '💎 Pink Diamond', 
      payout: 1430000, 
      description: 'BEST TARGET! Highest payout. Very rare spawn.'
    },
    'bearer_bonds': { 
      name: '📜 Bearer Bonds', 
      payout: 1210000, 
      description: 'Second best payout. Common spawn.'
    },
    'ruby_necklace': { 
      name: '💍 Ruby Necklace', 
      payout: 1100000, 
      description: 'Good payout. Moderate spawn rate.'
    },
    'madrazo_files': { 
      name: '📁 Madrazo Files', 
      payout: 1210000, 
      description: 'First heist only. Same as Bearer Bonds.'
    },
    'tequila': { 
      name: '🍾 Sinsimito Tequila', 
      payout: 990000, 
      description: 'Lowest payout. Most common spawn.'
    }
  },
  
  // Approaches with descriptions
  approaches: {
    'drainage': { 
      name: '🚿 Drainage Tunnel', 
      description: 'FASTEST! Swim in through drainage pipe. Requires Cutting Torch.'
    },
    'main_dock': { 
      name: '🚢 Main Dock', 
      description: 'Boat approach to main dock. Good for grab & go.'
    },
    'north_dock': { 
      name: '⚓ North Dock', 
      description: 'Stealth approach from north. Less guards.'
    },
    'airstrip': { 
      name: '✈️ Airstrip', 
      description: 'Fly in via Velum. Land at airstrip.'
    },
    'halo_jump': { 
      name: '🪂 HALO Jump', 
      description: 'Parachute anywhere on island. Maximum flexibility.'
    }
  },
  
  // Secondary loot with descriptions
  secondary: {
    'gold': { 
      name: '🥇 Gold', 
      description: 'BEST! $330k per stack. Requires 2 players to grab.'
    },
    'cocaine': { 
      name: '❄️ Cocaine', 
      description: 'Second best. $220k per stack. Solo friendly.'
    },
    'weed': { 
      name: '🌿 Weed', 
      description: 'Good value. $150k per stack. Common spawn.'
    },
    'cash': { 
      name: '💵 Cash', 
      description: 'Lowest value. $90k per stack. Avoid if possible.'
    }
  },
  
  // Session settings - 4 PLAYERS MAX (1 leader + 3 crew)
  minPlayers: 2,
  maxPlayers: 4,
  sessionTimeout: 30 * 60 * 1000,
  voiceChannelTimeout: 10 * 60 * 1000
};

// Active sessions storage
const activeSessions = new Map();
const userCooldowns = new Map();
const kickedUsers = new Map();

// ============================================
// INITIALIZE LFG SYSTEM
// ============================================

function initialize(client) {
  console.log('[CAYO LFG] Initializing advanced Cayo LFG system v2...');
  
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
      await handleButton(interaction, client);
    }
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction, client);
    }
  });
  
  setInterval(() => checkSessionTimeouts(client), 60000);
  
  console.log('[CAYO LFG] ✅ Advanced Cayo LFG v2 initialized (1 leader + 3 crew)');
}

// ============================================
// CREATE NEW SESSION
// ============================================

async function createSession(message, client) {
  const userId = message.author.id;
  const guild = message.guild;
  
  // Check cooldown
  const cooldown = userCooldowns.get(userId);
  if (cooldown && Date.now() - cooldown < 5 * 60 * 1000) {
    const remaining = Math.ceil((5 * 60 * 1000 - (Date.now() - cooldown)) / 1000);
    return message.reply(`⏳ Kapitan, wait ${remaining} seconds before hosting another heist.`);
  }
  
  // Check existing session
  for (const [sessionId, session] of activeSessions) {
    if (session.host === userId) {
      return message.reply(`❌ You already have an active heist! Use Cancel or wait for it to expire.`);
    }
  }
  
  // Get platform
  const member = await guild.members.fetch(userId);
  const isPS5 = member.roles.cache.some(r => r.name.includes('PS5') || r.name.includes('Primary: PS5'));
  const isPS4 = member.roles.cache.some(r => r.name.includes('PS4') || r.name.includes('Primary: PS4'));
  const platform = isPS5 ? 'PS5' : isPS4 ? 'PS4' : 'Unknown';
  
  const sessionId = `cayo_${Date.now()}_${userId}`;
  
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
    status: 'setup',
    voiceChannel: null,
    messageId: null,
    channelId: message.channel.id,
    createdAt: Date.now(),
    startedAt: null,
    totalEarnings: 0,
    runsCompleted: 0
  };
  
  kickedUsers.set(sessionId, new Set());
  
  const setupEmbed = createSetupEmbed(session);
  const setupComponents = createSetupComponents(sessionId, session);
  
  const msg = await message.channel.send({ 
    embeds: [setupEmbed], 
    components: setupComponents 
  });
  
  session.messageId = msg.id;
  activeSessions.set(sessionId, session);
  
  return session;
}

// ============================================
// SETUP EMBED
// ============================================

function createSetupEmbed(session) {
  const targetInfo = session.target ? CAYO_CONFIG.targets[session.target] : null;
  const approachInfo = session.approach ? CAYO_CONFIG.approaches[session.approach] : null;
  const secondaryInfo = session.secondary ? CAYO_CONFIG.secondary[session.secondary] : null;
  
  const embed = new EmbedBuilder()
    .setTitle('🏝️ CAYO PERICO HEIST - SETUP')
    .setDescription(
      `**Host:** ${session.hostName}\n` +
      `**Platform:** ${session.platform}\n\n` +
      `*Configure your heist below, Kapitan*`
    )
    .addFields(
      { 
        name: '🎯 Primary Target', 
        value: targetInfo 
          ? `${targetInfo.name} ($${targetInfo.payout.toLocaleString()})\n*${targetInfo.description}*` 
          : '❓ Not selected', 
        inline: false 
      },
      { 
        name: '🚀 Approach', 
        value: approachInfo 
          ? `${approachInfo.name}\n*${approachInfo.description}*` 
          : '❓ Not selected', 
        inline: false 
      },
      { 
        name: '💰 Secondary Loot', 
        value: secondaryInfo 
          ? `${secondaryInfo.name}\n*${secondaryInfo.description}*` 
          : '❓ Not selected', 
        inline: false 
      },
      {
        name: '🔄 B2B Mode',
        value: session.b2b 
          ? '✅ **ON** - Run heists back-to-back for maximum profit!' 
          : '❌ OFF - Single heist run',
        inline: false
      }
    )
    .setColor(0x00D4FF)
    .setFooter({ text: 'Select your options, then click "Start Recruiting"' })
    .setTimestamp();
  
  return embed;
}

// ============================================
// RECRUITING EMBED
// ============================================

function createRecruitingEmbed(session) {
  const targetInfo = CAYO_CONFIG.targets[session.target];
  const approachInfo = CAYO_CONFIG.approaches[session.approach];
  
  // Build player list (4 slots - 1 leader + 3 crew)
  let playerList = '';
  for (let i = 0; i < CAYO_CONFIG.maxPlayers; i++) {
    if (session.players[i]) {
      const player = session.players[i];
      const isHost = player.userId === session.host;
      playerList += `${i + 1}. ${isHost ? '👑' : '🎮'} **${player.name}** ${isHost ? '(Leader)' : ''}\n`;
    } else {
      playerList += `${i + 1}. ⬜ *Open Slot*\n`;
    }
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🏝️ CAYO PERICO HEIST - RECRUITING')
    .setDescription(
      `**Host:** ${session.hostName} | **Platform:** ${session.platform}\n\n` +
      `${targetInfo.name} • ${approachInfo.name} • ${session.b2b ? 'B2B: ON' : 'Single Run'}`
    )
    .addFields(
      { name: '👥 Crew (1 Leader + 3)', value: playerList, inline: true },
      { name: '📊 Info', value: 
        `Slots: ${session.players.length}/${CAYO_CONFIG.maxPlayers}\n` +
        `Per Run: $${targetInfo.payout.toLocaleString()}\n` +
        `Status: ${session.status === 'in_progress' ? '🟢 IN PROGRESS' : '🟡 RECRUITING'}`,
        inline: true 
      }
    )
    .setColor(session.status === 'in_progress' ? 0x00FF00 : 0x00D4FF)
    .setFooter({ text: `Session ID: ${session.id.slice(-8)} • Click Join to hop in!` })
    .setTimestamp();
  
  if (session.runsCompleted > 0) {
    embed.addFields({
      name: '💰 Earnings',
      value: `Runs: ${session.runsCompleted} | Total: $${session.totalEarnings.toLocaleString()}`,
      inline: false
    });
  }
  
  return embed;
}

// ============================================
// SETUP COMPONENTS
// ============================================

function createSetupComponents(sessionId, session) {
  // Target Dropdown with descriptions
  const targetSelect = new StringSelectMenuBuilder()
    .setCustomId(`cayo_target_${sessionId}`)
    .setPlaceholder('🎯 Select Primary Target')
    .addOptions([
      { label: 'Pink Diamond', description: '$1.43M - BEST! Very rare.', value: 'pink_diamond', emoji: '💎' },
      { label: 'Bearer Bonds', description: '$1.21M - Second best. Common.', value: 'bearer_bonds', emoji: '📜' },
      { label: 'Ruby Necklace', description: '$1.1M - Good payout.', value: 'ruby_necklace', emoji: '💍' },
      { label: 'Madrazo Files', description: '$1.21M - First heist only.', value: 'madrazo_files', emoji: '📁' },
      { label: 'Sinsimito Tequila', description: '$990K - Lowest. Most common.', value: 'tequila', emoji: '🍾' }
    ]);
  
  // Approach Dropdown with descriptions
  const approachSelect = new StringSelectMenuBuilder()
    .setCustomId(`cayo_approach_${sessionId}`)
    .setPlaceholder('🚀 Select Approach')
    .addOptions([
      { label: 'Drainage Tunnel', description: 'FASTEST! Requires Cutting Torch.', value: 'drainage', emoji: '🚿' },
      { label: 'Main Dock', description: 'Boat approach. Quick exit.', value: 'main_dock', emoji: '🚢' },
      { label: 'North Dock', description: 'Stealth from north.', value: 'north_dock', emoji: '⚓' },
      { label: 'Airstrip', description: 'Fly in via Velum.', value: 'airstrip', emoji: '✈️' },
      { label: 'HALO Jump', description: 'Parachute anywhere.', value: 'halo_jump', emoji: '🪂' }
    ]);
  
  // Secondary Dropdown with descriptions
  const secondarySelect = new StringSelectMenuBuilder()
    .setCustomId(`cayo_secondary_${sessionId}`)
    .setPlaceholder('💰 Select Secondary Loot Priority')
    .addOptions([
      { label: 'Gold', description: '$330K/stack - BEST! Needs 2 players.', value: 'gold', emoji: '🥇' },
      { label: 'Cocaine', description: '$220K/stack - Great. Solo friendly.', value: 'cocaine', emoji: '❄️' },
      { label: 'Weed', description: '$150K/stack - Good. Common.', value: 'weed', emoji: '🌿' },
      { label: 'Cash', description: '$90K/stack - Lowest. Avoid.', value: 'cash', emoji: '💵' }
    ]);
  
  // Buttons
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cayo_b2b_${sessionId}`)
      .setLabel(session.b2b ? 'B2B: ON' : 'B2B: OFF')
      .setStyle(session.b2b ? ButtonStyle.Success : ButtonStyle.Secondary)
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
// RECRUITING COMPONENTS
// ============================================

function createRecruitingComponents(sessionId, session) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cayo_join_${sessionId}`)
      .setLabel('Join Heist')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎮'),
    new ButtonBuilder()
      .setCustomId(`cayo_leave_${sessionId}`)
      .setLabel('Leave')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚪'),
    new ButtonBuilder()
      .setCustomId(`cayo_voice_${sessionId}`)
      .setLabel('Create Voice')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔊')
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cayo_ready_${sessionId}`)
      .setLabel('Start Heist')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🚀'),
    new ButtonBuilder()
      .setCustomId(`cayo_complete_${sessionId}`)
      .setLabel('Complete')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`cayo_end_${sessionId}`)
      .setLabel('End Session')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🛑')
  );
  
  // Host-only: Kick player dropdown
  if (session.players.length > 1) {
    const kickOptions = session.players
      .filter(p => p.userId !== session.host)
      .map(p => ({
        label: `Kick ${p.name}`,
        value: p.userId,
        emoji: '👢'
      }));
    
    if (kickOptions.length > 0) {
      const kickSelect = new StringSelectMenuBuilder()
        .setCustomId(`cayo_kick_${sessionId}`)
        .setPlaceholder('👢 Kick a player (Leader only)')
        .addOptions(kickOptions);
      
      return [row1, row2, new ActionRowBuilder().addComponents(kickSelect)];
    }
  }
  
  return [row1, row2];
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
    return interaction.reply({ content: '❌ Session expired or not found.', ephemeral: true });
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
      case 'voice':
        await handleCreateVoice(interaction, session, sessionId, client);
        break;
      case 'ready':
        await handleReadyUp(interaction, session, sessionId, client);
        break;
      case 'complete':
        await handleRunComplete(interaction, session, sessionId, client);
        break;
      case 'end':
        await handleEndSession(interaction, session, sessionId, client);
        break;
    }
  } catch (error) {
    console.error('[CAYO LFG] Button error:', error);
    interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
  }
}

// ============================================
// SELECT MENU HANDLERS
// ============================================

async function handleSelectMenu(interaction, client) {
  const customId = interaction.customId;
  if (!customId.startsWith('cayo_')) return;
  
  const parts = customId.split('_');
  const type = parts[1];
  const sessionId = parts.slice(2).join('_');
  
  const session = activeSessions.get(sessionId);
  if (!session) {
    return interaction.reply({ content: '❌ Session expired or not found.', ephemeral: true });
  }
  
  // Kick handler
  if (type === 'kick') {
    await handleKickPlayer(interaction, session, sessionId, client);
    return;
  }
  
  // Only host can change settings
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the leader can change settings.', ephemeral: true });
  }
  
  const value = interaction.values[0];
  
  if (type === 'target') {
    session.target = value;
  } else if (type === 'approach') {
    session.approach = value;
  } else if (type === 'secondary') {
    session.secondary = value;
  }
  
  const embed = createSetupEmbed(session);
  const components = createSetupComponents(sessionId, session);
  await interaction.update({ embeds: [embed], components });
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handleB2BToggle(interaction, session, sessionId) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the leader can change settings.', ephemeral: true });
  }
  
  session.b2b = !session.b2b;
  
  const embed = createSetupEmbed(session);
  const components = createSetupComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
}

async function handleStartRecruiting(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the leader can start recruiting.', ephemeral: true });
  }
  
  if (!session.target || !session.approach) {
    return interaction.reply({ content: '❌ Please select a target and approach first!', ephemeral: true });
  }
  
  session.status = 'recruiting';
  session.startedAt = Date.now();
  
  const embed = createRecruitingEmbed(session);
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
  
  const targetInfo = CAYO_CONFIG.targets[session.target];
  await interaction.channel.send({
    content: `🏝️ **CAYO HEIST OPEN!** ${session.platform} | ${targetInfo.name} | ${session.b2b ? 'B2B' : 'Single'} | Click Join below!`
  });
}

async function handleJoinSession(interaction, session, sessionId, client) {
  const userId = interaction.user.id;
  
  // Check if kicked
  const kicked = kickedUsers.get(sessionId);
  if (kicked && kicked.has(userId)) {
    return interaction.reply({ 
      content: '❌ You were removed from this heist by the leader. Wait for the next `?cayo` command.', 
      ephemeral: true 
    });
  }
  
  // Check if already in session
  if (session.players.some(p => p.userId === userId)) {
    return interaction.reply({ content: '❌ You\'re already in this heist!', ephemeral: true });
  }
  
  // Check if full
  if (session.players.length >= CAYO_CONFIG.maxPlayers) {
    return interaction.reply({ content: '❌ Heist is full! (4 max)', ephemeral: true });
  }
  
  // Check for required role
  const member = interaction.member;
  const requiredRoles = ['Cayo Grinder', 'Los Santos Hustler', '💰 Los Santos Hustler', '🏝️ Cayo Grinder'];
  const hasRole = member.roles.cache.some(r => requiredRoles.some(req => r.name.includes(req)));
  
  if (!hasRole) {
    try {
      const rolesChannel = interaction.guild.channels.cache.find(c => c.name === 'roles' || c.name === 'get-roles');
      await interaction.user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🏝️ Cayo LFG - Role Required')
            .setDescription(
              `Kapitan! You need the **Cayo Grinder** or **Los Santos Hustler** role to join heists.\n\n` +
              `${rolesChannel ? `Head to <#${rolesChannel.id}> to get your roles!` : 'Check the roles channel in the server.'}`
            )
            .setColor(0xFF6B6B)
        ]
      });
    } catch (e) {}
    
    return interaction.reply({ 
      content: '❌ You need the **Cayo Grinder** or **Los Santos Hustler** role! Check your DMs.', 
      ephemeral: true 
    });
  }
  
  session.players.push({ userId: userId, name: interaction.user.username });
  
  const embed = createRecruitingEmbed(session);
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
  
  await interaction.channel.send({
    content: `🎮 **${interaction.user.username}** joined the heist! (${session.players.length}/${CAYO_CONFIG.maxPlayers})`
  });
}

async function handleLeaveSession(interaction, session, sessionId, client) {
  const userId = interaction.user.id;
  
  if (userId === session.host) {
    return interaction.reply({ content: '❌ As leader, use "End Session" to close the heist.', ephemeral: true });
  }
  
  const playerIndex = session.players.findIndex(p => p.userId === userId);
  if (playerIndex === -1) {
    return interaction.reply({ content: '❌ You\'re not in this heist.', ephemeral: true });
  }
  
  session.players.splice(playerIndex, 1);
  
  const embed = createRecruitingEmbed(session);
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
}

async function handleKickPlayer(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the leader can kick players.', ephemeral: true });
  }
  
  const kickUserId = interaction.values[0];
  
  const playerIndex = session.players.findIndex(p => p.userId === kickUserId);
  if (playerIndex === -1) {
    return interaction.reply({ content: '❌ Player not found.', ephemeral: true });
  }
  
  const kickedPlayer = session.players[playerIndex];
  session.players.splice(playerIndex, 1);
  
  const kicked = kickedUsers.get(sessionId);
  if (kicked) kicked.add(kickUserId);
  
  try {
    const kickedMember = await interaction.guild.members.fetch(kickUserId);
    await kickedMember.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🏝️ Removed from Cayo Heist')
          .setDescription(
            `You were removed from **${session.hostName}**'s heist.\n\n` +
            `Wait for the next \`?cayo\` command to join a new one.`
          )
          .setColor(0xFF6B6B)
      ]
    });
  } catch (e) {}
  
  const embed = createRecruitingEmbed(session);
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
  
  await interaction.channel.send({
    content: `👢 **${kickedPlayer.name}** was removed from the heist by the leader.`
  });
}

async function handleCreateVoice(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the leader can create voice channels.', ephemeral: true });
  }
  
  if (session.voiceChannel) {
    return interaction.reply({ content: `🔊 Voice already exists: <#${session.voiceChannel}>`, ephemeral: true });
  }
  
  try {
    const category = interaction.guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('gta')
    );
    
    const voiceChannel = await interaction.guild.channels.create({
      name: `🏝️ Cayo - ${session.hostName}`,
      type: ChannelType.GuildVoice,
      parent: category?.id,
      userLimit: CAYO_CONFIG.maxPlayers
    });
    
    session.voiceChannel = voiceChannel.id;
    
    const embed = createRecruitingEmbed(session);
    const components = createRecruitingComponents(sessionId, session);
    
    await interaction.update({ embeds: [embed], components });
    
    await interaction.channel.send({ content: `🔊 Voice channel created! <#${voiceChannel.id}>` });
  } catch (error) {
    console.error('[CAYO LFG] Voice error:', error);
    await interaction.reply({ content: '❌ Failed to create voice channel.', ephemeral: true });
  }
}

async function handleReadyUp(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the leader can start.', ephemeral: true });
  }
  
  if (session.players.length < CAYO_CONFIG.minPlayers) {
    return interaction.reply({ content: `❌ Need at least ${CAYO_CONFIG.minPlayers} players!`, ephemeral: true });
  }
  
  session.status = 'in_progress';
  
  const embed = createRecruitingEmbed(session);
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
  
  const mentions = session.players.map(p => `<@${p.userId}>`).join(' ');
  await interaction.channel.send({
    content: `🚀 **HEIST STARTING!** ${mentions}\n\nGood luck, Kapitan! 🏝️`
  });
}

async function handleRunComplete(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the leader can mark complete.', ephemeral: true });
  }
  
  const payout = CAYO_CONFIG.targets[session.target].payout;
  session.runsCompleted++;
  session.totalEarnings += payout;
  
  const embed = createRecruitingEmbed(session);
  const components = createRecruitingComponents(sessionId, session);
  
  await interaction.update({ embeds: [embed], components });
  
  await interaction.channel.send({
    content: `💰 **RUN #${session.runsCompleted} COMPLETE!** +$${payout.toLocaleString()} | Total: $${session.totalEarnings.toLocaleString()}`
  });
}

async function handleCancelSession(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the leader can cancel.', ephemeral: true });
  }
  
  await cleanupSession(session, client);
  activeSessions.delete(sessionId);
  kickedUsers.delete(sessionId);
  
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle('❌ Heist Cancelled')
        .setDescription(`**${session.hostName}** cancelled the heist.`)
        .setColor(0xFF0000)
    ],
    components: []
  });
}

async function handleEndSession(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.host) {
    return interaction.reply({ content: '❌ Only the leader can end.', ephemeral: true });
  }
  
  userCooldowns.set(session.host, Date.now());
  
  await cleanupSession(session, client);
  activeSessions.delete(sessionId);
  kickedUsers.delete(sessionId);
  
  const embed = new EmbedBuilder()
    .setTitle('🏝️ Cayo Heist Complete!')
    .setDescription(`**Leader:** ${session.hostName}`)
    .addFields(
      { name: '💰 Total Earnings', value: `$${session.totalEarnings.toLocaleString()}`, inline: true },
      { name: '🔄 Runs', value: `${session.runsCompleted}`, inline: true },
      { name: '👥 Crew', value: session.players.map(p => p.name).join(', '), inline: false }
    )
    .setColor(0x00FF00)
    .setTimestamp();
  
  await interaction.update({ embeds: [embed], components: [] });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function cleanupSession(session, client) {
  if (session.voiceChannel) {
    try {
      const channel = await client.channels.fetch(session.voiceChannel);
      if (channel) await channel.delete();
    } catch (e) {}
  }
}

function checkSessionTimeouts(client) {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions) {
    if (now - session.createdAt > CAYO_CONFIG.sessionTimeout) {
      cleanupSession(session, client);
      activeSessions.delete(sessionId);
      kickedUsers.delete(sessionId);
    }
  }
}

async function createTables(client) {
  console.log('[CAYO LFG] Using in-memory session storage');
}

module.exports = {
  initialize,
  createSession,
  createTables
};
