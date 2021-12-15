import Mergeable from 'discord-mel/dist/functions/Mergeable'

import ActivityThresholdRole from './ActivityThresholdRole'

class ActivityThresholdRoles extends Array<ActivityThresholdRole> implements Mergeable
{
	public mergeWith(object: any): this
	{
		for (const item of object)
		{
			this.push(item)
		}

		return this
	}
}

export default ActivityThresholdRoles
