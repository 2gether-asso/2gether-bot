import { Snowflake } from 'discord-api-types'

class GiveawayStats
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

export default GiveawayStats
