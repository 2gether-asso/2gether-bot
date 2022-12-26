import path from 'path'

import { Discord, Mel } from 'discord-mel'

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
				Discord.IntentsBitField.Flags.Guilds,
				Discord.IntentsBitField.Flags.GuildVoiceStates,
				Discord.IntentsBitField.Flags.GuildMessages,
				Discord.IntentsBitField.Flags.GuildMessageReactions,
				Discord.IntentsBitField.Flags.DirectMessages,
			],
		partials:
			[
				Discord.Partials.Message,
				Discord.Partials.Channel,
				Discord.Partials.Reaction,
			],
	})

const activityHooks = new ActivityHooks(bot)

// Start the bot
bot.start()
