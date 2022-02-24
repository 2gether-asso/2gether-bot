import { Discord, ListenerTypes, Mel, MessageReactionListener, MessageReactionListenerRegister } from 'discord-mel'
import MessageReactionHandler from 'discord-mel/dist/listeners/handler/MessageReactionHandler'

import AbstractCommand from './AbstractCommand'

class ActivitRankCommand extends AbstractCommand
{
	constructor(bot: Mel)
	{
		super(bot, 'activityrank')

		this.description = this.bot.translator.translate('activityrank.description')

		this.guildOnly = true

		// Legacy commands aliases
		this.commandAliases.add('activityrank').add('rank')

		this.handlers.set(
				ListenerTypes.MESSAGE_REACTION,
				(new MessageReactionHandler())
					.setFilter(this.messageReactionHandlerFilter.bind(this))
					.configureOptions(options => options
						.setStore(false)
						)
					.configureOn(on => on
						.setCollect(this.messageReactionHandlerOnCollect.bind(this))
						.setEnd(this.messageReactionHandlerOnEnd.bind(this))
						)
			)
	}

	async onMessage(message: Discord.Message): Promise<void>
	{
		// Configuration
		const pageSize = 2; // max 25

		const embed = new Discord.MessageEmbed()
			.setColor('#ff9933')
			.setTitle(`Classement de l'activité des membres`)
			.setDescription(`_Chargement..._`);

		message.channel.send({ embeds: [embed] })
			.then(async (answer: Discord.Message) => {
				const emojis = {
					down: '⏪',
					minus: '◀️',
					plus: '▶️',
					up: '⏩',
					freeze: '🏆',
					done: '👍',
				};

				this.bot.listeners.addFor(answer,
						(new MessageReactionListenerRegister())
							.setCommand(this.name)
							.setIdleTimeout(120000) // 2 minutes
							.setData({
								authorID: message.author.id,
								emojis,
								currentPage: 1,
								pageSize,
							})
					)
					.then(() => this.updateEmbed(answer))
					.then((updatedEmbed: Discord.MessageEmbed) => answer.edit({ embeds: [updatedEmbed] }))
					.catch(e => this.bot.logger.error(`${this.name}:${message.id}`, e));

				// React with emojis in order
				for (let emoji of Object.values(emojis))
				{
					await answer.react(emoji)
						.catch(e => this.bot.logger.error(`Error reacting with emoji ${emoji}`, e))
				}
			})
			.catch(console.error)
	}

	protected async updateEmbed(message: Discord.Message): Promise<Discord.MessageEmbed>
	{
		const embed = new Discord.MessageEmbed(message.embeds[0])
		if (!message.guild)
		{
			// No guild
			return embed
				.setDescription(`Aucun serveur sélectionné`)
				.setFooter('')
		}

		const data = this.state.db.listeners.get(message.id)?.data
		if (!data)
		{
			// No data
			return embed
				.setDescription('Aucune donnée de classement')
				.setFooter('')
		}

		const nbMembers = this.state.db.activities.ranking.length
		if (nbMembers <= 0)
		{
			// Empty ranking
			return embed
				.setDescription('Le classement est vide')
				.setFooter('')
		}

		data.maxPages = Math.ceil(nbMembers / data.pageSize)

		const footerPage = `Page ${data.currentPage} sur ${data.maxPages}`
		const footerInfo = `Parmi ${nbMembers > 1 ? `les ${nbMembers} membres classés` : `le seul membre classé`} sur ${message.guild?.name ?? 'le serveur'}`

		embed.setDescription('')
			.setFooter(`${footerPage} ⋅ ${footerInfo}`)
			.spliceFields(0, 25) // Remove all fields

		let i = (data.currentPage - 1) * data.pageSize
		const limit = Math.min(i + data.pageSize, nbMembers)
		for (; i < limit; ++i)
		{
			// Get the member
			const memberId = this.state.db.activities.ranking[i]
			const member = await message.guild?.members.fetch(memberId)
				.catch(() => memberId)

			let content = `${member}`;

			if (typeof member !== 'string')
			{
				const activityConfig = this.config.getGuildConfig(message.guild.id).activity

				// Getting their ranking roles (ordered best to worst)
				const rankingRoles = [];
				for (let rankingRole of activityConfig.rankingRoles)
				{
					// Iterating best first
					if (member.roles.cache.has(rankingRole.role))
					{
						rankingRoles.push(`<@&${rankingRole.role}>`);
					}
				}

				const thresholdRoles = [];
				for (let rankingRole of activityConfig.thresholdRoles)
				{
					// Iterating worst first
					if (member.roles.cache.has(rankingRole.role))
					{
						thresholdRoles.unshift(`<@&${rankingRole.role}>`);
					}
				}

				const roles = rankingRoles.concat(thresholdRoles);
				if (roles.length > 0)
				{
					content += ` (${roles.join(' ')})`;
				}
			}

			// const score = this.state.db.activities.users[this.state.db.activities.ranking[i]].score;
			embed.addField(`#${i + 1}`, content);
		}

		return embed;
	}

