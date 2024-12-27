import IUnserialize from 'discord-mel/dist/functions/IUnserialize'

import ActivityRankingRole from './ActivityRankingRole'

class ActivityRankingRoles extends Array<ActivityRankingRole> implements IUnserialize
{
	public unserialize(other: any): this
	{
		for (const key in other)
		{
			const activityRankingRole = new ActivityRankingRole(other[key])
			this.push(activityRankingRole)
		}

		return this
	}
}

export default ActivityRankingRoles
