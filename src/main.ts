import path from 'path'

import { Bot } from 'discord-mel'

import State from './state/State'
import ActivityHooks from './hooks/ActivityHooks'
import Config from './config/Config'

Bot.Services.Config = Config
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
				Bot.Intents.FLAGS.GUILD_VOICE_STATES,
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

const activityHooks = new ActivityHooks(bot)

// Start the bot
bot.start()
