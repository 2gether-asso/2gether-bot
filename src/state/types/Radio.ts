import { AbstractDBType } from 'discord-mel'

import RadioLoopMode from './RadioLoopMode'

class Radio extends AbstractDBType
{
    public listenerId?: string

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
    }
}

export default Radio
