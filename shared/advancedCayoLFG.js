/**
 * ADVANCED CAYO PERICO LFG - GTA 6 EDITION
 * Features: Accurate payouts, heist counter, crew size calculations, in-channel setup
 */

const { 
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, 
  TextInputStyle, ChannelType
} = require('discord.js');

const COLORS = { vice_pink: 0xFF0080, vice_teal: 0x00D4AA, gold: 0xFFD700, success: 0x00FF88, danger: 0xFF3366 };

// Primary targets (Hard Mode values)
const TARGETS = {
  pink_diamond: { name: 'Pink Diamond', emoji: '💎', value: 1430000, rarity: 'BEST' },
  bearer_bonds: { name: 'Bearer Bonds', emoji: '📜', value: 1210000, rarity: 'GREAT' },
  ruby_necklace: { name: 'Ruby Necklace', emoji: '📿', value: 1100000, rarity: 'GOOD' },
  tequila: { name: 'Sinsimito Tequila', emoji: '🍾', value: 990000, rarity: 'COMMON' }
};

// Secondary loot values
const SECONDARY_LOOT = {
  gold: { name: 'Gold', emoji: '🥇', value: 500000, note: '⚠️ Requires 2+ players' },
  cocaine: { name: 'Cocaine', emoji: '🧊', value: 220000, note: 'Best solo option' },
  weed: { name: 'Weed', emoji: '🌿', value: 150000, note: 'Common' },
  cash: { name: 'Cash', emoji: '💵', value: 90000, note: 'Worst option' }
};

const APPROACHES = {
  drainage: { name: 'Drainage Tunnel', emoji: '🚇', difficulty: 'EASY', stealth: true, recommended: true },
  main_dock: { name: 'Main Dock', emoji: '⚓', difficulty: 'MEDIUM', stealth: true },
  airstrip: { name: 'Airstrip', emoji: '✈️', difficulty: 'MEDIUM', stealth: false },
  halo_jump: { name: 'HALO Jump', emoji: '🪂', difficulty: 'HARD', stealth: true }
};

const PLATFORMS = {
  ps5: { name: 'PlayStation 5 (Enhanced)', short: 'PS5' },
  ps4: { name: 'PlayStation 4', short: 'PS4' },
  crossgen: { name: 'Cross-Gen', short: 'CROSS' }
};

// Payout calculations by crew size (after fencing fees ~10%)
const CREW_PAYOUTS = {
  2: { maxTake: 2400000, realistic: 2000000, hostPercent: 55, crewPercent: 45 },
  3: { maxTake: 3400000, realistic: 2700000, hostPercent: 40, crewPercent: 30 },
  4: { maxTake: 4100000, realistic: 3200000, hostPercent: 30, crewPercent: 23 }
};

let pool = null;
let blacklistSystem = null;
const activeSessions = new Map();
const setupSessions = new Map();

function initialize(client, dbPool) {
  pool = dbPool;
  try {
    const { getBlacklistSystem } = require('./blacklistSystem');
    blacklistSystem = getBlacklistSystem(pool);
    blacklistSystem.initialize();
  } catch (e) {}
  client.on('interactionCreate', handleInteraction);
  console.log('[CAYO LFG] ✅ Initialized with accurate payouts');
}

