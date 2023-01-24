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

	protected messagePromise: Promise<Discord.Message<true>> | undefined = undefined

	protected player?: AudioPlayer

	protected playerSubscription?: PlayerSubscription

	protected playerEmbedUpdater?: NodeJS.Timeout

	public constructor(bot: Mel, radioData: RadioData)
	{
		super(bot)

		this.data = radioData
	}

	public async getMessage(reload: boolean = false): Promise<Discord.Message<true>>
	{
		if (reload || !this.messagePromise)
		{
			if (!this.data.messageChannelId)
			{
				return Promise.reject(new Error('Radio message channel ID not specified'))
			}

			this.messagePromise = this.bot.client.channels.fetch(this.data.messageChannelId)
				.then(channel =>
					{
						if (!this.data.messageId)
						{
							return Promise.reject(new Error('Radio message ID not specified'))
						}

						if (!(channel instanceof Discord.GuildChannel) || !channel.isTextBased())
						{
							return Promise.reject(new Error('Channel is not a guild text channel'))
						}

						return channel.messages.fetch({ message: this.data.messageId, force: true })
					})
				.catch(error =>
					{
						this.bot.logger.warn(`Failed to fetch radio message`, 'Radio', error)
						return Promise.reject(error)
					})
		}

		return this.messagePromise
	}

	public isExpired(): boolean
	{
		// Expire delay : 20 minutes (in milliseconds)
		// 20 minutes = 20 * 60 * 1000 = 1200000
		return this.data.lastUpdateTime + 1200000 < Date.now()
	}

	public addTrack(resourceUrl: string): void
	{
		this.data.queue.push(resourceUrl)
	}

	public addNextTrack(resourceUrl: string): void
	{
		this.data.queue.unshift(resourceUrl)
	}

	public nextTrack(): void
	{
		if (this.data.currentTrack)
		{
			this.data.history.push(this.data.currentTrack)
		}

		this.data.currentTrack = this.data.queue.shift()
	}

	public clearQueue(): void
	{
		this.data.queue = []
	}

	public clearHistory(): void
	{
		this.data.history = []
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

	public async playNext(): Promise<void>
	{
		// const guild = listener.message.guild
		const guild = this.data.guildId ? await this.bot.client.guilds.fetch(this.data.guildId) : undefined
		if (!guild)
		{
			this.bot.logger.debug('playNext: No guild', 'PlayCommand')
			return
		}

		// Note: guild.me does not exist
		// const connection = await this.getConnection(guild.me?.voice.channel ?? this.data.voiceChannelId)
		const connection = await this.getConnection(this.data.voiceChannelId)
		if (!connection)
		{
			// this.bot.logger.error(`playNext: No voice connection (channel: ${guild.me?.voice.channel?.id})`, 'PlayCommand')
			this.bot.logger.error(`playNext: No voice connection (channel: ${this.data.voiceChannelId})`, 'PlayCommand')
			return
		}

		// const radio = _radio ?? this.state.db.guilds.getGuild(guild).radio

		this.bot.logger.debug('playNext', 'PlayCommand')

		const hadPlayer = this.player !== undefined // s.has(listener.id)

		// Unqueue the next track to play
		const nextTrack = this.data.queue.shift()
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
		this.data.history.push(nextTrack)

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
			})

		// const connection = this.getConnection(voiceChannel)
		if (connection.state.status === VoiceConnectionStatus.Disconnected)
		{
			this.bot.logger.debug('Reconnecting voice connection', 'PlayCommand')
			connection.rejoin()
		}

		const player = this.getPlayer()
		this.playerSubscription = connection.subscribe(player)
		// this.playerSubscription?.connection.on()
		// this.playerSubscription?.player.on()

		player.play(resource)
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

	public async updateMessageEmbed(): Promise<Discord.Message>
	{
		const message = await this.getMessage()
			.catch((error) =>
				{
					this.bot.logger.warn(error, 'PlayCommand')
					return undefined
				})

		if (!message)
		{
			this.bot.logger.error('No message to update', 'PlayCommand')
			throw new Error('No message to update')
		}

		// const embed = new Discord.MessageEmbed(message.embeds[0])
		const embed = new Discord.EmbedBuilder(message.embeds[0].data)
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
		embed.setTitle(this.data.embedTitle)
		embed.setColor(this.data.embedColor)

		// if (this.data.status) embed.addFields({ name: 'status', value: this.data.status, inline: false })

		embed.addFields(
			{ name: 'Ajouter une musique', value: `\`/play url:<YouTube url>\``, inline: false },
			{ name: 'len(queue)', value: `${this.data.queue.length}`, inline: true },
			{ name: 'len(history)', value: `${this.data.history.length}`, inline: true },
			{ name: 'loopMode', value: `${this.data.loopMode}`, inline: true },
			{ name: 'volume', value: `${this.data.volume * 100} %`, inline: true },
			// { name: 'queue', value: `:${this.data.queue.join(',')}`, inline: false },
			// { name: 'lastPlayed', value: `${this.data.lastPlayed}`, inline: false },
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

		const nextTrackInfo = await getTrackInfo(this.data.queue, 0)
		const nextTrackTitle = nextTrackInfo ? `\n\n⏭️  \`${nextTrackInfo.videoDetails.title}\`` : ''

		// const player = this.players.get(listener.id)
		const player = this.player
		if (player)
		{
			let status = player.state.status === AudioPlayerStatus.Playing
				? '▶️' // Play icon
				: '⏸' // Pause icon

			const currentTrackInfo = await getTrackInfo(this.data.history, this.data.history.length - 1)
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
}

export default Radio
