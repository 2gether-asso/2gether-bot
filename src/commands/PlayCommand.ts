import { SlashCommandBuilder } from '@discordjs/builders'
import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, PlayerSubscription, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice'
import { Mel, Discord, MessageReactionListenerRegister, DBListener, ListenerTypes, MessageReactionHandler, MessageReactionListener, MessageComponentListenerRegister, MessageComponentHandler, MessageComponentListener } from 'discord-mel'
import YTDL from 'ytdl-core'

import AbstractCommand from './AbstractCommand.js'
import Radio from '../state/types/Radio.js'
import RadioLoopMode from '../state/types/RadioLoopMode.js'

class MessageComponentListenerData
{
	public authorId: Discord.Snowflake

	// public emojiRoles: { [emoji: string]: Discord.Snowflake } = {}

	// public configured: boolean = false

	// // title: 'React with an emoji to add or remove yourself a role'
	public title: string //: 'Menu de sélectionner de rôles'

	public status?: string

	public color: Discord.ColorResolvable

	public constructor(authorId: Discord.Snowflake, title: string = '2GETHER Radio 📻', color: Discord.ColorResolvable = '#0099ff')
	{
		this.authorId = authorId
		this.title = title
		this.color = color
	}
}

enum RadioControlEmojis
{
	PLAY = '▶️', // '⏯',
	PAUSE = '⏸️',
	PREVIOUS = '⏮',
	NEXT = '⏭',
	LOOP_TOGGLE = '🔁',
	CLEAR = '⏏️',
	STOP = '⏹️',
	MUTE = '🔇',
	VOLUME_DOWN = '🔉',
	VOLUME_UP = '🔊',
}

type RadioControlComponentId = `${string}:${keyof typeof RadioControlEmojis}`

class PlayCommand extends AbstractCommand
{
	public static readonly enabled: boolean = true

	protected readonly COMPONENT_PLAY: RadioControlComponentId = `${this.id}:PLAY`
	protected readonly COMPONENT_PAUSE: RadioControlComponentId = `${this.id}:PAUSE`
	protected readonly COMPONENT_PREVIOUS: RadioControlComponentId = `${this.id}:PREVIOUS`
	protected readonly COMPONENT_NEXT: RadioControlComponentId = `${this.id}:NEXT`
	protected readonly COMPONENT_LOOP_TOGGLE: RadioControlComponentId = `${this.id}:LOOP_TOGGLE`
	protected readonly COMPONENT_CLEAR: RadioControlComponentId = `${this.id}:CLEAR`
	protected readonly COMPONENT_STOP: RadioControlComponentId = `${this.id}:STOP`
	protected readonly COMPONENT_MUTE: RadioControlComponentId = `${this.id}:MUTE`
	protected readonly COMPONENT_VOLUME_DOWN: RadioControlComponentId = `${this.id}:VOLUME_DOWN`
	protected readonly COMPONENT_VOLUME_UP: RadioControlComponentId = `${this.id}:VOLUME_UP`

	protected voiceChannel?: Discord.VoiceChannel | Discord.StageChannel

	protected player?: AudioPlayer

	// protected players: Map<string, AudioPlayer> = new Map<string, AudioPlayer>()

	protected playerSubscription?: PlayerSubscription

	protected playerEmbedUpdater?: NodeJS.Timeout

	// protected isPlaying: boolean = false

	public constructor(id: string, bot: Mel)
	{
		super(id, bot)

		this.name = 'play'
		this.description = 'Joue une musique et l\'ajoute à la playlist.'

		this.guildOnly = true

		// Application commands
		this.applicationCommands
			.add((() =>
				{
					const slashCommand = (new SlashCommandBuilder())
						.setName(this.name)
						.setDescription(this.description)

					slashCommand.addStringOption(option => option
							.setName('url')
							.setDescription('Lien de la musique à jouer.')
							.setRequired(false)
						)

					return slashCommand
				})())

		// // RadioControlEmojis Components
		// this.controlComponentsIds = []
		// for (const control of Object.keys(RadioControlEmojis))
		// {
		// 	this.controlComponentsIds.push(`${this.id}:${control}`)
		// }

		this.componentIds
			.add(this.COMPONENT_PLAY)
			.add(this.COMPONENT_PAUSE)
			.add(this.COMPONENT_PREVIOUS)
			.add(this.COMPONENT_NEXT)
			.add(this.COMPONENT_LOOP_TOGGLE)
			.add(this.COMPONENT_CLEAR)
			.add(this.COMPONENT_STOP)
			.add(this.COMPONENT_MUTE)
			.add(this.COMPONENT_VOLUME_DOWN)
			.add(this.COMPONENT_VOLUME_UP)
	}

