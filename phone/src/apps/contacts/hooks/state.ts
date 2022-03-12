import { atom, selector, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { Contact, ContactEvents } from '@typings/contact';
import fetchNui from '@utils/fetchNui';
import { ServerPromiseResp } from '@typings/common';
import { buildRespObj } from '@utils/misc';
import { BrowserContactsState } from '../utils/constants';

//i dont know react for make good stuff for load config is the reason of the default contact stocked here
const defaultContact = [
  {
    id: 988656,
    display: 'police',
    number: '911',
    avatar: null,
  },
  {
    id: 988657,
    display: 'ems',
    number: '912',
    avatar: null,
  },
];

export async function loadContact() {
  try {
    const resp = await fetchNui<ServerPromiseResp<Contact[]>>(
      ContactEvents.GET_CONTACTS,
      undefined,
      buildRespObj(BrowserContactsState),
    );
    return resp.data;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export const contactsState = {
  contacts: atom<Contact[]>({
    key: 'contactsList',
    default: selector({
      key: 'contactsListDefault',
      get: loadContact,
    }),
  }),
  filterInput: atom<string>({
    key: 'filterInput',
    default: '',
  }),
  filteredContacts: selector({
    key: 'filteredContacts',
    get: ({ get }) => {
      const filterInputVal: string = get(contactsState.filterInput);
      const contacts: Contact[] = [...defaultContact, ...get(contactsState.contacts)];

      if (!filterInputVal) return contacts;
      const regExp = new RegExp(filterInputVal, 'gi');

      return contacts.filter(
        (contact) => contact.display.match(regExp) || contact.number.match(regExp),
      );
    },
  }),
};

export const useSetContacts = () => useSetRecoilState(contactsState.contacts);
export const useContacts = () => useRecoilState(contactsState.contacts);
export const useContactsValue = () => useRecoilValue(contactsState.contacts);

export const useFilteredContacts = () => useRecoilValue(contactsState.filteredContacts);

export const useContactFilterInput = () => useRecoilState(contactsState.filterInput);
export const useSetContactFilterInput = () => useSetRecoilState(contactsState.filterInput);
