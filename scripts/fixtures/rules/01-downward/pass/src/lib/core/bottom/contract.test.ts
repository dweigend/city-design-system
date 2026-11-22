import { expect, test } from 'bun:test';
import { value } from './index';
test('value', () => expect(value).toBe(1));
