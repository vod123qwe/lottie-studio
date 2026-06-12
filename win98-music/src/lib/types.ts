// Core data model for the virtual "C: drive" and the player.

/** Where the audio actually comes from. */
export type TrackSource =
  | { kind: 'youtube'; videoId: string } // streamed via the official IFrame player
  | { kind: 'audio'; url: string } //  direct audio URL or object URL (uploaded MP3)

export interface Track {
  id: string
  title: string
  artist: string
  /** Duration in seconds, if known up front (YouTube fills it in on load). */
  durationSec?: number
  source: TrackSource
}

/** A node in the virtual filesystem tree. */
export type FsNode = FolderNode | TrackNode

export interface FolderNode {
  kind: 'folder'
  id: string
  name: string
  /** Icon hint for the explorer: 'drive' | 'folder' | 'music'. */
  icon?: 'drive' | 'folder' | 'music'
  children: FsNode[]
}

export interface TrackNode {
  kind: 'track'
  id: string
  track: Track
}

export const isFolder = (n: FsNode): n is FolderNode => n.kind === 'folder'
export const isTrack = (n: FsNode): n is TrackNode => n.kind === 'track'

let counter = 0
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`
