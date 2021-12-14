import { Guild as BaseGuild } from 'discord-mel/dist/config/AbstractConfig'
import Activity from './Activity'

class Guild extends BaseGuild
{
	public activity: Activity = new Activity()
}

export default Guild
