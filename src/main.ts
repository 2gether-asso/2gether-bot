import path from 'path'

import { Mel } from 'discord-mel'

import State from './state/State'
import ActivityHooks from './hooks/ActivityHooks'
import Config from './config/Config'

Mel.Services.Config = Config
Mel.Services.State = State

const bot = new Mel(
	{
		absPath: path.dirname(__dirname),
		configFile: './config.json',
		logFile: './log.txt',
	},
	{
		intents:
			[
				Mel.Intents.FLAGS.GUILDS,
				Mel.Intents.FLAGS.GUILD_VOICE_STATES,
				Mel.Intents.FLAGS.GUILD_MESSAGES,
				Mel.Intents.FLAGS.DIRECT_MESSAGES,
			],
		partials:
			[
				'MESSAGE',
				'CHANNEL',
				'REACTION',
			],
	})

const activityHooks = new ActivityHooks(bot)

// Start the bot
bot.start()
