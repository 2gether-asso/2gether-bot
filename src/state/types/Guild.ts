import { AbstractDBType } from 'discord-mel'

import Radio from './Radio'

class Guild extends AbstractDBType
{
	public radio!: Radio

	public constructor(data?: AbstractDBType)
	{
		super(data)
	}

	protected initProperties(): void
	{
		this.radio = new Radio()
	}
}

export default Guild
