import MessagesDB, { _MessagesDB } from './messages.db';
import {
  createGroupHashID,
  getIdentifiersFromParticipants,
  messagesLogger,
} from './messages.utils';
import { PromiseEventResp, PromiseRequest } from '../lib/PromiseNetEvents/promise.types';
import {
  DeleteConversationRequest,
  EmitMessageExportCtx,
  Message,
  MessageConversation,
  MessageEvents,
  MessagesRequest,
  PreDBConversation,
  PreDBMessage,
} from '../../../typings/messages';
import PlayerService from '../players/player.service';
import { emitNetTyped } from '../utils/miscUtils';

class _MessagesService {
  private readonly messagesDB: _MessagesDB;

  constructor() {
    this.messagesDB = MessagesDB;
    messagesLogger.debug('Messages service started');
  }

  async handleFetchMessageConversations(
    reqObj: PromiseRequest<void>,
    resp: PromiseEventResp<MessageConversation[]>,
  ) {
    const phoneNumber = PlayerService.getPlayer(reqObj.source).getPhoneNumber();

    try {
      const conversations = await MessagesDB.getConversations(phoneNumber);

      resp({ status: 'ok', data: conversations });
    } catch (err) {
      resp({ status: 'error', errorMsg: err.message });
    }
  }

  /*conversationLabel: isGroupChat ? conversationLabel : '',
      participants: [myPhoneNumber, ...selectedParticipants],
      isGroupChat,*/
  async handleCreateMessageConversation(
    reqObj: PromiseRequest<PreDBConversation>,
    resp: PromiseEventResp<MessageConversation>,
  ) {
    const playerPhoneNumber = PlayerService.getPlayer(reqObj.source).getPhoneNumber();
    const conversation = reqObj.data;
    const participants = conversation.participants;

    const doesExist = await this.messagesDB.doesConversationExist(participants);

    if (doesExist) {
      //already exist (need refactor)
      /*const playerHasConversation = await this.messagesDB.doesConversationExistForPlayer(
        conversationList,
        playerPhoneNumber,
      );

      if (playerHasConversation) {
        return resp({
          status: 'error',
          errorMsg: 'MESSAGES.FEEDBACK.MESSAGE_CONVERSATION_DUPLICATE',
        });
      } else {
        const conversationId = await this.messagesDB.addParticipantToConversation(
          conversationList,
          playerPhoneNumber,
        );

        const respData = {
          id: conversationId,
          label: conversation.conversationLabel,
          conversationList,
          isGroupChat: conversation.isGroupChat,
        };

        return resp({ status: 'ok', data: { ...respData, participants: [playerPhoneNumber] } });
      }*/
      return resp({
        status: 'error',
        errorMsg: 'MESSAGES.FEEDBACK.MESSAGE_CONVERSATION_DUPLICATE',
      });
    }

    try {
      const [conversationId, participantId] = await MessagesDB.createConversation(
        participants,
        conversation.conversationLabel,
        conversation.isGroupChat,
      );

      // Return data
      const respData = {
        id: conversationId,
        label: conversation.conversationLabel,
        isGroupChat: conversation.isGroupChat,
        participantId: participantId,
        participants: participants,
      };

      resp({ status: 'ok', data: { ...respData } });

      for (const participant of participants) {
        if (participant !== playerPhoneNumber) {
          const participantIdentifier = await PlayerService.getIdentifierByPhoneNumber(participant);
          const participantPlayer = PlayerService.getPlayerFromIdentifier(participantIdentifier);

          if (participantPlayer) {
            emitNetTyped<MessageConversation>(
              MessageEvents.CREATE_MESSAGE_CONVERSATION_SUCCESS,
              {
                ...respData,
              },
              participantPlayer.source,
            );
          }
        }
      }
    } catch (err) {
      resp({ status: 'error', errorMsg: err.message });
    }
  }

  async handleFetchMessages(
    reqObj: PromiseRequest<MessagesRequest>,
    resp: PromiseEventResp<Message[]>,
  ) {
    try {
      const messages = await MessagesDB.getMessages(reqObj.data);

      resp({ status: 'ok', data: messages });
    } catch (err) {
      resp({ status: 'error', errorMsg: err.message });
    }
  }

