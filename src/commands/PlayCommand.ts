import { SlashCommandBuilder } from '@discordjs/builders'
import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, PlayerSubscription, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice'
import { Mel, Discord, MessageReactionListenerRegister, DBListener, ListenerTypes, MessageReactionHandler, MessageReactionListener } from 'discord-mel'
import YTDL from 'ytdl-core'
import Radio from '../state/types/Radio'

import AbstractCommand from './AbstractCommand'

class MessageReactionListenerData
{
	public authorId: Discord.Snowflake

	// public emojiRoles: { [emoji: string]: Discord.Snowflake } = {}

	// public configured: boolean = false

	// // title: 'React with an emoji to add or remove yourself a role'
	public title: string //: 'Menu de sélectionner de rôles'

	public status?: string

	public color: Discord.ColorResolvable

	public constructor(authorId: Discord.Snowflake, title: string, color: Discord.ColorResolvable = '#0099ff')
	{
		this.authorId = authorId
		this.title = title
		this.color = color
	}
}

enum RadioControlEmojis
{
	PREVIOUS = '⏮',
	PLAY_TOGGLE = '⏯',
	NEXT = '⏭',
	LOOP_TOGGLE = '🔁',
	CLEAR = '⏏️',
	STOP = '⏹️',
	MUTE = '🔇',
	VOLUME_DOWN = '🔉',
	VOLUME_UP = '🔊',
}

class PlayCommand extends AbstractCommand
{
	public static readonly enabled: boolean = true

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

