import { Snowflake } from 'discord-api-types'
import { AbstractConfigType } from 'discord-mel'

class ActivityThresholdRole extends AbstractConfigType
{
	public threshold!: number

	public role!: Snowflake

	public constructor(type?: AbstractConfigType)
	{
		super(type)

		if (this.threshold as any === undefined)
		{
			this.threshold = -1
		}

		if (this.role as any === undefined)
		{
			this.role = ''
		}
	}
}

export default ActivityThresholdRole
