import { Discord, Mel } from 'discord-mel'

// import RadioRunResults from '../enums/RadioRunResults.js'
import RadioData from '../state/types/Radio.js'
import AbstractEntity from './AbstractEntity.js'

class Radio extends AbstractEntity
{
	// Radio state data
	public readonly radioData: RadioData

	// public radioMessage: Discord.Message

	public readonly radioMessagePromise: Promise<Discord.Message<true>>

	public constructor(bot: Mel, radioData: RadioData)
	{
		super(bot)

		this.radioData = radioData

		this.radioMessagePromise = radioData.messageChannelId
			? bot.client.channels.fetch(radioData.messageChannelId)
				.then(channel =>
					{
						if (!radioData.messageId)
						{
							return Promise.reject(new Error('Radio message ID not specified'))
						}

						if (channel instanceof Discord.GuildChannel && channel.isTextBased())
						{
							return channel.messages.fetch({ message: radioData.messageId, force: true })
						}

						return Promise.reject(new Error('Channel is not a guild text channel'))
					})
				.catch(error =>
					{
						bot.logger.warn(`Failed to fetch radio message`, 'Radio', error)
						return Promise.reject(error)
					})
			: Promise.reject(new Error('Radio message channel ID not specified'))
	}
}

export default Radio
