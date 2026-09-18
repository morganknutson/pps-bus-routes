import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRouteFromPDF } from '../services/pdfParser.js';

test('extracts a student stop when PDF text splits the time from its address', () => {
  const parsed = parseRouteFromPDF('Anchor Name:LLEWELLYN GT LOADING ZONE\n2:39 pm\n1436 SE SPOKANE ST(SELLWOOD CH-STOP ON 15TH) [W]145LLE-P(2)Stop Order #:', 'id', '145LLE-P_Effective_082626.pdf');
  assert.equal(parsed.name, '145');
  assert.equal(parsed.direction, 'Afternoon');
  assert.equal(parsed.stops.length, 1);
  assert.match(parsed.stops[0].address, /1436 SE Spokane/i);
  assert.equal(parsed.stops[0].skipGeocoding, false);
  assert.equal(parsed.stops[0].time, '2:39 pm');
});

test('reads numbered stops in OCR column order and excludes the school loading zone', () => {
  const parsed = parseRouteFromPDF('Anchor Name:ROSA PARKS GT & ST & CAB LOADING ZONE/8957 N\nStop Order #(1) BEACH SCHOOL (1710 N HUMBOLDT ST) [N] 7:30am 211RSP-A\nStop Order #(2) CHIEF JOSEPH SCHOOL (2409 N SARATOGA ST) [S] 7:36 am 211RSP-A\nStop Order #(3) ROSA PARKS GT & ST & CAB LOADING ZONE/8957 N 7:45am 211RSP-A', 'id', '211RSP-A_effective_062926.pdf');
  assert.equal(parsed.stops.length, 2);
  assert.equal(parsed.stops.every(stop => !stop.skipGeocoding), true);
  assert.match(parsed.stops[0].address, /1710 N Humboldt/i);
});

test('reads legacy summer filenames and route suffix Q', () => {
  const parsed = parseRouteFromPDF('Stop Order #:(3) NE 26TH AV @ NE BROADWAY ST [NW] 3:56 pm 114SAB-Q', 'id', '114-PM-SUN-Effective-071122.pdf');
  assert.equal(parsed.name, '114');
  assert.equal(parsed.direction, 'Afternoon');
  assert.equal(parsed.stops.length, 1);
  assert.equal(parsed.stops[0].skipGeocoding, false);
});

test('normalizes @ in anchor names before excluding the school stop', () => {
  const parsed = parseRouteFromPDF('Anchor Name:ACCESS @ TERWILLIGER GT AND ST LZ ON DAKOTA\n8:45 am\nACCESS @ TERWILLIGER GT AND ST LZ ON DAKOTA127ACC-A(3)Stop Order #:', 'id', '127ACC-A_Effective_082626.pdf');
  assert.equal(parsed.stops.length, 0);
});
