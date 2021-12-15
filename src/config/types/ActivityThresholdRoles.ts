import Mergeable from "discord-mel/dist/functions/Mergeable"

interface ActivityThresholdRole
{
	threshold: number
	role: string
}

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
