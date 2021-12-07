import { IBaseStateType } from 'discord-mel'
import Giveaways from './Giveaways'

class StateType implements IBaseStateType
{
    public giveaways: Giveaways = new Giveaways()
}

export default StateType
