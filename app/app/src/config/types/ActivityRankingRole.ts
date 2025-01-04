import { Snowflake } from 'discord-api-types/v9'
import { AbstractConfigType } from 'discord-mel'

class ActivityRankingRole extends AbstractConfigType
{
	public rank!: number

	public role!: Snowflake

	public constructor(type?: AbstractConfigType)
	{
		super(type)

		if (this.rank as any === undefined)
		{
			this.rank = -1
		}

		if (this.role as any === undefined)
		{
			this.role = ''
		}
	}
}

export default ActivityRankingRole
