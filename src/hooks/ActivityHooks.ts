import { Mel, Discord, HooksManager, Translator } from 'discord-mel'
import Logger from 'discord-mel/dist/logger/Logger'
import Config from '../config/Config'
import Activity from '../config/types/Activity'
import State from '../state/State'
import { UserActivityCooldown } from '../state/types/UserActivity'

class ActivityHooks
{
	private readonly bot: Mel
	private readonly config: Config
	private readonly hooks: HooksManager
	private readonly logger: Logger
	private readonly state: State
	private readonly translator: Translator

	constructor(bot: Mel)
	{
		this.bot = bot
		this.config = this.bot.config as Config
		this.hooks = this.bot.hooks
		this.logger = this.bot.logger
		this.state = this.bot.state as State
		this.translator = this.bot.translator

		// Register hook callbacks
		this.hooks.get('messageCreate').add(this.onMessageCreate.bind(this))
		this.hooks.get('voiceStateUpdate').add(this.onVoiceStateUpdate.bind(this))
	}

	private async onMessageCreate(message: Discord.Message
	                              ): Promise<void>
	{
		// Ignore messages not from guilds
		const guild = message.guild
		if (!guild) return

		// Ignore bots
		const member = message.member
		if (member?.user.bot !== false) return

		// Ignore messages without content
		if (!message.content) return

		// Get the guild's activity config
		const activityConfig = this.config.getGuildConfig(guild.id).activity

		const delta = activityConfig.rewards['message']

		this.logger.debug(`Message activity for ${member.user.username}`, 'ActivityHooks')
		this.addUserActivity(member, delta, activityConfig, 'message')
	}

	private async onVoiceStateUpdate(oldState: Discord.VoiceState,
	                                 newState: Discord.VoiceState,
	                                 ): Promise<void>
	{
		// Ignore bots
		const member = newState.member
		if (member?.user.bot !== false) return

		// Member connected and not muted (active)
		if (newState.channelId && !newState.mute)
		{
			this.logger.debug(`${member.user.username}: Voice activity starts`, 'ActivityHooks')

			this.state.setState(db =>
				{
					// Save timestamp of speaking
					db.activities.getUser(member.id).voiceSince = Date.now()
				})

			return
		}

		// Get the guild's activity config
		const guild = newState.guild
		const activityConfig = this.config.getGuildConfig(guild.id).activity

		// Get user activity (or initialize it)
		const userActivity = this.state.db.activities.getUser(member.id)

		// Member disconnected or muted (inactive)
		if (userActivity.voiceSince >= this.bot.startTimestamp)
		{
			// Calculate the score for the session
			const timeSeconds = (Date.now() - userActivity.voiceSince) / 1000
			const delta = (timeSeconds / activityConfig.cooldown)
			              * activityConfig.rewards.voice

			// Ends the session (avoid bugs)
			userActivity.voiceSince = -1

			// Rewards the member for the session
			this.logger.debug(`${member.user.username}: Voice activity ends after ${timeSeconds} seconds`, 'ActivityHooks')
			this.addUserActivity(member, delta, activityConfig)
		}
	}

