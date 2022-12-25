import { ApplicationCommandType } from 'discord-api-types/v9'
import { ContextMenuCommandBuilder } from '@discordjs/builders'
import { Mel, Discord } from 'discord-mel'

import AbstractCommand from './AbstractCommand.js'
import Giveaway from '../entities/Giveaway.js'
import GiveawayRunResults from '../enums/GiveawayRunResults.js'

type ComponentId = `${string}:${string}`

class RunGiveawayCommand extends AbstractCommand
{
	public static readonly enabled: boolean = true

	protected readonly COMPONENT_SELECT_EMOJI: ComponentId = `${this.id}:SELECT_EMOJI`
	protected readonly COMPONENT_CONFIRM_WINNER: ComponentId = `${this.id}:CONFIRM_WINNER`
	protected readonly COMPONENT_REDRAW_WINNER: ComponentId = `${this.id}:REDRAW_WINNER`
	protected readonly COMPONENT_RESET_REACTION: ComponentId = `${this.id}:RESET_REACTION`

	constructor(id: string, bot: Mel)
	{
		super(id, bot)

		this.name = 'rungiveaway'
		this.description = 'Execute le tirage au sort.'

		this.guildOnly = true
		this.permissions.add('ADMINISTRATOR')

		// Legacy commands aliases
		// this.commandAliases.add('rungiveaway')

		// Application commands
		this.applicationCommands.add(
			new ContextMenuCommandBuilder()
				.setName(this.name)
				.setType(ApplicationCommandType.Message))

		this.componentIds
			.add(this.COMPONENT_SELECT_EMOJI)
			.add(this.COMPONENT_CONFIRM_WINNER)
			.add(this.COMPONENT_REDRAW_WINNER)
			.add(this.COMPONENT_RESET_REACTION)
	}

	/**
	 * @param {Discord.Message} message
	 */
	public async onMessage(message: Discord.Message, args: string)
	{
		// const repliedToId = message.reference?.messageId
		// if (repliedToId)
		// {
		// 	await message.channel.messages.fetch(repliedToId)
		// 		.then(repliedTo => repliedTo.fetch())
		// 		.then(repliedTo =>
		// 			{
		// 				const reaction = (
		// 						args ? repliedTo.reactions.resolve(args)
		// 						     : repliedTo.reactions.cache.first()
		// 					) || undefined
		// 				this.execute(repliedTo, message.channel, message.author, reaction)
		// 					.catch(error =>
		// 						{
		// 							message.reply('Failed to execute the command.')
		// 							this.bot.logger.warn(error, `${this.name}:${repliedToId}`)
		// 						})
		// 			})
		// 		.catch(error =>
		// 			{
		// 				message.reply('Failed to fetch the giveaway message.')
		// 				this.bot.logger.warn(error, `${this.name}:${repliedToId}`)
		// 			})

		// 	// Delete user command
		// 	message.delete()
		// }
		// else
		// {
		// 	message.reply('Please reply to the giveaway message when executing this command.')
		// }
	}

	public async onCommandInteraction(interaction: Discord.BaseCommandInteraction)
	{
		if (!interaction.isContextMenu())
		{
			return
		}

		const giveawayMessageId = interaction.targetId

		// Get the giveaway object related to the message
		const giveaway = this.state.db.giveaways.getOrNew(giveawayMessageId, giveaway =>
			{
				giveaway.giveawayChannelId = interaction.channelId

				giveaway.title = 'Une chance sur deux !'
				giveaway.description = 'Résultats du tirage au sort.'
				giveaway.color = '#4080c0'
				// giveaway.nbWinners = 1

				this.bot.state.save()
			})
			.getEntity(this.bot)

		// Run the giveaway
		this.runGiveaway(giveaway, interaction)
	}

	public async onComponentInteraction(interaction: Discord.MessageComponentInteraction)
	{
		if (interaction.customId === this.COMPONENT_SELECT_EMOJI)
		{
			return this.componentSelectEmojiHandler(interaction)
		}

		if (interaction.customId === this.COMPONENT_CONFIRM_WINNER)
		{
			return this.componentConfirmWinnerHandler(interaction)
		}

		if (interaction.customId === this.COMPONENT_REDRAW_WINNER)
		{
			return this.componentRedrawWinnerHandler(interaction)
		}

		if (interaction.customId === this.COMPONENT_RESET_REACTION)
		{
			return this.componentResetReactionHandler(interaction)
		}
	}

