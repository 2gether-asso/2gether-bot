import { BaseState } from 'discord-mel'
import StateType from './StateType'

class State extends BaseState
{
	_db!: StateType

	js!: StateType

	constructor(stateFile?: string, charset: BufferEncoding = 'utf8')
	{
        super(stateFile, charset)
    }

	protected initProperties()
	{
		this._db = new StateType()
		this.js = new StateType()
	}

	get db()
	{
		this.accessed = true
		return this._db
	}

	async setState(callback: (state: StateType) => void)
	{
		callback(this._db)

		// Save changes
		this.accessed = true
		if (this.stateFile)
			this.save()
	}
}

export default State
