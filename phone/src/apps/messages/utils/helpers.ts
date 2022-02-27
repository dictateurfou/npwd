/**
 * Find all participants except the source;
 * @param conversationList
 * @param phoneNumber
 */
export const findParticipants = (conversationList: Array<string>, phoneNumber: string) => {
  return conversationList.filter((participant) => participant !== phoneNumber);
};
