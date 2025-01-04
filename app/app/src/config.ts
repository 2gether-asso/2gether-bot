export const DISCORD_TOKEN = process.env.DISCORD_TOKEN || null

export const MEL_LOG_PATH = process.env.MEL_LOG_PATH || null
export const MEL_LOG_FILE = ((logFile: string | null) =>
	logFile === 'null' ? null : logFile
)(process.env.MEL_LOG_FILE || './log.txt')
export const MEL_LOG_LEVEL = process.env.MEL_LOG_LEVEL || null

export const MEL_STATE_PATH = ((statePath: string | null) =>
	statePath === 'null' ? null : statePath
)(process.env.MEL_STATE_PATH || null)
export const MEL_STATE_FILE = ((stateFile: string | null) =>
	stateFile === 'null' ? null : stateFile
)(process.env.MEL_STATE_FILE || './state.json')

export const MEL_TRANSLATIONS_DIR = ((translationsDir: string | null) =>
	translationsDir === 'null' ? null : translationsDir
)(process.env.MEL_TRANSLATIONS_DIR || './translations')
export const MEL_DEFAULT_LANGUAGE = process.env.MEL_DEFAULT_LANGUAGE || 'fr'

export const MEL_COMMANDS_DIR = ((commandsDir: string | null) =>
	commandsDir === 'null' ? null : commandsDir
)(process.env.MEL_COMMANDS_DIR || './dist/commands')

export const MEL_GLOBAL = JSON.parse(process.env.MEL_GLOBAL || '{}')

export const MEL_GUILD_DEFAULT = JSON.parse(process.env.MEL_GUILD_DEFAULT || '{}')

export const MEL_GUILDS = JSON.parse(process.env.MEL_GUILDS || '{}')

export const MEL_SERVICES = JSON.parse(process.env.MEL_SERVICES || '{}')
