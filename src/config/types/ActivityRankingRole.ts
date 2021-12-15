import { Snowflake } from 'discord-api-types'
import { AbstractConfigType } from 'discord-mel'

class ActivityRankingRole extends AbstractConfigType
{
	public rank: number = -1

	public role: Snowflake = ''
}

export default ActivityRankingRole
