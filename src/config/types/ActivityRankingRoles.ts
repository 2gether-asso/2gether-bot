interface ActivityRankingRole
{
	rank: number
	role: string
}

class ActivityRankingRoles extends Array<ActivityRankingRole>
{
	constructor()
	{
		super()
	}
}

export default ActivityRankingRoles
