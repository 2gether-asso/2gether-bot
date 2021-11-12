import { IBaseStateType } from "discord-mel";
import { Snowflake } from "discord-api-types";

interface IStateType
{
    giveaways:
        {
            wins:
                {
                    [x: Snowflake]: number
                }
        }
}

class StateType implements IBaseStateType, IStateType
{
    giveaways =
        {
            wins: {}
        }
}

export default StateType
