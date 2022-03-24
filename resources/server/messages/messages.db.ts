import DbInterface from '../db/db_wrapper';
import {
  CreateMessageDTO,
  Message,
  MessageConversation,
  MessagesRequest,
  PreDBConv,
  PreDBParticipant,
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
                   ORDER BY id DESC
                   LIMIT ? OFFSET ?`;

    const results = await DbInterface.fetch<Message[]>(query, [
      dto.conversationId,
      MESSAGES_PER_PAGE,
      offset,
    ]);
    return results.reverse();
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

  async checkIfHaveParticipant(participantId: number, number: string) {
    const query = `SELECT * FROM npwd_messages_participants WHERE id = ? AND number = ?`;
    const rslt = await DbInterface.fetch<PreDBParticipant[]>(query, [participantId, number]);
    if (rslt[0] !== undefined) {
      return true;
    }
    return false;
  }

  async addParticipantToConversation(participantId: number, number: string) {
    const participantQuery = `INSERT INTO npwd_messages_participants (id, number)
                              VALUES (?, ?)`;
    const check = await this.checkIfHaveParticipant(participantId, number);
    if (check == false) {
      await DbInterface.insert(participantQuery, [participantId, number]);
    }
  }

  async getParticipantFromConv(participantId: number) {
    const participantQuery = 'SELECT * FROM npwd_messages_participants WHERE id = ?';
    const rslt = await DbInterface.fetch<PreDBParticipant[]>(participantQuery, [participantId]);
    const ret = [];
    for (const v of rslt) {
      ret.push(String(v.number));
    }
    return rslt;
  }

  async createMessage(dto: CreateMessageDTO) {
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

  async deleteConversation(participantId: number, phoneNumber: string) {
    const query = `DELETE
                   FROM npwd_messages_participants
                   WHERE id = ?
                     AND number = ?`;

    await DbInterface._rawExec(query, [participantId, phoneNumber]);
  }

  async deleteConversationMessages(convId: number) {
    const query = `DELETE FROM npwd_messages WHERE conversation_id = ?`;
    await DbInterface.exec(query, [convId]);
  }

  async deleteConversationDb(convId: number) {
    const query = `DELETE FROM npwd_messages_conversations WHERE id = ?`;
    await DbInterface.exec(query, [convId]);
  }

  async doesConversationExist(participants: Array<string>): Promise<boolean | number> {
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
        return v.id;
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

  async getConversationByParticipantId(participantId: number): Promise<MessageConversation | null> {
    const query = `SELECT npwd_messages_conversations.id,
                    CONCAT('[',GROUP_CONCAT(npwd_messages_participants.number),']') as participants,
                    COUNT(*) as count,
                    npwd_messages_participants.unread_count as unreadCount,
                    npwd_messages_participants.id as participantId,
                    npwd_messages_conversations.is_group_chat as isGroupChat,
                    npwd_messages_conversations.label, npwd_messages_participants.number
                    FROM npwd_messages_participants
                    INNER JOIN npwd_messages_conversations ON npwd_messages_conversations.participants = npwd_messages_participants.id
                    WHERE npwd_messages_participants.id = ? GROUP BY npwd_messages_participants.id`;

    const result = await DbInterface.fetch<any>(query, [participantId]);
    if (result[0] !== undefined) {
      result[0].participants = JSON.parse(result[0].participants);
      for (let v of result[0].participants) {
        v = String(v);
      }
      return result[0];
    }
    return null;
  }

  async getConversationId(participantId: number): Promise<number | null> {
    const result = await this.getConversationByParticipantId(participantId);
    if (result !== null) {
      return result.id;
    }
    return null;
  }

  async getConversationById(convId: number): Promise<MessageConversation | null> {
    const query = `SELECT * , participants as participantId FROM npwd_messages_conversations WHERE id = ?`;
    const result = await DbInterface.fetch<any>(query, [convId]);
    if (result[0] !== undefined) {
      return result[0];
    }
    return null;
  }

  async getParticipants(participantId: number): Promise<string[]> {
    const query = `SELECT * FROM npwd_messages_participants WHERE id = ?`;
    const result = await DbInterface.fetch<PreDBParticipant[]>(query, [participantId]);
    const rslt = [];
    for (const v of result) {
      rslt.push(String(v.number));
    }
    return rslt;
  }
}

const MessagesDB = new _MessagesDB();

export default MessagesDB;
