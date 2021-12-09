import { DefaultConfig } from 'discord-mel'
import Activity from './types/Activity'

class Config extends DefaultConfig
{
	public activity: Activity = new Activity()

	constructor()
	{
		super()
	}
}

export default Config
