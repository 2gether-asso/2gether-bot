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

	async onCommandInteraction(interaction: Discord.CommandInteraction): Promise<void>
	{
		if (!interaction.isCommand() || !interaction.guild || !interaction.channel || !(interaction.member instanceof Discord.GuildMember))
		{
			return
		}

		interaction.deferReply({ ephemeral: true })

		const guild = interaction.guild
		const radio = this.state.db.guilds.getGuild(guild).radio.getEntity(this.bot)

		const voiceChannel = interaction.member.voice.channel
		if (!voiceChannel)
		{
			interaction.editReply({
					content: 'Vous devez être dans un salon vocal pour jouer une musique.',
				})
			return
		}
		else if (!voiceChannel.joinable)
		{
			this.bot.logger.debug(`Unable to join voice channel ${voiceChannel.name} (${voiceChannel.id})`, 'PlayCommand')
			interaction.editReply({
					content: 'Je suis dans l\'incapacité de te rejoindre dans le salon vocal, désolé.',
				})
			return
		}

		// const resourceUrl = interaction.options.getString('url')
		const resourceUrl = interaction.options.get('url')?.value
		if (resourceUrl && typeof resourceUrl === 'string')
		{
			const player = radio.getPlayer()
			if (player)
			{
				// Add track to the queue
				this.bot.logger.debug(`Queue track: ${resourceUrl}`, 'PlayCommand')
				radio.queueTrack(resourceUrl)
			}
			else
			{
				// Add track to play next
				this.bot.logger.debug(`Queue track first: ${resourceUrl}`, 'PlayCommand')
				radio.queueTrackFirst(resourceUrl)
			}
		}

		const playerSubscription = radio.getPlayerSubscription()
		if (playerSubscription) // && this.isPlaying)
		{
			// if (playerSubscription.player.state.status !== AudioPlayerStatus.Playing)
			// {
			// 	interaction.editReply({
			// 			content: `Reprise de la lecture`,
			// 		})
			// }

			if (!resourceUrl)
			{
				interaction.editReply({
						content: `Je suis déjà en train de jouer quelque chose !`,
					})
			}
			else
			{
				interaction.editReply({
						content: `J'ai ajouté ta musique à la playlist`,
					})
			}

			return
		}

		if (radio.isExpired())
		{
			radio.reset()

			radio.data.volume = 0.5
			radio.data.authorId = interaction.user.id
			radio.data.voiceChannelId = voiceChannel.id
			radio.data.messageChannelId = interaction.channel.id
			radio.data.messageId = undefined
			radio.data.embedTitle = '📻 🎶  2GETHER Radio'
			radio.data.embedColor = '#0099ff'
		}

		// Inform the user that the message listener has been created
		return radio.updateMessageEmbed()
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
			.then(() =>
				{
					interaction.editReply({ content: 'C\'est bon !' })

					// Play the next track, if any
					radio.playNext()
				})
			.catch(error =>
				{
					// TODO: clean up? delete the message? edit it?
					this.bot.logger.error('An error occurred', 'PlayCommand', error)
					interaction.editReply({ content: 'Une erreur est survenue...' })
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
					radio.updateMessageEmbed()
						// .then(() => interaction.update({}))
				})
			.catch(error => this.bot.logger.error('Component handler error', 'PlayCommand', error))
	}

	protected async componentPlayHandler(radio: Radio)
	{
		radio.play()
	}

	protected async componentPauseHandler(radio: Radio)
	{
		radio.pause()
	}

	protected async componentPreviousHandler(radio: Radio)
	{
		// Pop the history twice if a track is currently playing (the first popped track is the current track)
		const popCount = radio.isPlayer() ? 2 : 1

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
		radio.playNext()
	}

	protected async componentNextHandler(radio: Radio)
	{
		radio.playNext()
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
		radio.data.history = radio.isPlayer() && radio.data.history.length > 0 ? [radio.data.history[radio.data.history.length - 1]] : []
	}

	protected async componentStopHandler(radio: Radio)
	{
		radio.stopPlayer()
	}

	protected async componentMuteHandler(radio: Radio)
	{
		return radio.setVolume(0)
	}

	protected async componentVolumeDownHandler(radio: Radio)
	{
		return radio.setVolume(radio.data.volume - .1)
	}

	protected async componentVolumeUpHandler(radio: Radio)
	{
		return radio.setVolume(radio.data.volume + .1)
	}
}

export default PlayCommand
