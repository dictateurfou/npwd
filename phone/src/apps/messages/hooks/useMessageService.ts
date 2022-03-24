import { useActiveMessageConversation } from './state';
import { useNuiEvent } from 'fivem-nui-react-lib';
import { Message, MessageConversation, MessageEvents, ParticipantEdit } from '@typings/messages';
import { useMessageActions } from './useMessageActions';
import { useCallback } from 'react';
import { useMessageNotifications } from './useMessageNotifications';
import { useLocation } from 'react-router';

export const useMessagesService = () => {
  const {
    updateLocalMessages,
    updateLocalConversations,
    setMessageReadState,
    editConversationParticipant,
    removeLocalConversation,
  } = useMessageActions();
  const { setNotification } = useMessageNotifications();
  const { pathname } = useLocation();
  const activeMessageConversation = useActiveMessageConversation();

  const handleMessageBroadcast = ({ conversationName, conversation_id, message }) => {
    if (pathname.includes(`/messages/conversations/${conversation_id}`)) {
      return;
    }
    // Set the current unread count to 1, when they click it will be removed
    setMessageReadState(conversation_id, 1);
    setNotification({ conversationName, conversationId: conversation_id, message });
  };

  // This is only called for the receiver of the message. We'll be using the standardized pattern for the transmitter.
  const handleUpdateMessages = useCallback(
    (messageDto: Message) => {
      if (activeMessageConversation.id !== messageDto.conversation_id) return;

      updateLocalMessages(messageDto);
    },
    [updateLocalMessages, activeMessageConversation],
  );

  const handleAddConversation = useCallback(
    (conversation: MessageConversation) => {
      updateLocalConversations({
        participantId: conversation.participantId,
        participants: conversation.participants,
        isGroupChat: conversation.isGroupChat,
        id: conversation.id,
        label: conversation.label,
        unread: 0,
      });
    },
    [updateLocalConversations],
  );

  const handleEditParticipantConv = useCallback(
    (data: ParticipantEdit) => {
      //data.convId
      editConversationParticipant(data);
    },
    [editConversationParticipant],
  );

  const handleDeleteConv = useCallback(
    (convId: number) => {
      removeLocalConversation([convId]);
    },
    [removeLocalConversation],
  );

  useNuiEvent('MESSAGES', MessageEvents.DELETE_CONV_WITHOUT_PROXY, handleDeleteConv);
  useNuiEvent('MESSAGES', MessageEvents.EDIT_PARTICIPANT, handleEditParticipantConv);
  useNuiEvent('MESSAGES', MessageEvents.CREATE_MESSAGE_BROADCAST, handleMessageBroadcast);
  useNuiEvent('MESSAGES', MessageEvents.SEND_MESSAGE_SUCCESS, handleUpdateMessages);
  useNuiEvent('MESSAGES', MessageEvents.CREATE_MESSAGE_CONVERSATION_SUCCESS, handleAddConversation);
};
