import { Message, MessageConversation } from '@typings/messages';
import { ServerPromiseResp } from '@typings/common';

export const MockMessageConversations: MessageConversation[] = [
  {
    id: 1,
    participantId: 1,
    participants: ['445885', '4545154'],
    unread: 0,
    label: '',
    updatedAt: 5,
    isGroupChat: false,
  },
  {
    id: 2,
    participantId: 2,
    participants: ['4455', '454554'],
    unread: 0,
    label: 'Secret Project Error chat',
    updatedAt: 5,
    isGroupChat: true,
  },
];

const MockConversationMessages: Message[] = [
  {
    id: 2,
    author: '215-8139',
    message: 'Dude, when is this rewrite done?????',
  },
  {
    id: 2,
    author: '111-1134',
    message: 'Bro, finish notifications api?????',
  },
  {
    id: 3,
    author: '444-4444',
    message: "Couldn't be me!",
  },
];

export const MockConversationServerResp: ServerPromiseResp<Message[]> = {
  data: MockConversationMessages,
  status: 'ok',
};
