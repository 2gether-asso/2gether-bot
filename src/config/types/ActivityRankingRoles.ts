import Mergeable from 'discord-mel/dist/functions/Mergeable'

import ActivityRankingRole from './ActivityRankingRole'

class ActivityRankingRoles extends Array<ActivityRankingRole> implements Mergeable
{
	public mergeWith(object: any): this
	{
		for (const key in object)
		{
			this.push(new ActivityRankingRole(object[key]))
		}

		return this
	}
}

export default ActivityRankingRoles
