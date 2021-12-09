import { IBaseStateType } from 'discord-mel'
import Giveaways from './types/Giveaways'

class StateType implements IBaseStateType
{
    public giveaways: Giveaways = new Giveaways()
}

export default StateType
