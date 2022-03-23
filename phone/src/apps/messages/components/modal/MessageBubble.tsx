import { Avatar, Box, IconButton, Paper, Typography } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { makeStyles } from '@mui/styles';
import React, { useState } from 'react';
import { Message, MessageEvents } from '@typings/messages';
import StyledMessage from '../ui/StyledMessage';
import { PictureResponsive } from '@ui/components/PictureResponsive';
import { PictureReveal } from '@ui/components/PictureReveal';
import { useMyPhoneNumber } from '@os/simcard/hooks/useMyPhoneNumber';
import MessageBubbleMenu from './MessageBubbleMenu';
import { useSetSelectedMessage } from '../../hooks/state';
import MessageEmbed from '../ui/MessageEmbed';
import { useContactActions } from '../../../contacts/hooks/useContactActions';
import fetchNui from '@utils/fetchNui';

const useStyles = makeStyles((theme) => ({
  mySms: {
    float: 'right',
    margin: theme.spacing(1),
    padding: '6px 16px',
    height: 'auto',
    width: 'auto',
    minWidth: '50%',
    maxWidth: '80%',
    background: theme.palette.primary.light,
    color: theme.palette.getContrastText(theme.palette.primary.light),
    borderRadius: '20px',
    textOverflow: 'ellipsis',
  },
  sms: {
    float: 'left',
    padding: '6px 12px',
    width: 'auto',
    marginLeft: 5,
    minWidth: '50%',
    maxWidth: '80%',
    height: 'auto',
    background: theme.palette.background.default,
    color: theme.palette.text.primary,
    borderRadius: '15px',
    textOverflow: 'ellipsis',
  },
  message: {
    wordBreak: 'break-word',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}));

const isImage = (url: string) => {
  return /(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|png|jpeg|gif)/g.test(url);
};

function isJson(str: string) {
  if (typeof str !== 'string') return false;
  try {
    const result = JSON.parse(str);
    const type = Object.prototype.toString.call(result);
    return type === '[object Object]' || type === '[object Array]';
  } catch (e) {
    return false;
  }
}

const isPosition = (str: string) => {
  if (isJson(str) === true) {
    const pos = JSON.parse(str);
    if (typeof pos == 'object') {
      if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
        return true;
      }
    }
  }
  return false;
};

function parsePos(str) {
  const pos = JSON.parse(str);

  return `${pos.x} , ${pos.y}, ${pos.z}`;
}

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const classes = useStyles();
  const [menuOpen, setMenuOpen] = useState(false);
  const { getContactByNumber } = useContactActions();

  const setSelectedMessage = useSetSelectedMessage();
  const openMenu = () => {
    if (isPosition(message.message)) {
      fetchNui(MessageEvents.SET_WAYPOINT, JSON.parse(message.message));
    } else {
      setMenuOpen(true);
      setSelectedMessage(message);
    }
  };
  const myNumber = useMyPhoneNumber();
  const isMine = message.author === myNumber;

  let parsedEmbed;
  if (message?.embed) {
    parsedEmbed = JSON.parse(message?.embed);
  }

  const getContact = () => {
    return getContactByNumber(message.author);
  };

  return (
    <>
      <Box
        display="flex"
        ml={1}
        alignItems="stretch"
        justifyContent={isMine ? 'flex-end' : 'flex-start'}
        mt={1}
      >
        {!isMine && getContact() !== null ? <Avatar src={getContact().avatar} /> : null}
        <Paper className={isMine ? classes.mySms : classes.sms} variant="outlined">
          {message.is_embed ? (
            <MessageEmbed type={parsedEmbed.type} embed={parsedEmbed} isMine={isMine} />
          ) : (
            <StyledMessage onClick={() => openMenu()}>
              {isImage(message.message) ? (
                <PictureReveal>
                  <PictureResponsive src={message.message} alt="message multimedia" />
                </PictureReveal>
              ) : isPosition(message.message) === true ? (
                <>
                  {'Position'}
                  <br />
                  {parsePos(message.message)}
                </>
              ) : (
                <>{message.message}</>
              )}
              {isMine && (
                <IconButton color="primary" onClick={() => openMenu()}>
                  <MoreVertIcon />
                </IconButton>
              )}
            </StyledMessage>
          )}
          {!isMine && (
            <Typography fontWeight="bold" fontSize={14} color="#ddd">
              {getContact() !== null ? getContact().display : message.author}
            </Typography>
          )}
        </Paper>
      </Box>
      <MessageBubbleMenu open={menuOpen} handleClose={() => setMenuOpen(false)} />
    </>
  );
};
