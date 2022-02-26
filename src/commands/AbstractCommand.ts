import { AbstractCommand as AbstractMelCommand } from 'discord-mel'

import Config from '../config/Config'
import State from '../state/State'

abstract class AbstractCommand extends AbstractMelCommand
{
	public static readonly enabled: boolean = false

	protected get config(): Config
	{
		return this.bot.config as Config
	}

	protected get state(): State
	{
		return this.bot.state as State
	}
}

export default AbstractCommand
