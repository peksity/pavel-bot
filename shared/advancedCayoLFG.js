/**
 * ADVANCED CAYO PERICO LFG v5
 * - EPHEMERAL SETUP (DM until recruiting)
 * - PS4/PS5 cross-gen handling
 * - PSN required
 * - Role ping when recruiting
 */

const { 
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType
} = require('discord.js');

const CAYO_CONFIG = {
  targets: {
    'pink_diamond': { name: '💎 Pink Diamond', payout: 1430000, description: '$1.43M - BEST' },
    'bearer_bonds': { name: '📜 Bearer Bonds', payout: 1210000, description: '$1.21M' },
    'ruby_necklace': { name: '💍 Ruby Necklace', payout: 1100000, description: '$1.1M' },
    'tequila': { name: '🍾 Tequila', payout: 990000, description: '$990K' }
  },
  approaches: {
    'drainage': { name: '🚿 Drainage Tunnel', description: 'FASTEST - Swim in' },
    'main_dock': { name: '🚢 Main Dock', description: 'Boat approach' },
    'kosatka': { name: '🚁 Kosatka', description: 'Submarine drop' }
  },
  gtaVersions: {
    'ps5_enhanced': { name: '🔵 PS5 Enhanced', emoji: '🔵', compatibleWith: ['ps5_enhanced'] },
    'ps4_version': { name: '🟣 PS4 Version', emoji: '🟣', compatibleWith: ['ps4_version', 'ps5_playing_ps4'] },
    'ps5_playing_ps4': { name: '🟡 PS5 (PS4 Version)', emoji: '🟡', compatibleWith: ['ps4_version', 'ps5_playing_ps4'] }
  },
  maxPlayers: 4,
  sessionTimeout: 30 * 60 * 1000,
  roleName: 'Cayo'
};

const activeSessions = new Map();
const userCooldowns = new Map();
const kickedUsers = new Map();

function initialize(client) {
  console.log('[CAYO LFG] v5 initializing...');
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton()) await handleButton(interaction, client);
      if (interaction.isStringSelectMenu()) await handleSelectMenu(interaction, client);
      if (interaction.isModalSubmit()) await handleModal(interaction, client);
    } catch (e) { console.error('[CAYO]', e); }
  });
  setInterval(() => checkTimeouts(client), 60000);
  console.log('[CAYO LFG] ✅ v5 ready');
}

