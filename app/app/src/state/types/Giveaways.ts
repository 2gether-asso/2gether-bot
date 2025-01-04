import { Snowflake } from 'discord-api-types/v9'
import { AbstractDBMapType } from 'discord-mel'

import Giveaway from './Giveaway.js'

class Giveaways extends AbstractDBMapType<Snowflake, Giveaway>
{
	public unserialize(other: any): this
	{
		for (const key in other)
		{
			const guild = new Giveaway(other[key])
			this.set(key, guild)
		}

		return this
	}

    /**
     * Get giveaway object (or create one if it does not already exist)
     */
    public getOrNew(messageId: Snowflake, newCallback: (giveaway: Giveaway) => void): Giveaway
    {
		const giveaway = this.get(messageId)
		if (!giveaway)
		{
			const giveaway = new Giveaway()
			giveaway.giveawayMessageId = messageId
			newCallback(giveaway)
			this.set(messageId, giveaway)
			return giveaway
		}

		return giveaway
    }

	public findByContext(contextMessageId: Snowflake): Giveaway | undefined
    {
		for (const value of this.values())
		{
			if (value.contextMessageId === contextMessageId)
			{
				return value
			}
		}

		return undefined
    }
}

export default Giveaways
