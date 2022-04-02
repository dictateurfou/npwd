import { messageState, useSetMessageConversations, useSetMessages } from './state';
import { useCallback } from 'react';
import { Message, MessageConversation, ParticipantEdit } from '@typings/messages';
import { useRecoilValueLoadable } from 'recoil';
import { useContactActions } from '../../contacts/hooks/useContactActions';
import { useMyPhoneNumber } from '@os/simcard/hooks/useMyPhoneNumber';
import { Contact } from '@typings/contact';

interface MessageActionProps {
  updateLocalConversations: (conversation: MessageConversation) => void;
  removeLocalConversation: (conversationId: number[]) => void;
  updateLocalMessages: (messageDto: Message) => void;
  deleteLocalMessage: (messageId: number) => void;
  setMessageReadState: (participantId: number, unreadCount: number) => void;
  getMessageReadState: (participantId: number) => number | boolean;
  getLabelOrContact: (messageConversation: MessageConversation, number: string) => string;
  getConversationParticipant: (participants: string[]) => Contact | null;
  editConversationParticipant: (data: ParticipantEdit) => void;
}

export const useMessageActions = (): MessageActionProps => {
  const { state: messageLoading } = useRecoilValueLoadable(messageState.messages);
  const { state: conversationLoading, contents: conversations } = useRecoilValueLoadable(
    messageState.messageCoversations,
  );
  const setMessageConversation = useSetMessageConversations();
  const setMessages = useSetMessages();
  const { getContactByNumber } = useContactActions();
  const myPhoneNumber = useMyPhoneNumber();

  const updateLocalConversations = useCallback(
    (conversation: MessageConversation) => {
      setMessageConversation((curVal) => [conversation, ...curVal]);
    },
    [setMessageConversation],
  );

  const setMessageReadState = useCallback(
    (participantId: number, unreadCount: number) => {
      const find = conversations.findIndex((element) => element.participantId === participantId); //because if update later or anithing if you send event it break phone if convo d'osnt exist
      if (find === -1) return;
      setMessageConversation((curVal) =>
        curVal.map((message: MessageConversation) => {
          if (message.participantId === participantId) {
            return {
              ...message,
              unreadCount: unreadCount,
            };
          }

          return message;
        }),
      );
    },
    [setMessageConversation, conversations],
  );

  const getMessageReadState = useCallback(
    (participantId: number): number | boolean => {
      const find = conversations.findIndex((element) => element.participantId === participantId); //because if update later or anithing if you send event it break phone if convo d'osnt exist
      if (find === -1) return false;
      return conversations[find].unreadCount;
    },
    [conversations],
  );

  const getLabelOrContact = useCallback(
    (messageConversation: MessageConversation, phoneNumber: string): string => {
      const conversationLabel = messageConversation.label;
      // This is the source
      const participants = messageConversation.participants;

      // Label is required if the conversation is a group chat
      if (messageConversation.isGroupChat) return conversationLabel;

      for (const p of participants) {
        if (String(p) !== phoneNumber) {
          const contact = getContactByNumber(p);
          return contact ? contact.display : String(p); //force string here because json transfert server to ui make number of value when decoded :(
        }
      }
    },
    [getContactByNumber],
  );

  const removeLocalConversation = useCallback(
    (conversationsId: number[]) => {
      if (conversationLoading !== 'hasValue') return;

      if (!conversations.length) return;
      const newVal = conversations.filter(
        (conversation) => !conversationsId.includes(conversation.id),
      );
      setMessageConversation(newVal); //before filter is in function (itterator but its buggy and doesn't really delete convo on var idk for what because on template refresh work)
    },
    [setMessageConversation, conversationLoading, conversations],
  );

  const updateLocalMessages = useCallback(
    (messageDto: Message) => {
      if (messageLoading !== 'hasValue') return;
      const find = conversations.findIndex((element) => element.id === messageDto.conversation_id);
      if (find === -1) return; //because if update later or anithing if you send event it break phone if convo d'osnt exist
      setMessages((currVal) => [
        ...currVal,
        {
          message: messageDto.message,
          conversation_id: messageDto.conversation_id,
          author: messageDto.author,
          id: messageDto.id,
          is_embed: messageDto.is_embed,
          embed: messageDto.embed,
        },
      ]);
    },
    [messageLoading, setMessages, conversations],
  );

  const deleteLocalMessage = useCallback(
    (messageId: number) => {
      setMessages((currVal) => [...currVal].filter((msg) => msg.id !== messageId));
    },
    [setMessages],
  );

  const getConversationParticipant = useCallback(
    (participants: string[]) => {
      const participant = participants.filter((p) => p !== myPhoneNumber);

      return getContactByNumber(participant[0]);
    },
    [getContactByNumber, myPhoneNumber],
  );

  const editConversationParticipant = useCallback(
    (data: ParticipantEdit) => {
      const participantId = data.convId;
      setMessageConversation((curVal) =>
        curVal.map((message: MessageConversation) => {
          if (message.participantId === participantId) {
            const participants = [...message.participants];
            if (data.type === 'add') {
              if (!message.participants.includes(String(data.number))) {
                participants.push(String(data.number)); //idk push cause error in console maybe due to recoil (recoil is shit) vue have better store xD
              }
            }

            if (data.type === 'del') {
              if (message.participants.includes(String(data.number))) {
                const index = message.participants.indexOf(String(data.number));
                if (index !== -1) {
                  participants.splice(index, 1);
                }
              }
            }
            return {
              ...message,
              participants: participants,
            };
          }

          return message;
        }),
      );
    },
    [setMessageConversation],
  );

  return {
    updateLocalConversations,
    removeLocalConversation,
    updateLocalMessages,
    deleteLocalMessage,
    setMessageReadState,
    getLabelOrContact,
    getConversationParticipant,
    editConversationParticipant,
    getMessageReadState,
  };
};