async function createSession(message, client) {
  const userId = message.author.id;
  if (activeSessions.has(userId)) {
    const reply = await message.reply('❌ You already have an active heist.');
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  await message.delete().catch(() => {});

  const setupId = `cayo_setup_${userId}_${Date.now()}`;
  setupSessions.set(setupId, {
    hostId: userId, hostUsername: message.author.username,
    channelId: message.channel.id, guildId: message.guild.id,
    step: 1, data: {}, messageId: null
  });

  const setupMsg = await message.channel.send({
    content: `<@${userId}> **Setting up your heist...** *(only you can interact)*`,
    embeds: [createSetupEmbed(1, {})],
    components: [createPlatformSelect(setupId)]
  });
  
  setupSessions.get(setupId).messageId = setupMsg.id;
  setTimeout(async () => {
    if (setupSessions.has(setupId)) {
      setupSessions.delete(setupId);
      await setupMsg.delete().catch(() => {});
    }
  }, 120000);
}

function createSetupEmbed(step, data) {
  const progress = '▰'.repeat(step) + '▱'.repeat(6 - step);
  const embed = new EmbedBuilder().setTitle('🏝️ CAYO PERICO HEIST SETUP').setColor(COLORS.vice_pink).setFooter({ text: `Step ${step}/6 • Setup cost: $25,000` });
  
  let desc = `\`${progress}\`\n\n`;
  
  if (step === 1) {
    desc += '**SELECT PLATFORM**\n\n⚠️ PS5 Enhanced & PS4 are on **different servers**!';
  } else if (step === 3) {
    desc += '**SELECT PRIMARY TARGET** (Hard Mode)\n\n';
    desc += '💎 **Pink Diamond** - $1.43M *(BEST)*\n';
    desc += '📜 **Bearer Bonds** - $1.21M *(GREAT)*\n';
    desc += '📿 **Ruby Necklace** - $1.10M *(GOOD)*\n';
    desc += '🍾 **Tequila** - $990K *(COMMON)*\n';
  } else if (step === 4) {
    desc += '**SELECT SECONDARY LOOT**\n\n';
    desc += '🥇 **Gold** - ~$500K/stack *(⚠️ Requires 2+ players)*\n';
    desc += '🧊 **Cocaine** - ~$220K/stack *(Best solo)*\n';
    desc += '🌿 **Weed** - ~$150K/stack\n';
    desc += '💵 **Cash** - ~$90K/stack *(Worst)*\n';
  } else if (step === 5) {
    desc += '**SELECT APPROACH**\n\n';
    desc += '🚇 **Drainage Tunnel** - EASY *(Recommended)*\n';
    desc += '⚓ **Main Dock** - MEDIUM\n';
    desc += '✈️ **Airstrip** - MEDIUM (Loud)\n';
    desc += '🪂 **HALO Jump** - HARD\n';
  } else if (step === 6) {
    const target = TARGETS[data.target];
    const secondary = SECONDARY_LOOT[data.secondary];
    const approach = APPROACHES[data.approach];
    
    desc += '**READY TO POST**\n\n';
    desc += `📍 **Platform:** ${PLATFORMS[data.platform]?.name}\n`;
    desc += `🎮 **PSN:** \`${data.psn}\`\n`;
    desc += `${target?.emoji} **Target:** ${target?.name} ($${(target?.value/1000000).toFixed(2)}M)\n`;
    desc += `${secondary?.emoji} **Secondary:** ${secondary?.name}\n`;
    desc += `${approach?.emoji} **Approach:** ${approach?.name}\n\n`;
    desc += `**💰 Estimated Payouts (2 players):**\n`;
    desc += `> Host (55%): ~$1.1M\n`;
    desc += `> Crew (45%): ~$900K\n`;
    desc += `> ⏱️ Time: 10-15 min | 💵 $4-6M/hr with B2B`;
  }
  
  embed.setDescription(desc);
  return embed;
}

function createPlatformSelect(setupId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`cayo_platform_${setupId}`).setPlaceholder('🎮 Select Platform')
      .addOptions([
        { label: 'PlayStation 5 (Enhanced)', value: 'ps5', emoji: '🎮', description: 'Next-gen version' },
        { label: 'PlayStation 4', value: 'ps4', emoji: '🎮', description: 'Last-gen version' },
        { label: 'Cross-Gen (Either)', value: 'crossgen', emoji: '🔄', description: 'Can play with both' }
      ])
  );
}

function createTargetSelect(setupId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`cayo_target_${setupId}`).setPlaceholder('💎 Select Primary Target')
      .addOptions(Object.entries(TARGETS).map(([key, t]) => ({
        label: `${t.name} - $${(t.value/1000000).toFixed(2)}M`,
        value: key, emoji: t.emoji,
        description: t.rarity
      })))
  );
}

function createSecondarySelect(setupId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`cayo_secondary_${setupId}`).setPlaceholder('🥇 Select Secondary Loot')
      .addOptions(Object.entries(SECONDARY_LOOT).map(([key, s]) => ({
        label: `${s.name} - ~$${(s.value/1000).toFixed(0)}K/stack`,
        value: key, emoji: s.emoji,
        description: s.note
      })))
  );
}

