import { State as BaseState } from 'discord-mel'
import StateType from './StateType'

class State extends BaseState
{
	_db: StateType = new StateType()

	js: StateType = new StateType()

	constructor(stateFile?: string, charset: BufferEncoding = 'utf8')
	{
        super(stateFile, charset)
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