		this.handlers
			.set(ListenerTypes.MESSAGE_REACTION,
				(new MessageReactionHandler())
					.setFilter(this.messageReactionHandlerFilter.bind(this))
					.configureOptions(options => options
						.setStore(false)
						.setDispose(true)
					)
					.configureOn(on => on
						.setCollect(this.messageReactionHandlerOnCollect.bind(this))
						// .setRemove(this.messageReactionHandlerOnRemove.bind(this))
						// .setEnd(this.messageReactionHandlerOnEnd.bind(this))
					)
			)
	}

	protected getConnection(voiceChannel?: Discord.VoiceChannel | Discord.StageChannel | null): VoiceConnection | undefined
	protected getConnection(voiceChannel: Discord.VoiceChannel | Discord.StageChannel): VoiceConnection
	protected getConnection(voiceChannel?: Discord.VoiceChannel | Discord.StageChannel | null): VoiceConnection | undefined
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

	protected getPlayer(listener: MessageReactionListener): AudioPlayer
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
				// Add the reaction listener
				this.bot.listeners.addFor(message,
						(new MessageReactionListenerRegister())
							.setCommandId(this.id)
							.setIdleTimeout(120000) // 2 minutes
							.setData(new MessageReactionListenerData(interaction.user.id, '2GETHER Radio 📻'))
					)
					.then(listener =>
						{
							const reactionListener = listener as MessageReactionListener

							// Save the reaction listener id
							dbRadio.listenerId = reactionListener.id

							// Inform the user that the message listener has been created
							return this.updateMessageEmbed(reactionListener, listener.getDbListener(), dbRadio)
								.then(updatedMessage => updatedMessage.edit({ content: null }))
								.then(updatedMessage =>
									{
										const connection = this.getConnection(voiceChannel)

										// Play the next track, if any
										return this.playNext(connection, reactionListener, dbRadio)
											.then(async () =>
												{
													for (const emoji of Object.values(RadioControlEmojis))
													{
														await updatedMessage.react(emoji)
													}
												})
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

	// protected async updateMessageEmbed(message: Discord.Message, dbReactionListener: DBListener | undefined, dbRadio: Radio): Promise<Discord.Message>
	protected async updateMessageEmbed(listener: MessageReactionListener, dbReactionListener: DBListener | undefined, dbRadio: Radio): Promise<Discord.Message>
	{
		// const embed = new Discord.MessageEmbed(message.embeds[0])
		const embed = new Discord.MessageEmbed()
		embed.spliceFields(0, 25) // Reset fields

		if (!dbReactionListener)
		{
			embed.setTitle('Invalide')
			embed.setDescription('Le système de rôle est en échec.')
			embed.setColor('#ff0000')
		}
		else
		{
			const data = dbReactionListener.data as MessageReactionListenerData
			embed.setTitle(data.title)
			embed.setColor(data.color)

			if (data.status) embed.addField('status', data.status, false)
			embed.addField('len(queue)', `${dbRadio.queue.length}`, true)
			embed.addField('len(history)', `${dbRadio.history.length}`, true)
			embed.addField('loopMode', `${dbRadio.loopMode}`, true)
			embed.addField('volume', `${dbRadio.volume * 100} %`, true)
			// embed.addField('queue', `:${dbRadio.queue.join(',')}`, false)
			// embed.addField('lastPlayed', `${dbRadio.lastPlayed}`, false)

			const playInstructions = `\n\nAjoutez une musique pour commencer à jouer :\n\`/play url:<YouTube url>\``

			// const player = this.players.get(listener.id)
			const player = this.player
			if (player)
			{
				let status = player.state.status === AudioPlayerStatus.Playing
					? '▶️' // Play icon
					: '⏸' // Pause icon

				// if (!currentTrackInfo && Storage.db.playlist.lastPlayed)
				const currentTrackInfo = dbRadio.history.length > 0 ? await YTDL.getInfo(dbRadio.history[0]) : undefined

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

				embed.setDescription(`${trackTitle}${progressLine}${playInstructions}`)
			}
			else {
				const trackTitle = `⏹ _Rien ne joue_`

				embed.setDescription(`${trackTitle}${playInstructions}`);
			}
		}

		return listener.message.edit({ embeds: [ embed ] })
	}

	// protected updateMessageEmbedStatus(message: Discord.Message, dbReactionListener: DBListener | undefined, dbRadio: Radio, status: string): Promise<Discord.Message>
	protected async updateMessageEmbedStatus(listener: MessageReactionListener, dbReactionListener: DBListener | undefined, dbRadio: Radio, status: string): Promise<Discord.Message>
	{
		if (dbReactionListener)
		{
			(dbReactionListener.data as MessageReactionListenerData).status = status
			this.state.save()
		}

		return this.updateMessageEmbed(listener, dbReactionListener, dbRadio)
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

	protected async playNext(_connection: VoiceConnection | undefined, listener: MessageReactionListener, _dbRadio?: Radio): Promise<void>
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
				// quality: 'highestaudio',
				highWaterMark: 1 << 25,
			})

		const resource = createAudioResource(stream,
			{
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

	// protected async setVolume(listener: MessageReactionListener, dbRadio: Radio, volume: number): Promise<void>
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

		const state = this.playerSubscription.player.state
		if (state.status === AudioPlayerStatus.Playing || state.status === AudioPlayerStatus.Paused)
		{
			if (state.resource.volume)
			{
				state.resource.volume.setVolumeLogarithmic(volume)
				dbRadio.volume = volume
				return
			}
		}

		throw new Error('Cannot change volume')
	}

	protected messageReactionHandlerFilter(listener: MessageReactionListener, reaction: Discord.MessageReaction, user: Discord.User): boolean
	{
		const dbListener = listener.getDbListener()

		return dbListener !== undefined
			// && listener.message.guild !== null
			&& user.bot === false // Ignore bot reactions
	}

	protected async messageReactionHandlerOnCollect(listener: MessageReactionListener, reaction: Discord.MessageReaction, user: Discord.User): Promise<void>
	{
		const dbListener = listener.getDbListener()
		if (!dbListener || !listener.message.guild)
		{
			return
		}

		// const data = dbListener.data as MessageReactionListenerData
		const dbRadio = this.state.db.guilds.getGuild(listener.message.guild).radio

		const reactionEmoji = reaction.emoji.name
		if (reactionEmoji === RadioControlEmojis.PLAY_TOGGLE)
		{
			// this.togglePlay()
			if (this.player)
			{
				if (this.player.state.status === AudioPlayerStatus.Playing)
				{
					this.player.pause()
				}
				else
				{
					this.player.unpause()
				}
			}
		}
		else if (reactionEmoji === RadioControlEmojis.PREVIOUS)
		{
			// this.playPrevious()
		}
		else if (reactionEmoji === RadioControlEmojis.NEXT)
		{
			this.playNext(undefined, listener, dbRadio)
		}
		else if (reactionEmoji === RadioControlEmojis.LOOP_TOGGLE)
		{
			// this.toggleLoop()
		}
		else if (reactionEmoji === RadioControlEmojis.CLEAR)
		{
			// this.clearPlaylist()
		}
		else if (reactionEmoji === RadioControlEmojis.STOP)
		{
			// this.stop()
			this.stopPlayer()
			this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio)
		}
		else if (reactionEmoji === RadioControlEmojis.MUTE)
		{
			this.setVolume(dbRadio, 0)
				.then(() => this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio))
		}
		else if (reactionEmoji === RadioControlEmojis.VOLUME_DOWN)
		{
			this.setVolume(dbRadio, dbRadio.volume - .1)
				.then(() => this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio))
		}
		else if (reactionEmoji === RadioControlEmojis.VOLUME_UP)
		{
			this.setVolume(dbRadio, dbRadio.volume + .1)
				.then(() => this.updateMessageEmbed(listener, listener.getDbListener(), dbRadio))
		}
	}
}

export default PlayCommand
