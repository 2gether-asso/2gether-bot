import { Snowflake } from 'discord-api-types'

type UserActivityCooldown = 'message' | 'command'

type UserActivityCooldowns =
    {
        [key in UserActivityCooldown]: number
    }

class UserActivity
{
    public score: number = 0

    public voiceSince: number = 0

    public cooldowns: UserActivityCooldowns =
        {
            message: -1,
            command: -1,
        }

    public ranking: Snowflake[] = []
}

export
{
    UserActivity,
    UserActivityCooldown,
    UserActivityCooldowns,
}

export default UserActivity
