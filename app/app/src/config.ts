const DISCORD_TOKEN = import.meta.env.DISCORD_TOKEN || null

const MEL_LOG_PATH = import.meta.env.MEL_LOG_PATH || null
const MEL_LOG_FILE = import.meta.env.MEL_LOG_FILE || null
const MEL_LOG_LEVEL = import.meta.env.MEL_LOG_LEVEL || null

const MEL_STATE_PATH = ((statePath: string) =>
	statePath === 'null' ? null : statePath
)(import.meta.env.MEL_STATE_PATH || null)

const MEL_STATE_FILE = ((stateFile: string) =>
	stateFile === 'null' ? null : stateFile
)(import.meta.env.MEL_STATE_FILE || 'state.json')

const MEL_TRANSLATIONS_DIR = ((translationsDir: string) =>
	translationsDir === 'null' ? null : translationsDir
)(import.meta.env.MEL_TRANSLATIONS_DIR || './translations')

const MEL_DEFAULT_LANGUAGE = import.meta.env.MEL_DEFAULT_LANGUAGE || 'fr'

const MEL_COMMANDS_DIR = ((commandsDir: string) =>
	commandsDir === 'null' ? null : commandsDir
)(import.meta.env.MEL_COMMANDS_DIR || './dist/commands')

const MEL_GLOBAL = JSON.parse(import.meta.env.MEL_GLOBAL || '{}')

const MEL_GUILD_DEFAULT = JSON.parse(import.meta.env.MEL_GUILD_DEFAULT || '{}')

const MEL_GUILDS = JSON.parse(import.meta.env.MEL_GUILDS || '{}')

const MEL_SERVICES = JSON.parse(import.meta.env.MEL_SERVICES || '{}')
