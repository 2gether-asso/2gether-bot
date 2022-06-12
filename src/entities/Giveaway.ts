import { Discord, Mel } from 'discord-mel'

import GiveawayRunResults from '../enums/GiveawayRunResults'
import GiveawayData from '../state/types/Giveaway'
import AbstractEntity from './AbstractEntity'

class Giveaway extends AbstractEntity
{
	// Giveaway state data
	public readonly giveawayData: GiveawayData

	// public giveawayMessage: Discord.Message

	public giveawayMessagePromise: Promise<Discord.Message>

	public constructor(bot: Mel, giveawayData: GiveawayData)
	{
		super(bot)
		this.giveawayData = giveawayData

		this.giveawayMessagePromise =
			bot.client.channels.fetch(giveawayData.giveawayChannelId)
				.then(channel =>
					{
						return channel?.isText()
							? channel.messages.fetch(giveawayData.giveawayMessageId, { force: true })
							: Promise.reject(new Error('Channel is not a text channel'))
					})
				.catch(error =>
					{
						bot.logger.warn(`Failed to fetch giveaway message`, 'Giveaway', error)
						return Promise.reject(error)
					})
	}

	public async getReactions(): Promise<Discord.Collection<string, Discord.MessageReaction>>
	{
		return this.giveawayMessagePromise
			.then(giveawayMessage => giveawayMessage.reactions.cache)
	}

	public async getGiveawayReaction(forceUseReactionEmoji: boolean = false): Promise<Discord.MessageReaction | null>
	{
		return this.giveawayMessagePromise
			.then(giveawayMessage =>
				{
					if (this.giveawayData.reactionEmoji)
					{
						return giveawayMessage.reactions.resolve(this.giveawayData.reactionEmoji)
					}
					else if (!forceUseReactionEmoji && this.giveawayData.defaultFirstReaction)
					{
						return giveawayMessage.reactions.cache.first() || null
					}

					return Promise.reject(new Error('Giveaway reaction not specified'))
				})
	}

	// public async getParticipants(): Promise<Discord.User[]>
	public async getParticipants(giveawayReaction: Discord.MessageReaction): Promise<Discord.Collection<string, Discord.User>>
	{
		this.bot.logger.debug(`Selected reaction ${giveawayReaction.emoji.name}`, `Giveaway:${this.giveawayData.giveawayMessageId}`)

		return giveawayReaction.users.fetch()
			.then(participants =>
				{
					// Filter out the bot itself
					return participants.filter(user => !user.bot)
				})
			.catch(() =>
				{
					this.bot.logger.warn(`Failed to fetch participants`, `Giveaway:${this.giveawayData.giveawayMessageId}`)
					return Promise.reject(new Error('Failed to fetch participants'))
				})
	}

	public drawWinners(participants: Discord.Collection<string, Discord.User>): Discord.User[]
	{
		this.bot.logger.debug(`Trying to draw ${this.giveawayData.nbWinners} winners`, `Giveaway:${this.giveawayData.giveawayMessageId}`)
		const winners = participants.random(this.giveawayData.nbWinners)

		this.bot.logger.info(`Drew ${winners.length} winners out of ${participants.size} participants`, `Giveaway:${this.giveawayData.giveawayMessageId}`)
		return winners
	}

	public async run(): Promise<GiveawayRunResults>
	{
		if (this.giveawayData.winners.length >= 1)
		{
			return GiveawayRunResults.CONFIRM_WINNERS
		}

		return this.getGiveawayReaction()
			.then(giveawayReaction =>
				{
					if (!giveawayReaction)
					{
						return GiveawayRunResults.NO_WINNERS
					}

					return this.getParticipants(giveawayReaction)
						.then(participants =>
							{
								const winners = this.drawWinners(participants)

								this.giveawayData.participants = participants.map(user => user.id)
								this.giveawayData.winners = winners.map(winner => winner.id)
								this.bot.state.save()

								return winners.length >= 1
									? GiveawayRunResults.CONFIRM_WINNERS
									: GiveawayRunResults.NO_WINNERS
							})
				})
			.catch(() =>
				{
					return GiveawayRunResults.SELECT_REACTION
				})
	}

	public setContextMessageId(contextMessageId: string): void
	{
		this.giveawayData.contextMessageId = contextMessageId
		this.bot.state.save()
	}

	public setReactionEmoji(reactionEmoji: string | undefined): void
	{
		this.giveawayData.reactionEmoji = reactionEmoji
		this.bot.state.save()
	}

	public clearWinners(): void
	{
		this.giveawayData.participants = []
		this.giveawayData.winners = []
		this.bot.state.save()
	}
}

export default Giveaway
