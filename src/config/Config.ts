import { DefaultConfig } from 'discord-mel'

class Config extends DefaultConfig
{
	constructor(configFile?: string, charset: BufferEncoding = 'utf8')
	{
		super(configFile, charset)
	}
}

export default Config