function createApproachSelect(setupId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`cayo_approach_${setupId}`).setPlaceholder('🚇 Select Approach')
      .addOptions(Object.entries(APPROACHES).map(([key, a]) => ({
        label: `${a.name} - ${a.difficulty}`,
        value: key, emoji: a.emoji,
        description: `${a.stealth ? 'Stealth' : 'Loud'}${a.recommended ? ' • Recommended' : ''}`
      })))
  );
}

function createFinalOptions(setupId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cayo_b2b_on_${setupId}`).setLabel('🔄 B2B: ON').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cayo_b2b_off_${setupId}`).setLabel('B2B: OFF').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cayo_voice_on_${setupId}`).setLabel('🔊 Voice').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cayo_start_${setupId}`).setLabel('🚀 POST HEIST').setStyle(ButtonStyle.Success)
    )
  ];
}

async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith('cayo_')) return;
  const parts = interaction.customId.split('_');
  const action = parts[1];
  
  try {
    if (action === 'platform') await handlePlatform(interaction);
    else if (action === 'target') await handleTarget(interaction);
    else if (action === 'secondary') await handleSecondary(interaction);
    else if (action === 'approach') await handleApproach(interaction);
    else if (action === 'b2b') await handleB2B(interaction, parts[2] === 'on');
    else if (action === 'voice') await handleVoice(interaction, parts[2] === 'on');
    else if (action === 'start') await handleStart(interaction);
    else if (action === 'join') await handleJoin(interaction);
    else if (action === 'leave') await handleLeave(interaction);
    else if (action === 'voicebtn') await handleVoiceBtn(interaction);
    else if (action === 'startrun') await handleStartRun(interaction);
    else if (action === 'done') await handleDone(interaction);
    else if (action === 'end') await handleEnd(interaction);
    else if (action === 'kick') await handleKick(interaction, parts[2]);
  } catch (e) { console.error('[CAYO]', e); }
}

function getSetupId(customId) { return customId.split('_').slice(2).join('_'); }
function getSessionId(customId) { return customId.split('_').slice(2).join('_'); }

async function handlePlatform(interaction) {
  const setupId = getSetupId(interaction.customId);
  const setup = setupSessions.get(setupId);
  if (!setup || setup.hostId !== interaction.user.id) return interaction.reply({ content: '❌ Not your setup.', ephemeral: true });
  
  setup.data.platform = interaction.values[0];
  
  const modal = new ModalBuilder().setCustomId(`cayo_psn_${setupId}`).setTitle('Enter PSN')
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('psn').setLabel('PSN Username').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(16)));
  await interaction.showModal(modal);
  
  try {
    const m = await interaction.awaitModalSubmit({ filter: i => i.customId === `cayo_psn_${setupId}`, time: 60000 });
    setup.data.psn = m.fields.getTextInputValue('psn');
    setup.step = 3;
    await m.update({ embeds: [createSetupEmbed(3, setup.data)], components: [createTargetSelect(setupId)] });
  } catch (e) {}
}

async function handleTarget(interaction) {
  const setupId = getSetupId(interaction.customId);
  const setup = setupSessions.get(setupId);
  if (!setup || setup.hostId !== interaction.user.id) return interaction.reply({ content: '❌ Not your setup.', ephemeral: true });
  
  setup.data.target = interaction.values[0];
  setup.step = 4;
  await interaction.update({ embeds: [createSetupEmbed(4, setup.data)], components: [createSecondarySelect(setupId)] });
}

async function handleSecondary(interaction) {
  const setupId = getSetupId(interaction.customId);
  const setup = setupSessions.get(setupId);
  if (!setup || setup.hostId !== interaction.user.id) return interaction.reply({ content: '❌ Not your setup.', ephemeral: true });
  
  setup.data.secondary = interaction.values[0];
  setup.step = 5;
  await interaction.update({ embeds: [createSetupEmbed(5, setup.data)], components: [createApproachSelect(setupId)] });
}

