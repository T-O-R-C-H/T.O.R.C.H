import type { Message } from '../store/torchStore'

export interface ChatTurn {
  id: string
  user?: Message
  agent?: Message
  system?: Message
}

export function buildChatTurns(messages: Message[]): ChatTurn[] {
  const turns: ChatTurn[] = []
  let i = 0

  while (i < messages.length) {
    const msg = messages[i]

    if (msg.role === 'system') {
      turns.push({ id: msg.id, system: msg })
      i += 1
      continue
    }

    if (msg.role === 'user') {
      const next = messages[i + 1]
      if (next?.role === 'torch') {
        turns.push({ id: msg.id, user: msg, agent: next })
        i += 2
      } else {
        turns.push({ id: msg.id, user: msg })
        i += 1
      }
      continue
    }

    turns.push({ id: msg.id, agent: msg })
    i += 1
  }

  return turns
}
