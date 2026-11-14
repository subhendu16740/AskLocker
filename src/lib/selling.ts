// Whether this build shows prices and takes payments.
//
// Only the website does. Google Play lets an Android app sell a digital plan
// only through Google Play's own billing, which AskLocker does not use yet,
// and an app may not send people to pay somewhere else. So the Android app
// shows what each plan includes and what this vault has used, with no price,
// no Pay or "Ask us" button, and no word about where to pay. A vault on a
// paid plan keeps it on every device: paying on the website is enough.

import { Platform } from 'react-native';

export const sellsInApp = Platform.OS === 'web';
