import { Snowflake } from 'discord-api-types'
import { Discord } from 'discord-mel'
import UserActivity from './UserActivity'

class Activities
{
    public users:
        {
            [x: Snowflake]: UserActivity,
        } =
        {}

    public ranking: Snowflake[] = []

    /**
     * Get user activity (and initialize it if it does not already exist)
     */
    public getUser(user: Discord.User | Snowflake): UserActivity
    {
        if (user instanceof Discord.User)
        {
            user = user.id
        }

        this.users[user] = this.users[user] || new UserActivity()
        return this.users[user]
    }
}

export default Activities
