import { Snowflake } from 'discord-api-types'
import { AbstractConfigType } from 'discord-mel'

class ActivityThresholdRole extends AbstractConfigType
{
	public threshold: number = -1

	public role: Snowflake = ''
}

export default ActivityThresholdRole
