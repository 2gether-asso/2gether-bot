import { AbstractDB } from 'discord-mel'

import Activities from './types/Activities'
import Giveaways from './types/Giveaways'
import Guilds from './types/Guilds'

class StateDB extends AbstractDB
{
    public activities: Activities = new Activities()

    public giveaways: Giveaways = new Giveaways()

    public guilds: Guilds = new Guilds()
}

export default StateDB
