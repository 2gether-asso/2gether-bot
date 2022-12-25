import { SlashCommandBuilder } from '@discordjs/builders'
import { Discord, ListenerTypes, Mel, MessageComponentHandler, MessageReactionHandler, MessageReactionListener, MessageComponentListenerRegister, MessageReactionListenerRegister, DBListener, MessageComponentListener } from 'discord-mel'

import AbstractCommand from './AbstractCommand.js'

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

class MessageComponentSelectRoleListenerData
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
		this.componentIds
			.add(this.COMPONENT_FINISH)
			.add(this.COMPONENT_SELECT_ROLE)

		this.guildOnly = true
		this.permissions.add('ADMINISTRATOR')

		this.handlers
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
					.set(this.COMPONENT_SELECT_ROLE,
						(new MessageComponentHandler())
							.setFilter(this.messageComponentSelectRoleHandlerFilter.bind(this))
							.configureOn(on => on
								.setCollect(this.messageComponentSelectRoleHandlerOnCollect.bind(this))
								.setEnd(this.messageComponentSelectRoleHandlerOnEnd.bind(this))
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

			if (dbReactionListener.timeout !== undefined)
			{
				embed.addField('Date de fin', `${new Date(dbReactionListener.timeout).toLocaleString('fr-FR')}`, false)
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

						// Generate and update the select menus
						rolesGroups.forEach((rolesGroup, index) =>
							{
								listener.message.components[index + 1] = new Discord.MessageActionRow()
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
														}))
													)
											)
										)
							})

						listener.message.edit(
							{
								components: listener.message.components,
							})
							.then(updatedMessage =>
								{
									this.bot.listeners.addFor(updatedMessage,
										(new MessageComponentListenerRegister())
											.setCommandId(this.id)
											.setVariant(this.COMPONENT_SELECT_ROLE)
											.setIdleTimeout(120000) // 2 minutes
											.setData(new MessageComponentSelectRoleListenerData(listener.id, user.id, reaction.emoji.name))
										)

										.then(() =>
											// Inform the user that the message listener has been created
											this.updateMessageEmbedStatus(listener.message, dbListener, 'waiting_on_role'))
										.catch(error =>
											{
												// TODO: clean up? delete the components?
												this.updateMessageEmbedStatus(listener.message, dbListener, 'waiting_on_role_failed')
												this.bot.logger.error('Failed to create a component listener for the select role menu', 'RoleMenuCommand', error)
											})
								})
							.catch(error => this.bot.logger.error('Failed to edit the message', 'RoleMenuCommand', error))
					})
				.catch(error => this.bot.logger.error('Failed to fetch roles', 'RoleMenuCommand', error))
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
		if (reason === 'messageDelete')
		{
			return
		}

		listener.message.reactions.removeAll()
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
		if (reason === 'messageDelete')
		{
			return
		}

		// Remove all components
		listener.message.edit({ components: [] })
			.catch(error => this.bot.logger.error('Failed to remove the listener button component', 'RoleMenuCommand', error))
	}

	protected messageComponentSelectRoleHandlerFilter(listener: MessageComponentListener, interaction: Discord.MessageComponentInteraction): boolean
	{
		const data = listener.getDbListener()?.data as MessageComponentFinishListenerData | undefined

		return data !== undefined
			&& interaction.isSelectMenu()
			&& interaction.customId === this.COMPONENT_SELECT_ROLE
			&& interaction.user.id === data.authorId
			&& interaction.values.length >= 1
	}

	protected async messageComponentSelectRoleHandlerOnCollect(listener: MessageComponentListener, interaction: Discord.MessageComponentInteraction): Promise<void>
	{
		interaction.deferUpdate()

		if (!interaction.guild || !interaction.isSelectMenu())
		{
			return
		}

		const data = listener.getDbListener()?.data as MessageComponentSelectRoleListenerData | undefined
		if (!data)
		{
			return
		}

		const dbReactionListener = this.state.db.listeners.get(data.reactionListenerId)
		if (!dbReactionListener || !dbReactionListener.targetId)
		{
			return
		}

		if (!data.emoji)
		{
			// Emoji invalid
			this.updateMessageEmbedStatus(listener.message, dbReactionListener, 'invalid_emoji')
			return
		}

		const role = await interaction.guild.roles.fetch(interaction.values[0]).catch(() => null)
		if (!role)
		{
			// Role invalid or not found
			this.updateMessageEmbedStatus(listener.message, dbReactionListener, 'invalid_role')
			return
		}

		const reactionData = dbReactionListener.data as MessageReactionListenerData
		const emojis = reactionData.emojiRoles
		if (Object.values(emojis).includes(role.id))
		{
			// Role already registered
			this.updateMessageEmbedStatus(listener.message, dbReactionListener, 'existing_role')
			return
		}

		// Associate the role to the emoji
		emojis[data.emoji] = role.id

		// Confirm the associated emoji
		listener.message.react(data.emoji)
			.catch(error => this.bot.logger.warn('Failed to react to the message', 'RoleMenuCommand', error))

		this.updateMessageEmbedStatus(listener.message, dbReactionListener, 'role_added')
			.then(() =>
				{
					// Stop the select menu component listener
					listener.end('collected')

					interaction.editReply({ content: 'La configuration du menu a été enregistrée !' })
				})
			.catch(error => this.bot.logger.error('Failed to update the embed', 'RoleMenuCommand', error))
	}

	protected messageComponentSelectRoleHandlerOnEnd(listener: MessageComponentListener, collected: any[], reason: string): void
	{
		if (reason === 'messageDelete')
		{
			return
		}

		// Delete all action rows but the first
		listener.message.components = listener.message.components.slice(0, 1)

		// Remove the listener select role components
		listener.message.edit({ components: listener.message.components })
			.catch(error => this.bot.logger.error('Failed to remove the listener button component', 'RoleMenuCommand', error))
	}
}

export default RoleMenuCommand
