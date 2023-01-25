import { AbstractDBType, Discord } from 'discord-mel'

import Radio from './Radio.js'

class Guild extends AbstractDBType
{
	#guildId: Discord.Snowflake

	public radio!: Radio

	public constructor(guildId: Discord.Snowflake, data?: AbstractDBType)
	{
		super(data)

		this.#guildId = guildId
	}

	protected initProperties(): void
	{
		this.radio = new Radio(this)
	}
}

export default Guild
