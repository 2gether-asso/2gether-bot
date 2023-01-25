import { AbstractDBType, Discord, Mel } from 'discord-mel'

import RadioEntity from '../../entities/Radio.js'
import Guild from './Guild.js'
import RadioLoopMode from './RadioLoopMode.js'

class Radio extends AbstractDBType
{
    #guild: Guild

    #radioEntity?: RadioEntity

    // public listenerId?: string

    /**
     * Queue of next tracks to play
     * Use push to add a track
     * Use shift to remove a track
     */
    public currentTrack?: string

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

    public voiceChannelId?: Discord.Snowflake

    public messageChannelId?: Discord.Snowflake

    public messageId?: Discord.Snowflake

	public embedTitle!: string

	public embedColor!: Discord.ColorResolvable

    public lastUpdateTime!: number

    public constructor(guild: Guild, data?: AbstractDBType)
    {
        super(data)

        this.#guild = guild
    }

    protected initProperties(): void
    {
        this.currentTrack = undefined
        this.queue = []
        this.history = []
        this.loopMode = RadioLoopMode.NONE
        this.volume = 0.5
        this.authorId = undefined
        this.voiceChannelId = undefined
        this.messageChannelId = undefined
        this.messageId = undefined
        this.embedTitle = 'Radio'
        this.embedColor = 'Random'
        this.lastUpdateTime = 0 // Before everything
    }

    public get guildId(): Discord.Snowflake
    {
        return this.#guild.id
    }

	public getEntity(bot: Mel): RadioEntity
	{
        if (!this.#radioEntity)
        {
            this.#radioEntity = new RadioEntity(bot, this)
        }

		return this.#radioEntity
	}
}

export default Radio
