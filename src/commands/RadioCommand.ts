import { SlashCommandBuilder } from '@discordjs/builders'
import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, PlayerSubscription, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice'
import { Mel, Discord, MessageReactionListenerRegister, DBListener, ListenerTypes, MessageReactionHandler, MessageReactionListener, MessageComponentListenerRegister, MessageComponentHandler, MessageComponentListener } from 'discord-mel'
import YTDL from 'ytdl-core'

import AbstractCommand from './AbstractCommand.js'
import Radio from '../entities/Radio.js'
import RadioLoopMode from '../state/types/RadioLoopMode.js'
import RadioControlEmojis from '../enums/RadioControlEmojis.js'

type RadioControlComponentId = `${string}:${keyof typeof RadioControlEmojis}`

class RadioCommand extends AbstractCommand
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

		this.name = 'radio'
		this.description = 'Radio.'

		this.guildOnly = true

		// Application commands
		this.applicationCommands
			.add((() =>
				{
					const slashCommand = (new SlashCommandBuilder())
						.setName(this.name)
						.setDescription(this.description)

					slashCommand.addSubcommand(subcommand => subcommand
							.setName('play')
							.setDescription('Joue une musique et l\'ajoute à la playlist.')
							.addStringOption(option => option
									.setName('url')
									.setDescription('Lien de la musique à jouer.')
									.setRequired(false)
								)
						)

					return slashCommand
				})())

		// Message components
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

		await interaction.deferReply({ ephemeral: true })

		const radio = this.state.db.guilds.getGuild(interaction.guild).radio.getEntity(this.bot)

		const resourceUrl = interaction.options.get('url')?.value

		radio.userPlay(interaction.member, interaction.channel.id, typeof resourceUrl === 'string' ? resourceUrl : undefined)
			.then(result =>
				{
					const statusToContent: { [key in typeof result.status]: string } =
						{
							not_voice: 'Vous devez être dans un salon vocal pour jouer une musique.',
							not_joinable: 'Je suis dans l\'incapacité de te rejoindre dans le salon vocal, désolé.',
							different_voice: `Tu dois être dans le même salon vocal que moi pour jouer une musique.`,
							playing: `Je suis déjà en train de jouer quelque chose !`,
							queued_track: `J'ai ajouté ta musique à la playlist`,
							new_player: 'C\'est bon !',
						}

					interaction.editReply(
						{
							content: statusToContent[result.status] ?? 'Un succès inconnu est survenu.',
						})

					if (result.status == 'new_player' && result.message)
					{
						result.message.edit(
							{
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
							})
							.catch(() =>
								{
									interaction.followUp(
										{
											content: 'Les boutons n\'ont pas pu être ajoutés.',
											ephemeral: true,
										})
								})
					}
				})
			.catch(() =>
				{
					interaction.editReply(
						{
							content: 'Une erreur est survenue.',
						})
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

export default RadioCommand
