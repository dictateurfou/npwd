import MessagesDB, { _MessagesDB } from './messages.db';
import { messagesLogger } from './messages.utils';
import { PromiseEventResp, PromiseRequest } from '../lib/PromiseNetEvents/promise.types';
import {
  DeleteConversationRequest,
  EmitMessageExportCtx,
  Message,
  MessageConversation,
  MessageEvents,
  MessagesRequest,
  ParticipantEdit,
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
    resp: PromiseEventResp<MessageConversation | number | boolean>,
  ) {
    const playerPhoneNumber = PlayerService.getPlayer(reqObj.source).getPhoneNumber();
    const conversation = reqObj.data;
    const participants = conversation.participants;

    const doesExist = await this.messagesDB.doesConversationExist(participants);

    if (doesExist !== false) {
      return resp({
        status: 'error',
        errorMsg: 'MESSAGES.FEEDBACK.MESSAGE_CONVERSATION_DUPLICATE',
        data: doesExist,
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
              participantId: messageData.participantId,
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
      const participantConvList = [];
      const deleteRequest = [];
      const allConvDataReq = [];
      for (const i in conversationsId) {
        allConvDataReq.push(this.messagesDB.getConversationById(conversationsId[i]));
      }
      const allConvDataResult = await Promise.all(allConvDataReq);
      for (const i in conversationsId) {
        if (allConvDataResult[i] !== null) {
          deleteRequest.push(
            this.messagesDB.deleteConversation(allConvDataResult[i].participantId, phoneNumber),
          );
        }
      }
      await Promise.all(deleteRequest);
      for (const id of conversationsId) {
        participantConvList.push(this.messagesDB.getParticipants(id));
      }
      const allParticipantConvList = await Promise.all(participantConvList);
      for (const i in conversationsId) {
        const participants = allParticipantConvList[i];

        for (const number of participants) {
          const player = PlayerService.getPlayerFromNumber(number);
          let requireDelete = false;
          if (participants.length <= 1) {
            //check for delete if have no people on conv
            await this.messagesDB.deleteConversation(
              allConvDataResult[i].participantId,
              String(number),
            );
            await this.messagesDB.deleteConversationDb(conversationsId[i]);
            await this.messagesDB.deleteConversationMessages(conversationsId[i]);
            requireDelete = true;
          }

          if (player !== null && String(phoneNumber) !== String(number)) {
            if (requireDelete === true) {
              console.log(`send event DELETE CONV WHITOUT PROXY to ${player.source}`);
              emitNetTyped<any>(
                MessageEvents.DELETE_CONV_WITHOUT_PROXY,
                conversationsId[i],
                player.source,
              );
            } else {
              emitNetTyped<ParticipantEdit>(
                MessageEvents.EDIT_PARTICIPANT,
                { type: 'del', number: phoneNumber, convId: conversationsId[i] },
                player.source,
              );
            }
          }
        }
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
        await this.messagesDB.setMessageUnread(conversation.participantId, targetNumber);
      }
    } catch (err) {
      console.log(`Failed to emit message. Error: ${err.message}`);
    }
  }

  async handleAddParticipantToConversation(
    reqObj: PromiseRequest<{ participantId: number; number: string }>,
    resp: PromiseEventResp<boolean>,
  ) {
    const data = reqObj.data;
    await this.messagesDB.addParticipantToConversation(data.participantId, data.number);
    const conv = await this.messagesDB.getConversationByParticipantId(data.participantId);
    const allParticipants = conv.participants;
    if (conv !== null) {
      for (const v of allParticipants) {
        if (String(data.number) !== String(v)) {
          const player = PlayerService.getPlayerFromNumber(v);
          if (player !== null) {
            emitNetTyped<ParticipantEdit>(
              MessageEvents.EDIT_PARTICIPANT,
              { type: 'add', number: data.number, convId: conv.id },
              player.source,
            );
          }
        } else {
          const player = PlayerService.getPlayerFromNumber(v);
          if (player !== null) {
            const convData = {
              id: conv.id,
              label: conv.label,
              isGroupChat: conv.isGroupChat,
              participantId: conv.participantId,
              participants: allParticipants,
            };
            emitNetTyped<MessageConversation>(
              MessageEvents.CREATE_MESSAGE_CONVERSATION_SUCCESS,
              {
                ...convData,
              },
              player.source,
            );
          }
        }
      }
    }
    if (conv !== null) {
      resp({ status: 'ok', data: true });
    } else {
      resp({ status: 'ok', data: false });
    }
  }
}

const MessagesService = new _MessagesService();

export default MessagesService;
