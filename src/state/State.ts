import { AbstractState } from 'discord-mel'
import StateType from './StateType'

class State extends AbstractState<StateType, StateType>
{
	constructor(stateFile?: string, charset: BufferEncoding = 'utf8')
	{
		super(stateFile, charset)
	}

	protected initProperties(): void
	{
		this._db = new StateType()
		this.js = new StateType()
	}
}

export default State
