import { IUnserialize } from 'discord-mel'

import ActivityThresholdRole from './ActivityThresholdRole.js'

class ActivityThresholdRoles extends Array<ActivityThresholdRole> implements IUnserialize
{
	public unserialize(other: any): this
	{
		for (const key in other)
		{
			const activityThresholdRole = new ActivityThresholdRole(other[key])
			this.push(activityThresholdRole)
		}

		return this
	}
}

export default ActivityThresholdRoles