	protected async componentSelectEmojiHandler(interaction: Discord.MessageComponentInteraction)
	{
		if (!interaction.isSelectMenu())
		{
			return
		}

		if (interaction.values.length === 1)
		{
			const contextMessageId = interaction.message.id

			// Get the giveaway object related to the message
			const giveaway = this.state.db.giveaways.findByContext(contextMessageId)?.getEntity(this.bot)

			if (giveaway)
			{
				// Set the selected reaction emoji
				giveaway.setReactionEmoji(interaction.values[0])

				giveaway.getGiveawayReaction(true)
					.then(reaction =>
						{
							interaction.update({
									content: reaction
										? `Selected reaction: ${reaction.emoji.name}`
										: `Selected reaction not resolved`,
									components: [],
								})
								.then(() =>
									{
										// Run the giveaway
										this.runGiveaway(giveaway, interaction, true)
									})
						})
					.catch(() =>
						{
							interaction.update({
									content: `Selected invalid reaction`,
									components: [],
								})
						})
			}
		}
		else
		{
			interaction.reply({
					content: `You must select only one value`,
					ephemeral: true,
				})
		}
	}

	protected async componentConfirmWinnerHandler(interaction: Discord.MessageComponentInteraction)
	{
		if (!interaction.isButton())
		{
			return
		}

		const contextMessageId = interaction.message.id

		// Get the giveaway object related to the message
		const giveaway = this.state.db.giveaways.findByContext(contextMessageId)?.getEntity(this.bot)

		if (giveaway)
		{
			this.bot.logger.debug(`Confirmed`, `${this.name}:${giveaway.giveawayData.giveawayMessageId}`)
			interaction.update({
					content: `Les gagnants sont confimés.`,
					components: [],
				})

			// Confirm the giveaway
			this.announceWinner(giveaway, interaction)
				.then(() => this.state.setState(db => db.giveaways.delete(giveaway.giveawayData.giveawayMessageId)))
		}
	}

	protected async componentRedrawWinnerHandler(interaction: Discord.MessageComponentInteraction)
	{
		if (!interaction.isButton())
		{
			return
		}

		const contextMessageId = interaction.message.id

		// Get the giveaway object related to the message
		const giveaway = this.state.db.giveaways.findByContext(contextMessageId)?.getEntity(this.bot)

		if (giveaway)
		{
			// Clear the giveaway winners
			giveaway.clearWinners()

			this.bot.logger.debug(`Redrawing`, `${this.name}:${giveaway.giveawayData.giveawayMessageId}`)
			interaction.update({
					content: `Les gagnants sont retirés au sort.`,
					components: [],
				})
				.then(() =>
					{
						// Redraw the giveaway
						this.runGiveaway(giveaway, interaction, true)
					})
		}
	}

	protected async componentResetReactionHandler(interaction: Discord.MessageComponentInteraction)
	{
		if (!interaction.isButton())
		{
			return
		}

		const contextMessageId = interaction.message.id

		// Get the giveaway object related to the message
		const giveaway = this.state.db.giveaways.findByContext(contextMessageId)?.getEntity(this.bot)

		if (giveaway)
		{
			// Clear the giveaway winners
			giveaway.clearWinners()

			// Reset the giveaway reaction emoji
			giveaway.setReactionEmoji(undefined)

			this.bot.logger.debug(`Reset`, `${this.name}:${giveaway.giveawayData.giveawayMessageId}`)
			interaction.update({
					content: `Le giveaway est réinitialisé.`,
					components: [],
				})
				.then(() =>
					{
						// Run the giveaway
						this.runGiveaway(giveaway, interaction, true)
					})
		}
	}

