import path from 'path'

import { Mel } from 'discord-mel'

import State from './state/State'
import ActivityHooks from './hooks/ActivityHooks'
import Config from './config/Config'
import * as LocalConfig from './config'

Mel.Services.Config = Config
Mel.Services.State = State

const bot = new Mel(
	{
		absPath: path.dirname(__dirname),
		...(LocalConfig.MEL_LOG_PATH !== null ? { logPath: LocalConfig.MEL_LOG_PATH } : {}),
		...(LocalConfig.MEL_LOG_FILE !== null ? { logFile: LocalConfig.MEL_LOG_FILE } : {}),
		...(LocalConfig.MEL_LOG_LEVEL !== null ? { logLevel: LocalConfig.MEL_LOG_LEVEL } : {}),
		...(LocalConfig.MEL_STATE_PATH !== null ? { statePath: LocalConfig.MEL_STATE_PATH } : {}),
		...(LocalConfig.MEL_STATE_FILE !== null ? { stateFile: LocalConfig.MEL_STATE_FILE } : {}),
		...(LocalConfig.MEL_TRANSLATIONS_DIR !== null ? { translationsDir: LocalConfig.MEL_TRANSLATIONS_DIR } : {}),
		...(LocalConfig.MEL_DEFAULT_LANGUAGE !== null ? { defaultLanguage: LocalConfig.MEL_DEFAULT_LANGUAGE } : {}),
		...(LocalConfig.MEL_COMMANDS_DIR !== null ? { commandsDir: LocalConfig.MEL_COMMANDS_DIR } : {}),
		...(LocalConfig.MEL_GLOBAL !== null ? { global: LocalConfig.MEL_GLOBAL } : {}),
		...(LocalConfig.MEL_GUILD_DEFAULT !== null ? { guildDefault: LocalConfig.MEL_GUILD_DEFAULT } : {}),
		...(LocalConfig.MEL_GUILDS !== null ? { guilds: LocalConfig.MEL_GUILDS } : {}),
		...(LocalConfig.MEL_SERVICES !== null ? { services: LocalConfig.MEL_SERVICES } : {}),
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
bot.start(LocalConfig.DISCORD_TOKEN ?? undefined)
