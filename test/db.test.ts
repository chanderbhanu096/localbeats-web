import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  allTracks,
  eventsBetween,
  getTrack,
  importFiles,
  logPlay,
  putTrack,
  trackId,
  type Track,
} from "../lib/db.ts";

const track = (over: Partial<Track> = {}): Track => ({
  id: "a.mp3:10",
  title: "Title",
  artist: "Artist",
  album: "Album",
  duration: 1,
  file: new Blob(["0123456789"]),
  addedAt: 0,
  ...over,
});

test("trackId keys on name and size", () => {
  assert.equal(trackId({ name: "a.mp3", size: 10 }), "a.mp3:10");
  assert.notEqual(
    trackId({ name: "a.mp3", size: 10 }),
    trackId({ name: "a.mp3", size: 11 }),
  );
});

test("a stored track survives the round trip with its audio intact", async () => {
  await putTrack(track());
  const got = await getTrack("a.mp3:10");
  assert.equal(got?.title, "Title");
  assert.equal(await got!.file.text(), "0123456789");
});

test("library sorts by artist then title", async () => {
  await putTrack(track({ id: "2", artist: "Zed", title: "A" }));
  await putTrack(track({ id: "3", artist: "Abe", title: "B" }));
  await putTrack(track({ id: "4", artist: "Abe", title: "A" }));
  const order = (await allTracks()).map((t) => `${t.artist}/${t.title}`);
  assert.deepEqual(order.slice(0, 3), ["Abe/A", "Abe/B", "Artist/Title"]);
});

test("plays are logged and queryable by time range", async () => {
  const before = Date.now() - 1;
  await logPlay("a.mp3:10", { lat: 48.13, lng: 11.58 });
  const after = Date.now() + 1;

  const inRange = await eventsBetween(before, after);
  assert.equal(inRange.length, 1);
  assert.equal(inRange[0].type, "play");
  assert.equal(inRange[0].trackId, "a.mp3:10");
  assert.equal(inRange[0].lat, 48.13);

  // The index must actually bound the query, or Memory Radio reads the world.
  assert.equal((await eventsBetween(0, before)).length, 0);
});

test("import falls back to the filename when tags are unreadable, and dedupes", async () => {
  const file = new File(["not really audio"], "Night Drive.mp3");

  const first = await importFiles([file]);
  assert.deepEqual(first, { added: 1, skipped: 0 });

  const stored = await getTrack(trackId(file));
  assert.equal(stored?.title, "Night Drive");
  assert.equal(stored?.artist, "Unknown artist");

  const second = await importFiles([file]);
  assert.deepEqual(second, { added: 0, skipped: 1 });
});
