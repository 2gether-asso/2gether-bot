import { SlashCommandBuilder } from '@discordjs/builders'
import { Discord, ListenerTypes, Mel, MessageHandler, MessageListener, MessageListenerRegister, MessageComponentHandler, MessageReactionHandler, MessageReactionListener, MessageComponentListenerRegister, MessageReactionListenerRegister, DBListener, MessageComponentListener } from 'discord-mel'

import AbstractCommand from './AbstractCommand'

class MessageReactionListenerData
{
	public authorId: Discord.Snowflake

	public emojiRoles: { [emoji: string]: Discord.Snowflake } = {}

	public configured: boolean = false

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

class MessageComponentFinishListenerData
{
	public reactionListenerId: Discord.Snowflake

	public authorId: Discord.Snowflake

	public constructor(reactionListenerId: Discord.Snowflake, authorId: Discord.Snowflake)
	{
		this.reactionListenerId = reactionListenerId
		this.authorId = authorId
	}
}

class RoleMenuCommand extends AbstractCommand
{
	public static readonly enabled: boolean = true

	protected readonly COMPONENT_FINISH = `${this.id}:finish`

	protected readonly COMPONENT_SELECT_ROLE = `${this.id}:select_role`

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
		this.componentIds.add(this.COMPONENT_FINISH)

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
						.setRemove(this.messageReactionHandlerOnRemove.bind(this))
						.setEnd(this.messageReactionHandlerOnEnd.bind(this))
					)
			)
			.set(
				ListenerTypes.MESSAGE_COMPONENT,
				new Map()
					.set(this.COMPONENT_FINISH,
						(new MessageComponentHandler())
							.setFilter(this.messageComponentFinishHandlerFilter.bind(this))
							.configureOn(on => on
								.setCollect(this.messageComponentFinishHandlerOnCollect.bind(this))
								.setEnd(this.messageComponentFinishHandlerOnEnd.bind(this))
								)
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
				content: 'Chargement...',
			})
			.then(message =>
				{
					// Add the reaction listener
					this.bot.listeners.addFor(message,
							(new MessageReactionListenerRegister())
								.setCommandId(this.id)
								.setIdleTimeout(120000) // 2 minutes
								.setData(new MessageReactionListenerData(interaction.user.id, 'Menu de sélection des rôles'))
						)
						.then(listener =>
							// Inform the user that the message listener has been created
							this.updateMessageEmbedStatus(message, listener.getDbListener(), 'waiting_on_reaction')
								.then(updatedMessage => updatedMessage.edit(
									{
										content: null,
										components: [
											new Discord.MessageActionRow()
												.addComponents(
													new Discord.MessageButton()
														.setCustomId(this.COMPONENT_FINISH)
														.setLabel('Terminer')
														.setStyle('SUCCESS')
												)
										]
									}))
								.then(updatedMessage =>
									this.bot.listeners.addFor(updatedMessage,
										(new MessageComponentListenerRegister())
											.setCommandId(this.id)
											.setVariant(this.COMPONENT_FINISH)
											.setIdleTimeout(120000) // 2 minutes
											.setData(new MessageComponentFinishListenerData(listener.id, interaction.user.id))
									)))
						.then(() => interaction.reply({ content: 'C\'est bon !', ephemeral: true }))
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

	public async onComponentInteraction(interaction: Discord.MessageComponentInteraction): Promise<void> {
		// Component interactions are not handled in this method
	}

	protected async updateMessageEmbed(message: Discord.Message, dbReactionListener: DBListener | undefined): Promise<Discord.Message>
	{
		const embed = new Discord.MessageEmbed(message.embeds[0])
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

			if (data.status)
			{
				embed.addField('Status', `⚠️ ${data.status}`, false)
			}

			const emojiRoles = Object.entries(data.emojiRoles)
			if (emojiRoles.length <= 0)
			{
				embed.setDescription(`Rien n'a été configuré pour le moment, j'attends qu'un administrateur ajoute des réactions`)
			}
			else
			{
				const rows = emojiRoles.map(([emoji, roleId]) =>
					{
						return `${emoji} - <@&${roleId}>`
					})

				embed.setDescription(`Choisis tes rôles avec les réactions !`)
				embed.addField('Roles', rows.join('\n'), false)
			}
		}

		return message.edit({ embeds: [ embed ] })
	}

	protected updateMessageEmbedStatus(message: Discord.Message, dbReactionListener: DBListener | undefined, status: string): Promise<Discord.Message>
	{
		if (dbReactionListener)
		{
			(dbReactionListener.data as MessageReactionListenerData).status = status
			this.state.save()
		}

		return this.updateMessageEmbed(message, dbReactionListener)
		//	 .catch(error => this.bot.logger.error('Failed to update the embed', 'RoleMenuCommand', error))
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
			this.updateMessageEmbedStatus(resultMessage, dbReactionListener, 'invalid_emoji')
			return
		}

		const role = message.mentions.roles.first()
		if (!role)
		{
			// Role not found
			this.updateMessageEmbedStatus(resultMessage, dbReactionListener, 'invalid_role')
			return
		}

		const reactionData = dbReactionListener.data as MessageReactionListenerData
		const emojis = reactionData.emojiRoles
		if (Object.values(emojis).includes(role.id))
		{
			// Role already registered
			this.updateMessageEmbedStatus(resultMessage, dbReactionListener, 'existing_role')
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
					this.updateMessageEmbedStatus(resultMessage, dbReactionListener, 'role_added')
					listener.end('collected')
				})
			.catch(error => this.bot.logger.error('Failed to delete the message', 'RoleMenuCommand', error))
	}

	// protected messageHandlerOnEnd(reason: string): void
	// {

	// }

	protected messageReactionHandlerFilter(listener: MessageReactionListener, reaction: Discord.MessageReaction, user: Discord.User): boolean
	{
		const dbListener = listener.getDbListener()

		return dbListener !== undefined
			&& listener.message.guild !== null
			&& user.bot === false // Ignore bot reactions
	}

	protected async messageReactionHandlerOnCollect(listener: MessageReactionListener, reaction: Discord.MessageReaction, user: Discord.User): Promise<void>
	{
		const dbListener = listener.getDbListener()
		if (!dbListener || !listener.message.guild)
		{
			return
		}

		const member = await listener.message.guild.members.fetch(user).catch(() => undefined)
		if (!member)
		{
			this.bot.logger.error(`Failed to fetch member ${user.id}`, 'RoleMenuCommand')
			return
		}

		const data = dbListener.data as MessageReactionListenerData
		if (data.configured)
		{
			// Check for a configured emoji and role
			const roleId = reaction.emoji.name ? data.emojiRoles[reaction.emoji.name] : undefined
			if (roleId)
			{
				member.roles.add(roleId)
					.catch(error => this.bot.logger.error(`Failed to add role ${roleId} to member ${user.username}`, 'RoleMenuCommand', error))

				// user.send(`Hey ! Je confirme t'avoir donné le rôle **${role}** 👍`)
					// .catch(console.error);
			}

			// Ignore other reactions
		}
		else if (member.permissions.has('ADMINISTRATOR'))
		{
			const guild = listener.message.guild
			guild.roles.fetch()
				.then(rolesCollection =>
					{
						// Discord guilds can have up to 250 roles, so we need to split roles for the select menus

						// Convert roles to an array and sort them by name
						const roles = Array.from(rolesCollection.values())
							.sort((a, b) => a.name.localeCompare(b.name))

						// Remove the @everyone role index
						const everyoneRoleIndex = roles.findIndex(role => role.id === guild.roles.everyone.id)
						roles.splice(everyoneRoleIndex, 1)

						// Split the roles into chunks of 25 roles
						const rolesChunks = []
						const chunkSize = 25
						for (let i = 0, j = roles.length; i < j; i += chunkSize)
						{
							const rolesChunk = roles.slice(i, i + chunkSize)
							rolesChunks.push(rolesChunk)
						}

						// Split the roles chunks into groups of 5 chunks
						const rolesGroups = []
						const groupSize = 5
						for (let i = 0, j = rolesChunks.length; i < j; i += groupSize)
						{
							const rolesGroup = rolesChunks.slice(i, i + groupSize)
							rolesGroups.push(rolesGroup)
						}

						// We get:
						// 250 roles => 10 chunks of 25 roles => 2 groups of 5 chunks of 25 roles

						const components = Array.from(listener.message.components)

						// Generate and update the select menus
						rolesGroups.forEach((rolesGroup, index) =>
							{
								components[index + 1] = new Discord.MessageActionRow()
									.addComponents(
										...rolesGroup.map(rolesChunk =>
											new Discord.MessageSelectMenu()
												.setCustomId(this.COMPONENT_SELECT_ROLE)
												.setMinValues(1)
												.setMaxValues(1)
												.setPlaceholder('Choisis un rôle')
												.setOptions(
													...rolesChunk.map(role =>
														({
															label: role.name, // `${role.name} (id: ${role.id})`,
															value: role.id
														})))))
							})

						listener.message.edit(
							{
								components: components,
							})
							.catch(error => this.bot.logger.error('Failed to edit the message', 'RoleMenuCommand', error))
					})
				.catch(error => this.bot.logger.error('Failed to fetch roles', 'RoleMenuCommand', error))

			// Add the reaction listener
			this.bot.listeners.addFor(listener.message.channel as any,
				(new MessageListenerRegister())
					.setCommandId(this.id)
					.setIdleTimeout(120000) // 2 minutes
					.setData(new MessageListenerData(listener.id, user.id, reaction.emoji.name))
			)
			.then(() =>
				// Inform the user that the message listener has been created
				this.updateMessageEmbedStatus(listener.message, dbListener, 'waiting_on_role'))
			.catch(error =>
				{
					// TODO: clean up? delete the message? edit it to say it failed?
					this.bot.logger.error('An error occurred', 'RoleMenuCommand', error)
				})
		}
	}

	protected async messageReactionHandlerOnRemove(listener: MessageReactionListener, reaction: Discord.MessageReaction, user: Discord.User): Promise<void>
	{
		// const dbListener = listener.getDbListener()
		const data = listener.getDbListener()?.data as MessageReactionListenerData | undefined
		if (!data || !listener.message.guild)
		{
			return
		}

		const member = await listener.message.guild.members.fetch(user).catch(() => undefined)
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

	protected messageReactionHandlerOnEnd(listener: MessageReactionListener, collected: any[], reason: string): void
	{
		listener.message.edit(
			{
				content: '_Menu de sélection des rôles terminé._',
				embeds: [],
				components: [],
			})
	}

	protected messageComponentFinishHandlerFilter(listener: MessageComponentListener, interaction: Discord.MessageComponentInteraction): boolean
	{
		const data = listener.getDbListener()?.data as MessageComponentFinishListenerData | undefined

		return data !== undefined
			&& interaction.isButton()
			&& interaction.customId === this.COMPONENT_FINISH
			&& interaction.user.id === data.authorId
	}

	protected messageComponentFinishHandlerOnCollect(listener: MessageComponentListener, interaction: Discord.MessageComponentInteraction): void
	{
		interaction.deferUpdate()

		const dbListener = listener.getDbListener()
		if (!dbListener || !listener.message.guild)
		{
			return
		}

		const data = dbListener.data as MessageComponentFinishListenerData

		const dbReactionListener = this.state.db.listeners.get(data.reactionListenerId)
		if (!dbReactionListener)
		{
			return
		}

		const reactionData = dbReactionListener.data as MessageReactionListenerData

		// Mark and update the listener as configured
		reactionData.configured = true
		reactionData.status = undefined // Remove the status
		this.state.save()

		this.updateMessageEmbed(listener.message, dbReactionListener)
			.then(() =>
				{
					// Stop the message component listener
					listener.collector.stop('finished')

					interaction.editReply({ content: 'La configuration du menu a été enregistrée !' })
				})
			.catch(error => this.bot.logger.error('Failed to update the embed', 'RoleMenuCommand', error))
	}

	protected messageComponentFinishHandlerOnEnd(listener: MessageComponentListener, collected: any[], reason: string): void
	{
		// Delete the first action row
		const components = listener.message.components.slice(1)

		// Remove the listener select role components
		listener.message.edit({ components: components })
			.catch(error => this.bot.logger.error('Failed to remove the listener button component', 'RoleMenuCommand', error))
	}
}

export default RoleMenuCommand