	protected async getConnection(voiceChannel: Discord.VoiceBasedChannel | Discord.Snowflake | null | undefined): Promise<VoiceConnection | undefined>
	protected async getConnection(voiceChannel: Discord.VoiceBasedChannel): Promise<VoiceConnection>
	protected async getConnection(voiceChannel: Discord.Snowflake): Promise<VoiceConnection | undefined>
	protected async getConnection(voiceChannel: null | undefined): Promise<undefined>
	protected async getConnection(voiceChannel: Discord.VoiceBasedChannel | Discord.Snowflake | null | undefined): Promise<VoiceConnection | undefined>
	{
		if (!voiceChannel)
		{
			return undefined
		}

		if (typeof voiceChannel === 'string')
		{
			const candidateChannel = await this.bot.client.channels.fetch(voiceChannel)
			if (candidateChannel && (candidateChannel instanceof Discord.VoiceChannel || candidateChannel instanceof Discord.StageChannel))
			{
				voiceChannel = candidateChannel
			}
			else
			{
				return undefined
			}
		}

		// Best practice to not track the voice connection manually
		const connection = getVoiceConnection(voiceChannel.guild.id)
		if (connection)
		{
			// // We're already connected to a voice channel
			// this.voiceChannel = connection.voiceChannel;
			// this.player = connection.player;

			return connection
		}

		// Create a new connection
		// this.voiceChannel = voiceChannel
		const newConnection = joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: voiceChannel.guild.id,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator,
		})

		// newConnection.on(VoiceConnectionStatus.Connecting)
		// newConnection.on(VoiceConnectionStatus.Ready)
		// newConnection.on(VoiceConnectionStatus.Disconnected)
		// newConnection.on(VoiceConnectionStatus.Destroyed)
		// newConnection.on(VoiceConnectionStatus.Signalling)

		// newConnection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) =>
		// 	{
		// 		try
		// 		{
		// 			await Promise.race(
		// 				[
		// 					entersState(newConnection, VoiceConnectionStatus.Signalling, 5_000),
		// 					entersState(newConnection, VoiceConnectionStatus.Connecting, 5_000),
		// 				])
		// 			// Seems to be reconnecting to a new channel - ignore disconnect
		// 		}
		// 		catch (error)
		// 		{
		// 			// Seems to be a real disconnect which SHOULDN'T be recovered from
		// 			newConnection.destroy()
		// 		}
		// 	})

		newConnection.on('error', error =>
			this.bot.logger.warn('Connection error', 'PlayCommand', error))

		newConnection.on('debug', message =>
			this.bot.logger.debug(`Connection debug:\n${message}`, 'PlayCommand'))

		// newConnection.on('stateChange', (oldState, newState) => {})

		return newConnection

		// if (!connection
		//     || connection.state.status === VoiceConnectionStatus.Destroyed
		//     || this.voiceChannel?.id !== voiceChannel.id)
		// {
		// 	if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed)
		// 	{
		// 		// Destroy the previous connection
		// 		this.connection.destroy()
		// 	}

		// 	// Create a new connection
		// 	this.voiceChannel = voiceChannel
		// 	this.connection = joinVoiceChannel({
		// 		channelId: voiceChannel.id,
		// 		guildId: voiceChannel.guild.id,
		// 		adapterCreator: voiceChannel.guild.me.voiceAdapterCreator,
		// 	})
		// }

		// return this.connection
	}

	// protected getPlayer(listener: MessageComponentListener): AudioPlayer
	protected getPlayer(dbRadio: Radio): AudioPlayer
	{
		if (this.player)
		{
			return this.player
		}

		const player = createAudioPlayer(
			{
				behaviors:
					{
						noSubscriber: NoSubscriberBehavior.Pause,
					}
			})

		player.on('error', error =>
			this.bot.logger.warn('Player error', 'PlayCommand', error))

		player.on('debug', message =>
			this.bot.logger.debug(`Player debug:\n${message}`, 'PlayCommand'))

		// player.on('subscribe', subscription => {})
		// player.on('unsubscribe', subscription => {})
		// player.on('stateChange', (oldState, newState) => {})

		// player.on(AudioPlayerStatus.Playing)
		// player.on(AudioPlayerStatus.Buffering)
		// player.on(AudioPlayerStatus.Idle)
		// player.on(AudioPlayerStatus.Paused)
		// player.on(AudioPlayerStatus.AutoPaused)

		player.on(AudioPlayerStatus.Playing, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the Playing state!', 'PlayCommand') //, oldState, newState)

			// Fix volume to the current value
			this.setVolume(dbRadio)

			// // Handle loop modes
			// if (dbRadio.loopMode === 'single') dbRadio.queue.unshift(next);
			// else if (dbRadio.loopMode === 'queue') dbRadio.queue.push(next);
			// // else, the track is just removed from the queue

			// this.isPlaying = true;

			// // Send a message when the stream starts
			// if (firstTrack)
			// 	message.channel.send(`Démarrage de la lecture ! 🎵`, await getStatusEmbed());
			// else
			// 	message.channel.send(`Morceau suivant ! 🎵`, await getStatusEmbed());

			const playerEmbedUpdate = () =>
				{
					if (this.player && this.player.state.status === AudioPlayerStatus.Playing)
					{
						this.updateMessageEmbed(dbRadio)
							.then(() =>
								{
									// Try to update the player embed again later
									this.playerEmbedUpdater = setTimeout(playerEmbedUpdate, 1000)
								})
					}
				}

			if (this.playerEmbedUpdater)
			{
				clearTimeout(this.playerEmbedUpdater)
			}

			// Update the player embed
			playerEmbedUpdate()
		});

		player.on(AudioPlayerStatus.Buffering, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the Buffering state!', 'PlayCommand') //, oldState, newState)

			if (this.playerEmbedUpdater)
			{
				clearTimeout(this.playerEmbedUpdater)
			}

			// Update the player embed
			this.updateMessageEmbed(dbRadio)
		});

		player.on(AudioPlayerStatus.AutoPaused, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the AutoPaused state!', 'PlayCommand') //, oldState, newState)

			if (this.playerEmbedUpdater)
			{
				clearTimeout(this.playerEmbedUpdater)
			}

			// Update the status embed
			this.updateMessageEmbed(dbRadio)
		});

		player.on(AudioPlayerStatus.Paused, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the Paused state!', 'PlayCommand') //, oldState, newState)

			if (this.playerEmbedUpdater)
			{
				clearTimeout(this.playerEmbedUpdater)
			}

			// Update the status embed
			this.updateMessageEmbed(dbRadio)
		});

		player.on(AudioPlayerStatus.Idle, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the Idle state!', 'PlayCommand') //, oldState, newState)

			// this.connection?.disconnect() // Rejoining afterwards does not work
			// this.playerSubscription?.player.stop()
			// this.playerSubscription?.unsubscribe()
			// voiceChannel.guild.me?.voice.disconnect()

			if (this.playerEmbedUpdater)
			{
				clearTimeout(this.playerEmbedUpdater)
			}

			// Update the status embed
			this.updateMessageEmbed(dbRadio)

			// Try to play the next track
			this.playNext(dbRadio)
		});

		// this.players.set(listener.id, player)
		this.player = player
		return player
	}

	// protected stopPlayer(listenerId: string): void
	protected stopPlayer(): void
	{
		// const player = this.players.get(listenerId)
		// if (player)
		// {
		// 	player.stop()
		// 	this.players.delete(listenerId)
		// }

		if (this.playerSubscription)
		{
			this.playerSubscription.unsubscribe()
			this.playerSubscription = undefined
		}

		if (this.player)
		{
			const result = this.player.stop()
			this.player = undefined

			if (!result)
			{
				this.bot.logger.warn('Player stop failed', 'PlayCommand')
			}
		}
	}

	async onCommandInteraction(interaction: Discord.CommandInteraction): Promise<void>
	{
		if (!interaction.isCommand() || !interaction.guild || !interaction.channel || !(interaction.member instanceof Discord.GuildMember))
		{
			return
		}

		const guild = interaction.guild
		const dbRadio = this.state.db.guilds.getGuild(guild).radio

		const voiceChannel = interaction.member.voice.channel
		if (!voiceChannel)
		{
			interaction.reply({
					content: 'Vous devez être dans un salon vocal pour jouer une musique.',
					ephemeral: true,
				})
			return
		}
		else if (!voiceChannel.joinable)
		{
			this.bot.logger.debug(`Unable to join voice channel ${voiceChannel.name} (${voiceChannel.id})`, 'PlayCommand')
			interaction.reply({
					content: 'Je suis dans l\'incapacité de te rejoindre dans le salon vocal, désolé.',
					ephemeral: true,
				})
			return
		}

		// const resourceUrl = interaction.options.getString('url')
		const resourceUrl = interaction.options.get('url')?.value
		if (resourceUrl && typeof resourceUrl === 'string')
		{
			if (this.player) // s.size > 0) // this.isPlaying)
			{
				// Add track to the queue
				this.bot.logger.debug(`Push track to the queue: ${resourceUrl}`, 'PlayCommand')
				dbRadio.queue.push(resourceUrl)

				// YTDL.getInfo(resourceUrl)
				// 	.then(info =>
				// 		{
				// 			interaction.reply({
				// 					content: `J'ai ajouté **${info.videoDetails.title}** à la playlist`,
				// 					ephemeral: true,
				// 				})
				// 		})
			}
			else
			{
				// Add track to play now
				this.bot.logger.debug(`Unshift track to the queue: ${resourceUrl}`, 'PlayCommand')
				dbRadio.queue.unshift(resourceUrl)
			}
		}

		if (this.playerSubscription) // && this.isPlaying)
		{
			if (this.playerSubscription.player.state.status !== AudioPlayerStatus.Playing)
			{
				// this.player.play()
				// interaction.reply(`Reprise de la lecture`, await getStatusEmbed())
				interaction.reply({
						content: `Reprise de la lecture`,
						ephemeral: true,
					})
			}

			else if (!resourceUrl)
			{
				// interaction.reply(`Je suis déjà en train de jouer quelque chose !`, await getStatusEmbed())
				interaction.reply({
						content: `Je suis déjà en train de jouer quelque chose !`,
						ephemeral: true,
					})
			}

			interaction.reply({
					content: `J'ai ajouté ta musique à la playlist`,
					ephemeral: true,
				})
			return
		}

		// if (dbRadio.listenerId)
		// {
		// 	this.bot.listeners.delete(dbRadio.listenerId)
		// }

		interaction.deferReply()

		// Post the audio player message
		interaction.channel.send({
				content: 'Chargement...',
			})
			.then(message =>
				{
					// Configure the radio
					dbRadio.volume = 0.5
					dbRadio.embedMessageId = message.id
					dbRadio.authorId = interaction.user.id
					dbRadio.guildId = guild.id
					dbRadio.voiceChannelId = voiceChannel.id
					dbRadio.messageChannelId = message.channel.id
					dbRadio.messageId = message.id
					dbRadio.embedTitle = '📻 🎶  2GETHER Radio'
					dbRadio.embedColor = '#0099ff'

					// Inform the user that the message listener has been created
					return this.updateMessageEmbed(dbRadio, message)
						// .then(updatedMessage => updatedMessage.edit({ content: null }))
						.then(updatedMessage => updatedMessage.edit(
							{
								content: null,
								components: [
									new Discord.ActionRowBuilder<Discord.ButtonBuilder>()
										.setComponents(
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_PREVIOUS)
												.setLabel(RadioControlEmojis.PREVIOUS)
												.setStyle(Discord.ButtonStyle.Secondary),
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_PLAY)
												.setLabel(RadioControlEmojis.PLAY)
												.setStyle(Discord.ButtonStyle.Secondary),
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_PAUSE)
												.setLabel(RadioControlEmojis.PAUSE)
												.setStyle(Discord.ButtonStyle.Secondary),
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_NEXT)
												.setLabel(RadioControlEmojis.NEXT)
												.setStyle(Discord.ButtonStyle.Secondary),
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_LOOP_TOGGLE)
												.setLabel(RadioControlEmojis.LOOP_TOGGLE)
												.setStyle(Discord.ButtonStyle.Secondary),
										),
									new Discord.ActionRowBuilder<Discord.ButtonBuilder>()
										.setComponents(
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_CLEAR)
												.setLabel(RadioControlEmojis.CLEAR)
												.setStyle(Discord.ButtonStyle.Secondary),
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_STOP)
												.setLabel(RadioControlEmojis.STOP)
												.setStyle(Discord.ButtonStyle.Secondary),
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_MUTE)
												.setLabel(RadioControlEmojis.MUTE)
												.setStyle(Discord.ButtonStyle.Secondary),
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_VOLUME_DOWN)
												.setLabel(RadioControlEmojis.VOLUME_DOWN)
												.setStyle(Discord.ButtonStyle.Secondary),
											new Discord.ButtonBuilder()
												.setCustomId(this.COMPONENT_VOLUME_UP)
												.setLabel(RadioControlEmojis.VOLUME_UP)
												.setStyle(Discord.ButtonStyle.Secondary),
										),
								]
							}))
						.then(_ =>
							{
								// Play the next track, if any
								return this.playNext(dbRadio)
							})
				})
			.then(() => interaction.editReply({ content: 'C\'est bon !' })) // ephemeral: true
			.catch(error =>
				{
					// TODO: clean up? delete the message? edit it to say it failed?
					this.bot.logger.error('An error occurred', 'PlayCommand', error)
				})
	}

	public async onComponentInteraction(interaction: Discord.MessageComponentInteraction)
	{
		if (!interaction.guild)
		{
			return
		}

		interaction.deferUpdate()

		// const data = dbListener.data as MessageComponentListenerData
		const dbRadio = this.state.db.guilds.getGuild(interaction.guild).radio

		const componentsHandlers = new Map<string, () => Promise<void>>()
			.set(this.COMPONENT_PLAY, this.componentPlayHandler.bind(this, dbRadio))
			.set(this.COMPONENT_PAUSE, this.componentPauseHandler.bind(this, dbRadio))
			.set(this.COMPONENT_PREVIOUS, this.componentPreviousHandler.bind(this, dbRadio))
			.set(this.COMPONENT_NEXT, this.componentNextHandler.bind(this, dbRadio))
			.set(this.COMPONENT_LOOP_TOGGLE, this.componentLoopToggleHandler.bind(this, dbRadio))
			.set(this.COMPONENT_CLEAR, this.componentClearHandler.bind(this, dbRadio))
			.set(this.COMPONENT_STOP, this.componentStopHandler.bind(this, dbRadio))
			.set(this.COMPONENT_MUTE, this.componentMuteHandler.bind(this, dbRadio))
			.set(this.COMPONENT_VOLUME_DOWN, this.componentVolumeDownHandler.bind(this, dbRadio))
			.set(this.COMPONENT_VOLUME_UP, this.componentVolumeUpHandler.bind(this, dbRadio))

		const componentsHandler = componentsHandlers.get(interaction.customId)
		if (!componentsHandler)
		{
			this.bot.logger.warn(`Unknown component ID: ${interaction.customId}`, 'PlayCommand')
			return
		}

		componentsHandler()
			.then(() =>
				{
					this.updateMessageEmbed(dbRadio)
						// .then(() => interaction.update({}))
				})
	}

	// protected async updateMessageEmbed(message: Discord.Message, dbComponentListener: DBListener | undefined, dbRadio: Radio): Promise<Discord.Message>
	// protected async updateMessageEmbed(listener: MessageComponentListener, dbComponentListener: DBListener | undefined, dbRadio: Radio): Promise<Discord.Message>
	protected async updateMessageEmbed(dbRadio: Radio, message?: Discord.Message): Promise<Discord.Message>
	{
		if (!message)
		{
			if (dbRadio.messageChannelId && dbRadio.messageId)
			{
				const channel = await this.bot.client.channels.fetch(dbRadio.messageChannelId)
				if (channel instanceof Discord.TextChannel)
				{
					message = await channel.messages.fetch(dbRadio.messageId)
				}
			}

			if (!message)
			{
				this.bot.logger.error('No message to update', 'PlayCommand')
				throw new Error('No message to update')
			}
		}

		// const embed = new Discord.MessageEmbed(message.embeds[0])
		const embed = new Discord.EmbedBuilder()
		embed.spliceFields(0, 25) // Reset fields

		// if (!dbComponentListener)
		// {
		// 	embed.setTitle('Invalide')
		// 	embed.setDescription('Le système de rôle est en échec.')
		// 	embed.setColor('#ff0000')
		// }
		// else
		// {
		// 	const data = dbComponentListener.data as MessageComponentListenerData
		embed.setTitle(dbRadio.embedTitle)
		embed.setColor(dbRadio.embedColor)

		// if (dbRadio.status) embed.addFields({ name: 'status', value: dbRadio.status, inline: false })

		embed.addFields(
			{ name: 'Ajouter une musique', value: `\`/play url:<YouTube url>\``, inline: false },
			{ name: 'len(queue)', value: `${dbRadio.queue.length}`, inline: true },
			{ name: 'len(history)', value: `${dbRadio.history.length}`, inline: true },
			{ name: 'loopMode', value: `${dbRadio.loopMode}`, inline: true },
			{ name: 'volume', value: `${dbRadio.volume * 100} %`, inline: true },
			// { name: 'queue', value: `:${dbRadio.queue.join(',')}`, inline: false },
			// { name: 'lastPlayed', value: `${dbRadio.lastPlayed}`, inline: false },
		)

		const getTrackInfo = async (urls: string[], index: number) =>
		{
			if (urls.length > 0 && index >= 0 && index < urls.length)
			{
				try
				{
					return await YTDL.getInfo(urls[index])
				}
				catch
				{
					// Failed to get info
					urls.splice(index, 1) // Remove invalid URL from history
				}
			}

			return undefined
		}

		const nextTrackInfo = await getTrackInfo(dbRadio.queue, 0)
		const nextTrackTitle = nextTrackInfo ? `\n\n⏭️  \`${nextTrackInfo.videoDetails.title}\`` : ''

		// const player = this.players.get(listener.id)
		const player = this.player
		if (player)
		{
			let status = player.state.status === AudioPlayerStatus.Playing
				? '▶️' // Play icon
				: '⏸' // Pause icon

			const currentTrackInfo = await getTrackInfo(dbRadio.history, dbRadio.history.length - 1)
			const currentTrackTitle = currentTrackInfo
				? `${status}  \`${currentTrackInfo.videoDetails.title}\``
				: `${status}  _Pas d'information_`

			const progressLine = ((): string =>
				{
					const playbackDuration = (player.state as { playbackDuration?: number }).playbackDuration
					if (playbackDuration === undefined)
					{
						return ''
					}

					const playbackSeconds = playbackDuration / 1000

					if (currentTrackInfo)
					{
						const totalSeconds = parseInt(currentTrackInfo.videoDetails.lengthSeconds)

						const progressBar = new Array(12).fill('▬')
						progressBar[Math.floor(playbackSeconds / totalSeconds * progressBar.length)] = '🔵'
						return `\n${this.secondsToStr(playbackSeconds)} ${progressBar.join('')} ${this.secondsToStr(totalSeconds)}`
					}

					return `\n${this.secondsToStr(playbackSeconds)} ▬🔵▬▬▬▬▬▬▬▬▬▬ ▬ ▬ ▬`
				})()

			embed.setDescription(`${currentTrackTitle}${progressLine}${nextTrackTitle}`)
		}
		else {
			const currentTrackTitle = `⏹  _Radio stoppée_`

			embed.setDescription(`${currentTrackTitle}${nextTrackTitle}`)
		}
		// }

		return message.edit({ embeds: [ embed ] })
	}

	// // protected updateMessageEmbedStatus(message: Discord.Message, dbComponentListener: DBListener | undefined, dbRadio: Radio, status: string): Promise<Discord.Message>
	// protected async updateMessageEmbedStatus(listener: MessageComponentListener, dbComponentListener: DBListener | undefined, dbRadio: Radio, status: string): Promise<Discord.Message>
	// {
	// 	if (dbComponentListener)
	// 	{
	// 		(dbComponentListener.data as MessageComponentListenerData).status = status
	// 		this.state.save()
	// 	}

	// 	return this.updateMessageEmbed(listener, dbComponentListener, dbRadio)
	// }

	protected secondsToStr(seconds: number)
	{
		// Compute units
		let minutes = seconds / 60
		let hours = minutes / 60

		// Reduce units
		seconds = Math.floor(seconds % 60)
		minutes = Math.floor(minutes % 60)
		hours = Math.floor(hours)

		// Return result
		if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
		else if (minutes > 0) return `${minutes}m ${seconds}s`;
		else return `${seconds}s`;
	}

	// protected async playNext(_connection: VoiceConnection | undefined, listener: MessageComponentListener, _dbRadio?: Radio): Promise<void>
	protected async playNext(_dbRadio: Radio): Promise<void>
	{
		const dbRadio = _dbRadio

		// const guild = listener.message.guild
		const guild = dbRadio.guildId ? await this.bot.client.guilds.fetch(dbRadio.guildId) : undefined
		if (!guild)
		{
			this.bot.logger.debug('playNext: No guild', 'PlayCommand')
			return
		}

		// Note: guild.me does not exist
		// const connection = await this.getConnection(guild.me?.voice.channel ?? dbRadio.voiceChannelId)
		const connection = await this.getConnection(dbRadio.voiceChannelId)
		if (!connection)
		{
			// this.bot.logger.error(`playNext: No voice connection (channel: ${guild.me?.voice.channel?.id})`, 'PlayCommand')
			this.bot.logger.error(`playNext: No voice connection (channel: ${dbRadio.voiceChannelId})`, 'PlayCommand')
			return
		}

		// const dbRadio = _dbRadio ?? this.state.db.guilds.getGuild(guild).radio

		this.bot.logger.debug('playNext', 'PlayCommand')

		const hadPlayer = this.player !== undefined // s.has(listener.id)

		// Unqueue the next track to play
		const nextTrack = dbRadio.queue.shift()
		if (!nextTrack)
		{
			// Nothing next to play
			// message.channel.send(`Fini, la playlist est vide`, await getStatusEmbed());

			// Mute the bot
			// connection.setSpeaking(false)
			// guild.me?.voice.setMute(true)
			// 	.catch(error => this.bot.logger.warn('Failed to mute', 'PlayCommand', error))

			// Stop the player if it is initialized
			this.stopPlayer()

			return
		}

		// Push the track to play in history
		dbRadio.history.push(nextTrack)

		// Save changes to the queue
		this.state.save()

		// Unmute
		// connection.setSpeaking(true)
		// await guild.me?.voice.setMute(false)
		// 	.catch(error => this.bot.logger.error('Failed to unmute', 'PlayCommand', error))

		const stream = YTDL(nextTrack,
			{
				quality: 'highestaudio',
				highWaterMark: 1 << 25,
			})

		const inlineVolume = true
		const resource = createAudioResource(stream,
			{
				inlineVolume: inlineVolume,
				metadata:
					{
						title: 'Meep. owo',
					},

			})

		// const connection = this.getConnection(voiceChannel)
		if (connection.state.status === VoiceConnectionStatus.Disconnected)
		{
			this.bot.logger.debug('Reconnecting voice connection', 'PlayCommand')
			connection.rejoin()
		}

		const player = this.getPlayer(dbRadio)
		this.playerSubscription = connection.subscribe(player)
		// this.playerSubscription?.connection.on()
		// this.playerSubscription?.player.on()

		player.play(resource)
	}

	// protected async setVolume(listener: MessageComponentListener, dbRadio: Radio, volume: number): Promise<void>
	protected async setVolume(dbRadio: Radio, volume?: number): Promise<void>
	{
		if (!this.playerSubscription)
		{
			this.bot.logger.warn('setVolume: No player', 'PlayCommand')
			throw new Error('No player')
		}

		const state = this.playerSubscription.player.state
		if (state.status === AudioPlayerStatus.Playing || state.status === AudioPlayerStatus.Paused)
		{
			if (!state.resource.volume)
			{
				this.bot.logger.warn(`setVolume: Not using inline volume`, 'PlayCommand')
				return
			}

			if (volume !== undefined)
			{
				if (volume <= Number.EPSILON)
				{
					volume = 0
				}
				else if (volume >= 1 - Number.EPSILON)
				{
					volume = 1
				}
				else
				{
					// Round to 2 decimals to avoid floating point errors
					volume = Math.round(volume * 100) / 100
				}
			}
			else
			{
				volume = dbRadio.volume
			}

			state.resource.volume.setVolumeLogarithmic(volume)
			dbRadio.volume = volume
			return
		}

		this.bot.logger.debug(`setVolume: Not playing`, 'PlayCommand')
	}

	protected async componentPlayHandler(dbRadio: Radio)
	{
		this.player ? this.player.unpause() : this.playNext(dbRadio)
	}

	protected async componentPauseHandler(dbRadio: Radio)
	{
		this.player && this.player.pause()
	}

	protected async componentPreviousHandler(dbRadio: Radio)
	{
		// Pop the history twice if a track is currently playing (the first popped track is the current track)
		const popCount = this.player ? 2 : 1

		// Pop the history and add the popped tracks to the queue
		for (let i = 0; i < popCount; ++i)
		{
			if (dbRadio.history.length > 0)
			{
				const track = dbRadio.history.pop()
				track && dbRadio.queue.unshift(track)
			}
		}

		// Then, play the previous track as the next track
		this.playNext(dbRadio)
	}

	protected async componentNextHandler(dbRadio: Radio)
	{
		this.playNext(dbRadio)
	}

	protected async componentLoopToggleHandler(dbRadio: Radio)
	{
		if (dbRadio.loopMode === RadioLoopMode.NONE)
		{
			dbRadio.loopMode = RadioLoopMode.QUEUE
		}
		else if (dbRadio.loopMode === RadioLoopMode.QUEUE)
		{
			dbRadio.loopMode = RadioLoopMode.SINGLE
		}
		else
		{
			dbRadio.loopMode = RadioLoopMode.NONE
		}
	}

	protected async componentClearHandler(dbRadio: Radio)
	{
		// Clear the queue and history
		// If playing, leave the playing track in the history, otherwise clear it entirely
		dbRadio.queue = []
		dbRadio.history = this.player && dbRadio.history.length > 0 ? [dbRadio.history[dbRadio.history.length - 1]] : []
	}

	protected async componentStopHandler(dbRadio: Radio)
	{
		this.stopPlayer()
	}

	protected async componentMuteHandler(dbRadio: Radio)
	{
		return this.setVolume(dbRadio, 0)
	}

	protected async componentVolumeDownHandler(dbRadio: Radio)
	{
		return this.setVolume(dbRadio, dbRadio.volume - .1)
	}

	protected async componentVolumeUpHandler(dbRadio: Radio)
	{
		return this.setVolume(dbRadio, dbRadio.volume + .1)
	}
}

export default PlayCommand
