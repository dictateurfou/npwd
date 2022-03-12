import DbInterface from '../db/db_wrapper';
import {
  CreateMessageDTO,
  Message,
  MessageConversation,
  MessagesRequest,
} from '../../../typings/messages';
import { ResultSetHeader } from 'mysql2';

const MESSAGES_PER_PAGE = 20;

export class _MessagesDB {
  getExisting() {}

  async getConversations(phoneNumber: string): Promise<MessageConversation[]> {
    //we have multiple option for opti request (better database architecture work with inner join and json one to many) or add limit on IN SELECT
    const query = `SELECT npwd_messages_conversations.id, CONCAT('[',GROUP_CONCAT(npwd_messages_participants.number),']') as participants,
                          npwd_messages_participants.unread_count as unreadCount,
                          npwd_messages_participants.id as participantId,
                          npwd_messages_conversations.is_group_chat as isGroupChat,
                          npwd_messages_conversations.label, npwd_messages_participants.number
                          FROM npwd_messages_participants
                          INNER JOIN npwd_messages_conversations ON npwd_messages_conversations.participants = npwd_messages_participants.id
                          WHERE npwd_messages_participants.id
                          IN (SELECT npwd_messages_conversations.participants
                          FROM npwd_messages_conversations
                          INNER JOIN npwd_messages_participants ON npwd_messages_participants.id = npwd_messages_conversations.participants
                          WHERE number = ?) GROUP BY npwd_messages_conversations.id`;

    const [results] = await DbInterface._rawExec(query, [phoneNumber]);
    //console.log(results);
    for (const v of <MessageConversation[]>results) {
      v.participants = JSON.parse(String(v.participants));
      for (let v2 of v.participants) {
        v2 = v2.toString();
      }
    }
    return <MessageConversation[]>results;
  }

  async getMessages(dto: MessagesRequest): Promise<Message[]> {
    const offset = MESSAGES_PER_PAGE * dto.page;

    const query = `SELECT npwd_messages.id,
                          npwd_messages.conversation_id,
                          npwd_messages.author,
                          npwd_messages.message,
                          npwd_messages.is_embed,
                          npwd_messages.embed
                   FROM npwd_messages
                   WHERE conversation_id = ?
                   ORDER BY id
                   LIMIT ? OFFSET ?`;

    const [results] = await DbInterface._rawExec(query, [
      dto.conversationId,
      MESSAGES_PER_PAGE,
      offset,
    ]);
    return <Message[]>results;
  }

  async createConversation(
    participants: string[],
    conversationLabel: string,
    isGroupChat: boolean,
  ) {
    //change all logique

    const conversationQuery = `INSERT INTO npwd_messages_conversations (participants,label, is_group_chat)
                               VALUES (?, ?, ?)`;
    const participantQuery = `INSERT INTO npwd_messages_participants (id, number)
                                VALUES (?, ?)`;

    let participantId;
    for (const participant of participants) {
      if (participantId === undefined) {
        participantId = await DbInterface.insert(
          `INSERT INTO npwd_messages_participants (number) VALUES (?)`,
          [participant],
        );
      } else {
        await DbInterface._rawExec(participantQuery, [participantId, participant]);
      }
    }

    const conversationId = await DbInterface.insert(conversationQuery, [
      participantId,
      isGroupChat ? conversationLabel : '',
      isGroupChat,
    ]);

    return [conversationId, participantId];
  }

  async addParticipantToConversation(conversationList: string, phoneNumber: string) {
    const conversationId = await this.getConversationId(conversationList);

    const participantQuery = `INSERT INTO npwd_messages_participants (id, number)
                              VALUES (?, ?)`;

    await DbInterface._rawExec(participantQuery, [conversationId, phoneNumber]);

    return conversationId;
  }

  async createMessage(dto: CreateMessageDTO) {
    console.log('createMessageDTO', dto);

    const query = `INSERT INTO npwd_messages (message, user_identifier, conversation_id, author, is_embed, embed)
                   VALUES (?, ?, ?, ?, ?, ?)`;

    const [results] = await DbInterface._rawExec(query, [
      dto.message,
      dto.userIdentifier,
      dto.conversationId,
      dto.authorPhoneNumber,
      dto.is_embed || false,
      dto.embed || '',
    ]);

    const result = <ResultSetHeader>results;

    return result.insertId;
  }

