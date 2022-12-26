import { AbstractDBType, Discord, Mel } from 'discord-mel'

import RadioEntity from '../../entities/Radio.js'
import RadioLoopMode from './RadioLoopMode.js'

class Radio extends AbstractDBType
{
    // public listenerId?: string

    /**
     * Queue of next tracks to play
     * Use push to add a track
     * Use shift to remove a track
     */
    public queue!: string[]

    /**
     * Stack of tracks that have been played
     * Use push to add a track
     * Use pop to remove a track
     */
    public history!: string[]

    public loopMode!: RadioLoopMode

    public volume!: number

	public authorId?: Discord.Snowflake

	public guildId?: Discord.Snowflake

    public voiceChannelId?: Discord.Snowflake

    public messageChannelId?: Discord.Snowflake

    public messageId?: Discord.Snowflake

	public embedMessageId?: Discord.Snowflake

	public embedTitle!: string

	public embedColor!: Discord.ColorResolvable

    public constructor(data?: AbstractDBType)
    {
        super(data)
    }

    protected initProperties(): void
    {
        this.queue = []
        this.history = []
        this.loopMode = RadioLoopMode.NONE
        this.volume = 0.5
        this.authorId = undefined
        this.guildId = undefined
        this.voiceChannelId = undefined
        this.messageChannelId = undefined
        this.messageId = undefined
        this.embedMessageId = undefined
        this.embedTitle = 'Radio'
        this.embedColor = 'Random'
    }

	public getEntity(bot: Mel): RadioEntity
	{
		return new RadioEntity(bot, this)
	}
}

export default Radio
