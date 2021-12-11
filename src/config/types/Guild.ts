import Config from '../Config'
import Activity from './Activity'

class Guild
{
	public activity: Activity = new Activity()

	public mergeWith(guild: Guild): this
	{
		Config.assignDeep(this, guild)
		return this
	}
}

export default Guild
