import { Bot } from 'discord-mel'
import path from 'path'

const bot = new Bot({
	absPath: path.dirname(__dirname),
	configFile: './config.json',
}, {
	intents: [
		Bot.Intents.FLAGS.GUILDS,
		Bot.Intents.FLAGS.GUILD_MESSAGES,
		Bot.Intents.FLAGS.DIRECT_MESSAGES,
	],
	partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
})

// Start the bot
bot.start()
