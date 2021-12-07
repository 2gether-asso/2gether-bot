import { IBaseStateType } from 'discord-mel'
import { Snowflake } from 'discord-api-types'

class StateType implements IBaseStateType
{
    giveaways:
        {
            wins:
                {
                    [x: Snowflake]: number,
                },
            participations:
                {
                    [x: Snowflake]: number,
                },
        } =
        {
            wins: {},
            participations: {},
        }
}

export default StateType
