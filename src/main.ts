import path from 'path'

import { Mel } from 'discord-mel'

import __abspath from './__abspath.js'
import State from './state/State.js'
import ActivityHooks from './hooks/ActivityHooks.js'
import Config from './config/Config.js'

Mel.Services.Config = Config
Mel.Services.State = State

const bot = new Mel(
	{
		absPath: path.dirname(__abspath),
		configFile: './config.json',
		logFile: './log.txt',
	},
	{
		intents:
			[
				Mel.Intents.FLAGS.GUILDS,
				Mel.Intents.FLAGS.GUILD_VOICE_STATES,
				Mel.Intents.FLAGS.GUILD_MESSAGES,
				Mel.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
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
