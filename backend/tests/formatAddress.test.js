import test from 'node:test';
import assert from 'node:assert';
import { formatStreetName, expandAddressForGeocoding } from '../utils/formatAddress.js';

test('formatStreetName', async (t) => {
  await t.test('formats simple street names', () => {
    assert.strictEqual(formatStreetName('SW PATTON RD'), 'SW Patton Rd.');
  });

  await t.test('formats intersections', () => {
    assert.strictEqual(
      formatStreetName('SW PATTON RD & SW MONTGOMERY DR'), 
      'SW Patton Rd. & SW Montgomery Dr.'
    );
  });

  await t.test('handles numbers', () => {
    assert.strictEqual(formatStreetName('3737 SW HUMPHREY BLVD'), '3737 SW Humphrey Blvd.');
  });

  await t.test('handles special words', () => {
    assert.strictEqual(
      formatStreetName('AINSWORTH GT & ST & CAB LOAD ZONE'), 
      'Ainsworth Gt. & St. & CAB LOAD ZONE'
    );
  });

  await t.test('handles empty or null input', () => {
    assert.strictEqual(formatStreetName(''), '');
    assert.strictEqual(formatStreetName(null), null);
  });
});

test('expandAddressForGeocoding', async (t) => {
  await t.test('expands abbreviations', () => {
    assert.strictEqual(expandAddressForGeocoding('SW Montgomery Dr.'), 'Southwest Montgomery Drive');
  });

  await t.test('handles intersections', () => {
    assert.strictEqual(
      expandAddressForGeocoding('SW Patton Rd. & SW Montgomery Dr.'),
      'Southwest Patton Road & Southwest Montgomery Drive'
    );
  });

  await t.test('removes direction indicators in brackets', () => {
    assert.strictEqual(expandAddressForGeocoding('SW PATTON RD [NE]'), 'Southwest PATTON Road');
  });
});

