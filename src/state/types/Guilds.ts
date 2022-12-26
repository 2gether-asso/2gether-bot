import { Snowflake } from 'discord-api-types/v9'
import { AbstractDBMapType, Discord } from 'discord-mel'

import Guild from './Guild.js'

class Guilds extends AbstractDBMapType<Snowflake, Guild>
{
	public unserialize(other: any): this
	{
		for (const key in other)
		{
			const guild = new Guild(other[key])
			this.set(key, guild)
		}

		return this
	}

	public getGuild(guild: Discord.Guild): Guild
	{
		const dbGuild = super.get(guild.id)
		if (dbGuild !== undefined)
		{
			return dbGuild
		}

		const newGuild = new Guild()
		this.set(guild.id, newGuild)
		return newGuild
	}
}

export default Guilds
