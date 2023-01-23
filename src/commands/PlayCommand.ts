import { SlashCommandBuilder } from '@discordjs/builders'
import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, PlayerSubscription, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice'
import { Mel, Discord, MessageReactionListenerRegister, DBListener, ListenerTypes, MessageReactionHandler, MessageReactionListener, MessageComponentListenerRegister, MessageComponentHandler, MessageComponentListener } from 'discord-mel'
import YTDL from 'ytdl-core'

import AbstractCommand from './AbstractCommand.js'
import Radio from '../entities/Radio.js'
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
	protected getPlayer(radio: Radio): AudioPlayer
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
			this.setVolume(radio)

			// // Handle loop modes
			// if (radio.data.loopMode === 'single') radio.data.queue.unshift(next);
			// else if (radio.data.loopMode === 'queue') radio.data.queue.push(next);
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
						this.updateMessageEmbed(radio)
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
			this.updateMessageEmbed(radio)
		});

		player.on(AudioPlayerStatus.AutoPaused, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the AutoPaused state!', 'PlayCommand') //, oldState, newState)

			if (this.playerEmbedUpdater)
			{
				clearTimeout(this.playerEmbedUpdater)
			}

			// Update the status embed
			this.updateMessageEmbed(radio)
		});

		player.on(AudioPlayerStatus.Paused, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the Paused state!', 'PlayCommand') //, oldState, newState)

			if (this.playerEmbedUpdater)
			{
				clearTimeout(this.playerEmbedUpdater)
			}

			// Update the status embed
			this.updateMessageEmbed(radio)
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
			this.updateMessageEmbed(radio)

			// Try to play the next track
			this.playNext(radio)
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
		const radio = this.state.db.guilds.getGuild(guild).radio.getEntity(this.bot)

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
				radio.data.queue.push(resourceUrl)

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
				radio.data.queue.unshift(resourceUrl)
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

		// if (radio.data.listenerId)
		// {
		// 	this.bot.listeners.delete(radio.data.listenerId)
		// }

		interaction.deferReply()

		// Post the audio player message
		interaction.channel.send({
				content: 'Chargement...',
			})
			.then(message =>
				{
					// Configure the radio
					radio.data.volume = 0.5
					radio.data.embedMessageId = message.id
					radio.data.authorId = interaction.user.id
					radio.data.guildId = guild.id
					radio.data.voiceChannelId = voiceChannel.id
					radio.data.messageChannelId = message.channel.id
					radio.data.messageId = message.id
					radio.data.embedTitle = '📻 🎶  2GETHER Radio'
					radio.data.embedColor = '#0099ff'

					// Inform the user that the message listener has been created
					return this.updateMessageEmbed(radio, message)
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
								return this.playNext(radio)
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
			.catch(error => this.bot.logger.warn('Component defer updater failed', 'PlayCommand', error))

		// const data = dbListener.data as MessageComponentListenerData
		const radio = this.state.db.guilds.getGuild(interaction.guild).radio.getEntity(this.bot)

		const componentsHandlers = new Map<string, () => Promise<void>>()
			.set(this.COMPONENT_PLAY, this.componentPlayHandler.bind(this, radio))
			.set(this.COMPONENT_PAUSE, this.componentPauseHandler.bind(this, radio))
			.set(this.COMPONENT_PREVIOUS, this.componentPreviousHandler.bind(this, radio))
			.set(this.COMPONENT_NEXT, this.componentNextHandler.bind(this, radio))
			.set(this.COMPONENT_LOOP_TOGGLE, this.componentLoopToggleHandler.bind(this, radio))
			.set(this.COMPONENT_CLEAR, this.componentClearHandler.bind(this, radio))
			.set(this.COMPONENT_STOP, this.componentStopHandler.bind(this, radio))
			.set(this.COMPONENT_MUTE, this.componentMuteHandler.bind(this, radio))
			.set(this.COMPONENT_VOLUME_DOWN, this.componentVolumeDownHandler.bind(this, radio))
			.set(this.COMPONENT_VOLUME_UP, this.componentVolumeUpHandler.bind(this, radio))

		const componentsHandler = componentsHandlers.get(interaction.customId)
		if (!componentsHandler)
		{
			this.bot.logger.warn(`Unknown component ID: ${interaction.customId}`, 'PlayCommand')
			return
		}

		componentsHandler()
			.then(() =>
				{
					this.updateMessageEmbed(radio)
						// .then(() => interaction.update({}))
				})
			.catch(error => this.bot.logger.error('Component handler error', 'PlayCommand', error))
	}

	// protected async updateMessageEmbed(message: Discord.Message, dbComponentListener: DBListener | undefined, radio: Radio): Promise<Discord.Message>
	// protected async updateMessageEmbed(listener: MessageComponentListener, dbComponentListener: DBListener | undefined, radio: Radio): Promise<Discord.Message>
	protected async updateMessageEmbed(radio: Radio, message?: Discord.Message): Promise<Discord.Message>
	{
		if (!message)
		{
			if (radio.data.messageChannelId && radio.data.messageId)
			{
				const channel = await this.bot.client.channels.fetch(radio.data.messageChannelId)
				if (channel instanceof Discord.TextChannel)
				{
					message = await channel.messages.fetch(radio.data.messageId)
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
		embed.setTitle(radio.data.embedTitle)
		embed.setColor(radio.data.embedColor)

		// if (radio.data.status) embed.addFields({ name: 'status', value: radio.data.status, inline: false })

		embed.addFields(
			{ name: 'Ajouter une musique', value: `\`/play url:<YouTube url>\``, inline: false },
			{ name: 'len(queue)', value: `${radio.data.queue.length}`, inline: true },
			{ name: 'len(history)', value: `${radio.data.history.length}`, inline: true },
			{ name: 'loopMode', value: `${radio.data.loopMode}`, inline: true },
			{ name: 'volume', value: `${radio.data.volume * 100} %`, inline: true },
			// { name: 'queue', value: `:${radio.data.queue.join(',')}`, inline: false },
			// { name: 'lastPlayed', value: `${radio.data.lastPlayed}`, inline: false },
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

		const nextTrackInfo = await getTrackInfo(radio.data.queue, 0)
		const nextTrackTitle = nextTrackInfo ? `\n\n⏭️  \`${nextTrackInfo.videoDetails.title}\`` : ''

		// const player = this.players.get(listener.id)
		const player = this.player
		if (player)
		{
			let status = player.state.status === AudioPlayerStatus.Playing
				? '▶️' // Play icon
				: '⏸' // Pause icon

			const currentTrackInfo = await getTrackInfo(radio.data.history, radio.data.history.length - 1)
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

	// // protected updateMessageEmbedStatus(message: Discord.Message, dbComponentListener: DBListener | undefined, radio: Radio, status: string): Promise<Discord.Message>
	// protected async updateMessageEmbedStatus(listener: MessageComponentListener, dbComponentListener: DBListener | undefined, radio: Radio, status: string): Promise<Discord.Message>
	// {
	// 	if (dbComponentListener)
	// 	{
	// 		(dbComponentListener.data as MessageComponentListenerData).status = status
	// 		this.state.save()
	// 	}

	// 	return this.updateMessageEmbed(listener, dbComponentListener, radio)
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

	// protected async playNext(_connection: VoiceConnection | undefined, listener: MessageComponentListener, _radio?: Radio): Promise<void>
	protected async playNext(radio: Radio): Promise<void>
	{
		// const guild = listener.message.guild
		const guild = radio.data.guildId ? await this.bot.client.guilds.fetch(radio.data.guildId) : undefined
		if (!guild)
		{
			this.bot.logger.debug('playNext: No guild', 'PlayCommand')
			return
		}

		// Note: guild.me does not exist
		// const connection = await this.getConnection(guild.me?.voice.channel ?? radio.data.voiceChannelId)
		const connection = await this.getConnection(radio.data.voiceChannelId)
		if (!connection)
		{
			// this.bot.logger.error(`playNext: No voice connection (channel: ${guild.me?.voice.channel?.id})`, 'PlayCommand')
			this.bot.logger.error(`playNext: No voice connection (channel: ${radio.data.voiceChannelId})`, 'PlayCommand')
			return
		}

		// const radio = _radio ?? this.state.db.guilds.getGuild(guild).radio

		this.bot.logger.debug('playNext', 'PlayCommand')

		const hadPlayer = this.player !== undefined // s.has(listener.id)

		// Unqueue the next track to play
		const nextTrack = radio.data.queue.shift()
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
		radio.data.history.push(nextTrack)

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

		const player = this.getPlayer(radio)
		this.playerSubscription = connection.subscribe(player)
		// this.playerSubscription?.connection.on()
		// this.playerSubscription?.player.on()

		player.play(resource)
	}

	// protected async setVolume(listener: MessageComponentListener, radio: Radio, volume: number): Promise<void>
	protected async setVolume(radio: Radio, volume?: number): Promise<void>
	{
		if (!this.playerSubscription)
		{
			this.bot.logger.warn('setVolume: No player', 'PlayCommand')
			return
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
				volume = radio.data.volume
			}

			state.resource.volume.setVolumeLogarithmic(volume)
			radio.data.volume = volume
			return
		}

		this.bot.logger.debug(`setVolume: Not playing`, 'PlayCommand')
	}

	protected async componentPlayHandler(radio: Radio)
	{
		this.player ? this.player.unpause() : this.playNext(radio)
	}

	protected async componentPauseHandler(radio: Radio)
	{
		this.player && this.player.pause()
	}

	protected async componentPreviousHandler(radio: Radio)
	{
		// Pop the history twice if a track is currently playing (the first popped track is the current track)
		const popCount = this.player ? 2 : 1

		// Pop the history and add the popped tracks to the queue
		for (let i = 0; i < popCount; ++i)
		{
			if (radio.data.history.length > 0)
			{
				const track = radio.data.history.pop()
				track && radio.data.queue.unshift(track)
			}
		}

		// Then, play the previous track as the next track
		this.playNext(radio)
	}

	protected async componentNextHandler(radio: Radio)
	{
		this.playNext(radio)
	}

	protected async componentLoopToggleHandler(radio: Radio)
	{
		if (radio.data.loopMode === RadioLoopMode.NONE)
		{
			radio.data.loopMode = RadioLoopMode.QUEUE
		}
		else if (radio.data.loopMode === RadioLoopMode.QUEUE)
		{
			radio.data.loopMode = RadioLoopMode.SINGLE
		}
		else
		{
			radio.data.loopMode = RadioLoopMode.NONE
		}
	}

	protected async componentClearHandler(radio: Radio)
	{
		// Clear the queue and history
		// If playing, leave the playing track in the history, otherwise clear it entirely
		radio.data.queue = []
		radio.data.history = this.player && radio.data.history.length > 0 ? [radio.data.history[radio.data.history.length - 1]] : []
	}

	protected async componentStopHandler(radio: Radio)
	{
		this.stopPlayer()
	}

	protected async componentMuteHandler(radio: Radio)
	{
		return this.setVolume(radio, 0)
	}

	protected async componentVolumeDownHandler(radio: Radio)
	{
		return this.setVolume(radio, radio.data.volume - .1)
	}

	protected async componentVolumeUpHandler(radio: Radio)
	{
		return this.setVolume(radio, radio.data.volume + .1)
	}
}

export default PlayCommand
