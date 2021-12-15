import Mergeable from 'discord-mel/dist/functions/Mergeable'

import ActivityRankingRole from './ActivityRankingRole'

class ActivityRankingRoles extends Array<ActivityRankingRole> implements Mergeable
{
	public mergeWith(object: any): this
	{
		for (const item of object)
		{
			this.push(new ActivityRankingRole(item))
		}

		return this
	}
}

export default ActivityRankingRoles
