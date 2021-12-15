import Mergeable from 'discord-mel/dist/functions/Mergeable'

import ActivityThresholdRole from './ActivityThresholdRole'

class ActivityThresholdRoles extends Array<ActivityThresholdRole> implements Mergeable
{
	public mergeWith(object: any): this
	{
		for (const key in object)
		{
			this.push(new ActivityThresholdRole(object[key]))
		}

		return this
	}
}

export default ActivityThresholdRoles
