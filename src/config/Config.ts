import { DefaultConfig } from 'discord-mel'
import Guild from './types/Guild'
import Guilds from './types/Guilds'

class Config extends DefaultConfig
{
	public guilds: Guilds = new Guilds()

	public guildDefault: Guild = new Guild()

	private guildConfigs: Guilds = new Guilds()

	constructor()
	{
		super()
	}

	public loadConfigFile(configFile?: string, charset: BufferEncoding = 'utf8')
	{
		super.loadConfigFile(configFile, charset)
		this.guildConfigs.clear()
	}

	public getGuildConfig(guildId: string): Guild
	{
		const guildConfig = this.guildConfigs.get(guildId)
		if (guildConfig)
		{
			return guildConfig
		}

		const newGuildConfig = new Guild()
		newGuildConfig.mergeWith(this.guildDefault)

		const guild = this.guilds.get(guildId)
		if (guild)
		{
			newGuildConfig.mergeWith(guild)
		}

		this.guildConfigs.set(guildId, newGuildConfig)
		return newGuildConfig
	}
}

export default Config
