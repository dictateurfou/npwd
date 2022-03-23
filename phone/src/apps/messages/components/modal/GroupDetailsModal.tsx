import React from 'react';
import Modal from '@ui/components/Modal';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { findParticipants } from '../../utils/helpers';
import { useMyPhoneNumber } from '@os/simcard/hooks/useMyPhoneNumber';
import { useContactActions } from '../../../contacts/hooks/useContactActions';
import { NewParticipantForm } from '../form/NewParticipantForm';
import { useMessageAPI } from '../../hooks/useMessageAPI';
interface GroupDetailsModalProps {
  open: boolean;
  onClose: () => void;
  participants: Array<string>;
  addContact: (number: any) => void;
  participantId: number;
}

const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  open,
  onClose,
  participants,
  addContact,
  participantId,
}) => {
  const myPhoneNumber = useMyPhoneNumber();
  const { getContactByNumber } = useContactActions();
  const { addParticipantToConversation } = useMessageAPI();
  //const participants = findParticipants(conversationList, myPhoneNumber);
  const participantsWithoutLocalNumber = findParticipants(participants, myPhoneNumber);

  const findContact = (phoneNumber: string) => {
    return getContactByNumber(phoneNumber);
  };

  const handleAddContact = (participant: string) => {
    addContact(participant);
  };

  const addParticipantValue = async (value: string) => {
    console.log(value);
    await addParticipantToConversation(participantId, value);
  };

  return (
    <Modal visible={open} handleClose={onClose}>
      <Box>
        <Stack direction="row" spacing={4}>
          <Typography fontSize={20}>Details</Typography>
          {/*<Button size="small">Add participant</Button>*/}
        </Stack>
      </Box>

      <Paper style={{ maxHeight: 350, overflow: 'auto' }}>
        {participantsWithoutLocalNumber.map((participant) => {
          const contact = findContact(participant);

          return (
            <Box mt={2}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={2}>
                  <PersonIcon fontSize="medium" />
                  <Typography fontSize={18}>
                    {contact !== null ? contact.display : participant}
                  </Typography>
                </Stack>
                {!contact && (
                  <Button onClick={() => handleAddContact(participant)}>
                    <PersonAddIcon fontSize="medium" />
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
      </Paper>
      <Box>
        <NewParticipantForm getResult={addParticipantValue}></NewParticipantForm>
      </Box>
    </Modal>
  );
};

export default GroupDetailsModal;
