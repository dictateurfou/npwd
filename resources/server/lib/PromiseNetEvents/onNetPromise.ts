import { getSource } from '../../utils/miscUtils';
import { mainLogger } from '../../sv_logger';
import { CBSignature, PromiseEventResp, PromiseRequest } from './promise.types';
import { ServerPromiseResp } from '../../../../typings/common';

const netEventLogger = mainLogger.child({ module: 'events' });
let eventSpam: any = {}; // my brain is fucked now lol bug i need for my server fast for deploy xD
const timeSpam: number = 5000;
let lastTimeReset: number = GetGameTimer();

function checkSpam(eventName: string, src: number) {
  const time = GetGameTimer(); //idk if date.getMilliseconds are more fast but on lua i use this
  if (lastTimeReset + timeSpam < time) {
    lastTimeReset = time;
    eventSpam = {};
  }

  if (eventSpam[src] === undefined) {
    eventSpam[src] = {};
    eventSpam[src][eventName] = { count: 1 };
  } else {
    if (eventSpam[src][eventName] === undefined) {
      eventSpam[src][eventName] = { count: 1 };
    } else {
      eventSpam[src][eventName].count++;
    }
  }
  if (eventSpam[src][eventName].count > 20) {
    return true;
  }
  return false;
}

export function onNetPromise<T = any, P = any>(eventName: string, cb: CBSignature<T, P>): void {
  onNet(eventName, async (respEventName: string, data: T) => {
    const startTime = process.hrtime.bigint();
    const src = getSource();

    if (!respEventName) {
      return netEventLogger.warn(
        `Promise event (${eventName}) was called with wrong struct by ${src} (maybe originator wasn't a promiseEvent`,
      );
    }

    if (checkSpam(eventName, src) == true) {
      DropPlayer(String(src), 'spam event');
      return;
    }

    const promiseRequest: PromiseRequest<T> = {
      source: src,
      data,
    };

    netEventLogger.silly(`netPromise > ${eventName} > RequestObj`);
    netEventLogger.silly(promiseRequest);

    const promiseResp: PromiseEventResp<P> = (data: ServerPromiseResp<P>) => {
      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1e6;
      emitNet(respEventName, src, data);
      netEventLogger.silly(`Response Promise Event ${respEventName} (${totalTime}ms), Data >>`);
      netEventLogger.silly(data);
    };

    // In case the cb is a promise, we use Promise.resolve
    Promise.resolve(cb(promiseRequest, promiseResp)).catch((e) => {
      netEventLogger.error(
        `An error occured for a onNetPromise (${eventName}), Error: ${e.message}`,
      );

      promiseResp({ status: 'error', errorMsg: 'UNKNOWN_ERROR' });
    });
  });
}