	protected messageReactionHandlerFilter(listener: MessageReactionListener, message: Discord.Message, reaction: Discord.MessageReaction, user: Discord.User): boolean
	{
		const data = this.state.db.listeners.get(message.id)?.data

		// Ignore reactions from other users & other emojis
		return data !== undefined
			&& user.id === data.authorID
			&& Object.values(data.emojis).includes(reaction.emoji.name)
	}

	protected messageReactionHandlerOnCollect(listener: MessageReactionListener, message: Discord.Message, reaction: Discord.MessageReaction, user: Discord.User): void
	{
		// Remove the user reaction
		reaction.users.remove(user)
			.catch(e => this.bot.logger.error(e))

		const data = this.state.db.listeners.get(message.id)?.data
		const collector = (this.bot.listeners.get(message.id) as MessageReactionListener | undefined)?.collector

		if (data === undefined)
		{
			this.bot.logger.error('messageReactionHandlerOnCollect: data is undefined')
			return
		}
		else if (collector === undefined)
		{
			this.bot.logger.error('messageReactionHandlerOnCollect: collector is undefined')
			return
		}
		else if (reaction.emoji.name === data.emojis.down)
		{
			data.currentPage = 1
		}
		else if (reaction.emoji.name === data.emojis.minus)
		{
			data.currentPage = data.currentPage > 1 ? data.currentPage - 1 : data.maxPages
		}
		else if (reaction.emoji.name === data.emojis.plus)
		{
			data.currentPage = data.currentPage < data.maxPages ? data.currentPage + 1 : 1
		}
		else if (reaction.emoji.name === data.emojis.up)
		{
			data.currentPage = data.maxPages
		}
		else if (reaction.emoji.name === data.emojis.freeze)
		{
			collector.stop('freeze')
			return
		}
		else if (reaction.emoji.name === data.emojis.done)
		{
			collector.stop('done')
			return
		}

		// Update the embed
		this.updateEmbed(message).then(embed => message.edit({ embeds: [embed] }));
	}

	protected messageReactionHandlerOnEnd(listener: MessageReactionListener, message: Discord.Message, collected: any, reason: string): void
	{
		if (reason === 'freeze') {
			message.edit(`Voici les meilleurs du classement !`)

			const data = this.state.db.listeners.get(message.id)?.data
			if (data !== undefined)
			{
				data.currentPage = 1
			}

			message.reactions.removeAll()
			this.updateEmbed(message).then(embed => message.edit({ embeds: [embed] }))
			return
		}

		if (reason === 'done')
		{
			message.edit(`Parfait !`)
		}
		else
		{
			message.edit(`Voilà, je pense que tu as eu le temps de parcourir le classement`)
		}

		message.reactions.removeAll()
		message.suppressEmbeds()
	}
}

export default ActivitRankCommand
