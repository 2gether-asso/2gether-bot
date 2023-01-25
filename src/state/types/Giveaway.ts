import { Snowflake } from 'discord-api-types/v9'
import { AbstractDBType, Discord, Mel } from 'discord-mel'

import GiveawayEntity from '../../entities/Giveaway.js'

class Giveaway extends AbstractDBType
{
	private giveawayEntity?: GiveawayEntity

	// Giveaway data
	public title!: string
	public description!: string
	public color: Discord.HexColorString | undefined
	public nbWinners!: number

	public reactionEmoji: string | undefined
	public defaultFirstReaction!: boolean

	public participants!: Snowflake[]
	public winners!: Snowflake[]

	// Giveaway context
	public giveawayMessageId!: Snowflake
	public giveawayChannelId!: Snowflake
	// public giveawayGuildId: Snowflake

	/**
	 * Id of the last message attached with commands or interactions
	 */
	public contextMessageId: Snowflake | undefined

	protected initProperties(): void
	{
		this.title = ''
		this.description = ''
		this.color = undefined
		this.nbWinners = 1

		this.reactionEmoji = undefined
		this.defaultFirstReaction = false

		this.participants = []
		this.winners = []

		this.giveawayMessageId = ''
		this.giveawayChannelId = ''
		// this.giveawayGuildId = ''

		this.contextMessageId = undefined
	}

	public getEntity(bot: Mel): GiveawayEntity
	{
        if (!this.giveawayEntity)
        {
            this.giveawayEntity = new GiveawayEntity(bot, this)
        }

		return this.giveawayEntity
	}
}

export default Giveaway
