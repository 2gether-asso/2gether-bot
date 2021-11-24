import { SlashCommandBuilder } from '@discordjs/builders'
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice'
import { AbstractCommand, Bot, Discord } from 'discord-mel'
import YTDL from 'ytdl-core'

import State from '../state/State'

class PlayCommand extends AbstractCommand
{
	protected voiceChannel?: Discord.VoiceChannel | Discord.StageChannel
	protected connection?: VoiceConnection

	constructor(bot: Bot)
	{
		super(bot, 'play')

		this.description = 'Joue les musiques de la playlist'

		// Legacy commands aliases
		// this.commandAliases.add('rungiveaway')

		// Application commands
		this.applicationCommands.push(
			(() => {
				const slashCommand = new SlashCommandBuilder()
				slashCommand.setName(this.name)
				if (this.description)
					slashCommand.setDescription(this.description)

				slashCommand.addStringOption(slashCommand => slashCommand
						.setName('url')
						.setDescription('Lien de la musique à jouer')
						.setRequired(true)
					)

				return slashCommand
			})()
		)

		this.guildOnly = true
	}

	protected get state(): State
	{
		return super.state as State
	}

	protected getConnection(voiceChannel: Discord.VoiceChannel | Discord.StageChannel): VoiceConnection
	{
		if (!this.connection
		    || this.connection.state.status === VoiceConnectionStatus.Destroyed
		    || this.voiceChannel?.id !== voiceChannel.id)
		{
			if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed)
			{
				// Destroy the previous connection
				this.connection.destroy()
			}

			// Create a new connection
			this.voiceChannel = voiceChannel
			this.connection = joinVoiceChannel({
				channelId: voiceChannel.id,
				guildId: voiceChannel.guild.id,
				adapterCreator: voiceChannel.guild.voiceAdapterCreator,
			})
		}

		return this.connection
	}

	async onCommandInteraction(interaction: Discord.BaseCommandInteraction): Promise<void>
	{
		if (interaction instanceof Discord.CommandInteraction
		    && interaction.member instanceof Discord.GuildMember)
		{
			const resourceUrl = interaction.options.getString('url')
			if (!resourceUrl)
			{
				interaction.reply({
						content: `L'argument obligatoire 'url' est manquant.`,
						ephemeral: true,
					})
			}
			else
			{
				const voiceChannel = interaction.member.voice.channel
				if (!voiceChannel)
				{
					interaction.reply({
							content: 'Vous devez être dans un salon vocal pour jouer une musique.',
							ephemeral: true,
						})
				}
				else if (!voiceChannel.joinable)
				{
					interaction.reply({
							content: 'Je suis dans l\'incapacité de te rejoindre dans le salon vocal, désolé.',
							ephemeral: true,
						})
				}
				else
				{
					const player = createAudioPlayer()
					player.on('error', (error) =>
						{
							this.logger.error("a")
							this.logger.error(error, this.name)
						})

					const stream = YTDL(resourceUrl)
					const resource = createAudioResource(stream,
						{
							metadata: {
								title: 'Meep. owo',
							},
						})
					player.play(resource)

					const connection = this.getConnection(voiceChannel)
					if (connection.state.status === VoiceConnectionStatus.Disconnected)
					{
						console.log("b")
						connection.rejoin()
					}

					connection.subscribe(player)

					player.on(AudioPlayerStatus.Playing, (oldState, newState) => {
						console.log('Audio player is in the Playing state!') //, oldState, newState)
					});

					player.on(AudioPlayerStatus.Buffering, (oldState, newState) => {
						console.log('Audio player is in the Buffering state!') //, oldState, newState)
					});

					player.on(AudioPlayerStatus.AutoPaused, (oldState, newState) => {
						console.log('Audio player is in the AutoPaused state!') //, oldState, newState)
					});

					player.on(AudioPlayerStatus.Paused, (oldState, newState) => {
						console.log('Audio player is in the Paused state!') //, oldState, newState)
					});

					player.on(AudioPlayerStatus.Idle, (oldState, newState) => {
						console.log('Audio player is in the Idle state!') //, oldState, newState)

						// this.connection?.disconnect() // Rejoining afterwards does not work
						this.connection?.destroy()
						voiceChannel.guild.me?.voice.disconnect()
					});

					interaction.reply({
							content: 'Ok.',
							ephemeral: true,
						})
				}
			}
		}
	}
}

export default PlayCommand
