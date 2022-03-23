import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ContactPageIcon from '@mui/icons-material/ContactPage';
import PinDropIcon from '@mui/icons-material/PinDrop';
import { ContextMenu, IContextMenuOption } from '@ui/components/ContextMenu';
import qs from 'qs';
import { useHistory, useLocation } from 'react-router-dom';
import { MessageImageModal } from './MessageImageModal';
import MessageContactModal from './MessageContactModal';
import Backdrop from '@ui/components/Backdrop';
import { MessageConversation, MessageEvents } from '@typings/messages';
import fetchNui from '@utils/fetchNui';
import { useMessageAPI } from '../../hooks/useMessageAPI';

interface MessageCtxMenuProps {
  isOpen: boolean;
  onClose: () => void;
  messageGroup: MessageConversation | undefined;
  image?: string;
}

const MessageContextMenu: React.FC<MessageCtxMenuProps> = ({
  isOpen,
  onClose,
  messageGroup,
  image,
}) => {
  const history = useHistory();
  const [t] = useTranslation();
  const { pathname, search } = useLocation();
  const [imagePreview, setImagePreview] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState<boolean>(false);
  const { sendMessage } = useMessageAPI();
  const modalsVisible = imagePreview || contactModalOpen;

  const sendPosition = async () => {
    const resp = await fetchNui<{ x: number; y: number; z: number }>(MessageEvents.GET_POSITION);
    sendMessage({
      conversationId: messageGroup.id,
      participants: messageGroup.participants,
      participantId: messageGroup.participantId,
      message: JSON.stringify(resp),
    });
  };

  const menuOptions: IContextMenuOption[] = useMemo(
    () => [
      {
        label: t('MESSAGES.MEDIA_OPTION'),
        icon: <PhotoLibraryIcon />,
        onClick: () =>
          history.push(
            `/camera?${qs.stringify({
              referal: encodeURIComponent(pathname + search),
            })}`,
          ),
      },
      {
        label: t('MESSAGES.CONTACT_OPTION'),
        icon: <ContactPageIcon />,
        onClick: () => setContactModalOpen(true),
      },
      {
        label: t('MESSAGES.SEND_POSITION'),
        icon: <PinDropIcon />,
        onClick: () => sendPosition(),
      },
    ],
    [history, pathname, search, t],
  );

  return (
    <>
      <ContextMenu open={isOpen} onClose={onClose} options={menuOptions} />
      {modalsVisible ? <Backdrop /> : undefined}
      <MessageImageModal
        image={image}
        imagePreview={imagePreview}
        setImagePreview={setImagePreview}
        messageGroup={messageGroup}
        onClose={onClose}
      />
      {
        <MessageContactModal
          messageGroup={messageGroup}
          isVisible={contactModalOpen}
          onClose={() => setContactModalOpen(false)}
        />
      }
    </>
  );
};

export default MessageContextMenu;
