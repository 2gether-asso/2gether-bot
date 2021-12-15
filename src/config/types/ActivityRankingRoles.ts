import Mergeable from "discord-mel/dist/functions/Mergeable"

interface ActivityRankingRole
{
	rank: number
	role: string
}

class ActivityRankingRoles extends Array<ActivityRankingRole> implements Mergeable
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

export default ActivityRankingRoles
