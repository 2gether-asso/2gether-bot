export const DISCORD_TOKEN = import.meta.env.DISCORD_TOKEN || null

export const MEL_LOG_PATH = import.meta.env.MEL_LOG_PATH || null
export const MEL_LOG_FILE = ((logFile: string) =>
	logFile === 'null' ? null : logFile
)(import.meta.env.MEL_LOG_FILE || './log.txt')
export const MEL_LOG_LEVEL = import.meta.env.MEL_LOG_LEVEL || null

export const MEL_STATE_PATH = ((statePath: string) =>
	statePath === 'null' ? null : statePath
)(import.meta.env.MEL_STATE_PATH || null)
export const MEL_STATE_FILE = ((stateFile: string) =>
	stateFile === 'null' ? null : stateFile
)(import.meta.env.MEL_STATE_FILE || './state.json')

export const MEL_TRANSLATIONS_DIR = ((translationsDir: string) =>
	translationsDir === 'null' ? null : translationsDir
)(import.meta.env.MEL_TRANSLATIONS_DIR || './translations')
export const MEL_DEFAULT_LANGUAGE = import.meta.env.MEL_DEFAULT_LANGUAGE || 'fr'

export const MEL_COMMANDS_DIR = ((commandsDir: string) =>
	commandsDir === 'null' ? null : commandsDir
)(import.meta.env.MEL_COMMANDS_DIR || './dist/commands')

export const MEL_GLOBAL = JSON.parse(import.meta.env.MEL_GLOBAL || '{}')

export const MEL_GUILD_DEFAULT = JSON.parse(import.meta.env.MEL_GUILD_DEFAULT || '{}')

export const MEL_GUILDS = JSON.parse(import.meta.env.MEL_GUILDS || '{}')

export const MEL_SERVICES = JSON.parse(import.meta.env.MEL_SERVICES || '{}')
