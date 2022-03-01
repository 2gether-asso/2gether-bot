import { SlashCommandBuilder } from '@discordjs/builders'
import { Discord, ListenerTypes, Mel, MessageHandler, MessageListener, MessageListenerRegister, MessageReactionHandler, MessageReactionListener, MessageReactionListenerRegister, DBListener } from 'discord-mel'

import AbstractCommand from './AbstractCommand'

class MessageReactionListenerData
{
	public authorId: Discord.Snowflake

	public emojiRoles: { [emoji: string]: Discord.Snowflake } = {}

	// title: 'React with an emoji to add or remove yourself a role'
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

class MessageListenerData
{
	public reactionListenerId: Discord.Snowflake

	public authorId: Discord.Snowflake

	public emoji: string | null

	public constructor(reactionListenerId: Discord.Snowflake, authorId: Discord.Snowflake, emoji: string | null)
	{
		this.reactionListenerId = reactionListenerId
		this.authorId = authorId
		this.emoji = emoji
	}
}

class RoleMenuCommand extends AbstractCommand
{
	public static readonly enabled: boolean = true

	constructor(id: string, bot: Mel)
	{
		super(id, bot)

		this.name = 'rolemenu'

		this.description = this.bot.translator.translate('rolemenu.description')

		// // Legacy commands aliases
		// this.commandAliases.add('rolemenu')

		// Application commands
		this.applicationCommands
			.add((new SlashCommandBuilder())
				.setName(this.name)
				.setDescription(this.description)
			)

		// Components
		this.componentIds.add(`${this.name}:finish`)

		this.guildOnly = true
		this.permissions.add('ADMINISTRATOR')

		this.handlers
			.set(
				ListenerTypes.MESSAGE,
				(new MessageHandler())
					.setFilter(this.messageHandlerFilter.bind(this))
					.configureOn(on => on
						.setCollect(this.messageHandlerOnCollect.bind(this))
						// .setEnd(this.messageHandlerOnEnd.bind(this))
					)
			)
			.set(
				ListenerTypes.MESSAGE_REACTION,
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

	async onCommandInteraction(interaction: Discord.BaseCommandInteraction)
	{
		if (!interaction.isCommand())
		{
			return
		}

		if (!interaction.channel)
		{
			this.bot.logger.warn('interaction.channel is null', 'RoleMenuCommand')
			return
		}

		interaction.channel.send({
				content: 'Message. Awaiting reactions...',
				// TODO: Add button component for when configuration is finished
			})
			.then(message =>
				{
					// Add the reaction listener
					this.bot.listeners.addFor(message,
							(new MessageReactionListenerRegister())
								.setCommandId(this.id)
								.setIdleTimeout(120000) // 2 minutes
								.setData(new MessageReactionListenerData(interaction.user.id, 'Menu de sélectionner des rôles'))
						)
						.then((listener) => this.updateEmbed(message, listener.getDbListener()))
						.then(updatedEmbed => message.edit({ content: null, embeds: [updatedEmbed] }))
						.then(() => interaction.reply({
								content: 'Done!',
								ephemeral: true,
							}))
						.catch(error =>
							{
								// TODO: clean up? delete the message? edit it to say it failed?
								this.bot.logger.error('An error occurred', 'RoleMenuCommand', error)
							})
				})
			.catch(error =>
				{
					interaction.reply({
							content: 'Failed to execute the command.',
							ephemeral: true,
						})
					this.bot.logger.warn('Failed to execute the command', 'RoleMenuCommand', error)
				})
	}

	protected async updateEmbed(message: Discord.Message, dbListener: DBListener | undefined): Promise<Discord.MessageEmbed>
	{
		const embed = new Discord.MessageEmbed(message.embeds[0])
		embed.spliceFields(0, 25) // Reset fields

		if (!dbListener)
		{
			embed.setTitle('Invalide')
			embed.setDescription('Le système de rôle est en échec.')
			embed.setColor('#ff0000')
			return embed
		}

		const data = dbListener.data as MessageReactionListenerData
		embed.setTitle(data.title)
		embed.setColor(data.color)

		if (data.status)
		{
			embed.addField('Status', `⚠️ ${data.status}`, false)
		}

		const emojiRoles = Object.entries(data.emojiRoles)
		if (emojiRoles.length <= 0)
		{
			embed.setDescription(`Rien n'a été configuré pour le moment, j'attends qu'un administrateur ajoute des réactions`)
			return embed
		}

		const rows = emojiRoles.map(([emoji, roleId]) =>
			{
				return `${emoji} - <@&${roleId}>`
			})

		embed.setDescription(`Choisis tes rôles avec les réactions !`)
		embed.addField('Roles', rows.join('\n'), false)

		return embed
	}

	protected saveEmbedStatus(message: Discord.Message, dbListener: DBListener | undefined, status: string): void
	{
		if (!dbListener)
		{
			return
		}

		dbListener.data.status = status
		this.state.save()
		this.updateEmbed(message, dbListener)
			.then(updatedEmbed => message.edit({ embeds: [updatedEmbed] }))
			.catch(error => this.bot.logger.error('Failed to update the embed', 'RoleMenuCommand', error))
	}

	protected messageHandlerFilter(listener: MessageListener, message: Discord.Message): boolean
	{
		const data = listener.getDbListener()?.data as MessageListenerData | undefined

		return data !== undefined
			&& data.authorId === message.author.id
			&& !!data.reactionListenerId
	}

	protected async messageHandlerOnCollect(listener: MessageListener, message: Discord.Message): Promise<void>
	{
		// const dbListener = listener.getDbListener()
		const data = listener.getDbListener()?.data as MessageListenerData | undefined
		if (!data)
		{
			return
		}

		const dbReactionListener = this.state.db.listeners.get(data.reactionListenerId)
		if (!dbReactionListener || !dbReactionListener.targetId)
		{
			return
		}

		const resultMessage = await message.channel.messages.fetch(dbReactionListener.targetId)
			.catch(() => undefined)
		if (!resultMessage)
		{
			return
		}

		if (!data.emoji)
		{
			// Emoji invalid
			this.saveEmbedStatus(resultMessage, dbReactionListener, 'invalid_emoji')
			return
		}

		const role = message.mentions.roles.first()
		if (!role)
		{
			// Role not found
			this.saveEmbedStatus(resultMessage, dbReactionListener, 'invalid_role')
			return
		}

		const reactionData = dbReactionListener.data as MessageReactionListenerData
		const emojis = reactionData.emojiRoles
		if (Object.values(emojis).includes(role.id))
		{
			// Role already registered
			this.saveEmbedStatus(resultMessage, dbReactionListener, 'existing_role')
			return
		}

		// Associate the role to the emoji
		emojis[data.emoji] = role.id

		// TODO: Check message.deletable ?
		// TODO: Check permission MANAGE_MESSAGES ?
		message.delete()
			.then(() =>
				{
					// Inform the user that the role has been added
					this.saveEmbedStatus(resultMessage, dbReactionListener, 'role_added')
					listener.end('collected')
				})
			.catch(error => this.bot.logger.error('Failed to delete the message', 'RoleMenuCommand', error))
	}

	// protected messageHandlerOnEnd(reason: string): void
	// {

	// }

	protected messageReactionHandlerFilter(listener: MessageReactionListener, message: Discord.Message, reaction: Discord.MessageReaction, user: Discord.User): boolean
	{
		const dbListener = listener.getDbListener()

		return dbListener !== undefined
			&& user.bot === false // Ignore bot reactions
	}

	protected async messageReactionHandlerOnCollect(listener: MessageReactionListener, message: Discord.Message, reaction: Discord.MessageReaction, user: Discord.User): Promise<void>
	{
		const dbListener = listener.getDbListener()
		if (!dbListener || !message.guild)
		{
			return
		}

		const member = await message.guild.members.fetch(user).catch(() => undefined)
		if (!member)
		{
			this.bot.logger.error(`Failed to fetch member ${user.id}`, 'RoleMenuCommand')
			return
		}

		const data = dbListener.data as MessageReactionListenerData
		const role = reaction.emoji.name ? data.emojiRoles[reaction.emoji.name] : undefined
		if (role)
		{
			member.roles.add(role)
				.catch(error => this.bot.logger.error(`Failed to add role ${role} to member ${user.username}`, 'RoleMenuCommand', error))

			// user.send(`Hey ! Je confirme t'avoir donné le rôle **${role}** 👍`)
				// .catch(console.error);
		}
		else if (member.permissions.has('ADMINISTRATOR'))
		{
			// Add the reaction listener
			this.bot.listeners.addFor(message.channel as any,
				(new MessageListenerRegister())
					.setCommandId(this.id)
					.setIdleTimeout(120000) // 2 minutes
					.setData(new MessageListenerData(listener.id, user.id, reaction.emoji.name))
			)
			.then(() =>
				{
					// Update the embed to inform the user that the reaction listener has been created
					data.status = 'waiting_on_reaction'
					this.state.save()

					return this.updateEmbed(message, dbListener)
				})
			.then(updatedEmbed => message.edit({ embeds: [updatedEmbed] }))
			.catch(error =>
				{
					// TODO: clean up? delete the message? edit it to say it failed?
					this.bot.logger.error('An error occurred', 'RoleMenuCommand', error)
				})
		}
	}

	protected async messageReactionHandlerOnRemove(listener: MessageReactionListener, message: Discord.Message, reaction: Discord.MessageReaction, user: Discord.User): Promise<void>
	{
		// const dbListener = listener.getDbListener()
		const data = listener.getDbListener()?.data as MessageReactionListenerData | undefined
		if (!data || !message.guild)
		{
			return
		}

		const member = await message.guild.members.fetch(user).catch(() => undefined)
		if (!member)
		{
			this.bot.logger.error(`Failed to fetch member ${user.id}`, 'RoleMenuCommand')
			return
		}

		const role = reaction.emoji.name ? data.emojiRoles[reaction.emoji.name] : undefined
		if (role)
		{
			member.roles.remove(role)
				.catch(error => this.bot.logger.error(`Failed to remove role ${role} from member ${user.username}`, 'RoleMenuCommand', error))

	// 		// user.send(`Hey ! Je confirme t'avoir retiré le rôle **${role}** 👍`)
	// 			// .catch(console.error);
		}
	}

	// protected messageReactionHandlerOnEnd(message: Discord.Message, collected: any, reason: string): void
	// {

	// }
}

export default RoleMenuCommand
