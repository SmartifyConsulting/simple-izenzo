/** The small set of accounts the team tests with, for the "Switch test user" menu — see
 * ProfileAvatarMenu.tsx. Replace these placeholder addresses with the real sign-in emails for
 * each person; nothing else needs to change once they're correct. Passwords are never stored
 * here — the switcher asks for each account's password once per browser tab (session storage
 * only) the first time you switch to it. */
export const TEST_USERS: { label: string; email: string }[] = [
  { label: "Anastasia", email: "anastasia@REPLACE_ME.izenzo.co.za" },
  { label: "Georgia Adams (Izenzo)", email: "georgia@REPLACE_ME.izenzo.co.za" },
  { label: "Daniel", email: "daniel@REPLACE_ME.izenzo.co.za" },
  { label: "David", email: "david@izenzo.co.za" },
  { label: "James", email: "james@izenzo.co.za" },
  { label: "Hanish (Gmail)", email: "hanishgupta@gmail.com" },
  { label: "Hanish (Seedaxis)", email: "hanish@seedaxis.co.za" },
];