  async handleSendMessage(reqObj: PromiseRequest<PreDBMessage>, resp: PromiseEventResp<Message>) {
    try {
      const player = PlayerService.getPlayer(reqObj.source);
      const authorPhoneNumber = player.getPhoneNumber();
      const messageData = reqObj.data;
      const participants = messageData.participants;
      const userIdentifier = player.getIdentifier();

      const messageId = await this.messagesDB.createMessage({
        userIdentifier,
        authorPhoneNumber,
        conversationId: messageData.conversationId,
        message: messageData.message,
        is_embed: messageData.is_embed,
        embed: messageData.embed,
      });

      resp({
        status: 'ok',
        data: {
          ...messageData,
          conversation_id: messageData.conversationId,
          author: authorPhoneNumber,
          id: messageId,
          message: messageData.message,
          embed: messageData.embed,
          is_embed: messageData.is_embed,
        },
      });

      console.log('passe dabns handle message');
      // participantId is the participants phone number
      for (let participantNumber of participants) {
        participantNumber = String(participantNumber); // force string
        if (participantNumber !== String(player.getPhoneNumber())) {
          const participantIdentifier = await PlayerService.getIdentifierByPhoneNumber(
            participantNumber,
            true,
          );

          const participantPlayer = PlayerService.getPlayerFromIdentifier(participantIdentifier);
          await this.messagesDB.setMessageUnread(messageData.participantId, participantNumber);

          if (participantPlayer) {
            emitNet(MessageEvents.SEND_MESSAGE_SUCCESS, participantPlayer.source, {
              ...messageData,
              conversation_id: messageData.conversationId,
              author: authorPhoneNumber,
            });
            emitNet(MessageEvents.CREATE_MESSAGE_BROADCAST, participantPlayer.source, {
              conversationName: player.getPhoneNumber(),
              conversation_id: messageData.conversationId,
              message: messageData.message,
              is_embed: messageData.is_embed,
              embed: messageData.embed,
            });
          }
        }
      }
    } catch (err) {
      resp({ status: 'error', errorMsg: err.message });
    }
  }

  async handleSetMessageRead(reqObj: PromiseRequest<number>, resp: PromiseEventResp<void>) {
    const phoneNumber = PlayerService.getPlayer(reqObj.source).getPhoneNumber();

    try {
      await this.messagesDB.setMessageRead(reqObj.data, phoneNumber);

      resp({ status: 'ok' });
    } catch (err) {
      messagesLogger.error(`Failed to read message. Error: ${err.message}`);
      resp({ status: 'error' });
    }
  }

  async handleDeleteMessage(reqObj: PromiseRequest<Message>, resp: PromiseEventResp<void>) {
    try {
      await this.messagesDB.deleteMessage(reqObj.data);

      resp({ status: 'ok' });
    } catch (err) {
      resp({ status: 'error', errorMsg: err.message });
    }
  }

  async handleDeleteConversation(
    reqObj: PromiseRequest<DeleteConversationRequest>,
    resp: PromiseEventResp<void>,
  ) {
    const phoneNumber = PlayerService.getPlayer(reqObj.source).getPhoneNumber();
    const conversationsId = reqObj.data.conversationsId;

    try {
      for (const id of conversationsId) {
        await this.messagesDB.deleteConversation(id, phoneNumber);
      }
      resp({ status: 'ok' });
    } catch (err) {
      resp({ status: 'error', errorMsg: err.message });
    }
  }

  // Exports
  async handleEmitMessage(dto: EmitMessageExportCtx) {
    const { senderNumber, targetNumber, message } = dto;

    try {
      const senderPlayer = await PlayerService.getIdentifierByPhoneNumber(senderNumber, true);

      const participantIdentifier = await PlayerService.getIdentifierByPhoneNumber(targetNumber);
      const participantPlayer = PlayerService.getPlayerFromIdentifier(participantIdentifier);

      // Get our conversationId
      const conversation = await this.messagesDB.getConversationByParticipant([
        senderNumber,
        targetNumber,
      ]);
      if (conversation !== false) {
        const messageId = await this.messagesDB.createMessage({
          message,
          embed: '',
          is_embed: false,
          conversationId: conversation.id,
          userIdentifier: senderPlayer || senderNumber,
          authorPhoneNumber: senderNumber,
        });

        // Create respondObj
        const messageData = {
          id: messageId,
          message,
          conversation_id: conversation.id,
          author: senderNumber,
        };

        if (participantPlayer) {
          emitNet(MessageEvents.SEND_MESSAGE_SUCCESS, participantPlayer.source, {
            ...messageData,
            conversation_id: conversation.id,
            author: senderNumber,
          });
          emitNet(MessageEvents.CREATE_MESSAGE_BROADCAST, participantPlayer.source, {
            conversationName: senderNumber,
            conversation_id: conversation.id,
            message: messageData.message,
          });
        }
        console.log(conversation);
        await this.messagesDB.setMessageUnread(conversation.participantId, targetNumber);
      }
    } catch (err) {
      console.log(`Failed to emit message. Error: ${err.message}`);
    }
  }
}

const MessagesService = new _MessagesService();

export default MessagesService;