	protected async runGiveaway(giveaway: Giveaway, interaction: Discord.BaseCommandInteraction | Discord.MessageComponentInteraction, doFollowUp: boolean = false)
	{
		return giveaway.run()
			.then(result =>
				{
					if (result == GiveawayRunResults.SELECT_REACTION)
					{
						giveaway.getReactions()
							.then(allReactions =>
								{
									const replyOptions: Discord.InteractionReplyOptions & { fetchReply: true } = {
											content: 'Quelle reaction est liée au giveaway ?',
											components: [
												new Discord.MessageActionRow()
													.addComponents(
														new Discord.MessageSelectMenu()
															.setCustomId(this.COMPONENT_SELECT_EMOJI)
															.setPlaceholder('Aucune sélection')
															.addOptions(
																allReactions.map((reaction, key) =>
																	({
																		label: reaction.emoji.name || key,
																		value: `${reaction.emoji.id || key}`
																	})
																))
													)
											],
											ephemeral: true,
											fetchReply: true,
										}

									const replyPromise = !doFollowUp
										? interaction.reply(replyOptions)
										: interaction.followUp(replyOptions)

									replyPromise.then(reply =>
										{
											giveaway.setContextMessageId(reply.id)
										})

									this.bot.logger.debug('Prompt to select reaction', `${this.name}:${giveaway.giveawayData.giveawayMessageId}`)
								})
					}
					else if (result == GiveawayRunResults.CONFIRM_WINNERS)
					{
						let content = ''
						if (giveaway.giveawayData.winners.length <= 0)
						{
							content += 'Aucun gagnant n\'a été tiré au sort.'
						}
						else
						{
							content += giveaway.giveawayData.winners.length > 1 ? 'Les gagnants ont été tirés au sort:' : 'Le gagnant a été tiré au sort:'
							content += ` <@${giveaway.giveawayData.winners.join('>, <@')}>`
						}

						if (giveaway.giveawayData.reactionEmoji)
						{
							content += `\nRéaction liée au giveaway: ${giveaway.giveawayData.reactionEmoji}`
						}
						else
						{
							content += `\nAucune réaction liée au giveaway.`
						}

						const replyOptions: Discord.InteractionReplyOptions & { fetchReply: true } = {
								content: content,
								components: [
									new Discord.MessageActionRow()
										.addComponents(
											new Discord.MessageButton()
												.setCustomId(this.COMPONENT_CONFIRM_WINNER)
												.setLabel('Confirmer')
												.setStyle('SUCCESS'),
											new Discord.MessageButton()
												.setCustomId(this.COMPONENT_REDRAW_WINNER)
												.setLabel('Retirer au sort')
												.setStyle('DANGER'),
											...(giveaway.giveawayData.reactionEmoji
													? [new Discord.MessageButton()
														.setCustomId(this.COMPONENT_RESET_REACTION)
														.setLabel('Sélectionner une autre réaction')
														.setStyle('DANGER')]
													: []
												),
										)
								],
								ephemeral: true,
								fetchReply: true,
							}

						const replyPromise = !doFollowUp
							? interaction.reply(replyOptions)
							: interaction.followUp(replyOptions)

						replyPromise.then(reply =>
							{
								giveaway.setContextMessageId(reply.id)
							})

						this.bot.logger.debug('Prompt to confirm', `${this.name}:${giveaway.giveawayData.giveawayMessageId}`)
					}

					return result
				})
			.catch(error =>
				{
					interaction.reply({
							content: 'Failed to run the giveaway.',
							ephemeral: true,
						})
					this.bot.logger.warn(error, `${this.name}:${giveaway.giveawayData.giveawayMessageId}`)

					return Promise.reject(error)
				})
	}

	protected async announceWinner(giveaway: Giveaway, interaction: Discord.BaseCommandInteraction | Discord.MessageComponentInteraction): Promise<void>
	{
		if (!interaction.channel)
		{
			return
		}

		const giveawayData = giveaway.giveawayData
		const winners = giveawayData.winners

		let content = `Le giveaway`
		if (interaction.channel.lastMessageId !== giveaway.giveawayData.giveawayMessageId)
		{
			content += ` **${giveaway.giveawayData.title}**`
		}
		content += ` vient de se terminer !`

		if (winners.length <= 0)
		{
			content += ` Il n'y a malheureusement eu aucun participant 😅`

			// Announce the lack of a winnner
			interaction.channel.send({
					content,
					reply: { messageReference: giveaway.giveawayData.giveawayMessageId },
				})
				.catch(error => this.bot.logger.warn(error, `${this.name}:${giveaway.giveawayData.giveawayMessageId}`))
		}
		else
		{
			const winnersStr = winners.map(winner => `<@${winner}>`).join(`\n`)
			content += ` Bravo ${winners.length > 1 ? 'aux gagnants' : 'au gagnant'} !\n${winnersStr}`

			const embed = new Discord.MessageEmbed()
			embed.setTitle(giveawayData.title)
			if (giveawayData.description)
			{
				embed.setDescription(giveawayData.description)
			}
			if (giveawayData.color)
			{
				embed.setColor(giveawayData.color)
			}
			embed.addField(winners.length > 1 ? 'Gagnants' : 'Gagnant', winnersStr)
			if (interaction.user)
			{
				embed.addField('Pour récupérer votre cadeau :', `Envoyez un message privé à ${interaction.user} !`)
			}
			embed.setFooter({
					text: giveawayData.participants.length > 1
						? `Merci aux ${giveawayData.participants.length} participants !`
						: `Merci à l'unique participant !`,
				})

			// Announce the giveaway winner!
			interaction.channel.send({ content,
					embeds: [embed],
					reply: { messageReference: giveaway.giveawayData.giveawayMessageId },
				})
				.then(() =>
					{
						this.state.setState(db =>
						{
							giveawayData.participants.forEach(participantId =>
								{
									// Save participations
									const participations = (db.giveawayStats.participations[participantId] || 0) + 1
									db.giveawayStats.participations[participantId] = participations
									this.bot.logger.debug(`${participantId} now has ${participations} participations`, `${this.name}:${giveaway.giveawayData.giveawayMessageId}`)
								})

							winners.forEach(winnerId =>
								{
									// Save wins
									const wins = (db.giveawayStats.wins[winnerId] || 0) + 1
									db.giveawayStats.wins[winnerId] = wins
									this.bot.logger.debug(`${winnerId} now has ${wins} wins`, `${this.name}:${giveaway.giveawayData.giveawayMessageId}`)
								})
						})
					})
				.catch(error => this.bot.logger.warn(error, `${this.name}:${giveaway.giveawayData.giveawayMessageId}`))
		}
	}

