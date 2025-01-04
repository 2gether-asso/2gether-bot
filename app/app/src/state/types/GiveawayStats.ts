import { Snowflake } from 'discord-api-types/v9'

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
