import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntraVerification } from '../src/config/entra';

test('Entra verification is locked to the university tenant and API audience', () => {
  assert.deepEqual(
    createEntraVerification(
      'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f',
      'd16771d8-2e37-476a-be7c-63f4ed09c819'
    ),
    {
      jwksUri: 'https://login.microsoftonline.com/c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f/discovery/v2.0/keys',
      issuer: 'https://login.microsoftonline.com/c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f/v2.0',
      audience: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
      algorithms: ['RS256'],
    }
  );
});
