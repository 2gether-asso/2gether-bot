import { State as BaseState } from "discord-mel";
import StateType from "./StateType";

class State extends BaseState
{
	_db: StateType = new StateType()

	js: StateType = new StateType()

	constructor(stateFile?: string, charset: BufferEncoding = 'utf8')
	{
        super(stateFile, charset)
    }
}

export default State
