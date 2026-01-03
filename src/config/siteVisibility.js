import { doc } from 'firebase/firestore'
import { db } from '../firebase.js'

export const DEFAULT_SITE_VISIBILITY = {
  artistsEnabled: true,
  artistPagesEnabled: true,
}

export const SITE_VISIBILITY_DOC = doc(db, 'settings', 'siteVisibility')
