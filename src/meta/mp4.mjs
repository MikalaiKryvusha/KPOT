// src/meta/mp4.mjs — MP4/MOV creation date: our own minimal ISO-BMFF box walk to `mvhd`.
// [TESTED: 2026-07-24 · tests/meta_phase2.test.mjs — planted mvhd recovered as exact UTC instant,
// unset/alien files yield null; 55/55]
//
// Written in-house by decision (researches/01 §5): the only npm candidates died in 2020, and the
// need is ~100 lines — walk the top-level boxes, enter `moov`, read `mvhd.creation_time`.
// The value is seconds since 1904-01-01 **UTC** → this is an INSTANT claim ('container-created'),
// never a wall claim; converting it to a local year/season is the plan phase's decision.
//
// Reads are positioned and tiny (box headers + one mvhd payload) — a 4 GB video costs a handful
// of 16-byte reads, and moov-at-end files just walk a few headers to get there.

import { open } from 'node:fs/promises';
import { makeEvidence } from './evidence.mjs';

/** Seconds between the QuickTime epoch (1904-01-01) and the Unix epoch (1970-01-01). */
export const QT_EPOCH_OFFSET = 2082844800;

/** Sanity cap on boxes walked at one nesting level — a corrupt size field must not loop forever. */
const MAX_BOXES_PER_LEVEL = 128;

/** Read `n` bytes at absolute `pos`; returns a possibly-shorter buffer at EOF. */
async function readAt(fh, pos, n) {
  const buf = Buffer.alloc(n);
  const { bytesRead } = await fh.read(buf, 0, n, pos);
  return buf.subarray(0, bytesRead);
}

/**
 * Walk one box level in [from, to) looking for `type`; returns {pos, size} of its payload or null.
 * Handles 32-bit sizes, 64-bit largesize (size===1) and to-end-of-file (size===0).
 */
async function findBox(fh, from, to, type) {
  let pos = from;
  for (let i = 0; i < MAX_BOXES_PER_LEVEL && pos + 8 <= to; i++) {
    const head = await readAt(fh, pos, 16);
    if (head.length < 8) return null;
    let size = head.readUInt32BE(0);
    const kind = head.toString('latin1', 4, 8);
    let payload = pos + 8;
    if (size === 1) {
      if (head.length < 16) return null;
      size = Number(head.readBigUInt64BE(8)); // largesize
      payload = pos + 16;
    } else if (size === 0) {
      size = to - pos; // box extends to end of enclosing scope
    }
    if (size < 8 || pos + size > to) return null; // corrupt size — stop, don't guess
    if (kind === type) return { pos: payload, size: pos + size - payload };
    pos += size;
  }
  return null;
}

/**
 * The `mvhd` creation time of an MP4/MOV file as a UTC Date, or null when absent/unset/corrupt.
 * @param {string} absPath
 * @returns {Promise<Date|null>}
 */
export async function mp4CreationInstant(absPath) {
  const fh = await open(absPath, 'r');
  try {
    const { size: fileSize } = await fh.stat();
    const moov = await findBox(fh, 0, fileSize, 'moov');
    if (!moov) return null;
    const mvhd = await findBox(fh, moov.pos, moov.pos + moov.size, 'mvhd');
    if (!mvhd) return null;
    const body = await readAt(fh, mvhd.pos, 20);
    if (body.length < 8) return null;
    const version = body[0];
    // version 0: u32 creation_time at +4 · version 1: u64 at +4
    const secs = version === 1
      ? (body.length >= 12 ? Number(body.readBigUInt64BE(4)) : 0)
      : body.readUInt32BE(4);
    if (secs <= QT_EPOCH_OFFSET) return null; // 0 = unset; pre-1970 = broken — no evidence either way
    return new Date((secs - QT_EPOCH_OFFSET) * 1000);
  } catch {
    return null; // unreadable/corrupt container — no evidence, the caller collects file errors
  } finally {
    await fh.close();
  }
}

/**
 * Date evidence for a video file: the mvhd instant, if the container has one.
 * @param {string} absPath
 * @returns {Promise<object[]>}
 */
export async function mp4Evidence(absPath) {
  const instant = await mp4CreationInstant(absPath);
  return instant ? [makeEvidence('container-created', { instant, detail: 'mvhd' })] : [];
}
