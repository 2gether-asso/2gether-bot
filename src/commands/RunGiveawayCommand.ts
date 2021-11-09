import { ApplicationCommandType } from 'discord-api-types'
import { ContextMenuCommandBuilder } from '@discordjs/builders'

import { AbstractCommand, Bot, Discord } from 'discord-mel'
import Collection = Discord.Collection

class RunGiveawayCommand extends AbstractCommand
{
	constructor(bot: Bot)
	{
		super(bot, 'rungiveaway')

		this.description = 'Execute le tirage au sort.'

		this.guildOnly = true
		this.permissions = ['ADMINISTRATOR']

		// this.cooldown = 5
		// this.slash = true
	}

	/**
	 * @param {Discord.Message} message
	 */
	async onMessage(message: Discord.Message)
	{
		const repliedToId = message.reference?.messageId
		if (repliedToId)
		{
			await message.channel.messages.fetch(repliedToId)
				.then(repliedTo => repliedTo.fetch())
				.then(repliedTo =>
					{
						this.execute(repliedTo, message.channel as any, message.author)
							.catch(error =>
								{
									message.reply('Failed to execute the command.')
									console.error(error)
								})
					})
				.catch(error =>
					{
						message.reply('Failed to fetch the giveaway message.')
						console.error(error)
					})

			// Delete user command
			message.delete()
		}
		else
		{
			message.reply('Please reply to the giveaway message when executing this command.')
		}
	}

	/**
	 * @param {Discord.ContextMenuInteraction} interaction
	 */
	async onInteraction(interaction: Discord.ContextMenuInteraction)
	{
		const channel = interaction.channel
		const repliedToId = interaction?.targetId
		if (channel && repliedToId)
		{
			await channel.messages.fetch(repliedToId)
				.then(repliedTo => repliedTo.fetch())
				.then(repliedTo =>
					{
						this.execute(repliedTo, channel as any, interaction.user)
							.catch(error =>
								{
									interaction.reply({
											content: 'Failed to execute the command.',
											ephemeral: true,
										})
									console.error(error)
								})
					})
				.catch(error =>
					{
						interaction.reply({
								content: 'Failed to fetch the giveaway message.',
								ephemeral: true,
							})
						console.error(error)
					})

				interaction.reply({
						content: 'Done!',
						ephemeral: true,
					})
		}
		else
		{
			interaction.reply({
					content: 'Please reply to the giveaway message when executing this command.',
					ephemeral: true,
				})
		}
	}

	/**
	 *
	 * @param {Discord.Message} repliedTo
	 * @param {Discord.TextBasedChannels} channel
	 * @param {Discord.User} author
	 */
	async execute(repliedTo: Discord.Message, channel: Discord.TextBasedChannels, author: Discord.User)
	{
		const winners = [];

		const options = {
			title: 'Une chance sur deux !',
			description: 'Résultats du tirage au sort.',
			color: '#4080c0',
			nbWinners: 1,
		}

		const reaction = repliedTo.reactions.cache.first()

		/** @type {Collection<string, Discord.User>} */
		const reactionUsers = reaction ? await reaction.users.fetch() : new Collection()

		if (reactionUsers.size <= options.nbWinners)
		{
			reactionUsers.forEach(winner => winners.push(winner))
		}
		else
		{
			const unselected = reactionUsers.map(user => user)
			for (let i = 0; i < options.nbWinners; ++i)
			{
				const winnerIndex = Math.floor(Math.random() * unselected.length)
				winners.push(unselected[winnerIndex])
				unselected.splice(winnerIndex, 1)
			}
		}

		let content = `Le giveaway`
		if (channel.lastMessageId !== repliedTo.id)
			content += ` **${options.title}**`
		content += ` vient de se terminer`

		if (winners.length > 0)
		{
			const winnersStr = winners.join(`\n`);

			content += ` ! Bravo ${winners.length > 1 ? 'aux gagnants' : 'au gagnant'} !\n${winnersStr}`

			const embed = new Discord.MessageEmbed()
			embed.setTitle(options.title)
			if (options.description)
				embed.setDescription(options.description)
			if (options.color)
				embed.setColor(options.color as Discord.HexColorString)
			embed.addField(winners.length > 1 ? 'Gagnants' : 'Gagnant', winnersStr)
			if (author)
				embed.addField('Pour récupérer votre cadeau :', `Envoyez un message privé à ${author} !`)
			embed.setFooter(reactionUsers.size > 1
					? `Merci aux ${reactionUsers.size} participants !`
					: `Merci à l'unique participant !`)

			// Announce the giveaway winner!
			channel.send({ content,
					embeds: [embed],
					reply: { messageReference: repliedTo.id }
				})
				.catch(console.error)
		}
		else
		{
			content += `, et il n'y a malheureusement eu aucun participant 😅`

			// Announce the lack of a winnner
			channel.send({ content,
					reply: { messageReference: repliedTo.id }
				})
				.catch(console.error)
		}
	}

	getApplicationCommand()
	{
		const applicationCommand = new ContextMenuCommandBuilder()
		applicationCommand.setName(this.name)
		applicationCommand.setType(ApplicationCommandType.Message)

		return applicationCommand
	}
}

export default RunGiveawayCommand