async function createSession(message, client) {
  const userId = message.author.id;
  
  const cooldown = userCooldowns.get(userId);
  if (cooldown && Date.now() - cooldown < 5 * 60 * 1000) {
    const r = await message.reply({ content: `⏳ Wait before hosting another heist.` });
    setTimeout(() => { message.delete().catch(() => {}); r.delete().catch(() => {}); }, 5000);
    return;
  }
  
  for (const [, s] of activeSessions) {
    if (s.userId === userId) {
      const r = await message.reply({ content: `❌ You have an active heist!` });
      setTimeout(() => { message.delete().catch(() => {}); r.delete().catch(() => {}); }, 5000);
      return;
    }
  }
  
  await message.delete().catch(() => {});
  
  const sessionId = `cayo_${Date.now()}_${userId}`;
  const session = {
    id: sessionId,
    userId,
    username: message.author.username,
    psnUsername: null,
    gtaVersion: null,
    players: [],
    target: null,
    approach: null,
    b2b: true,
    status: 'setup',
    voiceChannel: null,
    publicMessageId: null,
    channelId: message.channel.id,
    guildId: message.guild.id,
    createdAt: Date.now(),
    totalEarnings: 0,
    runsCompleted: 0
  };
  
  kickedUsers.set(sessionId, new Set());
  activeSessions.set(sessionId, session);
  
  // DM setup
  try {
    const embed = new EmbedBuilder()
      .setTitle('🏝️ CAYO PERICO - SELECT GTA VERSION')
      .setDescription('**⚠️ PS4 & PS5 Enhanced are on DIFFERENT servers!**\n\nSelect your version below.')
      .addFields(
        { name: '🔵 PS5 Enhanced', value: 'Only with other PS5 Enhanced', inline: false },
        { name: '🟣 PS4 Version', value: 'Cross-gen compatible', inline: false },
        { name: '🟡 PS5 (PS4 Version)', value: 'PS5 running PS4 version - Cross-gen', inline: false }
      )
      .setColor(0x00D4FF)
      .setFooter({ text: '🔒 Only you see this until you start recruiting' });
    
    const select = new StringSelectMenuBuilder()
      .setCustomId(`cayo_version_${sessionId}`)
      .setPlaceholder('🎮 Select GTA Version')
      .addOptions([
        { label: 'PS5 Enhanced', value: 'ps5_enhanced', emoji: '🔵' },
        { label: 'PS4 Version', value: 'ps4_version', emoji: '🟣' },
        { label: 'PS5 (PS4 Version)', value: 'ps5_playing_ps4', emoji: '🟡' }
      ]);
    
    const row = new ActionRowBuilder().addComponents(select);
    const cancelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cayo_cancel_${sessionId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );
    
    await message.author.send({ embeds: [embed], components: [row, cancelRow] });
    const confirm = await message.channel.send({ content: `<@${userId}> Check DMs to set up your heist! 📩` });
    setTimeout(() => confirm.delete().catch(() => {}), 5000);
  } catch (e) {
    // DMs disabled - fallback
    const embed = new EmbedBuilder()
      .setTitle('🏝️ CAYO - Setup')
      .setDescription('Select your GTA version')
      .setColor(0x00D4FF);
    
    const select = new StringSelectMenuBuilder()
      .setCustomId(`cayo_version_${sessionId}`)
      .setPlaceholder('🎮 Select GTA Version')
      .addOptions([
        { label: 'PS5 Enhanced', value: 'ps5_enhanced', emoji: '🔵' },
        { label: 'PS4 Version', value: 'ps4_version', emoji: '🟣' },
        { label: 'PS5 (PS4 Version)', value: 'ps5_playing_ps4', emoji: '🟡' }
      ]);
    
    await message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
  }
  
  return session;
}

async function handleModal(interaction, client) {
  const customId = interaction.customId;
  
  if (customId.startsWith('cayo_psnmodal_')) {
    const sessionId = customId.replace('cayo_psnmodal_', '');
    const session = activeSessions.get(sessionId);
    if (!session) return interaction.reply({ content: '❌ Expired.', ephemeral: true });
    
    const psn = interaction.fields.getTextInputValue('psn_input');
    session.psnUsername = psn;
    session.players.push({ userId: session.userId, username: session.username, psn, gtaVersion: session.gtaVersion });
    
    await interaction.update({ embeds: [createSetupEmbed(session)], components: createSetupComponents(sessionId, session) });
  }
  
  if (customId.startsWith('cayo_joinmodal_')) {
    const sessionId = customId.replace('cayo_joinmodal_', '');
    const session = activeSessions.get(sessionId);
    if (!session) return interaction.reply({ content: '❌ Expired.', ephemeral: true });
    
    const psn = interaction.fields.getTextInputValue('psn_input');
    const version = session.pendingJoinVersion;
    session.players.push({ userId: interaction.user.id, username: interaction.user.username, psn, gtaVersion: version });
    delete session.pendingJoinVersion;
    
    const channel = await client.channels.fetch(session.channelId);
    const msg = await channel.messages.fetch(session.publicMessageId);
    await msg.edit({ embeds: [createRecruitingEmbed(session)], components: createRecruitingComponents(sessionId, session) });
    
    await interaction.reply({ content: `✅ Joined!`, ephemeral: true });
    const vInfo = CAYO_CONFIG.gtaVersions[version];
    await channel.send({ content: `🎮 **${psn}** ${vInfo.emoji} joined! (${session.players.length}/${CAYO_CONFIG.maxPlayers})` });
  }
}

