import { AbstractConfig } from 'discord-mel'
import Global from './types/Global'
import Guild from './types/Guild'

class Config extends AbstractConfig
{
	public global: Global = new Global()
	public guildDefault: Guild = new Guild()

	public constructor()
	{
		super()
	}

	public getGlobalConfig(contextGuild?: Global): Global
	{
		const globalConfig = super.getGlobalConfig(contextGuild ?? new Global())
		return globalConfig as Global
	}

	public getGuildConfig(guildId: string, contextGuild?: Guild): Guild
	{
		const guildConfig = super.getGuildConfig(guildId, contextGuild ?? new Guild())
		return guildConfig as Guild
	}
}

export default Config
