import { Discord, Mel } from 'discord-mel'

// import RadioRunResults from '../enums/RadioRunResults.js'
import RadioData from '../state/types/Radio.js'
import AbstractEntity from './AbstractEntity.js'

class Radio extends AbstractEntity
{
	// Radio state data
	public readonly data: RadioData

	// public radioMessage: Discord.Message

	protected radioMessagePromise: Promise<Discord.Message<true>> | undefined = undefined

	public constructor(bot: Mel, radioData: RadioData)
	{
		super(bot)

		this.data = radioData
	}

	public async getRadioMessage(reload: boolean = false): Promise<Discord.Message<true>>
	{
		if (reload || !this.radioMessagePromise)
		{
			if (!this.data.messageChannelId)
			{
				return Promise.reject(new Error('Radio message channel ID not specified'))
			}

			this.radioMessagePromise = this.bot.client.channels.fetch(this.data.messageChannelId)
				.then(channel =>
					{
						if (!this.data.messageId)
						{
							return Promise.reject(new Error('Radio message ID not specified'))
						}

						if (!(channel instanceof Discord.GuildChannel) || !channel.isTextBased())
						{
							return Promise.reject(new Error('Channel is not a guild text channel'))
						}

						return channel.messages.fetch({ message: this.data.messageId, force: true })
					})
				.catch(error =>
					{
						this.bot.logger.warn(`Failed to fetch radio message`, 'Radio', error)
						return Promise.reject(error)
					})
		}

		return this.radioMessagePromise
	}

	public isExpired(): boolean
	{
		// Expire delay : 20 minutes (in milliseconds)
		// 20 minutes = 20 * 60 * 1000 = 1200000
		return this.data.lastUpdateTime + 1200000 < Date.now()
	}
}

export default Radio
