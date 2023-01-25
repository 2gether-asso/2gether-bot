import { AudioPlayer, AudioPlayerState, AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, PlayerSubscription, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice'
import { Discord, Mel } from 'discord-mel'
import YTDL from 'ytdl-core'

// import RadioRunResults from '../enums/RadioRunResults.js'
import RadioData from '../state/types/Radio.js'
import AbstractEntity from './AbstractEntity.js'

class Radio extends AbstractEntity
{
	// Radio state data
	public readonly data: RadioData

	// public radioMessage: Discord.Message

	protected guildPromise?: Promise<Discord.Guild>

	protected messagePromise?: Promise<Discord.Message<true>>

	protected player?: AudioPlayer

	protected playerSubscription?: PlayerSubscription

	protected playerEmbedUpdater?: NodeJS.Timeout

	protected embed: Discord.EmbedBuilder

	public constructor(bot: Mel, radioData: RadioData)
	{
		super(bot)

		this.data = radioData

		this.embed = this.initEmbed()
	}

	public async getGuild(reload: boolean = false): Promise<Discord.Guild>
	{
		if (reload || !this.guildPromise)
		{
			this.guildPromise = this.bot.client.guilds.fetch(this.data.guildId)
				.catch(error =>
					{
						this.bot.logger.warn(`Failed to fetch radio guild`, 'Radio', error)
						return Promise.reject(error)
					})
		}

		return this.guildPromise
	}

	protected async getTextChannel(): Promise<Discord.GuildBasedChannel & Discord.TextBasedChannel>
	{
		if (!this.data.messageChannelId)
		{
			return Promise.reject(new Error('Radio message channel ID not specified'))
		}

		return this.bot.client.channels.fetch(this.data.messageChannelId)
			.catch(error =>
				{
					this.bot.logger.warn(`Failed to fetch radio message channel`, 'Radio', error)
					return Promise.reject(new Error('Failed to fetch radio message channel'))
				})
			.then(channel =>
				{
					if (!(channel instanceof Discord.GuildChannel) || !channel.isTextBased())
					{
						return Promise.reject(new Error('Radio message channel is not a guild text channel'))
					}

					return channel
				})
	}

	public async getMessage(reload: boolean = false): Promise<Discord.Message<true>>
	{
		if (reload || !this.messagePromise)
		{
			if (!this.data.messageChannelId)
			{
				return Promise.reject(new Error('Radio message channel ID not specified'))
			}

			if (!this.data.messageId)
			{
				return Promise.reject(new Error('Radio message ID not specified'))
			}

			const messageId = this.data.messageId
			this.messagePromise = this.getTextChannel()
				.then(channel => channel.messages.fetch({ message: messageId, force: true }))
				.catch(error =>
					{
						this.bot.logger.warn(`Failed to fetch radio message`, 'Radio', error)
						return Promise.reject('Failed to fetch radio message')
					})
		}

		return this.messagePromise
	}

	protected async updateMessageOrCreate(messagePayload: Discord.BaseMessageOptions): Promise<Discord.Message<true>>
	{
		const message = await this.getMessage().catch(_ => undefined)
		if (message)
		{
			return message.edit(messagePayload)
				.catch(error =>
					{
						this.bot.logger.warn(`Failed to edit radio message`, 'Radio', error)
						return Promise.reject('Failed to edit radio message')
					})
		}

		return this.getTextChannel()
			.then(channel => channel.send(messagePayload))
			.then(message =>
				{
					this.data.messageId = message.id
					this.state.save()

					return message
				})
			.catch(error =>
				{
					this.bot.logger.warn(`Failed to send radio message`, 'Radio', error)
					return Promise.reject('Failed to send radio message')
				})
	}

	protected async clearMessage(): Promise<void>
	{
		await this.clearMessageEmbed()
			.catch(error => this.bot.logger.warn(`No radio message embed to clear`, 'Radio', error))

		this.messagePromise = undefined
	}

	public isExpired(): boolean
	{
		// Expire delay : 20 minutes (in milliseconds)
		// 20 minutes = 20 * 60 * 1000 = 1200000
		return !this.player || this.data.lastUpdateTime + 1200000 < Date.now()
	}

	public queueTrack(resourceUrl: string): void
	{
		this.data.queue.push(resourceUrl)
	}

	public queueTrackFirst(resourceUrl: string): void
	{
		this.data.queue.unshift(resourceUrl)
	}

	public nextTrack(): string | undefined
	{
		if (this.data.currentTrack)
		{
			this.data.history.push(this.data.currentTrack)
		}

		this.data.currentTrack = this.data.queue.shift()

		// Save changes
		this.state.save()

		return this.data.currentTrack
	}

	public clearQueue(): void
	{
		this.data.queue = []
	}

	public clearHistory(): void
	{
		this.data.history = []
	}

	public isPlayer(): boolean
	{
		return this.player !== undefined
	}

	public getPlayer(): AudioPlayer
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

		player.on(AudioPlayerStatus.Playing, this.onAudioPlayerPlaying.bind(this))
		player.on(AudioPlayerStatus.Buffering, this.onAudioPlayerBuffering.bind(this))
		player.on(AudioPlayerStatus.Idle, this.onAudioPlayerIdle.bind(this))
		player.on(AudioPlayerStatus.Paused, this.onAudioPlayerPaused.bind(this))
		player.on(AudioPlayerStatus.AutoPaused, this.onAudioPlayerAutoPaused.bind(this))

		this.player = player
		return player
	}

	public stopPlayer(): void
	{
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

		this.data.lastUpdateTime = Date.now()
	}

	protected onAudioPlayerPlaying(oldState: AudioPlayerState, newState: AudioPlayerState & { status: AudioPlayerStatus }): void
	{
		this.bot.logger.debug('Audio player is in the Playing state!', 'PlayCommand') //, oldState, newState)

		// Fix volume to the current value
		this.setVolume()

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
					this.updateMessageEmbed()
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
	}

	protected onAudioPlayerBuffering(oldState: AudioPlayerState, newState: AudioPlayerState & { status: AudioPlayerStatus }): void
	{
		this.bot.logger.debug('Audio player is in the Buffering state!', 'PlayCommand') //, oldState, newState)

		if (this.playerEmbedUpdater)
		{
			clearTimeout(this.playerEmbedUpdater)
		}

		// Update the player embed
		this.updateMessageEmbed()
	}

	protected onAudioPlayerAutoPaused(oldState: AudioPlayerState, newState: AudioPlayerState & { status: AudioPlayerStatus }): void
	{
		this.bot.logger.debug('Audio player is in the AutoPaused state!', 'PlayCommand') //, oldState, newState)

		if (this.playerEmbedUpdater)
		{
			clearTimeout(this.playerEmbedUpdater)
		}

		// Update the status embed
		this.updateMessageEmbed()
	}

	protected onAudioPlayerPaused(oldState: AudioPlayerState, newState: AudioPlayerState & { status: AudioPlayerStatus }): void
	{
		this.bot.logger.debug('Audio player is in the Paused state!', 'PlayCommand') //, oldState, newState)

		if (this.playerEmbedUpdater)
		{
			clearTimeout(this.playerEmbedUpdater)
		}

		// Update the status embed
		this.updateMessageEmbed()
	}

	protected onAudioPlayerIdle(oldState: AudioPlayerState, newState: AudioPlayerState & { status: AudioPlayerStatus }): void
	{
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
		this.updateMessageEmbed()

		// Try to play the next track
		this.playNext()
	}

	public getPlayerSubscription(): PlayerSubscription | undefined
	{
		return this.playerSubscription
	}

	protected async getConnection(): Promise<VoiceConnection | undefined>
	{
		if (!this.data.guildId || !this.data.voiceChannelId)
		{
			return undefined
		}

		// Best practice to not track the voice connection manually
		const connection = getVoiceConnection(this.data.guildId)
		if (connection)
		{
			return connection
		}

		const guild = await this.getGuild().catch(() => undefined)
		if (!guild)
		{
			this.bot.logger.debug('getConnection: No guild', 'PlayCommand')
			return
		}

		// Create a new connection
		// this.voiceChannel = voiceChannel
		const newConnection = joinVoiceChannel({
			channelId: this.data.voiceChannelId,
			guildId: this.data.guildId,
			adapterCreator: guild.voiceAdapterCreator,
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
	}

	public async setVolume(volume?: number): Promise<void>
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
				volume = this.data.volume
			}

			state.resource.volume.setVolumeLogarithmic(volume)
			this.data.volume = volume
			return
		}

		this.bot.logger.debug(`setVolume: Not playing`, 'PlayCommand')
	}

	public play(): void
	{
		if (this.player)
		{
			this.player.unpause()
			this.data.lastUpdateTime = Date.now()
			return
		}

		this.playNext()
	}

	public pause(): void
	{
		this.player && this.player.pause()
		this.data.lastUpdateTime = Date.now()
	}

	public async playNext(): Promise<void>
	{
		const guild = await this.getGuild().catch(() => undefined)
		if (!guild)
		{
			this.bot.logger.debug('playNext: No guild', 'PlayCommand')
			return
		}

		const connection = await this.getConnection()
		if (!connection)
		{
			// this.bot.logger.error(`playNext: No voice connection (channel: ${guild.me?.voice.channel?.id})`, 'PlayCommand')
			this.bot.logger.error(`playNext: No voice connection (channel: ${this.data.voiceChannelId})`, 'PlayCommand')
			return
		}

		this.bot.logger.debug('playNext', 'PlayCommand')

		// Unqueue the next track to play
		const nextTrack = this.nextTrack()
		if (!nextTrack)
		{
			// Nothing to play, stop the player
			this.stopPlayer()
			return
		}

		const stream = YTDL(nextTrack,
			{
				quality: 'highestaudio',
				highWaterMark: 1 << 25,
			})

		const inlineVolume = true
		const resource = createAudioResource(stream,
			{
				inlineVolume: inlineVolume,
			})

		// const connection = this.getConnection(voiceChannel)
		if (connection.state.status === VoiceConnectionStatus.Disconnected)
		{
			this.bot.logger.debug('Reconnecting voice connection', 'PlayCommand')
			connection.rejoin()
		}

		const player = this.getPlayer()
		this.playerSubscription = connection.subscribe(player)

		player.play(resource)
		this.data.lastUpdateTime = Date.now()
	}

	public reset(): void
	{
		this.stopPlayer()
		this.clearMessage()
	}

	protected async getTrackInfoAndCheck(urls: string[], index: number): Promise<YTDL.videoInfo | undefined>
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
		if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
		if (minutes > 0) return `${minutes}m ${seconds}s`
		return `${seconds}s`
	}

	protected initEmbed(): Discord.EmbedBuilder
	{
		const embed = new Discord.EmbedBuilder()

		embed.setTitle(this.data.embedTitle)
		embed.setColor(this.data.embedColor)

		embed.setDescription('⏹  _Radio stoppée_')

		// Reset fields
		embed.spliceFields(0, 25)

		embed.addFields(
			{ name: 'Ajouter une musique', value: `\`/play <YouTube URL>\``, inline: false },
			{ name: 'len(queue)', value: `${this.data.queue.length}`, inline: true },
			{ name: 'len(history)', value: `${this.data.history.length}`, inline: true },
			{ name: 'loopMode', value: `${this.data.loopMode}`, inline: true },
			{ name: 'volume', value: `${this.data.volume * 100} %`, inline: true },
			// { name: 'queue', value: `:${this.data.queue.join(',')}`, inline: false },
			// { name: 'lastPlayed', value: `${this.data.lastPlayed}`, inline: false },
		)

		return embed
	}

	public async updateMessageEmbed(): Promise<Discord.Message>
	{
		// Reset fields
		this.embed.spliceFields(0, 25)

		this.embed.addFields(
			{ name: 'Ajouter une musique', value: `\`/play url:<YouTube url>\``, inline: false },
			{ name: 'len(queue)', value: `${this.data.queue.length}`, inline: true },
			{ name: 'len(history)', value: `${this.data.history.length}`, inline: true },
			{ name: 'loopMode', value: `${this.data.loopMode}`, inline: true },
			{ name: 'volume', value: `${this.data.volume * 100} %`, inline: true },
			// { name: 'queue', value: `:${this.data.queue.join(',')}`, inline: false },
			// { name: 'lastPlayed', value: `${this.data.lastPlayed}`, inline: false },
		)

		const nextTrackInfo = await this.getTrackInfoAndCheck(this.data.queue, 0)
		const nextTrackTitle = nextTrackInfo ? `\n\n⏭️  \`${nextTrackInfo.videoDetails.title}\`` : ''

		const player = this.player
		if (player)
		{
			let status = player.state.status === AudioPlayerStatus.Playing
				? '▶️' // Play icon
				: '⏸' // Pause icon

			const currentTrackInfo = await this.getTrackInfoAndCheck(this.data.history, this.data.history.length - 1)
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

			this.embed.setDescription(`${currentTrackTitle}${progressLine}${nextTrackTitle}`)
		}
		else {
			const currentTrackTitle = `⏹  _Radio stoppée_`

			this.embed.setDescription(`${currentTrackTitle}${nextTrackTitle}`)
		}

		return this.updateMessageOrCreate({ embeds: [ this.embed ] })
	}

	public async clearMessageEmbed(): Promise<Discord.Message>
	{
		const message = await this.getMessage()
			.catch((error) =>
				{
					this.bot.logger.warn(error, 'PlayCommand')
					return undefined
				})

		if (!message)
		{
			throw new Error('No message to update')
		}

		return message.edit({ content: '_Radio terminée_', embeds: [], components: [] })
	}
}

export default Radio
