import { AbstractDBType } from 'discord-mel'

class Guild extends AbstractDBType
{
	public constructor(data?: AbstractDBType)
	{
		super(data)
	}

	protected initProperties(): void
	{
	}
}

export default Guild
