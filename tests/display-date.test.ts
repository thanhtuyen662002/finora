import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayToIsoDate,
  isoToDisplayDate,
  maskDisplayDateInput,
} from '../src/lib/dates/display-date';

test('iso to display uses dd/MM/yyyy', () => {
  assert.equal(isoToDisplayDate('2026-11-09'), '09/11/2026');
  assert.equal(isoToDisplayDate('2026-01-31T00:00:00Z'), '31/01/2026');
  assert.equal(isoToDisplayDate(''), '');
  assert.equal(isoToDisplayDate(null), '');
  assert.equal(isoToDisplayDate('11/09/2026'), '');
});

test('display to iso reads day first, not month first', () => {
  assert.equal(displayToIsoDate('09/11/2026'), '2026-11-09');
  assert.equal(displayToIsoDate('31/12/2026'), '2026-12-31');
  assert.equal(displayToIsoDate(' 01/02/2027 '), '2027-02-01');
});

test('display to iso rejects impossible or partial dates', () => {
  assert.equal(displayToIsoDate('31/11/2026'), null);
  assert.equal(displayToIsoDate('29/02/2026'), null);
  assert.equal(displayToIsoDate('29/02/2028'), '2028-02-29');
  assert.equal(displayToIsoDate('00/01/2026'), null);
  assert.equal(displayToIsoDate('12/13/2026'), null);
  assert.equal(displayToIsoDate('9/11/2026'), null);
  assert.equal(displayToIsoDate('09/11/26'), null);
  assert.equal(displayToIsoDate(''), null);
});

test('typing mask inserts slashes and keeps max 8 digits', () => {
  assert.equal(maskDisplayDateInput('0'), '0');
  assert.equal(maskDisplayDateInput('09'), '09');
  assert.equal(maskDisplayDateInput('091'), '09/1');
  assert.equal(maskDisplayDateInput('0911'), '09/11');
  assert.equal(maskDisplayDateInput('09112026'), '09/11/2026');
  assert.equal(maskDisplayDateInput('09/11/2026'), '09/11/2026');
  assert.equal(maskDisplayDateInput('09-11-20269'), '09/11/2026');
  assert.equal(maskDisplayDateInput('ab'), '');
});

test('round trip is stable', () => {
  for (const iso of ['2026-11-01', '2024-02-29', '1999-12-31']) {
    assert.equal(displayToIsoDate(isoToDisplayDate(iso)), iso);
  }
});
