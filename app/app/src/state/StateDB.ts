import { AbstractDB } from 'discord-mel'
import Activities from './types/Activities.js'
import Giveaways from './types/Giveaways.js'
import GiveawayStats from './types/GiveawayStats.js'

class StateDB extends AbstractDB
{
    public activities: Activities = new Activities()

    public giveaways: Giveaways = new Giveaways()
    public giveawayStats: GiveawayStats = new GiveawayStats()
}

export default StateDB
