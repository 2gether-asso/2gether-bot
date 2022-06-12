import { AbstractDB } from 'discord-mel'
import Activities from './types/Activities'
import GiveawayStats from './types/GiveawayStats'

class StateDB extends AbstractDB
{
    public activities: Activities = new Activities()

    public giveawayStats: GiveawayStats = new GiveawayStats()
}

export default StateDB
