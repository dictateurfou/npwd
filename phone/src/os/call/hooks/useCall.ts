import { ActiveCall } from '@typings/call';
import { useCurrentCall } from './state';
import { CallEvents } from '@typings/call';
import fetchNui from '@utils/fetchNui';
import { useCallback, useEffect } from 'react';
import { useMyPhoneNumber } from '@os/simcard/hooks/useMyPhoneNumber';
import { useSnackbar } from '@os/snackbar/hooks/useSnackbar';
import { useTranslation } from 'react-i18next';
import { ServerPromiseResp } from '@typings/common';
import { useDialingSound } from '@os/call/hooks/useDialingSound';
import { useDialActions } from '../../../apps/dialer/hooks/useDialActions';

interface CallHook {
  call: ActiveCall;
  setCall: (call: ActiveCall) => void;
  acceptCall(): void;
  rejectCall(): void;
  endCall(): void;
  initializeCall(number: string): void;
}

// const TIME_TILL_AUTO_HANGUP = 15000;

export const useCall = (): CallHook => {
  const [call, setCall] = useCurrentCall();
  const myPhoneNumber = useMyPhoneNumber();
  const [t] = useTranslation();
  const { addAlert } = useSnackbar();
  const { endDialTone, startDialTone } = useDialingSound();
  const { saveLocalCall } = useDialActions();

  useEffect(() => {
    if (call?.isTransmitter && !call?.is_accepted) {
      startDialTone();
    } else {
      endDialTone();
    }
  }, [startDialTone, endDialTone, call]);

  const initializeCall = useCallback(
    (number) => {
      // We allow calling of ourselves in development
      if (process.env.NODE_ENV !== 'development' && myPhoneNumber === number) {
        return addAlert({ message: t('CALLS.FEEDBACK.ERROR_MYSELF'), type: 'error' });
      }

      fetchNui<ServerPromiseResp<ActiveCall>>(CallEvents.INITIALIZE_CALL, {
        receiverNumber: number,
      }).then((resp) => {
        if (resp.status !== 'ok') {
          addAlert({ message: t('CALLS.FEEDBACK.ERROR'), type: 'error' });
          console.error(resp.errorMsg);
          return;
        }

        console.log('call resp', resp);

        // if ok, we save the call to the dialer history
        saveLocalCall({
          start: resp.data.start,
          is_accepted: resp.data.is_accepted,
          receiver: resp.data.receiver,
          transmitter: resp.data.transmitter,
          id: resp.data.identifier,
        });
      });
    },
    [addAlert, myPhoneNumber, t, saveLocalCall],
  );

  const acceptCall = useCallback(() => {
    fetchNui(CallEvents.ACCEPT_CALL, {
      transmitterNumber: call.transmitter,
    });
  }, [call]);

  const rejectCall = useCallback(() => {
    fetchNui(CallEvents.REJECTED, {
      transmitterNumber: call.transmitter,
    });
  }, [call]);

  const endCall = useCallback(() => {
    fetchNui(CallEvents.END_CALL, {
      transmitterNumber: call.transmitter,
      isUnavailable: call.isUnavailable,
      isTransmitter: call.transmitter === myPhoneNumber,
    });
  }, [call, myPhoneNumber]);

  return { call, setCall, acceptCall, rejectCall, endCall, initializeCall };
};