async function handleApproach(interaction) {
  const setupId = getSetupId(interaction.customId);
  const setup = setupSessions.get(setupId);
  if (!setup || setup.hostId !== interaction.user.id) return interaction.reply({ content: '❌ Not your setup.', ephemeral: true });
  
  setup.data.approach = interaction.values[0];
  setup.data.b2b = true; // Default to B2B ON
  setup.data.voice = false;
  setup.step = 6;
  await interaction.update({ embeds: [createSetupEmbed(6, setup.data)], components: createFinalOptions(setupId) });
}

async function handleB2B(interaction, isOn) {
  const setupId = getSetupId(interaction.customId);
  const setup = setupSessions.get(setupId);
  if (!setup || setup.hostId !== interaction.user.id) return interaction.reply({ content: '❌ Not your setup.', ephemeral: true });
  setup.data.b2b = isOn;
  await interaction.update({ embeds: [createSetupEmbed(6, setup.data)], components: createFinalOptions(setupId) });
}

async function handleVoice(interaction, isOn) {
  const setupId = getSetupId(interaction.customId);
  const setup = setupSessions.get(setupId);
  if (!setup || setup.hostId !== interaction.user.id) return interaction.reply({ content: '❌ Not your setup.', ephemeral: true });
  setup.data.voice = isOn;
  await interaction.update({ embeds: [createSetupEmbed(6, setup.data)], components: createFinalOptions(setupId) });
}

async function handleStart(interaction) {
  const setupId = getSetupId(interaction.customId);
  const setup = setupSessions.get(setupId);
  if (!setup || setup.hostId !== interaction.user.id) return interaction.reply({ content: '❌ Not your setup.', ephemeral: true });
  
  const sessionId = `cayo_${Date.now()}_${setup.hostId.slice(-4)}`;
  const target = TARGETS[setup.data.target];
  
  let voiceChannel = null;
  if (setup.data.voice) {
    try {
      const guild = interaction.guild;
      const category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && (c.name.toLowerCase().includes('gta') || c.name.toLowerCase().includes('heist')));
      voiceChannel = await guild.channels.create({ name: `🎯 ${setup.hostUsername}'s Heist`, type: ChannelType.GuildVoice, parent: category?.id, userLimit: 4 });
    } catch (e) {}
  }
  
  const session = {
    id: sessionId, hostId: setup.hostId, hostUsername: setup.hostUsername, hostPsn: setup.data.psn,
    platform: setup.data.platform, target: setup.data.target, secondary: setup.data.secondary, 
    approach: setup.data.approach, b2b: setup.data.b2b,
    crew: [], status: 'recruiting', voiceChannelId: voiceChannel?.id, createdAt: Date.now(),
    channelId: setup.channelId, messageId: null, heistCount: 0, totalEarnings: 0
  };
  
  try { await interaction.message.delete(); } catch (e) {}
  
  const lfgChannel = interaction.channel;
  const pingRole = lfgChannel.guild.roles.cache.find(r => r.name.toLowerCase().includes('cayo') || r.name.toLowerCase().includes('heist'));
  
  const lfgMessage = await lfgChannel.send({
    content: pingRole ? `<@&${pingRole.id}>` : '🏝️ **New Cayo Heist!**',
    embeds: [createMainEmbed(session)],
    components: createSessionControls(session)
  });
  
  session.messageId = lfgMessage.id;
  activeSessions.set(setup.hostId, session);
  activeSessions.set(sessionId, session);
  setupSessions.delete(setupId);
  
  await interaction.reply({ content: '✅ **Heist posted!** Good luck, Kapitan!', ephemeral: true });
}

function calculatePayouts(session) {
  const crewSize = session.crew.length + 1; // +1 for host
  const target = TARGETS[session.target];
  const secondary = SECONDARY_LOOT[session.secondary];
  
  // Base calculation
  let payout = CREW_PAYOUTS[crewSize] || CREW_PAYOUTS[2];
  
  // Estimate total take based on target + secondary
  const primaryValue = target.value;
  const secondaryValue = secondary.value * (crewSize === 1 ? 2 : crewSize); // More bags with more players
  const totalTake = primaryValue + secondaryValue;
  const afterFees = totalTake * 0.9; // 10% fencing fee
  
  const hostCut = Math.floor(afterFees * (payout.hostPercent / 100));
  const crewCut = Math.floor(afterFees * (payout.crewPercent / 100));
  
  return { totalTake, afterFees, hostCut, crewCut, hostPercent: payout.hostPercent, crewPercent: payout.crewPercent };
}

