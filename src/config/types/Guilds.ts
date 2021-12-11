import { Snowflake } from 'discord-api-types'
import Guild from './Guild'

class Guilds extends Map<Snowflake, Guild>
{
	constructor()
	{
		super()
	}
}

export default Guilds
