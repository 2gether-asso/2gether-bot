import { config } from 'discord-mel'

import Activity from './Activity.js'

const BaseGuild = config.Guild

class Guild extends BaseGuild
{
	public activity: Activity = new Activity()
}

export default Guild
