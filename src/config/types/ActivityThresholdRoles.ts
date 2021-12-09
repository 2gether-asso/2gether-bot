interface ActivityRankingRole
{
	threshold: number
	role: string
}

class ActivityThresholdRoles extends Array<ActivityRankingRole>
{
	constructor()
	{
		super()
	}
}

export default ActivityThresholdRoles
