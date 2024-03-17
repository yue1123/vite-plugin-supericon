import { WebSocketServer } from 'vite'
import { NAME } from './constants'

export function createRpcServer<T extends Record<string, any>>(ws: WebSocketServer) {
  function send<U extends keyof T & string>(type: U, data: T[U]) {
    ws.send({
      type: 'custom',
      event: `${NAME}:${type}`,
      data: data
    })
  }
  return { send }
}
