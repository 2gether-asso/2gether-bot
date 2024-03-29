import { Mel, Discord } from 'discord-mel'

import Config from '../config/Config'
import Activity from '../config/types/Activity'
import State from '../state/State'
import { UserActivityCooldown } from '../state/types/UserActivity'

class ActivityHooks
{
	protected readonly bot: Mel
	protected readonly config: Config
	protected readonly state: State

	public constructor(bot: Mel)
	{
		this.bot = bot
		this.config = this.bot.config as Config
		this.state = this.bot.state as State

		// Register hook callbacks
		this.bot.hooks.get('messageCreate').add(this.onMessageCreate.bind(this))
		this.bot.hooks.get('voiceStateUpdate').add(this.onVoiceStateUpdate.bind(this))
	}

	protected async onMessageCreate(message: Discord.Message
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

		this.bot.logger.debug(`Message activity for ${member.user.username}`, 'ActivityHooks')
		this.addUserActivity(member, delta, activityConfig, 'message')
	}

	protected async onVoiceStateUpdate(oldState: Discord.VoiceState,
	                                   newState: Discord.VoiceState,
	                                   ): Promise<void>
	{
		// Ignore bots
		const member = newState.member
		if (member?.user.bot !== false) return

		// Member connected and not muted (active)
		if (newState.channelId && !newState.mute)
		{
			this.bot.logger.debug(`${member.user.username}: Voice activity starts`, 'ActivityHooks')

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
			this.bot.logger.debug(`${member.user.username}: Voice activity ends after ${timeSeconds} seconds`, 'ActivityHooks')
			this.addUserActivity(member, delta, activityConfig)
		}
	}

	protected async addUserActivity(member: Discord.GuildMember,
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
				this.bot.logger.debug(`${member.user.username}: ${secondsLeft} seconds cooldown left (${cooldownKey})`, 'ActivityHooks')
				return
			}

			this.bot.logger.debug(`${member.user.username}: Set ${activityConfig.cooldown} seconds cooldown (${cooldownKey})`, 'ActivityHooks')
			userActivity.cooldowns[cooldownKey] = Date.now() + (activityConfig.cooldown * 1000)
		}

		// Add delta to user activity score
		userActivity.score += delta
		this.bot.logger.debug(`${member.user.username}: Score is now ${userActivity.score} (${delta >= 0 ? '+' : '-'}${Math.abs(delta)})`, 'ActivityHooks')

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
		this.bot.logger.debug(`${member.user.username}: Ranked #${newRankIndex + 1} (out of #${nbRanking})`, 'ActivityHooks')
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
					.catch(e => this.bot.logger.warn(e, 'ActivityHooks'))

				if (concurrent?.id)
				{
					// Remove roles
					for (let k = 0; k < activityConfig.rankingRoles.length; ++k)
					{
						if (k == i) continue

						const rankingRole = activityConfig.rankingRoles[k]
						if (concurrent.roles.cache.has(rankingRole.role))
						{
							await concurrent.roles.remove(rankingRole.role)
								.then(() => this.bot.logger.debug(`${concurrent.user.username}: Removed ranking role for rank #${rankingRole.rank}`, 'ActivityHooks'))
								.catch(e => this.bot.logger.error(e))
						}
					}

					// Add role
					const newRankingRole = activityConfig.rankingRoles[i]
					if (!concurrent.roles.cache.has(newRankingRole.role))
					{
						await concurrent.roles.add(newRankingRole.role)
							.then(() => this.bot.logger.debug(`${concurrent.user.username}: Added ranking role for rank #${newRankingRole.rank}`, 'ActivityHooks'))
							.catch(e => this.bot.logger.error(e))
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
							.then(() => this.bot.logger.debug(`${concurrent.user.username}: Removed ranking role for rank #${rankingRole.rank}`, 'ActivityHooks'))
							.catch(e => this.bot.logger.error(e))
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
					const newThresholdRole = activityConfig.thresholdRoles[i]
					if (!concurrent.roles.cache.has(newThresholdRole.role))
					{
						await concurrent.roles.add(newThresholdRole.role)
							.then(() => this.bot.logger.debug(`${concurrent.user.username}: Added threshold role for threshold #${newThresholdRole.threshold}`, 'ActivityHooks'))
							.catch(e => this.bot.logger.error(e))
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
				const newThresholdRole = activityConfig.thresholdRoles[i]
				if (!member.roles.cache.has(newThresholdRole.role))
				{
					await member.roles.add(newThresholdRole.role)
						.then(() => this.bot.logger.debug(`${member.user.username}: Added threshold role for threshold #${newThresholdRole.threshold}`, 'ActivityHooks'))
						.catch(e => this.bot.logger.error(e))
				}
			}
		}

		// Remove threshold roles
		for (let k = 0; k < activityConfig.thresholdRoles.length; k++)
		{
			if (k == i) continue

			const thresholdRole = activityConfig.thresholdRoles[k]
			if (member.roles.cache.has(thresholdRole.role))
			{
				await member.roles.remove(thresholdRole.role)
					.then(() => this.bot.logger.debug(`${member.user.username}: Removed threshold role for threshold #${thresholdRole.threshold}`, 'ActivityHooks'))
					.catch(e => this.bot.logger.error(e))
			}
		}

		// Save changes in Storage
		this.state.save()
	}
}

export default ActivityHooks