	private async addUserActivity(member: Discord.GuildMember,
								  delta: number,
								  activityConfig: Activity,
								  cooldownKey: UserActivityCooldown | undefined = undefined,
								  ): Promise<void>
	{
		// Get user activity (or initialize it)
		const userActivity = this.state.db.activities.getUser(member.id)

		// Ignore fast requests
		if (cooldownKey !== undefined)
		{
			if (userActivity.cooldowns[cooldownKey] > Date.now())
			{
				const secondsLeft = Math.round((userActivity.cooldowns[cooldownKey] - Date.now()) / 1000)
				this.logger.debug(`${member.user.username}: ${secondsLeft} seconds cooldown left (${cooldownKey})`, 'ActivityHooks')
				return
			}

			this.logger.debug(`${member.user.username}: Set ${activityConfig.cooldown} seconds cooldown (${cooldownKey})`, 'ActivityHooks')
			userActivity.cooldowns[cooldownKey] = Date.now() + (activityConfig.cooldown * 1000)
		}

		// Add delta to user activity score
		userActivity.score += delta
		this.logger.debug(`${member.user.username}: Score is now ${userActivity.score} (${delta >= 0 ? '+' : '-'}${Math.abs(delta)})`, 'ActivityHooks')

		// Get the user current ranking index
		let rankIndex = this.state.db.activities.ranking.indexOf(member.id)
		if (rankIndex < 0) rankIndex = this.state.db.activities.ranking.push(member.id) - 1

		// Compute the user new ranking index
		let newRankIndex: number
		if (delta > 0)
		{
			// User increased their score
			let i = rankIndex - 1
			for (; i >= 0; --i)
			{
				const concurrentId = this.state.db.activities.ranking[i]
				const concurrentActivity = this.state.db.activities.getUser(concurrentId)
				if (concurrentActivity.score >= userActivity.score)
					break
			}
			newRankIndex = i + 1
		}
		else
		{
			// User decreased their score
			let i = rankIndex + 1
			const length = this.state.db.activities.ranking.length
			for (; i < length; ++i)
			{
				const concurrentId = this.state.db.activities.ranking[i]
				const concurrentActivity = this.state.db.activities.getUser(concurrentId)
				if (concurrentActivity.score <= userActivity.score)
					break
			}
			newRankIndex = i - 1
		}

		// Update the user ranking
		const nbRanking = this.state.db.activities.ranking.length
		this.logger.debug(`${member.user.username}: Ranked #${newRankIndex + 1} (out of #${nbRanking})`, 'ActivityHooks')
		this.state.db.activities.ranking.splice(
			newRankIndex, 0,
			...this.state.db.activities.ranking.splice(rankIndex, 1)
			)

		if (!member.guild) return // Guild information not available

		const [ minRankIndex, maxRankIndex ] = [ rankIndex, newRankIndex ].sort((a, b) => a - b)
		// const removeRoleIDs = []

		let i = 0
		let j = minRankIndex
		let addedRankingRole = false

		// Update members' ranking role
		const rankingRolesLength = activityConfig.rankingRoles.length
		while (i < rankingRolesLength && j <= maxRankIndex)
		{
			if (activityConfig.rankingRoles[i].rank <= j)
			{
				++i
			}
			else
			{
				if (j == newRankIndex) addedRankingRole = true

				// Fetch concurrent member
				const concurrent = await member.guild.members.fetch(this.state.db.activities.ranking[j])

				if (concurrent.id)
				{
					// Remove roles
					for (let k = 0; k < activityConfig.rankingRoles.length; ++k)
					{
						if (k == i) continue
						if (concurrent.roles.cache.has(activityConfig.rankingRoles[k].role))
						{
							await concurrent.roles.remove(activityConfig.rankingRoles[k].role)
								.catch(this.logger.error)
						}
					}

					// Add role
					if (!concurrent.roles.cache.has(activityConfig.rankingRoles[i].role))
					{
						await concurrent.roles.add(activityConfig.rankingRoles[i].role)
							.catch(this.logger.error)
					}
				}

				++j
			}
		}

		for (; j <= maxRankIndex; ++j)
		{
			// Fetch concurrent member
			const concurrent = await member.guild.members.fetch(this.state.db.activities.ranking[j])

			if (concurrent.id)
			{
				// Remove roles
				for (let rankingRole of activityConfig.rankingRoles)
				{
					if (concurrent.roles.cache.has(rankingRole.role))
					{
						await concurrent.roles.remove(rankingRole.role)
							.catch(this.logger.error)
					}
				}

				i = 0
				for (; i < activityConfig.thresholdRoles.length; ++i)
				{
					if (activityConfig.thresholdRoles[i].threshold
					    > this.state.db.activities.users[concurrent.id].score)
					{
						break
					}
				}

				--i
				if (i >= 0)
				{
					// Add threshold role
					if (!concurrent.roles.cache.has(activityConfig.thresholdRoles[i].role))
					{
						await concurrent.roles.add(activityConfig.thresholdRoles[i].role)
							.catch(this.logger.error)
					}
				}
			}
		}

		if (addedRankingRole) i = -1
		else
		{
			i = 0
			for (; i < activityConfig.thresholdRoles.length; ++i)
			{
				if (activityConfig.thresholdRoles[i].threshold > userActivity.score)
					break
			}

			--i
			if (i >= 0)
			{
				// Add threshold role
				if (!member.roles.cache.has(activityConfig.thresholdRoles[i].role))
				{
					await member.roles.add(activityConfig.thresholdRoles[i].role)
						.catch(this.logger.error)
				}
			}
		}

		// Remove threshold roles
		for (let k = 0; k < activityConfig.thresholdRoles.length; k++)
		{
			if (k == i) continue
			if (member.roles.cache.has(activityConfig.thresholdRoles[k].role))
			{
				await member.roles.remove(activityConfig.thresholdRoles[k].role)
					.catch(this.logger.error)
			}
		}

		// Save changes in Storage
		this.state.save()
	}
}

export default ActivityHooks
