import { IBaseStateType } from 'discord-mel'
import Activities from './types/Activities'
import Giveaways from './types/Giveaways'

class StateType implements IBaseStateType
{
    public activities: Activities = new Activities()

    public giveaways: Giveaways = new Giveaways()
}

export default StateType
