// Run with Node.js: node tools/test_meal_planner.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base = new URL('../', import.meta.url);
const context = {};
vm.runInNewContext(fs.readFileSync(new URL('js/inventory-engine.js', base), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(new URL('js/meal-planner.js', base), 'utf8'), context);
const { build } = context.MealPlanEngine;
const recipes = JSON.parse(fs.readFileSync(new URL('data/recipes_existing.json', base), 'utf8'));
// Test inputs only; never loaded by the application.
const stock = [{ name: '두부', qty: '1모', exp: '2026-11-16' }, { name: '양파', qty: '1개', exp: '2026-11-20' }];
const input = { recipes, stock, people: 2, count: 7, start: '2026-11-15', today: '2026-11-15', matches: (p, name) => p.ingredientsText.includes(name) };
const before = JSON.stringify(input);
const plan = build(input);
assert.equal(plan.meals.length, 7);
const found = plan.meals.filter(m => m.recipeId);
assert.ok(found.length > 0);
assert.equal(new Set(found.map(m => m.recipeId)).size, found.length);
assert.ok(found.every(m => m.recipeFlag === 'J' && m.remainingQuantity === null));
assert.ok(found.every(m => m.date <= '2026-11-16' || !m.matched.includes('두부')));
assert.equal(JSON.stringify(input), before);
assert.ok(build({ ...input, stock: stock.map(s => ({ ...s, demo: true })) }).meals.every(m => !m.recipeId));
assert.ok(build({ ...input, recipes: [] }).meals.every(m => !m.recipeId));
assert.ok(build({ ...input, excluded: [found[0].recipeId] }).meals.every(m => m.recipeId !== found[0].recipeId));
for (const bad of [{ people: 0 }, { count: 8 }, { start: '2026-02-30' }, { start: '2026-11-14' }]) assert.throws(() => build({ ...input, ...bad }));
assert.equal(JSON.parse(JSON.stringify(plan)).meta.source, 'calc');
console.log('Meal planner checks passed.');
