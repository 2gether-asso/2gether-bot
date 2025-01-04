import ActivityRankingRoles from './ActivityRankingRoles.js'
import ActivityThresholdRoles from './ActivityThresholdRoles.js'

class Activity
{
	public rewards =
		{
			message: 0,
			command: 0,
			reaction: 0,
			voice: 0
		}

	public cooldown = 1

	public cumulateRoles = false

	public thresholdRoles: ActivityThresholdRoles = new ActivityThresholdRoles()

	public rankingRoles: ActivityRankingRoles = new ActivityRankingRoles()
}

export default Activity
