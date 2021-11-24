import path from 'path'

import { Bot } from 'discord-mel'
import { DiscordTogether } from 'discord-together'

import State from './state/State'

Bot.Services.State = State

const bot = new Bot(
	{
		absPath: path.dirname(__dirname),
		configFile: './config.json',
		logFile: './log.txt',
	},
	{
		intents:
			[
				Bot.Intents.FLAGS.GUILDS,
				Bot.Intents.FLAGS.GUILD_MESSAGES,
				Bot.Intents.FLAGS.DIRECT_MESSAGES,
			],
		partials:
			[
				'MESSAGE',
				'CHANNEL',
				'REACTION'
			],
	})

// Initialize Discord Together
bot.config.discordTogether = new DiscordTogether(bot.client)

// Start the bot
bot.start()
