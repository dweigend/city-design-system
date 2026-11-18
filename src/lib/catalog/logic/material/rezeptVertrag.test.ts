import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { flows } from '../../data/focus';
import { familien } from '../../data/materialSeite';
import { bauweisen, tragwerkStufen } from '../../data/materialTraeger';
import { materialModell, materialPlan } from '../traeger/integration/material';
import { rezept, voreinstellung } from './rezept';

const fingerprint = (value: unknown) =>
	createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('Diagram material compatibility', () => {
	it('keeps the established recipe of every family across all flow selections', () => {
		const stroeme = ['neutral' as const, ...flows.map((flow) => flow.id)];
		const rezepte = familien.map(({ id }) =>
			stroeme.map((strom) => rezept(id, voreinstellung(id, strom)))
		);
		assert.equal(
			fingerprint(rezepte),
			'd43079c2f7af9b722a50c4886801fa36ff4abe0941592d7d9a97150048664631'
		);
	});

	it('keeps the bill of materials for all structural detail levels at seed 42', () => {
		const modelle = bauweisen.map(({ id }) => {
			const plan = materialPlan(id, 42);
			return tragwerkStufen.map(({ id: stufe }) => materialModell(plan, stufe));
		});
		assert.equal(
			fingerprint(modelle),
			'76d969d94a7ebcfe8fbd714703cdc2734e7ecacbcbf72e85faa2d336004ee8ac'
		);
	});
});
