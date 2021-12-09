import { Snowflake } from 'discord-api-types'

class Giveaways
{
    public wins:
        {
            [x: Snowflake]: number,
        } =
        {}

    public participations:
        {
            [x: Snowflake]: number,
        } =
        {}
}

export default Giveaways
