import { AbstractState } from 'discord-mel'
import StateDB from './StateDB'

class State extends AbstractState<StateDB>
{
	constructor(stateFile?: string, charset: BufferEncoding = 'utf8')
	{
		super(stateFile, charset)
	}

	protected initProperties(): void
	{
		this._db = new StateDB()
	}
}

export default State