	// /**
	//  *
	//  * @param {Discord.Message} repliedTo
	//  * @param {Discord.TextBasedChannel} channel
	//  * @param {Discord.User} author
	//  */
	// async execute(repliedTo: Discord.Message,
	//               channel: Discord.TextBasedChannel,
	//               author: Discord.User,
	// 			  reaction?: Discord.MessageReaction)
	// {
	// 	const options = {
	// 		title: 'Une chance sur deux !',
	// 		description: 'Résultats du tirage au sort.',
	// 		color: '#4080c0',
	// 		nbWinners: 1,
	// 	}

	// 	const participants =
	// 		await reaction?.users.fetch()
	// 			.then(users => users.filter(user => !user.bot))
	// 			.catch(() => undefined)
	// 		|| new Discord.Collection<string, Discord.User>()

	// 	this.bot.logger.debug(`Trying to draw ${options.nbWinners} winners`, `${this.name}:${repliedTo.id}`)
	// 	const winners = participants.random(options.nbWinners)
	// 	this.bot.logger.info(`${winners.length} winners out of ${participants.size} participants`, `${this.name}:${repliedTo.id}`)

	// 	let content = `Le giveaway`
	// 	if (channel.lastMessageId !== repliedTo.id)
	// 		content += ` **${options.title}**`
	// 	content += ` vient de se terminer`

	// 	if (winners.length > 0)
	// 	{
	// 		const winnersStr = winners.join(`\n`);

	// 		content += ` ! Bravo ${winners.length > 1 ? 'aux gagnants' : 'au gagnant'} !\n${winnersStr}`

	// 		const embed = new Discord.MessageEmbed()
	// 		embed.setTitle(options.title)
	// 		if (options.description)
	// 			embed.setDescription(options.description)
	// 		if (options.color)
	// 			embed.setColor(options.color as Discord.HexColorString)
	// 		embed.addField(winners.length > 1 ? 'Gagnants' : 'Gagnant', winnersStr)
	// 		if (author)
	// 			embed.addField('Pour récupérer votre cadeau :', `Envoyez un message privé à ${author} !`)
	// 		embed.setFooter({
	// 				text: participants.size > 1
	// 					? `Merci aux ${participants.size} participants !`
	// 					: `Merci à l'unique participant !`
	// 					,
	// 			})

	// 		// Announce the giveaway winner!
	// 		channel.send({ content,
	// 				embeds: [embed],
	// 				reply: { messageReference: repliedTo.id }
	// 			})
	// 			.then(() =>
	// 				{
	// 					this.state.setState(db =>
	// 					{
	// 						participants.forEach(participant =>
	// 							{
	// 								// Save participations
	// 								const participations = (db.giveawayStats.participations[participant.id] || 0) + 1
	// 								db.giveawayStats.participations[participant.id] = participations
	// 								this.bot.logger.debug(`${participant.username} now has ${participations} participations`, `${this.name}:${repliedTo.id}`)
	// 							})

	// 						winners.forEach(winner =>
	// 							{
	// 								// Save wins
	// 								const wins = (db.giveawayStats.wins[winner.id] || 0) + 1
	// 								db.giveawayStats.wins[winner.id] = wins
	// 								this.bot.logger.debug(`${winner.username} now has ${wins} wins`, `${this.name}:${repliedTo.id}`)
	// 							})
	// 					})
	// 				})
	// 			.catch(error => this.bot.logger.warn(error, `${this.name}:${repliedTo.id}`))
	// 	}
	// 	else
	// 	{
	// 		content += `, et il n'y a malheureusement eu aucun participant 😅`

	// 		// Announce the lack of a winnner
	// 		channel.send({ content,
	// 				reply: { messageReference: repliedTo.id }
	// 			})
	// 			.catch(error => this.bot.logger.warn(error, `${this.name}:${repliedTo.id}`))
	// 	}
	// }
}

export default RunGiveawayCommand