function createMainEmbed(session) {
  const target = TARGETS[session.target];
  const secondary = SECONDARY_LOOT[session.secondary];
  const approach = APPROACHES[session.approach];
  const platform = PLATFORMS[session.platform];
  const payouts = calculatePayouts(session);
  
  const crewSize = session.crew.length + 1;
  
  // Build crew list
  let crewList = `1.👑 **${session.hostUsername}** (Host) \`${session.hostPsn}\`\n`;
  for (let i = 0; i < 3; i++) {
    if (session.crew[i]) {
      crewList += `${i + 2}. ${session.crew[i].username} \`${session.crew[i].psn}\`\n`;
    } else {
      crewList += `${i + 2}. 🟢 *Open*\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏝️ CAYO PERICO - ${session.status.toUpperCase()}`)
    .setDescription(`**Host:** ${session.hostUsername} \`${session.hostPsn}\`\n${target.emoji} ${target.name} | ${secondary.emoji} ${secondary.name} | ${session.b2b ? '🔄 B2B' : ''}`)
    .addFields(
      { name: '👥 Crew', value: crewList, inline: true },
      { 
        name: '💰 Payouts', 
        value: `**Total:** ~$${(payouts.afterFees/1000000).toFixed(1)}M\n**Host (${payouts.hostPercent}%):** ~$${(payouts.hostCut/1000000).toFixed(1)}M\n**Crew (${payouts.crewPercent}%):** ~$${(payouts.crewCut/1000000).toFixed(1)}M${session.heistCount > 0 ? `\n\n🎯 **Runs:** ${session.heistCount}\n💵 **Total:** $${(session.totalEarnings/1000000).toFixed(2)}M` : ''}`, 
        inline: true 
      },
      { name: '📊 Info', value: `${approach.emoji} ${approach.name}\n${platform.short}\n⏱️ 10-15 min`, inline: true }
    )
    .setColor(session.status === 'recruiting' ? COLORS.vice_pink : session.status === 'in_progress' ? COLORS.vice_teal : COLORS.success)
    .setFooter({ text: `${getTimeAgo(session.createdAt)} • Gold requires 2+ players` });

  return embed;
}

function createSessionControls(session) {
  const rows = [];
  
  // Row 1: Join/Leave/Voice
  const row1 = new ActionRowBuilder();
  if (session.status === 'recruiting' && session.crew.length < 3) {
    row1.addComponents(new ButtonBuilder().setCustomId(`cayo_join_${session.id}`).setLabel('Join').setStyle(ButtonStyle.Success).setEmoji('🎯'));
  }
  row1.addComponents(
    new ButtonBuilder().setCustomId(`cayo_leave_${session.id}`).setLabel('Leave').setStyle(ButtonStyle.Secondary).setEmoji('🚪'),
    new ButtonBuilder().setCustomId(`cayo_voicebtn_${session.id}`).setLabel('Voice').setStyle(ButtonStyle.Primary).setEmoji('🔊')
  );
  rows.push(row1);
  
  // Row 2: Host controls
  const row2 = new ActionRowBuilder();
  if (session.status === 'recruiting') {
    row2.addComponents(new ButtonBuilder().setCustomId(`cayo_startrun_${session.id}`).setLabel('Start Heist').setStyle(ButtonStyle.Primary).setEmoji('🚀'));
  }
  if (session.status === 'in_progress' && session.b2b) {
    row2.addComponents(new ButtonBuilder().setCustomId(`cayo_done_${session.id}`).setLabel('Done').setStyle(ButtonStyle.Success).setEmoji('✅'));
  }
  row2.addComponents(new ButtonBuilder().setCustomId(`cayo_end_${session.id}`).setLabel('End').setStyle(ButtonStyle.Danger).setEmoji('⭕'));
  rows.push(row2);
  
  return rows;
}

async function handleJoin(interaction) {
  const sessionId = getSessionId(interaction.customId);
  const session = activeSessions.get(sessionId);
  if (!session) return interaction.reply({ content: '❌ Session ended.', ephemeral: true });
  if (session.hostId === interaction.user.id) return interaction.reply({ content: '❌ You\'re the host!', ephemeral: true });
  if (session.crew.some(c => c.userId === interaction.user.id)) return interaction.reply({ content: '❌ Already in!', ephemeral: true });
  if (session.crew.length >= 3) return interaction.reply({ content: '❌ Full! (4/4)', ephemeral: true });
  if (blacklistSystem && await blacklistSystem.isBlacklisted(session.hostId, interaction.user.id)) return interaction.reply({ content: '🚫 Blacklisted by host.', ephemeral: true });
  
  const modal = new ModalBuilder().setCustomId(`cayo_joinpsn_${sessionId}`).setTitle('Join Heist')
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('psn').setLabel('Your PSN').setStyle(TextInputStyle.Short).setRequired(true)));
  await interaction.showModal(modal);
  
  try {
    const m = await interaction.awaitModalSubmit({ filter: i => i.customId === `cayo_joinpsn_${sessionId}`, time: 60000 });
    session.crew.push({ userId: m.user.id, username: m.user.username, psn: m.fields.getTextInputValue('psn'), joinedAt: Date.now() });
    await updateSession(interaction.client, session);
    
    const channel = interaction.client.channels.cache.get(session.channelId);
    await channel.send(`🎯 **${m.user.username}** joined the heist! (${session.crew.length + 1}/4)`);
    
    await m.reply({ content: '✅ Joined!', ephemeral: true });
  } catch (e) {}
}

