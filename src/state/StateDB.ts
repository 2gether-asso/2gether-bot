import { AbstractDB } from 'discord-mel'
import Activities from './types/Activities'
import Giveaways from './types/Giveaways'
import GiveawayStats from './types/GiveawayStats'

class StateDB extends AbstractDB
{
    public activities: Activities = new Activities()

    public giveaways: Giveaways = new Giveaways()
    public giveawayStats: GiveawayStats = new GiveawayStats()
}

export default StateDB
