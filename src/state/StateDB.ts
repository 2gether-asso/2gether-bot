import { AbstractDB } from 'discord-mel'
import Activities from './types/Activities'
import Giveaways from './types/Giveaways'

class StateDB extends AbstractDB
{
    public activities: Activities = new Activities()

    public giveaways: Giveaways = new Giveaways()
}

export default StateDB