async function handleButton(interaction, client) {
  const customId = interaction.customId;
  if (!customId.startsWith('cayo_')) return;
  
  const parts = customId.split('_');
  const action = parts[1];
  const sessionId = parts.slice(2).join('_');
  
  const session = activeSessions.get(sessionId);
  
  switch (action) {
    case 'b2b':
      if (!session || interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
      session.b2b = !session.b2b;
      await interaction.update({ embeds: [createSetupEmbed(session)], components: createSetupComponents(sessionId, session) });
      break;
      
    case 'start':
      if (!session || interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
      if (!session.target || !session.approach) return interaction.reply({ content: '❌ Select target and approach!', ephemeral: true });
      await handleStartRecruiting(interaction, session, sessionId, client);
      break;
      
    case 'cancel':
      if (session && interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
      activeSessions.delete(sessionId);
      kickedUsers.delete(sessionId);
      await interaction.update({ embeds: [new EmbedBuilder().setTitle('❌ Cancelled').setColor(0xFF0000)], components: [] });
      break;
      
    case 'join':
      if (!session) return interaction.reply({ content: '❌ Expired.', ephemeral: true });
      await handleJoin(interaction, session, sessionId, client);
      break;
      
    case 'leave':
      if (!session) return interaction.reply({ content: '❌ Expired.', ephemeral: true });
      await handleLeave(interaction, session, sessionId, client);
      break;
      
    case 'voice':
      if (!session) return interaction.reply({ content: '❌ Expired.', ephemeral: true });
      await handleVoice(interaction, session, sessionId, client);
      break;
      
    case 'ready':
      if (!session || interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
      session.status = 'in_progress';
      const ch = await client.channels.fetch(session.channelId);
      const m = await ch.messages.fetch(session.publicMessageId);
      await m.edit({ embeds: [createRecruitingEmbed(session)], components: createRecruitingComponents(sessionId, session) });
      await ch.send({ content: `🚀 **HEIST STARTING!** ${session.players.map(p => `<@${p.userId}>`).join(' ')}` });
      await interaction.reply({ content: '✅ Started!', ephemeral: true });
      break;
      
    case 'complete':
      if (!session || interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
      session.runsCompleted++;
      session.totalEarnings += CAYO_CONFIG.targets[session.target].payout;
      const ch2 = await client.channels.fetch(session.channelId);
      const m2 = await ch2.messages.fetch(session.publicMessageId);
      await m2.edit({ embeds: [createRecruitingEmbed(session)], components: createRecruitingComponents(sessionId, session) });
      await ch2.send({ content: `💰 **RUN #${session.runsCompleted}!** +$${CAYO_CONFIG.targets[session.target].payout.toLocaleString()}` });
      await interaction.reply({ content: '✅ Logged!', ephemeral: true });
      break;
      
    case 'end':
      if (!session || interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
      await handleEnd(interaction, session, sessionId, client);
      break;
  }
}

async function handleSelectMenu(interaction, client) {
  const customId = interaction.customId;
  if (!customId.startsWith('cayo_')) return;
  
  const parts = customId.split('_');
  const type = parts[1];
  const sessionId = parts.slice(2).join('_');
  
  const session = activeSessions.get(sessionId);
  if (!session) return interaction.reply({ content: '❌ Expired.', ephemeral: true });
  
  const value = interaction.values[0];
  
  if (type === 'version') {
    if (interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
    session.gtaVersion = value;
    
    const modal = new ModalBuilder().setCustomId(`cayo_psnmodal_${sessionId}`).setTitle('Enter PSN');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('psn_input').setLabel('PSN Username').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(16)
    ));
    return interaction.showModal(modal);
  }
  
  if (type === 'joinversion') {
    const compatible = CAYO_CONFIG.gtaVersions[session.gtaVersion].compatibleWith.includes(value);
    if (!compatible) return interaction.reply({ content: '❌ Incompatible version!', ephemeral: true });
    
    session.pendingJoinVersion = value;
    const modal = new ModalBuilder().setCustomId(`cayo_joinmodal_${sessionId}`).setTitle('Enter PSN');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('psn_input').setLabel('PSN Username').setStyle(TextInputStyle.Short).setRequired(true)
    ));
    return interaction.showModal(modal);
  }
  
  if (type === 'kick') {
    if (interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
    const idx = session.players.findIndex(p => p.userId === value);
    if (idx === -1) return;
    const kicked = session.players.splice(idx, 1)[0];
    kickedUsers.get(sessionId)?.add(value);
    try { const u = await client.users.fetch(value); await u.send({ embeds: [new EmbedBuilder().setTitle('❌ Removed').setColor(0xFF0000)] }); } catch (e) {}
    const ch = await client.channels.fetch(session.channelId);
    const m = await ch.messages.fetch(session.publicMessageId);
    await m.edit({ embeds: [createRecruitingEmbed(session)], components: createRecruitingComponents(sessionId, session) });
    await ch.send({ content: `👢 **${kicked.psn}** removed.` });
    await interaction.reply({ content: '✅ Kicked', ephemeral: true });
    return;
  }
  
  if (interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
  
  if (type === 'target') session.target = value;
  else if (type === 'approach') session.approach = value;
  
  await interaction.update({ embeds: [createSetupEmbed(session)], components: createSetupComponents(sessionId, session) });
}

async function handleStartRecruiting(interaction, session, sessionId, client) {
  session.status = 'recruiting';
  
  await interaction.update({ 
    embeds: [new EmbedBuilder().setTitle('✅ Posted!').setDescription('Check the LFG channel.').setColor(0x00FF00)],
    components: []
  });
  
  const channel = await client.channels.fetch(session.channelId);
  const guild = await client.guilds.fetch(session.guildId);
  const role = guild.roles.cache.find(r => r.name.toLowerCase().includes('cayo') || r.name.toLowerCase().includes('heist'));
  
  const vInfo = CAYO_CONFIG.gtaVersions[session.gtaVersion];
  const compatMsg = session.gtaVersion === 'ps5_enhanced' ? '🔵 **PS5 Enhanced ONLY**' : '🟢 **Cross-Gen** (PS4 & PS5 w/ PS4 version)';
  
  const publicMsg = await channel.send({
    content: role ? `${role} **CAYO HEIST OPEN!**` : '🏝️ **CAYO HEIST OPEN!**',
    embeds: [createRecruitingEmbed(session)],
    components: createRecruitingComponents(sessionId, session)
  });
  
  session.publicMessageId = publicMsg.id;
  
  await channel.send({
    content: `🏝️ **${session.psnUsername}** ${vInfo.emoji} | ${CAYO_CONFIG.targets[session.target].name} | ${compatMsg}`
  });
}

async function handleJoin(interaction, session, sessionId, client) {
  const userId = interaction.user.id;
  if (kickedUsers.get(sessionId)?.has(userId)) return interaction.reply({ content: '❌ Removed.', ephemeral: true });
  if (session.players.some(p => p.userId === userId)) return interaction.reply({ content: '❌ Already in!', ephemeral: true });
  if (session.players.length >= CAYO_CONFIG.maxPlayers) return interaction.reply({ content: '❌ Full!', ephemeral: true });
  
  const compatibleVersions = CAYO_CONFIG.gtaVersions[session.gtaVersion].compatibleWith;
  const options = Object.entries(CAYO_CONFIG.gtaVersions)
    .filter(([k]) => compatibleVersions.includes(k))
    .map(([k, v]) => ({ label: v.name, value: k, emoji: v.emoji }));
  
  const embed = new EmbedBuilder()
    .setTitle('🎮 Select Your GTA Version')
    .setDescription(session.gtaVersion === 'ps5_enhanced' ? '🔵 PS5 Enhanced lobby' : '🟢 Cross-gen lobby')
    .setColor(0x00D4FF);
  
  const select = new StringSelectMenuBuilder()
    .setCustomId(`cayo_joinversion_${sessionId}`)
    .setPlaceholder('Select version')
    .addOptions(options);
  
  await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
}

async function handleLeave(interaction, session, sessionId, client) {
  if (interaction.user.id === session.userId) return interaction.reply({ content: '❌ Use End.', ephemeral: true });
  const idx = session.players.findIndex(p => p.userId === interaction.user.id);
  if (idx === -1) return interaction.reply({ content: '❌ Not in.', ephemeral: true });
  session.players.splice(idx, 1);
  const ch = await client.channels.fetch(session.channelId);
  const m = await ch.messages.fetch(session.publicMessageId);
  await m.edit({ embeds: [createRecruitingEmbed(session)], components: createRecruitingComponents(sessionId, session) });
  await interaction.reply({ content: '👋 Left.', ephemeral: true });
}

async function handleVoice(interaction, session, sessionId, client) {
  if (interaction.user.id !== session.userId) return interaction.reply({ content: '❌ Host only.', ephemeral: true });
  if (session.voiceChannel) return interaction.reply({ content: `🔊 <#${session.voiceChannel}>`, ephemeral: true });
  const guild = await client.guilds.fetch(session.guildId);
  const cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('gta'));
  const vc = await guild.channels.create({ name: `🏝️ ${session.psnUsername}`, type: ChannelType.GuildVoice, parent: cat?.id, userLimit: 4 });
  session.voiceChannel = vc.id;
  await interaction.reply({ content: `🔊 <#${vc.id}>` });
}

async function handleEnd(interaction, session, sessionId, client) {
  userCooldowns.set(session.userId, Date.now());
  
  for (const p of session.players.filter(x => x.userId !== session.userId)) {
    try { const u = await client.users.fetch(p.userId); await u.send({ embeds: [new EmbedBuilder().setTitle('🏝️ Heist Ended').setDescription(`Total: $${session.totalEarnings.toLocaleString()}`).setColor(0x00FF00)] }); } catch (e) {}
  }
  
  const ch = await client.channels.fetch(session.channelId);
  if (session.players.length > 1) {
    await ch.send({ content: `🏝️ **HEIST ENDED** | ${session.players.filter(p => p.userId !== session.userId).map(p => `<@${p.userId}>`).join(' ')} | $${session.totalEarnings.toLocaleString()}` });
  }
  
  if (session.voiceChannel) { try { const c = await client.channels.fetch(session.voiceChannel); if (c) await c.delete(); } catch (e) {} }
  
  const m = await ch.messages.fetch(session.publicMessageId).catch(() => null);
  if (m) await m.edit({ embeds: [new EmbedBuilder().setTitle('🏝️ Complete!').setDescription(`$${session.totalEarnings.toLocaleString()}`).setColor(0x00FF00)], components: [] });
  
  activeSessions.delete(sessionId);
  kickedUsers.delete(sessionId);
  await interaction.reply({ content: '✅ Ended!', ephemeral: true });
}

function createSetupEmbed(session) {
  const targetInfo = session.target ? CAYO_CONFIG.targets[session.target] : null;
  const approachInfo = session.approach ? CAYO_CONFIG.approaches[session.approach] : null;
  const vInfo = CAYO_CONFIG.gtaVersions[session.gtaVersion];
  
  return new EmbedBuilder()
    .setTitle('🏝️ CAYO PERICO - SETUP')
    .setDescription(`**Host:** ${session.username}\n**PSN:** ${session.psnUsername}\n**Version:** ${vInfo.emoji} ${vInfo.name}`)
    .addFields(
      { name: '🎯 Target', value: targetInfo ? `✅ **${targetInfo.name}**` : '❓ Not set', inline: true },
      { name: '🚀 Approach', value: approachInfo ? `✅ **${approachInfo.name}**` : '❓ Not set', inline: true },
      { name: '🔄 B2B', value: session.b2b ? '✅ ON' : '❌ OFF', inline: true }
    )
    .setColor(0x00D4FF)
    .setFooter({ text: '🔒 Only you see this' });
}

function createRecruitingEmbed(session) {
  const targetInfo = CAYO_CONFIG.targets[session.target];
  const vInfo = CAYO_CONFIG.gtaVersions[session.gtaVersion];
  
  let playerList = '';
  for (let i = 0; i < CAYO_CONFIG.maxPlayers; i++) {
    if (session.players[i]) {
      const p = session.players[i];
      const pv = CAYO_CONFIG.gtaVersions[p.gtaVersion];
      playerList += `${i + 1}. ${p.userId === session.userId ? '👑' : '🎮'} **${p.psn}** ${pv.emoji}\n`;
    } else {
      playerList += `${i + 1}. ⬜ *Open*\n`;
    }
  }
  
  return new EmbedBuilder()
    .setTitle('🏝️ CAYO PERICO - RECRUITING')
    .setDescription(`**Host:** ${session.psnUsername} ${vInfo.emoji}\n${session.gtaVersion === 'ps5_enhanced' ? '🔵 PS5 Enhanced ONLY' : '🟢 Cross-Gen'}`)
    .addFields(
      { name: '👥 Crew', value: playerList, inline: true },
      { name: '📊 Info', value: `${targetInfo.name}\n$${targetInfo.payout.toLocaleString()}`, inline: true }
    )
    .setColor(session.status === 'in_progress' ? 0x00FF00 : 0x00D4FF);
}

function createSetupComponents(sessionId, session) {
  const targetSelect = new StringSelectMenuBuilder()
    .setCustomId(`cayo_target_${sessionId}`)
    .setPlaceholder(session.target ? `✅ ${CAYO_CONFIG.targets[session.target].name}` : '🎯 Target')
    .addOptions(Object.entries(CAYO_CONFIG.targets).map(([k, v]) => ({ label: v.name, value: k, default: session.target === k })));
  
  const approachSelect = new StringSelectMenuBuilder()
    .setCustomId(`cayo_approach_${sessionId}`)
    .setPlaceholder(session.approach ? `✅ ${CAYO_CONFIG.approaches[session.approach].name}` : '🚀 Approach')
    .addOptions(Object.entries(CAYO_CONFIG.approaches).map(([k, v]) => ({ label: v.name, description: v.description, value: k, default: session.approach === k })));
  
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cayo_b2b_${sessionId}`).setLabel(session.b2b ? 'B2B: ON' : 'B2B: OFF').setStyle(session.b2b ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cayo_start_${sessionId}`).setLabel('Start Recruiting').setStyle(ButtonStyle.Primary).setEmoji('🚀'),
    new ButtonBuilder().setCustomId(`cayo_cancel_${sessionId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
  );
  
  return [new ActionRowBuilder().addComponents(targetSelect), new ActionRowBuilder().addComponents(approachSelect), buttons];
}

function createRecruitingComponents(sessionId, session) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cayo_join_${sessionId}`).setLabel('Join').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cayo_leave_${sessionId}`).setLabel('Leave').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cayo_voice_${sessionId}`).setLabel('Voice').setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cayo_ready_${sessionId}`).setLabel('Start').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cayo_complete_${sessionId}`).setLabel('Done').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cayo_end_${sessionId}`).setLabel('End').setStyle(ButtonStyle.Danger)
  );
  const components = [row1, row2];
  
  if (session.players.length > 1) {
    const opts = session.players.filter(p => p.userId !== session.userId).map(p => ({ label: `Kick ${p.psn}`, value: p.userId }));
    if (opts.length) components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cayo_kick_${sessionId}`).setPlaceholder('👢 Kick').addOptions(opts)));
  }
  return components;
}

function checkTimeouts(client) {
  for (const [id, s] of activeSessions) {
    if (Date.now() - s.createdAt > CAYO_CONFIG.sessionTimeout) {
      if (s.voiceChannel) client.channels.fetch(s.voiceChannel).then(c => c?.delete()).catch(() => {});
      activeSessions.delete(id);
      kickedUsers.delete(id);
    }
  }
}

async function createTables() {}
module.exports = { initialize, createSession, createTables };
