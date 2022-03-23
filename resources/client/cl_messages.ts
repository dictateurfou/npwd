import {
  CreateMessageBroadcast,
  MessageConversationResponse,
  MessageEvents,
  ParticipantEdit,
  PreDBMessage,
} from '../../typings/messages';
import { onNetTyped } from '../server/utils/miscUtils';
import { sendMessageEvent } from '../utils/messages';
import { RegisterNuiCB, RegisterNuiProxy } from './cl_utils';

RegisterNuiProxy(MessageEvents.FETCH_MESSAGE_CONVERSATIONS);
RegisterNuiProxy(MessageEvents.DELETE_MESSAGE);
RegisterNuiProxy(MessageEvents.FETCH_MESSAGES);
RegisterNuiProxy(MessageEvents.CREATE_MESSAGE_CONVERSATION);
RegisterNuiProxy(MessageEvents.DELETE_CONVERSATION);
RegisterNuiProxy(MessageEvents.SEND_MESSAGE);
RegisterNuiProxy(MessageEvents.SET_MESSAGE_READ);
RegisterNuiProxy(MessageEvents.ADD_PARTICIPANT);

onNet(MessageEvents.SEND_MESSAGE_SUCCESS, (messageDto: PreDBMessage) => {
  sendMessageEvent(MessageEvents.SEND_MESSAGE_SUCCESS, messageDto);
});

onNet(MessageEvents.CREATE_MESSAGE_BROADCAST, (result: CreateMessageBroadcast) => {
  sendMessageEvent(MessageEvents.CREATE_MESSAGE_BROADCAST, result);
});

onNetTyped<ParticipantEdit>(MessageEvents.EDIT_PARTICIPANT, (rslt) => {
  console.log('passe dans on net typed');
  sendMessageEvent(MessageEvents.EDIT_PARTICIPANT, rslt);
});
onNet(MessageEvents.CREATE_MESSAGE_CONVERSATION_SUCCESS, (result: MessageConversationResponse) => {
  sendMessageEvent(MessageEvents.CREATE_MESSAGE_CONVERSATION_SUCCESS, result);
});

RegisterNuiCB<VectorPtr>(MessageEvents.GET_POSITION, async (data, cb) => {
  const [x, y, z] = GetEntityCoords(PlayerPedId(), false);
  cb({ x, y, z });
});

RegisterNuiCB<any>(MessageEvents.SET_WAYPOINT, async (data: any, cb) => {
  SetNewWaypoint(data.x, data.y);
  cb();
});
