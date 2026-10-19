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

const RUN_SHEET_TEXT = '\n\n10/7/2026 6:15:38 AMPage 1\nBus Stop Locations For 146LNC-A 10/14/26 -S/R LINCOLN (GT) AM\nPortland School District 1J\nRoute:\nBus:\nDriver:Route Days:\nAnchor:\nTotal Time:\nStart Time:\nEnd Time:\nDistance:\nMax Load:\nTotal Riders:146LNC-A 10/14/26 -S/R\n236875\nLINCOLN GT & ST & CAB LOADING ZONE\n07:03 am\n08:41 am\n97:56\n36.70 mi.\n7\n7\nMTWHF\nSchedule Day:\nDriver Sign-On Time:Driver Sign-Off Time:\nN/AN/A\nPackage #:146\nMonday\nDistancePick UpDrop Off\n7:03 amSTA PORTLAND YARDGARAGE\n7:35 am10738 NW OLD CORNELIUS PASS RD [NE]START1\n7:37 amNW OLD CORNELIUS PASS RD @ NW 185TH PL [SW]STOP1\n7:40 am10729 NW Brooks Rd [W]STOP1\n7:46 am8708 NW Kaiser Rd [W]STOP2\n7:50 am14625 NW GERMANTOWN RD [SE](stop)\n7:51 am13939 GERMANTOWN RD [SE]STOP1\n7:54 am12443 NW GERMANTOWN RD [SW]END1\n8:20 amLINCOLN GT & ST & CAB LOADING ZONEDEST7\n8:41 amSTA PORTLAND YARD [SW]GARAGE';

test('reads driver run sheets, skipping the garage and school destination', () => {
  const parsed = parseRouteFromPDF(RUN_SHEET_TEXT, 'id', '146LNC-A_Effective_101426.pdf');
  assert.equal(parsed.name, '146');
  assert.equal(parsed.direction, 'Morning');
  assert.equal(parsed.anchorName, 'LINCOLN GT & ST & CAB LOADING ZONE');
  assert.equal(parsed.stops.length, 7);
  assert.equal(parsed.stops.every(stop => !stop.skipGeocoding), true);
  assert.match(parsed.stops[0].address, /^10738 NW Old Cornelius Pass Rd\.? \[NE\]$/i);
  assert.equal(parsed.stops[0].time, '7:35 am');
  assert.match(parsed.stops[1].address, /Cornelius Pass Rd\.? & NW 185th Pl\.? \[SW\]/i);
  assert.match(parsed.stops[6].address, /12443 NW Germantown Rd\.? \[SW\]/i);
  assert.equal(parsed.stops.some(stop => /yard|lincoln/i.test(stop.address)), false);
});

test('reads driver run sheets in pdftotext layout column order', () => {
  const parsed = parseRouteFromPDF('Bus Stop Locations For 146LNC-A 10/14/26 -S/R LINCOLN (GT) AM\n7:03 am   GARAGE     STA PORTLAND YARD\n7:46 am   STOP       8708 NW Kaiser Rd [W]                    2\n7:50 am   (stop)     14625 NW GERMANTOWN RD [SE]\n8:20 am   DEST       LINCOLN GT & ST & CAB LOADING ZONE                     7', 'id', '146LNC-A_Effective_101426.pdf');
  assert.equal(parsed.stops.length, 2);
  assert.match(parsed.stops[0].address, /^8708 NW Kaiser Rd\.? \[W\]$/i);
  assert.equal(parsed.stops.every(stop => !stop.skipGeocoding), true);
});

test('normalizes @ in anchor names before excluding the school stop', () => {
  const parsed = parseRouteFromPDF('Anchor Name:ACCESS @ TERWILLIGER GT AND ST LZ ON DAKOTA\n8:45 am\nACCESS @ TERWILLIGER GT AND ST LZ ON DAKOTA127ACC-A(3)Stop Order #:', 'id', '127ACC-A_Effective_082626.pdf');
  assert.equal(parsed.stops.length, 0);
});
