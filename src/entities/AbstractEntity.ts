import { Mel } from 'discord-mel'

import Config from '../config/Config'
import State from '../state/State'

abstract class AbstractEntity
{
	public readonly bot: Mel

	public constructor(bot: Mel)
	{
		this.bot = bot
	}

	protected get config(): Config
	{
		return this.bot.config as Config
	}

	protected get state(): State
	{
		return this.bot.state as State
	}
}

export default AbstractEntity
