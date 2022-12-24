import { SlashCommandBuilder } from '@discordjs/builders'
import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, PlayerSubscription, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice'
import { Mel, Discord, MessageReactionListenerRegister, DBListener, ListenerTypes, MessageReactionHandler, MessageReactionListener, MessageComponentListenerRegister, MessageComponentHandler, MessageComponentListener } from 'discord-mel'
import YTDL from 'ytdl-core'
import Radio from '../state/types/Radio'
import RadioLoopMode from '../state/types/RadioLoopMode'

import AbstractCommand from './AbstractCommand'

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
	PREVIOUS = '⏮',
	PLAY = '▶️', // '⏯',
	PAUSE = '⏸️',
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

	protected readonly COMPONENT_PREVIOUS: RadioControlComponentId = `${this.id}:PREVIOUS`
	protected readonly COMPONENT_PLAY: RadioControlComponentId = `${this.id}:PLAY`
	protected readonly COMPONENT_PAUSE: RadioControlComponentId = `${this.id}:PAUSE`
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

	protected playerEmbedUpdater?: NodeJS.Timer

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

		// // Components
		// this.componentIds
		// 	.add(this.COMPONENT_FINISH)
		// 	.add(this.COMPONENT_SELECT_ROLE)

		this.handlers
			.set(ListenerTypes.MESSAGE_COMPONENT,
				(new MessageComponentHandler())
					.setFilter(this.messageComponentHandlerFilter.bind(this))
					.configureOptions(options => options
						.setStore(false)
						.setDispose(true)
					)
					.configureOn(on => on
						.setCollect(this.messageComponentHandlerOnCollect.bind(this))
						// .setRemove(this.messageReactionHandlerOnRemove.bind(this))
						// .setEnd(this.messageReactionHandlerOnEnd.bind(this))
					)
			)
	}

	protected getConnection(voiceChannel: Discord.VoiceChannel | Discord.StageChannel | null | undefined): VoiceConnection | undefined
	protected getConnection(voiceChannel: Discord.VoiceChannel | Discord.StageChannel): VoiceConnection
	protected getConnection(voiceChannel: Discord.VoiceChannel | Discord.StageChannel | null | undefined): VoiceConnection | undefined
	{
		if (!voiceChannel)
		{
			return undefined
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

	protected getPlayer(listener: MessageComponentListener): AudioPlayer
	{
		// const player = this.players.get(listener.id)
		// if (player)
		// {
		// 	return player
		// }

		if (this.player)
		{
			return this.player
		}

		const newPlayer = createAudioPlayer(
			{
				behaviors:
					{
						noSubscriber: NoSubscriberBehavior.Pause,
					}
			})

		newPlayer.on('error', error =>
			this.bot.logger.warn('Player error', 'PlayCommand', error))

		newPlayer.on('debug', message =>
			this.bot.logger.debug(`Player debug:\n${message}`, 'PlayCommand'))

		// newPlayer.on('subscribe', subscription => {})
		// newPlayer.on('unsubscribe', subscription => {})
		// newPlayer.on('stateChange', (oldState, newState) => {})

		// newPlayer.on(AudioPlayerStatus.Playing)
		// newPlayer.on(AudioPlayerStatus.Buffering)
		// newPlayer.on(AudioPlayerStatus.Idle)
		// newPlayer.on(AudioPlayerStatus.Paused)
		// newPlayer.on(AudioPlayerStatus.AutoPaused)

		newPlayer.on(AudioPlayerStatus.Idle, () =>
			{
				// Play the next track
				this.playNext(this.getConnection(listener.message.member?.voice?.channel), listener)
			})

		// this.players.set(listener.id, newPlayer)
		this.player = newPlayer
		return newPlayer
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

	async onCommandInteraction(interaction: Discord.BaseCommandInteraction): Promise<void>
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
			interaction.reply({
					content: 'Je suis dans l\'incapacité de te rejoindre dans le salon vocal, désolé.',
					ephemeral: true,
				})
			return
		}

		const resourceUrl = interaction.options.getString('url')
		if (resourceUrl)
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

			return
		}

		if (dbRadio.listenerId)
		{
			this.bot.listeners.delete(dbRadio.listenerId)
		}

		interaction.deferReply()

		// Post the audio player message
		interaction.channel.send({
				content: 'Chargement...',
			})
			.then(message =>
				// // Add the reaction listener
				// this.bot.listeners.addFor(message,
				// 	(new MessageReactionListenerRegister())
				// 		.setCommandId(this.id)
				// 		.setIdleTimeout(120000) // 2 minutes
				// 		.setData(new MessageReactionListenerData(interaction.user.id, '2GETHER Radio 📻'))
				// 	)
				// Add the component listener
				this.bot.listeners.addFor(message,
					(new MessageComponentListenerRegister())
						.setCommandId(this.id)
						.setIdleTimeout(120000) // 2 minutes
						.setData(new MessageComponentListenerData(interaction.user.id))
					)
					.then(listener =>
						{
							const componentListener = listener as MessageComponentListener

							// Save the reaction listener id
							dbRadio.listenerId = componentListener.id

							// Inform the user that the message listener has been created
							return this.updateMessageEmbed(componentListener, listener.getDbListener(), dbRadio)
								// .then(updatedMessage => updatedMessage.edit({ content: null }))
								.then(updatedMessage => updatedMessage.edit(
									{
										content: null,
										components: [
											new Discord.MessageActionRow()
												.setComponents(
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_PREVIOUS)
														.setLabel(RadioControlEmojis.PREVIOUS)
														.setStyle('SECONDARY'),
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_PLAY)
														.setLabel(RadioControlEmojis.PLAY)
														.setStyle('SECONDARY'),
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_PAUSE)
														.setLabel(RadioControlEmojis.PAUSE)
														.setStyle('SECONDARY'),
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_NEXT)
														.setLabel(RadioControlEmojis.NEXT)
														.setStyle('SECONDARY'),
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_LOOP_TOGGLE)
														.setLabel(RadioControlEmojis.LOOP_TOGGLE)
														.setStyle('SECONDARY'),
												),
											new Discord.MessageActionRow()
												.setComponents(
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_CLEAR)
														.setLabel(RadioControlEmojis.CLEAR)
														.setStyle('SECONDARY'),
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_STOP)
														.setLabel(RadioControlEmojis.STOP)
														.setStyle('SECONDARY'),
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_MUTE)
														.setLabel(RadioControlEmojis.MUTE)
														.setStyle('SECONDARY'),
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_VOLUME_DOWN)
														.setLabel(RadioControlEmojis.VOLUME_DOWN)
														.setStyle('SECONDARY'),
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_VOLUME_UP)
														.setLabel(RadioControlEmojis.VOLUME_UP)
														.setStyle('SECONDARY'),
												),
										]
									}))
								.then(updatedMessage =>
									{
										const connection = this.getConnection(voiceChannel)

										// Play the next track, if any
										return this.playNext(connection, componentListener, dbRadio)
									})
						})
				)
			.then(() => interaction.editReply({ content: 'C\'est bon !' })) // ephemeral: true
			.catch(error =>
				{
					// TODO: clean up? delete the message? edit it to say it failed?
					this.bot.logger.error('An error occurred', 'RoleMenuCommand', error)
				})
	}

	// protected async updateMessageEmbed(message: Discord.Message, dbComponentListener: DBListener | undefined, dbRadio: Radio): Promise<Discord.Message>
	protected async updateMessageEmbed(listener: MessageComponentListener, dbComponentListener: DBListener | undefined, dbRadio: Radio): Promise<Discord.Message>
	{
		// const embed = new Discord.MessageEmbed(message.embeds[0])
		const embed = new Discord.MessageEmbed()
		embed.spliceFields(0, 25) // Reset fields

		if (!dbComponentListener)
		{
			embed.setTitle('Invalide')
			embed.setDescription('Le système de rôle est en échec.')
			embed.setColor('#ff0000')
		}
		else
		{
			const data = dbComponentListener.data as MessageComponentListenerData
			embed.setTitle(data.title)
			embed.setColor(data.color)

			if (data.status) embed.addField('status', data.status, false)
			embed.addField('Ajouter une musique', `\`/play url:<YouTube url>\``, false)
			embed.addField('len(queue)', `${dbRadio.queue.length}`, true)
			embed.addField('len(history)', `${dbRadio.history.length}`, true)
			embed.addField('loopMode', `${dbRadio.loopMode}`, true)
			embed.addField('volume', `${dbRadio.volume * 100} %`, true)
			// embed.addField('queue', `:${dbRadio.queue.join(',')}`, false)
			// embed.addField('lastPlayed', `${dbRadio.lastPlayed}`, false)

			// const player = this.players.get(listener.id)
			const player = this.player
			if (player)
			{
				let status = player.state.status === AudioPlayerStatus.Playing
					? '▶️' // Play icon
					: '⏸' // Pause icon

				// if (!currentTrackInfo && Storage.db.playlist.lastPlayed)
				const currentTrackInfo = dbRadio.history.length > 0 ? await YTDL.getInfo(dbRadio.history[dbRadio.history.length - 1]) : undefined

				const trackTitle = currentTrackInfo
					? `${status} \`${currentTrackInfo.videoDetails.title}\``
					: `${status} _Pas d'information_`

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

				embed.setDescription(`${trackTitle}${progressLine}`)
			}
			else {
				const trackTitle = `⏹ _Rien ne joue_`

				embed.setDescription(`${trackTitle}`)
			}
		}

		return listener.message.edit({ embeds: [ embed ] })
	}

	// protected updateMessageEmbedStatus(message: Discord.Message, dbComponentListener: DBListener | undefined, dbRadio: Radio, status: string): Promise<Discord.Message>
	protected async updateMessageEmbedStatus(listener: MessageComponentListener, dbComponentListener: DBListener | undefined, dbRadio: Radio, status: string): Promise<Discord.Message>
	{
		if (dbComponentListener)
		{
			(dbComponentListener.data as MessageComponentListenerData).status = status
			this.state.save()
		}

		return this.updateMessageEmbed(listener, dbComponentListener, dbRadio)
	}

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

	protected async playNext(_connection: VoiceConnection | undefined, listener: MessageComponentListener, _dbRadio?: Radio): Promise<void>
	{
		const guild = listener.message.guild
		if (!guild)
		{
			return
		}

		const connection = _connection ?? this.getConnection(guild.me?.voice.channel)
		if (!connection)
		{
			this.bot.logger.error('playNext no connection', 'PlayCommand')
			return
		}

		const dbRadio = _dbRadio ?? this.state.db.guilds.getGuild(guild).radio

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

		// Unmute
		// connection.setSpeaking(true)
		// await guild.me?.voice.setMute(false)
		// 	.catch(error => this.bot.logger.error('Failed to unmute', 'PlayCommand', error))

		const stream = YTDL(nextTrack,
			{
				quality: 'highestaudio',
				highWaterMark: 1 << 25,
			})

		const resource = createAudioResource(stream,
			{
				inlineVolume: true,
				metadata:
					{
						title: 'Meep. owo',
					},

			})

		const player = this.getPlayer(listener)
		player.play(resource)

		// const connection = this.getConnection(voiceChannel)
		if (connection.state.status === VoiceConnectionStatus.Disconnected)
		{
			this.bot.logger.debug('reconnecting', 'PlayCommand')
			connection.rejoin()
		}

		this.playerSubscription = connection.subscribe(player)
		// this.playerSubscription?.connection.on()
		// this.playerSubscription?.player.on()

		player.on(AudioPlayerStatus.Playing, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the Playing state!', 'PlayCommand') //, oldState, newState)

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
						this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio)
							.then(() =>
								{
									// Try to update the player embed again later
									setTimeout(playerEmbedUpdate, 1000)
								})
					}
				}

			// Update the player embed
			playerEmbedUpdate()
		});

		player.on(AudioPlayerStatus.Buffering, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the Buffering state!', 'PlayCommand') //, oldState, newState)

			// Update the player embed
			this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio)
		});

		player.on(AudioPlayerStatus.AutoPaused, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the AutoPaused state!', 'PlayCommand') //, oldState, newState)

			// Update the status embed
			this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio)
		});

		player.on(AudioPlayerStatus.Paused, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the Paused state!', 'PlayCommand') //, oldState, newState)

			// Update the status embed
			this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio)
		});

		player.on(AudioPlayerStatus.Idle, (oldState, newState) => {
			this.bot.logger.debug('Audio player is in the Idle state!', 'PlayCommand') //, oldState, newState)

			// this.connection?.disconnect() // Rejoining afterwards does not work
			// this.playerSubscription?.player.stop()
			// this.playerSubscription?.unsubscribe()
			// voiceChannel.guild.me?.voice.disconnect()

			// Update the status embed
			this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio)
		});

		// Save changes to the queue
		this.state.save()
	}

	// protected async setVolume(listener: MessageComponentListener, dbRadio: Radio, volume: number): Promise<void>
	protected async setVolume(dbRadio: Radio, volume: number): Promise<void>
	{
		if (!this.playerSubscription)
		{
			this.bot.logger.warn('setVolume: No player', 'PlayCommand')
			throw new Error('No player')
		}

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

		const state = this.playerSubscription.player.state
		if (state.status === AudioPlayerStatus.Playing || state.status === AudioPlayerStatus.Paused)
		{
			if (state.resource.volume)
			{
				state.resource.volume.setVolumeLogarithmic(volume)
				dbRadio.volume = volume
				return
			}

			this.bot.logger.warn(`setVolume: Not using inline volume`, 'PlayCommand')
			return
		}

		this.bot.logger.debug(`setVolume: Not playing`, 'PlayCommand')
	}

	protected messageComponentHandlerFilter(listener: MessageComponentListener, interaction: Discord.MessageComponentInteraction): boolean
	{
		const dbListener = listener.getDbListener()

		return dbListener !== undefined
			// && listener.message.guild !== null
			// && user.bot === false // Ignore bot reactions
	}

	protected async messageComponentHandlerOnCollect(listener: MessageComponentListener, interaction: Discord.MessageComponentInteraction): Promise<void>
	{
		const dbListener = listener.getDbListener()
		if (!dbListener || !listener.message.guild)
		{
			return
		}

		interaction.deferUpdate()

		// const data = dbListener.data as MessageComponentListenerData
		const dbRadio = this.state.db.guilds.getGuild(listener.message.guild).radio

		// const reactionEmoji = reaction.emoji.name

		// reaction.users.remove(user)
		// 	.catch(() => this.bot.logger.warn('Failed to remove reaction', 'PlayCommand'))

		const componentsHandlers = new Map<string, () => Promise<void>>()
			.set(this.COMPONENT_PLAY, async () =>
				{
					if (this.player)
					{
						this.player.unpause()
					}
				})
			.set(this.COMPONENT_PAUSE, async () =>
				{
					if (this.player)
					{
						this.player.pause()
					}
				})
			.set(this.COMPONENT_PREVIOUS, async () =>
				{
					// this.playPrevious(undefined, listener, dbRadio)
				})
			.set(this.COMPONENT_NEXT, async () =>
				{
					this.playNext(undefined, listener, dbRadio)
				})
			.set(this.COMPONENT_LOOP_TOGGLE, async () =>
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
				})
			.set(this.COMPONENT_STOP, async () =>
				{
					this.stopPlayer()
				})
			.set(this.COMPONENT_CLEAR, async () =>
				{
					// Clear the queue and history, leaving only the last played track
					dbRadio.queue = []
					dbRadio.history = dbRadio.history.length > 0 ? [dbRadio.history[dbRadio.history.length - 1]] : []
					this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio)
				})
			.set(this.COMPONENT_MUTE, async () =>
				{
					return this.setVolume(dbRadio, 0)
				})
			.set(this.COMPONENT_VOLUME_DOWN, async () =>
				{
					return this.setVolume(dbRadio, dbRadio.volume - .1)
				})
			.set(this.COMPONENT_VOLUME_UP, async () =>
				{
					return this.setVolume(dbRadio, dbRadio.volume + .1)
				})

		componentsHandlers.get(interaction.customId)?.()
			.then(() =>
				{
					this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio)
						// .then(() => interaction.update({}))
				})
	}
}

export default PlayCommand