async function handleLeave(interaction) {
  const sessionId = getSessionId(interaction.customId);
  const session = activeSessions.get(sessionId);
  if (!session) return interaction.reply({ content: '❌ Session ended.', ephemeral: true });
  
  const idx = session.crew.findIndex(c => c.userId === interaction.user.id);
  if (idx === -1) return interaction.reply({ content: '❌ You\'re not in this heist.', ephemeral: true });
  
  const left = session.crew.splice(idx, 1)[0];
  await updateSession(interaction.client, session);
  
  const channel = interaction.client.channels.cache.get(session.channelId);
  await channel.send(`🚪 **${left.username}** left the heist.`);
  
  await interaction.reply({ content: '✅ Left the heist.', ephemeral: true });
}

async function handleVoiceBtn(interaction) {
  const sessionId = getSessionId(interaction.customId);
  const session = activeSessions.get(sessionId);
  if (!session) return interaction.reply({ content: '❌ Session ended.', ephemeral: true });
  
  if (session.voiceChannelId) {
    await interaction.reply({ content: `🔊 Join voice: <#${session.voiceChannelId}>`, ephemeral: true });
  } else {
    await interaction.reply({ content: '❌ No voice channel for this session.', ephemeral: true });
  }
}

async function handleStartRun(interaction) {
  const sessionId = getSessionId(interaction.customId);
  const session = activeSessions.get(sessionId);
  if (!session) return interaction.reply({ content: '❌ Session ended.', ephemeral: true });
  if (interaction.user.id !== session.hostId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
  
  session.status = 'in_progress';
  await updateSession(interaction.client, session);
  
  const target = TARGETS[session.target];
  const channel = interaction.client.channels.cache.get(session.channelId);
  await channel.send(`🚀 **${session.hostUsername}** is starting the heist! | ${target.emoji} ${target.name} | ${session.b2b ? '🔄 B2B' : ''}`);
  
  await interaction.reply({ content: '🚀 Heist started! Good luck!', ephemeral: true });
}

async function handleDone(interaction) {
  const sessionId = getSessionId(interaction.customId);
  const session = activeSessions.get(sessionId);
  if (!session) return interaction.reply({ content: '❌ Session ended.', ephemeral: true });
  if (interaction.user.id !== session.hostId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
  
  session.heistCount++;
  
  const payouts = calculatePayouts(session);
  session.totalEarnings += payouts.afterFees;
  
  await updateSession(interaction.client, session);
  
  const channel = interaction.client.channels.cache.get(session.channelId);
  await channel.send(`🎯 **HEIST #${session.heistCount} COMPLETE!** +$${(payouts.afterFees/1000000).toFixed(2)}M | Total: $${(session.totalEarnings/1000000).toFixed(2)}M`);
  
  await interaction.reply({ content: `✅ Heist #${session.heistCount} done! Total: $${(session.totalEarnings/1000000).toFixed(2)}M`, ephemeral: true });
}

async function handleEnd(interaction) {
  const sessionId = getSessionId(interaction.customId);
  const session = activeSessions.get(sessionId);
  if (!session) return interaction.reply({ content: '❌ Session ended.', ephemeral: true });
  if (interaction.user.id !== session.hostId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
  
  if (session.voiceChannelId) {
    try { await interaction.client.channels.cache.get(session.voiceChannelId)?.delete(); } catch (e) {}
  }
  
  try {
    const ch = interaction.client.channels.cache.get(session.channelId);
    const msg = await ch.messages.fetch(session.messageId);
    
    const target = TARGETS[session.target];
    let summary = `${target.emoji} **${target.name}** completed!\n\n`;
    summary += `**Host:** <@${session.hostId}>\n`;
    summary += `**Crew:** ${session.crew.map(c => `<@${c.userId}>`).join(', ') || 'Solo'}\n\n`;
    if (session.heistCount > 0) {
      summary += `🎯 **Total Heists:** ${session.heistCount}\n`;
      summary += `💰 **Total Take:** $${(session.totalEarnings/1000000).toFixed(2)}M`;
    }
    
    await msg.edit({ embeds: [new EmbedBuilder().setTitle('🏆 HEIST SESSION COMPLETE').setDescription(summary).setColor(COLORS.success)], components: [] });
  } catch (e) {}
  
  activeSessions.delete(sessionId);
  activeSessions.delete(session.hostId);
  
  await interaction.reply({ content: `🏆 Session ended! ${session.heistCount > 0 ? `Heists: ${session.heistCount}, Total: $${(session.totalEarnings/1000000).toFixed(2)}M` : ''}`, ephemeral: true });
}

async function handleKick(interaction, subAction) {
  const sessionId = getSessionId(interaction.customId);
  const session = activeSessions.get(sessionId);
  if (!session || interaction.user.id !== session.hostId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
  
  if (subAction === 'menu') {
    if (!session.crew.length) return interaction.reply({ content: '❌ No crew.', ephemeral: true });
    const select = new StringSelectMenuBuilder().setCustomId(`cayo_kick_sel_${sessionId}`).setPlaceholder('Kick who?')
      .addOptions(session.crew.map(c => ({ label: c.username, value: c.userId, description: c.psn })));
    await interaction.reply({ content: '👢 Select:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    
    try {
      const s = await interaction.channel.awaitMessageComponent({ filter: i => i.customId === `cayo_kick_sel_${sessionId}`, time: 30000 });
      const kicked = session.crew.find(c => c.userId === s.values[0]);
      session.crew = session.crew.filter(c => c.userId !== s.values[0]);
      await updateSession(interaction.client, session);
      
      const channel = interaction.client.channels.cache.get(session.channelId);
      await channel.send(`👢 **${kicked.username}** was removed from the heist.`);
      
      if (blacklistSystem) {
        const { embed, row } = blacklistSystem.createBlacklistPrompt(session.hostId, kicked.userId, kicked.username);
        await s.update({ embeds: [embed], components: [row] });
      } else await s.update({ content: `✅ Kicked ${kicked.username}`, components: [] });
    } catch (e) {}
  }
}

async function updateSession(client, session) {
  try { 
    const ch = client.channels.cache.get(session.channelId); 
    const msg = await ch.messages.fetch(session.messageId); 
    await msg.edit({ embeds: [createMainEmbed(session)], components: createSessionControls(session) }); 
  } catch (e) {}
}

function getTimeAgo(ts) { 
  const m = Math.floor((Date.now() - ts) / 60000); 
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.floor(m/60)}h ago`; 
}

module.exports = { initialize, createSession };