  async setMessageUnread(participantId: number, participantNumber: string) {
    const query = `UPDATE npwd_messages_participants
                   SET unread_count = unread_count + 1
                   WHERE id = ?
                     AND number = ?`;
    await DbInterface._rawExec(query, [participantId, participantNumber]);
  }

  async setMessageRead(participantId: number, participantNumber: string) {
    const query = `UPDATE npwd_messages_participants
                   SET unread_count = 0
                   WHERE id = ?
                     AND number = ?`;

    await DbInterface._rawExec(query, [participantId, participantNumber]);
  }

  async deleteMessage(message: Message) {
    const query = `DELETE
                   FROM npwd_messages
                   WHERE id = ?`;

    await DbInterface._rawExec(query, [message.id]);
  }

  async deleteConversation(conversationId: number, phoneNumber: string) {
    const query = `DELETE
                   FROM npwd_messages_participants
                   WHERE conversation_id = ?
                     AND number = ?`;

    await DbInterface._rawExec(query, [conversationId, phoneNumber]);
  }

  async doesConversationExist(participants: Array<string>): Promise<boolean> {
    const query = `SELECT npwd_messages_conversations.id, CONCAT('[',GROUP_CONCAT(npwd_messages_participants.number),']') as participants, COUNT(*) as count
                          FROM npwd_messages_participants
                          INNER JOIN npwd_messages_conversations ON npwd_messages_conversations.participants = npwd_messages_participants.id
                          WHERE npwd_messages_participants.id GROUP BY npwd_messages_participants.id HAVING COUNT(*) = ?`;

    const [results] = await DbInterface._rawExec(query, [participants.length]);
    const result = <any>results;

    let checker = (arr: Array<String>, target: Array<String>) =>
      target.every((v) => arr.includes(String(v)));
    for (const v of result) {
      const participantsConv = JSON.parse(v.participants);
      if (checker(participants, participantsConv) == true) {
        return true;
      }
    }
    return false;
  }

  async doesConversationExistForPlayer(
    participants: string,
    phoneNumber: string,
  ): Promise<boolean> {
    //need treat of data because its more hard to identify if conversation exist ex if we have (555 + 666 + 777) and (555 + 666 + 777 + 888) require very complex sql request maybe nosql is more optimised for group of conversation one to many see mongodb
    const conv = await this.getConversations(phoneNumber);
    let have = false;
    for (const v of conv) {
      console.log(v.participants);
    }
    //const result = <any>results;
    //const count = result[0].count;

    return have;
  }

  async getConversationByParticipant(participants: string[]) {
    const query = `SELECT npwd_messages_conversations.id, CONCAT('[',GROUP_CONCAT(npwd_messages_participants.number),']') as participants, COUNT(*) as count
                          FROM npwd_messages_participants
                          INNER JOIN npwd_messages_conversations ON npwd_messages_conversations.participants = npwd_messages_participants.id
                          WHERE npwd_messages_participants.id GROUP BY npwd_messages_participants.id HAVING COUNT(*) = ?`;

    const [results] = await DbInterface._rawExec(query, [participants.length]);
    const result = <any>results;

    let checker = (arr: Array<String>, target: Array<String>) =>
      target.every((v) => arr.includes(String(v)));
    for (const v of result) {
      const participantsConv = JSON.parse(v.participants);
      if (checker(participants, participantsConv) == true) {
        return v;
      }
    }
    return false;
  }
  // misc stuff
  async getConversationId(participantId: string): Promise<number> {
    const query = `SELECT id
                   FROM npwd_messages_conversations
                   WHERE participants = ?`;

    const [results] = await DbInterface._rawExec(query, [participantId]);
    const result = <any>results;

    return result[0].id;
  }
}

const MessagesDB = new _MessagesDB();

export default MessagesDB;
